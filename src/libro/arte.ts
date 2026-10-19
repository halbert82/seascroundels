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

/**
 * Láminas a página entera, con un margen fino y sin texto, en las páginas que quedarían en blanco porque lo que sigue
 * empieza en página par: la ilustración según lo que empieza en la página siguiente. Si no hay lámina para esa página,
 * queda la rosa de los vientos.
 */
export const LAMINAS: { antesDe: string; arte: Arte }[] = [
  { antesDe: '#a-preparacion-de-la-partida', arte: arte('tortuga', 'center 15%') },
  // Fase 10: «Ejemplo de juego» empieza en página par y deja en blanco la anterior.
  { antesDe: '.capitulo.ejemplo-de-juego', arte: arte('nassau', 'center 30%') },
  // Apaisada en una página vertical: se ve la proa y las velas.
  { antesDe: '.contraportada', arte: arte('barco', '38% center') },
]
