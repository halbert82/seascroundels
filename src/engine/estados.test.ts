// Fichas de Estado (fase 6) y de Ventaja (fase 8): cada una con su ejemplo.

import { describe, expect, it } from 'vitest'
import { ESTADOS_BARCO, ESTADOS_TRIPULANTE, INFO_ESTADO, VENTAJAS, esVentaja } from './infoEstados.ts'

import { Jugador, type OpcionesSituacion, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'
import { valor } from './valores.ts'

/** Situación al final del turno (paso de descartar), con Escenario para el turno siguiente. */
function alFinal(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'final', escenario: ['rumores', 'rumores'], mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'ojo', 'timon'], ...op })
}

function mision(mision: CartaId, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [mision], mazoPeligros, ...op })
}

describe('Fase 8 · Estados y Ventajas', () => {
  it('Inspirado y Aguerrido son Ventajas; todo lo demás es Estado, Borracho incluido', () => {
    expect([...VENTAJAS]).toEqual(['inspirado', 'aguerrido'])
    expect([...ESTADOS_TRIPULANTE]).toEqual(['envenenado', 'borracho', 'asustado', 'sangrando', 'buscado', 'maldito'])
    expect([...ESTADOS_BARCO]).toEqual(['viaDeAgua', 'velasRotas', 'perseguido']) // fase 15, quinta ronda: fuera Pólvora mojada
    expect(esVentaja('borracho')).toBe(false)
    expect(esVentaja('aguerrido')).toBe(true)
    for (const e of [...ESTADOS_TRIPULANTE, ...ESTADOS_BARCO]) expect(INFO_ESTADO[e].ventaja).toBeUndefined()
    for (const v of VENTAJAS) expect(INFO_ESTADO[v].ventaja).toBe(true)
  })

  it('una Ventaja tampoco se repite: «Ron para los valientes» a un Aguerrido lo deja Borracho y Aguerrido una sola vez', () => {
    const j = Jugador.en({ mano: ['ron_valientes'], tripulacion: [{ id: 'bucanero', estados: ['aguerrido'] }] })
    j.usar('ron_valientes.jugar').elegir('bucanero')
    expect(j.copia('bucanero').estados).toEqual(['aguerrido', 'borracho'])
  })
})

describe('Estados de los Tripulantes (fase 10b)', () => {
  it('Envenenado: al final de cada turno, 1 herida; curar ya no quita la ficha', () => {
    const j = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['envenenado'] }] })
    j.ninguna()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.estados('bucanero')).toEqual(['envenenado'])
    // Vendas (cura 2): solo heridas; la ficha se queda.
    const k = Jugador.en({ mano: ['vendas', 'ojo'], tripulacion: [{ id: 'bucanero', heridas: 1, estados: ['envenenado'] }] })
    k.usar('vendas.jugar')
    expect(k.estados('bucanero')).toEqual(['envenenado'])
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Borracho: +1 COM, no puede ser asignado a NAV ni EXP, y se quita al final del turno', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['borracho'] }] })
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })).toBe(4)
    expect(() => j.comprometer('NAV', ['bucanero'])).toThrow(/Borracho/)
    const k = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['borracho'] }] })
    k.ninguna()
    expect(k.estados('bucanero')).toEqual([])
  })

  it('Asustado: no puede ser asignado él solo; superar una Prueba no lo quita, el final del turno sí', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', estados: ['asustado'] }] })
    expect(() => j.comprometer('NAV', ['viejo_lobo'])).toThrow(/Asustado/)
    j.comprometer('NAV', ['viejo_lobo', 'capitan']).pasarOfertas().seguir()
    expect(j.estados('viejo_lobo')).toEqual(['asustado'])
    const k = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['asustado'] }] })
    k.ninguna()
    expect(k.estados('bucanero')).toEqual([])
  })

  it('Sangrando: cada vez que se agota, 1 herida; curar ya no lo quita', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['sangrando'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(j.copia('bucanero').heridas).toBe(1)
    const k = Jugador.en({ tripulacion: ['matasanos', { id: 'bucanero', heridas: 1, estados: ['sangrando'] }] })
    k.usar('matasanos.curar')
    expect(k.estados('bucanero')).toEqual(['sangrando'])
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Buscado: no puede ser asignado en Ciudad (sí en el Mar); se quita descartando 1 carta en la Fase de Reclutamiento', () => {
    const j = mision('pruebas-ciu4', ['ley', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    expect((j.decision as { tripulantes: string[] }).tripulantes).not.toContain(j.inst('bucanero'))
    expect(() => j.comprometer('COM', ['bucanero'])).toThrow()
    const k = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    k.comprometer('NAV', ['bucanero'])
    expect(k.copia('bucanero').agotada).toBe(true)
    const m = Jugador.en({ mano: ['ojo', 'timon'], tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    m.usar('estado:buscado.quitar').elegir('ojo')
    expect(m.estados('bucanero')).toEqual([])
    expect(m.zona('mano')).toEqual(['timon'])
  })

  it('Maldito: −1 al total de cada Prueba a la que esté asignado; se quita al superar una de ellas', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['maldito'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(2) // NAV 1 + 1 de Diego + 1 del Barco − 1
    // No participa en la Prueba superada: sigue Maldito. Participa: se le quita (en cualquier Prueba, no solo Sobrenatural).
    const k = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', { id: 'bucanero', estados: ['maldito'] }] })
    k.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(k.estados('bucanero')).toEqual(['maldito'])
    const m = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', { id: 'bucanero', estados: ['maldito'] }] })
    m.comprometer('NAV', ['viejo_lobo', 'bucanero']).pasarOfertas().seguir()
    expect(m.estados('bucanero')).toEqual([])
  })

  it('Maldito ya no atrae las heridas de los Destinos', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'rivales', 'calma'], { tripulacion: ['viejo_lobo', { id: 'bucanero', estados: ['maldito'] }] })
    j.comprometer('NAV', ['viejo_lobo', 'bucanero']).pasarOfertas()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir' } })
  })

  it('Inspirado: +1 al total de cada Prueba a la que esté asignado; no se gasta, se quita al final del turno', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['inspirado'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // NAV 1 + 1 de Diego + 1 del Barco + 1
    expect(j.estados('bucanero')).toEqual(['inspirado'])
    const k = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['inspirado'] }] })
    k.ninguna()
    expect(k.estados('bucanero')).toEqual([])
  })

  it('Aguerrido: es asignado sin agotarse y la ficha se quita; no caduca al final del turno', () => {
    const j = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['aguerrido', 'sangrando'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('bucanero').heridas).toBe(0) // no se agota: Sangrando no hiere
    expect(j.estados('bucanero')).toEqual(['sangrando'])
    const k = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['aguerrido'] }] })
    k.ninguna()
    expect(k.estados('bucanero')).toEqual(['aguerrido'])
  })

  it('los Estados duran entre misiones', () => {
    const j = mision('pruebas-mar5', ['calma', 'calma', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado', 'envenenado'] }] })
    j.retirarse()
    expect(j.estados('bucanero')).toEqual(['buscado', 'envenenado'])
  })
})

describe('Estados del Barco (fase 10b)', () => {
  it('Vía de agua: al final de cada carta de Peligro en el Mar, 1 daño, salvo que agotes a un Tripulante para achicar', () => {
    const j = mision('pruebas-mar5', ['calma', 'calma', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elegirEfectos' } })
    j.opcion('1')
    expect(j.estado.danoBarco).toBe(1)
    const k = mision('pruebas-mar5', ['calma', 'calma', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    k.opcion('0')
    expect(k.estado.danoBarco).toBe(0)
    expect(k.copia('capitan').agotada).toBe(true)
    // Fuera del Mar no hace nada.
    const m = mision('pruebas-ciu4', ['calma', 'calma', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    expect(m.decision.motivo.clave).toBe('trasEncuentro')
  })

  it('Vía de agua: reparar no la quita; fase 15, quinta ronda: el Carpintero solo repara (solo la quita el Astillero)', () => {
    const j = Jugador.en({ mano: ['reparacion'], barco: { dano: 2, estados: ['viaDeAgua'] } })
    j.usar('reparacion.jugar')
    expect(j.estado.danoBarco).toBe(0)
    expect(j.estadosBarco).toEqual(['viaDeAgua'])
    const k = Jugador.en({ tripulacion: ['carpintero'], barco: { dano: 1, estados: ['viaDeAgua'] } })
    k.usar('carpintero.reparar')
    expect(k.estadosBarco).toEqual(['viaDeAgua'])
    expect(k.estado.danoBarco).toBe(0)
    // Sin daño que reparar, el Carpintero no se ofrece (aunque haya Vía de agua).
    const v = Jugador.en({ tripulacion: ['carpintero'], barco: { estados: ['viaDeAgua'] } })
    expect(v.ofreceCapacidad('carpintero.reparar')).toBe(false)
  })

  it('Velas rotas: −1 al total de las Pruebas de NAV en el Mar; Distancias 1 mayores; el Astillero la quita', () => {
    const m = mision('pruebas-mar5', ['chubasco', 'chubasco', 'calma'], { tripulacion: ['bucanero'], barco: { estados: ['velasRotas'] } })
    m.comprometer('NAV', ['bucanero'])
    expect(totalSinDestinoPrueba(m.estado)).toBe(2) // NAV 1 + 1 de Diego + 1 del Barco − 1
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', barco: { estados: ['velasRotas'] } })
    expect(valor(j.estado, { tipo: 'distancia', mision: j.inst('aguada-I') })).toBe(1)
    j.opcion('quedarse').opcion('astillero')
    expect(j.estadosBarco).toEqual([])
  })

  it('Perseguido: los encuentros de tipo Armada reciben +1; se quita al superar uno', () => {
    const j = mision('pruebas-mar5', ['p2_sebusca', 'chubasco', 'calma', 'calma'], { tripulacion: ['viejo_lobo'], barco: { estados: ['perseguido'] } })
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'NAV', claves: ['Armada', 'Barco'] })).toBe(4)
    j.comprometer('NAV', ['viejo_lobo', 'capitan']).pasarOfertas().seguir()
    expect(j.estadosBarco).toEqual([])
    expect(j.registro).toContain('El Barco ya no está Perseguido (superas un encuentro de tipo Armada).')
  })

  it('fase 15, quinta ronda: fuera Pólvora mojada; los Cañones se preparan en la Fase de Inicio', () => {
    expect((ESTADOS_BARCO as readonly string[]).includes('polvoraMojada')).toBe(false)
    const k = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    expect(k.copia('bronce').agotada).toBe(false)
  })
})
