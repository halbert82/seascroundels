// Tareas de las reglas nuevas de Peligro (fase 6): «Elige», Pruebas de una Acción, las permanentes (fase 11) y su
// contador, fichas de Estado, Incautado, ocupar el muelle, mirar o descartar cartas del mazo de Peligros,
// agotar a un Tripulante para pagar y el Peligro de más de «Perseguido».

import { entero } from '../azar.ts'
import { costeImpreso, esIndestructible, nombreDe, porId, rasgosDe, tipoDe } from '../catalogo.ts'
import { definicionEncuentro, quedaDe, reglasPermanente } from '../definiciones.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, conEstado, ponerEstado, ponerEstadoBarco, quitarEstadoAnotado, quitarEstadoBarco, sePuedeQuitar, tieneEstado } from '../estados.ts'
import { INFO_ESTADO, sujetoJuntoAlBarco } from '../infoEstados.ts'
import { descartarPeligro, mazoActivo, persigueVigente, ponerEnMuelle } from '../peligros.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { mover, rebarajar } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'
import { cumple, sePuedePagarEntero } from './efectos.ts'
import { empezarPrueba } from './encuentro.ts'
import { baseDelSelector, porCriterio } from './peligros2.ts'

// ---------------------------------------------------------------------------
// «Elige» y Pruebas de una Acción

/**
 * «Elige»: antes de comprometer, una Prueba (quizá más difícil) o pagar algo, o entre dos o tres pagos.
 * Si eliges pagar, el encuentro queda resuelto (con su Avance, como siempre).
 */
export const elegirEncuentro: Manejador<'elegirEncuentro'> = (s, t, e) => {
  if (!s.mision || s.mision.fin || !s.zonas.encuentro.includes(t.carta)) return 'hecha'
  const def = definicionEncuentro(s, t.carta)
  const todas = (def.elige ?? []).map((o, i) => ({ o, i })).filter(({ o }) => !o.si || cumple(s, o.si))
  let disponibles = todas.filter(({ o }) => sePuedePagarEntero(s, o.efectos ?? []))
  // Si no se puede pagar entera ninguna, se aplica la primera como se pueda.
  if (disponibles.length === 0) disponibles = todas.slice(0, 1)
  let elegida: (typeof disponibles)[number] | undefined = disponibles[0]
  if (disponibles.length > 1) {
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'elige', carta: copia(s, t.carta).id },
        opciones: disponibles.map(({ o, i }) => ({ clave: String(i), texto: o.texto })),
      })
    }
    const clave = eleccionDe(e, 'opcion').clave
    elegida = disponibles.find(({ i }) => String(i) === clave)
  }
  if (!elegida) return 'hecha'
  const { o } = elegida
  anotar(s, 'jugada', `Eliges: ${o.texto}.`)
  if (o.prueba) {
    const si = o.modSi && cumple(s, o.modSi.condicion) ? o.modSi.n : 0
    empezarPrueba(s, t.carta, (t.extra ?? 0) + (o.modDificultad ?? 0) + si)
    // «Le das 2 munición (y haces la Prueba), o la Prueba recibe +2»: primero se paga, luego la Prueba.
    encolar(s, ...(o.efectos && o.efectos.length > 0 ? [{ tipo: 'aplicarEfectos' as const, efectos: o.efectos, contexto: 'pago' as const, fuente: t.carta }] : []), {
      tipo: 'prueba',
      paso: 'comprometer',
    })
  } else {
    encolar(s, { tipo: 'aplicarEfectos', efectos: o.efectos ?? [], contexto: 'pago', fuente: t.carta })
  }
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Zona de permanentes (fase 11)

/**
 * «Pon en juego la carta N del mazo de historia (junto a él). Si no está en el mazo de historia, descarta esta carta sin
 * ganar su Avance y revela otra.» La permanente va a la zona de permanentes, junto a la misión, con su texto activo. El
 * Avance del encuentro y el resto funcionan como antes («Se queda en juego»): lo da el paso del Avance del encuentro, que
 * también descarta la carta del encuentro como cualquier otra.
 */
export const ponerPermanente: Manejador<'ponerPermanente'> = (s, t, e) => {
  const m = s.mision
  if (!m || m.fin || !s.zonas.encuentro.includes(t.carta)) return 'hecha'
  const perm = s.zonas.mazoHistoria.find((c) => copia(s, c).id === t.permanente)
  if (!perm) {
    anotar(
      s,
      'aviso',
      `La carta ${porId(t.permanente).num} («${nombreDe(t.permanente)}») no está en el mazo de historia: descartas «${nombre(s, t.carta)}» sin ganar su Avance y revelas otra.`,
    )
    descartarPeligro(s, t.carta)
    return 'hecha'
  }
  // Junto a qué Tripulante («el preparado con más EXP», «uno al azar»…).
  let junto: InstId | undefined
  if (t.junto) {
    const elegibles = porCriterio(s, baseDelSelector(s, t.junto), t.junto.por)
    if (t.junto.por === 'azar' && elegibles.length > 0) {
      junto = elegibles[entero(s, elegibles.length)]
      s.infoRevelada++
    } else if (elegibles.length > 1) {
      if (!e) {
        return preguntar({
          tipo: 'elegirCartas',
          motivo: { clave: 'junto', carta: t.permanente },
          candidatas: elegibles,
          min: 1,
          max: 1,
        })
      }
      junto = eleccionDe(e, 'cartas').ids[0]
    } else junto = elegibles[0]
  }
  mover(s, perm, 'permanentes', 'abajo')
  const c = copia(s, perm)
  c.origen = t.carta
  if (junto) c.junto = junto
  const q = reglasPermanente(t.permanente)
  const fichas = t.fichas ?? q?.fichasIniciales
  if (q?.contador || fichas) c.fichas = fichas ?? 0
  m.permanenteNueva = perm
  anotar(
    s,
    'aviso',
    `Pones en juego «${nombre(s, perm)}» (carta ${porId(t.permanente).num} del mazo de historia)${junto ? `, junto a ${nombre(s, junto)}` : ''}.`,
  )
  if (q?.alEntrar && q.alEntrar.length > 0) encolar(s, { tipo: 'aplicarEfectos', efectos: q.alEntrar, contexto: 'efecto', fuente: perm })
  return 'hecha'
}

/** «Descarta esta carta» en una permanente: vuelve al mazo de historia (con sus fichas fuera). */
export const devolverPermanente: Manejador<'devolverPermanente'> = (s, t) => {
  if (!s.zonas.permanentes.includes(t.carta)) return 'hecha'
  anotar(s, 'efecto', `«${nombre(s, t.carta)}» vuelve al mazo de historia.`)
  mover(s, t.carta, 'mazoHistoria', 'abajo')
  return 'hecha'
}

/** Pon 1 ficha en la carta; al llegar a su número, ocurre lo que dice (y se descarta, vuelve a 0 o sigue). */
export const contador: Manejador<'contador'> = (s, t) => {
  const q = quedaDe(s, t.carta)?.contador
  if (!q || !s.zonas.permanentes.includes(t.carta)) return 'hecha'
  const c = copia(s, t.carta)
  c.fichas = (c.fichas ?? 0) + 1
  anotar(s, 'efecto', `«${nombre(s, t.carta)}»: ${c.fichas} de ${q.umbral} fichas.`)
  if (c.fichas !== q.umbral) return 'hecha'
  anotar(s, 'aviso', `«${nombre(s, t.carta)}» llega a ${q.umbral} fichas.`)
  const tareas: NuevaTarea[] = [{ tipo: 'aplicarEfectos', efectos: q.efectos, contexto: 'disparo', fuente: t.carta }]
  if (q.despues === 'descartar') tareas.push({ tipo: 'devolverPermanente', carta: t.carta })
  if (q.despues === 'reiniciar') c.fichas = 0
  encolar(s, ...tareas)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Fichas de Estado

/** Pone un Estado a uno de los indicados que no lo tenga (si hay varios, eliges). */
export const ponerEstado_: Manejador<'ponerEstado'> = (s, t, e) => {
  const info = INFO_ESTADO[t.estado]
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c) && !tieneEstado(s, c, t.estado))
  if (candidatos.length === 0) {
    if (t.entre.some((c) => s.zonas.tripulacion.includes(c))) anotar(s, 'efecto', `Nadie más puede quedar ${info.nombre}: ya lo están.`)
    return 'hecha'
  }
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'ponerEstado', carta: `estado:${t.estado}` }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegido) return 'hecha'
  ponerEstado(s, elegido, t.estado)
  anotar(s, 'aviso', `${nombre(s, elegido)} queda ${info.nombre}.`)
  return 'hecha'
}

export const ponerEstadoBarco_: Manejador<'ponerEstadoBarco'> = (s, t) => {
  // Fase 16: Desmoralizado es de la tripulación («Tu tripulación queda Desmoralizada»), aunque su carta va junto al Barco.
  const { quien, adjetivo } = sujetoJuntoAlBarco(t.estado)
  const Quien = quien.charAt(0).toUpperCase() + quien.slice(1)
  if (ponerEstadoBarco(s, t.estado)) anotar(s, 'aviso', `${Quien} queda ${adjetivo}.`)
  else anotar(s, 'efecto', `${Quien} ya está ${adjetivo}.`)
  return 'hecha'
}

/** Quita un Estado: a todos, o a uno de los indicados que lo tenga (si hay varios, eliges). */
export const quitarEstado_: Manejador<'quitarEstado'> = (s, t, e) => {
  if (t.de === 'todos') {
    for (const c of conEstado(s, t.estado)) quitarEstadoAnotado(s, c, t.estado)
    return 'hecha'
  }
  const candidatos = t.de.filter((c) => s.zonas.tripulacion.includes(c) && tieneEstado(s, c, t.estado) && sePuedeQuitar(s, c, t.estado))
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'quitarEstado', carta: `estado:${t.estado}` }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (elegido) quitarEstadoAnotado(s, elegido, t.estado)
  return 'hecha'
}

export const quitarEstadoBarco_: Manejador<'quitarEstadoBarco'> = (s, t) => {
  const { quien, adjetivo } = sujetoJuntoAlBarco(t.estado)
  const Quien = quien.charAt(0).toUpperCase() + quien.slice(1)
  if (quitarEstadoBarco(s, t.estado)) anotar(s, 'efecto', `${Quien} ya no está ${adjetivo}.`)
  return 'hecha'
}

/** Al final del turno: cada Envenenado sufre 1 herida; Borracho, Asustado e Inspirado se quitan (fase 10b). */
export const estadosFinTurno: Manejador<'estadosFinTurno'> = (s, t) => {
  switch (t.paso) {
    case 'veneno': {
      const envenenados = conEstado(s, 'envenenado')
      for (const c of envenenados) {
        anotar(s, 'efecto', `${nombre(s, c)} está Envenenado: sufre 1 herida.`)
        encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] })
      }
      t.paso = 'borracho'
      return 'sigue'
    }
    case 'borracho':
      for (const e of ['borracho', 'asustado', 'inspirado'] as const) {
        for (const c of conEstado(s, e)) quitarEstadoAnotado(s, c, e, 'final del turno')
      }
      return 'hecha'
  }
}

// ---------------------------------------------------------------------------
// Incautado y el muelle

const NOMBRE_INCAUTAR = { mano: 'cartas de tu mano', mejora: 'una Mejora' } as const

/**
 * Cartas de la mano, una Mejora o un Tripulante van debajo de la carta de misión hasta saber si la superas. Las eliges
 * tú (P9), salvo que la carta diga «al azar» o «las de más coste»; si llevas una carta «obligada», tiene que ser ella.
 */
export const incautar: Manejador<'incautar'> = (s, t, e) => {
  if (!s.mision) return 'hecha'
  // Fase 14: ya no se incautan Tripulantes (fuera el rehén); solo cartas de la mano o una Mejora.
  let candidatas =
    t.que === 'mano'
      ? [...s.zonas.mano]
      : s.zonas.mejoras.filter((m) => {
          const v = copia(s, m).vinculadaA
          return !esIndestructible(copia(s, m).id) && (!t.deTripulantes || (v !== null && v !== 'barco' && s.zonas.tripulacion.includes(v)))
        })
  if (t.obligadas) {
    const obligadas = candidatas.filter((c) => t.obligadas?.includes(copia(s, c).id))
    if (obligadas.length > 0) candidatas = obligadas
  }
  if (candidatas.length === 0) {
    anotar(s, 'efecto', `No hay ${NOMBRE_INCAUTAR[t.que]} que incautar.`)
    return 'hecha'
  }
  const n = Math.min(t.n, candidatas.length)
  let elegidas: InstId[] = candidatas
  if (candidatas.length > n) {
    if (t.criterio === 'azar') {
      const resto = [...candidatas]
      elegidas = []
      for (let i = 0; i < n; i++) elegidas.push(...resto.splice(entero(s, resto.length), 1))
      s.infoRevelada++
    } else if (t.criterio === 'mayorCoste') {
      // Las de más coste; si empatan en el corte, eliges entre las empatadas.
      const orden = [...candidatas].sort((x, y) => costeImpreso(copia(s, y).id) - costeImpreso(copia(s, x).id))
      const corte = costeImpreso(copia(s, orden[n - 1] as InstId).id)
      const seguras = orden.filter((c) => costeImpreso(copia(s, c).id) > corte)
      const empatadas = orden.filter((c) => costeImpreso(copia(s, c).id) === corte)
      const faltan = n - seguras.length
      if (empatadas.length > faltan) {
        if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'incautar', n: faltan }, candidatas: empatadas, min: faltan, max: faltan })
        elegidas = [...seguras, ...eleccionDe(e, 'cartas').ids]
      } else elegidas = [...seguras, ...empatadas]
    } else {
      if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'incautar', n }, candidatas, min: n, max: n })
      elegidas = eleccionDe(e, 'cartas').ids
    }
  }
  const zona = t.que === 'mano' ? 'mano' : 'mejoras'
  for (const c of elegidas) {
    const portador = copia(s, c).vinculadaA
    s.incautadas = {
      ...(s.incautadas ?? {}),
      [c]: { zona, ...(portador ? { portador } : {}), ...(t.siPierdes ? { siPierdes: t.siPierdes } : {}) },
    }
    mover(s, c, 'incautadas', 'abajo')
  }
  if (t.alRecuperar && t.alRecuperar.length > 0) s.mision.alRecuperar = [...(s.mision.alRecuperar ?? []), ...t.alRecuperar]
  if (t.anotacion) anotar(s, 'jugada', `${t.anotacion}: ${nombres(s, elegidas)}.`)
  else anotar(s, 'aviso', `Te incautan ${nombres(s, elegidas)}: si superas la misión, lo recuperas.`)
  return 'hecha'
}

/**
 * La carta de Peligro ocupa el muelle. Si es la del encuentro, va cuando termine de resolverse (en vez de a los
 * descartes); si ya estaba en juego, va ahora.
 */
export const ocuparMuelle: Manejador<'ocuparMuelle'> = (s, t) => {
  if (s.mision && s.zonas.encuentro.includes(t.carta)) {
    s.mision.alMuelle = { carta: t.carta, coste: t.coste }
    return 'hecha'
  }
  if (s.zonas.destino.includes(t.carta)) ponerEnMuelle(s, t.carta, t.coste)
  return 'hecha'
}

export const descartarDelMuelle: Manejador<'descartarDelMuelle'> = (s, t) => {
  if (!s.zonas.muelle.includes(t.carta)) return 'hecha'
  const resto = { ...(s.peligrosEnMuelle ?? {}) }
  delete resto[t.carta]
  if (Object.keys(resto).length > 0) s.peligrosEnMuelle = resto
  else delete s.peligrosEnMuelle
  mover(s, t.carta, 'descartesPeligros')
  anotar(s, 'efecto', `Descartas «${nombre(s, t.carta)}» del muelle.`)
  return 'hecha'
}

/** Descarta una carta del muelle (la de más a la izquierda, o la Mejora más cara: si empatan, eliges) y repón si lo dice. */
export const descartarMuelle: Manejador<'descartarMuelle'> = (s, t, e) => {
  const cartas = s.zonas.muelle.filter((c) => s.peligrosEnMuelle?.[c] === undefined)
  let candidatas: InstId[]
  if (t.cual === 'izquierda') candidatas = cartas.slice(0, 1)
  else {
    const mejoras = cartas.filter((c) => ['mejoraBarco', 'mejoraTripulante'].includes(tipoDe(copia(s, c).id)))
    const maximo = Math.max(-1, ...mejoras.map((c) => costeImpreso(copia(s, c).id)))
    candidatas = mejoras.filter((c) => costeImpreso(copia(s, c).id) === maximo)
  }
  if (candidatas.length === 0) return 'hecha'
  if (candidatas.length > 1 && !e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'descartarMuelle' }, candidatas, min: 1, max: 1 })
  const c = candidatas.length === 1 ? candidatas[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!c) return 'hecha'
  mover(s, c, 'descartesMuelle')
  anotar(s, 'efecto', `Se descarta del muelle «${nombre(s, c)}».`)
  if (t.reponer) encolar(s, { tipo: 'revelarMuelle', n: 1 })
  return 'hecha'
}

// ---------------------------------------------------------------------------
// El mazo de Peligros

function prepararMazo(s: Parameters<Manejador<'mirarPeligros'>>[0]): ReturnType<typeof mazoActivo> {
  const activo = mazoActivo(s)
  if (s.zonas[activo.mazo].length === 0 && s.zonas[activo.descartes].length > 0) rebarajar(s, activo.descartes, activo.mazo)
  return activo
}

/** Mira las N de arriba del mazo de Peligros (quedan como estaban). */
export const mirarPeligros: Manejador<'mirarPeligros'> = (s, t) => {
  const { mazo } = prepararMazo(s)
  const cartas = s.zonas[mazo].slice(0, t.n)
  if (cartas.length === 0) return 'hecha'
  s.infoRevelada++
  anotar(s, 'revelar', `Miras ${cartas.length === 1 ? 'la carta' : `las ${cartas.length} cartas`} de arriba del mazo de Peligros: ${nombres(s, cartas)}.`)
  return 'hecha'
}

/** Descarta las N de arriba del mazo de Peligros sin resolverlas. */
export const descartarArriba: Manejador<'descartarArriba'> = (s, t) => {
  const descartadas: InstId[] = []
  for (let i = 0; i < t.n; i++) {
    const { mazo } = prepararMazo(s)
    const c = s.zonas[mazo][0]
    if (!c) break
    if (s.persigue === c) s.persigue = null
    descartarPeligro(s, c)
    descartadas.push(c)
  }
  if (descartadas.length === 0) return 'hecha'
  s.infoRevelada++
  anotar(s, 'revelar', `Descartas sin resolver: ${nombres(s, descartadas)}.`)
  persigueVigente(s)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Costes y «Perseguido»

/** Agota a un Tripulante preparado (con ese Rasgo, si lo pide) para pagar un coste. */
export const agotarParaPagar: Manejador<'agotarParaPagar'> = (s, t, e) => {
  const rasgos = t.rasgos ?? (t.rasgo === null ? null : [t.rasgo])
  const candidatos = s.zonas.tripulacion.filter(
    (c) => c !== t.menos && !copia(s, c).agotada && (rasgos === null || rasgos.some((r) => rasgosDe(copia(s, c).id).includes(r))),
  )
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    const quien = rasgos?.join(' o ')
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar', ...(quien ? { carta: quien } : {}) }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegido) return 'hecha'
  anotar(s, 'pagar', `Agotas a ${nombre(s, elegido)} para pagar.`)
  agotar(s, elegido)
  if (s.prueba && !s.prueba.agotadas.includes(elegido)) s.prueba.agotadas.push(elegido)
  return 'hecha'
}

