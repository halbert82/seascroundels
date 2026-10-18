import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'

describe('El turno · Inicio', () => {
  it('revela la carta de Escenario de arriba y la aplica', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['feria', 'pruebas-calma'], tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    expect(j.zona('escenarioEnCurso')).toEqual(['feria'])
    expect(j.zona('mazoEscenario')).toEqual(['pruebas-calma'])
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.estado.turno).toBe(1)
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('prepara todas las cartas agotadas y recarga la munición hasta su máximo', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['pruebas-calma'],
      capitan: { agotada: true },
      tripulacion: [{ id: 'bucanero', agotada: true }],
      barco: { mejoras: [{ id: 'bronce', municion: 0, agotada: true }] },
    })
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('bronce').agotada).toBe(false)
    expect(j.copia('bronce').municion).toBe(2)
  })

  it('la Pólvora del Rey sube en 1 la munición máxima de los Cañones', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma'], barco: { mejoras: ['bronce', 'polvora_rey'] } })
    expect(j.copia('bronce').municion).toBe(3)
  })

  it('al final del turno la carta de Escenario pasa a sus descartes', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma', 'sanjuan'], mazoCapitan: ['ojo', 'ojo', 'timon'] })
    j.pasarTurnoEnPuerto()
    expect(j.zona('descartesEscenario')).toEqual(['pruebas-calma'])
    expect(j.zona('escenarioEnCurso')).toEqual(['sanjuan'])
    expect(j.estado.turno).toBe(2)
  })
})

describe('El turno · Jugar cartas', () => {
  it('al terminar el paso se descarta el muelle entero y se repone', () => {
    const j = Jugador.en({ muelle: ['sable', 'matasanos'], mazoMuelle: ['casco', 'vela', 'hamacas', 'bandera', 'chalupa'] })
    j.terminar()
    expect(j.zona('descartesMuelle')).toEqual(['matasanos', 'sable'])
    expect(j.zona('muelle')).toEqual(['casco', 'vela', 'hamacas', 'bandera'])
  })

  it('si se acaba el mazo de muelle, se baraja su pila de descartes sin perder ningún día', () => {
    const j = Jugador.en({
      muelle: ['sable'],
      mazoMuelle: ['casco', 'vela'],
      descartesMuelle: ['hamacas'],
      escenario: ['sanjuan', 'pruebas-calma'],
    })
    j.terminar()
    expect(j.zona('muelle')).toHaveLength(4)
    expect(j.zona('muelle').slice(0, 2)).toEqual(['casco', 'vela'])
    expect(j.zona('muelle').slice(2).sort()).toEqual(['hamacas', 'sable'])
    expect(j.zona('mazoEscenario')).toEqual(['sanjuan', 'pruebas-calma'])
  })
})

describe('El turno · Final', () => {
  it('puedes descartar las cartas que quieras y luego robas hasta tu Mando', () => {
    const j = Jugador.en({ empezarEn: 'final', mano: ['ojo', 'timon'], mazoCapitan: ['abordaje', 'coraje', 'emboscada', 'estrellas', 'soborno'] })
    expect(j.decision.motivo.clave).toBe('descartarFinal')
    j.elegir('ojo')
    expect(j.zona('mano')).toEqual(['timon', 'abordaje', 'coraje', 'emboscada', 'estrellas'])
    expect(j.zona('descartesCapitan')).toEqual(['ojo'])
  })

  it('si tienes que robar y el mazo está vacío, barajas los descartes y pierdes un día', () => {
    const j = Jugador.en({
      empezarEn: 'final',
      mano: ['ojo', 'timon', 'abordaje'],
      mazoCapitan: ['coraje'],
      descartesCapitan: ['emboscada', 'estrellas'],
      escenario: ['sanjuan', 'pruebas-calma'],
    })
    j.ninguna()
    expect(j.zona('mano')).toHaveLength(5)
    expect(j.zona('mano').slice(0, 4)).toEqual(['ojo', 'timon', 'abordaje', 'coraje'])
    expect(j.zona('mazoCapitan')).toHaveLength(1)
    expect(j.zona('descartesEscenario')).toEqual(['sanjuan'])
    expect(j.registro.some((t) => t.startsWith('Pierdes un día'))).toBe(true)
  })

  it('perder un día sin cartas de Escenario no hace nada', () => {
    const j = Jugador.en({ empezarEn: 'final', mano: [], mazoCapitan: [], descartesCapitan: ['ojo'], escenario: [] })
    j.ninguna()
    expect(j.registro).toContain('Pierdes un día, pero ya no quedan cartas de Escenario.')
  })

  it('los efectos «este turno» y los límites «una vez por turno» terminan con el turno', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['bando', 'pruebas-calma'],
      mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'abordaje', 'abordaje', 'estrellas', 'estrellas'],
    })
    expect(j.estado.temporales.map((t) => t.clave)).toEqual(['bando.turno'])
    j.estado.usos['turno:i1/prueba'] = 1
    j.pasarTurnoEnPuerto()
    expect(j.estado.temporales).toEqual([])
    expect(j.estado.usos).toEqual({})
  })
})
