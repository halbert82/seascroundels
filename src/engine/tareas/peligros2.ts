// Pasos genéricos que usan las cartas de Peligro 2.0: a quién le pasa algo («el comprometido con más EXP»,
// «cada Tripulante agotado»…), elegir entre opciones, preparar N, descartar al azar o la de mayor coste, pagar
// agotando, poner gratis una carta del muelle, recuperar cartas del descarte y los pasos propios de una carta.

import { costeImpreso, esUnica, porId, rasgosDe, tipoDe } from '../catalogo.ts'
import { entero } from '../azar.ts'
import type { Habilidad } from '../datos.ts'
import type { AccionSobre, Selector } from '../efectos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, curarTripulante, ponerEstado, quitarEstadoAnotado, tieneEstado } from '../estados.ts'
import { INFO_ESTADO } from '../infoEstados.ts'
import type { Estado, InstId, NuevaTarea, TareaDe } from '../tipos.ts'
import { costeAPagar, espacioLibre, huecosLibres, plazasLibres } from '../valores.ts'
import { mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador, type Resultado } from './comun.ts'
import { sePuedePagarEntero, cumple } from './efectos.ts'

// ---------------------------------------------------------------------------
// Preparar y comprometer con restricciones temporales

/** ¿Puede prepararse ahora? («No se prepara en tu próximo Inicio», «se pierde», «atrapado»…) */
export function puedePrepararse(s: Estado, c: InstId): boolean {
  return !s.temporales.some((t) => t.clave === 'noPrepara' && t.inst === c)
}

/** ¿Le impide algo comprometerse? (en esta Prueba, o mientras una carta siga en juego) */
export function vetadoAlComprometer(s: Estado, c: InstId): boolean {
  return s.temporales.some((t) => t.clave === 'noCompromete' && t.inst === c)
}

/** Prepara a un Tripulante si nada lo impide. Devuelve si lo ha preparado. */
export function preparar(s: Estado, c: InstId): boolean {
  if (!copia(s, c).agotada || !puedePrepararse(s, c)) return false
  copia(s, c).agotada = false
  return true
}

// ---------------------------------------------------------------------------
// A quién le pasa algo

function comprometidos(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

/** Habilidad impresa (la del número de la carta, sin Mejoras ni fichas). */
export function habilidadImpresa(s: Estado, c: InstId, hab: Habilidad): number {
  const e = porId(copia(s, c).id)
  return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta[hab] : 0
}

/** Vida impresa. */
// «El Tripulante con menos Vida» usa la Vida impresa (no la que le queda), como las habilidades (P20).
export function vidaImpresa(s: Estado, c: InstId): number {
  const e = porId(copia(s, c).id)
  return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta.vida : 0
}

/** Los que podrían ser elegidos, antes del criterio. */
export function baseDelSelector(s: Estado, q: Selector, hacer?: AccionSobre): InstId[] {
  const enJuego = s.zonas.tripulacion
  const comp = comprometidos(s)
  let base: InstId[]
  switch (q.de) {
    case 'comprometidos': {
      // Sin comprometidos en juego, las heridas y el descarte van a cualquiera (D2a, N7; fase 14: antes, el rehén).
      // (Solo cuando es «uno de los comprometidos»: «cada comprometido» sin comprometidos no le toca a nadie.)
      // Fase 13 (P72, regla general de Albert): «el Tripulante asignado con más (o menos) X» sin nadie asignado es el que
      // tiene más (o menos) X de toda la tripulación.
      const conCriterio = q.por !== undefined && q.por !== 'eleccion' && q.por !== 'azar'
      base = comp.length > 0 || q.cada || !(conCriterio || (hacer !== undefined && hiereODescarta(hacer))) ? comp : [...enJuego]
      break
    }
    case 'tripulacion':
      base = [...enJuego]
      break
    case 'preparados':
      base = enJuego.filter((c) => !copia(s, c).agotada)
      break
    case 'agotados':
      base = enJuego.filter((c) => copia(s, c).agotada)
      break
    case 'noComprometidos':
      base = enJuego.filter((c) => !comp.includes(c))
      break
    case 'noComprometidosPreparados':
      base = enJuego.filter((c) => !comp.includes(c) && !copia(s, c).agotada)
      break
    case 'heridos':
      base = enJuego.filter((c) => copia(s, c).heridas > 0)
      break
    case 'capitan':
      base = enJuego.includes(s.capitan) ? [s.capitan] : []
      break
  }
  if (q.inst) base = base.filter((c) => c === q.inst)
  // Fase 14: el Capitán sí puede salir elegido para «se descarta» (sufre 1 herida en su lugar); no para volver al muelle.
  const sinCapitan = q.sinCapitan || hacer?.tipo === 'alMuelle'
  return base.filter(
    (c) =>
      !(sinCapitan && c === s.capitan) &&
      (!q.rasgo || rasgosDe(copia(s, c).id).includes(q.rasgo)) &&
      (!q.sinRasgo || !rasgosDe(copia(s, c).id).includes(q.sinRasgo)) &&
      (!q.conEstado || tieneEstado(s, c, q.conEstado)) &&
      (!q.herido || copia(s, c).heridas > 0),
  )
}

/** ¿Hiere o descarta? («Un Tripulante asignado sufre 1 herida…»: sin nadie asignado, a quien elijas, como las heridas.) */
function hiereODescarta(a: AccionSobre): boolean {
  if (a.tipo === 'heridas' || a.tipo === 'descartar') return true
  if (a.tipo === 'varios') return a.acciones.some(hiereODescarta)
  if (a.tipo === 'elegir') return a.opciones.some((o) => hiereODescarta(o.accion))
  return false
}

/** Aplica el criterio («con más EXP», «con menos Vida»…): devuelve los empatados en cabeza. */
export function porCriterio(s: Estado, base: readonly InstId[], por: Selector['por']): InstId[] {
  if (!por || por === 'eleccion' || por === 'azar' || base.length <= 1) return [...base]
  let medida: (c: InstId) => number
  if (por === 'menosVida') medida = (c) => -vidaImpresa(s, c)
  else if (por === 'masHeridas') medida = (c) => copia(s, c).heridas
  else if (por === 'menorCoste') medida = (c) => -costeImpreso(copia(s, c).id)
  else {
    const cual = 'mas' in por ? por.mas : por.menos
    const hab = cual === 'prueba' ? s.prueba?.hab : cual
    if (!hab) return [...base]
    const signo = 'mas' in por ? 1 : -1
    medida = (c) => signo * habilidadImpresa(s, c, hab)
  }
  const mejor = Math.max(...base.map(medida))
  return base.filter((c) => medida(c) === mejor)
}

function textoAccion(a: AccionSobre): string {
  switch (a.tipo) {
    case 'heridas':
      return `sufre ${a.n} ${a.n === 1 ? 'herida' : 'heridas'}`
    case 'estado':
      return `queda ${INFO_ESTADO[a.estado].nombre}`
    case 'quitarEstado':
      return `pierde ${INFO_ESTADO[a.estado].nombre}`
    case 'descartar':
      return 'se descarta'
    case 'preparar':
      return 'se prepara'
    case 'agotar':
      return 'se agota'
    case 'curar':
      return `se cura ${a.n}`
    case 'alMuelle':
      return 'vuelve al muelle'
    case 'noPrepara':
      return 'no se prepara'
    case 'noCompromete':
      return 'no puede ser asignado'
    case 'noSuma':
      return 'no suma'
    case 'varios': {
      // La marca solo sirve para recordar a quién le pasó: no se cuenta si hay algo más.
      const visibles = a.acciones.filter((x) => x.tipo !== 'marcar')
      return (visibles.length > 0 ? visibles : a.acciones).map(textoAccion).join(' y ')
    }
    case 'marcar':
      return 'queda señalado'
    case 'elegir':
      return a.opciones.map((o) => o.texto).join(' o ')
  }
}

/** ¿Es una carta de Peligro (de las de tres encuentros, de un mazo propio o «La Armada te persigue»)? */
// TODO(regla): P90. Las permanentes (cartas del mazo de historia, como «Campanas a rebato») no son cartas de Peligro: por
// defecto, el Fiador y «¡A por ellos!» no responden a lo que descartan.
export function esCartaDePeligro(s: Estado, carta: InstId | undefined): boolean {
  if (!carta) return false
  const tipo = porId(copia(s, carta).id).tipo
  return tipo === 'peligro' || tipo === 'mazoPropio'
}

/**
 * Fase 14 (fuera el rehén; regla general de Albert): un efecto descarta a un Tripulante. Se va a la pila de descartes del
 * muelle con sus Mejoras, como al despedirlo (sus Tesoros pasan a otro). Si es el Capitán, no se descarta: sufre 1 herida
 * en su lugar. Antes pasa por su suceso, para las Interrupciones (el Fiador, «¡A por ellos!»), que solo responden si lo
 * descarta una carta de Peligro (`fuente`).
 */
export function descartarTripulante(s: Estado, c: InstId, fuente: InstId | undefined, motivo?: string): void {
  if (!s.zonas.tripulacion.includes(c)) return
  if (c === s.capitan) {
    anotar(s, 'efecto', `${motivo ? `${motivo}: ` : ''}el Capitán no se descarta: ${nombre(s, c)} sufre 1 herida en su lugar.`)
    encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] })
    return
  }
  encolar(s, { tipo: 'evento', ev: { tipo: 'descartarTripulante', carta: c, dePeligro: esCartaDePeligro(s, fuente) }, fase: 'antes', cancelado: false, usadas: [] })
}

/** Le pasa la acción a este Tripulante. */
export function aplicarAccion(s: Estado, c: InstId, a: AccionSobre, fuente?: InstId): void {
  if (!s.zonas.tripulacion.includes(c)) return
  const id = fuente ? copia(s, fuente).id : 'regla'
  switch (a.tipo) {
    case 'heridas':
      encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: a.n }, fase: 'antes', cancelado: false, usadas: [] })
      return
    case 'estado':
      if (ponerEstado(s, c, a.estado)) anotar(s, 'aviso', `${nombre(s, c)} queda ${INFO_ESTADO[a.estado].nombre}.`)
      else anotar(s, 'efecto', `${nombre(s, c)} ya estaba ${INFO_ESTADO[a.estado].nombre}.`)
      return
    case 'quitarEstado':
      quitarEstadoAnotado(s, c, a.estado)
      return
    case 'descartar':
      descartarTripulante(s, c, fuente)
      return
    case 'preparar':
      if (preparar(s, c)) anotar(s, 'efecto', `${nombre(s, c)} se prepara.`)
      return
    case 'agotar':
      if (!copia(s, c).agotada) {
        anotar(s, 'efecto', `${nombre(s, c)} se agota.`)
        agotar(s, c)
      }
      return
    case 'curar': {
      const texto = curarTripulante(s, c, a.n)
      if (texto) anotar(s, 'efecto', `Curas a ${texto}.`)
      return
    }
    case 'alMuelle':
      if (c !== s.capitan) encolar(s, { tipo: 'sacarTripulante', carta: c, destino: 'muelle', motivo: 'muelle' })
      return
    case 'noPrepara':
      s.temporales.push({ clave: 'noPrepara', fuente: id, hasta: a.hasta, inst: c, ...(fuente ? { carta: fuente } : {}) })
      anotar(s, 'efecto', `${nombre(s, c)} ${a.hasta === 'inicio' ? 'no se prepara en tu próxima Fase de Inicio' : 'no se prepara por ahora'}.`)
      return
    case 'noCompromete':
      s.temporales.push({ clave: 'noCompromete', fuente: id, hasta: a.hasta, inst: c, ...(fuente ? { carta: fuente } : {}) })
      anotar(s, 'efecto', `${nombre(s, c)} no puede ser asignado.`)
      return
    case 'noSuma':
      if (s.prueba && !s.prueba.sinSumar?.includes(c)) {
        s.prueba.sinSumar = [...(s.prueba.sinSumar ?? []), c]
        anotar(s, 'efecto', `${nombre(s, c)} no suma en esta Prueba.`)
      }
      return
    case 'varios':
      // En orden, una tras otra (las heridas se resuelven antes que lo que venga después): cada acción, su tarea.
      encolar(
        s,
        ...a.acciones.map((x): NuevaTarea => ({ tipo: 'aplicarEfectos', efectos: [{ tipo: 'sobre', carta: c, hacer: x }], contexto: 'efecto', ...(fuente ? { fuente } : {}) })),
      )
      return
    case 'marcar':
      // Queda señalado por esta carta hasta el final de la misión (lo que diga después: «ese Tripulante…»).
      s.temporales.push({ clave: a.clave, fuente: id, hasta: 'finMision', inst: c, ...(fuente ? { carta: fuente } : {}) })
      return
    case 'elegir':
      encolar(s, {
        tipo: 'elegirEfectos',
        opciones: a.opciones.map((o) => ({ texto: `${nombre(s, c)}: ${o.texto}`, efectos: [{ tipo: 'sobre', carta: c, hacer: o.accion }] })),
        ...(fuente ? { fuente } : {}),
      })
      return
  }
}

/** El Tripulante señalado por esta carta («ese Tripulante…»), si sigue en juego. */
export function marcado(s: Estado, clave: string, carta?: InstId): InstId | undefined {
  return s.temporales.find((t) => t.clave === clave && t.inst && (carta === undefined || t.carta === carta) && s.zonas.tripulacion.includes(t.inst))?.inst
}

export const aQuien: Manejador<'aQuien'> = (s, t, e) => {
  const base = baseDelSelector(s, t.quien, t.hacer)
  if (base.length === 0) return 'hecha'
  const elegibles = porCriterio(s, base, t.quien.por)
  const aplicarA = (lista: readonly InstId[]) => {
    for (const c of lista) aplicarAccion(s, c, t.hacer, t.fuente)
  }
  if (t.quien.cada) {
    const max = t.quien.maximo ?? Infinity
    if (elegibles.length <= max) {
      aplicarA(elegibles)
      return 'hecha'
    }
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: textoAccion(t.hacer), n: max }, candidatas: elegibles, min: max, max })
    aplicarA(eleccionDe(e, 'cartas').ids)
    return 'hecha'
  }
  if (t.quien.por === 'azar') {
    const elegido = elegibles[entero(s, elegibles.length)]
    s.infoRevelada++
    if (elegido) aplicarA([elegido])
    return 'hecha'
  }
  if (elegibles.length === 1) {
    aplicarA(elegibles)
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: textoAccion(t.hacer), n: 1 }, candidatas: elegibles, min: 1, max: 1 })
  aplicarA(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Elegir entre opciones

export const elegirEfectos: Manejador<'elegirEfectos'> = (s, t, e) => {
  const posibles = t.opciones.map((o, i) => ({ o, i })).filter(({ o }) => (!o.si || cumple(s, o.si)) && sePuedePagarEntero(s, o.efectos))
  if (posibles.length === 0) return 'hecha'
  let elegida: (typeof posibles)[number] | undefined = posibles[0]
  if (posibles.length > 1) {
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'elegirEfectos', ...(t.fuente ? { carta: copia(s, t.fuente).id } : {}) },
        opciones: posibles.map(({ o, i }) => ({ clave: String(i), texto: o.texto })),
      })
    }
    const clave = eleccionDe(e, 'opcion').clave
    elegida = posibles.find(({ i }) => String(i) === clave)
  }
  if (!elegida) return 'hecha'
  if (posibles.length > 1) anotar(s, 'jugada', `Eliges: ${elegida.o.texto}.`)
  const tarea: NuevaTarea = { tipo: 'aplicarEfectos', efectos: elegida.o.efectos, contexto: 'efecto' }
  if (t.fuente) tarea.fuente = t.fuente
  encolar(s, tarea)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Cartas de la mano y del muelle

export const prepararN: Manejador<'prepararN'> = (s, t, e) => {
  const agotados = s.zonas.tripulacion.filter((c) => copia(s, c).agotada && puedePrepararse(s, c))
  const prepararlos = (lista: readonly InstId[]) => {
    for (const c of lista) preparar(s, c)
    if (lista.length > 0) anotar(s, 'efecto', `Preparas a ${nombres(s, lista)}.`)
  }
  if (agotados.length <= t.n) {
    prepararlos(agotados)
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'prepararN', n: t.n }, candidatas: agotados, min: t.n, max: t.n })
  prepararlos(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

export const descartarAzar: Manejador<'descartarAzar'> = (s, t) => {
  const descartadas: InstId[] = []
  for (let i = 0; i < t.n && s.zonas.mano.length > 0; i++) {
    const c = s.zonas.mano[entero(s, s.zonas.mano.length)]
    if (!c) break
    mover(s, c, 'descartesCapitan')
    descartadas.push(c)
  }
  if (descartadas.length > 0) {
    s.infoRevelada++
    anotar(s, 'efecto', `Descartas al azar: ${nombres(s, descartadas)}.`)
  }
  return 'hecha'
}

export const descartarMayorCoste: Manejador<'descartarMayorCoste'> = (s, _t, e) => {
  if (s.zonas.mano.length === 0) return 'hecha'
  const maximo = Math.max(...s.zonas.mano.map((c) => costeImpreso(copia(s, c).id)))
  const empatadas = s.zonas.mano.filter((c) => costeImpreso(copia(s, c).id) === maximo)
  let elegida = empatadas[0]
  if (empatadas.length > 1) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'descartarMayorCoste' }, candidatas: empatadas, min: 1, max: 1 })
    elegida = eleccionDe(e, 'cartas').ids[0]
  }
  if (!elegida) return 'hecha'
  mover(s, elegida, 'descartesCapitan')
  anotar(s, 'efecto', `Descartas «${nombre(s, elegida)}», la de mayor coste.`)
  return 'hecha'
}

/** Paga agotando N Tripulantes preparados, o 1 con el Rasgo indicado. */
export const agotarPago: Manejador<'agotarPago'> = (s, t, e) => {
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  const conRasgo = t.oRasgo ? preparados.filter((c) => rasgosDe(copia(s, c).id).includes(t.oRasgo ?? '')) : []
  const agotarlos = (lista: readonly InstId[]) => {
    if (lista.length > 0) anotar(s, 'pagar', `Agotas a ${nombres(s, lista)}.`)
    for (const c of lista) agotar(s, c)
  }
  // Decisión en dos pasos si se puede de las dos maneras: primero cómo, luego quién.
  const modo = e?.tipo === 'opcion' ? e.clave : null
  const puedeVarios = preparados.length >= t.n
  if (!modo && conRasgo.length > 0 && puedeVarios && t.n > 1) {
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'agotarPago' },
        opciones: [
          { clave: 'rasgo', texto: `Agotar a 1 ${t.oRasgo ?? ''}` },
          { clave: 'varios', texto: `Agotar a ${t.n} Tripulantes` },
        ],
      })
    }
  }
  if (modo) {
    if (modo === 'varios') delete t.oRasgo
    else t.n = 1
    return 'sigue'
  }
  const usarRasgo = conRasgo.length > 0 && (!puedeVarios || t.n <= 1)
  const candidatos = usarRasgo ? conRasgo : preparados
  const n = usarRasgo ? 1 : Math.min(t.n, preparados.length)
  if (candidatos.length <= n) {
    agotarlos(candidatos)
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarPago', n }, candidatas: candidatos, min: n, max: n })
  agotarlos(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

/** Portadores posibles de una Mejora del muelle. */
function portadores(s: Estado, carta: InstId): (InstId | 'barco')[] {
  const e = porId(copia(s, carta).id)
  if (e.tipo === 'mejoraBarco') return espacioLibre(s) >= e.carta.espacio ? ['barco'] : []
  if (e.tipo === 'mejoraTripulante') {
    return s.zonas.tripulacion.filter((c) => huecosLibres(s, c) >= 1 && (!e.carta.soloCapitan || c === s.capitan))
  }
  return []
}

function unicaEnJuego(s: Estado, carta: InstId): boolean {
  const id = copia(s, carta).id
  return esUnica(id) && [...s.zonas.tripulacion, ...s.zonas.mejoras].some((c) => copia(s, c).id === id)
}

/**
 * Recluta o adquiere gratis una carta del muelle de coste N o menos. Fase 14: «de coste N o menos» mira el coste impreso
 * (los descuentos solo rebajan lo que se paga). `mitad`: no es gratis, se paga la mitad del coste, redondeando hacia
 * arriba (y solo se ofrecen las que puedes pagar).
 */
export const gratisDelMuelle: Manejador<'gratisDelMuelle'> = (s, t, e) => {
  if (t.carta) {
    // Segundo paso: a quién va la Mejora.
    const lista = portadores(s, t.carta)
    if (lista.length === 0) return 'hecha'
    const destino = lista.length === 1 ? lista[0] : e ? (eleccionDe(e, 'cartas').ids[0] as InstId | undefined) : undefined
    if (!destino) {
      return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'portadorGratis', carta: copia(s, t.carta).id }, candidatas: lista.filter((x): x is InstId => x !== 'barco'), min: 1, max: 1 })
    }
    encolar(s, t.mitad ? { tipo: 'adquirir', carta: t.carta, destino, paso: 'pagar', mitad: true } : { tipo: 'adquirir', carta: t.carta, destino, paso: 'vincular' })
    return 'hecha'
  }
  const candidatas = s.zonas.muelle.filter((c) => {
    if (s.peligrosEnMuelle?.[c] !== undefined || unicaEnJuego(s, c)) return false
    if (costeImpreso(copia(s, c).id) > t.maxCoste) return false
    if (t.mitad && s.zonas.mano.length < costeAPagar(s, c, 'mitad')) return false
    const tipo = tipoDe(copia(s, c).id)
    if (t.rasgo && !rasgosDe(copia(s, c).id).includes(t.rasgo)) return false
    if (tipo === 'tripulante') return t.que !== 'mejora' && plazasLibres(s) >= 1
    if (tipo === 'mejoraBarco' || tipo === 'mejoraTripulante') return t.que !== 'tripulante' && portadores(s, c).length > 0
    return false
  })
  if (candidatas.length === 0) {
    if (t.siNo && t.siNo.length > 0) encolar(s, { tipo: 'aplicarEfectos', efectos: t.siNo, contexto: 'efecto' })
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: t.mitad ? 'mitadDelMuelle' : 'gratisDelMuelle', n: t.maxCoste }, candidatas, min: 0, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (!c) return 'hecha'
  if (tipoDe(copia(s, c).id) === 'tripulante') {
    encolar(s, t.mitad ? { tipo: 'reclutar', carta: c, paso: 'pagar', mitad: true } : { tipo: 'reclutar', carta: c, paso: 'pagar', gratis: true })
    return 'hecha'
  }
  t.carta = c
  return 'sigue'
}

export const recuperarDescarte: Manejador<'recuperarDescarte'> = (s, t, e) => {
  const descartes = [...s.zonas.descartesCapitan]
  if (descartes.length === 0) return 'hecha'
  const n = Math.min(t.n, descartes.length)
  let elegidas = descartes
  if (descartes.length > n) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'recuperarDescarte', n }, candidatas: descartes, min: n, max: n })
    elegidas = eleccionDe(e, 'cartas').ids
  }
  for (const c of elegidas) mover(s, c, 'mano', 'abajo')
  anotar(s, 'efecto', `Recuperas a la mano: ${nombres(s, elegidas)}.`)
  return 'hecha'
}

/** Quita uno de estos Estados a un Tripulante (Herbolaria, Cataplasma); luego, si lo dice, cúrale N. */
export const quitarUnEstado: Manejador<'quitarUnEstado'> = (s, t, e) => {
  if (!t.carta) {
    const candidatos = s.zonas.tripulacion.filter((c) => t.estados.some((x) => tieneEstado(s, c, x)))
    if (candidatos.length === 0) return 'hecha'
    if (candidatos.length > 1 && !e) {
      return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'quitarUnEstado', texto: t.estados.map((x) => INFO_ESTADO[x].nombre).join(', ') }, candidatas: candidatos, min: 1, max: 1 })
    }
    t.carta = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
    if (!t.carta) return 'hecha'
    return 'sigue'
  }
  const c = t.carta
  const suyos = t.estados.filter((x) => tieneEstado(s, c, x))
  let quitar: (typeof suyos)[number] | undefined = suyos[0]
  if (suyos.length > 1) {
    if (!e) {
      return preguntar({ tipo: 'elegirOpcion', motivo: { clave: 'cualEstado', carta: copia(s, c).id }, opciones: suyos.map((x) => ({ clave: x, texto: INFO_ESTADO[x].nombre })) })
    }
    const clave = eleccionDe(e, 'opcion').clave
    quitar = suyos.find((x) => x === clave)
  }
  if (quitar) quitarEstadoAnotado(s, c, quitar)
  if (t.curar) {
    const texto = curarTripulante(s, c, t.curar)
    if (texto) anotar(s, 'efecto', `Curas a ${texto}.`)
  }
  return 'hecha'
}

/** Descarta una de estas cartas de Peligro en juego («Cortar por lo sano»). */
/** «Cortar por lo sano»: devuelve al mazo de historia una carta de la zona de permanentes (eliges cuál). */
export const quitarPermanente: Manejador<'quitarPermanente'> = (s, t, e) => {
  const candidatas = t.candidatas.filter((c) => s.zonas.permanentes.includes(c))
  if (candidatas.length === 0) return 'hecha'
  if (candidatas.length > 1 && !e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'quitarPermanente' }, candidatas, min: 1, max: 1 })
  const c = candidatas.length === 1 ? candidatas[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (c) encolar(s, { tipo: 'devolverPermanente', carta: c })
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Pasos propios de una carta

export type ManejadorEspecial = (s: Estado, t: TareaDe<'especial'>, e: Parameters<Manejador<'especial'>>[2]) => Resultado
const ESPECIALES = new Map<string, ManejadorEspecial>()

export function registrarEspecial(clave: string, m: ManejadorEspecial): void {
  ESPECIALES.set(clave, m)
}

export const especial: Manejador<'especial'> = (s, t, e) => {
  const m = ESPECIALES.get(t.clave)
  if (!m) throw new Error(`Paso de carta desconocido: ${t.clave}`)
  return m(s, t, e)
}
