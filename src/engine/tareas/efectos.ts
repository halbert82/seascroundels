// Efectos de los recuadros de Peligro y de las líneas Sin oposición, convertidos en tareas.

import { esIndestructible, esUnica, porId } from '../catalogo.ts'
import { entero } from '../azar.ts'
import type { Efecto } from '../efectos.ts'
import { interpretarEfectos } from '../efectos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { encuentroDe, entornoActual } from '../peligros.ts'
import { pruebaEnCurso } from '../prueba.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { mejoraActiva, plazasLibres, valor } from '../valores.ts'
import { barajar, mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/** Tripulantes comprometidos que siguen en juego (N7: si no queda ninguno, como sin comprometidos). */
function comprometidosEnJuego(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

function suceso(ev: { tipo: 'heridas'; objetivo: InstId; cantidad: number } | { tipo: 'danoBarco'; cantidad: number }): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

/** Tareas de una lista de efectos (las heridas de un fallo con comprometidos las agrupa aplicarFallo). */
function tareasDe(s: Estado, efectos: readonly Efecto[]): NuevaTarea[] {
  const enMar = entornoActual(s) === 'mar'
  const tareas: NuevaTarea[] = []
  for (const e of efectos) {
    switch (e.tipo) {
      case 'heridas':
        if (e.soloEnTierra && enMar) break
        tareas.push({ tipo: 'herirUno', n: e.n, entre: e.capitan ? [s.capitan] : [...s.zonas.tripulacion] })
        break
      case 'dano':
        // El Barco solo recibe daño en el Mar; en tierra se aplica la alternativa («/ 1 herida»), si la hay.
        if (enMar) tareas.push(suceso({ tipo: 'danoBarco', cantidad: e.n }))
        break
      case 'reparar':
        tareas.push({ tipo: 'reparar', n: e.n })
        break
      case 'agotar':
        tareas.push({ tipo: 'agotarTripulantes', n: e.n })
        break
      case 'descartar':
        tareas.push({ tipo: 'descartarMano', n: e.n })
        break
      case 'robar':
        tareas.push({ tipo: 'robar', n: e.n })
        break
      case 'curar':
        tareas.push({ tipo: 'curar', n: e.n, modo: 'repartir' })
        break
      case 'perderAvance':
        tareas.push({ tipo: 'perderAvance', n: e.n })
        break
      case 'perderMunicion':
        tareas.push({ tipo: 'perderMunicion', n: e.n })
        break
      case 'perderMejora':
        for (let i = 0; i < e.n; i++) tareas.push({ tipo: 'perderMejora' })
        break
      case 'agotarMejora':
        tareas.push({ tipo: 'agotarMejora' })
        break
      case 'rehen':
        tareas.push({ tipo: 'rehen', entre: comprometidosEnJuego(s) })
        break
      case 'reputacion':
        tareas.push({ tipo: 'cambiarReputacion', n: e.n })
        break
      case 'menosMando':
        tareas.push({ tipo: 'anadirTemporal', temporal: { clave: 'menosMando', fuente: 'regla', hasta: 'finTurno' } })
        break
      case 'perderDia':
        tareas.push({ tipo: 'perderDia' })
        break
      case 'entraEnMazo':
        tareas.push({ tipo: 'entrarEnMazo', carta: e.carta })
        break
      case 'seRetira':
        if (s.mision && s.prueba) s.mision.retirar.push(s.prueba.encuentro)
        else if (s.mision && s.zonas.encuentro[0]) s.mision.retirar.push(s.zonas.encuentro[0])
        break
      case 'recluta':
        tareas.push({ tipo: 'reclutaEncuentro' })
        break
      case 'sinFallo':
        if (s.prueba) s.prueba.sinFallo = true
        break
    }
  }
  return tareas
}

export const aplicarEfectos: Manejador<'aplicarEfectos'> = (s, t) => {
  encolar(s, ...tareasDe(s, t.efectos))
  return 'hecha'
}

/**
 * Recuadro rojo de la Prueba en curso. Con comprometidos en juego, todas las heridas del fallo se reparten
 * libremente entre ellos (N6); sin ellos, cada icono de herida va a un Tripulante (D2a). Las reglas de misión
 * «cada efecto de fallo inflige además 1 herida» suman una vez por recuadro con algo (D2b, D2c), y el Destino
 * «si fallas, sufre además 1 herida», siempre.
 */
export const aplicarFallo: Manejador<'aplicarFallo'> = (s) => {
  const p = pruebaEnCurso(s)
  if (p.sinFallo) {
    anotar(s, 'efecto', 'No se aplica el efecto de fallo.')
    return 'hecha'
  }
  // «Perdidos en la espesura»: sin recuadro rojo tampoco hay herida extra de la misión (D2c); la del Destino, sí (N15).
  const efectos = p.ignorarFallo ? [] : interpretarEfectos(encuentroDe(s, p.encuentro).textoFallo ?? '')
  if (p.ignorarFallo) anotar(s, 'efecto', 'Ignoras los efectos de fallo del encuentro.')
  const comprometidos = comprometidosEnJuego(s)
  const extraMision = efectos.length > 0 ? valor(s, { tipo: 'heridaExtraFallo' }) : 0
  const extras = [extraMision, p.heridaSiFallas].filter((n) => n > 0)
  const enMar = entornoActual(s) === 'mar'
  const tareas: NuevaTarea[] = []
  let monton = 0
  let posicion = -1
  for (const e of efectos) {
    const esHerida = e.tipo === 'heridas' && !e.capitan && !(e.soloEnTierra && enMar)
    if (esHerida && comprometidos.length > 0) {
      if (posicion < 0) posicion = tareas.length
      monton += e.n
    } else {
      tareas.push(...tareasDe(s, [e]))
    }
  }
  if (comprometidos.length > 0) {
    monton += extras.reduce((a, b) => a + b, 0)
    if (monton > 0) tareas.splice(posicion < 0 ? tareas.length : posicion, 0, { tipo: 'repartirHeridas', n: monton, entre: comprometidos })
  } else {
    for (const n of extras) tareas.push({ tipo: 'herirUno', n, entre: [...s.zonas.tripulacion] })
  }
  encolar(s, ...tareas)
  return 'hecha'
}

/** N heridas a un Tripulante elegido entre los indicados. */
export const herirUno: Manejador<'herirUno'> = (s, t, e) => {
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c))
  if (candidatos.length === 0 || t.n <= 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: t.n }, candidatas: candidatos, min: 1, max: 1 })
  }
  const objetivo = candidatos.length === 1 ? candidatos[0] : eleccionDe(e as NonNullable<typeof e>, 'cartas').ids[0]
  if (objetivo) encolar(s, suceso({ tipo: 'heridas', objetivo, cantidad: t.n }))
  return 'hecha'
}

/** N heridas repartidas libremente entre varios Tripulantes (N6). */
export const repartirHeridas: Manejador<'repartirHeridas'> = (s, t, e) => {
  const entre = t.entre.filter((c) => s.zonas.tripulacion.includes(c))
  if (entre.length === 0 || t.n <= 0) return 'hecha'
  if (entre.length === 1 && entre[0]) {
    encolar(s, suceso({ tipo: 'heridas', objetivo: entre[0], cantidad: t.n }))
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const c of entre) maximos[c] = t.n
    return preguntar({ tipo: 'repartir', motivo: { clave: 'heridas', n: t.n }, cantidad: t.n, maximos })
  }
  const reparto = eleccionDe(e, 'reparto').n
  encolar(
    s,
    ...(Object.entries(reparto) as [InstId, number][])
      .filter(([, n]) => n > 0)
      .map(([objetivo, cantidad]) => suceso({ tipo: 'heridas', objetivo, cantidad })),
  )
  return 'hecha'
}

/** Agota a N Tripulantes. Cada uno que falte es 1 herida a elección; «todos» sin nadie preparado no hace nada (N5). */
export const agotarTripulantes: Manejador<'agotarTripulantes'> = (s, t, e) => {
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  const agotar = (cartas: readonly InstId[]) => {
    for (const c of cartas) copia(s, c).agotada = true
    if (cartas.length > 0) anotar(s, 'efecto', `Agotas a ${nombres(s, cartas)}.`)
  }
  if (t.n === 'todos') {
    agotar(preparados)
    return 'hecha'
  }
  if (preparados.length <= t.n) {
    agotar(preparados)
    const faltan = t.n - preparados.length
    encolar(s, ...Array.from({ length: faltan }, (): NuevaTarea => ({ tipo: 'herirUno', n: 1, entre: [...s.zonas.tripulacion] })))
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotar', n: t.n }, candidatas: preparados, min: t.n, max: t.n })
  agotar(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

/** Agota una Mejora (ni Tesoros ni indestructibles). */
export const agotarMejora: Manejador<'agotarMejora'> = (s, _t, e) => {
  const candidatas = s.zonas.mejoras.filter((m) => mejoraActiva(s, m) && !esIndestructible(copia(s, m).id))
  const agotar = (m: InstId) => {
    copia(s, m).agotada = true
    anotar(s, 'efecto', `Se agota «${nombre(s, m)}».`)
  }
  if (candidatas.length === 0) return 'hecha'
  if (candidatas.length === 1 && candidatas[0]) {
    agotar(candidatas[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarMejora' }, candidatas, min: 1, max: 1 })
  const [m] = eleccionDe(e, 'cartas').ids
  if (m) agotar(m)
  return 'hecha'
}

/** Descarta N cartas de la mano (todas si no tienes tantas). */
export const descartarMano: Manejador<'descartarMano'> = (s, t, e) => {
  const descartar = (cartas: readonly InstId[]) => {
    for (const c of cartas) mover(s, c, 'descartesCapitan')
    if (cartas.length > 0) anotar(s, 'efecto', `Descartas ${nombres(s, cartas)}.`)
  }
  if (s.zonas.mano.length <= t.n) {
    descartar([...s.zonas.mano])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'descartar', n: t.n }, candidatas: [...s.zonas.mano], min: t.n, max: t.n })
  descartar(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

/** Pierdes N de Avance de la misión, nunca por debajo de 0. */
export const perderAvance: Manejador<'perderAvance'> = (s, t) => {
  if (!s.mision) return 'hecha'
  const m = copia(s, s.mision.carta)
  const antes = m.avance
  m.avance = t.n === 'todo' ? 0 : Math.max(0, m.avance - t.n)
  if (antes > m.avance) anotar(s, 'efecto', `Pierdes ${antes - m.avance} de Avance.`)
  return 'hecha'
}

/** Pierdes N de munición en total, repartida como quieras. */
export const perderMunicion: Manejador<'perderMunicion'> = (s, t, e) => {
  const cargadas = s.zonas.mejoras.filter((m) => copia(s, m).municion > 0)
  const total = cargadas.reduce((n, m) => n + copia(s, m).municion, 0)
  if (total === 0) return 'hecha'
  if (total <= t.n || cargadas.length === 1) {
    let resto = t.n
    for (const m of cargadas) {
      const quitar = Math.min(resto, copia(s, m).municion)
      copia(s, m).municion -= quitar
      resto -= quitar
    }
    anotar(s, 'efecto', `Pierdes ${Math.min(t.n, total)} de munición.`)
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const m of cargadas) maximos[m] = copia(s, m).municion
    return preguntar({ tipo: 'repartir', motivo: { clave: 'municion', n: t.n }, cantidad: t.n, maximos })
  }
  for (const [m, n] of Object.entries(eleccionDe(e, 'reparto').n) as [InstId, number][]) copia(s, m).municion -= n
  anotar(s, 'efecto', `Pierdes ${t.n} de munición.`)
  return 'hecha'
}

/**
 * Rehén: uno de los comprometidos (si los hay en juego) o uno al azar. El Capitán no puede ser rehén
 * (opción por defecto de CLAUDE.md); con solo el Capitán, no pasa nada (N11).
 */
export const rehen: Manejador<'rehen'> = (s, t, e) => {
  const capturar = (c: InstId) => {
    mover(s, c, 'rehenes', 'abajo')
    anotar(s, 'aviso', `${nombre(s, c)} es capturado como rehén.`)
  }
  const comprometidos = t.entre.filter((c) => c !== s.capitan && s.zonas.tripulacion.includes(c))
  if (comprometidos.length > 0) {
    if (comprometidos.length === 1 && comprometidos[0]) {
      capturar(comprometidos[0])
      return 'hecha'
    }
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'rehen' }, candidatas: comprometidos, min: 1, max: 1 })
    const [c] = eleccionDe(e, 'cartas').ids
    if (c) capturar(c)
    return 'hecha'
  }
  const posibles = s.zonas.tripulacion.filter((c) => c !== s.capitan)
  if (posibles.length === 0) {
    anotar(s, 'efecto', 'No hay nadie a quien capturar.')
    return 'hecha'
  }
  const elegido = posibles[entero(s, posibles.length)]
  s.infoRevelada++
  if (elegido) capturar(elegido)
  return 'hecha'
}

export const cambiarReputacion: Manejador<'cambiarReputacion'> = (s, t) => {
  const antes = s.reputacion
  s.reputacion = Math.max(0, s.reputacion + t.n)
  if (s.reputacion !== antes) {
    const cambio = s.reputacion - antes
    anotar(s, 'efecto', `${cambio > 0 ? 'Ganas' : 'Pierdes'} ${Math.abs(cambio)} de reputación (${s.reputacion}).`)
  }
  return 'hecha'
}

/** Una carta apartada entra en el mazo de Peligros normal (N10), aunque la misión use un mazo mezclado. */
export const entrarEnMazo: Manejador<'entrarEnMazo'> = (s, t) => {
  const carta = s.zonas.apartados.find((c) => copia(s, c).id === t.carta)
  if (!carta) return 'hecha'
  mover(s, carta, 'mazoPeligros')
  barajar(s, 'mazoPeligros')
  anotar(s, 'aviso', `«${nombre(s, carta)}» entra en el mazo de Peligros.`, { tipo: 'entraEnMazo', carta: t.carta })
  return 'hecha'
}

/** «Recluta»: puedes poner en juego un Tripulante del muelle pagando su coste. */
export const reclutaEncuentro: Manejador<'reclutaEncuentro'> = (s, _t, e) => {
  const candidatos = s.zonas.muelle.filter((c) => {
    const id = copia(s, c).id
    if (porId(id).tipo !== 'tripulante') return false
    if (plazasLibres(s) < 1) return false
    if (s.zonas.mano.length < valor(s, { tipo: 'coste', carta: c })) return false
    return !(esUnica(id) && [...s.zonas.tripulacion, ...s.zonas.rehenes].some((x) => copia(s, x).id === id))
  })
  if (candidatos.length === 0) return 'hecha'
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'reclutaEncuentro' }, candidatas: candidatos, min: 0, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) encolar(s, { tipo: 'reclutar', carta: c, paso: 'pagar' })
  return 'hecha'
}

/** Prepara a uno de los Tripulantes indicados (Destino «Ánimo»). */
export const prepararUno: Manejador<'prepararUno'> = (s, t, e) => {
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c) && copia(s, c).agotada)
  const preparar = (c: InstId) => {
    copia(s, c).agotada = false
    anotar(s, 'efecto', `${nombre(s, c)} vuelve a estar preparado.`)
  }
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length === 1 && candidatos[0]) {
    preparar(candidatos[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'preparar' }, candidatas: candidatos, min: 1, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) preparar(c)
  return 'hecha'
}
