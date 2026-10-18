// Fichas de Estado y de Ventaja sobre los Tripulantes, y de Estado sobre el Barco. Duran hasta que se quitan, también
// entre misiones. Un Tripulante no puede tener dos veces la misma ficha (ni el Barco).

import { anotar, copia, encolar, nombre } from './estado.ts'
import type { Estado, InstId } from './tipos.ts'

export { ESTADOS_BARCO, ESTADOS_TRIPULANTE, FICHAS_TRIPULANTE, INFO_ESTADO, VENTAJAS, cartaDeEstado, esVentaja, type EstadoBarco, type EstadoTripulante, type FichaTripulante, type InfoEstado, type Ventaja } from './infoEstados.ts'
import { INFO_ESTADO, esVentaja, type EstadoBarco, type FichaTripulante } from './infoEstados.ts'

export function estadosDe(s: Estado, inst: InstId): FichaTripulante[] {
  return copia(s, inst).estados ?? []
}

export function tieneEstado(s: Estado, inst: InstId, e: FichaTripulante): boolean {
  return estadosDe(s, inst).includes(e)
}

/** Pone un Estado a un Tripulante. Devuelve falso si ya lo tenía (no se repite). */
export function ponerEstado(s: Estado, inst: InstId, e: FichaTripulante): boolean {
  const c = copia(s, inst)
  if (c.estados?.includes(e)) return false
  c.estados = [...(c.estados ?? []), e]
  // Durante una misión, sus reglas pueden mirarlo («cada vez que un Tripulante quede Buscado…»).
  if (s.mision && s.zonas.tripulacion.includes(inst)) {
    if (e === 'buscado') s.mision.buscados = (s.mision.buscados ?? 0) + 1
    encolar(s, { tipo: 'evento', ev: { tipo: 'estadoPuesto', carta: inst, estado: e }, fase: 'despues', cancelado: false, usadas: [] })
  }
  return true
}

export function quitarEstado(s: Estado, inst: InstId, e: FichaTripulante): boolean {
  const c = copia(s, inst)
  if (!c.estados?.includes(e)) return false
  c.estados = c.estados.filter((x) => x !== e)
  if (c.estados.length === 0) delete c.estados
  return true
}

/** Quita un Estado y lo apunta en el registro. */
export function quitarEstadoAnotado(s: Estado, inst: InstId, e: FichaTripulante, por?: string): boolean {
  if (!quitarEstado(s, inst, e)) return false
  anotar(s, 'efecto', `${nombre(s, inst)} ya no está ${INFO_ESTADO[e].nombre}${por ? ` (${por})` : ''}.`)
  return true
}

export function tieneEstadoBarco(s: Estado, e: EstadoBarco): boolean {
  return (s.estadosBarco ?? []).includes(e)
}

export function ponerEstadoBarco(s: Estado, e: EstadoBarco): boolean {
  if (tieneEstadoBarco(s, e)) return false
  s.estadosBarco = [...(s.estadosBarco ?? []), e]
  return true
}

export function quitarEstadoBarco(s: Estado, e: EstadoBarco): boolean {
  if (!tieneEstadoBarco(s, e)) return false
  s.estadosBarco = (s.estadosBarco ?? []).filter((x) => x !== e)
  if (s.estadosBarco.length === 0) delete s.estadosBarco
  return true
}

/**
 * Taberna: quita todos los Estados de tus Tripulantes (las Ventajas se quedan). Devuelve lo quitado, para el registro.
 */
export function quitarEstadosTripulacion(s: Estado): string[] {
  const partes: string[] = []
  for (const c of s.zonas.tripulacion) {
    const quitados = estadosDe(s, c).filter((e) => !esVentaja(e))
    for (const e of quitados) quitarEstado(s, c, e)
    if (quitados.length > 0) partes.push(`${nombre(s, c)} ya no está ${quitados.map((e) => INFO_ESTADO[e].nombre).join(' ni ')}`)
  }
  return partes
}

/** Astillero: quita todos los Estados del Barco. Devuelve sus nombres, para el registro. */
export function quitarEstadosBarco(s: Estado): string[] {
  const quitados = [...(s.estadosBarco ?? [])]
  delete s.estadosBarco
  return quitados.map((e) => INFO_ESTADO[e].nombre)
}

/** Tripulantes en juego con ese Estado. */
export function conEstado(s: Estado, e: FichaTripulante): InstId[] {
  return s.zonas.tripulacion.filter((c) => tieneEstado(s, c, e))
}

/**
 * Agota una carta. Un Tripulante Sangrando sufre 1 herida cada vez que se agota (la herida pasa por su
 * suceso, así que se puede evitar o desviar como cualquier otra).
 */
export function agotar(s: Estado, inst: InstId): void {
  const c = copia(s, inst)
  if (c.agotada) return
  c.agotada = true
  if (c.estados?.includes('sangrando') && s.zonas.tripulacion.includes(inst)) {
    anotar(s, 'efecto', `${nombre(s, inst)} está Sangrando: al agotarse sufre 1 herida.`)
    encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: inst, cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] })
  }
}

/** Lo que se le puede curar a un Tripulante: sus heridas más las fichas que se quitan curando (Envenenado, Sangrando). */
export function curable(s: Estado, inst: InstId): number {
  const c = copia(s, inst)
  return c.heridas + (c.estados?.includes('envenenado') ? 1 : 0) + (c.estados?.includes('sangrando') ? 1 : 0)
}

/**
 * Cura N a un Tripulante. Cada punto quita primero la ficha de Envenenado, luego la de Sangrando, y después
 * las heridas. Devuelve lo que ha hecho, para el registro.
 */
// Curar quita primero las fichas (Envenenado y luego Sangrando) y después las heridas (P13).
export function curarTripulante(s: Estado, inst: InstId, n: number): string {
  const partes: string[] = []
  let resto = n
  for (const e of ['envenenado', 'sangrando'] as const) {
    if (resto > 0 && quitarEstado(s, inst, e)) {
      resto--
      partes.push(`le quita ${INFO_ESTADO[e].nombre}`)
    }
  }
  const c = copia(s, inst)
  const curadas = Math.min(resto, c.heridas)
  c.heridas -= curadas
  if (curadas > 0) partes.push(`le cura ${curadas} ${curadas === 1 ? 'herida' : 'heridas'}`)
  return partes.length > 0 ? `${nombre(s, inst)}: ${partes.join(' y ')}` : ''
}
