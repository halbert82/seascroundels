// Fase 16 (Albert): los Estados y las Ventajas son cartas mini de una reserva aparte. Cada carta dice qué hace y cómo se
// quita. Una prueba por carta nueva o cambiada, además de las de estados.test (lo que ya hacían como fichas).

import { describe, expect, it } from 'vitest'
import { CATALOGO, porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { quitarEstadosBarco } from './estados.ts'
import { ESTADOS_JUNTO_AL_BARCO, ESTADOS_TRIPULANTE, VENTAJAS, cartaDeEstado } from './infoEstados.ts'
import { Jugador } from './pruebas/situacion.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { valor } from './valores.ts'

const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'ojo', 'timon']

describe('Las cartas de Estado y de Ventaja', () => {
  it('13 cartas distintas (297–309) y 58 copias: 6 de cada Estado de Tripulante y de cada Ventaja, 1 de los del Barco y del Desánimo', () => {
    const cartas = CATALOGO.filter((e) => e.tipo === 'estado')
    expect(cartas.map((e) => e.num)).toEqual(Array.from({ length: 13 }, (_, i) => 297 + i))
    expect(cartas.reduce((n, e) => n + e.copias, 0)).toBe(58)
    for (const e of [...ESTADOS_TRIPULANTE, ...VENTAJAS]) expect(porId(cartaDeEstado(e)).copias, e).toBe(6)
    for (const e of ESTADOS_JUNTO_AL_BARCO) expect(porId(cartaDeEstado(e)).copias, e).toBe(1)
    // Cada Estado del motor tiene su carta, con el mismo identificador que sus capacidades.
    expect(cartas.map((e) => e.id).sort()).toEqual([...ESTADOS_TRIPULANTE, ...VENTAJAS, ...ESTADOS_JUNTO_AL_BARCO].map(cartaDeEstado).sort())
  })

  it('6 copias bastan siempre: como mucho hay 6 Tripulantes (Capacidad 4, +1 con las Hamacas, y el Capitán)', () => {
    const extra = [...DATOS.mejorasBarco, ...DATOS.mejorasTripulante, ...DATOS.tesoros].reduce((n, m) => n + Number(/\{\+(\d+) capacidad\}/.exec(m.texto)?.[1] ?? 0), 0)
    expect(DATOS.barco.capacidad + extra + 1).toBeLessThanOrEqual(6)
  })
})

describe('307 · Extenuado', () => {
  it('en la Fase de Inicio no se prepara: en vez de eso, su carta vuelve a la reserva', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma'], tripulacion: [{ id: 'bucanero', agotada: true, estados: ['extenuado'] }, { id: 'vigia', agotada: true }] })
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.estados('bucanero')).toEqual([])
    expect(j.copia('vigia').agotada).toBe(false)
    expect(j.registro).toContain('Bucanero veterano está Extenuado: no se prepara (descartas su carta de Extenuado).')
  })

  it('TODO(regla) P111: si en la Fase de Inicio ya estaba preparado, la carta se queda hasta que vaya a prepararse', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma'], tripulacion: [{ id: 'bucanero', estados: ['extenuado'] }] })
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.estados('bucanero')).toEqual(['extenuado'])
  })

  it('la Taberna lo quita, como cualquier Estado de un Tripulante', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', tripulacion: [{ id: 'bucanero', estados: ['extenuado'] }] })
    j.opcion('quedarse').opcion('taberna')
    expect(j.estados('bucanero')).toEqual([])
  })
})

describe('300 · Desánimo', () => {
  it('al final del turno robas 1 carta menos y su carta vuelve a la reserva (en el mismo turno)', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma', 'pruebas-calma'], mano: [], mazoCapitan: [...MAZO], barco: { estados: ['desanimo'] } })
    const mando = valor(j.estado, { tipo: 'objetivoRobo' }) + 1
    j.pasarTurnoEnPuerto()
    expect(j.zona('mano')).toHaveLength(mando - 1)
    expect(j.estadosBarco).toEqual([])
    expect(j.registro).toContain('Desánimo: robas 1 carta menos y descartas su carta.')
  })

  it('no es un Estado del Barco: el Astillero no lo quita; y no se repite (solo hay una carta)', () => {
    const j = Jugador.en({ barco: { estados: ['viaDeAgua', 'desanimo'] } })
    expect(quitarEstadosBarco(j.estado)).toEqual(['Vía de agua'])
    expect(j.estadosBarco).toEqual(['desanimo'])
  })
})

describe('Las Acciones que quitan Estados (fase 16)', () => {
  it('301 · Envenenado: agota a un Cirujano: descarta esta carta; sin Cirujano preparado, no se ofrece', () => {
    const j = Jugador.en({ tripulacion: ['matasanos', { id: 'bucanero', estados: ['envenenado'] }] })
    expect(j.ofreceCapacidad('estado:envenenado.quitar')).toBe(true)
    j.usar('estado:envenenado.quitar')
    expect(j.copia('matasanos').agotada).toBe(true)
    expect(j.estados('bucanero')).toEqual([])
    const sin = Jugador.en({ tripulacion: [{ id: 'matasanos', agotada: true }, { id: 'bucanero', estados: ['envenenado'] }] })
    expect(sin.ofreceCapacidad('estado:envenenado.quitar')).toBe(false)
  })

  it('302 · Sangrando: agota a otro Tripulante preparado (cualquiera, no él): descarta esta carta', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', estados: ['sangrando'] }, 'vigia'] })
    j.usar('estado:sangrando.quitar')
    // Pueden vendarlo Diego o la Vigía; él no.
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar' } })
    expect(j.decision.tipo === 'elegirCartas' && j.decision.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['capitan', 'vigia'])
    j.elegir('vigia')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.estados('bucanero')).toEqual([])
    // Si solo él está preparado, no se ofrece.
    const solo = Jugador.en({ capitan: { agotada: true }, tripulacion: [{ id: 'bucanero', estados: ['sangrando'] }] })
    expect(solo.ofreceCapacidad('estado:sangrando.quitar')).toBe(false)
  })

  it('303 · Asustado: agota a un Oficial (el Capitán lo es): descarta esta carta', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', estados: ['asustado'] }] })
    j.usar('estado:asustado.quitar')
    expect(j.copia('capitan').agotada).toBe(true)
    expect(j.estados('bucanero')).toEqual([])
  })

  it('297 y 298 · Vía de agua y Velas rotas: agota a un Carpintero: descarta esta carta', () => {
    const j = Jugador.en({ tripulacion: ['carpintero'], barco: { estados: ['viaDeAgua', 'velasRotas'] } })
    j.usar('estado:viaDeAgua.quitar')
    expect(j.copia('carpintero').agotada).toBe(true)
    expect(j.estadosBarco).toEqual(['velasRotas'])
    // Ya no queda Carpintero preparado.
    expect(j.ofreceCapacidad('estado:velasRotas.quitar')).toBe(false)
    const k = Jugador.en({ tripulacion: ['carpintero'], barco: { estados: ['velasRotas'] } })
    k.usar('estado:velasRotas.quitar')
    expect(k.estadosBarco).toEqual([])
  })

  it('el jugador automático quita la Vía de agua con el Carpintero en puerto', () => {
    const j = Jugador.en({ tripulacion: ['carpintero'], mano: [], barco: { estados: ['viaDeAgua'] } })
    const r = jugadorConCriterio()(j.estado, j.decision)
    expect(r).toMatchObject({ tipo: 'accion', accion: { tipo: 'usar', uso: { clave: 'estado:viaDeAgua.quitar' } } })
  })
})

describe('271 · El doblón de la calavera', () => {
  it('su carta de Maldito no se puede descartar mientras el doblón esté en juego', () => {
    const d = porId('doblon')
    expect(d.tipo === 'tesoro' && d.carta.texto).toContain('Tu Capitán tiene una carta de **Maldito** que no se puede descartar mientras esta carta esté en juego.')
  })
})
