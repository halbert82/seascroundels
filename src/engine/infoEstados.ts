// Nombres y textos de las fichas que llevan los Tripulantes y el Barco. Sin dependencias: lo usan el catálogo y la interfaz.
//
// Fase 8: un efecto que solo ayuda es una Ventaja (Inspirado, Aguerrido); uno que perjudica o limita es un Estado
// (Borracho también, aunque dé +1 COM). Las dos funcionan igual: fichas sobre el Tripulante, sin repetir la misma.
// La Taberna quita todos los Estados de tus Tripulantes, pero no las Ventajas. Fase 10b: lo que hace cada una.

/** Estados de un Tripulante: perjudican o limitan. Fase 10b: fuera Aturdido y Encadenado. */
export const ESTADOS_TRIPULANTE = ['envenenado', 'borracho', 'asustado', 'sangrando', 'buscado', 'maldito'] as const
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

/** Estados del Barco. Fase 10b: fuera Incendio a bordo. */
export const ESTADOS_BARCO = ['viaDeAgua', 'velasRotas', 'perseguido', 'polvoraMojada'] as const
export type EstadoBarco = (typeof ESTADOS_BARCO)[number]

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
  inspirado: { nombre: 'Inspirado', texto: '+1 al total de cada Prueba a la que esté asignado. Se quita al final del turno.', ventaja: true },
  aguerrido: { nombre: 'Aguerrido', texto: 'Puede ser asignado a una Prueba sin agotarse. Se quita al hacerlo.', ventaja: true },
  viaDeAgua: {
    nombre: 'Vía de agua',
    texto: 'En el Mar, al final de cada carta de Peligro, 1 daño, salvo que agotes a un Tripulante para achicar.',
  },
  velasRotas: { nombre: 'Velas rotas', texto: '−1 al total de las Pruebas de NAV en el Mar. Las Distancias aumentan en 1.' },
  perseguido: { nombre: 'Perseguido', texto: 'Los encuentros de tipo Armada reciben +1 de dificultad. Se quita al superar uno.' },
  polvoraMojada: { nombre: 'Pólvora mojada', texto: 'Los Cañones no se preparan en la Fase de Inicio.' },
}

/** Identificador de la «carta» de un Estado en el registro de capacidades («estado:borracho»). */
export function cartaDeEstado(e: FichaTripulante | EstadoBarco): string {
  return `estado:${e}`
}
