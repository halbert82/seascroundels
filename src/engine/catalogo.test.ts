import { describe, expect, it } from 'vitest'
import { CATALOGO, codigoColeccion } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { tieneReglas } from './definiciones.ts'
import './motor.ts'

describe('catálogo de la Caja básica', () => {
  it('tiene una carta por cada número de colección, sin huecos ni repetidos (los Peligros 2.0 siguen desde el 154)', () => {
    // Fase 12: el 136 («Seguirle por los muelles») y el 148 (el antiguo «A bordo del fantasma») se unieron al capítulo
    // anterior de su travesía. Fase 15: los ocupan «Mala fama» (136) y el «Gallardete de San Juan» (148). Sin huecos.
    const HUECOS: number[] = []
    const nums = CATALOGO.map((c) => c.num)
    const maximo = Math.max(...nums)
    expect(nums).toEqual(Array.from({ length: maximo }, (_, i) => i + 1).filter((n) => !HUECOS.includes(n)))
  })

  it('asigna cada carta de mazo propio a su mazo', () => {
    const templo = CATALOGO.filter((c) => c.tipo === 'mazoPropio' && c.mazo === 'mazo del Templo')
    const escolta = CATALOGO.filter((c) => c.tipo === 'mazoPropio' && c.mazo === 'mazo de la Escolta')
    expect(templo.reduce((n, c) => n + c.copias, 0)).toBe(6)
    expect(escolta.reduce((n, c) => n + c.copias, 0)).toBe(6)
    // Fase 15: los dos barcos rivales son cartas de Peligro de un solo encuentro de su travesía, sin mazo propio.
    const barcos = CATALOGO.flatMap((c) => (c.tipo === 'mazoPropio' && c.carta.mision ? [[c.num, c.mazo]] : []))
    expect(barcos).toEqual([
      [262, 'La carrera de van Hoorn'],
      [266, 'El fugitivo'],
    ])
  })

  it('cumple con los mazos predefinidos de la versión 0', () => {
    const m = DATOS.mazosPredefinidos
    expect(m.mazoDelCapitan).toHaveLength(40)
    expect(m.mazoDeMuelle).toHaveLength(26) // TODO(regla): excepción temporal de la fase 14 (de 15 a 20 en el reglamento)
    expect(m.capitanInicial).toBe('capitan')
    expect(m.puertoInicial).toBe('tortuga')
    expect(m.modo).toBe('normal')
    const ids = new Set(CATALOGO.map((c) => c.id))
    for (const id of [...m.mazoDelCapitan, ...m.mazoDeMuelle, ...m.mazoDePeligros, ...m.apartadosDePeligros]) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('el mazo de Peligros son los Peligros 2.0 (sin los antiguos), uno de cada y todos con sus reglas', () => {
    const mazo = DATOS.mazosPredefinidos.mazoDePeligros
    // Las 55 cartas, «Fiebre amarilla» (rehecha sin Fiebre) incluida, y las 8 de la fase 15 (247–254).
    expect(mazo).toHaveLength(63)
    expect(mazo).toContain('p2_fiebre')
    expect(new Set(mazo).size).toBe(mazo.length)
    for (const id of mazo) {
      const p = DATOS.peligros.find((c) => c.id === id)
      expect(p?.version, id).toBe(2)
      expect(tieneReglas(id), id).toBe(true)
    }
    // Los antiguos se quedan solo para las pruebas.
    expect(DATOS.peligros.filter((c) => c.retirada).every((c) => !mazo.includes(c.id))).toBe(true)
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
