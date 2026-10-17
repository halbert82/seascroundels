// Prueba masiva: partidas enteras con un jugador que elige al azar entre las opciones legales.
// Comprueba los invariantes en cada paso, que toda partida termina como muy tarde en el turno 12
// y que la misma semilla da exactamente la misma partida.

import { describe, expect, it } from 'vitest'
import { aleatorio, barajarLista, entero, sembrar } from './azar.ts'
import { responder } from './motor.ts'
import { nuevaPartida } from './preparacion.ts'
import { comprobarInvariantes } from './pruebas/situacion.ts'
import type { Decision, Eleccion, Estado, InstId } from './tipos.ts'

const PARTIDAS = 200
const MAXIMO_RESPUESTAS = 3000

/** Elige al azar una respuesta legal a la decisión. */
function eleccionAlAzar(azar: { azar: [number, number, number, number] }, d: Decision): Eleccion {
  if (d.libres && d.libres.length > 0 && aleatorio(azar) < 0.2) {
    return { tipo: 'usar', uso: d.libres[entero(azar, d.libres.length)]! }
  }
  switch (d.tipo) {
    case 'ventanaAccion': {
      // Terminar el paso de vez en cuando para que la partida avance.
      const terminar = d.acciones.find((a) => a.tipo === 'terminarPaso')
      if (terminar && aleatorio(azar) < 0.35) return { tipo: 'accion', accion: terminar }
      return { tipo: 'accion', accion: d.acciones[entero(azar, d.acciones.length)]! }
    }
    case 'elegirCartas': {
      const n = d.min + entero(azar, d.max - d.min + 1)
      const ids = [...d.candidatas]
      barajarLista(azar, ids)
      return { tipo: 'cartas', ids: ids.slice(0, n) }
    }
    case 'elegirOpcion':
      return { tipo: 'opcion', clave: d.opciones[entero(azar, d.opciones.length)]!.clave }
    case 'ofrecer':
      return aleatorio(azar) < 0.5 || d.usos.length === 0 ? { tipo: 'pasar' } : { tipo: 'usar', uso: d.usos[0]! }
    case 'repartir': {
      const n: Partial<Record<InstId, number>> = {}
      let resto = d.cantidad
      const destinos = Object.keys(d.maximos) as InstId[]
      barajarLista(azar, destinos)
      for (const inst of destinos) {
        const poner = Math.min(resto, d.maximos[inst] ?? 0)
        n[inst] = poner
        resto -= poner
      }
      return { tipo: 'reparto', n }
    }
  }
}

function jugarPartida(semilla: number): { final: Estado; respuestas: number } {
  let s = nuevaPartida({ semilla })
  const azar = { azar: sembrar(`jugador-${semilla}`) }
  let respuestas = 0
  while (!s.resultado && respuestas < MAXIMO_RESPUESTAS) {
    if (!s.pendiente) throw new Error('Partida parada sin decisión')
    s = responder(s, eleccionAlAzar(azar, s.pendiente))
    comprobarInvariantes(s, { json: false })
    respuestas++
  }
  comprobarInvariantes(s)
  return { final: s, respuestas }
}

describe(`Prueba masiva: ${PARTIDAS} partidas al azar`, () => {
  it('cumplen los invariantes y terminan como muy tarde en el turno 12', { timeout: 120_000 }, () => {
    const motivos = new Map<string, number>()
    for (let semilla = 1; semilla <= PARTIDAS; semilla++) {
      const { final } = jugarPartida(semilla)
      expect(final.resultado, `semilla ${semilla}`).not.toBeNull()
      expect(final.turno, `semilla ${semilla}`).toBeLessThanOrEqual(12)
      const motivo = final.resultado?.motivo ?? ''
      motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1)
    }
    // Sin zarpar (fase 3) no se puede ganar: todas terminan por tiempo o con el Capitán derrotado.
    for (const motivo of motivos.keys()) {
      expect(['Se ha acabado el tiempo: no quedaban cartas de Escenario.', 'Tu Capitán ha quedado derrotado.']).toContain(motivo)
    }
  })

  it('la misma semilla da exactamente la misma partida', { timeout: 30_000 }, () => {
    for (const semilla of [3, 77, 401]) {
      expect(jugarPartida(semilla).final).toEqual(jugarPartida(semilla).final)
    }
  })
})
