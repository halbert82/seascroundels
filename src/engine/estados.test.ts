// Fichas de Estado (fase 6): cada una con su ejemplo.

import { describe, expect, it } from 'vitest'
import { dificultadPrueba, totalPrueba } from './prueba.ts'
import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'
import { valor } from './valores.ts'

/** Situación al final del turno (paso de descartar), con Escenario para el turno siguiente. */
function alFinal(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'final', escenario: ['rumores', 'rumores'], mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'ojo', 'timon'], ...op })
}

function mision(mision: CartaId, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [mision], mazoPeligros, ...op })
}

describe('Estados de los Tripulantes', () => {
  it('Envenenado: al final de cada turno, 1 herida; curar quita la ficha en vez de la herida', () => {
    const j = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['envenenado'] }] })
    j.ninguna()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.estados('bucanero')).toEqual(['envenenado'])
    // Vendas (cura 2, repartidas): con el Bucanero solo, quita la ficha y 1 herida.
    const k = Jugador.en({ mano: ['vendas', 'ojo'], tripulacion: [{ id: 'bucanero', heridas: 1, estados: ['envenenado'] }] })
    k.usar('vendas.jugar')
    expect(k.estados('bucanero')).toEqual([])
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Envenenado: curar 1 solo quita la ficha', () => {
    const j = Jugador.en({ tripulacion: ['matasanos', { id: 'bucanero', heridas: 1, estados: ['envenenado'] }] })
    // El Matasanos cura 2: quita la ficha y la herida.
    j.usar('matasanos.curar')
    expect(j.estados('bucanero')).toEqual([])
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Borracho: +1 COM, no puede comprometerse a NAV ni EXP, y se quita al final del turno', () => {
    const j = mision('maracaibo-II', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['borracho'] }] })
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })).toBe(4)
    expect(() => j.comprometer('NAV', ['bucanero'])).toThrow(/Borracho/)
    const k = alFinal({ tripulacion: [{ id: 'bucanero', estados: ['borracho'] }] })
    k.ninguna()
    expect(k.estados('bucanero')).toEqual([])
  })

  it('Aturdido: la próxima vez que se comprometa no suma, y se quita entonces', () => {
    const j = mision('maracaibo-II', ['chubasco', 'chubasco', 'chubasco', 'chubasco'], { tripulacion: [{ id: 'viejo_lobo', estados: ['aturdido'] }] })
    j.comprometer('NAV', ['viejo_lobo'])
    expect(totalPrueba(j.estado)).toBe(1) // solo el Barco
    expect(j.estados('viejo_lobo')).toEqual([])
  })

  it('Asustado: no puede comprometerse solo; se quita al superar una Prueba en la que participe', () => {
    const j = mision('maracaibo-II', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', estados: ['asustado'] }] })
    expect(() => j.comprometer('NAV', ['viejo_lobo'])).toThrow(/Asustado/)
    j.comprometer('NAV', ['viejo_lobo', 'capitan']).pasarOfertas().seguir()
    expect(j.estados('viejo_lobo')).toEqual([])
  })

  it('Sangrando: cada vez que se agota, 1 herida; curar 1 lo quita', () => {
    const j = mision('maracaibo-II', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['sangrando'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(j.copia('bucanero').heridas).toBe(1)
    const k = Jugador.en({ tripulacion: ['matasanos', { id: 'bucanero', heridas: 1, estados: ['sangrando'] }] })
    k.usar('matasanos.curar')
    expect(k.estados('bucanero')).toEqual([])
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Buscado: en Ciudad, los encuentros Guardia y Militar reciben +1 si participa', () => {
    const j = mision('ladron-I', ['ley', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    j.comprometer('COM', ['bucanero'])
    expect(dificultadPrueba(j.estado)).toBe(4) // COM 3 + 1
    const k = mision('ladron-I', ['ley', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    k.comprometer('COM', ['capitan'])
    expect(dificultadPrueba(k.estado)).toBe(3)
  })

  it('Maldito: cuando un Destino hiere a «uno de los comprometidos», tiene que ser él; se quita solo si participa en la Prueba Sobrenatural que se supera (P15)', () => {
    const j = mision('maracaibo-II', ['chubasco', 'rivales', 'calma'], { tripulacion: ['viejo_lobo', { id: 'bucanero', estados: ['maldito'] }] })
    j.comprometer('NAV', ['viejo_lobo', 'bucanero']).pasarOfertas()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('viejo_lobo').heridas).toBe(0)
    // No participa: sigue Maldito.
    const k = mision('ladron-I', ['sirenas', 'chubasco', 'calma'], { tripulacion: ['baqueano', { id: 'bucanero', estados: ['maldito'] }] })
    k.comprometer('EXP', ['baqueano']).pasarOfertas().seguir().pasarOfertas()
    expect(k.estados('bucanero')).toEqual(['maldito'])
    // Participa: se le quita.
    const m = mision('ladron-I', ['sirenas', 'chubasco', 'calma'], { tripulacion: ['baqueano', { id: 'bucanero', estados: ['maldito'] }] })
    m.comprometer('EXP', ['baqueano', 'bucanero']).pasarOfertas().seguir().pasarOfertas()
    expect(m.estados('bucanero')).toEqual([])
  })

  it('Encadenado: no puede comprometerse ni usar capacidades; una Prueba de COM o EXP 3 en una ventana de acción lo libera', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'carpintero', estados: ['encadenado'] }, 'bucanero'], barco: { dano: 1 }, mazoPeligros: ['chubasco', 'calma'] })
    expect(j.ofreceCapacidad('carpintero.reparar')).toBe(false)
    j.usar('estado:encadenado.liberar')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', motivo: { clave: 'comprometerAccion' } })
    expect((j.decision as { tripulantes: string[] }).tripulantes).not.toContain(j.inst('carpintero'))
    j.comprometer('COM', ['bucanero']).seguir() // COM 2 + 1 de Diego = 3
    expect(j.estados('carpintero')).toEqual([])
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('Inspirado: +1 en su próxima Prueba', () => {
    const j = mision('maracaibo-II', ['chubasco', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['inspirado'] }] })
    j.comprometer('NAV', ['bucanero'])
    expect(totalPrueba(j.estado)).toBe(4) // NAV 1 + 1 de Diego + 1 del Barco + 1
    expect(j.estados('bucanero')).toEqual([])
  })

  it('Aguerrido: evita la próxima herida', () => {
    const j = mision('maracaibo-II', ['escollos', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['aguerrido'] }] })
    j.comprometer('EXP', ['bucanero']).seguir() // Bajíos: falla, 1 daño y pierde una Mejora; sin heridas
    const k = mision('aguada-I', ['escollos', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['aguerrido'] }] })
    k.comprometer('EXP', ['bucanero']).seguir() // Barranco: 1 herida, que evita
    expect(k.copia('bucanero').heridas).toBe(0)
    expect(k.estados('bucanero')).toEqual([])
    void j
  })

  it('un Tripulante no puede tener dos veces el mismo Estado, y los Estados duran entre misiones', () => {
    const j = mision('ladron-I', ['p2_niebla', 'chubasco', 'calma', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    j.comprometer('EXP', ['bucanero']).seguir()
    expect(j.estados('bucanero')).toEqual(['buscado'])
    expect(j.registro).toContain('Bucanero veterano ya estaba Buscado.')
    j.retirarse()
    expect(j.estados('bucanero')).toEqual(['buscado'])
  })
})

describe('Estados del Barco', () => {
  it('Vía de agua: al final de cada carta de Peligro en el Mar, 1 daño; reparar 1 quita la ficha', () => {
    const j = mision('maracaibo-II', ['calma', 'calma', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    expect(j.estado.danoBarco).toBe(1)
    const k = Jugador.en({ tripulacion: ['carpintero'], barco: { dano: 1, estados: ['viaDeAgua'] } })
    k.usar('carpintero.reparar')
    expect(k.estadosBarco).toEqual([])
    expect(k.estado.danoBarco).toBe(1)
  })

  it('Incendio a bordo: al revelar cada carta de Peligro en el Mar, 1 daño; se apaga agotando a un Tripulante', () => {
    const j = mision('maracaibo-II', ['calma', 'calma', 'calma'], { barco: { estados: ['incendio'] }, tripulacion: ['bucanero'] })
    expect(j.estado.danoBarco).toBe(1)
    j.usar('estado:incendio.apagar').elegir('bucanero')
    expect(j.estadosBarco).toEqual([])
    expect(j.copia('bucanero').agotada).toBe(true)
    j.seguir()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Incendio a bordo: fuera del Mar no hace daño (P4)', () => {
    const j = mision('ladron-I', ['calma', 'calma', 'calma'], { barco: { estados: ['incendio'] } })
    expect(j.estado.danoBarco).toBe(0)
  })

  it('Incendio a bordo: en tierra, si acaba la misión sin apagarlo, también pierdes una Mejora de barco (P4)', () => {
    const j = mision('ladron-I', ['calma', 'calma'], { barco: { estados: ['incendio'], mejoras: ['vela', 'hamacas'] } })
    j.retirarse()
    j.opcion('dejar')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'perderMejora' } })
  })

  it('Incendio a bordo: si no se apaga antes de acabar la misión, pierdes una Mejora de barco (y la ficha sigue)', () => {
    const j = mision('maracaibo-II', ['calma', 'calma'], { barco: { estados: ['incendio'], mejoras: ['vela', 'hamacas'] } })
    j.retirarse()
    j.opcion('dejar')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'perderMejora' } })
    j.elegir('vela')
    expect(j.zona('mejoras')).toEqual(['hamacas'])
    expect(j.estadosBarco).toEqual(['incendio'])
  })

  it('Velas rotas: Distancias 1 mayores; el Astillero la quita (y la Pólvora mojada)', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', barco: { estados: ['velasRotas', 'polvoraMojada'] } })
    expect(valor(j.estado, { tipo: 'distancia', mision: j.inst('aguada-I') })).toBe(1)
    j.opcion('quedarse').opcion('astillero')
    expect(j.estadosBarco).toEqual([])
  })

  it('Perseguido: tu próxima misión de Mar empieza con un Peligro de más, sin poder retirarte entre los dos', () => {
    const j = mision('maracaibo-II', ['calma', 'calma', 'calma'], { barco: { estados: ['perseguido'] } })
    // Dos «Mar en calma» seguidas: la primera ventana de retirarse llega tras las dos.
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
    expect(j.avance('maracaibo-II')).toBe(4)
    expect(j.estadosBarco).toEqual([])
  })

  it('Pólvora mojada: los Cañones no recargan en el Inicio', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['calma_ev'], barco: { estados: ['polvoraMojada'], mejoras: [{ id: 'bronce', municion: 0 }] } })
    expect(j.copia('bronce').municion).toBe(0)
    const k = Jugador.en({ empezarEn: 'inicio', escenario: ['calma_ev'], barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    expect(k.copia('bronce').municion).toBeGreaterThan(0)
  })
})
