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
import { INFO_ESTADO, type EstadoBarco, type EstadoTripulante } from './infoEstados.ts'

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

// ---------------------------------------------------------------------------
// Consultas por identificador de carta («bucanero», «templo-I»…)

const POR_ID = new Map<string, EntradaCatalogo>(CATALOGO.map((e) => [e.id, e]))

/**
 * Cartas que no son de la Caja básica (las de Peligro de prueba, y más adelante las rediseñadas mientras no
 * estén en cartas.json). Se pueden consultar por identificador, pero no aparecen en el catálogo ni en la galería.
 */
export function registrarCartasExtra(...entradas: EntradaCatalogo[]): void {
  for (const e of entradas) {
    const ya = POR_ID.get(e.id)
    if (ya && ya !== e && CATALOGO.includes(ya)) throw new Error(`La carta «${e.id}» ya está en la Caja básica`)
    POR_ID.set(e.id, e)
  }
}

/** Fuentes de capacidades que no son cartas: las fichas de Estado y la carta de Peligro que ocupa el muelle. */
function nombreDeFuente(id: string): string | null {
  if (id.startsWith('estado:')) {
    const info = INFO_ESTADO[id.slice('estado:'.length) as EstadoTripulante | EstadoBarco]
    return info ? info.nombre : null
  }
  if (id === 'peligroEnMuelle') return 'Peligro en el muelle'
  return null
}

/** Entrada del catálogo de una carta por su identificador. */
export function porId(id: string): EntradaCatalogo {
  const entrada = POR_ID.get(id)
  if (!entrada) throw new Error(`No existe ninguna carta con identificador «${id}»`)
  return entrada
}

/** ¿Es una carta (de la caja o registrada aparte)? Las fichas de Estado, por ejemplo, no lo son. */
export function esCarta(id: string): boolean {
  return POR_ID.has(id)
}

/** ¿Es una carta del jugador (no de Peligro, misión, Escenario ni puerto)? */
export function esCartaDelJugador(id: string): boolean {
  const e = POR_ID.get(id)
  return e !== undefined && ['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad', 'tesoro'].includes(e.tipo)
}

/** Nombre impreso de la carta. */
export function nombreDe(id: string): string {
  const fuente = nombreDeFuente(id)
  if (fuente) return fuente
  const e = porId(id)
  return e.tipo === 'peligro' || e.tipo === 'mazoPropio' || 'nombre' in e.carta ? e.carta.nombre : id
}

export function tipoDe(id: string): TipoCarta {
  return porId(id).tipo
}

/** Coste impreso (el número del timón). 0 si la carta no tiene coste. */
export function costeImpreso(id: string): number {
  const c = porId(id).carta
  return 'coste' in c && typeof c.coste === 'number' ? c.coste : 0
}

/** Cañones: las Mejoras de barco con munición (N18). */
export function esCanon(id: string): boolean {
  const e = porId(id)
  return e.tipo === 'mejoraBarco' && e.carta.canon
}

/** Una carta indestructible no se puede perder ni agotar. Los Tesoros tampoco. */
export function esIndestructible(id: string): boolean {
  const e = porId(id)
  if (e.tipo === 'tesoro') return true
  return 'texto' in e.carta && typeof e.carta.texto === 'string' && e.carta.texto.startsWith('Indestructible')
}

export function esUnica(id: string): boolean {
  const e = porId(id)
  if (e.tipo === 'capitan' || e.tipo === 'tesoro') return true
  return 'unico' in e.carta && e.carta.unico === true
}

/** Iconos de una habilidad en una carta de la mano (Eventos y Habilidades). */
export function iconosDe(id: string, hab: 'NAV' | 'COM' | 'EXP'): number {
  const c = porId(id).carta
  return 'iconos' in c && Array.isArray(c.iconos) ? c.iconos.filter((i) => i === hab).length : 0
}

/** Rasgos de un Tripulante o Capitán. */
export function rasgosDe(id: string): string[] {
  const e = porId(id)
  return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta.rasgos : []
}
