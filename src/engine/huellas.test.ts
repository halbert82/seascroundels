// Los números de las capacidades se leen del texto de cada carta: si cambias un número en cartas.json, el
// motor lo sigue solo. Si cambias la redacción, esta prueba avisa de qué carta hay que revisar en el motor.

import { describe, expect, it } from 'vitest'
import HUELLAS from './capacidades/huellas.json'
import { capacidadesDe } from './capacidades/index.ts'
import { CATALOGO } from './catalogo.ts'
import { textoDe } from './textos.ts'

const TIPOS_DEL_JUGADOR = new Set(['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'tesoro'])
const huellas: Record<string, string> = HUELLAS
const huella = (texto: string) => texto.replace(/[+−-]?\d+/g, 'N')

describe('Huellas de los textos de las cartas del jugador', () => {
  const cartas = CATALOGO.filter((e) => TIPOS_DEL_JUGADOR.has(e.tipo) && textoDe(e.id) !== '')

  it.each(cartas.map((e) => [e.id, e.carta.nombre] as const))('«%s» (%s) mantiene la redacción que entiende el motor', (id) => {
    expect(
      huella(textoDe(id)),
      `El texto de «${id}» ha cambiado más que sus números: revisa su capacidad en src/engine/capacidades y actualiza huellas.json.`,
    ).toBe(huellas[id])
  })

  it('toda carta del jugador con texto tiene al menos una capacidad registrada', () => {
    const sin = cartas.filter((e) => capacidadesDe(e.id).length === 0).map((e) => e.id)
    expect(sin).toEqual([])
  })
})
