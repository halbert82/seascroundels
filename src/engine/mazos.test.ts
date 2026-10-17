import { describe, expect, it } from 'vitest'
import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { erroresDeMazos } from './mazos.ts'

const predefinidos = () => ({
  capitan: DATOS.mazosPredefinidos.capitanInicial,
  mazoDelCapitan: [...DATOS.mazosPredefinidos.mazoDelCapitan],
  mazoDeMuelle: [...DATOS.mazosPredefinidos.mazoDeMuelle],
})

describe('Construir tu mazo', () => {
  it('los mazos de inicio de Diego cumplen las reglas: muelle de 20, capitán de 40', () => {
    const m = predefinidos()
    expect(m.mazoDeMuelle).toHaveLength(20)
    expect(m.mazoDelCapitan).toHaveLength(40)
    expect(erroresDeMazos(m)).toEqual([])
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
})
