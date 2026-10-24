import { describe, expect, it } from 'vitest'
import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { claseDe, erroresDeMazos, MUELLE_TEMPORAL_FASE14 } from './mazos.ts'

// Las reglas se prueban con el muelle de inicio de siempre (20 cartas, sin los seis Tripulantes de la fase 14).
const predefinidos = () => ({
  capitan: DATOS.mazosPredefinidos.capitanInicial,
  mazoDelCapitan: [...DATOS.mazosPredefinidos.mazoDelCapitan],
  mazoDeMuelle: DATOS.mazosPredefinidos.mazoDeMuelle.slice(0, 20),
})

describe('Construir tu mazo', () => {
  it('los mazos de inicio de Diego cumplen las reglas: muelle de 25 (excepción temporal de la fase 14), capitán de 40', () => {
    // TODO(regla): excepción temporal de la fase 14; quitar cuando se rehagan los mazos de inicio (el reglamento dice de
    // 15 a 20 cartas de muelle; el de inicio lleva 25 para probar los seis Tripulantes nuevos: eran 26 hasta que el
    // Práctico del puerto salió de la caja, en la quinta ronda de la fase 15).
    const m = { ...predefinidos(), mazoDeMuelle: [...DATOS.mazosPredefinidos.mazoDeMuelle] }
    expect(m.mazoDeMuelle).toHaveLength(MUELLE_TEMPORAL_FASE14)
    expect(m.mazoDelCapitan).toHaveLength(40)
    expect(erroresDeMazos(m, { muelleMaximo: MUELLE_TEMPORAL_FASE14 })).toEqual([])
    // Sin la excepción, 25 cartas no valen: la regla sigue siendo de 15 a 20.
    expect(erroresDeMazos(m)).toEqual(['El mazo de muelle tiene 25 cartas; debe tener de 15 a 20.'])
  })

  it('el mazo de muelle debe tener de 15 a 20 cartas y el del capitán de 30 a 40', () => {
    const corto = { ...predefinidos(), mazoDeMuelle: predefinidos().mazoDeMuelle.slice(0, 14) }
    expect(erroresDeMazos(corto)).toEqual(['El mazo de muelle tiene 14 cartas; debe tener de 15 a 20.'])
    const largo = { ...predefinidos(), mazoDelCapitan: [...predefinidos().mazoDelCapitan, 'estrellas'] }
    expect(erroresDeMazos(largo)).toContain('El mazo del capitán tiene 41 cartas; debe tener de 30 a 40.')
  })

  it('como máximo 3 copias de cada carta por su nombre, y 1 de cada carta única', () => {
    const m = predefinidos()
    // Cuatro Bucaneros y dos Isabelas en lugar de las primeras cartas del muelle de inicio.
    m.mazoDeMuelle = m.mazoDeMuelle.filter((c) => c !== 'bucanero' && c !== 'isabela')
    m.mazoDeMuelle.splice(0, 6, 'bucanero', 'bucanero', 'bucanero', 'bucanero', 'isabela', 'isabela')
    expect(erroresDeMazos(m)).toEqual(
      expect.arrayContaining(['Hay 4 copias de «Bucanero veterano»; el máximo es 3.', 'Hay 2 copias de «Isabela «Cuervo» Saldaña»; el máximo es 1.']),
    )
  })

  it('cada carta va en su mazo: Tripulantes y Mejoras en el de muelle; Eventos y Habilidades en el del capitán', () => {
    const m = predefinidos()
    m.mazoDeMuelle[0] = 'ojo'
    m.mazoDelCapitan[0] = 'sable'
    expect(erroresDeMazos(m)).toEqual([
      '«Ojo avizor» no puede ir en el mazo de muelle (solo Tripulantes y Mejoras).',
      '«Sable de abordaje» no puede ir en el mazo del capitán (solo Eventos y Habilidades).',
    ])
  })

  it('los mazos de inicio no usan más copias de las que trae la caja', () => {
    const m = predefinidos()
    for (const entrada of CATALOGO) {
      const usadas = [...m.mazoDeMuelle, ...m.mazoDelCapitan].filter((id) => id === entrada.id).length
      expect(usadas, entrada.id).toBeLessThanOrEqual(entrada.copias)
    }
  })
  it('fase 11 · toda carta de jugador tiene Clase en los datos (Piratería o Neutral, explícita); los Tesoros no', () => {
    const DE_JUGADOR = new Set(['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'])
    for (const e of CATALOGO) {
      if (!DE_JUGADOR.has(e.tipo)) continue
      expect('senda' in e.carta && ['Piratería', 'Neutral'].includes(String(e.carta.senda)), `${e.num} ${e.id}`).toBe(true)
    }
    for (const t of DATOS.tesoros) expect('senda' in t, t.id).toBe(false)
    // Las de Piratería que Albert enumeró (todas las demás Mejoras, Eventos y Habilidades son Neutrales).
    const pirateria = CATALOGO.filter((e) => ['mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'].includes(e.tipo) && claseDe(e.id) === 'Piratería').map((e) => e.num)
    expect(pirateria).toEqual([24, 29, 30, 32, 37, 40, 41, 43, 48, 51, 57, 58, 60, 66, 69, 171, 172, 173])
    // Los dos Capitanes son de Piratería: sus mazos de inicio siguen siendo legales.
    expect(DATOS.capitanes.map((c) => c.senda)).toEqual(['Piratería', 'Piratería'])
  })

  it('fase 11 · un Capitán solo puede usar cartas de su Clase y Neutrales (también Mejoras, Eventos y Habilidades)', () => {
    // Con un Capitán Neutral (supuesto), la Bandera negra, «¡A por ellos!» y «¡Al abordaje!» no valdrían.
    const m = predefinidos()
    expect(erroresDeMazos(m)).toEqual([])
    const neutral = DATOS.capitanes[0]
    if (!neutral) throw new Error('sin Capitán')
    const antes = neutral.senda
    neutral.senda = 'Neutral'
    try {
      m.mazoDeMuelle[0] = 'bandera'
      expect(erroresDeMazos(m)).toEqual(
        expect.arrayContaining([
          '«Bandera negra» es de la Clase Piratería y tu Capitán es de Neutral.',
          '«¡A por ellos!» es de la Clase Piratería y tu Capitán es de Neutral.',
          '«¡Al abordaje!» es de la Clase Piratería y tu Capitán es de Neutral.',
        ]),
      )
    } finally {
      neutral.senda = antes
    }
  })
})
