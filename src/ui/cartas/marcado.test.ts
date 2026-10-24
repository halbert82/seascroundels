import { describe, expect, it } from 'vitest'
import { esIcono, parsearFichas, parsearNumero, parsearTexto } from './marcado.ts'
import { CATALOGO } from '../../engine/catalogo.ts'
import { textosDeLaCarta } from './vista.ts'

describe('marcado de los textos', () => {
  it('interpreta el texto de Diego con números de habilidad', () => {
    const s = parsearTexto(
      'Mientras Diego «Garra» Mendoza esté preparado, tus demás Tripulantes reciben {+1 NAV}, {+1 COM} y {+1 EXP}.',
    )
    expect(s).toEqual([
      { tipo: 'texto', texto: 'Mientras Diego «Garra» Mendoza esté preparado, tus demás Tripulantes reciben ', negrita: false },
      { tipo: 'numero', valor: '+1', icono: 'NAV', color: 'verde' },
      { tipo: 'texto', texto: ', ', negrita: false },
      { tipo: 'numero', valor: '+1', icono: 'COM', color: 'verde' },
      { tipo: 'texto', texto: ' y ', negrita: false },
      { tipo: 'numero', valor: '+1', icono: 'EXP', color: 'verde' },
      { tipo: 'texto', texto: '.', negrita: false },
    ])
  })

  it('colorea los números según su signo o su marca', () => {
    expect(parsearNumero('2 dano g').color).toBe('verde')
    expect(parsearNumero('+1 r').color).toBe('rojo')
    expect(parsearNumero('−1 COM').color).toBe('rojo')
    expect(parsearNumero('−1 g').color).toBe('verde')
    expect(parsearNumero('2 avance').color).toBe('tinta')
    expect(parsearNumero('2')).toEqual({ tipo: 'numero', valor: '2', color: 'tinta' })
  })

  it('pone en rojo las heridas, la Vida y el daño sin marca, y el «+N» de un Destino', () => {
    expect(parsearNumero('1 herida').color).toBe('rojo')
    expect(parsearNumero('1 vida').color).toBe('rojo')
    expect(parsearNumero('2 dano').color).toBe('rojo')
    expect(parsearNumero('3 herida g').color).toBe('verde')
    expect(parsearNumero('+1 dano').color).toBe('verde')
    expect(parsearNumero('+2').color).toBe('verde')
    expect(parsearNumero('+2', { masEsMalo: true }).color).toBe('rojo')
  })

  it('separa etiquetas en negrita, párrafos, Rasgos y palabras clave', () => {
    const s = parsearTexto('**Al zarpar:** Agota a un _Oficial_ para ganar {2 avance}.\nLos encuentros #Militar# reciben {+1 r}.')
    expect(s.map((x) => x.tipo)).toEqual([
      'texto',
      'texto',
      'rasgo',
      'texto',
      'numero',
      'texto',
      'parrafo',
      'texto',
      'clave',
      'texto',
      'numero',
      'texto',
    ])
    expect(s[0]).toEqual({ tipo: 'texto', texto: 'Al zarpar:', negrita: true })
  })

  it('pega a su icono los dos puntos que lo siguen', () => {
    const s = parsearTexto('**Al zarpar hacia una misión [mar]:** Gana {1 avance}.')
    expect(s[1]).toEqual({ tipo: 'icono', icono: 'mar', negrita: true, pegado: ':' })
    expect(s[2]).toEqual({ tipo: 'texto', texto: ' Gana ', negrita: false })
    const agotar = parsearTexto('[agotar]: Repara {1 dano g}.')
    expect(agotar[0]).toEqual({ tipo: 'icono', icono: 'agotar', negrita: false, pegado: ':' })
    expect(agotar[1]).toEqual({ tipo: 'texto', texto: ' Repara ', negrita: false })
  })

  it('fase 15, quinta ronda: ya no hay icono de quitar un Estado (las cartas lo dicen con palabras)', () => {
    expect(esIcono('quitarestado')).toBe(false)
    expect(esIcono('curar')).toBe(true)
  })

  it('interpreta las fichas de los recuadros de efecto', () => {
    expect(parsearFichas('1 [dano] · 1 [mejora]')).toEqual([
      { texto: '1', icono: 'dano' },
      { texto: '1', icono: 'mejora', rota: true },
    ])
    expect(parsearFichas('−1 [mejora]')).toEqual([{ texto: '−1', icono: 'mejora' }])
    expect(parsearFichas('−1 Mando')).toEqual([{ texto: '−1 Mando' }])
    expect(parsearFichas('1 [dano] · / 1 [herida]')).toEqual([
      { texto: '1', icono: 'dano' },
      { texto: '/ 1', icono: 'herida' },
    ])
    expect(parsearFichas('3 [dano] · Todos [agotar]')).toEqual([
      { texto: '3', icono: 'dano' },
      { texto: 'Todos', icono: 'agotar' },
    ])
    expect(parsearFichas('')).toEqual([])
  })

  it('entiende el marcado de todas las cartas de la caja', () => {
    for (const entrada of CATALOGO) {
      for (const texto of textosDeLaCarta(entrada)) {
        expect(() => parsearTexto(texto), `carta ${entrada.num}: ${texto}`).not.toThrow()
      }
    }
  })
})
