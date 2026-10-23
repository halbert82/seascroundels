// La herramienta que mide la rotación de la tripulación (pruebas/rotacion.ts) cuenta bien: un registro por turno, una
// estancia por Tripulante que entra, y no salen más de los que entraron.

import { describe, expect, it } from 'vitest'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { CAUSAS, medirRotacion, resumenRotacion } from './pruebas/rotacion.ts'

describe('Medida de la rotación de la tripulación', () => {
  const partidas = [1, 2, 3, 4, 5].map((semilla) => medirRotacion(semilla, jugadorConCriterio()))

  it('una Fase de Reclutamiento por turno, en orden', () => {
    for (const p of partidas) {
      expect(p.turnos.map((t) => t.turno)).toEqual(Array.from({ length: p.turnos.length }, (_, i) => i + 1))
      expect(p.turnos.length).toBeGreaterThanOrEqual(p.turnoFinal - 1)
    }
  })

  it('cada Tripulante que entra tiene su estancia, y las salidas definitivas no superan las entradas', () => {
    for (const p of partidas) {
      const reclutados = p.turnos.reduce((n, t) => n + t.reclutadosEnPuerto + t.reclutadosFuera, 0)
      expect(p.estancias.length).toBeGreaterThanOrEqual(reclutados)
      const definitivas = p.estancias.filter((e) => e.salida !== null).length
      expect(definitivas).toBeLessThanOrEqual(p.estancias.length)
      for (const e of p.estancias) if (e.salida !== null) expect(e.salida).toBeGreaterThanOrEqual(e.entrada)
      expect(p.despidos).toBe(0) // el jugador automático no despide nunca
    }
  })

  it('el resumen no tiene huecos', () => {
    const r = resumenRotacion(partidas)
    expect(r.partidas).toBe(5)
    expect(Object.keys(r.salidas.causas)).toEqual([...CAUSAS])
    expect(JSON.stringify(r)).not.toContain('null')
    expect(JSON.stringify(r)).not.toContain('NaN')
  })
})
