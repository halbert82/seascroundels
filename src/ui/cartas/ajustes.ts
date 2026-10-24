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
 *  letra (LETRA_JUGADOR). */
// TODO(regla): revisión de Albert, pendiente de su decisión: «Marineros sin barco» (100), con su texto nuevo, se pasa 3 px a
// la letra normal; hasta que Albert elija (acortar el texto o la ambientación), va apretada.
const TEXTO_APRETADO = new Set<number>([100, 221, 271])

/**
 * Fase 16 (decisión de Albert): un solo tamaño de letra para todo el texto de reglas de las cartas de jugador (Capitán,
 * Barco, Tripulantes, Mejoras, Eventos y Habilidades), 18 px. Sin texto grande (antes, 45 y 46) ni apretado (antes, 11,
 * 18, 59 y 168). La cifra sola de las Mejoras («+1 [NAV]») sigue grande: no es texto, es el dato de la carta.
 */
export const LETRA_JUGADOR = 18

/**
 * TODO(regla): cartas de jugador cuyo texto no cabe a 18 px. Mientras Albert decide si se acorta el texto o se baja un
 * poco la ilustración (como en las Murallas), llevan la letra mayor con la que cabe, para que no se corte nada. Medido
 * con capturas/medir-jugador18.mjs (lo que sobra a 18 px, en píxeles).
 */
const LETRA_JUGADOR_PROVISIONAL: Record<number, number> = {
  9: 17.5, // Filibustero borracho: sobra 1 px (la ambientación roza el margen de abajo).
  11: 15, // Isabela «Cuervo» Saldaña: sobran 17,6 px (su ambientación va a dos líneas).
  18: 15, // Viejo lobo de mar: sobran 21,6 px (cuatro líneas de reglas).
  168: 17.5, // Fiador de la Hermandad: sobran 23,6 px (cuatro líneas de reglas).
  244: 17.5, // Carne de cañón: sobra 1 px (la ambientación roza el margen de abajo).
}

/** Letra de las reglas de una carta de jugador, en px. */
export function letraJugador(num: number): number {
  return LETRA_JUGADOR_PROVISIONAL[num] ?? LETRA_JUGADOR
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
