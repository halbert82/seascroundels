// Tareas de las reglas nuevas de Peligro (fase 6): «Elige», Pruebas de una Acción, cartas que se quedan en juego
// y su contador, fichas de Estado, Incautado, ocupar el muelle, mirar o descartar cartas del mazo de Peligros,
// agotar a un Tripulante para pagar y el Peligro de más de «Perseguido».

import { esIndestructible, rasgosDe } from '../catalogo.ts'
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
  const todas = (def.elige ?? []).map((o, i) => ({ o, i }))
  let disponibles = todas.filter(({ o }) => o.prueba || sePuedePagarEntero(s, o.efectos ?? []))
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
    encolar(s, { tipo: 'prueba', paso: 'comprometer' })
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
    // TODO(regla): P2 · no se puede empezar una Prueba de una Acción durante otra Prueba.
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
// TODO(regla): P1 · una carta que se queda en juego cuenta como carta resuelta (para poder superar la misión).
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

/**
 * Al final del turno: cada Envenenado sufre 1 herida; cada Tripulante con Fiebre la contagia a otro sin Fiebre
 * (eliges a quién); Borracho se quita.
 */
// TODO(regla): P3 · la Fiebre se contagia a quien elijas; si hay varios con Fiebre, contagia cada uno.
export const estadosFinTurno: Manejador<'estadosFinTurno'> = (s, t, e) => {
  switch (t.paso) {
    case 'veneno': {
      const envenenados = conEstado(s, 'envenenado')
      for (const c of envenenados) {
        anotar(s, 'efecto', `${nombre(s, c)} está Envenenado: sufre 1 herida.`)
        encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] })
      }
      t.paso = 'fiebre'
      t.pendientes = conEstado(s, 'fiebre')
      return 'sigue'
    }
    case 'fiebre': {
      const actual = t.pendientes.find((c) => s.zonas.tripulacion.includes(c) && tieneEstado(s, c, 'fiebre'))
      if (!actual) {
        t.paso = 'borracho'
        return 'sigue'
      }
      const candidatos = s.zonas.tripulacion.filter((c) => c !== actual && !tieneEstado(s, c, 'fiebre'))
      if (candidatos.length > 1 && !e) {
        return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'contagio', carta: copia(s, actual).id }, candidatas: candidatos, min: 1, max: 1 })
      }
      const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
      if (elegido) {
        ponerEstado(s, elegido, 'fiebre')
        anotar(s, 'aviso', `${nombre(s, actual)} contagia la Fiebre a ${nombre(s, elegido)}.`)
      }
      t.pendientes = t.pendientes.filter((c) => c !== actual)
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

/** Cartas de la mano, una Mejora o un Tripulante van debajo de la carta de misión hasta saber si la superas. */
export const incautar: Manejador<'incautar'> = (s, t, e) => {
  if (!s.mision) return 'hecha'
  const candidatas =
    t.que === 'mano'
      ? [...s.zonas.mano]
      : t.que === 'mejora'
        ? s.zonas.mejoras.filter((m) => !esIndestructible(copia(s, m).id))
        : s.zonas.tripulacion.filter((c) => c !== s.capitan)
  if (candidatas.length === 0) {
    anotar(s, 'efecto', `No hay ${NOMBRE_INCAUTAR[t.que]} que incautar.`)
    return 'hecha'
  }
  const n = Math.min(t.n, candidatas.length)
  let elegidas = candidatas
  if (candidatas.length > n) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'incautar', n }, candidatas, min: n, max: n })
    elegidas = eleccionDe(e, 'cartas').ids
  }
  const zona = t.que === 'mano' ? 'mano' : t.que === 'mejora' ? 'mejoras' : 'tripulacion'
  for (const c of elegidas) {
    const portador = copia(s, c).vinculadaA
    s.incautadas = { ...(s.incautadas ?? {}), [c]: portador ? { zona, portador } : { zona } }
    mover(s, c, 'incautadas', 'abajo')
  }
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
  const candidatos = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada && (t.rasgo === null || rasgosDe(copia(s, c).id).includes(t.rasgo)))
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar', ...(t.rasgo ? { carta: t.rasgo } : {}) }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegido) return 'hecha'
  anotar(s, 'pagar', `Agotas a ${nombre(s, elegido)} para pagar.`)
  agotar(s, elegido)
  if (s.prueba && !s.prueba.agotadas.includes(elegido)) s.prueba.agotadas.push(elegido)
  return 'hecha'
}

/** «Perseguido»: tu próxima misión de Mar empieza revelando un Peligro de más (sin ventana para retirarte entre ambos). */
// TODO(regla): P6 · el Peligro de más se resuelve entero antes que el primero, sin ventana de retirada entre ambos; cuenta y da Avance.
export const peligroDeMas: Manejador<'peligroDeMas'> = (s) => {
  if (!s.mision || s.mision.fin || entornoActual(s) !== 'mar' || !tieneEstadoBarco(s, 'perseguido')) return 'hecha'
  quitarEstadoBarco(s, 'perseguido')
  anotar(s, 'aviso', 'Te persiguen: la misión empieza con un Peligro de más.')
  encolar(s, { tipo: 'encuentro', carta: null, paso: 'revelar', sinVentana: true })
  return 'hecha'
}
