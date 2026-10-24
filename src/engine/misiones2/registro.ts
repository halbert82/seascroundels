// Registro de las reglas de cada capítulo de misión (misiones 2.0). Las reglas impresas en cartas.json son solo para
// leerlas: lo que hace cada capítulo está escrito a mano en los ficheros de esta carpeta y se registra aquí.
// Este módulo no importa nada del motor que calcule valores, para que lo puedan consultar todos.

import type { CapacidadDeCarta } from '../definiciones.ts'
import type { CartaId, Estado, FichaMision, InstId, NuevaTarea } from '../tipos.ts'

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
  /** Salida doble: número de colección de la carta que se añade (la otra se queda en el mazo de historia). */
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
  // Fase 15
  /**
   * Con `siguiente`, el capítulo elegido no deja fuera de la partida a los demás de la lista: se quedan en el mazo de
   * historia («La Isla del Tesoro»: uno de los tres capítulos II, al azar).
   */
  conservarOtros?: boolean
  /** Si devuelve tareas, se cobran en lugar de la recompensa impresa (sin Tesoro ni capítulo siguiente). */
  recompensaEnLugar?: (s: Estado) => NuevaTarea[] | null
  /** Si no la superas, no eliges si la dejas disponible: sale de la partida («apártala»). */
  apartarSiNoSuperas?: boolean
  /**
   * Mientras la misión está disponible (en puerto o en curso), comprueba lo que tenga en juego («Cuando esta misión pase
   * a estar disponible, pon en juego la carta 275»). Devuelve true si ha cambiado algo.
   */
  mientrasDisponible?: (s: Estado, mision: InstId) => boolean
}

const REGLAS = new Map<CartaId, ReglasMision>()

/**
 * Fase 15: comprobaciones que el motor hace entre paso y paso, fuera de una misión concreta («Cuando esta misión pase a
 * estar disponible, pon en juego la carta 275»). Devuelven true si han cambiado algo.
 */
const VIGILANTES: ((s: Estado) => boolean)[] = []

export function registrarVigilante(f: (s: Estado) => boolean): void {
  VIGILANTES.push(f)
}

/** Aplica las comprobaciones de las misiones; true si alguna ha cambiado algo. */
export function vigilarMisiones(s: Estado): boolean {
  return VIGILANTES.some((f) => f(s))
}

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

/**
 * Fase 15 (Albert, tercera ronda): lo que hace cada carta de recompensa del mazo de historia al cogerla («Coge la carta
 * 286 del mazo de historia»). Su texto es para leerlo; lo que hace está escrito a mano. Al terminar, vuelve al mazo de
 * historia.
 */
const CARTAS_DE_RECOMPENSA = new Map<CartaId, (s: Estado) => NuevaTarea[]>()

export function registrarCartaDeRecompensa(id: CartaId, efecto: (s: Estado) => NuevaTarea[]): void {
  if (CARTAS_DE_RECOMPENSA.has(id)) throw new Error(`Carta de recompensa repetida: ${id}`)
  CARTAS_DE_RECOMPENSA.set(id, efecto)
}

export function efectoDeRecompensa(id: CartaId): ((s: Estado) => NuevaTarea[]) | undefined {
  return CARTAS_DE_RECOMPENSA.get(id)
}

/** Cartas de recompensa con su efecto escrito (para comprobar que no falta ninguna). */
export function cartasDeRecompensaConEfecto(): CartaId[] {
  return [...CARTAS_DE_RECOMPENSA.keys()]
}
