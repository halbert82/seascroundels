// Toda decisión que puede pedir el motor tiene su texto en español.

import { describe, expect, it } from 'vitest'
import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { mazoDeMuelleAlAzar } from '../../engine/pruebas/equilibrio.ts'
import { jugadorAlAzar, jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { Jugador } from '../../engine/pruebas/situacion.ts'
import { loQuePierdesAlRetirarte, sucesoDe, textoDecision, textoPlano, textoUso } from './decisiones.ts'

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

  it('P119: tras un encuentro de la regata, la ayuda avisa de que retirarse la aparta; en otra misión, solo se pierde el Avance', () => {
    const enMision = (mision: string) => {
      const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma', 'pruebas-calma'], misiones: [mision], mazoPeligros: ['calma', 'calma', 'calma', 'calma'] })
      j.zarpar(mision)
      return j
    }
    const regata = enMision('regata-I')
    expect(regata.decision.motivo.clave).toBe('trasEncuentro')
    expect(textoDecision(regata.estado, regata.decision).ayuda).toBe('Sigue con la misión revelando otra carta, o retírate a puerto (pierdes el Avance y la misión se aparta).')
    expect(loQuePierdesAlRetirarte(enMision('vanhoorn-I').estado)).toBe('pierdes el Avance y la misión se aparta')
    expect(loQuePierdesAlRetirarte(enMision('pruebas-mar5').estado)).toBe('pierdes el Avance')
  })

  it('el texto de una carta se lee sin marcado', () => {
    expect(textoPlano('reparacion')).toBe('Repara 2 daño.')
    // Fase 13 (P82): el Entorno delante del efecto se lee sin artículo.
    expect(textoPlano('vela')).toBe('Al zarpar: Mar: Gana 1 Avance.')
    expect(textoPlano('chalupa')).toBe('Al zarpar: Naturaleza / Ciudad: Gana 1 Avance.')
    expect(textoPlano('bandera')).toBe('Mar: Tus Pruebas de COM reciben +1.')
    expect(textoPlano('bronce')).toBe('Mar, agotar: Una Prueba de COM recibe +2.')
    expect(textoPlano('viento')).toBe('Respuesta: Mar: Después de que reveles una carta de Peligro, gana 2 Avance.')
  })
})
