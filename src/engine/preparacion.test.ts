import { describe, expect, it } from 'vitest'
import { DATOS } from './datos.ts'
import { nuevaPartida } from './preparacion.ts'
import { Jugador } from './pruebas/situacion.ts'

/** Semilla cuya primera carta de Escenario no toca la mano ni pide decisiones (para mirar la mano tras el cambio). */
function semillaTranquila(): number {
  const tranquilas = ['bando', 'rumores', 'escasez', 'huracanes', 'alisios', 'mercado']
  for (let semilla = 1; semilla < 200; semilla++) {
    const s = nuevaPartida({ semilla })
    const arriba = s.zonas.mazoEscenario[0]
    if (arriba && tranquilas.includes(s.cartas[arriba]?.id ?? '')) return semilla
  }
  throw new Error('No hay semilla tranquila')
}

describe('Preparación de la partida', () => {
  it('prepara la partida normal con Diego en Tortuga como dice el reglamento', () => {
    const j = Jugador.partida({ semilla: 1 })
    const s = j.estado
    expect(s.modo).toBe('normal')
    expect(s.reputacionObjetivo).toBe(12)
    expect(s.reputacion).toBe(0)
    expect(s.puerto).toBe('tortuga')
    expect(s.danoBarco).toBe(0)
    expect(s.turno).toBe(0)
    // 1. Escenario: 11 de 14; las otras vuelven a la caja sin mirarlas.
    expect(j.zona('mazoEscenario')).toHaveLength(11)
    expect(j.zona('fueraDeJuego')).toHaveLength(3)
    // 2. Capitán en juego, preparado.
    expect(j.zona('tripulacion')).toEqual(['capitan'])
    expect(j.copia('capitan').agotada).toBe(false)
    // 4. Peligros: todas las cartas de Peligro; «La Armada te persigue» está en el mazo de historia (fase 10).
    expect(j.zona('mazoPeligros')).toHaveLength(DATOS.mazosPredefinidos.mazoDePeligros.length)
    expect(j.zona('apartados')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('armada')
    // 5. Misiones.
    expect(j.zona('misionesDisponibles')).toEqual(['deuda-I', 'prueba-I', 'aguada-I'])
    const esperadas = [...DATOS.ordenMisiones.travesias, ...DATOS.ordenMisiones.aventuras].map((m) => `${m}-I`)
    expect(j.zona('mazoMisiones').sort()).toEqual(esperadas.sort())
    const historia = j.zona('mazoHistoria')
    // Capítulos II y III (con los dos de salida doble de Maracaibo y San Felipe), Tesoros, mazos propios,
    // los dos Pasajeros y «¡La guardia!».
    expect(historia.filter((id) => /-(II|III)(-[ab])?$/.test(id))).toHaveLength(16)
    expect(historia.filter((id) => DATOS.tesoros.some((t) => t.id === id))).toHaveLength(6)
    expect(historia.filter((id) => DATOS.cartasDeMazoPropio.some((c) => c.id === id))).toHaveLength(12)
    expect(historia.filter((id) => ['anselmo', 'guia', 'guardia'].includes(id)).sort()).toEqual(['anselmo', 'guardia', 'guia'])
    // 6. Muelle de Tortuga: 4 cartas.
    expect(j.zona('muelle')).toHaveLength(4)
    expect(j.zona('mazoMuelle')).toHaveLength(20 - 4)
    // 7. Mano inicial: tantas cartas como el Mando (5).
    expect(j.zona('mano')).toHaveLength(5)
    expect(j.zona('mazoCapitan')).toHaveLength(40 - 5)
    expect(j.decision.motivo.clave).toBe('cambiarMano')
  })

  it('la misma semilla da la misma partida; otra semilla, otra distinta', () => {
    const a = Jugador.partida({ semilla: 42 }).estado
    const b = Jugador.partida({ semilla: 42 }).estado
    const c = Jugador.partida({ semilla: 43 }).estado
    expect(b).toEqual(a)
    expect(c.zonas.mano.map((i) => c.cartas[i]?.id)).not.toEqual(a.zonas.mano.map((i) => a.cartas[i]?.id))
  })

  it('los modos corto y largo cambian la reputación y el mazo de Escenario', () => {
    const corta = Jugador.partida({ semilla: 1, modo: 'corta' })
    expect(corta.estado.reputacionObjetivo).toBe(9)
    expect(corta.zona('mazoEscenario')).toHaveLength(8)
    const larga = Jugador.partida({ semilla: 1, modo: 'larga' })
    expect(larga.estado.reputacionObjetivo).toBe(16)
    expect(larga.zona('mazoEscenario')).toHaveLength(14)
  })

  it('cambio de mano: descartas las que quieras y robas otras tantas, una sola vez', () => {
    const j = Jugador.partida({ semilla: semillaTranquila() })
    const [a, b] = j.zona('mano')
    if (!a || !b) throw new Error('mano vacía')
    j.elegir(a, b)
    expect(j.zona('mano')).toHaveLength(5)
    expect(j.zona('descartesCapitan').sort()).toEqual([a, b].sort())
    expect(j.zona('mazoCapitan')).toHaveLength(33)
    expect(j.estado.turno).toBe(1)
    expect(j.estado.pila.some((t) => t.tipo === 'cambioMano')).toBe(false)
  })

  it('puedes quedarte con la mano inicial', () => {
    const j = Jugador.partida({ semilla: semillaTranquila() })
    const mano = j.zona('mano')
    j.ninguna()
    expect(j.zona('mano')).toEqual(mano)
    expect(j.registro).toContain('Te quedas con tu mano inicial.')
  })
})
