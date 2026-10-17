// Motor: aplica la elección del jugador a la decisión pendiente y ejecuta la pila de tareas
// hasta la siguiente decisión o el final de la partida.

import { anotar, buscarTarea, copia, encolar, pilaTiene, quitarTarea } from './estado.ts'
import { MANEJADORES, TAREAS_DE_ESTRUCTURA } from './tareas/index.ts'
import type { Manejador, Resultado } from './tareas/comun.ts'
import type { Decision, Eleccion, Estado, Tarea } from './tipos.ts'
import { encolarUso, mismoUso, usosDisponibles } from './usos.ts'
import { iconosDe } from './catalogo.ts'
import { navParaDistancia, plazasOcupadas, valor } from './valores.ts'
import { impideSuperar } from './definiciones.ts'
// Reglas de las cartas de Peligro 2.0 (se registran al cargar).
import './peligros2/index.ts'
import { definicionActual, problemaCompromiso } from './prueba.ts'

/** Pasos máximos sin decisión del jugador: si se superan, hay un bucle en las reglas. */
const MAXIMO_PASOS = 20000

function llamar(s: Estado, t: Tarea, e: Eleccion | null): Resultado {
  const manejador = MANEJADORES[t.tipo] as Manejador<typeof t.tipo>
  return manejador(s, t as never, e)
}

/** Avanza una tarea y procesa su resultado. */
function procesar(s: Estado, t: Tarea, e: Eleccion | null): void {
  const r = llamar(s, t, e)
  if (r === 'hecha') quitarTarea(s, t.id)
  else if (r !== 'sigue') {
    const decision = { ...r.pregunta, tarea: t.id } as Decision
    // N2: en una pausa del turno (solo hay tareas de estructura) se ofrecen las capacidades sin etiqueta.
    const enPausa = s.pila.every((x) => TAREAS_DE_ESTRUCTURA.has(x.tipo))
    if (enPausa && decision.tipo !== 'ventanaAccion' && decision.tipo !== 'ofrecer') {
      const libres = usosDisponibles(s, ['libre'])
      if (libres.length > 0) decision.libres = libres
    }
    s.pendiente = decision
  }
}

/**
 * Los efectos «mientras esta carta siga en juego» se acaban en cuanto la carta sale. (Mientras se lee su encuentro,
 * antes de quedarse en juego, aún cuenta.)
 */
function limpiarTemporales(s: Estado): void {
  const fuera = (t: Estado['temporales'][number]) =>
    t.hasta === 'carta' && (!t.carta || !(s.zonas.peligrosEnJuego.includes(t.carta) || s.zonas.encuentro.includes(t.carta)))
  if (s.temporales.some(fuera)) s.temporales = s.temporales.filter((t) => !fuera(t))
}

/** Comprobaciones que se resuelven en el momento entre paso y paso (D8). Devuelve true si ha encolado algo. */
function comprobar(s: Estado): boolean {
  limpiarTemporales(s)
  if (s.reputacion >= s.reputacionObjetivo) {
    s.resultado = { gana: true, motivo: `Has llegado a ${s.reputacion} de reputación.` }
    anotar(s, 'fin', '¡Has ganado la partida!')
    return true
  }
  for (const c of s.zonas.tripulacion) {
    if (copia(s, c).heridas < valor(s, { tipo: 'vida', carta: c })) continue
    const yaVa = pilaTiene(
      s,
      (t) =>
        (t.tipo === 'evento' && t.ev.tipo === 'derrota' && t.ev.carta === c) ||
        (t.tipo === 'sacarTripulante' && t.carta === c),
    )
    if (yaVa) continue
    encolar(s, { tipo: 'evento', ev: { tipo: 'derrota', carta: c }, fase: 'antes', cancelado: false, usadas: [] })
    return true
  }
  // D5a: en cuanto reúnes el Avance, superas la misión; pero la primera carta de Peligro se resuelve siempre.
  // Una carta en juego que «impide superar la misión» lo retrasa hasta que se quite.
  if (s.mision && !s.mision.fin && s.mision.cartasResueltas >= 1 && !impideSuperar(s)) {
    const avance = copia(s, s.mision.carta).avance
    if (avance >= valor(s, { tipo: 'avanceNecesario', mision: s.mision.carta })) {
      s.mision.fin = 'superada'
      if (s.zonas.encuentro.length > 0) anotar(s, 'efecto', 'Reúnes el Avance a mitad del encuentro: lo dejas sin resolver.', { tipo: 'superadaAMitad' })
      return true
    }
  }
  if (s.danoBarco >= valor(s, { tipo: 'danoMaximo' }) && !pilaTiene(s, (t) => t.tipo === 'hundirse')) {
    encolar(s, { tipo: 'hundirse' })
    return true
  }
  const yaSalen = pilaTiene(s, (t) => t.tipo === 'exceso' || t.tipo === 'sacarTripulante')
  if (plazasOcupadas(s) > valor(s, { tipo: 'capacidad' }) && !yaSalen) {
    encolar(s, { tipo: 'exceso' })
    return true
  }
  if (s.turno > 0 && s.zonas.misionesDisponibles.length === 0 && s.zonas.mazoMisiones.length === 0) {
    s.resultado = { gana: false, motivo: 'No queda ninguna misión disponible ni en el mazo de Misiones.' }
    anotar(s, 'fin', 'No quedan misiones. Has perdido la partida.')
    return true
  }
  return false
}

/** Ejecuta la pila hasta que haga falta una decisión del jugador o termine la partida. */
export function ejecutar(s: Estado): void {
  for (let pasos = 0; pasos < MAXIMO_PASOS; pasos++) {
    if (s.resultado) {
      s.pila = []
      s.pendiente = null
      s.paso = 'terminada'
      return
    }
    if (s.pendiente) return
    if (comprobar(s)) continue
    const arriba = s.pila[s.pila.length - 1]
    if (!arriba) return
    procesar(s, arriba, null)
  }
  throw new Error(`El motor ha dado ${MAXIMO_PASOS} pasos sin pedir nada al jugador: hay un bucle en las reglas`)
}

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Comprueba que la elección responde a la decisión pendiente. Lanza un error si no. */
export function validarEleccion(s: Estado, d: Decision, e: Eleccion): void {
  const invalida = (por: string): never => {
    throw new Error(`Elección no válida para «${d.motivo.clave}»: ${por}`)
  }
  if (e.tipo === 'usar') {
    const ofrecido =
      (d.tipo === 'ofrecer' && d.usos.some((u) => mismoUso(u, e.uso))) ||
      (d.libres ?? []).some((u) => mismoUso(u, e.uso))
    if (!ofrecido) invalida('esa capacidad no se ofrece ahora')
    return
  }
  switch (d.tipo) {
    case 'ventanaAccion':
      if (e.tipo !== 'accion') invalida('se esperaba una acción')
      else if (!d.acciones.some((a) => igual(a, e.accion))) invalida('esa acción no está disponible')
      return
    case 'elegirCartas': {
      if (e.tipo !== 'cartas') return invalida('se esperaban cartas')
      if (new Set(e.ids).size !== e.ids.length) invalida('hay cartas repetidas')
      if (e.ids.some((i) => !d.candidatas.includes(i))) invalida('alguna carta no se puede elegir')
      if (e.ids.length < d.min || e.ids.length > d.max) invalida(`hay que elegir entre ${d.min} y ${d.max}`)
      return
    }
    case 'elegirOpcion':
      if (e.tipo !== 'opcion') invalida('se esperaba una opción')
      else if (!d.opciones.some((o) => o.clave === e.clave)) invalida(`la opción «${e.clave}» no existe`)
      return
    case 'ofrecer':
      if (e.tipo !== 'pasar') invalida('se esperaba usar una capacidad o pasar')
      return
    case 'repartir': {
      if (e.tipo !== 'reparto') return invalida('se esperaba un reparto')
      let suma = 0
      for (const [inst, cantidad] of Object.entries(e.n)) {
        const n = cantidad ?? 0
        const maximo = d.maximos[inst as keyof typeof d.maximos]
        if (maximo === undefined) invalida(`no se puede repartir a ${inst}`)
        if (!Number.isInteger(n) || n < 0 || n > (maximo ?? 0)) invalida(`cantidad no válida para ${inst}`)
        suma += n
      }
      if (suma !== d.cantidad) invalida(`hay que repartir exactamente ${d.cantidad}`)
      return
    }
    case 'cubrirDistancia': {
      if (e.tipo !== 'cartas') return invalida('se esperaban Tripulantes y cartas')
      if (new Set(e.ids).size !== e.ids.length) invalida('hay cartas repetidas')
      const tripulantes = e.ids.filter((i) => d.tripulantes.includes(i))
      const cartas = e.ids.filter((i) => d.cartas.includes(i))
      if (tripulantes.length + cartas.length !== e.ids.length) invalida('alguna carta no sirve para cubrir la Distancia')
      const nav = navParaDistancia(s, tripulantes) + cartas.reduce((n, c) => n + iconosDe(copia(s, c).id, 'NAV'), 0)
      if (nav < d.distancia) invalida(`con eso sumas ${nav} y la Distancia es ${d.distancia}`)
      return
    }
    case 'comprometer': {
      if (e.tipo !== 'compromiso') return invalida('se esperaba un compromiso')
      const opcion = d.opciones[e.opcion]
      if (!opcion) return invalida('esa opción no existe')
      if (new Set(e.tripulantes).size !== e.tripulantes.length || new Set(e.cartas).size !== e.cartas.length) invalida('hay repetidos')
      if (e.tripulantes.some((c) => !d.tripulantes.includes(c))) invalida('algún Tripulante no está preparado')
      if (e.cartas.some((c) => !d.cartas.includes(c) || iconosDe(copia(s, c).id, opcion.hab) === 0)) {
        invalida(`alguna carta no tiene iconos de ${opcion.hab}`)
      }
      if (e.tripulantes.length === 0 && e.cartas.length > 0) invalida('sin comprometer a nadie no puedes añadir cartas')
      const problema = problemaCompromiso(s, definicionActual(s), opcion.hab, e.tripulantes, e.cartas)
      if (problema) invalida(problema)
      return
    }
  }
}

/**
 * Responde a la decisión pendiente y avanza la partida hasta la siguiente decisión.
 * No modifica el estado recibido: devuelve uno nuevo.
 */
export function responder(anterior: Estado, eleccion: Eleccion): Estado {
  if (anterior.resultado) throw new Error('La partida ya ha terminado')
  const d = anterior.pendiente
  if (!d) throw new Error('No hay ninguna decisión pendiente')
  validarEleccion(anterior, d, eleccion)
  // El estado es JSON simple (lo comprueban las pruebas): copiarlo así es más rápido que structuredClone.
  const s = JSON.parse(JSON.stringify(anterior)) as Estado
  s.pendiente = null
  const t = buscarTarea(s, d.tarea)
  if (eleccion.tipo === 'usar' && d.tipo !== 'ofrecer') {
    // N2: una capacidad sin etiqueta usada en una pausa. Después se vuelve a preguntar lo mismo.
    encolarUso(s, eleccion.uso, null)
  } else {
    procesar(s, t, eleccion)
  }
  ejecutar(s)
  return s
}
