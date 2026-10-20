import { describe, expect, it } from 'vitest'
import { CATALOGO, codigoColeccion } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { tieneReglas } from './definiciones.ts'
import './motor.ts'

describe('catálogo de la Caja básica', () => {
  it('tiene una carta por cada número de colección, sin huecos ni repetidos (los Peligros 2.0 siguen desde el 154)', () => {
    // Fase 12: el 136 («Seguirle por los muelles») y el 148 (el antiguo «A bordo del fantasma») se unieron al capítulo
    // anterior de su travesía. Sus números quedan libres: son los dos únicos huecos.
    const HUECOS = [136, 148]
    const nums = CATALOGO.map((c) => c.num)
    const maximo = Math.max(...nums)
    expect(nums).toEqual(Array.from({ length: maximo }, (_, i) => i + 1).filter((n) => !HUECOS.includes(n)))
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

  it('el mazo de Peligros son los Peligros 2.0 (sin los antiguos), uno de cada y todos con sus reglas', () => {
    const mazo = DATOS.mazosPredefinidos.mazoDePeligros
    // Las 55 cartas, «Fiebre amarilla» (rehecha sin Fiebre) incluida.
    expect(mazo).toHaveLength(55)
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
