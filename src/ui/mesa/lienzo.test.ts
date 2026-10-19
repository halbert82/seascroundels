// La mesa llena la pantalla: crece de ancho en las pantallas anchas y de alto en las más cuadradas (una tableta).

import { describe, expect, it } from 'vitest'
import { medir } from './Lienzo.tsx'

describe('Tamaño de la mesa según la pantalla', () => {
  it('en 1440×900 mide 1440×900, sin escalar', () => {
    expect(medir(1440, 900)).toEqual({ ancho: 1440, alto: 900, escala: 1 })
  })

  it('en 1920×1080 se ensancha (1600×900) y se escala 1,2: sin bandas a los lados', () => {
    expect(medir(1920, 1080)).toEqual({ ancho: 1600, alto: 900, escala: 1.2 })
  })

  it('en una tableta (1024×768) crece de alto (1440×1080) y ocupa toda la pantalla: sin bandas arriba ni abajo', () => {
    const m = medir(1024, 768)
    expect(m).toMatchObject({ ancho: 1440, alto: 1080 })
    expect(m.ancho * m.escala).toBeCloseTo(1024, 0)
    expect(m.alto * m.escala).toBeCloseTo(768, 0)
  })

  it('en una pantalla en vertical no crece sin fin: como mucho 1200 de alto', () => {
    expect(medir(768, 1024).alto).toBe(1200)
  })
})
