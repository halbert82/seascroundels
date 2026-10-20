// Peligros 2.0 · Grupo A (Mar y clima, cartas 1–11): al menos una prueba por carta, con sus encuentros y su Destino.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

/** Misiones sin reglas que estorben: Mar (5 de Avance), Naturaleza (3, Distancia 0 con el Barco), Ciudad (4). */
const MISION = { mar: 'pruebas-mar5', nat: 'pruebas-nat3', ciu: 'pruebas-ciu4' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const avance = (j: Jugador, entorno: keyof typeof MISION) => j.avance(MISION[entorno])

describe('1 · La corriente del Golfo', () => {
  it('Mar: +1 Avance por cada punto que superes, como mucho +2', () => {
    // Diego NAV 2 + Barco 1 = 3 contra NAV 2: supera por 1.
    const j = en('mar', ['p2_corriente', 'chubasco', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(2) // fase 11: NAV 2, Avance 1 / 1: 1 + 1
    // Con el Viejo lobo (NAV 3): 2 + 3 + 1 = 6, supera por 4, pero solo +2.
    const k = en('mar', ['p2_corriente', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(avance(k, 'mar')).toBe(3)
  })

  it('Mar: si fallas, 1 daño al Barco', () => {
    const j = en('mar', ['p2_corriente', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Naturaleza: si superas, preparas a un Tripulante', () => {
    const j = en('nat', ['p2_corriente', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }] })
    j.comprometer('NAV', ['capitan']).seguir().elegir('bucanero')
    expect(j.copia('bucanero').agotada).toBe(false)
  })

  it('Ciudad: puedes agotar a un Tripulante para reclutar gratis una carta del muelle de coste 2 o menos', () => {
    const j = en('ciu', ['p2_corriente', 'calma'], { tripulacion: ['vigia'], muelle: ['marinero_p', 'bucanero', 'reinaldo'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion' })
    j.opcion('0').elegir('vigia')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'gratisDelMuelle' } })
    expect((j.decision as { candidatas: string[] }).candidatas.map((c) => j.estado.cartas[c as `i${number}`]?.id)).toEqual(['marinero_p', 'bucanero'])
    j.elegir('bucanero')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.registro.some((r) => r.startsWith('Pagas'))).toBe(false)
  })

  it('Destino «Chorro»: −1, o −2 si la Prueba es de NAV; Sin oposición: pierdes 1 Avance', () => {
    const j = en('mar', ['chubasco', 'p2_corriente', 'calma']) // Chubasco repentino: NAV 2
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(0)
    const k = en('mar', ['escollos', 'p2_corriente', 'calma']) // Bajíos: NAV 2 o EXP 3
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(2)
    const l = en('mar', ['escollos', 'p2_corriente', 'calma'], { avance: { 'pruebas-mar5': 2 } })
    l.comprometer('EXP', []).seguir()
    expect(l.registro).toContain('Pierdes 1 de Avance.')
  })
})

describe('2 · Cielo estrellado', () => {
  it('Mar: miras las 3 de arriba y las ordenas; con un Piloto, +1 Avance', () => {
    const j = en('mar', ['p2_cielo', 'calma', 'chubasco', 'racha', 'hallazgo'], { tripulacion: ['viejo_lobo'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'ordenarOteo' } })
    j.elegir('racha', 'calma', 'chubasco')
    expect(j.zona('mazoPeligros').slice(0, 4)).toEqual(['racha', 'calma', 'chubasco', 'hallazgo'])
    expect(avance(j, 'mar')).toBe(1) // 0 de la carta (fase 10b) + 1 por el Piloto
  })

  it('Mar: sin Piloto, solo el Avance de la carta (0, fase 10b)', () => {
    const j = en('mar', ['p2_cielo', 'calma', 'chubasco', 'racha'])
    j.elegir('calma', 'chubasco', 'racha')
    expect(avance(j, 'mar')).toBe(0)
  })

  it('Ciudad: si superas, el comprometido con más EXP queda Inspirado y robas 1', () => {
    const j = en('ciu', ['p2_cielo', 'chubasco', 'calma'], { tripulacion: ['bucanero'], mano: ['ojo'] })
    j.comprometer('EXP', ['bucanero'], ['ojo']).seguir()
    expect(j.estados('bucanero')).toEqual(['inspirado'])
    expect(j.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
  })

  it('Destino «Estrella polar»: −1 y las cartas de tu mano no suman (las comprometidas no cuentan)', () => {
    const j = en('mar', ['chubasco', 'p2_cielo', 'calma'], { mano: ['timon', 'coraje'] })
    const sinEstrella = totalSinDestinoPrueba(j.comprometer('NAV', ['capitan'], ['timon']).estado)
    expect(dificultadConDestino(j.estado)).toBe(1)
    expect(sinEstrella).toBe(3) // Diego 2 + Barco 1: «Mano firme al timón» no suma
    expect(j.zona('descartesCapitan')).toContain('timon')
  })
})

describe('3 · Calma chicha', () => {
  it('Mar, elige «A remar»: agotas a un Marinero y ganas el Avance sin Prueba', () => {
    const j = en('mar', ['p2_calma', 'calma', 'calma'], { tripulacion: ['marinero_p'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('0').opcion('rasgo')
    expect(j.copia('marinero_p').agotada).toBe(true)
    expect(j.copia('capitan').agotada).toBe(false)
    expect(avance(j, 'mar')).toBe(1) // fase 11: NAV 3, Avance 1 / 1
  })

  it('Mar, elige «Esperar el viento»: Prueba de NAV 3; si superas, +1 Avance', () => {
    const j = en('mar', ['p2_calma', 'chubasco', 'calma'], { tripulacion: ['marinero_p'] })
    j.opcion('1').comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(2) // 1 del encuentro y 1 por superarla
  })

  it('Mar: si no puedes pagar «A remar», solo queda la Prueba', () => {
    const j = en('mar', ['p2_calma', 'chubasco', 'calma'])
    expect(j.decision).toMatchObject({ tipo: 'comprometer' })
  })

  it('Mar: si fallas, cada comprometido sufre 1 herida (y nadie más)', () => {
    // Destino «Niebla espesa» (+1): el Bucanero (NAV 1 + 1 de Diego + 1 del Barco) no llega a 4.
    const j = en('mar', ['p2_calma', 'niebla', 'calma'], { tripulacion: ['bucanero'] })
    j.opcion('1').comprometer('NAV', ['bucanero']).seguir()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('capitan').heridas).toBe(0)
  })

  it('Naturaleza: cada comprometido con heridas suma 1 menos; si fallas, agotas a 1 Tripulante', () => {
    const j = en('nat', ['p2_calma', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('COM', ['bucanero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(2) // COM 2 + 1 de Diego − 1 por la herida
    j.seguir()
    expect(j.copia('capitan').agotada).toBe(true)
  })

  it('Destino «Ni un soplo»: en una Prueba de NAV, el Barco no da su +1', () => {
    const j = en('mar', ['chubasco', 'p2_calma', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(2)
    expect(dificultadConDestino(j.estado)).toBe(3)
  })
})

describe('4 · Niebla', () => {
  it('Mar: COM 2 con un Vigía; Abordaje sin comprometidos: heridas por lo que falta (máx. 3) y un rehén al azar', () => {
    const j = en('mar', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carpintero'] })
    j.comprometer('COM', [])
    j.seguir()
    // Faltan 3 (COM 3 contra nadie): 3 heridas repartidas como quieras (fase 10) y un rehén.
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 3, motivo: { clave: 'heridas', n: 3 } })
    j.repartir({ capitan: 3 })
    expect(j.copia('capitan').heridas).toBe(3)
    expect(j.zona('rehenes')).toHaveLength(1)
  })

  it('Mar: con un Vigía la dificultad es 2; si superas, preparas un Cañón', () => {
    const j = en('mar', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['vigia'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir()
    expect(j.copia('bronce').agotada).toBe(false)
  })

  it('Naturaleza: los Vigías no suman; si fallas, el comprometido con menos EXP se pierde', () => {
    const j = en('nat', ['p2_niebla', 'chubasco', 'calma', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('EXP', ['capitan', 'vigia'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(1) // Diego 1; la Vigía no suma
    j.seguir()
    expect(j.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'noPrepara', inst: j.inst('capitan') }))
  })

  it('Ciudad: si fallas, el comprometido con más EXP queda Buscado', () => {
    const j = en('ciu', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('EXP', ['bucanero']).seguir()
    expect(j.estados('bucanero')).toEqual(['buscado'])
  })

  it('Destino «Bruma»: +1, pero −1 si el encuentro es Barco, Pirata o Guardia', () => {
    const j = en('mar', ['chubasco', 'p2_niebla', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
  })
})

describe('5 · Bajamar', () => {
  it('Mar: pone en juego la permanente 226; no puedes retirarte; una Acción pone fichas y con 2 se descarta', () => {
    const j = en('mar', ['p2_bajamar', 'calma', 'calma', 'calma'], { tripulacion: ['marinero_p'] })
    expect(j.zona('permanentes')).toEqual(['pm_varados'])
    expect(avance(j, 'mar')).toBe(2) // su Avance se gana al revelarla
    expect(j.ofrece('retirarse')).toBe(false)
    j.usar('pm_varados.accion0').opcion('rasgo')
    expect(j.copia('marinero_p').agotada).toBe(true)
    expect(j.copia('pm_varados').fichas).toBe(1)
    j.seguir() // revelas otra carta: la marea sube a 2 y el Barco flota
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('descartesPeligros')).toContain('p2_bajamar')
    expect(j.ofrece('retirarse')).toBe(true)
  })

  it('Mar: mientras esté en juego, no puedes superar la misión aunque reúnas el Avance', () => {
    // «La prueba» (3 de Avance): Bajamar da 2 y la calma 2, pero la misión sigue hasta que la marea suba a 2.
    const j = Jugador.enMision({ misiones: ['prueba-I'], mazoPeligros: ['p2_bajamar', 'calma', 'calma', 'calma'] })
    j.seguir()
    expect(j.avance('prueba-I')).toBe(4)
    expect(j.estado.mision).not.toBeNull()
    j.seguir()
    expect(j.zona('misionesSuperadas')).toEqual(['prueba-I'])
  })

  it('Naturaleza: si superas, el siguiente encuentro Militar, Guardia o Bestia de esta misión recibe −1', () => {
    const j = en('nat', ['p2_bajamar', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'encuentro', claves: ['Militar', 'Guardia', 'Bestia'], n: -1 }])
  })

  it('Ciudad: si fallas, descartas 1 carta por cada daño del Barco (mín. 1, máx. 3)', () => {
    const j = en('ciu', ['p2_bajamar', 'chubasco', 'calma'], { barco: { dano: 2 }, mano: ['ojo', 'timon', 'coraje', 'emboscada'] })
    j.comprometer('EXP', []).seguir().elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje', 'emboscada'])
  })

  it('Destino «Repunte de la marea»: si superas, +1 Avance; si fallas, pierdes 1', () => {
    const j = en('mar', ['chubasco', 'p2_bajamar', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(3) // 2 de la carta + 1 del Destino
    const k = en('mar', ['chubasco', 'p2_bajamar', 'calma'], { avance: { 'pruebas-mar5': 1 } })
    k.comprometer('NAV', []).seguir()
    // Falla (−1 del Destino y −1 de Sin oposición) y luego gana 1 de la carta (Avance 2 / 1: no la supera).
    expect(avance(k, 'mar')).toBe(1)
  })
})

describe('6 · Arrecife', () => {
  it('Mar: si superas, descartas la carta de arriba del mazo de Peligros sin resolverla', () => {
    const j = en('mar', ['p2_arrecife', 'chubasco', 'niebla', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2) // 2 con un Vigía
    j.seguir()
    expect(j.zona('descartesPeligros')).toContain('niebla')
    expect(j.zona('mazoPeligros')[0]).toBe('calma')
  })

  it('Mar: si fallas, 2 daños al Barco y agota 1 Cañón (fase 10b)', () => {
    const j = en('mar', ['p2_arrecife', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.copia('bronce').agotada).toBe(true)
  })

  it('Ciudad: NAV 2 solo si comprometes a un Marinero', () => {
    const j = en('ciu', ['p2_arrecife', 'chubasco', 'calma'], { tripulacion: ['marinero_p', 'vigia'] })
    j.comprometer('NAV', ['marinero_p'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    const k = en('ciu', ['p2_arrecife', 'chubasco', 'calma'], { tripulacion: ['marinero_p', 'vigia'] })
    k.comprometer('NAV', ['vigia'])
    expect(dificultadConDestino(k.estado)).toBe(4)
  })

  it('Destino «Coral bajo la quilla»: +1, o +0 si comprometiste a un Vigía', () => {
    const j = en('mar', ['chubasco', 'p2_arrecife', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['vigia'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    const k = en('mar', ['chubasco', 'p2_arrecife', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3)
  })

  it('Destino «Coral bajo la quilla», sin oposición: en el Mar, 1 daño al Barco; en Naturaleza o Ciudad, 1 herida a un Tripulante', () => {
    const j = en('mar', ['chubasco', 'p2_arrecife', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
    // En Ciudad («Timba en la taberna», sin efecto al fallar): las rocas cortan.
    const k = en('ciu', ['oportunidad', 'p2_arrecife', 'calma'])
    k.comprometer('EXP', []).seguir()
    expect(k.estado.danoBarco).toBe(0)
    expect(k.copia('capitan').heridas).toBe(1)
  })
})

describe('7 · Fuego a bordo', () => {
  it('Mar, «Anegar la santabárbara»: agotas todos los Cañones y el Barco queda con Pólvora mojada', () => {
    const j = en('mar', ['p2_fuego', 'calma', 'calma'], { barco: { mejoras: ['bronce'] } })
    j.opcion('0')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.estadosBarco).toEqual(['polvoraMojada'])
  })

  it('Mar, «Atacar el fuego»: +1 con algún Cañón preparado; si fallas, 1 daño y Pólvora mojada (fase 10b)', () => {
    const j = en('mar', ['p2_fuego', 'chubasco', 'calma', 'calma'], { barco: { mejoras: ['bronce'] } })
    j.opcion('1').comprometer('NAV', [])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir()
    expect(j.estado.danoBarco).toBe(1)
    expect(j.estadosBarco).toEqual(['polvoraMojada'])
  })

  it('Naturaleza: pone en juego la permanente 227; con 3 fichas, cada agotado sufre 1 herida y se descarta', () => {
    const j = en('nat', ['p2_fuego', 'calma', 'calma', 'calma', 'calma'], {
      tripulacion: [{ id: 'bucanero', agotada: true }, { id: 'carpintero', agotada: true }],
    })
    expect(j.zona('permanentes')).toEqual(['pm_manigua'])
    // Las misiones cortas se superan enseguida, así que lo comprobamos en una misión larga (Naturaleza 9).
    const k = Jugador.enMision({
      misiones: ['pruebas-nat9'],
      capitan: { agotada: true },
      mazoPeligros: ['p2_fuego', 'calma', 'calma', 'calma', 'calma'],
      tripulacion: [{ id: 'bucanero', agotada: true }, { id: 'carpintero', agotada: true }],
    })
    k.seguir().seguir().seguir()
    expect(k.copia('bucanero').heridas).toBe(1)
    expect(k.copia('carpintero').heridas).toBe(1)
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.zona('permanentes')).toEqual([])
    void j
  })

  it('Naturaleza: Acción: agota a 2 Tripulantes para descartarla', () => {
    const j = Jugador.enMision({ misiones: ['panama-II'], cubrir: ['bucanero'], mazoPeligros: ['p2_fuego', 'calma', 'calma'], tripulacion: ['bucanero', 'carpintero'] })
    j.usar('pm_manigua.accion0') // solo quedan 2 preparados (Diego y el Carpintero): se agotan los dos
    expect(j.copia('carpintero').agotada).toBe(true)
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Ciudad: si superas, eliges entre robar 2 o preparar a los comprometidos; si fallas, −1 reputación', () => {
    const j = en('ciu', ['p2_fuego', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['capitan']).seguir().opcion('1')
    expect(j.copia('capitan').agotada).toBe(false)
    const k = en('ciu', ['p2_fuego', 'chubasco', 'calma'], { reputacion: 3 })
    k.comprometer('COM', []).seguir()
    expect(k.estado.reputacion).toBe(2)
  })

  it('Destino «Pavesas»: −1, o −2 con 2 o más Cañones preparados (fase 10b)', () => {
    const j = en('mar', ['chubasco', 'p2_fuego', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('mar', ['chubasco', 'p2_fuego', 'calma'], { barco: { mejoras: ['bronce'] } })
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3)
  })
})

describe('8 · La broma', () => {
  it('Mar: EXP X = 2 + Mejoras de barco (entre 3 y 5), −2 si comprometes a un Carpintero', () => {
    const mejoras = ['vela', 'hamacas', 'casco']
    const j = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras }, tripulacion: ['carpintero'] })
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const k = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras }, tripulacion: ['carpintero'] })
    k.comprometer('EXP', ['carpintero'])
    expect(dificultadConDestino(k.estado)).toBe(3)
    const l = en('mar', ['p2_broma', 'chubasco', 'calma'])
    l.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(l.estado)).toBe(3)
  })

  it('Mar: si fallas, Vía de agua; si ya la tenía, 2 daños', () => {
    const j = en('mar', ['p2_broma', 'chubasco', 'calma'])
    j.comprometer('EXP', []).seguir()
    expect(j.estadosBarco).toEqual(['viaDeAgua'])
    j.opcion('1') // Vía de agua al terminar la carta en el Mar: no achicas, 1 daño
    expect(j.estado.danoBarco).toBe(1)
    const k = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    k.comprometer('EXP', []).seguir().opcion('1')
    expect(k.estado.danoBarco).toBe(3)
  })

  it('Naturaleza: +1 por cada comprometido después del primero; con uno solo, +1 Avance', () => {
    const j = en('nat', ['p2_broma', 'chubasco', 'calma'], { tripulacion: ['vigia', 'baqueano'] })
    j.comprometer('EXP', ['vigia', 'baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('nat', ['p2_broma', 'chubasco', 'calma'], { tripulacion: ['baqueano'] })
    k.comprometer('EXP', ['baqueano']).pasarOfertas().seguir().pasarOfertas()
    expect(k.registro.some((r) => r.includes('+1 de Avance'))).toBe(true)
  })

  it('Ciudad: si fallas, descartas la carta de mayor coste de tu mano', () => {
    const j = en('ciu', ['p2_broma', 'chubasco', 'calma'], { mano: ['ojo', 'soborno', 'timon'] })
    j.pasarOfertas().comprometer('EXP', []).seguir()
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
  })

  it('Destino «Carcoma»: las Mejoras no suman', () => {
    const j = en('mar', ['chubasco', 'p2_broma', 'calma'], { capitan: { mejoras: ['brujula'] } })
    j.comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(3) // Diego 2 + Barco 1; la Brújula no suma
  })

  it('Destino «Carcoma», sin oposición: en el Mar, 1 daño al Barco; en Naturaleza o Ciudad, descarta 1 carta', () => {
    const j = en('mar', ['chubasco', 'p2_broma', 'calma'], { mano: ['ojo', 'timon'] })
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
    expect(j.zona('mano')).toHaveLength(2)
    const k = en('ciu', ['oportunidad', 'p2_broma', 'calma'], { mano: ['ojo', 'timon'] })
    k.comprometer('EXP', []).elegir('ojo').seguir()
    expect(k.estado.danoBarco).toBe(0)
    expect(k.zona('mano')).toEqual(['timon'])
  })
})

describe('9 · Turbonada', () => {
  it('Mar: si superas, +1 Avance y la carta va al fondo del mazo de Peligros', () => {
    const j = en('mar', ['p2_turbonada', 'chubasco', 'calma', 'racha'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'racha', 'p2_turbonada'])
    expect(avance(j, 'mar')).toBe(4)
  })

  it('Mar: si fallas, 1 daño y Velas rotas (sin el +1 de NAV del Barco y con Distancias 1 mayores)', () => {
    const j = en('mar', ['p2_turbonada', 'chubasco', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estadosBarco).toEqual(['velasRotas'])
    j.seguir().comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(2)
  })

  it('Naturaleza: +1 por cada Tripulante ya agotado al revelarla (máx. +2); si fallas, el de menos Vida sufre 2 heridas', () => {
    const j = en('nat', ['p2_turbonada', 'chubasco', 'calma'], {
      tripulacion: [{ id: 'bucanero', agotada: true }, { id: 'carpintero', agotada: true }, { id: 'vigia', agotada: true }],
    })
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir()
    expect(j.copia('vigia').heridas).toBe(0) // muere (Vida 1) y sale del juego
    expect(j.zona('tripulacion')).not.toContain('vigia')
  })

  it('Destino «Os da alcance»: persigue, y es el siguiente encuentro', () => {
    const j = en('mar', ['chubasco', 'p2_turbonada', 'calma', 'racha'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_turbonada')
    j.seguir()
    expect(j.zona('encuentro')).toEqual(['p2_turbonada'])
  })

  it('Destino «Os da alcance»: si la misión termina, sigue encima y es el primer encuentro de la siguiente', () => {
    const j = en('mar', ['chubasco', 'p2_turbonada', 'calma', 'racha'])
    j.comprometer('NAV', ['capitan']).seguir().retirarse()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_turbonada')
  })
})

describe('10 · Huracán', () => {
  it('Mar: −1 por cada Marinero comprometido; si fallas, 3 daños y te retiras', () => {
    const j = en('mar', ['p2_huracan', 'chubasco', 'calma'], { tripulacion: ['marinero_p', 'bucanero'] })
    j.comprometer('NAV', ['marinero_p', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('mar', ['p2_huracan', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estado.danoBarco).toBe(3)
    expect(k.registro).toContain('Te retiras de la misión.')
  })

  it('Naturaleza: si fallas, por cada punto que falte (máx. 3) eliges herida a un comprometido o perder 1 Avance', () => {
    const j = en('nat', ['p2_huracan', 'chubasco', 'calma'], { tripulacion: ['bucanero'], avance: { 'pruebas-nat3': 2 } })
    j.comprometer('EXP', ['bucanero']).seguir() // EXP 0 + 1 = 1 contra 5: faltan 4, como mucho 3
    j.opcion('1').opcion('1') // sin Avance que perder, la tercera es la herida
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.registro.filter((r) => r.startsWith('Pierdes 1 de Avance'))).toHaveLength(2)
  })

  it('Ciudad: si fallas, ocupa el muelle; en Jugar cartas se descarta pagando 3', () => {
    const j = en('ciu', ['p2_huracan', 'chubasco', 'calma', 'calma'], {
      muelle: ['marinero_p', 'reinaldo', 'bucanero'],
      mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'emboscada', 'estrellas'],
    })
    j.comprometer('NAV', []).seguir()
    expect(j.zona('muelle')).toEqual(['marinero_p', 'p2_huracan', 'bucanero'])
    expect(j.zona('descartesMuelle')).toContain('reinaldo')
    // Sigue en el muelle hasta pagar, también tras reponerlo.
    j.retirarse()
    expect(j.zona('muelle')).toContain('p2_huracan')
  })

  it('Destino «Vendaval»: fallas, salvo que descartes 2 cartas o agotes a otro Tripulante con NAV 2+: entonces +2', () => {
    const j = en('mar', ['chubasco', 'p2_huracan', 'calma'], { tripulacion: ['viejo_lobo'], mano: ['ojo', 'timon', 'coraje'] })
    j.comprometer('NAV', ['capitan'])
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'vendaval' } })
    j.opcion('agotar')
    expect(j.copia('viejo_lobo').agotada).toBe(true)
    expect(j.estado.prueba?.falla).toBe(false)
    expect(dificultadConDestino(j.estado)).toBe(4)
  })

  it('Destino «Vendaval», sin oposición: en el Mar, 2 daños al Barco; en Naturaleza o Ciudad, 2 heridas repartidas', () => {
    const j = en('mar', ['chubasco', 'p2_huracan', 'calma'], { barco: { mejoras: [] } })
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.copia('capitan').heridas).toBe(0)
    const k = en('ciu', ['oportunidad', 'p2_huracan', 'calma'], { capitan: { mejoras: ['coleto'] } })
    k.comprometer('EXP', [])
    while (k.decision.tipo === 'repartir') k.repartir({ capitan: 2 })
    k.seguir()
    expect(k.estado.danoBarco).toBe(0)
    expect(k.copia('capitan').heridas).toBe(2)
  })
})

describe('11 · Maremoto', () => {
  it('Mar: si fallas, 2 daños y uno de tus preparados que no comprometiste vuelve al muelle', () => {
    const j = en('mar', ['p2_maremoto', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carpintero'] })
    j.comprometer('NAV', ['capitan']).seguir().elegir('carpintero')
    expect(j.estado.danoBarco).toBe(2)
    expect(j.zona('muelle')).toContain('carpintero')
  })

  it('Mar: si no había ninguno, 1 daño más', () => {
    const j = en('mar', ['p2_maremoto', 'chubasco', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.estado.danoBarco).toBe(3)
  })

  it('Ciudad: si fallas, un comprometido queda rehén', () => {
    const j = en('ciu', ['p2_maremoto', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['bucanero']).seguir()
    expect(j.zona('rehenes')).toEqual(['bucanero'])
  })

  it('Destino «Réplica»: +2; si fallas, la siguiente Prueba recibe +1; Sin oposición: el Capitán sufre 1 herida', () => {
    const j = en('mar', ['chubasco', 'p2_maremoto', 'chubasco', 'chubasco'])
    j.comprometer('NAV', []).seguir()
    expect(j.copia('capitan').heridas).toBe(1)
    j.seguir().comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // 2 + 1
  })
})
