import { describe, expect, it } from 'vitest'
import { CATALOGO, codigoColeccion } from './catalogo.ts'
import { DATOS } from './datos.ts'

describe('catálogo de la Caja básica', () => {
  it('tiene una carta por cada número de colección, sin huecos ni repetidos (los Peligros 2.0 siguen desde el 154)', () => {
    const nums = CATALOGO.map((c) => c.num)
    expect(nums).toEqual(Array.from({ length: nums.length }, (_, i) => i + 1))
  })

  it('asigna cada carta de mazo propio a su mazo', () => {
    const templo = CATALOGO.filter((c) => c.tipo === 'mazoPropio' && c.mazo === 'mazo del Templo')
    const escolta = CATALOGO.filter((c) => c.tipo === 'mazoPropio' && c.mazo === 'mazo de la Escolta')
    expect(templo.reduce((n, c) => n + c.copias, 0)).toBe(6)
    expect(escolta.reduce((n, c) => n + c.copias, 0)).toBe(6)
  })

  it('cumple con los mazos predefinidos de la versión 0', () => {
    const m = DATOS.mazosPredefinidos
    expect(m.mazoDelCapitan).toHaveLength(40)
    expect(m.mazoDeMuelle).toHaveLength(20)
    expect(m.capitanInicial).toBe('capitan')
    expect(m.puertoInicial).toBe('tortuga')
    expect(m.modo).toBe('normal')
    const ids = new Set(CATALOGO.map((c) => c.id))
    for (const id of [...m.mazoDelCapitan, ...m.mazoDeMuelle, ...m.mazoDePeligros, ...m.apartadosDePeligros]) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('las recompensas de los capítulos citan cartas que existen', () => {
    for (const entrada of CATALOGO) {
      if (entrada.tipo !== 'capitulo') continue
      const cita = /carta (\d+)/.exec(entrada.carta.textoSiguiente)?.[1]
      if (cita) expect(CATALOGO.some((c) => c.num === Number(cita))).toBe(true)
    }
  })

  it('formatea el número de colección', () => {
    expect(codigoColeccion(7)).toBe('Caja básica · 007')
    expect(codigoColeccion(153)).toBe('Caja básica · 153')
  })
})
