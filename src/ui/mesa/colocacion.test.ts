// La carta ampliada se pone pegada a la carta original, dentro de la mesa y sin taparla.

import { describe, expect, it } from 'vitest'
import { colocarAmpliacion, type Caja, type Colocacion, type PeticionColocacion } from './colocacion.ts'

const MESA: Caja = { x: 0, y: 0, ancho: 1440, alto: 900 }
const CARTA = { ancho: 348, alto: 486 }
const UNA = { ancho: 292, alto: 300 }
const DOS = { ancho: 596, alto: 240 }

function colocar(original: Caja, extra: Partial<PeticionColocacion> = {}): Colocacion {
  return colocarAmpliacion({ original, carta: CARTA, limites: MESA, ...extra })
}

function cajas(r: Colocacion, ayudas: PeticionColocacion['ayudas']): Caja[] {
  const lista: Caja[] = [{ ...r.carta, ...CARTA }]
  if (r.ayudas && ayudas) lista.push({ x: r.ayudas.x, y: r.ayudas.y, ...(r.ayudas.columnas === 2 && ayudas.dos ? ayudas.dos : ayudas.una) })
  return lista
}

const cruza = (a: Caja, b: Caja) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto
const dentro = (c: Caja, margen = 8) => c.x >= margen - 0.5 && c.y >= margen - 0.5 && c.x + c.ancho <= MESA.ancho - margen + 0.5 && c.y + c.alto <= MESA.alto - margen + 0.5

describe('Colocación de la carta ampliada', () => {
  it('un Tripulante arriba a la izquierda: a su derecha, a su altura, con las explicaciones más a la derecha', () => {
    const original = { x: 28, y: 110, ancho: 120, alto: 168 }
    const r = colocar(original, { ayudas: { una: UNA } })
    expect(r.lado).toBe('derecha')
    expect(r.carta).toEqual({ x: 28 + 120 + 12, y: 110 })
    expect(r.ayudas).toEqual({ x: 160 + 348 + 12, y: 110, columnas: 1 })
    expect(r.tapa).toBe(false)
  })

  it('una carta del borde derecho: a su izquierda, con las explicaciones más a la izquierda', () => {
    const r = colocar({ x: 1190, y: 120, ancho: 80, alto: 112 }, { ayudas: { una: UNA } })
    expect(r.lado).toBe('izquierda')
    expect(r.carta.x).toBe(1190 - 12 - 348)
    expect(r.ayudas?.x).toBe(1190 - 12 - 348 - 12 - 292)
  })

  it('si a dos columnas no caben las explicaciones, van a una', () => {
    // A la derecha: 532 + 348 + 12 + 596 = 1488 > 1432; a la izquierda no cabe ni la carta.
    const r = colocar({ x: 400, y: 100, ancho: 120, alto: 168 }, { ayudas: { una: UNA, dos: DOS } })
    expect(r.lado).toBe('derecha')
    expect(r.ayudas?.columnas).toBe(1)
  })

  it('a dos columnas cuando caben', () => {
    const r = colocar({ x: 28, y: 110, ancho: 120, alto: 168 }, { ayudas: { una: UNA, dos: DOS } })
    expect(r.ayudas).toEqual({ x: 520, y: 110, columnas: 2 })
  })

  it('si a su altura se saldría por abajo, centrada con la carta', () => {
    const r = colocar({ x: 28, y: 500, ancho: 120, alto: 280 })
    expect(r.carta.y).toBe(500 + 140 - 243)
  })

  it('si tampoco centrada cabe, sube lo justo para quedar dentro', () => {
    const r = colocar({ x: 28, y: 700, ancho: 120, alto: 100 })
    expect(r.carta.y).toBe(900 - 8 - 486)
  })

  it('una carta de la mano en el centro: de lado; si las explicaciones no caben al lado, encima de la ampliación', () => {
    const original = { x: 645, y: 700, ancho: 151, alto: 211 }
    const r = colocar(original, { ayudas: { una: { ancho: 292, alto: 200 } } })
    expect(r.lado).toBe('derecha')
    expect(r.carta).toEqual({ x: 645 + 151 + 12, y: 406 })
    expect(r.ayudas).toEqual({ x: 808, y: 406 - 12 - 200, columnas: 1 })
    expect(r.tapa).toBe(false)
  })

  it('si no cabe a ningún lado, encima o debajo (donde haya más sitio), alineada con su borde izquierdo', () => {
    const r = colocar({ x: 300, y: 600, ancho: 840, alto: 100 })
    expect(r.lado).toBe('arriba')
    expect(r.carta).toEqual({ x: 300, y: 600 - 12 - 486 })
    const abajo = colocar({ x: 300, y: 20, ancho: 840, alto: 100 })
    expect(abajo.lado).toBe('abajo')
    expect(abajo.carta).toEqual({ x: 300, y: 132 })
  })

  it('encima o debajo, centrada con la carta si alineada a su borde izquierdo se saldría', () => {
    const r = colocar({ x: 1180, y: 600, ancho: 240, alto: 100 }, { limites: { x: 0, y: 0, ancho: 1440, alto: 900 }, carta: { ancho: 1200, alto: 300 } })
    expect(r.lado).toBe('arriba')
    // Alineada a la izquierda se saldría; centrada (1300 − 600 = 700) también: se desplaza lo justo.
    expect(r.carta.x).toBe(1432 - 1200)
  })

  it('un Peligro en el centro con muchas explicaciones: la ampliación a un lado y las explicaciones al otro, sin taparlo', () => {
    // A una columna no caben de alto; a dos no caben junto a la ampliación por ningún lado.
    const original = { x: 560, y: 219, ancho: 188, alto: 262 }
    const r = colocar(original, { ayudas: { una: { ancho: 292, alto: 1000 }, dos: { ancho: 596, alto: 520 } } })
    expect(r.tapa).toBe(false)
    expect(r.lado).toBe('izquierda')
    expect(r.carta.x).toBe(560 - 12 - 348)
    expect(r.ayudas).toEqual({ x: 560 + 188 + 12, y: 219, columnas: 2 })
  })

  it('si no hay sitio libre en ningún lado, la tapa lo menos posible, pero nunca se sale de la mesa', () => {
    const ayudas = { una: UNA }
    const r = colocar({ x: 100, y: 100, ancho: 1240, alto: 700 }, { ayudas })
    expect(r.tapa).toBe(true)
    for (const c of cajas(r, ayudas)) expect(dentro(c)).toBe(true)
  })

  it('en cualquier sitio de la mesa: dentro de lo visible, sin pisar sus explicaciones y sin tapar la carta si cabe', () => {
    let semilla = 7
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647
      return semilla / 2147483647
    }
    for (let i = 0; i < 2000; i++) {
      const ancho = 40 + azar() * 200
      const alto = ancho * (azar() < 0.5 ? 1.4 : 0.7)
      const original = { x: azar() * (1440 - ancho), y: azar() * (900 - alto), ancho, alto }
      const ayudas = azar() < 0.3 ? null : { una: { ancho: 292, alto: 100 + azar() * 400 }, ...(azar() < 0.5 ? { dos: { ancho: 596, alto: 80 + azar() * 250 } } : {}) }
      const r = colocar(original, { ayudas })
      const lista = cajas(r, ayudas)
      for (const c of lista) expect(dentro(c), JSON.stringify({ original, ayudas, r })).toBe(true)
      if (lista[1]) expect(cruza(lista[0] as Caja, lista[1])).toBe(false)
      // Sin explicaciones y con una carta pequeña siempre hay algún lado libre.
      if (!ayudas && ancho < 150) expect(r.tapa, JSON.stringify({ original, r })).toBe(false)
    }
  })

  it('con la mesa ancha (1920×1080 → 1600 de ancho), la misma regla', () => {
    const r = colocarAmpliacion({ original: { x: 1500, y: 700, ancho: 80, alto: 112 }, carta: CARTA, limites: { x: 0, y: 0, ancho: 1600, alto: 900 } })
    expect(r.lado).toBe('izquierda')
    expect(r.carta.x).toBe(1500 - 12 - 348)
    expect(r.carta.y).toBe(900 - 8 - 486)
  })
})
