// El reglamento leído para la maqueta: los dos libros, las marcas nuevas y las remisiones.

import { describe, expect, it } from 'vitest'
import { cartasNombradas } from './cartasNombradas.ts'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import { leerReglamento, type Bloque, type Capitulo } from './fuente.ts'

const r = leerReglamento(fuente)

const capitulo = (titulo: string): Capitulo => {
  const c = r.aprende.capitulos.find((x) => x.titulo === titulo)
  if (!c) throw new Error(`Falta el capítulo ${titulo}`)
  return c
}
const htmlDe = (bloques: Bloque[]) => bloques.map((b) => ('html' in b ? b.html : '')).join('\n')

describe('Los dos libros salen de las dos partes del reglamento', () => {
  it('«Aprende a jugar» tiene los capítulos de la Parte 1, en orden', () => {
    expect(r.aprende.capitulos.map((c) => c.titulo).slice(0, 3)).toEqual(['Resumen del juego', 'Objetivo del juego', 'Componentes'])
    expect(r.aprende.capitulos.at(-1)?.titulo).toBe('Construir tu mazo')
  })

  it('la «Referencia de reglas» tiene sus entradas de la A a la Z, con su letra', () => {
    const e = r.referencia.entradas
    expect(e[0]?.titulo).toBe('Abordaje')
    expect(e.find((x) => x.titulo === 'Única (★)')?.letra).toBe('U')
    expect(e.length).toBeGreaterThan(80)
  })

  it('la referencia rápida de la contraportada trae el turno, la Prueba, los iconos y los Estados', () => {
    expect(r.rapida.turno).toHaveLength(4)
    expect(r.rapida.prueba).toHaveLength(5)
    expect(r.rapida.iconos.length).toBeGreaterThan(10)
    expect(r.rapida.estados.map((f) => f.ficha)).toContain('Envenenado')
  })
})

describe('Marcas nuevas', () => {
  it('las 8 notas temáticas pedidas salen como notas, delante del párrafo que comentan', () => {
    const todo = [...r.aprende.capitulos.flatMap((c) => c.bloques), ...r.referencia.entradas.flatMap((e) => e.bloques)]
    const notas = htmlDe(todo).match(/<aside class="nota-tema">/g) ?? []
    expect(notas.length).toBeGreaterThanOrEqual(8)
    const pagar = htmlDe(capitulo('El turno').bloques)
    expect(pagar.indexOf('Cada carta de tu mano es tiempo')).toBeLessThan(pagar.indexOf('<strong>pagar un coste</strong>'))
  })

  it('una nota dentro de un punto de lista se queda en ese punto («El mar no es justo ni injusto»)', () => {
    const html = htmlDe(capitulo('Las misiones').bloques)
    expect(html).toMatch(/<li>\s*<aside class="nota-tema">\s*<p>El mar no es justo ni injusto/)
  })

  it('los ejemplos llevan título y las cartas que nombran', () => {
    const ejemplo = capitulo('Capacidades de las cartas').bloques.find((b) => b.tipo === 'ejemplo')
    expect(ejemplo).toMatchObject({ tipo: 'ejemplo', titulo: 'Una Interrupción', cartas: ['grumete', 'capitan'] })
  })

  it('no queda ningún ejemplo con la marca antigua', () => {
    expect(fuente).not.toMatch(/^> \*Ejemplo:\*/m)
  })

  it('los gráficos se colocan donde dice su marca; el del turno sustituye a la lista de cuatro pasos', () => {
    const turno = capitulo('El turno').bloques.find((b) => b.tipo === 'grafico')
    expect(turno).toMatchObject({ nombre: 'turno', pasos: ['Inicio', 'Jugar cartas', 'Quedarte o zarpar', 'Final'] })
    const anatomias = capitulo('Anatomía de las cartas').bloques.filter((b) => b.tipo === 'grafico').map((b) => (b.tipo === 'grafico' ? b.arg : ''))
    expect(anatomias).toEqual(['tripulante', 'mejora', 'evento', 'barco', 'puerto', 'mision', 'peligro', 'escenario'])
    const tripulante = capitulo('Anatomía de las cartas').bloques.find((b) => b.tipo === 'grafico' && b.arg === 'tripulante')
    expect(tripulante && 'leyenda' in tripulante ? tripulante.leyenda?.length : 0).toBe(10)
    expect(capitulo('Ejemplo de juego').especial).toBe('ejemplo-de-juego')
  })

  it('sin epígrafe ni nota, el capítulo los deja pendientes (lo dibuja la maqueta)', () => {
    expect(capitulo('Resumen del juego')).toMatchObject({ epigrafe: null, conTema: false })
    expect(capitulo('Las misiones').conTema).toBe(true)
  })

  it('las tablas de «Componentes» son fichas de componentes', () => {
    const grupos = capitulo('Componentes').bloques.filter((b) => b.tipo === 'componentes')
    expect(grupos.map((g) => (g.tipo === 'componentes' ? g.grupo : ''))).toEqual(['Cartas del jugador', 'Cartas del escenario El Caribe'])
  })
})

describe('Tipografía del texto', () => {
  it('las definiciones van con raya: «**Agotado —**»', () => {
    expect(htmlDe(capitulo('Las misiones').bloques)).toContain('<strong>Elige —</strong>')
  })

  it('NAV, COM y EXP llevan su icono; las heridas, el daño y el Avance con número, también', () => {
    expect(htmlDe(capitulo('Las misiones').bloques)).toContain('<span class="hab hab-nav"><i class="ic i-nav"></i>NAV</span>')
    const html = htmlDe(capitulo('El turno').bloques)
    expect(html).toMatch(/3 <i class="ic ic-ficha i-dano"><\/i>daños/)
  })

  it('«ver «X»» remite a la página de X en el mismo libro', () => {
    expect(htmlDe(capitulo('Preparación de la partida').bloques)).toContain('véase <a class="ref" href="#a-construir-tu-mazo">«Construir tu mazo»</a>, <span class="pag">pág.&nbsp;<a class="num-pag" href="#a-construir-tu-mazo"></a></span>')
  })

  it('en «Aprende a jugar», cada término de juego va en negrita solo la primera vez', () => {
    const html = r.aprende.capitulos.map((c) => htmlDe(c.bloques)).join('\n')
    expect(html.match(/<strong class="termino">Tripulantes?<\/strong>/g)).toHaveLength(1)
  })

  it('en la Referencia, los términos en negrita remiten a su página y cada entrada acaba con «Véase también»', () => {
    const abordaje = r.referencia.entradas.find((e) => e.titulo === 'Abordaje')
    expect(htmlDe(abordaje?.bloques ?? [])).toContain('<a class="pagref" href="#r-prueba"></a>')
    expect(abordaje?.vease.map((v) => v.titulo)).toEqual(['Rehén', 'Destino'])
    const accion = r.referencia.entradas.find((e) => e.titulo === 'Acción')
    expect(accion?.vease[0]).toEqual({ titulo: 'Capacidades de las cartas', id: 'a-capacidades-de-las-cartas', libro: 'aprende' })
  })
})

describe('Cartas nombradas en un texto', () => {
  it('encuentra cartas, encuentros y Destinos por su nombre, en orden y sin repetir', () => {
    expect(cartasNombradas('Diego juega «¡Al abordaje!» contra «Turbonada a popa»; el Destino es «Coral bajo la quilla». Diego gana.')).toEqual([
      'capitan',
      'abordaje',
      'p2_turbonada',
      'p2_arrecife',
    ])
  })

  it('no confunde una palabra suelta con el nombre de una carta', () => {
    expect(cartasNombradas('Elige una opción y descarta una carta.')).toEqual([])
  })
})

describe('Marcas que el reglamento todavía no usa', () => {
  const mini = `# Reglamento

## Cómo usar este reglamento

Texto.

## Parte 1 · Aprende a jugar

### El turno

> [!epigrafe] Viejo lobo de mar
> «El mar no es justo ni injusto. Es el mar.»

Una regla.

> [!importante]
> Las cartas de la mano solo suman al comprometer.

> [!consejo]
> Guarda una carta para el Destino.

## Parte 2 · Referencia de reglas

### Prueba

Texto de la Prueba.

## Referencia rápida

### Secuencia del turno

1. Inicio.
`
  const m = leerReglamento(mini)
  const turno = m.aprende.capitulos[0]

  it('el epígrafe va con su autor al principio del capítulo', () => {
    expect(turno?.epigrafe?.autor).toBe('Viejo lobo de mar')
    expect(turno?.epigrafe?.html).toContain('El mar no es justo ni injusto')
  })

  it('«importante» y «consejo» son recuadros', () => {
    expect(turno?.bloques.map((b) => b.tipo)).toEqual(['html', 'importante', 'consejo'])
  })
})
