// Variantes de reglas solo para medir el equilibrio (fase 10c). Cambian los datos cargados en memoria del proceso de la
// medida; nunca se usan en la partida real. Se activan con MEDIR_VARIANTE, una lista separada por comas:
//
//   R1        reputación nueva de las misiones: capítulo I 0, II 1, III 2 (3 en las travesías Difíciles), aventuras 1,
//             iniciales 0; en un final con elección, la mejor opción da eso y las demás 1 menos
//   R2        como R1, pero el capítulo I da 1
//   R3        capítulo I 1, II 2, III 3 (también en las Difíciles), aventuras 1, iniciales 0
//   A1        Pruebas fáciles (dificultad 3 o menos) a Avance 1 / 1
//   I1        misiones iniciales más pequeñas (Agua y leña: Tripulante de coste 1 o menos; Rumbo a mar abierto: Mejora de 0)
//   I2        misiones iniciales con precio (Agua y leña: el Barco sufre 1 daño; Rumbo a mar abierto: 1 herida)
//   REP=N     reputación para ganar en el modo de la partida
//   ESC=N     cartas de Escenario del modo de la partida
//   MODO=x    modo de partida (corta, normal o larga)

import { DATOS } from '../datos.ts'
import type { CapituloDatos, EncuentroDatos, OpcionFinal } from '../datos.ts'
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
    else if (clave) v.claves.add(clave)
  }
  return v
}

const DIFICILES = new Set(['Difícil'])

type Tabla = 'R1' | 'R2' | 'R3'

function repNueva(tabla: Tabla, cap: CapituloDatos, reto: string, inicial: boolean, aventura: boolean): number {
  if (inicial) return 0
  if (aventura) return 1
  if (tabla === 'R3') return cap.capitulo === 'I' ? 1 : cap.capitulo === 'II' ? 2 : 3
  if (cap.capitulo === 'I') return tabla === 'R2' ? 1 : 0
  if (cap.capitulo === 'II') return 1
  return DIFICILES.has(reto) ? 3 : 2
}

function aplicarReputacion(tabla: Tabla): void {
  for (const m of DATOS.misiones) {
    for (const c of m.capitulos) {
      const r = c.recompensa
      if (r.victoria) {
        continue
      }
      const nueva = repNueva(tabla, c, m.reto, m.inicial, m.aventura)
      if (r.elige && r.elige.length > 0) {
        const mejor = Math.max(...r.elige.map((o: OpcionFinal) => o.rep ?? 0))
        for (const o of r.elige) o.rep = (o.rep ?? 0) === mejor ? nueva : Math.max(0, nueva - 1)
      } else {
        r.rep = nueva
      }
    }
  }
}

function esFacil(enc: EncuentroDatos): boolean {
  if (!enc.prueba || enc.prueba.length === 0) return false
  return enc.prueba.every((p) => typeof p.dificultad === 'number' && p.dificultad <= 3)
}

function aplicarA1(): void {
  const encuentros: EncuentroDatos[] = []
  for (const p of DATOS.peligros) {
    if (p.version !== 2) continue
    for (const enc of Object.values(p.encuentros ?? {})) if (enc) encuentros.push(enc as EncuentroDatos)
  }
  for (const c of DATOS.cartasDeMazoPropio) if (c.version === 2 && c.encuentro) encuentros.push(c.encuentro as EncuentroDatos)
  for (const enc of encuentros) {
    if (!esFacil(enc)) continue
    enc.avance = 1
    enc.avanceSinSuperar = 1
  }
}

function aplicarI1(): void {
  for (const m of DATOS.misiones.filter((x) => x.inicial)) {
    const r = m.capitulos[0]?.recompensa
    if (!r) continue
    if (r.reclutaGratis !== undefined) r.reclutaGratis = 1
    if (r.adquiereGratis !== undefined) r.adquiereGratis = 0
  }
}

function aplicarI2(): void {
  for (const m of DATOS.misiones.filter((x) => x.inicial)) {
    const r = m.capitulos[0]?.recompensa
    if (!r) continue
    if (r.reclutaGratis !== undefined) r.precio = [{ tipo: 'dano', n: 1, enTierra: true }]
    if (r.adquiereGratis !== undefined) r.precio = [{ tipo: 'heridas', n: 1 }]
  }
}

/** Aplica la variante a los datos en memoria. Llamar una sola vez por proceso, antes de jugar. */
export function aplicarVariante(v: VarianteMedida): void {
  for (const t of ['R1', 'R2', 'R3'] as const) if (v.claves.has(t)) aplicarReputacion(t)
  if (v.claves.has('A1')) aplicarA1()
  if (v.claves.has('I1')) aplicarI1()
  if (v.claves.has('I2')) aplicarI2()
  if (v.rep !== undefined) MODOS[v.modo].reputacion = v.rep
  if (v.escenario !== undefined) MODOS[v.modo].escenario = v.escenario
}
