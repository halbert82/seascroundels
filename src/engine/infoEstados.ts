// Nombres y textos de los Estados y las Ventajas que llevan los Tripulantes y el Barco. Sin dependencias: lo usan el
// catálogo y la interfaz.
//
// Fase 8: un efecto que solo ayuda es una Ventaja (Inspirado, Aguerrido); uno que perjudica o limita es un Estado
// (Borracho también, aunque dé +1 COM). Las dos funcionan igual: sobre el Tripulante, sin repetir la misma.
// La Taberna quita todos los Estados de tus Tripulantes, pero no las Ventajas. Fase 10b: lo que hace cada una.
// Fase 16 (Albert): ya no son fichas, sino cartas mini (sección `estados` de cartas.json) de una reserva aparte. En la
// partida, cada carta puesta es el nombre de su Estado en la lista del Tripulante (`estados`) o en la del Barco
// (`estadosBarco`); quitarla es devolverla a la reserva. Como mucho hay 6 Tripulantes (Capacidad 4, +1 con las Hamacas, y
// el Capitán) y ninguno repite Estado, así que las 6 copias de cada Estado de Tripulante bastan siempre.

/** Estados de un Tripulante: perjudican o limitan. Fase 10b: fuera Aturdido y Encadenado. Fase 16: Extenuado. */
export const ESTADOS_TRIPULANTE = ['envenenado', 'borracho', 'asustado', 'sangrando', 'buscado', 'maldito', 'extenuado'] as const
export type EstadoTripulante = (typeof ESTADOS_TRIPULANTE)[number]

/** Ventajas de un Tripulante: solo ayudan. */
export const VENTAJAS = ['inspirado', 'aguerrido'] as const
export type Ventaja = (typeof VENTAJAS)[number]

/** Todo lo que un Tripulante puede llevar encima: Estados y Ventajas. */
export const FICHAS_TRIPULANTE = [...ESTADOS_TRIPULANTE, ...VENTAJAS] as const
export type FichaTripulante = EstadoTripulante | Ventaja

export function esVentaja(f: string): f is Ventaja {
  return (VENTAJAS as readonly string[]).includes(f)
}

/** Estados del Barco (los quita el Astillero). Fase 10b: fuera Incendio a bordo. Fase 15, quinta ronda: fuera Pólvora mojada. */
export const ESTADOS_BARCO = ['viaDeAgua', 'velasRotas', 'perseguido'] as const
/**
 * Lo que se pone junto al Barco: sus Estados y, fase 16, Desmoralizado, de la tripulación («Tu tripulación queda
 * Desmoralizada»). Desmoralizado no es un Estado del Barco ni de un Tripulante: no lo quitan el Astillero ni la Taberna (se
 * descarta solo al robar, al final del mismo turno).
 */
export const ESTADOS_JUNTO_AL_BARCO = [...ESTADOS_BARCO, 'desanimo'] as const
export type EstadoBarco = (typeof ESTADOS_JUNTO_AL_BARCO)[number]

/** ¿Es un Estado del Barco (de los que quita el Astillero)? */
export function esEstadoDelBarco(e: string): boolean {
  return (ESTADOS_BARCO as readonly string[]).includes(e)
}

export interface InfoEstado {
  nombre: string
  /** Lo que hace, en una frase (para la mesa). */
  texto: string
  /** Es una Ventaja (solo ayuda): en la mesa va en verde; los Estados, en rojo. */
  ventaja?: boolean
}

// Fase 10b: curar solo quita heridas y reparar solo quita daño. Los Estados se quitan como dice cada uno, con la
// Taberna (los de los Tripulantes), con el Astillero (los del Barco) o con una carta que lo diga.
export const INFO_ESTADO: Record<FichaTripulante | EstadoBarco, InfoEstado> = {
  envenenado: { nombre: 'Envenenado', texto: 'Al final de cada turno, 1 herida.' },
  borracho: { nombre: 'Borracho', texto: '+1 COM. No puede ser asignado a NAV ni EXP. Se quita al final del turno.' },
  asustado: { nombre: 'Asustado', texto: 'No puede ser asignado él solo a una Prueba. Se quita al final del turno.' },
  sangrando: { nombre: 'Sangrando', texto: 'Cada vez que se agota, 1 herida.' },
  buscado: {
    nombre: 'Buscado',
    texto: 'No puede ser asignado en misiones de Ciudad. Se quita descartando 1 carta en la Fase de Reclutamiento.',
  },
  maldito: { nombre: 'Maldito', texto: '−1 al total de cada Prueba a la que esté asignado. Se quita al superar una de ellas.' },
  extenuado: { nombre: 'Extenuado', texto: 'En la Fase de Inicio no se prepara: en vez de eso, se descarta esta carta.' },
  inspirado: { nombre: 'Inspirado', texto: '+1 al total de cada Prueba a la que esté asignado. Se quita al final del turno.', ventaja: true },
  aguerrido: { nombre: 'Aguerrido', texto: 'Puede ser asignado a una Prueba sin agotarse. Se quita al hacerlo.', ventaja: true },
  viaDeAgua: {
    nombre: 'Anegado',
    texto: 'En el Mar, al final de cada carta de Peligro, 1 daño, salvo que agotes a un Tripulante para achicar.',
  },
  velasRotas: { nombre: 'Desarbolado', texto: '−1 al total de las Pruebas de NAV en el Mar. Las Distancias aumentan en 1.' },
  perseguido: { nombre: 'Perseguido', texto: 'Los encuentros de tipo Armada reciben +1 de dificultad. Se quita al superar uno.' },
  desanimo: { nombre: 'Desmoralizado', texto: 'Al final del turno robas 1 carta menos; después se descarta.' },
}

/**
 * Quién queda con un Estado de los que van junto al Barco y el adjetivo concordado (todos los Estados son adjetivos y se
 * dicen con «queda»): «el Barco queda Anegado» y, fase 16, «tu tripulación queda Desmoralizada» (su carta se llama
 * Desmoralizado, pero el Estado es de la tripulación). Para el registro y la interfaz.
 */
export function sujetoJuntoAlBarco(e: EstadoBarco): { quien: string; adjetivo: string } {
  return e === 'desanimo' ? { quien: 'tu tripulación', adjetivo: 'Desmoralizada' } : { quien: 'el Barco', adjetivo: INFO_ESTADO[e].nombre }
}

/**
 * Identificador de la carta de un Estado («estado:borracho»): el de su carta mini en cartas.json y el de sus capacidades en
 * el registro (fase 16; antes, de una ficha).
 */
export function cartaDeEstado(e: FichaTripulante | EstadoBarco): string {
  return `estado:${e}`
}
