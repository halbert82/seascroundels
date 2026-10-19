// Ilustraciones del juego en el reglamento (assets/arte): una en la cabecera de cada capítulo de «Aprende a jugar» y
// viñetas pequeñas en la columna exterior de las páginas que la tienen casi vacía (las pone main.tsx tras repartir
// las páginas). Ninguna se repite en dos páginas seguidas.

const ARCHIVOS = import.meta.glob<string>('../../assets/arte/*.jpg', { eager: true, import: 'default' })

export interface Arte {
  /** Nombre del archivo, sin extensión («taberna»). */
  nombre: string
  url: string
  /** Qué parte de la ilustración se ve al recortarla (object-position). */
  encuadre: string
}

function arte(nombre: string, encuadre = 'center'): Arte {
  const url = ARCHIVOS[`../../assets/arte/${nombre}.jpg`]
  if (!url) throw new Error(`No existe la ilustración ${nombre}`)
  return { nombre, url, encuadre }
}

/**
 * Cabecera de cada capítulo de «Aprende a jugar» (por título), de las ilustraciones apaisadas.
 * TODO(diseño): qué ilustración va en cada capítulo lo he elegido yo (docs/decisiones.md, fase 9).
 */
export const ARTE_CAPITULO: Record<string, Arte> = {
  'Resumen del juego': arte('vigia3', 'center 30%'),
  'Objetivo del juego': arte('brujula', 'center 55%'),
  Componentes: arte('canones', 'center 40%'),
  'Anatomía de las cartas': arte('diego', 'center 22%'),
  'Las reglas de oro': arte('amuleto', 'center 35%'),
  'Capacidades de las cartas': arte('reflejos', 'center 30%'),
  'Preparación de la partida': arte('casco', 'center 45%'),
  'El turno': arte('taberna', 'center 35%'),
  'Las misiones': arte('abordaje', 'center 30%'),
  'Heridas, daño y penalizaciones': arte('vendas', 'center 45%'),
  'Ganar y perder': arte('sable', 'center 55%'),
  'Ejemplo de juego': arte('filibustero2', 'center 30%'),
  'Construir tu mazo': arte('hamacas', 'center 45%'),
}

/** Todas las ilustraciones, para las viñetas de la columna exterior (en este orden se van turnando). */
export const VINETAS: Arte[] = [
  arte('cap_galeon', 'center 40%'),
  arte('brujula', 'center 50%'),
  arte('cap_isla', 'center 45%'),
  arte('canones', 'center 45%'),
  arte('vigia3', 'center 30%'),
  arte('amuleto', 'center 35%'),
  arte('casco', 'center 50%'),
  arte('diego', 'center 20%'),
  arte('sable', 'center 55%'),
  arte('taberna', 'center 35%'),
  arte('reflejos', 'center 30%'),
  arte('vendas', 'center 45%'),
  arte('abordaje', 'center 30%'),
  arte('hamacas', 'center 45%'),
  arte('filibustero2', 'center 30%'),
]
