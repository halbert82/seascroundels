// Variantes de reglas solo para medir el equilibrio. Cambian los datos cargados en memoria del proceso de la medida;
// nunca se usan en la partida real. Se activan con MEDIR_VARIANTE, una lista separada por comas:
//
//   REP=N     reputación para ganar en el modo de la partida
//   ESC=N     cartas de Escenario del modo de la partida
//   MODO=x    modo de partida (corta, normal o larga)
//   SINESC    partida de aprendizaje (sin mazo de Escenario)
//
// Fase 11: la reputación nueva de las misiones (antes R1–R3), las Pruebas fáciles a 1 / 1 (A1) y las misiones iniciales
// con precio (I2) ya están en los datos; I1 se descartó.

import { MODOS } from '../preparacion.ts'
import type { Modo } from '../tipos.ts'

export interface VarianteMedida {
  claves: Set<string>
  rep?: number
  escenario?: number
  modo: Modo
}

export function leerVariante(texto: string | undefined): VarianteMedida {
  const v: VarianteMedida = { claves: new Set(), modo: 'normal' }
  for (const parte of (texto ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const [clave, valor] = parte.split('=')
    if (clave === 'REP') v.rep = Number(valor)
    else if (clave === 'ESC') v.escenario = Number(valor)
    else if (clave === 'MODO') v.modo = valor as Modo
    else if (clave === 'SINESC') v.claves.add(clave)
    else if (clave) throw new Error(`Variante de medida desconocida: ${clave}`)
  }
  return v
}

/** Aplica la variante a los datos en memoria. Llamar una sola vez por proceso, antes de jugar. */
export function aplicarVariante(v: VarianteMedida): void {
  if (v.rep !== undefined) MODOS[v.modo].reputacion = v.rep
  if (v.escenario !== undefined) MODOS[v.modo].escenario = v.escenario
}
