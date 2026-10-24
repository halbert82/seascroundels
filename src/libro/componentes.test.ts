// «Componentes» dice cuántas cartas trae la caja: cada fila tiene que cuadrar con los datos de las cartas (copias incluidas),
// y la frase de la caja, con la suma. (Revisión de Albert de las cartas de jugador: la fila de Tripulantes se había quedado
// en 23 desde la fase 14; los datos tienen 29 copias.)

import { describe, expect, it } from 'vitest'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import { leerReglamento, type Bloque } from './fuente.ts'
import { cartasDeFila } from './graficos.tsx'

const r = leerReglamento(fuente)
const componentes = r.aprende.capitulos.find((c) => c.titulo === 'Componentes')
const tablas = (componentes?.bloques ?? []).filter((b): b is Extract<Bloque, { tipo: 'componentes' }> => b.tipo === 'componentes')

describe('Componentes cuadra con los datos de las cartas', () => {
  it('cada fila dice cuántas cartas (con sus copias) hay de esa clase', () => {
    const filas = tablas.flatMap((t) => t.filas)
    expect(filas.length).toBeGreaterThan(15)
    for (const f of filas) {
      const cartas = cartasDeFila(f.nombre)
      expect(cartas.length, f.nombre).toBeGreaterThan(0)
      // «La Armada te persigue» tiene 0 copias en los datos (entra durante la partida), pero es una carta de la caja.
      expect(Number(f.cantidad), f.nombre).toBe(cartas.reduce((n, e) => n + Math.max(1, e.copias), 0))
    }
  })

  it('la frase de la caja dice el total', () => {
    const total = tablas.flatMap((t) => t.filas).reduce((n, f) => n + Number(f.cantidad), 0)
    expect(fuente).toContain(`La Caja básica de Sea Scoundrels contiene ${total} cartas`)
  })
})
