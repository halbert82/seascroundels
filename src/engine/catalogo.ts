// Catálogo de la Caja básica: una entrada por número de colección (001–153).

import {
  DATOS,
  type BarcoDatos,
  type CapitanDatos,
  type CapituloDatos,
  type CartaMazoPropioDatos,
  type DatosCartas,
  type EscenarioDatos,
  type EventoDatos,
  type HabilidadCartaDatos,
  type MejoraBarcoDatos,
  type MejoraTripulanteDatos,
  type MisionDatos,
  type PeligroDatos,
  type PuertoDatos,
  type TesoroDatos,
  type TripulanteDatos,
} from './datos.ts'

export type EntradaCatalogo =
  | { tipo: 'capitan'; num: number; id: string; copias: number; carta: CapitanDatos }
  | { tipo: 'barco'; num: number; id: string; copias: number; carta: BarcoDatos }
  | { tipo: 'tripulante'; num: number; id: string; copias: number; carta: TripulanteDatos }
  | { tipo: 'mejoraBarco'; num: number; id: string; copias: number; carta: MejoraBarcoDatos }
  | { tipo: 'mejoraTripulante'; num: number; id: string; copias: number; carta: MejoraTripulanteDatos }
  | { tipo: 'evento'; num: number; id: string; copias: number; carta: EventoDatos }
  | { tipo: 'habilidad'; num: number; id: string; copias: number; carta: HabilidadCartaDatos }
  | { tipo: 'tesoro'; num: number; id: string; copias: number; carta: TesoroDatos }
  | { tipo: 'peligro'; num: number; id: string; copias: number; carta: PeligroDatos }
  | {
      tipo: 'mazoPropio'
      num: number
      id: string
      copias: number
      carta: CartaMazoPropioDatos
      /** Nombre del mazo propio, p. ej. «mazo del Templo». */
      mazo: string
      mision: MisionDatos
    }
  | { tipo: 'escenario'; num: number; id: string; copias: number; carta: EscenarioDatos }
  | { tipo: 'puerto'; num: number; id: string; copias: number; carta: PuertoDatos }
  | {
      tipo: 'capitulo'
      num: number
      /** `${mision.id}-${capitulo}`, p. ej. «templo-I». */
      id: string
      copias: number
      carta: CapituloDatos
      mision: MisionDatos
    }

export type TipoCarta = EntradaCatalogo['tipo']

export const NOMBRE_TIPO: Record<TipoCarta, string> = {
  capitan: 'Capitán',
  barco: 'Barco',
  tripulante: 'Tripulante',
  mejoraBarco: 'Mejora de barco',
  mejoraTripulante: 'Mejora de tripulante',
  evento: 'Evento',
  habilidad: 'Habilidad',
  tesoro: 'Tesoro',
  peligro: 'Peligro',
  mazoPropio: 'Mazo propio',
  escenario: 'Escenario',
  puerto: 'Puerto',
  capitulo: 'Misión',
}

/** Construye el catálogo completo, ordenado por número de colección. */
export function construirCatalogo(datos: DatosCartas = DATOS): EntradaCatalogo[] {
  const lista: EntradaCatalogo[] = []

  for (const carta of datos.capitanes) lista.push({ tipo: 'capitan', num: carta.num, id: carta.id, copias: 1, carta })
  lista.push({ tipo: 'barco', num: datos.barco.num, id: 'barco', copias: 1, carta: datos.barco })
  for (const carta of datos.tripulantes)
    lista.push({ tipo: 'tripulante', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.mejorasBarco)
    lista.push({ tipo: 'mejoraBarco', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.mejorasTripulante)
    lista.push({ tipo: 'mejoraTripulante', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.eventos) lista.push({ tipo: 'evento', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.habilidades)
    lista.push({ tipo: 'habilidad', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.tesoros) lista.push({ tipo: 'tesoro', num: carta.num, id: carta.id, copias: 1, carta })
  for (const carta of datos.peligros) lista.push({ tipo: 'peligro', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.escenario) lista.push({ tipo: 'escenario', num: carta.num, id: carta.id, copias: 1, carta })
  for (const carta of datos.puertos) lista.push({ tipo: 'puerto', num: carta.num, id: carta.id, copias: 1, carta })

  for (const mision of datos.misiones) {
    for (const capitulo of mision.capitulos) {
      lista.push({
        tipo: 'capitulo',
        num: capitulo.num,
        id: `${mision.id}-${capitulo.capitulo}`,
        copias: 1,
        carta: capitulo,
        mision,
      })
    }
  }

  // Cada carta de mazo propio pertenece al capítulo cuya capacidad Al zarpar la mezcla.
  for (const carta of datos.cartasDeMazoPropio) {
    let encontrada = false
    for (const mision of datos.misiones) {
      for (const capitulo of mision.capitulos) {
        const mezcla = capitulo.ayudaPrototipo?.mix
        if (!mezcla) continue
        const copias = mezcla.deck.filter((id) => id === carta.id).length
        if (copias === 0) continue
        lista.push({ tipo: 'mazoPropio', num: carta.num, id: carta.id, copias, carta, mazo: mezcla.name, mision })
        encontrada = true
      }
    }
    if (!encontrada) throw new Error(`La carta de mazo propio «${carta.id}» no pertenece a ningún mazo propio`)
  }

  return lista.sort((a, b) => a.num - b.num)
}

export const CATALOGO: EntradaCatalogo[] = construirCatalogo()

/** «Caja básica · 007» */
export function codigoColeccion(num: number): string {
  return `Caja básica · ${String(num).padStart(3, '0')}`
}
