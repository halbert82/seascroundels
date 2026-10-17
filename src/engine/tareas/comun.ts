// Contrato de las tareas: cada tipo de tarea tiene un manejador que avanza un paso.

import type { Decision, Eleccion, Estado, TareaDe, TipoTarea } from '../tipos.ts'

type SinTarea<T> = T extends unknown ? Omit<T, 'tarea' | 'libres'> : never
/** Decisión que pide una tarea (el motor añade a qué tarea pertenece y las capacidades libres). */
export type Pregunta = SinTarea<Decision>

/**
 * - `hecha`: la tarea ha terminado (lo que haya encolado se resuelve después).
 * - `sigue`: la tarea sigue en la pila; se vuelve a llamar cuando se resuelva lo que tenga encima.
 * - `{ pregunta }`: se para y espera la elección del jugador; se la vuelve a llamar con ella.
 */
export type Resultado = 'hecha' | 'sigue' | { pregunta: Pregunta }

export type Manejador<K extends TipoTarea> = (s: Estado, t: TareaDe<K>, e: Eleccion | null) => Resultado

export function preguntar(p: Pregunta): Resultado {
  return { pregunta: p }
}

/** Para las tareas que esperan un tipo concreto de elección. */
export function eleccionDe<T extends Eleccion['tipo']>(e: Eleccion, tipo: T): Extract<Eleccion, { tipo: T }> {
  if (e.tipo !== tipo) throw new Error(`Se esperaba una elección de tipo «${tipo}» y llegó «${e.tipo}»`)
  return e as Extract<Eleccion, { tipo: T }>
}
