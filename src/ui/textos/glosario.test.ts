// Toda ficha que se ve en la mesa (Estados, Ventajas, fichas de misión) y toda palabra de regla de las cartas tiene su
// explicación, y la ampliación de una carta explica lo que su texto nombra.

import { describe, expect, it } from 'vitest'
import '../../engine/motor.ts'
import { CATALOGO } from '../../engine/catalogo.ts'
import { DATOS } from '../../engine/datos.ts'
import { ESTADOS_BARCO, FICHAS_TRIPULANTE, INFO_ESTADO, esVentaja } from '../../engine/infoEstados.ts'
import { misionesConReglas, reglasMision } from '../../engine/misiones2/registro.ts'
import type { Temporal } from '../../engine/tipos.ts'
import {
  AYUDA_ESTADO,
  AYUDA_FICHA_MISION,
  AYUDA_REGLA,
  CLAVES_REGLA,
  ayudaLimitacion,
  ayudasDeCarta,
  glosarioCompleto,
  sinMarcado,
  type Ayuda,
} from './glosario.ts'

function completa(a: Ayuda): void {
  expect(a.nombre.length, a.clave).toBeGreaterThan(0)
  expect(a.partes.length, a.clave).toBeGreaterThan(0)
  for (const p of a.partes) {
    expect(p.rotulo.length, a.clave).toBeGreaterThan(0)
    expect(p.texto.length, a.clave).toBeGreaterThan(10)
    // Sin marcado de las cartas a la vista.
    expect(p.texto, a.clave).not.toMatch(/\*\*|\[[A-Za-z]+\]|\{|#|~/)
  }
}

const nombres = (id: string) => ayudasDeCarta(id).map((a) => a.nombre)

describe('Glosario de la mesa', () => {
  it('cada Estado y cada Ventaja de los Tripulantes y del Barco tiene qué hace y cómo se quita', () => {
    for (const e of [...FICHAS_TRIPULANTE, ...ESTADOS_BARCO]) {
      const a = AYUDA_ESTADO[e]
      completa(a)
      expect(a.nombre).toBe(INFO_ESTADO[e].nombre)
      expect(a.clase).toBe(esVentaja(e) ? 'ventaja' : (ESTADOS_BARCO as readonly string[]).includes(e) ? 'estadoBarco' : 'estado')
      expect(a.partes.map((p) => p.rotulo)).toEqual(['Qué hace', esVentaja(e) ? 'Cuándo se gasta' : 'Cómo se quita'])
    }
  })

  it('en puerto: la Taberna quita los Estados de los Tripulantes, el Astillero los del Barco y las Ventajas se quedan', () => {
    expect(AYUDA_ESTADO.envenenado.partes[1]?.texto).toContain('la Taberna quita todos los Estados de tus Tripulantes')
    expect(AYUDA_ESTADO.viaDeAgua.partes[1]?.texto).toContain('el Astillero quita todos los Estados del Barco')
    expect(AYUDA_ESTADO.inspirado.partes[1]?.texto).toContain('La Taberna no quita las Ventajas')
    // Buscado y Pólvora mojada solo se quitan en puerto (tabla de la Referencia rápida).
    expect(AYUDA_ESTADO.buscado.partes[1]?.texto).toBe('Solo lo quita la Taberna, en puerto.')
    expect(AYUDA_ESTADO.polvoraMojada.partes[1]?.texto).toBe('Solo lo quita el Astillero, en puerto.')
  })

  it('Perseguido: la próxima misión de Mar empieza con un Peligro de más; se quita al revelarlo o con el Astillero', () => {
    const [hace, quita] = AYUDA_ESTADO.perseguido.partes
    expect(hace?.texto).toMatch(/^Tu próxima misión de Mar empieza revelando un Peligro de más/)
    expect(quita?.texto).toMatch(/^Se quita al revelar ese Peligro de más\./)
    expect(quita?.texto).toContain('Astillero')
  })

  it('cada ficha de misión registrada tiene su explicación, con el mismo nombre que en la mesa', () => {
    const vistas = new Set<string>()
    for (const id of misionesConReglas()) {
      for (const f of reglasMision(id)?.fichas ?? []) {
        const a = AYUDA_FICHA_MISION[f.ficha]
        expect(a, `${id}: ${f.ficha}`).toBeDefined()
        completa(a)
        expect(a.nombre, id).toBe(f.nombre)
        expect(a.clase).toBe('fichaMision')
        vistas.add(f.ficha)
      }
    }
    expect([...vistas].sort()).toEqual(Object.keys(AYUDA_FICHA_MISION).sort())
  })

  it('cada palabra de regla tiene su explicación', () => {
    const pedidas = ['Abordaje', 'Se queda en juego', 'Elige', 'Sin ayuda', 'Incautado', 'Persigue', 'Ocupa el muelle', 'Sin oposición', 'Rehén', 'Recluta']
    const todas = CLAVES_REGLA.map((c) => AYUDA_REGLA[c])
    for (const a of todas) completa(a)
    for (const n of pedidas) expect(todas.map((a) => a.nombre)).toContain(n)
  })

  it('cada etiqueta de encuentro de las cartas (Elige, Se queda en juego, Sin ayuda, Incautado…) tiene su explicación', () => {
    const etiquetas = new Set<string>()
    for (const p of DATOS.peligros) for (const e of Object.values(p.encuentros)) for (const t of e.etiquetas ?? []) etiquetas.add(t)
    for (const c of DATOS.cartasDeMazoPropio) for (const t of c.encuentro.etiquetas ?? []) etiquetas.add(t)
    expect(etiquetas.size).toBeGreaterThan(3)
    const conAyuda = CLAVES_REGLA.map((c) => AYUDA_REGLA[c].nombre)
    for (const t of etiquetas) expect(conAyuda, t).toContain(t)
  })

  it('un «no se prepara» o «no puede comprometerse» dice qué carta lo causa y cuándo termina', () => {
    const hastas: Temporal['hasta'][] = ['inicio', 'finMision', 'superarPrueba', 'finPrueba', 'carta', 'finTurno']
    for (const h of hastas) {
      completa(ayudaLimitacion('noPrepara', h, 'Noche en vela', 'Noche en vela'))
      completa(ayudaLimitacion('noCompromete', h, null, null))
    }
    const a = ayudaLimitacion('noPrepara', 'carta', 'La paga', 'La paga')
    expect(a.partes[0]?.texto).toContain('«La paga»')
    expect(a.partes[1]?.texto).toBe('Cuando «La paga» deje de estar en juego.')
    expect(ayudaLimitacion('noPrepara', 'inicio', null, null).partes[1]?.texto).toBe('Después de tu próximo Inicio (en ese Inicio no se prepara).')
  })

  it('la Referencia rápida lo recoge todo, sin repetir', () => {
    const claves = glosarioCompleto().flatMap((g) => g.ayudas.map((a) => a.clave))
    expect(new Set(claves).size).toBe(claves.length)
    expect(claves.length).toBe(FICHAS_TRIPULANTE.length + ESTADOS_BARCO.length + Object.keys(AYUDA_FICHA_MISION).length + CLAVES_REGLA.length - 1)
  })
})

describe('Lo que se explica junto a una carta ampliada', () => {
  it('quita el marcado y las frases de ambiente', () => {
    expect(sinMarcado('~Os da alcance.~ **Abordaje:** el comprometido con más [EXP] sufre {2 herida}; {+1 r}.')).toBe(
      'Abordaje: el comprometido con más EXP sufre 2 herida; +1.',
    )
  })

  it('«La Armada te persigue» (Navío de línea): Abordaje, Perseguido, rehén…', () => {
    const n = nombres('armada')
    for (const x of ['Abordaje', 'Perseguido', 'Rehén', 'El comprometido con más (o menos)', 'Sin oposición']) expect(n).toContain(x)
    // Las expresiones de casi todas las cartas de Peligro van al final.
    expect(n.slice(-2)).toEqual(['El comprometido con más (o menos)', 'Sin oposición'])
  })

  it('las palabras de los Peligros 2.0: Se queda en juego, Elige, Sin ayuda, Incautado, Persigue, Ocupa el muelle', () => {
    expect(nombres('p2_bajamar')).toContain('Se queda en juego')
    expect(nombres('p2_calma')).toContain('Elige')
    expect(nombres('p2_jaguar')).toContain('Sin ayuda')
    expect(nombres('p2_aduana')).toContain('Incautado')
    expect(nombres('p2_turbonada')).toContain('Persigue')
    expect(nombres('p2_huracan')).toContain('Ocupa el muelle')
    expect(nombres('p2_serpientes')).toEqual(expect.arrayContaining(['Envenenado', 'Sangrando', 'Aturdido', 'Asustado']))
  })

  it('«Persigue» no es «Entra en el mazo de Peligros», aunque las dos pongan la carta encima del mazo', () => {
    expect(nombres('p2_turbonada')).not.toContain('Entra en el mazo de Peligros')
    expect(nombres('virar')).toEqual(['Persigue'])
    expect(nombres('armada_patrulla')).toContain('Entra en el mazo de Peligros')
  })

  it('en la recompensa de un capítulo, «Elige» es un final con elección', () => {
    expect(nombres('templo-III')).toContain('Final con elección')
    expect(nombres('templo-III')).not.toContain('Elige')
    expect(nombres('templo-III')).toContain('Maldito')
  })

  it('las fichas de misión de las reglas del capítulo', () => {
    expect(nombres('gobernador-I')).toEqual(expect.arrayContaining(['Alarma', 'Buscado']))
    expect(nombres('ladron-I')).toEqual(expect.arrayContaining(['Al zarpar', 'Ladrón', 'La misión falla']))
    expect(nombres('panama-III')).toContain('Defensa')
    expect(nombres('sanfelipe-III')).toContain('Mecha')
  })

  it('Pasajeros, Tesoros y cartas sin palabras de regla', () => {
    expect(nombres('anselmo')).toEqual(['Pasajero'])
    expect(nombres('farol')).toEqual(expect.arrayContaining(['Tesoro', 'Indestructible']))
    expect(nombres('ojo')).toEqual([])
  })

  it('ninguna carta de la caja tiene más de 6 explicaciones (caben junto a la ampliación)', () => {
    for (const e of CATALOGO) expect(ayudasDeCarta(e.id).length, e.id).toBeLessThanOrEqual(6)
  })
})
