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

/** Cartas con mucho texto: letra algo menor («texto apretado»).
 *  La 011 no lo lleva en la referencia (su frase se salía de la caja); se aprieta por decisión de Albert. */
const TEXTO_APRETADO = new Set<number>([11, 18, 59])

/** Cartas cuyo texto corto va grande y centrado, aunque no sea una cifra sola. */
const TEXTO_GRANDE = new Set<number>([45, 46])

export function esTextoGrande(num: number): boolean {
  return TEXTO_GRANDE.has(num)
}

/** Para calibrar: «?apretado=todas» en la hoja de captura aprieta todas las cartas. */
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
