// Toda decisión que puede pedir el motor tiene su texto en español.

import { describe, expect, it } from 'vitest'
import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { mazoDeMuelleAlAzar } from '../../engine/pruebas/equilibrio.ts'
import { jugadorAlAzar, jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { sucesoDe, textoDecision, textoPlano, textoUso } from './decisiones.ts'

describe('Textos de las decisiones', () => {
  it('ninguna decisión de muchas partidas automáticas se queda sin texto', { timeout: 180_000 }, () => {
    const vistas = new Set<string>()
    for (let i = 0; i < 120; i++) {
      const semilla = 9000 + i
      const jugador = i % 2 === 0 ? jugadorAlAzar(semilla) : jugadorConCriterio()
      let s = nuevaPartida({ semilla, mazoDeMuelle: mazoDeMuelleAlAzar(semilla) })
      for (let n = 0; !s.resultado && n < 8000; n++) {
        const d = s.pendiente!
        const t = textoDecision(s, d)
        expect(t.desconocida, `sin texto: ${d.motivo.clave}`).toBeUndefined()
        expect(t.titulo.length).toBeGreaterThan(0)
        vistas.add(d.motivo.clave)
        if (d.tipo === 'ofrecer') {
          expect(sucesoDe(s, d)).not.toBeNull()
          for (const u of d.usos) expect(textoUso(s, u).texto.length).toBeGreaterThan(0)
        }
        s = responder(s, jugador(s, d))
      }
    }
    expect(vistas.size).toBeGreaterThan(30)
  })

  it('el texto de una carta se lee sin marcado', () => {
    expect(textoPlano('reparacion')).toBe('Repara 2 daño.')
    expect(textoPlano('vela')).toBe('Al zarpar hacia una misión de Mar: Gana 1 Avance.')
    expect(textoPlano('chalupa')).toBe('Al zarpar hacia una misión de Naturaleza o de Ciudad: Gana 1 Avance.')
    expect(textoPlano('bandera')).toBe('Tus Pruebas de NAV en el Mar reciben +1.'.replace('NAV', 'COM'))
  })
})
