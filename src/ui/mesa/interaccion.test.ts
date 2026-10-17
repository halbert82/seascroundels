// La mesa solo ofrece lo que el motor permite: cada acción de cada carta, en partidas reales, es una elección válida.

import { describe, expect, it } from 'vitest'
import { deserializar, serializar } from '../../engine/guardado.ts'
import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { mazoDeMuelleAlAzar } from '../../engine/pruebas/equilibrio.ts'
import { jugadorAlAzar, jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { eleccionConfirmada, interaccion, seleccionVacia } from './interaccion.ts'

describe('Interacción de la mesa', () => {
  it('toda acción ofrecida en una carta la acepta el motor', { timeout: 240_000 }, () => {
    let probadas = 0
    for (let i = 0; i < 16; i++) {
      const semilla = 7000 + i
      const jugador = i % 2 === 0 ? jugadorConCriterio() : jugadorAlAzar(semilla)
      let s = nuevaPartida({ semilla, mazoDeMuelle: mazoDeMuelleAlAzar(semilla) })
      for (let n = 0; !s.resultado && n < 8000; n++) {
        const d = s.pendiente!
        const inter = interaccion(s, d, seleccionVacia(d))
        for (const opciones of inter.opciones.values()) {
          for (const o of opciones) {
            if (!o.eleccion) continue
            expect(() => responder(s, o.eleccion!), `${d.motivo.clave}: ${o.etiqueta}`).not.toThrow()
            probadas++
          }
        }
        // Lo que se confirma con la selección vacía también vale (si la decisión lo permite).
        const confirmada = eleccionConfirmada(s, d, seleccionVacia(d))
        if (confirmada && d.tipo !== 'cubrirDistancia') expect(() => responder(s, confirmada)).not.toThrow()
        s = responder(s, jugador(s, d))
      }
    }
    expect(probadas).toBeGreaterThan(1000)
  })

  it('el guardado se recupera tal cual', () => {
    const jugador = jugadorConCriterio()
    let s = nuevaPartida({ semilla: 3 })
    for (let n = 0; n < 60; n++) s = responder(s, jugador(s, s.pendiente!))
    expect(deserializar(serializar(s))).toEqual(s)
  })
})
