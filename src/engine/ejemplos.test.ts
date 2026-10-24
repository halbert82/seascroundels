// Ejemplos del reglamento (docs/reglamento-v1.0.md) convertidos en pruebas.

import { describe, expect, it } from 'vitest'

import { Jugador, totalSinDestinoPrueba } from './pruebas/situacion.ts'

const MAZO = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'timon', 'ojo']

describe('Ejemplo · Jugar cartas (Bucanero veterano y Cañones de bronce)', () => {
  const inicio = () =>
    Jugador.en({
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['bucanero', 'bronce', 'sable', 'carpintero'],
      mazoMuelle: ['hamacas', 'bandera', 'vigia', 'canonero'],
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
      escenario: ['pruebas-calma', 'pruebas-calma'],
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
  // Mazos de inicio «Pólvora y abordaje»: la Carne de cañón en lugar del Rufián de cubierta, el Carpintero de a bordo en
  // lugar del Matasanos y, al reponer, las Hamacas, los Cañones de bronce, la Vigía y el Cañonero.
  it('Inicio y Jugar cartas: Rumores del tesoro, recluta al Bucanero y a la Carne de cañón, repone el muelle', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['rumores', 'pruebas-calma'],
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['carne_canon', 'bucanero', 'sable', 'carpintero'],
      mazoMuelle: ['hamacas', 'bronce', 'vigia', 'canonero', 'bandera'],
    })
    // Inicio: revela «Rumores del tesoro»; si zarpa este turno, empezará la misión con 1 de Avance.
    expect(j.zona('escenarioEnCurso')).toEqual(['rumores'])
    expect(j.estado.temporales.map((t) => t.clave)).toEqual(['rumores.turno'])
    expect(j.copia('capitan').agotada).toBe(false)

    // Jugar cartas: recluta al Bucanero con «Soborno» y «Ojo avizor», y a la Carne de cañón con «Reflejos de gato».
    j.reclutar('bucanero').elegir('soborno', 'ojo')
    j.reclutar('carne_canon').elegir('reflejos')
    expect(j.zona('mano')).toEqual(['abordaje', 'timon'])
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero', 'carne_canon'])

    // Termina el paso: descarta el Sable y el Carpintero y revela cuatro cartas nuevas.
    j.terminar()
    expect(j.zona('descartesMuelle').sort()).toEqual(['carpintero', 'sable'])
    expect(j.zona('muelle')).toEqual(['hamacas', 'bronce', 'vigia', 'canonero'])
    expect(j.decision.motivo.clave).toBe('quedarseOZarpar')
  })

  it('turno completo: zarpa, «Turbonada a popa», asigna con «Mano firme al timón», el Destino de la carta «Arrecife», supera con su Gesta, adquiere gratis las Hamacas, paga 1 herida y roba cuatro (fase 11)', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['rumores', 'pruebas-calma'],
      mano: ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno'],
      muelle: ['carne_canon', 'bucanero', 'sable', 'carpintero'],
      mazoMuelle: ['hamacas', 'bronce', 'vigia', 'canonero', 'bandera', 'loro'],
      mazoPeligros: ['p2_turbonada', 'p2_arrecife', 'p2_calma'],
      mazoCapitan: ['coraje', 'emboscada', 'estrellas', 'ojo', 'timon'],
    })
    j.reclutar('bucanero').elegir('soborno', 'ojo')
    j.reclutar('carne_canon').elegir('reflejos')
    j.terminar()
    expect(j.zona('muelle')).toEqual(['hamacas', 'bronce', 'vigia', 'canonero'])

    // Zarpa a «Rumbo a mar abierto»: 1 de «Rumores del tesoro».
    j.zarpar('prueba-I')
    expect(j.registro).toContain('Rumores del tesoro: +1 de Avance (1/3).')
    expect(j.registro).toContain('Revelas «Turbonada»: Turbonada a popa (Mar).')

    // Diego (NAV 2) y el Bucanero (NAV 1, sin el +1 de Diego porque Diego se agota al comprometerse) suman 3,
    // «Mano firme al timón» añade sus 2 iconos de NAV antes del Destino y La Sombra del Alba da +1 a las Pruebas de
    // NAV en el Mar: 6 (N12).
    j.comprometer('NAV', ['capitan', 'bucanero'], ['timon'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(6)
    // El Destino de la carta «Arrecife»: −1 (0 con un Vigía asignado). La Prueba pide 4 y el total queda en 6 − 1 = 5.
    expect(j.registro).toContain('Destino de la carta «Arrecife»: −1.')
    expect(j.decision).toMatchObject({ tipo: 'ventanaAccion', motivo: { clave: 'ventanaPrueba', n: 4 } })
    j.seguir()
    expect(j.registro).toContain('Total 5 contra 4: superas la Prueba.')
    // Por superar la Turbonada, 1 de Avance más; con sus 3, la misión llega a 5 de 3. (Revisión de Albert de los Peligros:
    // la carta ya no va al fondo del mazo: se descarta como cualquier otra.)
    expect(j.registro).toContain('Turbonada: +1 de Avance (2/3).')
    expect(j.registro).toContain('Ganas 3 de Avance (5/3).')
    expect(j.registro.some((t) => t.includes('va al fondo del mazo de Peligros'))).toBe(false)
    expect(j.zona('mazoPeligros')).not.toContain('p2_turbonada')
    expect(j.zona('descartesPeligros')).toContain('p2_turbonada')
    expect(j.registro).toContain('¡Superas «Rumbo a mar abierto»!')

    // Recompensa (fase 11): la misión no da reputación, pero como el Barco no tiene ningún daño, la Gesta da 1.
    // Adquiere sin coste una Mejora del muelle de coste 1 o menos: las Hamacas en el entrepuente (el muelle repuesto tiene
    // las Hamacas, los Cañones de bronce, la Vigía y el Cañonero; los Cañones cuestan 2 y el Cañonero, de coste 1, no es
    // una Mejora). Su precio: inflige 1 herida a un Tripulante, y el jugador elige a Diego.
    expect(j.registro).toContain('¡Gesta cumplida!: +1 de reputación.')
    expect(j.estado.reputacion).toBe(1)
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'gratisDelMuelle' } })
    expect((j.decision as { candidatas: string[] }).candidatas).toEqual([j.inst('hamacas')])
    j.elegir('hamacas')
    expect(j.zona('mejoras')).toEqual(['hamacas'])
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: 1 } })
    j.elegir('capitan')
    expect(j.copia('capitan').heridas).toBe(1)

    // Final: se queda «¡Al abordaje!» y roba cuatro para tener cinco. Con las Hamacas, el Barco lleva 5 Tripulantes
    // además de Diego (Capacidad 4 + 1).
    j.ninguna()
    expect(j.zona('mano')).toEqual(['abordaje', 'coraje', 'emboscada', 'estrellas', 'ojo'])
    expect(j.valor({ tipo: 'capacidad' })).toBe(5)
  })
})

describe('Ejemplo · Resolver una Prueba (Diego contra el Jaguar)', () => {
  it('Diego asignado con «¡Al abordaje!» (5); el Destino de «Bestias» (−1) hiere a Diego; 4 contra 3', () => {
    const j = Jugador.en({
      empezarEn: 'quedarseOZarpar',
      escenario: ['pruebas-calma'],
      misiones: ['aguada-I'],
      mano: ['abordaje'],
      mazoPeligros: ['bestias', 'bestias', 'calma'],
      mazoCapitan: [...MAZO],
    })
    j.zarpar('aguada-I')
    expect(j.registro).toContain('Revelas «Bestias»: Jaguar (Naturaleza).')
    j.comprometer('COM', ['capitan'], ['abordaje'])
    expect(j.registro).toContain('Destino de la carta «Bestias»: −1.')
    expect(j.copia('capitan').heridas).toBe(1)
    j.seguir()
    expect(j.registro).toContain('Total 4 contra 3: superas la Prueba.')
  })
})
