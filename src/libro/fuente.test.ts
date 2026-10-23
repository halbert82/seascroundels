// El reglamento leído para la maqueta: los dos libros, las marcas nuevas y las remisiones.

import { describe, expect, it } from 'vitest'
import { cartasNombradas, cartasYPartes } from './cartasNombradas.ts'
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
    expect(r.aprende.capitulos.map((c) => c.titulo).slice(-2)).toEqual(['Construir tu mazo', 'Mazos de inicio'])
  })

  it('la «Referencia de reglas» tiene sus entradas de la A a la Z, con su letra', () => {
    const e = r.referencia.entradas
    expect(e[0]?.titulo).toBe('Abordaje')
    expect(e.find((x) => x.titulo === 'Única (★)')?.letra).toBe('U')
    expect(e.length).toBeGreaterThan(80)
  })

  it('la referencia rápida de la contraportada trae el turno, la Prueba, los iconos y los Estados', () => {
    expect(r.rapida.turno).toHaveLength(4)
    expect(r.rapida.prueba).toHaveLength(6) // fase 14: el paso 6, Desgaste
    expect(r.rapida.iconos.length).toBeGreaterThan(10)
    expect(r.rapida.estados.map((f) => f.ficha)).toContain('Envenenado')
  })
})

describe('Marcas nuevas', () => {
  it('las notas temáticas (las 8 primeras y las 10 de la última ronda) salen como notas, delante del párrafo que comentan', () => {
    const todo = [...r.aprende.capitulos.flatMap((c) => c.bloques), ...r.referencia.entradas.flatMap((e) => e.bloques)]
    const notas = htmlDe(todo).match(/<aside class="nota-tema">/g) ?? []
    expect(notas.length).toBeGreaterThanOrEqual(18)
    const pagar = htmlDe(capitulo('El turno').bloques)
    expect(pagar.indexOf('Cada carta de tu mano es tiempo')).toBeLessThan(pagar.indexOf('<strong>pagar un coste</strong>'))
  })

  it('una nota dentro de un punto de lista se queda en ese punto («El mar no es justo ni injusto»)', () => {
    const html = htmlDe(capitulo('Las misiones').bloques)
    expect(html).toMatch(/<li>\s*<aside class="nota-tema">\s*<p>El mar no es justo ni injusto/)
  })

  // Fase 10: los ejemplos van sin título («Ejemplo» y su texto).
  it('los ejemplos van sin título y llevan las cartas que nombran', () => {
    const ejemplo = capitulo('Capacidades de las cartas').bloques.find((b) => b.tipo === 'ejemplo')
    expect(ejemplo).toMatchObject({ tipo: 'ejemplo', titulo: '', cartas: [{ id: 'grumete', partes: [] }, { id: 'capitan', partes: [] }] })
    expect(fuente).not.toMatch(/^> \[!ejemplo\] \S/m)
  })

  it('la marca [!nota] es una aclaración en la columna exterior, con otro estilo que la nota temática', () => {
    expect(htmlDe(capitulo('Las misiones').bloques)).toMatch(/<aside class="nota-tema nota-regla">\s*<p>Algunas son opcionales/)
  })

  it('no queda ningún ejemplo con la marca antigua', () => {
    expect(fuente).not.toMatch(/^> \*Ejemplo:\*/m)
  })

  it('los gráficos se colocan donde dice su marca; el del turno sustituye a la lista de cuatro pasos', () => {
    const turno = capitulo('El turno').bloques.find((b) => b.tipo === 'grafico')
    expect(turno).toMatchObject({ nombre: 'turno', pasos: ['Fase de Inicio', 'Fase de Reclutamiento', 'Fase de Rumbo', 'Fase de Final de turno'] })
    const anatomias = capitulo('Anatomía de las cartas').bloques.filter((b) => b.tipo === 'grafico').map((b) => (b.tipo === 'grafico' ? b.arg : ''))
    expect(anatomias).toEqual(['tripulante', 'mejora', 'evento', 'barco', 'puerto', 'mision', 'peligro', 'escenario', 'historia'])
    const tripulante = capitulo('Anatomía de las cartas').bloques.find((b) => b.tipo === 'grafico' && b.arg === 'tripulante')
    expect(tripulante && 'leyenda' in tripulante ? tripulante.leyenda?.length : 0).toBe(10)
    expect(capitulo('Ejemplo de juego').especial).toBe('ejemplo-de-juego')
  })

  it('cada capítulo de «Aprende a jugar» lleva su epígrafe y su nota temática (salvo «Mazos de inicio», un apéndice)', () => {
    const capitulos = r.aprende.capitulos.filter((c) => c.especial !== 'mazos-de-inicio')
    expect(capitulos).toHaveLength(13)
    for (const c of capitulos) {
      expect(c.epigrafe, c.titulo).not.toBeNull()
      expect(c.conTema, c.titulo).toBe(true)
    }
    expect(capitulo('Resumen del juego').epigrafe).toMatchObject({ autor: 'Diego «Garra» Mendoza' })
    expect(capitulo('Ejemplo de juego').epigrafe?.autor).toBe('Cuaderno de bitácora de Diego «Garra» Mendoza')
    // Una nota dentro de un punto de lista también cuenta (Preparación, paso 6).
    expect(htmlDe(capitulo('Preparación de la partida').bloques)).toMatch(/<li>[\s\S]*?<aside class="nota-tema">\s*<p>El muelle es donde se busca gente/)
  })

  it('las tablas de «Componentes» son fichas de componentes', () => {
    const grupos = capitulo('Componentes').bloques.filter((b) => b.tipo === 'componentes')
    expect(grupos.map((g) => (g.tipo === 'componentes' ? g.grupo : ''))).toEqual(['Cartas del jugador', 'Cartas del escenario El Caribe'])
  })
})

describe('Textos de la última ronda (docs/archivo/reglamento-textos.md)', () => {
  it('«Al revelarse» se explica en «Lo que dicen los encuentros», antes de «Elige», y tiene su entrada en la Referencia, en orden', () => {
    const html = htmlDe(capitulo('Las misiones').bloques)
    expect(html.indexOf('<strong>Al revelarse —</strong>')).toBeGreaterThan(0)
    expect(html.indexOf('<strong>Al revelarse —</strong>')).toBeLessThan(html.indexOf('<strong>Elige —</strong>'))
    const titulos = r.referencia.entradas.map((e) => e.titulo)
    expect(titulos.slice(titulos.indexOf('Agotar y preparar'), titulos.indexOf('Al zarpar') + 1)).toEqual(['Agotar y preparar', 'Al revelarse', 'Al zarpar'])
    const entrada = r.referencia.entradas.find((e) => e.titulo === 'Al revelarse')
    expect(entrada?.bloques.find((b) => b.tipo === 'ejemplo')).toMatchObject({ cartas: [{ id: 'p2_aduana', partes: ['mar'] }, { id: 'patente', partes: [] }] })
  })

  // Registro formal (docs/archivo/reglamento-estilo.md): los ejemplos, en tercera persona y en presente.
  it('el ejemplo de juego va en tercera persona, como los demás ejemplos, y no nombra a nadie de fuera del juego', () => {
    expect(fuente).not.toMatch(/Albert/)
    expect(htmlDe(capitulo('Ejemplo de juego').bloques)).toContain('El jugador revela la carta superior del mazo de Escenario') // fase 13: «superior»
  })

  it('«Mazos de inicio» es el último apartado de «Aprende a jugar» y se dibuja desde los datos', () => {
    expect(r.aprende.capitulos.at(-1)).toMatchObject({ titulo: 'Mazos de inicio', especial: 'mazos-de-inicio', bloques: [] })
  })

  it('«ver «Mazos de inicio», al final de este libro» remite a su página en «Aprende a jugar» y al otro libro en la Referencia', () => {
    const aprende = htmlDe(r.comoUsar.aprende)
    expect(aprende).toContain('véase <a class="ref" href="#a-mazos-de-inicio">«Mazos de inicio»</a>, <span class="pag">pág.&nbsp;<a class="num-pag" href="#a-mazos-de-inicio"></a></span>, al final de este libro)')
    const referencia = htmlDe(r.comoUsar.referencia)
    expect(referencia).toContain('(véase <i>Aprende a jugar</i>, «Mazos de inicio») y consultar')
    expect(fuente).not.toMatch(/Catálogo de cartas/)
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

  it('de los Peligros apunta qué parte se nombra: el encuentro de un Entorno o el Destino', () => {
    expect(cartasYPartes('Fallas «Te roban el barco»; después sale el Destino «Las baterías del castillo».')).toEqual([
      { id: 'p2_curazao', partes: ['ciu'] },
      { id: 'p2_morro', partes: ['destino'] },
    ])
    // Dos partes de la misma carta: las dos, en el orden de la carta.
    expect(cartasYPartes('Sale «Os da alcance» y luego «Turbonada a popa».')).toEqual([{ id: 'p2_turbonada', partes: ['mar', 'destino'] }])
  })

  it('el ejemplo de «Daño» enseña el encuentro de Ciudad de una carta y el Destino de la otra («el Destino de la carta X»)', () => {
    const dano = r.referencia.entradas.find((e) => e.titulo === 'Daño')?.bloques.find((b) => b.tipo === 'ejemplo')
    expect(dano).toMatchObject({ titulo: '', cartas: [{ id: 'p2_curazao', partes: ['ciu'] }, { id: 'p2_morro', partes: ['destino'] }] })
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

Texto de la Prueba (ver «El turno»).

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

  it('una remisión al otro libro lleva su nombre delante y no lleva página: «véase *Aprende a jugar*, «El turno»»', () => {
    const prueba = m.referencia.entradas.find((e) => e.titulo === 'Prueba')
    expect(htmlDe(prueba?.bloques ?? [])).toContain('(véase <i>Aprende a jugar</i>, «El turno»)')
  })

  it('«importante» y «consejo» son recuadros', () => {
    expect(turno?.bloques.map((b) => b.tipo)).toEqual(['html', 'importante', 'consejo'])
  })
})
