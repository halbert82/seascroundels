// Peligros 2.0 · Grupo C (La ley, cartas 23–33): al menos una prueba por carta, con sus encuentros y su Destino.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

/**
 * Misiones sin reglas que estorben a estas cartas: Mar «Fantasma I» (5 de Avance; sus Cañones no suman, y aquí no se
 * usan), Naturaleza de prueba de 4 de Avance en la isla (antes «Maracaibo III», cuya Distancia se cubría con «Mano
 * firme al timón»; desde la fase 10 hay que agotar a un Tripulante) y Ciudad «El ladrón del puerto» (4).
 */
const MISION = { mar: 'pruebas-mar5', nat: 'pruebas-nat4', ciu: 'ladron-I' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const avance = (j: Jugador, entorno: keyof typeof MISION) => j.avance(MISION[entorno])

/** Para probar un Destino: «Corriente del Golfo» (Mar, NAV 2, Terreno) como encuentro y la carta como Destino. */
const conDestino = (carta: CartaId, op: OpcionesSituacion = {}) => en('mar', ['p2_corriente', carta, 'calma', 'calma'], op)

describe('23 · Desertores del rey', () => {
  it('Mar, sin Prueba: preparas un Cañón y su Avance', () => {
    const j = en('mar', ['p2_desertores', 'calma'], { barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    expect(j.copia('bronce').agotada).toBe(false)
    expect(avance(j, 'mar')).toBe(1) // fase 10b: premio pequeño, Avance 1
  })

  it('Naturaleza: si superas, +1 Avance; si fallas, el comprometido con más EXP sufre 1 herida', () => {
    // EXP 2 (1 con un Oficial: Diego lo es). Diego EXP 1: llega.
    const j = en('nat', ['p2_desertores', 'chubasco', 'calma'])
    j.comprometer('EXP', ['capitan']).seguir()
    expect(avance(j, 'nat')).toBe(2) // fase 11: EXP 2, Avance 1 / 1, y +1 por superarla
    const k = en('nat', ['p2_desertores', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('EXP', []).seguir()
    expect(k.copia('capitan').heridas).toBe(1) // sin comprometidos, al que más EXP tiene (Diego 1, Bucanero 0)
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Ciudad, sin Prueba: el siguiente encuentro Guardia o Militar de esta misión recibe −2', () => {
    const j = en('ciu', ['p2_desertores', 'p2_sebusca', 'chubasco', 'calma'])
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'encuentro', claves: ['Guardia', 'Militar'], n: -2 }])
    j.seguir().comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(0) // «Tu cara en el muelle» EXP 2 − 2
  })

  it('Destino «Chivatazo del desertor»: −1 (−2 si el encuentro es Militar o Guardia); sin oposición, +1 y, si fallas, Perseguido', () => {
    const j = conDestino('p2_desertores')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('ciu', ['p2_sebusca', 'p2_desertores', 'calma', 'calma'])
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(0)
    const m = conDestino('p2_desertores')
    m.comprometer('NAV', [])
    expect(dificultadConDestino(m.estado)).toBe(3)
    m.seguir()
    expect(m.estadosBarco).toEqual(['perseguido'])
  })
})

describe('24 · Se busca', () => {
  it('Mar: +1 si llevas la Bandera negra; si fallas, el Barco queda Perseguido', () => {
    const j = en('mar', ['p2_sebusca', 'chubasco', 'calma'], { barco: { mejoras: ['bandera'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('mar', ['p2_sebusca', 'chubasco', 'calma'])
    k.comprometer('NAV', [])
    expect(dificultadConDestino(k.estado)).toBe(3)
    k.seguir()
    expect(k.estadosBarco).toEqual(['perseguido'])
  })

  it('Naturaleza: +1 si un comprometido está herido; si fallas, el comprometido con menos Vida sufre 1 herida y queda Buscado', () => {
    const j = en('nat', ['p2_sebusca', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('EXP', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('nat', ['p2_sebusca', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('EXP', ['bucanero']).seguir() // EXP 0 + 1 de Diego contra 3
    expect(k.copia('bucanero').heridas).toBe(1)
    expect(k.estados('bucanero')).toEqual(['buscado'])
  })

  it('Ciudad: EXP 3 con 6 o más de reputación (fase 11, P66); si fallas, ocupa el muelle (pagas 2 para quitarla)', () => {
    const j = en('ciu', ['p2_sebusca', 'chubasco', 'calma'], { reputacion: 6 })
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const cinco = en('ciu', ['p2_sebusca', 'chubasco', 'calma'], { reputacion: 5 })
    cinco.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(cinco.estado)).toBe(2)
    const k = en('ciu', ['p2_sebusca', 'chubasco', 'calma'], { muelle: ['bucanero', 'sable', 'vigia', 'matasanos'] })
    k.comprometer('EXP', []).seguir()
    expect(k.zona('muelle')).toContain('p2_sebusca')
    expect(k.zona('muelle')).not.toContain('bucanero') // la de coste más alto y más a la izquierda
    expect(Object.values(k.estado.peligrosEnMuelle ?? {})).toEqual([2])
  })

  it('Destino «Precio por tu cabeza»: +1, +2 si un comprometido está Buscado; sin oposición, el Capitán sufre 1 herida', () => {
    const j = conDestino('p2_sebusca', { tripulacion: ['bucanero'] })
    j.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = conDestino('p2_sebusca', { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    k.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    const m = conDestino('p2_sebusca')
    m.comprometer('NAV', [])
    expect(m.copia('capitan').heridas).toBe(1)
  })
})

describe('25 · La aduana del rey', () => {
  it('Mar: al revelarse te incautan 2 cartas (1 con la Patente); si superas, las recuperas ya y robas 1', () => {
    const j = en('mar', ['p2_aduana', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'incautar', n: 2 } })
    j.elegir('timon', 'coraje')
    expect(j.zona('incautadas')).toEqual(['timon', 'coraje'])
    // Con la Patente de corso: solo 1 (y, por ser Guardia, la Prueba recibe −1 de la Patente).
    const k = en('mar', ['p2_aduana', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'], capitan: { mejoras: ['patente'] } })
    k.elegir('timon')
    expect(k.zona('incautadas')).toEqual(['timon'])
    k.comprometer('EXP', ['capitan'], ['ojo']).seguir()
    expect(k.zona('incautadas')).toEqual([])
    expect(k.zona('mano')).toContain('timon')
    expect(k.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
  })

  it('Mar: si fallas, agota 1 Cañón (fase 10b)', () => {
    const j = en('mar', ['p2_aduana', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    j.comprometer('EXP', []).seguir()
    expect(j.copia('bronce').agotada).toBe(true)
  })

  it('Naturaleza: no puedes comprometer más de 2; si fallas, agota 1 Cañón y el que tenga más NAV sufre 1 herida', () => {
    const j = en('nat', ['p2_aduana', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    expect(() => j.comprometer('NAV', ['capitan', 'bucanero', 'vigia'])).toThrow(/más de 2/)
    const k = en('nat', ['p2_aduana', 'chubasco', 'calma'], { tripulacion: ['vigia'], barco: { mejoras: ['bronce'] } })
    k.comprometer('NAV', ['capitan', 'vigia']).seguir() // 2 + 0 contra 3
    expect(k.copia('bronce').agotada).toBe(true)
    expect(k.copia('capitan').heridas).toBe(1)
  })

  it('Ciudad, Elige: le untas la mano (2 cartas, Avance sin Prueba) o pasas el género (EXP 3); si fallas, 2 al azar', () => {
    const j = en('ciu', ['p2_aduana', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('0').elegir('timon', 'coraje')
    expect(avance(j, 'ciu')).toBe(1) // fase 11: EXP 3, Avance 1 / 1
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
    const k = en('ciu', ['p2_aduana', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    k.opcion('1').comprometer('EXP', []).seguir()
    expect(k.zona('mano')).toHaveLength(1)
  })

  it('Destino «Doble fondo»: −1 si comprometiste a un Contrabandista; sin oposición, 1 al azar y, si fallas, otra', () => {
    const j = conDestino('p2_aduana', { tripulacion: ['contrabandista'] })
    j.comprometer('NAV', ['contrabandista'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = conDestino('p2_aduana', { mano: ['ojo', 'timon', 'coraje'] })
    k.comprometer('NAV', [])
    expect(k.zona('mano')).toHaveLength(2)
    k.seguir().elegir(k.zona('mano')[0] as CartaId)
    expect(k.zona('mano')).toHaveLength(1)
  })
})

describe('26 · Ojos del gobernador', () => {
  it('Mar: si superas, el comprometido con más NAV queda Inspirado; si fallas, la siguiente Prueba recibe +1', () => {
    const j = en('mar', ['p2_ojos', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.estados('viejo_lobo')).toEqual(['inspirado'])
    const k = en('mar', ['p2_ojos', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: 1 }])
  })

  it('Naturaleza: si superas, +2 Avance; si fallas, pierdes 1 Avance y agotas a 1 Tripulante', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-nat9'], mazoPeligros: ['p2_ojos', 'chubasco', 'calma'], tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir() // 3 + 1 de Diego
    expect(j.avance('pruebas-nat9')).toBe(3) // 1 del encuentro (fase 11: 1 / 1) + 2
    const k = en('nat', ['p2_ojos', 'chubasco', 'calma'], { tripulacion: ['vigia'], avance: { [MISION.nat]: 1 } })
    k.comprometer('NAV', ['capitan']).seguir()
    expect(k.copia('vigia').agotada).toBe(true)
    expect(avance(k, 'nat')).toBe(1) // 1 − 1 + 1 del encuentro (Avance 1 / 1: no la supera)
  })

  it('Ciudad, Elige: le pagas 2 cartas y haces la Prueba (COM 2), o no le pagas y la Prueba recibe +2; si fallas, el Capitán queda Buscado', () => {
    const j = en('ciu', ['p2_ojos', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.decision).toMatchObject({ tipo: 'comprometer' })
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir()
    expect(j.registro.some((r) => r.startsWith('Robas 2'))).toBe(true)
    const k = en('ciu', ['p2_ojos', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    k.opcion('1').comprometer('COM', [])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.seguir()
    expect(k.estados('capitan')).toEqual(['buscado'])
  })

  it('Destino «Oídos en la pared»: +1 y no se juegan Eventos; sin oposición, robas 1 menos al final del turno', () => {
    const j = conDestino('p2_ojos', { mano: ['vendas', 'ojo'], capitan: { heridas: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.ofreceCapacidad('vendas.jugar')).toBe(false)
    const control = conDestino('chubasco', { mano: ['vendas', 'ojo'], capitan: { heridas: 1 } })
    control.comprometer('NAV', ['capitan'])
    expect(control.ofreceCapacidad('vendas.jugar')).toBe(true)
    const k = conDestino('p2_ojos')
    k.comprometer('NAV', [])
    expect(k.estado.temporales.some((t) => t.clave === 'menosMando')).toBe(true)
  })
})

describe('27 · Los grilletes del rey', () => {
  it('Mar: si superas y tienes Capacidad, reclutas gratis un Marinero del muelle; si no, robas 1', () => {
    const j = en('mar', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'], muelle: ['marinero_p', 'sable', 'vigia', 'matasanos'] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'gratisDelMuelle' } })
    j.elegir('marinero_p')
    expect(j.zona('tripulacion')).toContain('marinero_p')
    const k = en('mar', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia', 'carpintero', 'matasanos'], muelle: ['marinero_p'] })
    k.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(k.zona('tripulacion')).not.toContain('marinero_p')
    expect(k.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
  })

  it('Mar: si fallas, 2 daños al Barco', () => {
    const j = en('mar', ['p2_grilletes', 'chubasco', 'calma'])
    j.comprometer('COM', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
  })

  it('Naturaleza: si fallas, los comprometidos no se preparan en tu próximo Inicio', () => {
    const j = en('nat', ['p2_grilletes', 'chubasco', 'calma'])
    j.comprometer('EXP', ['capitan']).seguir()
    expect(j.estado.temporales.some((t) => t.clave === 'noPrepara' && t.inst === j.inst('capitan') && t.hasta === 'inicio')).toBe(true)
  })

  it('Ciudad: si superas, preparas a 2; si fallas, el comprometido con menos Vida queda rehén', () => {
    const j = en('ciu', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('ciu', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['bucanero']).seguir() // 2 + 1 de Diego contra 4
    expect(k.zona('rehenes')).toEqual(['bucanero'])
  })

  it('Destino «Grilletes en los tobillos»: no se usan capacidades de Tripulantes; sin oposición, agota a 1 Tripulante (fase 10b)', () => {
    const j = conDestino('p2_grilletes', { tripulacion: ['carpintero'], barco: { dano: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.ofreceCapacidad('carpintero.reparar')).toBe(false)
    const k = conDestino('p2_grilletes', { tripulacion: ['carpintero'] })
    k.comprometer('NAV', []).elegir('carpintero')
    expect(k.copia('carpintero').agotada).toBe(true)
  })
})

describe('28 · El Santo Oficio', () => {
  it('Mar: si superas, reparas 1; si fallas, hasta el final de la misión el Barco no da su +1 de NAV', () => {
    const j = en('mar', ['p2_santooficio', 'chubasco', 'calma'], { mano: ['ojo', 'ojo'], barco: { dano: 1 } })
    j.comprometer('EXP', ['capitan'], ['ojo', 'ojo']).seguir()
    expect(j.estado.danoBarco).toBe(0)
    const k = en('mar', ['p2_santooficio', 'chubasco', 'p2_corriente', 'chubasco', 'calma'])
    k.comprometer('EXP', []).seguir().seguir()
    k.comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(k.estado)).toBe(2) // sin el +1 del Barco
  })

  it('Naturaleza: si superas, curas 2; si fallas, 1 herida a cada comprometido (máximo 3)', () => {
    const j = en('nat', ['p2_santooficio', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.copia('bucanero').heridas).toBe(0)
    const k = en('nat', ['p2_santooficio', 'chubasco', 'calma'], {
      capitan: { agotada: true },
      tripulacion: ['vigia', 'carpintero', 'marinero_p', 'canonero'],
    })
    k.comprometer('COM', ['vigia', 'carpintero', 'marinero_p', 'canonero']).seguir()
    expect(k.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', n: 3 } })
    k.elegir('vigia', 'carpintero', 'marinero_p')
    expect(k.copia('carpintero').heridas).toBe(1)
    expect(k.copia('canonero').heridas).toBe(0)
  })

  it('Ciudad: al revelarse te incautan una Mejora (el Amuleto, si lo llevas); si superas, la recuperas y el de más EXP queda Aguerrido', () => {
    const j = en('ciu', ['p2_santooficio', 'chubasco', 'calma'], {
      capitan: { mejoras: ['sable'] },
      tripulacion: [{ id: 'bucanero', mejoras: ['amuleto'] }],
      mano: ['ojo', 'ojo'],
    })
    expect(j.zona('incautadas')).toEqual(['amuleto'])
    j.comprometer('EXP', ['capitan'], ['ojo', 'ojo']).seguir()
    expect(j.copia('amuleto').vinculadaA).toBe(j.inst('bucanero'))
    expect(j.estados('capitan')).toEqual(['aguerrido'])
    const k = en('ciu', ['p2_santooficio', 'chubasco', 'calma'], { capitan: { mejoras: ['sable'] }, barco: { mejoras: ['vela'] }, reputacion: 3 })
    k.elegir('vela')
    expect(k.zona('incautadas')).toEqual(['vela'])
    k.comprometer('EXP', []).seguir()
    expect(k.estado.reputacion).toBe(2)
  })

  it('Destino «Agua bendita»: +1; +2 si un comprometido lleva el Amuleto; +0 con el Escapulario; sin oposición, descartas 2', () => {
    const conAmuleto = conDestino('p2_santooficio', { tripulacion: [{ id: 'bucanero', mejoras: ['amuleto'] }] })
    conAmuleto.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(conAmuleto.estado)).toBe(4)
    const conEscapulario = conDestino('p2_santooficio', { tripulacion: [{ id: 'bucanero', mejoras: ['escapulario'] }] })
    conEscapulario.comprometer('NAV', ['bucanero']).pasarOfertas()
    expect(dificultadConDestino(conEscapulario.estado)).toBe(2)
    const k = conDestino('p2_santooficio', { mano: ['ojo', 'timon', 'coraje'] })
    k.comprometer('NAV', []).elegir('ojo', 'timon')
    expect(k.zona('mano')).toEqual(['coraje'])
  })
})

describe('29 · Toque a rebato', () => {
  it('Mar: +1 por cada encuentro Militar o Guardia ya resuelto; si fallas, 1 daño y el de más COM sufre 1 herida', () => {
    const j = en('mar', ['p2_desertores', 'p2_rebato', 'chubasco', 'calma'])
    j.seguir().comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const k = en('mar', ['p2_rebato', 'chubasco', 'calma'])
    k.comprometer('COM', []).seguir()
    expect(k.estado.danoBarco).toBe(1)
    expect(k.copia('capitan').heridas).toBe(1)
  })

  it('Naturaleza: si superas, preparas un Cañón; si fallas, el Barco queda Perseguido', () => {
    const j = en('nat', ['p2_rebato', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.copia('bronce').agotada).toBe(false)
    const k = en('nat', ['p2_rebato', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estadosBarco).toEqual(['perseguido'])
  })

  it('Ciudad: pone en juego la permanente 230; con 3 fichas, el agotado con menos Vida queda rehén', () => {
    // En una misión larga (Ciudad 9), con «Tarde de lluvia» (sin Prueba, 1 de Avance) no se acaba antes.
    const j = Jugador.enMision({
      misiones: ['pruebas-ciu9'],
      mazoPeligros: ['p2_rebato', 'chubasco', 'chubasco', 'chubasco', 'calma'],
      tripulacion: [{ id: 'vigia', agotada: true }, { id: 'bucanero', agotada: true }],
    })
    expect(j.zona('permanentes')).toEqual(['pm_campanas'])
    j.seguir().seguir()
    expect(j.copia('pm_campanas').fichas).toBe(2)
    j.seguir()
    expect(j.zona('rehenes')).toEqual(['vigia'])
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Ciudad: se quita agotando a un Oficial, o con una Prueba de COM 3', () => {
    const j = en('ciu', ['p2_rebato', 'calma', 'calma'])
    j.usar('pm_campanas.quitar0')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.copia('capitan').agotada).toBe(true)
    const k = en('ciu', ['p2_rebato', 'chubasco', 'calma'])
    k.usar('pm_campanas.quitar1').comprometer('COM', ['capitan']).seguir()
    expect(k.zona('permanentes')).toEqual([])
  })

  it('Destino «Falsa alarma»: −1 y agotas a un Tripulante no comprometido; sin oposición, a 2', () => {
    const j = conDestino('p2_rebato', { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('NAV', ['capitan']).elegir('vigia')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = conDestino('p2_rebato', { tripulacion: ['bucanero', 'vigia'] })
    k.comprometer('NAV', []).elegir('capitan', 'vigia')
    expect(k.copia('capitan').agotada).toBe(true)
    expect(k.copia('vigia').agotada).toBe(true)
    expect(k.copia('bucanero').agotada).toBe(false)
  })
})

describe('30 · El quinto del rey', () => {
  it('Mar (fase 10b): +1 con 2 o más Cañones preparados; si superas, prepara un Cañón y robas 1; si fallas, agota 2 Cañones', () => {
    const j = en('mar', ['p2_quinto', 'chubasco', 'calma'], { tripulacion: ['bucanero'], barco: { mejoras: ['bronce', 'culebrina'] } })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const exito = en('mar', ['p2_quinto', 'chubasco', 'calma'], { tripulacion: ['bucanero'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    exito.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(exito.copia('bronce').agotada).toBe(false)
    expect(exito.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
    const k = en('mar', ['p2_quinto', 'chubasco', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    k.comprometer('COM', [])
    expect(dificultadConDestino(k.estado)).toBe(5)
    k.seguir()
    expect(k.copia('bronce').agotada).toBe(true)
    expect(k.copia('culebrina').agotada).toBe(true)
  })

  it('Naturaleza: +1 si al revelarla tienes 5 o más cartas; si fallas, el de más COM sufre 1 herida y pierdes 1 Avance', () => {
    const j = en('nat', ['p2_quinto', 'chubasco', 'calma'], { mano: ['ojo', 'ojo', 'timon', 'timon', 'coraje'] })
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const k = en('nat', ['p2_quinto', 'chubasco', 'calma'], { mano: ['ojo', 'ojo', 'timon', 'timon'], avance: { [MISION.nat]: 1 } })
    k.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.seguir()
    expect(k.copia('capitan').heridas).toBe(1)
    expect(avance(k, 'nat')).toBe(1) // 1 − 1 + 1 (Avance 2 / 1: no la supera)
  })

  it('Ciudad: si superas, el de más EXP queda Inspirado; si fallas, ocupa el muelle (pagas 3)', () => {
    const j = en('ciu', ['p2_quinto', 'chubasco', 'calma'], { mano: ['ojo'] })
    j.comprometer('EXP', ['capitan'], ['ojo']).seguir() // EXP 4, 2 con un Oficial (Diego)
    expect(j.estados('capitan')).toEqual(['inspirado'])
    const k = en('ciu', ['p2_quinto', 'chubasco', 'calma'], { muelle: ['bucanero', 'sable', 'vigia', 'matasanos'] })
    k.comprometer('EXP', []).seguir()
    expect(k.zona('muelle')).toContain('p2_quinto')
    expect(Object.values(k.estado.peligrosEnMuelle ?? {})).toEqual([3])
  })

  it('Destino «La parte del rey»: si superas, descartas 1 (con la Patente, no); sin oposición, agota 1 Cañón (fase 10b)', () => {
    const j = conDestino('p2_quinto', { mano: ['ojo', 'timon'] })
    j.comprometer('NAV', ['capitan']).seguir().elegir('ojo')
    expect(j.zona('mano')).toEqual(['timon'])
    const k = conDestino('p2_quinto', { mano: ['ojo', 'timon'], capitan: { mejoras: ['patente'] } })
    k.comprometer('NAV', ['capitan']).seguir()
    expect(k.zona('mano')).toEqual(['ojo', 'timon'])
    const m = conDestino('p2_quinto', { barco: { mejoras: ['bronce'] } })
    m.comprometer('NAV', [])
    expect(m.copia('bronce').agotada).toBe(true)
  })
})

describe('31 · Bajo los cañones del Morro', () => {
  it('Mar: pone en juego la permanente 231 y no puedes superar la misión; se quita con una Prueba de COM 5 que, si la superas, da 1 Avance', () => {
    const j = en('mar', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    expect(j.zona('permanentes')).toEqual(['pm_cadena'])
    expect(avance(j, 'mar')).toBe(2)
    j.usar('pm_cadena.quitar0').comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir()
    expect(j.zona('permanentes')).toEqual([])
    expect(avance(j, 'mar')).toBe(3) // 2 de la carta + 1 por cortar la cadena
  })

  it('Mar: con un Carpintero la Prueba es de COM 4; si la fallas, 2 daños al Barco', () => {
    const j = en('mar', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['carpintero'] })
    j.usar('pm_cadena.quitar0').comprometer('COM', [])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.zona('permanentes')).toEqual(['pm_cadena'])
  })

  it('Naturaleza: COM 6 (4 con un Artillero); si superas, preparas un Cañón; si fallas, 3 heridas repartidas entre los comprometidos', () => {
    const j = en('nat', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'canonero'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.copia('bronce').agotada).toBe(false)
    const k = en('nat', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['capitan', 'bucanero']).seguir().repartir({ capitan: 2, bucanero: 1 })
    expect(k.copia('capitan').heridas).toBe(2)
    expect(k.copia('bucanero').heridas).toBe(1)
  })

  it('Ciudad: si superas, rescatas a los rehenes (si no hay, +1 Avance); si fallas, el de más NAV sufre 1 herida y queda rehén (fase 10b)', () => {
    const j = en('ciu', ['p2_grilletes', 'chubasco', 'p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'viejo_lobo'] })
    j.comprometer('COM', ['bucanero']).seguir()
    expect(j.zona('rehenes')).toEqual(['bucanero'])
    j.seguir().comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.zona('rehenes')).toEqual([])
    expect(j.zona('tripulacion')).toContain('bucanero')
    const k = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_morro', 'chubasco', 'calma'], tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(k.avance('pruebas-ciu9')).toBe(4) // 3 + 1 (no había rehenes)
    const m = en('ciu', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    m.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(m.zona('rehenes')).toEqual(['viejo_lobo'])
    expect(m.copia('viejo_lobo').heridas).toBe(1)
  })

  it('Destino «Las baterías del castillo»: +4 salvo que descartes 2 cartas (entonces +2); sin oposición, 1 daño', () => {
    const j = conDestino('p2_morro', { mano: ['ojo', 'timon', 'coraje'] })
    j.comprometer('NAV', ['capitan'])
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'baterias' } })
    j.opcion('no')
    expect(dificultadConDestino(j.estado)).toBe(6)
    const k = conDestino('p2_morro', { mano: ['ojo', 'timon', 'coraje'] })
    k.comprometer('NAV', ['capitan']).opcion('descartar').elegir('ojo', 'timon')
    expect(dificultadConDestino(k.estado)).toBe(4)
    expect(k.zona('mano')).toEqual(['coraje'])
    const m = conDestino('p2_morro')
    m.comprometer('NAV', [])
    expect(dificultadConDestino(m.estado)).toBe(6) // sin 2 cartas en la mano, +4
    expect(m.estado.danoBarco).toBe(1)
  })

  it('Destino «Las baterías del castillo», sin oposición en Naturaleza o Ciudad: el Capitán sufre 1 herida (no el Barco)', () => {
    const j = en('ciu', ['oportunidad', 'p2_morro', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('EXP', []).seguir()
    expect(j.estado.danoBarco).toBe(0)
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
  })
})

describe('32 · La horca', () => {
  it('Mar: cada Marinero comprometido suma 1 menos; si fallas, 2 daños y agota 1 Cañón', () => {
    const j = en('mar', ['p2_horca', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'], barco: { mejoras: ['bronce'] } })
    j.comprometer('NAV', ['viejo_lobo'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // 3 + 1 de Diego − 1 + 1 del Barco
    j.pasarOfertas().seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.copia('bronce').agotada).toBe(true)
  })

  it('Naturaleza: +2 si algún Tripulante está Buscado; si fallas, el comprometido con menos Vida queda rehén', () => {
    const j = en('nat', ['p2_horca', 'chubasco', 'calma'], { tripulacion: [{ id: 'vigia', estados: ['buscado'] }, 'bucanero'] })
    j.comprometer('EXP', ['vigia', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(7)
    j.seguir()
    expect(j.zona('rehenes')).toEqual(['vigia'])
  })

  it('Ciudad: al revelarse, el preparado de menor coste está en el patíbulo (no puede comprometerse); si fallas, queda rehén y, si no superas la misión, lo ahorcan', () => {
    const j = en('ciu', ['p2_horca', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'], reputacion: 3 })
    const d = j.decision as { tripulantes: `i${number}`[] }
    expect(d.tripulantes).not.toContain(j.inst('marinero_p'))
    expect(d.tripulantes).toContain(j.inst('bucanero'))
    j.comprometer('COM', []).seguir()
    // Lo suben al patíbulo: queda rehén, sin heridas (ya no sufre 3).
    expect(j.zona('rehenes')).toEqual(['marinero_p'])
    expect(j.copia('marinero_p').heridas).toBe(0)
    // Te retiras sin superar la misión: lo pierdes y −1 de reputación (regla normal de rehén).
    j.retirarse()
    expect(j.zona('rehenes')).toEqual([])
    expect(j.registro).toContain('Pierdes a Rufián de cubierta, que era rehén.')
    expect(j.estado.reputacion).toBe(2)
  })

  it('Ciudad: si fallas pero superas la misión, rescatas al del patíbulo', () => {
    // «Calma» da el Avance que falta para superar la misión con el rehén aún en el patíbulo.
    const j = en('ciu', ['p2_horca', 'chubasco', 'calma', 'calma', 'calma'], { tripulacion: ['bucanero', 'marinero_p'] })
    j.comprometer('COM', []).seguir()
    expect(j.zona('rehenes')).toEqual(['marinero_p'])
    while (j.estado.mision && j.decision.tipo === 'ventanaAccion') j.seguir()
    expect(j.registro).toContain('Rescatas a Rufián de cubierta.')
    expect(j.zona('tripulacion')).toContain('marinero_p')
  })

  it('Ciudad: −2 con 8 o más de reputación (fase 11, P66); si superas, +1 reputación', () => {
    const j = en('ciu', ['p2_horca', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'], reputacion: 8 })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.estado.reputacion).toBe(9)
    const siete = en('ciu', ['p2_horca', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'], reputacion: 7 })
    siete.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(siete.estado)).toBe(6)
  })

  it('Destino «La soga»: +2; si fallas por 3 o más, el comprometido con la habilidad más alta queda rehén; sin oposición, el Capitán queda Buscado', () => {
    const j = conDestino('p2_horca')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('nat', ['p2_ojos', 'p2_horca', 'calma', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('NAV', ['vigia']).seguir() // 0 + 1 de Diego contra 3 + 2
    expect(k.zona('rehenes')).toEqual(['vigia'])
    const m = conDestino('p2_horca')
    m.comprometer('NAV', [])
    expect(m.estados('capitan')).toEqual(['buscado'])
  })
})

describe('33 · La Armada de Barlovento', () => {
  it('Mar: +2 con Velas rotas; tipo Armada: +1 si estás Perseguido y, si la superas, se quita (fase 10b); si fallas, Abordaje', () => {
    const j = en('mar', ['p2_armada', 'chubasco', 'calma'], { barco: { estados: ['velasRotas'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(8)
    // Perseguido durante la misión (fallas «El guardacostas os reconoce») y luego le ganas el barlovento a la fragata.
    const k = en('mar', ['p2_sebusca', 'chubasco', 'p2_armada', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['brujula'] }] })
    k.comprometer('NAV', []).seguir()
    expect(k.estadosBarco).toEqual(['perseguido'])
    k.seguir().comprometer('NAV', ['capitan', 'viejo_lobo'])
    expect(dificultadConDestino(k.estado)).toBe(7)
    k.pasarOfertas().seguir()
    expect(k.estadosBarco).toEqual([])
    // Abordaje: Diego (2 + 1 del Barco) contra 6: faltan 3, 3 heridas.
    const m = en('mar', ['p2_armada', 'chubasco', 'calma'])
    m.comprometer('NAV', ['capitan']).seguir()
    expect(m.copia('capitan').heridas).toBe(3)
  })

  it('Naturaleza: si superas, preparas a los comprometidos; si fallas, 2 heridas repartidas y pierdes 1 Avance', () => {
    const j = en('nat', ['p2_armada', 'chubasco', 'calma'], { tripulacion: ['baqueano'], mano: ['ojo'] })
    j.comprometer('EXP', ['capitan', 'baqueano'], ['ojo']).seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('baqueano').agotada).toBe(false)
    const k = en('nat', ['p2_armada', 'chubasco', 'calma'], { avance: { [MISION.nat]: 1 } })
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(2)
    expect(avance(k, 'nat')).toBe(2) // 1 − 1 + 2 (Avance 3 / 2: no la supera)
  })

  it('Ciudad: si fallas, descartas 3 cartas al azar', () => {
    const j = en('ciu', ['p2_armada', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje', 'ojo'] })
    j.comprometer('NAV', []).seguir()
    expect(j.zona('mano')).toHaveLength(1)
  })

  it('Destino «La Armada os da caza»: +1 y persigue (vuelve encima del mazo); sin oposición, pierdes 1 Avance', () => {
    const j = conDestino('p2_armada')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_armada')
    const k = en('mar', ['p2_corriente', 'p2_armada', 'calma'], { avance: { [MISION.mar]: 2 } })
    k.comprometer('NAV', [])
    expect(avance(k, 'mar')).toBe(1)
  })
})
