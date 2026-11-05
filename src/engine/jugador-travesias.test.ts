// P135 (5 de noviembre de 2026): el jugador automático valora una travesía entera, por lo que da por turno, como lo haría
// una persona. Antes la valoraba casi solo por el capítulo que se ofrecía (el resto contaba un 20 %) y «El espía de
// Cádiz» casi no se jugaba: «Cobrar la deuda» y «Agua y leña», que no dan reputación, puntuaban más que su capítulo I.

import { afterEach, describe, expect, it } from 'vitest'
import { jugadorConCriterio, puntuacionMision, valorarTravesias } from './pruebas/jugadores.ts'
import { Jugador } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

const turnos = (n: number): CartaId[] => Array.from({ length: n }, () => 'pruebas-calma')

function enPuerto(misiones: CartaId[], dias: number): Jugador {
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: turnos(dias), misiones, tripulacion: ['viejo_lobo', 'bucanero'] })
}

describe('P135 · El jugador automático valora la travesía entera, por turno', () => {
  afterEach(() => valorarTravesias('travesia'))

  it('con turnos por delante, zarpa a «Seguirle por Port Royal» y no a las misiones iniciales que no dan reputación', () => {
    const j = enPuerto(['deuda-I', 'aguada-I', 'espia-I'], 8)
    const espia = j.inst('espia-I', ['misionesDisponibles'])
    expect(jugadorConCriterio()(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: `zarpar:${espia}` })
    // El fallo de antes: con el criterio del capítulo, «Cobrar la deuda» (sin reputación) puntuaba más.
    valorarTravesias('capitulo')
    expect(jugadorConCriterio()(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: `zarpar:${j.inst('deuda-I', ['misionesDisponibles'])}` })
  })

  it('el capítulo I del espía vale la media por turno de sus dos capítulos; en el último turno, solo lo suyo', () => {
    const ultimo = enPuerto(['espia-I'], 0)
    const solo = puntuacionMision(ultimo.estado, ultimo.inst('espia-I', ['misionesDisponibles']))
    // «La goleta del correo»: 2 de reputación, 5 de Avance, sin Distancia, de Mar.
    const goleta = 2 * 2.2 - 5 * 0.9 + 0.5
    const j = enPuerto(['espia-I'], 8)
    expect(puntuacionMision(j.estado, j.inst('espia-I', ['misionesDisponibles']))).toBeCloseTo((solo + goleta) / 2, 6)
    // En el último turno no cabe otro capítulo: el criterio de antes y el de ahora dan lo mismo.
    valorarTravesias('capitulo')
    expect(puntuacionMision(ultimo.estado, ultimo.inst('espia-I', ['misionesDisponibles']))).toBeCloseTo(solo, 6)
  })

  it('solo cuenta los capítulos que caben en los turnos que quedan, y puede dejar la travesía cuando no le compense', () => {
    // El templo perdido tiene 4 capítulos: con 1 turno después de este solo cuenta «La selva».
    const corto = enPuerto(['templo-I'], 1)
    const largo = enPuerto(['templo-I'], 8)
    const solo = puntuacionMision(enPuerto(['templo-I'], 0).estado, enPuerto(['templo-I'], 0).inst('templo-I', ['misionesDisponibles']))
    const conSelva = puntuacionMision(corto.estado, corto.inst('templo-I', ['misionesDisponibles']))
    const entera = puntuacionMision(largo.estado, largo.inst('templo-I', ['misionesDisponibles']))
    const selva = 2 * 2.2 - 4 * 0.9 - 2 * 0.6
    expect(conSelva).toBeCloseTo(Math.max(solo, (solo + selva) / 2), 6)
    expect(entera).toBeGreaterThanOrEqual(conSelva)
    // Nunca vale menos que el capítulo solo (se puede dejar la travesía después de él).
    for (const j of [corto, largo]) expect(puntuacionMision(j.estado, j.inst('templo-I', ['misionesDisponibles']))).toBeGreaterThanOrEqual(solo)
  })

  it('la victoria de Panamá se sigue valorando como antes (no es reputación por turno)', () => {
    const j = enPuerto(['panama-II'], 8)
    const ahora = puntuacionMision(j.estado, j.inst('panama-II', ['misionesDisponibles']))
    valorarTravesias('capitulo')
    expect(puntuacionMision(j.estado, j.inst('panama-II', ['misionesDisponibles']))).toBeCloseTo(ahora, 6)
  })
})
