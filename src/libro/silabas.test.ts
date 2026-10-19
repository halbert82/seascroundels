// Dónde se pueden partir las palabras del reglamento (lo mismo en cualquier navegador).

import { describe, expect, it } from 'vitest'
import { GUION_BLANDO as G, silabearPalabra, silabearTexto } from './silabas.ts'

describe('Guiones blandos del reglamento', () => {
  it('parte las palabras por sus sílabas, con las reglas del español', () => {
    expect(silabearPalabra('comprometidos')).toBe(`com${G}pro${G}me${G}ti${G}dos`)
    expect(silabearPalabra('Escenario')).toBe(`Es${G}ce${G}na${G}rio`)
  })

  it('deja al menos 2 letras a cada lado del guion y no toca las siglas ni las palabras cortas', () => {
    expect(silabearPalabra('agotó')).toBe(`ago${G}tó`)
    // «a-ba-tir»: la «a» sola del principio no se separa.
    expect(silabearPalabra('abatir').startsWith(`a${G}`)).toBe(false)
    expect(silabearTexto('NAV 4, mazo, EXP')).toBe('NAV 4, mazo, EXP')
  })

  it('no toca los números, los signos ni los espacios', () => {
    expect(silabearTexto('«Avance 3 / 2»: 3 si la superas.').replace(new RegExp(G, 'g'), '')).toBe('«Avance 3 / 2»: 3 si la superas.')
  })
})
