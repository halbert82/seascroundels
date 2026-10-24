// Ajustes finos de maquetación que la plantilla original decidía carta a carta.
// Se han medido sobre las imágenes de referencia (referencia/cartas).

/** Tamaño del nombre en la placa (px) y si va a dos líneas. */
export interface TamanoNombre {
  tam: number
  dosLineas: boolean
}

const TAM_NORMAL = 25

const AJUSTES_NOMBRE: Record<number, Partial<TamanoNombre>> = {
  1: { tam: 22 },
  2: { tam: 19 },
  8: { dosLineas: true },
  11: { dosLineas: true },
  12: { dosLineas: true },
  13: { dosLineas: true },
  23: { tam: 18.5 },
  28: { dosLineas: true },
  38: { tam: 23 },
  48: { tam: 23 },
  99: { tam: 21 },
  105: { tam: 21 },
  106: { tam: 21 },
  107: { tam: 21 },
  138: { tam: 21 },
  150: { tam: 21 },
  168: { tam: 21 },
}

export function tamanoNombre(num: number): TamanoNombre {
  const ajuste = AJUSTES_NOMBRE[num]
  return { tam: ajuste?.tam ?? TAM_NORMAL, dosLineas: ajuste?.dosLineas ?? false }
}

/** Cartas con mucho texto que no son de jugador: letra algo menor («texto apretado»).
 *  La 221 (Don Anselmo, Pasajero) es nueva y no tiene referencia. Las de jugador ya no se aprietan: llevan todas la misma
 *  letra (LETRA_JUGADOR). «Marineros sin barco» (100) ya no se aprieta: baja un poco la ilustración (ARTE_CORTO). */
const TEXTO_APRETADO = new Set<number>([221, 271])

/**
 * Fase 16 (decisión de Albert): un solo tamaño de letra para todo el texto de reglas de las cartas de jugador (Capitán,
 * Barco, Tripulantes, Mejoras, Eventos y Habilidades), 18 px. Sin texto grande (antes, 45 y 46) ni apretado (antes, 11,
 * 18, 59 y 168). La cifra sola de las Mejoras («+1 [NAV]») sigue grande: no es texto, es el dato de la carta.
 */
export const LETRA_JUGADOR = 18

/**
 * P125 (Albert): cartas cuyo texto, sin tocarlo, no cabe a su letra. La ilustración baja un poco (px menos de alto) y la
 * caja de texto sube lo mismo, como las Murallas de Port Royal pero mucho menos. Medido con capturas/medir-jugador18.mjs y
 * capturas/medir-p125.mjs (lo que sobraba): Isabela 17,6, el Viejo lobo de mar 21,6 y el Fiador 23,6 (los tres bajan lo
 * mismo, para que se vean iguales en la mesa); «Marineros sin barco» (Escenario, a su letra normal, 17 px), 13,6.
 * P132 (Albert): el Filibustero borracho y la Carne de cañón ya no la bajan: su texto nuevo pone los dos iconos en la
 * misma línea y cabe.
 */
const ARTE_CORTO: Record<number, number> = {
  11: 26, // Isabela «Cuervo» Saldaña
  18: 26, // Viejo lobo de mar
  168: 26, // Fiador de la Hermandad
  100: 16, // Marineros sin barco
}

/** Cuántos px se acorta la ilustración de una carta (0: nada). */
export function arteCorto(num: number): number {
  return ARTE_CORTO[num] ?? 0
}

/** Para calibrar: «?apretado=todas» en la hoja de captura aprieta todas las cartas (las de jugador no: llevan su letra). */
let apretarTodas = false
export function forzarTextoApretado(valor: boolean): void {
  apretarTodas = valor
}

export function esTextoApretado(num: number): boolean {
  return apretarTodas || TEXTO_APRETADO.has(num)
}

/** Nombres de encuentro que no caben a tamaño normal junto a la ficha de Avance. */
export function esNombreEncuentroLargo(nombre: string): boolean {
  return nombre.length >= 22
}
