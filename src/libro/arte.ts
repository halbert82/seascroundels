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
 * Cabecera de cada capítulo de «Aprende a jugar» (por título), de las ilustraciones apaisadas: las verticales (misiones
 * y puertos) nunca van a lo ancho. La cabecera es una franja muy baja (178 × 33 mm): el encuadre deja a la vista la cara
 * o el objeto. Ninguna repite la ilustración de una carta de su doble página (lo revisa comprobar:reglamento).
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
  'Heridas, daño y penalizaciones': arte('matasanos', 'center 13%'),
  'Ganar y perder': arte('sable', 'center 55%'),
  'Ejemplo de juego': arte('filibustero2', 'center 30%'),
  'Construir tu mazo': arte('catalina', 'center 12%'),
}

/** Ilustraciones para las viñetas de la columna exterior (en este orden se van turnando). Solo apaisadas y cuadradas. */
export const VINETAS: Arte[] = [
  arte('cap_galeon', 'center 40%'),
  arte('viejo_lobo', 'center 25%'),
  arte('brujula', 'center 50%'),
  arte('herbolaria', 'center 30%'),
  arte('cap_isla', 'center 45%'),
  arte('bucanero', 'center 30%'),
  arte('canones', 'center 45%'),
  arte('vela', 'center 40%'),
  arte('vigia3', 'center 30%'),
  arte('rastreador', 'center 35%'),
  arte('amuleto', 'center 35%'),
  arte('chalupa', 'center 55%'),
  arte('casco', 'center 50%'),
  arte('grumete', 'center 25%'),
  arte('diego', 'center 20%'),
  arte('patente', 'center 40%'),
  arte('sable', 'center 55%'),
  arte('contrabandista', 'center 35%'),
  arte('taberna', 'center 35%'),
  arte('huracanes', 'center 45%'),
  arte('reflejos', 'center 30%'),
  arte('carpintero', 'center 30%'),
  arte('vendas', 'center 45%'),
  arte('coleto', 'center 40%'),
  arte('abordaje', 'center 30%'),
  arte('practico', 'center 25%'),
  arte('hamacas', 'center 45%'),
  arte('rufian', 'center 25%'),
  arte('filibustero2', 'center 30%'),
  arte('coraje', 'center 50%'),
  arte('mapa', 'center 60%'),
]

/**
 * Láminas a página entera, con un margen fino y sin texto, en las páginas que quedarían en blanco porque lo que sigue
 * empieza en página par: la ilustración según lo que empieza en la página siguiente. Si no hay lámina para esa página,
 * queda la rosa de los vientos.
 */
export const LAMINAS: { antesDe: string; arte: Arte }[] = [
  { antesDe: '#a-preparacion-de-la-partida', arte: arte('tortuga', 'center 15%') },
  // Apaisada en una página vertical: se ve la proa y las velas.
  { antesDe: '.contraportada', arte: arte('barco', '38% center') },
]
