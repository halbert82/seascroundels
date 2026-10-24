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

  it('cómo se quita, genérico como el reglamento: la Taberna (o el Astillero) o cualquier carta que así lo indique, con un ejemplo', () => {
    // Fase 10b: curar ya no quita Estados. Fase 16: cada carta de Estado dice además cómo se quita (su Acción).
    expect(AYUDA_ESTADO.envenenado.partes[1]?.texto).toBe(
      'Se quita agotando a un Cirujano (Acción). También se quita con la Taberna o con cualquier carta que así lo indique (por ejemplo, la Herbolaria o «Cataplasma»).',
    )
    expect(AYUDA_ESTADO.viaDeAgua.partes[1]?.texto).toBe('Se quita agotando a un Carpintero (Acción). También se quita con el Astillero o con cualquier carta que así lo indique.')
    expect(AYUDA_ESTADO.inspirado.partes[1]?.texto).toContain('La Taberna no quita las Ventajas')
    expect(AYUDA_ESTADO.buscado.partes[1]?.texto).toBe(
      'Se quita descartando 1 carta en la Fase de Reclutamiento. También se quita con la Taberna o con cualquier carta que así lo indique.',
    )
    expect(AYUDA_ESTADO.velasRotas.partes[1]?.texto).toBe('Se quita agotando a un Carpintero (Acción). También se quita con el Astillero o con cualquier carta que así lo indique.')
    // El Desánimo no es un Estado de un Tripulante ni del Barco: no lo quitan la Taberna ni el Astillero.
    expect(AYUDA_ESTADO.desanimo.partes[1]?.texto).toContain('No la quitan la Taberna ni el Astillero')
  })

  it('el glosario de la mesa dice lo mismo que el reglamento para quitar cada Estado', async () => {
    const { default: reglamento } = await import('../../../docs/reglamento-v1.0.md?raw')
    for (const e of [...FICHAS_TRIPULANTE, ...ESTADOS_BARCO]) {
      if (esVentaja(e)) continue
      const quita = AYUDA_ESTADO[e].partes[1]?.texto ?? ''
      const generica = quita.match(/(?:También se quita|Se quita) con (?:la Taberna|el Astillero) o con cualquier carta que así lo indique[^.]*\./)?.[0]
      expect(generica, e).toBeDefined()
      const linea = reglamento.split('\n').find((l: string) => l.startsWith(`- **${INFO_ESTADO[e].nombre}:**`)) ?? ''
      // (El reglamento dice «Este Estado se quita con…» donde la mesa, más corta, dice «Se quita con…».)
      expect(linea.toLowerCase(), e).toContain((generica ?? '').toLowerCase())
    }
  })

  it('Perseguido (fase 10b): los encuentros de tipo Armada reciben +1; se quita al superar uno o con el Astillero', () => {
    const [hace, quita] = AYUDA_ESTADO.perseguido.partes
    expect(hace?.texto).toBe('Los encuentros de tipo Armada reciben +1 de dificultad.')
    expect(quita?.texto).toMatch(/^Se quita al superar un encuentro de tipo Armada\./)
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
    const pedidas = ['Abordaje', 'Zona de permanentes', 'Elige', 'Sin ayuda', 'Incautado', 'Persigue', 'Ocupa el muelle', 'Sin oposición', 'Descartar a un Tripulante', 'Recluta']
    const todas = CLAVES_REGLA.map((c) => AYUDA_REGLA[c])
    for (const a of todas) completa(a)
    for (const n of pedidas) expect(todas.map((a) => a.nombre)).toContain(n)
  })

  it('cada etiqueta de encuentro de las cartas (Elige, Sin ayuda, Incautado…) tiene su explicación', () => {
    const etiquetas = new Set<string>()
    for (const p of DATOS.peligros) for (const e of Object.values(p.encuentros)) for (const t of e.etiquetas ?? []) etiquetas.add(t)
    for (const c of DATOS.cartasDeMazoPropio) for (const t of c.encuentro.etiquetas ?? []) etiquetas.add(t)
    expect(etiquetas.size).toBeGreaterThanOrEqual(3) // Elige, Sin ayuda e Incautado (fase 11: ya no hay «Se queda en juego»)
    const conAyuda = CLAVES_REGLA.map((c) => AYUDA_REGLA[c].nombre)
    // Fase 15: «Descomunal 2» se explica con «Descomunal».
    for (const t of etiquetas) expect(conAyuda, t).toContain(t.replace(/ \d+$/, ''))
  })

  it('un «no se prepara» o «no puede comprometerse» dice qué carta lo causa y cuándo termina', () => {
    const hastas: Temporal['hasta'][] = ['inicio', 'finMision', 'finPrueba', 'carta', 'finTurno']
    for (const h of hastas) {
      completa(ayudaLimitacion('noPrepara', h, 'Noche en vela', 'Noche en vela'))
      completa(ayudaLimitacion('noCompromete', h, null, null))
    }
    const a = ayudaLimitacion('noPrepara', 'carta', 'La paga', 'La paga')
    expect(a.partes[0]?.texto).toContain('«La paga»')
    expect(a.partes[1]?.texto).toBe('Cuando «La paga» deje de estar en juego (vuelva al mazo de historia).')
    expect(ayudaLimitacion('noPrepara', 'inicio', null, null).partes[1]?.texto).toBe('Después de tu próxima Fase de Inicio (en esa fase no se prepara).')
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

  it('«La Armada te persigue» (Navío de línea): Abordaje, Perseguido, descartar a un Tripulante…', () => {
    const n = nombres('armada')
    for (const x of ['Abordaje', 'Perseguido', 'Descartar a un Tripulante', 'El Tripulante asignado con más (o menos)', 'Sin oposición']) expect(n).toContain(x)
    // Las expresiones de casi todas las cartas de Peligro van al final.
    expect(n.slice(-2)).toEqual(['El Tripulante asignado con más (o menos)', 'Sin oposición'])
  })

  it('las palabras de los Peligros 2.0: Zona de permanentes, Elige, Sin ayuda, Incautado, Persigue, Ocupa el muelle', () => {
    expect(nombres('p2_bajamar')).toContain('Zona de permanentes')
    expect(nombres('cortar')).toContain('Zona de permanentes')
    expect(nombres('p2_calma')).toContain('Elige')
    expect(nombres('p2_jaguar')).toContain('Sin ayuda')
    expect(nombres('p2_aduana')).toContain('Incautado')
    expect(nombres('p2_turbonada')).toContain('Persigue')
    expect(nombres('p2_huracan')).toContain('Ocupa el muelle')
    expect(nombres('p2_serpientes')).toEqual(expect.arrayContaining(['Envenenado', 'Sangrando', 'Asustado']))
  })

  it('«Persigue» no es «Entra en el mazo de Peligros», aunque las dos pongan la carta encima del mazo', () => {
    expect(nombres('p2_turbonada')).not.toContain('Entra en el mazo de Peligros')
    expect(nombres('virar')).toEqual(['Persigue'])
    expect(nombres('armada_patrulla')).toContain('Entra en el mazo de Peligros')
  })

  it('en una carta de recompensa, «Elige» es un final con elección', () => {
    // Fase 15, cuarta ronda: la elección de «El templo» está en su carta de recompensa, «Ante el altar» (290).
    expect(nombres('ante_altar')).toEqual(expect.arrayContaining(['Carta de recompensa', 'Final con elección', 'Maldito']))
    expect(nombres('ante_altar')).not.toContain('Elige')
    expect(nombres('templo-IV')).toContain('Carta de recompensa')
    expect(nombres('fondeo_sanjose')).toEqual(expect.arrayContaining(['Carta de recompensa', 'Mazo del naufragio']))
    expect(nombres('tres_cruces')).toContain('Capítulo al azar')
  })

  it('las fichas de misión de las reglas del capítulo', () => {
    expect(nombres('gobernador-I')).toEqual(expect.arrayContaining(['Alarma', 'Buscado']))
    expect(nombres('ladron-I')).toEqual(expect.arrayContaining(['Al zarpar', 'Ladrón', 'La misión falla']))
    expect(nombres('panama-III')).toContain('Defensa')
    expect(nombres('sanfelipe-III')).toContain('Mecha')
  })

  it('Pasajeros, Tesoros y cartas sin palabras de regla', () => {
    // Fase 15: su carta dice que no recibe Estados ni Ventajas.
    expect(nombres('anselmo')).toEqual(['Pasajero', 'Estados y Ventajas'])
    expect(nombres('farol')).toEqual(expect.arrayContaining(['Tesoro', 'Indestructible']))
    expect(nombres('ojo')).toEqual([])
  })

  it('ninguna carta de la caja tiene más de 6 explicaciones (caben junto a la ampliación)', () => {
    for (const e of CATALOGO) expect(ayudasDeCarta(e.id).length, e.id).toBeLessThanOrEqual(6)
  })
})
