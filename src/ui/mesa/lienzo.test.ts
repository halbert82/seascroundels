// La mesa llena la pantalla: crece de ancho en las pantallas anchas y de alto en las más cuadradas (una tableta). La
// altura de más va primero a la mano, hasta que sus cartas se ven enteras, y lo que sobra, a las zonas de arriba.

import { describe, expect, it } from 'vitest'
import { medir } from './Lienzo.tsx'
import { ALTO_PARA_MANO_ENTERA, ESCALA_MANO, MARGEN_PIE_MANO, bajadaDelAbanico, pieDeLaMano, repartirAltoDeMas } from './disposicion.ts'

const ALTO_CARTA = 528 * ESCALA_MANO
/** Dónde acaba el panel de decisión (con su alto mínimo), según lo que crecen las zonas de arriba (mesa.css). */
const pieDelPanel = (extraZonas: number) => 622 + 76 + extraZonas

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

describe('La altura de más: primero la mano, después las zonas de arriba', () => {
  it('en escritorio (1440×900 y 1920×1080) no hay altura de más: la mano asoma como siempre (le faltan 40 por abajo)', () => {
    for (const [ancho, alto] of [
      [1440, 900],
      [1920, 1080],
    ] as const) {
      const extra = repartirAltoDeMas(medir(ancho, alto).alto)
      expect(extra).toEqual({ mano: 0, zonas: 0 })
      expect(pieDeLaMano(5, extra.mano)).toBe(-40)
    }
  })

  it('en una tableta (1024×768) las 5 cartas de la mano (el Mando del Capitán) se ven enteras y lo que sobra va a las zonas de arriba', () => {
    const { alto } = medir(1024, 768)
    const extra = repartirAltoDeMas(alto)
    // De los 180 de más, la mano se lleva lo que necesita para verse entera; las zonas, el resto.
    expect(extra.mano).toBe(ALTO_PARA_MANO_ENTERA)
    expect(extra.zonas).toBe(180 - ALTO_PARA_MANO_ENTERA)
    expect(extra.zonas).toBeGreaterThan(0)
    const pie = pieDeLaMano(5, extra.mano)
    // La esquina más baja (las cartas de los extremos bajan y giran) queda por encima del borde, con su margen.
    expect(pie - bajadaDelAbanico(5)).toBeCloseTo(MARGEN_PIE_MANO, 5)
    // Y la carta del centro, la más alta, no tapa el panel de decisión.
    expect(alto - pie - ALTO_CARTA).toBeGreaterThan(pieDelPanel(extra.zonas))
  })

  it('en una tableta, con una mano muy llena (7 u 8 cartas), todas se ven enteras y no tapan el panel', () => {
    const { alto } = medir(1024, 768)
    const extra = repartirAltoDeMas(alto)
    for (const n of [6, 7, 8]) {
      const pie = pieDeLaMano(n, extra.mano)
      expect(pie - bajadaDelAbanico(n)).toBeGreaterThanOrEqual(MARGEN_PIE_MANO - 1)
      expect(alto - pie - ALTO_CARTA).toBeGreaterThan(pieDelPanel(extra.zonas))
    }
  })

  it('en otras tabletas: 1112×834 y 1280×960 igual que 1024×768; 1366×1024, casi; en 1180×820 (100 de más), casi todo para la mano', () => {
    expect(repartirAltoDeMas(medir(1112, 834).alto)).toEqual(repartirAltoDeMas(1080))
    expect(repartirAltoDeMas(medir(1280, 960).alto)).toEqual(repartirAltoDeMas(1080))
    expect(medir(1366, 1024).alto).toBe(1079)
    expect(repartirAltoDeMas(1079)).toEqual({ mano: ALTO_PARA_MANO_ENTERA, zonas: 179 - ALTO_PARA_MANO_ENTERA })
    expect(medir(1180, 820).alto).toBe(1000)
    expect(repartirAltoDeMas(1000)).toEqual({ mano: ALTO_PARA_MANO_ENTERA, zonas: 100 - ALTO_PARA_MANO_ENTERA })
  })

  it('si la altura de más no llega para ver la mano entera, toda va a la mano', () => {
    // 1440×960 (3:2): la mesa mide 1440×960, 60 de más.
    expect(medir(1440, 960).alto).toBe(960)
    expect(repartirAltoDeMas(960)).toEqual({ mano: 60, zonas: 0 })
    // Las cartas suben todo lo que pueden: les faltan 40 con 900 de alto; con 60 de más, sobran 20 al pie.
    expect(pieDeLaMano(5, 60)).toBe(20)
  })
})
