// Tareas de las reglas nuevas de Peligro (fase 6): «Elige», Pruebas de una Acción, cartas que se quedan en juego
// y su contador, fichas de Estado, Incautado, ocupar el muelle, mirar o descartar cartas del mazo de Peligros,
// agotar a un Tripulante para pagar y el Peligro de más de «Perseguido».

import { entero } from '../azar.ts'
import { costeImpreso, esIndestructible, rasgosDe, tipoDe } from '../catalogo.ts'
import { definicionEncuentro, quedaDe } from '../definiciones.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, conEstado, ponerEstado, ponerEstadoBarco, quitarEstadoAnotado, quitarEstadoBarco, tieneEstado, tieneEstadoBarco } from '../estados.ts'
import { INFO_ESTADO } from '../infoEstados.ts'
import { cerrarPrueba, descartarPeligro, entornoActual, mazoActivo, persigueVigente, ponerEnMuelle } from '../peligros.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { valor } from '../valores.ts'
import { mover, rebarajar } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'
import { cumple, sePuedePagarEntero } from './efectos.ts'
import { empezarPrueba } from './encuentro.ts'

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
    empezarPrueba(s, t.carta, (t.extra ?? 0) + (o.modDificultad ?? 0) + si, 'encuentro')
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

/**
 * Una Prueba que no sale de un encuentro (la Acción de una carta, liberar a un Encadenado). Es una Prueba normal:
 * se compromete, se revela Destino y, si no hay nadie, se aplica Sin oposición.
 */
export const pruebaSuelta: Manejador<'pruebaSuelta'> = (s, t) => {
  if (t.paso === 'empezar') {
    // No se puede empezar una Prueba de una Acción durante otra Prueba (P2).
    if (s.prueba) return 'hecha'
    const p = empezarPrueba(s, t.fuente, 0, 'accion')
    p.definicion = t.definicion
    if (t.definicion.sinAyuda) p.sinAyuda = true
    anotar(s, 'jugada', `${t.definicion.nombre}: Prueba de ${t.definicion.opciones.map((o) => `${o.hab} ${o.dificultad}`).join(' o ')}.`)
    encolar(s, { tipo: 'prueba', paso: 'comprometer' })
    t.paso = 'cerrar'
    return 'sigue'
  }
  if (s.prueba?.origen === 'accion' && s.prueba.encuentro === t.fuente) cerrarPrueba(s)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Cartas de Peligro que se quedan en juego

/**
 * La carta revelada se queda en juego junto a la misión, con su texto activo, hasta que se cumpla lo que dice
 * para quitarla. Cuenta como resuelta y da su Avance al revelarla.
 */
// El Avance impreso de un encuentro que se queda en juego se gana al revelarlo.
// Una carta que se queda en juego cuenta como carta resuelta, para poder superar la misión (P1).
export const quedarEnJuego: Manejador<'quedarEnJuego'> = (s, t) => {
  const m = s.mision
  if (!m || m.fin || !s.zonas.encuentro.includes(t.carta)) return 'hecha'
  const def = definicionEncuentro(s, t.carta)
  mover(s, t.carta, 'peligrosEnJuego', 'abajo')
  const q = quedaDe(s, t.carta)
  if (q?.contador || q?.fichasIniciales) copia(s, t.carta).fichas = q.fichasIniciales ?? 0
  m.cartasResueltas++
  anotar(s, 'aviso', `«${nombre(s, t.carta)}» se queda en juego junto a la misión.`)
  if (def.avance > 0) {
    const mc = copia(s, m.carta)
    mc.avance += def.avance
    anotar(s, 'efecto', `Ganas ${def.avance} de Avance (${mc.avance}/${valor(s, { tipo: 'avanceNecesario', mision: m.carta })}).`, {
      tipo: 'avance',
      n: def.avance,
      total: mc.avance,
    })
  }
  encolar(s, { tipo: 'evento', ev: { tipo: 'cartaResuelta', carta: t.carta }, fase: 'antes', cancelado: false, usadas: [] })
  return 'hecha'
}

export const descartarPeligroEnJuego: Manejador<'descartarPeligroEnJuego'> = (s, t) => {
  if (!s.zonas.peligrosEnJuego.includes(t.carta)) return 'hecha'
  anotar(s, 'efecto', `Quitas «${nombre(s, t.carta)}».`)
  descartarPeligro(s, t.carta)
  return 'hecha'
}

/** Pon 1 ficha en la carta; al llegar a su número, ocurre lo que dice (y se descarta, vuelve a 0 o sigue). */
export const contador: Manejador<'contador'> = (s, t) => {
  const q = quedaDe(s, t.carta)?.contador
  if (!q || !s.zonas.peligrosEnJuego.includes(t.carta)) return 'hecha'
  const c = copia(s, t.carta)
  c.fichas = (c.fichas ?? 0) + 1
  anotar(s, 'efecto', `«${nombre(s, t.carta)}»: ${c.fichas} de ${q.umbral} fichas.`)
  if (c.fichas !== q.umbral) return 'hecha'
  anotar(s, 'aviso', `«${nombre(s, t.carta)}» llega a ${q.umbral} fichas.`)
  const tareas: NuevaTarea[] = [{ tipo: 'aplicarEfectos', efectos: q.efectos, contexto: 'disparo', fuente: t.carta }]
  if (q.despues === 'descartar') tareas.push({ tipo: 'descartarPeligroEnJuego', carta: t.carta })
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
  const info = INFO_ESTADO[t.estado]
  if (ponerEstadoBarco(s, t.estado)) anotar(s, 'aviso', `El Barco: ${info.nombre}.`)
  else anotar(s, 'efecto', `El Barco ya tiene ${info.nombre}.`)
  return 'hecha'
}

/** Quita un Estado: a todos, o a uno de los indicados que lo tenga (si hay varios, eliges). */
export const quitarEstado_: Manejador<'quitarEstado'> = (s, t, e) => {
  if (t.de === 'todos') {
    for (const c of conEstado(s, t.estado)) quitarEstadoAnotado(s, c, t.estado)
    return 'hecha'
  }
  const candidatos = t.de.filter((c) => (s.zonas.tripulacion.includes(c) || s.zonas.rehenes.includes(c)) && tieneEstado(s, c, t.estado))
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'quitarEstado', carta: `estado:${t.estado}` }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (elegido) quitarEstadoAnotado(s, elegido, t.estado)
  return 'hecha'
}

export const quitarEstadoBarco_: Manejador<'quitarEstadoBarco'> = (s, t) => {
  if (quitarEstadoBarco(s, t.estado)) anotar(s, 'efecto', `El Barco ya no tiene ${INFO_ESTADO[t.estado].nombre}.`)
  return 'hecha'
}

/** Al final del turno: cada Envenenado sufre 1 herida; Borracho se quita. */
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
      for (const c of conEstado(s, 'borracho')) quitarEstadoAnotado(s, c, 'borracho', 'final del turno')
      return 'hecha'
  }
}

// ---------------------------------------------------------------------------
// Incautado y el muelle

const NOMBRE_INCAUTAR = { mano: 'cartas de tu mano', mejora: 'una Mejora', tripulante: 'un Tripulante' } as const

/**
 * Cartas de la mano, una Mejora o un Tripulante van debajo de la carta de misión hasta saber si la superas. Las eliges
 * tú (P9), salvo que la carta diga «al azar» o «las de más coste»; si llevas una carta «obligada», tiene que ser ella.
 */
export const incautar: Manejador<'incautar'> = (s, t, e) => {
  if (!s.mision) return 'hecha'
  let candidatas =
    t.que === 'mano'
      ? [...s.zonas.mano]
      : t.que === 'mejora'
        ? s.zonas.mejoras.filter((m) => {
            const v = copia(s, m).vinculadaA
            return !esIndestructible(copia(s, m).id) && (!t.deTripulantes || (v !== null && v !== 'barco' && s.zonas.tripulacion.includes(v)))
          })
        : s.zonas.tripulacion.filter((c) => c !== s.capitan)
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
  const zona = t.que === 'mano' ? 'mano' : t.que === 'mejora' ? 'mejoras' : 'tripulacion'
  for (const c of elegidas) {
    const portador = copia(s, c).vinculadaA
    s.incautadas = {
      ...(s.incautadas ?? {}),
      [c]: { zona, ...(portador ? { portador } : {}), ...(t.siPierdes ? { siPierdes: t.siPierdes } : {}) },
    }
    mover(s, c, 'incautadas', 'abajo')
  }
  if (t.alRecuperar && t.alRecuperar.length > 0) s.mision.alRecuperar = [...(s.mision.alRecuperar ?? []), ...t.alRecuperar]
  anotar(s, 'aviso', `Te incautan ${nombres(s, elegidas)}: si superas la misión, lo recuperas.`)
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
  if (s.zonas.peligrosEnJuego.includes(t.carta) || s.zonas.destino.includes(t.carta)) ponerEnMuelle(s, t.carta, t.coste)
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
  const candidatos = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada && (rasgos === null || rasgos.some((r) => rasgosDe(copia(s, c).id).includes(r))))
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

/** «Perseguido»: tu próxima misión de Mar empieza revelando un Peligro de más (sin ventana para retirarte entre ambos). */
// El Peligro de más se resuelve entero antes que el primero, sin ventana de retirada entre ambos; cuenta y da Avance (P6).
export const peligroDeMas: Manejador<'peligroDeMas'> = (s) => {
  if (!s.mision || s.mision.fin || entornoActual(s) !== 'mar' || !tieneEstadoBarco(s, 'perseguido')) return 'hecha'
  quitarEstadoBarco(s, 'perseguido')
  anotar(s, 'aviso', 'Te persiguen: la misión empieza con un Peligro de más.')
  encolar(s, { tipo: 'encuentro', carta: null, paso: 'revelar', sinVentana: true })
  return 'hecha'
}
