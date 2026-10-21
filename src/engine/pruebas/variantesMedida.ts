// Variantes de reglas solo para medir el equilibrio. Cambian los datos cargados en memoria del proceso de la medida;
// nunca se usan en la partida real. Se activan con MEDIR_VARIANTE, una lista separada por comas:
//
//   REP=N     reputación para ganar en el modo de la partida
//   ESC=N     cartas de Escenario del modo de la partida
//   MODO=x    modo de partida (corta, normal o larga)
//   SINESC    partida de aprendizaje (sin mazo de Escenario)
//   R:id=±N   suma N a la reputación de la recompensa de un capítulo (en un final con elección, a cada opción)
//   AV:id=N   Avance necesario de un capítulo
//   MAZO:a=b  en el mazo del capitán de inicio, la carta a pasa a ser b (fase 13: «Arenga del capitán» en lugar de
//             «Ron para los valientes», MAZO:ron_valientes=arenga; el mazo de inicio de la partida no cambia)
//
// Fase 11: la reputación nueva de las misiones (antes R1–R3), las Pruebas fáciles a 1 / 1 (A1) y las misiones iniciales
// con precio (I2) ya están en los datos; I1 se descartó.

import { porId } from '../catalogo.ts'
import { DATOS, type CapituloDatos } from '../datos.ts'
import { MODOS } from '../preparacion.ts'
import type { Modo } from '../tipos.ts'

export interface VarianteMedida {
  claves: Set<string>
  rep?: number
  escenario?: number
  modo: Modo
  /** Fase 12: cambios de reputación (suma) y de Avance (valor) por capítulo. */
  reputacionCapitulo: Record<string, number>
  avanceCapitulo: Record<string, number>
  /** Fase 13: cartas que se cambian en el mazo del capitán de inicio (de → a). */
  mazo: Record<string, string>
}

export function leerVariante(texto: string | undefined): VarianteMedida {
  const v: VarianteMedida = { claves: new Set(), modo: 'normal', reputacionCapitulo: {}, avanceCapitulo: {}, mazo: {} }
  for (const parte of (texto ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const [clave, valor] = parte.split('=')
    if (clave === 'REP') v.rep = Number(valor)
    else if (clave === 'ESC') v.escenario = Number(valor)
    else if (clave === 'MODO') v.modo = valor as Modo
    else if (clave === 'SINESC') v.claves.add(clave)
    else if (clave?.startsWith('R:')) v.reputacionCapitulo[clave.slice(2)] = Number(valor)
    else if (clave?.startsWith('AV:')) v.avanceCapitulo[clave.slice(3)] = Number(valor)
    else if (clave?.startsWith('MAZO:') && valor) v.mazo[clave.slice(5)] = valor
    else if (clave) throw new Error(`Variante de medida desconocida: ${clave}`)
  }
  return v
}

/** Aplica la variante a los datos en memoria. Llamar una sola vez por proceso, antes de jugar. */
export function aplicarVariante(v: VarianteMedida): void {
  if (v.rep !== undefined) MODOS[v.modo].reputacion = v.rep
  if (v.escenario !== undefined) MODOS[v.modo].escenario = v.escenario
  const capitulo = (id: string): CapituloDatos => {
    const e = porId(id)
    if (e.tipo !== 'capitulo') throw new Error(`${id} no es un capítulo`)
    return e.carta
  }
  for (const [id, n] of Object.entries(v.reputacionCapitulo)) {
    const r = capitulo(id).recompensa
    if (r.elige) for (const o of r.elige) o.rep = (o.rep ?? 0) + n
    else r.rep = (r.rep ?? 0) + n
  }
  for (const [id, n] of Object.entries(v.avanceCapitulo)) capitulo(id).avanceNecesario = n
  const mazo = DATOS.mazosPredefinidos.mazoDelCapitan
  for (const [de, a] of Object.entries(v.mazo)) {
    porId(a)
    const i = mazo.indexOf(de)
    if (i < 0) throw new Error(`«${de}» no está en el mazo del capitán de inicio`)
    mazo[i] = a
  }
}
