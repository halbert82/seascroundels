// Partidas guardadas de versiones anteriores: cuáles se convierten y cuáles no se pueden continuar.

import { describe, expect, it } from 'vitest'
import { deserializar, serializar } from './guardado.ts'
import { nuevaPartida } from './preparacion.ts'
import type { Estado, InstId } from './tipos.ts'

const inst = (s: Estado, id: string) => {
  const e = Object.entries(s.cartas).find(([, c]) => c.id === id)
  if (!e) throw new Error(`no hay ${id}`)
  return e[0] as InstId
}
const ids = (s: Estado, zona: keyof Estado['zonas']) => s.zonas[zona].map((i) => s.cartas[i]?.id).sort()
const mover = (s: Estado, i: InstId, a: keyof Estado['zonas']) => {
  for (const z of Object.keys(s.zonas) as (keyof Estado['zonas'])[]) s.zonas[z] = s.zonas[z].filter((x) => x !== i)
  s.zonas[a].push(i)
}

/**
 * Una partida nueva convertida en una de antes de la fase 12: El espía y El barco fantasma con tres capítulos (el II de
 * hoy era el III y había otro II en medio); La Flota y El templo, también con tres (su IV era el III).
 */
function partidaDeAntes(semilla = 12): Estado {
  const s = nuevaPartida({ semilla })
  for (const t of ['flota', 'templo']) {
    const nuevo = inst(s, `${t}-III`)
    s.zonas.mazoHistoria = s.zonas.mazoHistoria.filter((x) => x !== nuevo)
    delete s.cartas[nuevo]
    s.cartas[inst(s, `${t}-IV`)]!.id = `${t}-III`
  }
  for (const t of ['espia', 'fantasma']) {
    s.cartas[inst(s, `${t}-II`)]!.id = `${t}-III`
    const ii: InstId = `i${s.sigInst++}`
    s.cartas[ii] = { id: `${t}-II`, agotada: false, heridas: 0, avance: 0, vinculadaA: null, entrenamiento: [] }
    s.zonas.mazoHistoria.push(ii)
  }
  return s
}

describe('Fase 12 · partidas guardadas con las travesías de antes', () => {
  it('sin empezar esas travesías: queda igual que una partida nueva (II del espía y del fantasma; III y IV de la Flota y el templo)', () => {
    const s = deserializar(serializar(partidaDeAntes()))
    const nueva = nuevaPartida({ semilla: 12 })
    for (const z of ['mazoMisiones', 'misionesDisponibles', 'mazoHistoria'] as const) expect(ids(s, z), z).toEqual(ids(nueva, z))
    expect(Object.values(s.cartas).some((c) => c.id === 'espia-III' || c.id === 'fantasma-III')).toBe(false)
  })

  it('el capítulo II de antes, pendiente en el mazo de Misiones, pasa a ser el II de hoy (y el III de antes sobra)', () => {
    const s = partidaDeAntes()
    mover(s, inst(s, 'espia-I'), 'misionesSuperadas')
    mover(s, inst(s, 'espia-II'), 'mazoMisiones')
    const r = deserializar(serializar(s))
    expect(ids(r, 'mazoMisiones').filter((id) => id?.startsWith('espia'))).toEqual(['espia-II'])
    expect(ids(r, 'mazoHistoria').filter((id) => id?.startsWith('espia'))).toEqual([])
    expect(Object.values(r.cartas).filter((c) => c.id.startsWith('espia-')).map((c) => c.id).sort()).toEqual(['espia-I', 'espia-II'])
  })

  it('el capítulo II de antes ya superado: el III de antes (la goleta, el camarote) pasa a ser el II', () => {
    const s = partidaDeAntes()
    mover(s, inst(s, 'fantasma-I'), 'misionesSuperadas')
    mover(s, inst(s, 'fantasma-II'), 'misionesSuperadas')
    const camarote = inst(s, 'fantasma-III')
    mover(s, camarote, 'misionesDisponibles')
    const r = deserializar(serializar(s))
    expect(r.cartas[camarote]?.id).toBe('fantasma-II')
    expect(r.zonas.misionesDisponibles).toContain(camarote)
    expect(ids(r, 'misionesSuperadas').filter((id) => id?.startsWith('fantasma'))).toEqual(['fantasma-I'])
  })

  it('la Flota a mitad de travesía: su III de antes es el IV y el III nuevo espera en el mazo de historia', () => {
    const s = partidaDeAntes()
    const huida = inst(s, 'flota-III')
    mover(s, huida, 'misionesDisponibles')
    const r = deserializar(serializar(s))
    expect(r.cartas[huida]?.id).toBe('flota-IV')
    expect(ids(r, 'mazoHistoria')).toContain('flota-III')
  })

  it('a mitad de «Seguirle por los muelles» o del antiguo «A bordo del fantasma»: no se puede continuar, y lo dice', () => {
    for (const t of ['espia', 'fantasma']) {
      const s = partidaDeAntes()
      const ii = inst(s, `${t}-II`)
      mover(s, ii, 'misionesDisponibles')
      s.mision = { carta: ii } as Estado['mision']
      expect(() => deserializar(serializar(s)), t).toThrow(/capítulo que ya no existe/)
    }
  })

  it('una partida de hoy no cambia', () => {
    const s = nuevaPartida({ semilla: 5 })
    expect(deserializar(serializar(s))).toEqual(s)
  })
})

describe('Fase 14 · partidas guardadas con rehenes', () => {
  it('los rehenes y los Tripulantes incautados vuelven a la tripulación', () => {
    const s = nuevaPartida({ semilla: 5 })
    const a = s.zonas.mazoMuelle.find((c) => s.cartas[c]?.id === 'bucanero') ?? s.zonas.mazoMuelle[0]!
    const b = s.zonas.mazoMuelle.find((c) => c !== a && s.cartas[c]?.id !== 'bucanero')!
    const viejo = JSON.parse(serializar(s)) as Estado & { zonas: Record<string, InstId[]> }
    viejo.zonas.mazoMuelle = viejo.zonas.mazoMuelle.filter((c) => c !== a && c !== b)
    viejo.zonas.rehenes = [a]
    viejo.zonas.incautadas = [b]
    viejo.incautadas = { [b]: { zona: 'tripulacion' as never } }
    const t = deserializar(JSON.stringify(viejo))
    expect('rehenes' in t.zonas).toBe(false)
    expect(t.zonas.tripulacion).toEqual(expect.arrayContaining([a, b]))
    expect(t.zonas.incautadas).toEqual([])
  })

  it('una partida guardada a mitad de una captura no se puede continuar', () => {
    const s = nuevaPartida({ semilla: 5 })
    const viejo = JSON.parse(serializar(s)) as Estado & { zonas: Record<string, InstId[]> }
    viejo.zonas.rehenes = []
    ;(viejo.pila as unknown[]).push({ id: 9999, tipo: 'rehen', entre: [] })
    expect(() => deserializar(JSON.stringify(viejo))).toThrow()
  })
})
