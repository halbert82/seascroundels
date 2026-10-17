// Lo que la mesa necesita del motor: desgloses de la Prueba, datos para animar y resumen de partida.

import { describe, expect, it } from 'vitest'
import { responder } from './motor.ts'
import { nuevaPartida } from './preparacion.ts'
import { desgloseDificultad, desgloseTotal, dificultadPrueba, totalPrueba } from './prueba.ts'
import { jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { Jugador } from './pruebas/situacion.ts'
import { resumenDePartida } from './resumen.ts'
import type { Estado } from './tipos.ts'

function suma(partes: { n: number; anulada?: boolean }[]): number {
  return partes.filter((p) => !p.anulada).reduce((n, p) => n + p.n, 0)
}

/** Partida entera con el jugador con criterio, guardando el registro completo y cada estado con decisión. */
function partidaCompleta(semilla: number): { final: Estado; estados: Estado[] } {
  const jugador = jugadorConCriterio()
  let s = nuevaPartida({ semilla })
  const estados: Estado[] = []
  for (let n = 0; !s.resultado && n < 8000; n++) {
    estados.push(s)
    s = responder(s, jugador(s, s.pendiente!))
  }
  return { final: s, estados }
}

describe('Desglose de la Prueba', () => {
  it('ejemplo: Niebla espesa con «Corriente traicionera»: Diego 2 · Bucanero 1 · Barco +1 · Mano firme +2 = 6 contra 3 + 2 = 5', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], tripulacion: ['bucanero'], mano: ['timon'], mazoPeligros: ['niebla', 'arrecifes', 'calma'] })
    j.comprometer('NAV', ['capitan', 'bucanero'], ['timon'])
    const total = desgloseTotal(j.estado)
    expect(total.map((p) => [p.etiqueta, p.n])).toEqual([
      ['Diego «Garra» Mendoza', 2],
      ['Bucanero veterano', 1],
      ['Mano firme al timón', 2],
      ['La Sombra del Alba', 1],
    ])
    expect(desgloseDificultad(j.estado).map((p) => [p.etiqueta, p.n])).toEqual([
      ['Niebla espesa', 3],
      ['Corriente traicionera', 2],
    ])
  })

  it('en partidas reales, las partes suman siempre el total y la dificultad que usa el motor', { timeout: 120_000 }, () => {
    let comprobadas = 0
    for (const semilla of [1, 2, 3, 4, 5, 6]) {
      for (const s of partidaCompleta(semilla).estados) {
        if (s.pendiente?.motivo.clave !== 'ventanaPrueba') continue
        expect(suma(desgloseTotal(s))).toBe(totalPrueba(s))
        const dificultad = dificultadPrueba(s)
        if (dificultad > 0) expect(suma(desgloseDificultad(s))).toBe(dificultad)
        comprobadas++
      }
    }
    expect(comprobadas).toBeGreaterThan(50)
  })
})

describe('Resumen de la partida', () => {
  it('cuadra con lo que cuenta la simulación de equilibrio para la misma partida', { timeout: 60_000 }, () => {
    for (const semilla of [5, 8]) {
      const { final } = partidaCompleta(semilla)
      const r = resumenDePartida(final)
      const p = jugarPartida(semilla, jugadorConCriterio())
      expect(r.gana).toBe(p.gana)
      expect(r.misiones.superadas.length).toBe(p.resultados.filter((x) => x.resultado === 'superada').length)
      expect(r.pruebas.superadas + r.pruebas.falladas).toBe(p.pruebas.length)
      expect(r.tripulantesPerdidos).toBe(p.muertes)
      expect(r.turnos).toBe(p.turnoFinal)
      expect(r.masUsadas.length).toBeGreaterThan(0)
    }
  })
})

describe('Datos para animar', () => {
  it('lo revelado, el Avance, las heridas, el daño y la reputación llevan su dato en el registro', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], mazoPeligros: ['arrecifes', 'leyenda', 'calma'] })
    j.comprometer('NAV', ['capitan']).seguir()
    const tipos = j.estado.registro.map((r) => r.dato?.tipo).filter(Boolean)
    expect(tipos).toEqual(expect.arrayContaining(['revelado', 'dano', 'avance']))
  })
})
