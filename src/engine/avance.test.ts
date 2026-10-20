// Avance X / Y (regla de Albert del 19 de octubre de 2026): un encuentro con Prueba da X si la superas e Y si no la
// superas (fallas, no comprometes a nadie o el Destino dice «Fallas la Prueba»). Y = mitad de X hacia arriba (Albert eligió
// la variante c el 19 de octubre de 2026): 1 / 1, 2 / 1, 3 / 2, 4 / 2.

import { describe, expect, it } from 'vitest'
import { DATOS } from './datos.ts'
import { avanceSinSuperar, reglasDe } from './definiciones.ts'
import { nuevaPartida } from './preparacion.ts'
import { Jugador, MISIONES_DE_PRUEBA } from './pruebas/situacion.ts'
import type { Estado } from './tipos.ts'

const { mar5, ciu4 } = MISIONES_DE_PRUEBA

// «Arrecife de los Colorados» (Mar, NAV 4, Avance 3 / 2). El Destino sale de «Chubasco»: «Sin novedad», +0, sin efectos.
function arrecife(op: Parameters<typeof Jugador.enMision>[0] = {}) {
  return Jugador.enMision({ misiones: [mar5], tripulacion: ['viejo_lobo'], mazoPeligros: ['p2_arrecife', 'chubasco', 'calma', 'calma'], ...op })
}

describe('Avance X / Y', () => {
  it('si superas la Prueba, ganas X: «Arrecife de los Colorados» da 3', () => {
    // Viejo lobo (NAV 3) + Diego (NAV 2) + el Barco (+1 en el Mar) = 6 contra 4.
    const j = arrecife().comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.registro).toContain('Ganas 3 de Avance (3/5).')
  })

  it('si no comprometes a nadie, no la superas: ganas Y (2)', () => {
    const j = arrecife().comprometer('NAV').seguir()
    expect(j.registro).toContain('Ganas 2 de Avance (2/5).')
  })

  it('si la fallas, ganas Y (2)', () => {
    // El Rufián de cubierta (NAV 0) + el Barco (+1) = 1 contra 4: la falla.
    const j = Jugador.enMision({ misiones: [mar5], tripulacion: ['marinero_p'], mazoPeligros: ['p2_arrecife', 'chubasco', 'calma', 'calma'] })
    j.comprometer('NAV', ['marinero_p']).seguir()
    expect(j.registro.some((r) => r.includes('fallas la Prueba'))).toBe(true)
    expect(j.registro).toContain('Ganas 2 de Avance (2/5).')
  })

  it('un Destino «Fallas la Prueba» cuenta como no superada: «El Holandés errante» en el Mar da Y', () => {
    const j = Jugador.enMision({ misiones: [mar5], tripulacion: ['viejo_lobo'], mazoPeligros: ['p2_arrecife', 'p2_holandes', 'calma', 'calma'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.registro).toContain('Ganas 2 de Avance (2/5).')
  })

  it('en un «Elige», pagar en vez de hacer la Prueba cuenta como superada: «Carestía» (fase 11: 1 / 1) da 1', () => {
    const paga = Jugador.enMision({ misiones: [ciu4], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['p2_hambre', 'chubasco', 'calma'] })
    paga.opcion('0').elegir('ojo', 'timon')
    expect(paga.registro).toContain('Ganas 1 de Avance (1/4).')
    // Si regateas y no superas la Prueba (nadie asignado), ganas Y, que en Carestía también es 1.
    const regatea = Jugador.enMision({ misiones: [ciu4], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['p2_hambre', 'chubasco', 'calma'] })
    regatea.opcion('1').comprometer('EXP').seguir()
    expect(regatea.registro).toContain('Ganas 1 de Avance (1/4).')
  })

  it('lo que la misión da de más al superar una Prueba se suma a X («La goleta del correo»: +1 por cada Prueba de NAV superada)', () => {
    const supera = arrecife({ misiones: ['espia-III'] }).comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(supera.registro.some((r) => r.startsWith('Ganas 4 de Avance'))).toBe(true)
    const nadie = arrecife({ misiones: ['espia-III'] }).comprometer('NAV').seguir()
    expect(nadie.registro.some((r) => r.startsWith('Ganas 2 de Avance'))).toBe(true)
  })

  it('la mesa ve los dos valores antes de decidir: «Si la superas: +3 · Si no la superas: +2»', async () => {
    const { avancePrevisto } = await import('./tareas/encuentro.ts')
    const j = arrecife()
    expect(avancePrevisto(j.estado, 'NAV')).toEqual({ siSuperas: 3, siNo: 2 })
    const goleta = arrecife({ misiones: ['espia-III'] })
    expect(avancePrevisto(goleta.estado, 'NAV')).toEqual({ siSuperas: 4, siNo: 2 })
  })
})

describe('Avance X / Y: los datos de las cartas', () => {
  it('fase 11 · todo encuentro con Prueba en juego lleva 1 / 1 (dificultad 3 o menos), 2 / 1, 3 / 1 o 3 / 2; los demás, un solo valor de 0 a 2', () => {
    const encuentros = [
      ...DATOS.peligros.filter((c) => !c.retirada).flatMap((c) => (['mar', 'nat', 'ciu'] as const).map((e) => ({ id: c.id, e, enc: c.encuentros[e] }))),
      ...DATOS.cartasDeMazoPropio.map((c) => ({ id: c.id, e: 'unico' as const, enc: c.encuentro })),
    ]
    let conDos = 0
    for (const { id, e, enc } of encuentros) {
      const pone = reglasDe(id)?.encuentros?.[e]?.pone
      if (enc.prueba.length > 0 && !pone) {
        expect(enc.avanceSinSuperar, `${id} (${e})`).toBeDefined()
        expect(enc.avanceSinSuperar ?? -1, `${id} (${e})`).toBeGreaterThanOrEqual(0)
        expect(['1/1', '2/1', '3/1', '3/2'], `${id} (${e})`).toContain(`${enc.avance}/${enc.avanceSinSuperar}`)
        // Fase 11 (decisión de Albert): las Pruebas de dificultad 3 o menos dan 1 / 1 (la «X» variable no cuenta).
        const facil = enc.prueba.every((p) => p.dificultad <= 3 && !p.variable)
        expect(enc.avance === 1 && enc.avanceSinSuperar === 1, `${id} (${e})`).toBe(facil)
        conDos++
      } else {
        expect(enc.avanceSinSuperar, `${id} (${e})`).toBeUndefined()
        expect([0, 1, 2], `${id} (${e})`).toContain(enc.avance)
      }
    }
    expect(conDos).toBe(154)
  })
})

describe('Avance X / Y: variantes solo para simular', () => {
  const def = { avance: 3, avanceSinSuperar: 2 }
  const con = (variante?: NonNullable<Estado['variante']>['avanceSinSuperar']): Estado => nuevaPartida({ semilla: 1, ...(variante ? { variante: { avanceSinSuperar: variante } } : {}) })

  it('la regla del juego usa el valor de la carta; sin él, la mitad hacia arriba (1/1, 2/1, 3/2, 4/2)', () => {
    expect(avanceSinSuperar(con(), def)).toBe(2)
    expect([1, 2, 3, 4].map((avance) => avanceSinSuperar(con(), { avance }))).toEqual([1, 1, 2, 2])
    expect(avanceSinSuperar(con(), { avance: 0 })).toBe(0)
  })

  it('«mitad hacia abajo» (la regla anterior) da 1/0, 2/1, 3/1, 4/2', () => {
    expect([1, 2, 3, 4].map((avance) => avanceSinSuperar(con('mitadAbajo'), { avance }))).toEqual([0, 1, 1, 2])
  })

  it('«como estaba» da el Avance entero', () => {
    expect(avanceSinSuperar(con('entero'), def)).toBe(3)
  })

  it('una partida normal no lleva variante', () => {
    expect(con().variante).toBeUndefined()
  })
})
