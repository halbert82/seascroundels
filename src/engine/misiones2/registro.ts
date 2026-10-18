// Registro de las reglas de cada capítulo de misión (misiones 2.0). Las reglas impresas en cartas.json son solo para
// leerlas: lo que hace cada capítulo está escrito a mano en los ficheros de esta carpeta y se registra aquí.
// Este módulo no importa nada del motor que calcule valores, para que lo puedan consultar todos.

import type { CapacidadDeCarta } from '../definiciones.ts'
import type { CartaId, Estado, FichaMision, NuevaTarea } from '../tipos.ts'

/** Una clase de ficha sobre la misión, tal y como se enseña en la mesa («Alarma 2/3»). */
export interface FichaDeMision {
  ficha: FichaMision
  nombre: string
  /** El número al que se llega («Con 3, …»). */
  umbral: number
  /** Lo que pasa, en pocas palabras, para la mesa. */
  nota: string
  /** Fichas con las que empieza la misión. */
  inicial: number
}

export interface ReglasMision {
  /** Modificadores constantes y Obligadas mientras la misión está en curso. */
  capacidades?: CapacidadDeCarta[]
  /** «Al zarpar»: lo que hace la misión al empezar (antes que las capacidades Al zarpar de tus cartas). */
  alZarpar?: (s: Estado) => NuevaTarea[]
  /** Fichas sobre la carta de misión. */
  fichas?: FichaDeMision[]
  /** Lo que pasa cuando cambian sus fichas (al llegar a su número…). */
  alCambiarFichas?: (s: Estado, ficha: FichaMision, antes: number, ahora: number) => NuevaTarea[]
  /** Por qué no se puede superar todavía (o null si se puede). */
  impideSuperar?: (s: Estado) => string | null
  /** No puedes retirarte de esta misión. */
  sinRetirada?: boolean
  /** Distancia según la situación (si no, la impresa). */
  distancia?: (s: Estado, impresa: number) => number
  /** Reputación necesaria para zarpar. */
  reputacionMinima?: number
  /** «Gesta»: si se cumple al superarla, +1 de reputación. */
  gesta?: (s: Estado) => boolean
  /** Salida doble: número de colección de la carta que se añade (la otra sale de la partida). */
  siguiente?: (s: Estado) => number
  /** ¿Se gana el Tesoro de la recompensa? (por defecto, sí) */
  conTesoro?: (s: Estado) => boolean
  /** Lo que pasa además al superarla (después de la recompensa impresa). */
  alSuperar?: (s: Estado) => NuevaTarea[]
  /** Final con elección: lo que pasa además con la opción elegida («tu Capitán queda Maldito»). */
  alElegir?: (s: Estado, clave: string) => NuevaTarea[]
  /** Lo que pasa al no superarla (retirada, fallo o hundimiento). */
  alNoSuperar?: (s: Estado) => NuevaTarea[]
  /** Te retiras por tu cuenta entre dos Peligros: cobras según tu Avance. */
  alRetirarte?: (s: Estado, avance: number) => NuevaTarea[]
  /** La primera Prueba de la misión es Sin ayuda. */
  primeraSinAyuda?: boolean
}

const REGLAS = new Map<CartaId, ReglasMision>()

/** Guarda las reglas de un capítulo (las capacidades las registra quien llama, con su clave). */
export function guardarReglasMision(id: CartaId, reglas: ReglasMision): void {
  if (REGLAS.has(id)) throw new Error(`Reglas de misión repetidas: ${id}`)
  REGLAS.set(id, reglas)
}

export function reglasMision(id: CartaId): ReglasMision | undefined {
  return REGLAS.get(id)
}

/** Capítulos con reglas registradas (para comprobar que no falta ninguno). */
export function misionesConReglas(): CartaId[] {
  return [...REGLAS.keys()]
}
