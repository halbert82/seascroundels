// Avance X / Y (regla de Albert del 19 de octubre de 2026): un encuentro con Prueba da X si la superas e Y si no la
// superas (fallas, no comprometes a nadie o el Destino dice «Fallas la Prueba»). Por defecto, Y = mitad de X hacia abajo.

import { describe, expect, it } from 'vitest'
import { DATOS } from './datos.ts'
import { avanceSinSuperar, reglasDe } from './definiciones.ts'
import { nuevaPartida } from './preparacion.ts'
import { Jugador, MISIONES_DE_PRUEBA } from './pruebas/situacion.ts'
import type { Estado } from './tipos.ts'

const { mar5, ciu4 } = MISIONES_DE_PRUEBA

// «Arrecife de los Colorados» (Mar, NAV 4, Avance 3 / 1). El Destino sale de «Chubasco»: «Sin novedad», +0, sin efectos.
function arrecife(op: Parameters<typeof Jugador.enMision>[0] = {}) {
  return Jugador.enMision({ misiones: [mar5], tripulacion: ['viejo_lobo'], mazoPeligros: ['p2_arrecife', 'chubasco', 'calma', 'calma'], ...op })
}

describe('Avance X / Y', () => {
  it('si superas la Prueba, ganas X: «Arrecife de los Colorados» da 3', () => {
    // Viejo lobo (NAV 3) + Diego (NAV 2) + el Barco (+1 en el Mar) = 6 contra 4.
    const j = arrecife().comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.registro).toContain('Ganas 3 de Avance (3/5).')
  })

  it('si no comprometes a nadie, no la superas: ganas Y (1)', () => {
    const j = arrecife().comprometer('NAV').seguir()
    expect(j.registro).toContain('Ganas 1 de Avance (1/5).')
  })

  it('si la fallas, ganas Y (1)', () => {
    // El Rufián de cubierta (NAV 0) + el Barco (+1) = 1 contra 4: la falla.
    const j = Jugador.enMision({ misiones: [mar5], tripulacion: ['marinero_p'], mazoPeligros: ['p2_arrecife', 'chubasco', 'calma', 'calma'] })
    j.comprometer('NAV', ['marinero_p']).seguir()
    expect(j.registro.some((r) => r.includes('fallas la Prueba'))).toBe(true)
    expect(j.registro).toContain('Ganas 1 de Avance (1/5).')
  })

  it('un Destino «Fallas la Prueba» cuenta como no superada: «El Holandés errante» en el Mar da Y', () => {
    const j = Jugador.enMision({ misiones: [mar5], tripulacion: ['viejo_lobo'], mazoPeligros: ['p2_arrecife', 'p2_holandes', 'calma', 'calma'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.registro).toContain('Ganas 1 de Avance (1/5).')
  })

  it('en un «Elige», pagar en vez de hacer la Prueba cuenta como superada: «Carestía» (1 / 0) da 1', () => {
    const paga = Jugador.enMision({ misiones: [ciu4], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['p2_hambre', 'chubasco', 'calma'] })
    paga.opcion('0').elegir('ojo', 'timon')
    expect(paga.registro).toContain('Ganas 1 de Avance (1/4).')
    // Si regateas y no superas la Prueba (nadie comprometido), no ganas Avance.
    const regatea = Jugador.enMision({ misiones: [ciu4], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['p2_hambre', 'chubasco', 'calma'] })
    regatea.opcion('1').comprometer('EXP').seguir()
    expect(regatea.registro).toContain('Ganas 0 de Avance (0/4).')
  })

  it('lo que la misión da de más al superar una Prueba se suma a X («La goleta del correo»: +1 por cada Prueba de NAV superada)', () => {
    const supera = arrecife({ misiones: ['espia-III'] }).comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(supera.registro.some((r) => r.startsWith('Ganas 4 de Avance'))).toBe(true)
    const nadie = arrecife({ misiones: ['espia-III'] }).comprometer('NAV').seguir()
    expect(nadie.registro.some((r) => r.startsWith('Ganas 1 de Avance'))).toBe(true)
  })

  it('la mesa ve los dos valores antes de decidir: «Si la superas: +3 · Si no la superas: +1»', async () => {
    const { avancePrevisto } = await import('./tareas/encuentro.ts')
    const j = arrecife()
    expect(avancePrevisto(j.estado, 'NAV')).toEqual({ siSuperas: 3, siNo: 1 })
    const goleta = arrecife({ misiones: ['espia-III'] })
    expect(avancePrevisto(goleta.estado, 'NAV')).toEqual({ siSuperas: 4, siNo: 1 })
  })
})

describe('Avance X / Y: los datos de las cartas', () => {
  it('todo encuentro con Prueba en juego lleva Y (por defecto, la mitad de X hacia abajo); los demás, un solo valor', () => {
    const encuentros = [
      ...DATOS.peligros.filter((c) => !c.retirada).flatMap((c) => (['mar', 'nat', 'ciu'] as const).map((e) => ({ id: c.id, e, enc: c.encuentros[e] }))),
      ...DATOS.cartasDeMazoPropio.map((c) => ({ id: c.id, e: 'unico' as const, enc: c.encuentro })),
    ]
    let conDos = 0
    for (const { id, e, enc } of encuentros) {
      const queda = reglasDe(id)?.encuentros?.[e]?.queda
      if (enc.prueba.length > 0 && !queda) {
        expect(enc.avanceSinSuperar, `${id} (${e})`).toBeDefined()
        expect(enc.avanceSinSuperar ?? -1, `${id} (${e})`).toBeGreaterThanOrEqual(0)
        expect(enc.avanceSinSuperar ?? 99, `${id} (${e})`).toBeLessThanOrEqual(enc.avance)
        conDos++
      } else {
        expect(enc.avanceSinSuperar, `${id} (${e})`).toBeUndefined()
      }
    }
    expect(conDos).toBe(154)
  })
})

describe('Avance X / Y: variantes solo para simular', () => {
  const def = { avance: 3, avanceSinSuperar: 1 }
  const con = (avanceSinSuperar?: 'entero' | 'menosUno'): Estado => nuevaPartida({ semilla: 1, ...(avanceSinSuperar ? { variante: { avanceSinSuperar } } : {}) })

  it('la regla del juego usa el valor de la carta; sin él, la mitad hacia abajo', () => {
    expect(avanceSinSuperar(con(), def)).toBe(1)
    expect(avanceSinSuperar(con(), { avance: 3 })).toBe(1)
    expect(avanceSinSuperar(con(), { avance: 1 })).toBe(0)
  })

  it('«como estaba» da el Avance entero y «X − 1» uno menos, nunca por debajo de 0', () => {
    expect(avanceSinSuperar(con('entero'), def)).toBe(3)
    expect(avanceSinSuperar(con('menosUno'), def)).toBe(2)
    expect(avanceSinSuperar(con('menosUno'), { avance: 0 })).toBe(0)
  })

  it('una partida normal no lleva variante', () => {
    expect(con().variante).toBeUndefined()
  })
})
