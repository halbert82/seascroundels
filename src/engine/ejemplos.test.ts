// Ejemplos del reglamento (docs/reglamento-v1.0.md) convertidos en pruebas.

import { describe, expect, it } from 'vitest'
import { totalPrueba } from './prueba.ts'
import { Jugador } from './pruebas/situacion.ts'

const MAZO = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'timon', 'ojo']

describe('Ejemplo · Jugar cartas (Bucanero veterano y Cañones de bronce)', () => {
  const inicio = () =>
    Jugador.en({
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['bucanero', 'bronce', 'sable', 'matasanos'],
      mazoMuelle: ['vela', 'casco', 'vigia', 'carpintero'],
    })

  it('si coges los dos, pagas 4 cartas y zarpas con 1 en la mano', () => {
    const j = inicio()
    j.reclutar('bucanero').elegir('ojo', 'soborno')
    j.adquirir('bronce', 'barco').elegir('reflejos', 'timon')
    expect(j.zona('mano')).toEqual(['abordaje'])
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.copia('bronce').vinculadaA).toBe('barco')
  })

  it('si solo reclutas al Bucanero, zarpas con 3 cartas, pero los Cañones se descartan al reponer el muelle', () => {
    const j = inicio()
    j.reclutar('bucanero').elegir('ojo', 'soborno')
    j.terminar()
    expect(j.zona('mano')).toHaveLength(3)
    expect(j.zona('descartesMuelle')).toContain('bronce')
  })
})

describe('Ejemplo · Quedarte en puerto (vuelves a Tortuga con 3 daños y 2 heridas en Diego)', () => {
  const inicio = () =>
    Jugador.en({
      empezarEn: 'quedarseOZarpar',
      barco: { dano: 3 },
      capitan: { heridas: 2 },
      misiones: ['espia-I', 'prueba-I', 'aguada-I'],
      mazoMisiones: ['templo-I'],
    })

  it('Taberna y Astillero lo dejan todo como nuevo', () => {
    const j = inicio().opcion('quedarse').opcion('taberna').opcion('astillero')
    expect(j.estado.danoBarco).toBe(0)
    expect(j.copia('capitan').heridas).toBe(0)
  })

  it('Tablón de encargos y Taberna cambian la misión de Ciudad y curan a Diego', () => {
    const j = inicio().opcion('quedarse').opcion('tablon').elegir('espia-I').opcion('taberna')
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'templo-I'])
    expect(j.zona('mazoMisiones')).toEqual(['espia-I'])
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.estado.danoBarco).toBe(3)
  })
})

describe('Ejemplo · −1 Mando (Chubasco repentino)', () => {
  it('al final del turno robas hasta 4 en vez de 5; al turno siguiente, otra vez hasta 5', () => {
    const j = Jugador.en({
      empezarEn: 'final',
      mano: [],
      mazoCapitan: [...MAZO, ...MAZO],
      escenario: ['calma_ev', 'astillero'],
      temporales: [{ clave: 'menosMando', fuente: 'chubasco', hasta: 'finTurno' }],
    })
    j.ninguna()
    expect(j.zona('mano')).toHaveLength(4)
    j.terminar()
    j.pasarTurnoEnPuerto()
    expect(j.zona('mano')).toHaveLength(5)
  })
})

describe('Ejemplo de juego · el primer turno (versión corregida)', () => {
  it('Inicio y Jugar cartas: Rumores del tesoro, recluta al Bucanero y al Rufián, repone el muelle', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['rumores', 'calma_ev'],
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['marinero_p', 'bucanero', 'sable', 'matasanos'],
      mazoMuelle: ['bronce', 'vela', 'casco', 'vigia', 'carpintero'],
    })
    // Inicio: revela «Rumores del tesoro»; si zarpa este turno, empezará la misión con 1 de Avance.
    expect(j.zona('escenarioEnCurso')).toEqual(['rumores'])
    expect(j.estado.temporales.map((t) => t.clave)).toEqual(['rumores.turno'])
    expect(j.copia('capitan').agotada).toBe(false)

    // Jugar cartas: recluta al Bucanero con «Soborno» y «Ojo avizor», y al Rufián con «Reflejos de gato».
    j.reclutar('bucanero').elegir('soborno', 'ojo')
    j.reclutar('marinero_p').elegir('reflejos')
    expect(j.zona('mano')).toEqual(['abordaje', 'timon'])
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero', 'marinero_p'])

    // Termina el paso: descarta el Sable y el Matasanos y revela cuatro cartas nuevas.
    j.terminar()
    expect(j.zona('descartesMuelle').sort()).toEqual(['matasanos', 'sable'])
    expect(j.zona('muelle')).toEqual(['bronce', 'vela', 'casco', 'vigia'])
    expect(j.decision.motivo.clave).toBe('quedarseOZarpar')
  })

  it('turno completo: zarpa, Niebla espesa, compromete con «Mano firme al timón», «Corriente traicionera», supera, busca los Cañones y roba cuatro', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['rumores', 'calma_ev'],
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['marinero_p', 'bucanero', 'sable', 'matasanos'],
      mazoMuelle: ['vela', 'casco', 'vigia', 'carpintero', 'bronce', 'hamacas'],
      mazoPeligros: ['niebla', 'arrecifes', 'calma'],
      mazoCapitan: ['coraje', 'emboscada', 'estrellas', 'ojo', 'timon'],
    })
    j.reclutar('bucanero').elegir('soborno', 'ojo')
    j.reclutar('marinero_p').elegir('reflejos')
    j.terminar()

    // Zarpa a «Rumbo a mar abierto»: 1 de «Rumores del tesoro» y 1 por tener un Marinero preparado.
    j.zarpar('prueba-I')
    expect(j.registro).toContain('Rumores del tesoro: +1 de Avance (1/3).')
    expect(j.registro).toContain('Tienes un Marinero preparado: +1 de Avance (2/3).')
    expect(j.registro).toContain('Revelas «Niebla»: Niebla espesa (Mar).')

    // Diego (NAV 2) y el Bucanero (NAV 1, sin el +1 de Diego porque Diego se agota al comprometerse) suman 3,
    // «Mano firme al timón» añade sus 2 iconos de NAV antes del Destino y La Sombra del Alba da +1 a las Pruebas de
    // NAV en el Mar: 6 (N12).
    j.comprometer('NAV', ['capitan', 'bucanero'], ['timon'])
    expect(totalPrueba(j.estado)).toBe(6)
    // «Corriente traicionera»: +1, o +2 si la Prueba es de NAV. La Prueba pide 5 y Albert tiene 6.
    expect(j.registro.some((t) => t.startsWith('Destino: «Corriente traicionera»'))).toBe(true)
    expect(j.decision).toMatchObject({ tipo: 'ventanaAccion', motivo: { clave: 'ventanaPrueba', n: 5 } })
    j.seguir()
    expect(j.registro).toContain('Total 6 contra 5: superas la Prueba.')
    expect(j.registro).toContain('¡Superas «Rumbo a mar abierto»!')

    // Recompensa: 1 de reputación y busca una Mejora de barco: los Cañones de bronce.
    expect(j.estado.reputacion).toBe(1)
    j.elegir('bronce')
    expect(j.zona('muelle')).toContain('bronce')

    // Final: se queda «¡Al abordaje!» y roba cuatro para tener cinco.
    j.ninguna()
    expect(j.zona('mano')).toEqual(['abordaje', 'coraje', 'emboscada', 'estrellas', 'ojo'])
  })
})

describe('Ejemplo · Resolver una Prueba (Diego contra el Jaguar)', () => {
  it('Diego compromete con «¡Al abordaje!» (5); «Zarpazo»: +1 y Diego se lleva la herida; 5 contra 4', () => {
    const j = Jugador.en({
      empezarEn: 'quedarseOZarpar',
      escenario: ['calma_ev'],
      misiones: ['aguada-I'],
      mano: ['abordaje'],
      mazoPeligros: ['bestias', 'bestias', 'calma'],
      mazoCapitan: [...MAZO],
    })
    j.zarpar('aguada-I')
    expect(j.registro).toContain('Revelas «Bestias»: Jaguar (Naturaleza).')
    j.comprometer('COM', ['capitan'], ['abordaje'])
    expect(j.registro).toContain('Destino: «Zarpazo» (+1).')
    expect(j.copia('capitan').heridas).toBe(1)
    j.seguir()
    expect(j.registro).toContain('Total 5 contra 4: superas la Prueba.')
  })
})
