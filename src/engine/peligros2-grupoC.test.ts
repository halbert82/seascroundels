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

  it('Ciudad, sin Prueba: +1 [avance] (fase 13, I2: antes, el siguiente encuentro Guardia o Militar recibía −2)', () => {
    const j = en('ciu', ['p2_desertores', 'p2_sebusca', 'chubasco', 'calma'])
    expect(avance(j, 'ciu')).toBe(2) // 1 del encuentro + 1
    expect(j.estado.mision?.modsSiguientes ?? []).toEqual([])
    j.seguir().comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2) // «Tu cara en el muelle» EXP 2, ya sin −2
  })

  it('Destino «Chivatazo del desertor»: +1 en cualquier encuentro (fase 13, I1: fuera el extra contra Guardia y el Perseguido); sin oposición, −1 en su lugar', () => {
    const j = conDestino('p2_desertores')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('ciu', ['p2_sebusca', 'p2_desertores', 'calma', 'calma'])
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(1) // «Tu cara en el muelle» (Guardia) EXP 2 − 1
    const m = conDestino('p2_desertores')
    m.comprometer('NAV', [])
    expect(dificultadConDestino(m.estado)).toBe(3)
    m.seguir()
    expect(m.estadosBarco).toEqual([])
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

  it('Destino «Precio por tu cabeza»: −1, también con un asignado Buscado (fase 13, I1); sin oposición, el Capitán sufre 1 herida', () => {
    const j = conDestino('p2_sebusca', { tripulacion: ['bucanero'] })
    j.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = conDestino('p2_sebusca', { tripulacion: [{ id: 'bucanero', estados: ['buscado'] }] })
    k.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(k.estado)).toBe(3)
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

  it('Destino «Doble fondo»: 0, también con un Contrabandista (fase 13, I1); sin oposición, 1 al azar y nada más al fallar', () => {
    const j = conDestino('p2_aduana', { tripulacion: ['contrabandista'] })
    j.comprometer('NAV', ['contrabandista'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    const k = conDestino('p2_aduana', { mano: ['ojo', 'timon', 'coraje'] })
    k.comprometer('NAV', [])
    expect(k.zona('mano')).toHaveLength(2)
    k.seguir()
    expect(k.decision.tipo).not.toBe('elegirCartas')
    expect(k.zona('mano')).toHaveLength(2)
  })
})

describe('26 · Ojos del gobernador', () => {
  it('Mar: si superas, preparas a 1 Tripulante asignado (fase 13, I4: antes, el de más NAV quedaba Inspirado); si fallas, la siguiente Prueba recibe +1', () => {
    const j = en('mar', ['p2_ojos', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas' })
    j.elegir('viejo_lobo')
    expect(j.copia('viejo_lobo').agotada).toBe(false)
    expect(j.copia('capitan').agotada).toBe(true)
    expect(j.estados('viejo_lobo')).toEqual([])
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

  it('Destino «Oídos en la pared»: −1 y ya se pueden jugar Eventos (fase 13, I1); sin oposición, tu tripulación queda Desmoralizada (fase 16)', () => {
    const j = conDestino('p2_ojos', { mano: ['vendas', 'ojo'], capitan: { heridas: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.ofreceCapacidad('vendas.jugar')).toBe(true)
    const k = conDestino('p2_ojos')
    k.comprometer('NAV', [])
    expect(k.estadosBarco).toEqual(['desanimo'])
    expect(k.estado.temporales.some((t) => t.clave === 'menosMando')).toBe(false)
  })
})

describe('27 · Los grilletes del rey', () => {
  it('Mar (fase 14): si superas, miras 3 del mazo de muelle, puedes reclutar sin coste uno de coste 2 o menos y el resto va al fondo', () => {
    const j = en('mar', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'], mazoMuelle: ['contrabandista', 'sable', 'marinero_p', 'vigia'] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'reclutarDelMazoMuelle', n: 2 } })
    // Ni el Contrabandista del bajo Caribe (coste 3) ni el Sable (una Mejora); ya no pide Marinero.
    expect((j.decision as { candidatas: string[] }).candidatas.map((c) => j.estado.cartas[c as `i${number}`]?.id)).toEqual(['marinero_p'])
    j.elegir('marinero_p')
    expect(j.zona('tripulacion')).toContain('marinero_p')
    expect(j.zona('mazoMuelle')).toEqual(['vigia', 'contrabandista', 'sable'])
    expect(j.registro.some((r) => r.startsWith('Pagas'))).toBe(false)
    // Sin Capacidad no recluta a nadie: las 3 van al fondo, y ya no roba 1.
    const k = en('mar', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia', 'carpintero', 'matasanos'], mazoMuelle: ['marinero_p', 'sable', 'grumete', 'loro'] })
    k.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(k.zona('tripulacion')).not.toContain('marinero_p')
    expect(k.zona('mazoMuelle')).toEqual(['loro', 'marinero_p', 'sable', 'grumete'])
    expect(k.registro.some((r) => r.startsWith('Robas 1'))).toBe(false)
  })

  it('Mar: si fallas, 2 daños al Barco', () => {
    const j = en('mar', ['p2_grilletes', 'chubasco', 'calma'])
    j.comprometer('COM', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
  })

  it('Naturaleza: si fallas, los Tripulantes asignados quedan Extenuados (fase 16)', () => {
    const j = en('nat', ['p2_grilletes', 'chubasco', 'calma'])
    j.comprometer('EXP', ['capitan']).seguir()
    expect(j.estados('capitan')).toEqual(['extenuado'])
  })

  it('Ciudad: si superas, preparas a 2; si fallas, descarta al asignado con menos Vida (fase 14)', () => {
    const j = en('ciu', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('ciu', ['p2_grilletes', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['bucanero']).seguir().pasarOfertas() // 2 + 1 de Diego contra 4
    expect(k.zona('descartesMuelle')).toContain('bucanero')
  })

  it('Destino «Grilletes en los tobillos»: −1 y ya se pueden usar capacidades de Tripulantes (fase 13, I1); sin oposición, agota a 1 Tripulante', () => {
    const j = conDestino('p2_grilletes', { tripulacion: ['carpintero'], barco: { dano: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.ofreceCapacidad('carpintero.reparar')).toBe(true)
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

  it('Naturaleza: si superas, curas 2; si fallas, 1 herida por cada asignado (máx. 3), libres (fase 13, P79): pueden ir a un no asignado', () => {
    const j = en('nat', ['p2_santooficio', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.copia('bucanero').heridas).toBe(0)
    // Cuatro asignados: 3 heridas (el máximo), y el jugador se las da al Capitán, que no fue.
    const k = en('nat', ['p2_santooficio', 'chubasco', 'calma'], {
      capitan: { agotada: true },
      tripulacion: ['vigia', 'carpintero', 'marinero_p', 'canonero'],
    })
    k.comprometer('COM', ['vigia', 'carpintero', 'marinero_p', 'canonero']).seguir()
    expect(k.decision).toMatchObject({ tipo: 'repartir', cantidad: 3 })
    k.repartir({ capitan: 2, carpintero: 1 })
    expect(k.copia('capitan').heridas).toBe(2)
    expect(k.copia('carpintero').heridas).toBe(1)
    expect(k.copia('vigia').heridas + k.copia('marinero_p').heridas + k.copia('canonero').heridas).toBe(0)
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

  it('Destino «Agua bendita»: −1, igual con el Amuleto o el Escapulario (fase 13, I1); sin oposición, descartas 2', () => {
    const conAmuleto = conDestino('p2_santooficio', { tripulacion: [{ id: 'bucanero', mejoras: ['amuleto'] }] })
    conAmuleto.comprometer('NAV', ['bucanero'])
    expect(dificultadConDestino(conAmuleto.estado)).toBe(3)
    const conEscapulario = conDestino('p2_santooficio', { tripulacion: [{ id: 'bucanero', mejoras: ['escapulario'] }] })
    conEscapulario.comprometer('NAV', ['bucanero']).pasarOfertas()
    expect(dificultadConDestino(conEscapulario.estado)).toBe(3)
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

  // En una misión larga (Ciudad 9), con «Tarde de lluvia» (sin Prueba, 1 de Avance) no se acaba antes.
  const campanas = (tripulacion: OpcionesSituacion['tripulacion'], mano?: CartaId[]) => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_rebato', 'chubasco', 'chubasco', 'chubasco', 'calma', 'calma'], tripulacion, ...(mano ? { mano } : {}) })
    expect(j.zona('permanentes')).toEqual(['pm_campanas'])
    j.seguir().seguir()
    expect(j.copia('pm_campanas').fichas).toBe(2)
    return j.seguir()
  }

  it('Ciudad: pone en juego la permanente 230; con 3 fichas, descarta al agotado con menos Vida (fase 14)', () => {
    const j = campanas([{ id: 'vigia', agotada: true }, { id: 'bucanero', agotada: true }])
    j.pasarOfertas()
    expect(j.zona('descartesMuelle')).toContain('vigia')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.zona('permanentes')).toEqual([])
  })

  it('P90: las campanas van a descartar a la Vigía; el Fiador puede ir en su lugar (también vale ante una permanente)', () => {
    const j = campanas([{ id: 'vigia', agotada: true }, { id: 'bucanero', agotada: true }, 'fiador'])
    expect(j.ofreceCapacidad('fiador.descarte')).toBe(true)
    const mano = j.zona('mano').length
    j.usar('fiador.descarte')
    expect(j.zona('descartesMuelle')).toContain('fiador')
    expect(j.zona('tripulacion')).toContain('vigia')
    expect(j.zona('mano').length).toBe(mano + 2)
    expect(j.zona('permanentes')).toEqual([])
  })

  it('P90: las campanas van a descartar a la Vigía; «¡Nadie se queda atrás!» la salva destinando 3 COM (revisión de Albert: ya no es una Prueba)', () => {
    const j = campanas([{ id: 'vigia', agotada: true }, 'bucanero'], ['a_por_ellos', 'ojo'])
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(true)
    j.usar('a_por_ellos.jugar')
    // Coste impreso (1 carta) y Destina 3 COM: Diego (3) basta.
    for (let i = 0; i < 3; i++) {
      if (j.decision.tipo === 'elegirCartas' && j.decision.motivo.clave === 'pagar') j.elegir('ojo')
      else if (j.decision.tipo === 'cubrirDistancia') j.cubrir('capitan')
      else break
    }
    j.pasarOfertas()
    expect(j.copia('capitan').agotada).toBe(true)
    expect(j.zona('tripulacion')).toContain('vigia')
    expect(j.registro).toContain('Vigía inexperta no se descarta.')
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Ciudad: se quita agotando a un Oficial, o destinando 3 COM (Albert: antes, una Prueba de COM 3)', () => {
    const j = en('ciu', ['p2_rebato', 'calma', 'calma'])
    j.usar('pm_campanas.quitar0')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.copia('capitan').agotada).toBe(true)
    // El Bucanero veterano (COM 2, más 1 por Diego, que sigue preparado) basta: no es Oficial, pero destina 3.
    const k = en('ciu', ['p2_rebato', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.usar('pm_campanas.quitar1').cubrir('bucanero')
    expect(k.zona('permanentes')).toEqual([])
    expect(k.copia('capitan').agotada).toBe(false)
    expect(k.registro).toContain('Destinas 3 de COM: agotas a Bucanero veterano.')
  })

  it('Destino «Falsa alarma»: +1 y ya no agota a un no asignado (fase 13, I1); sin oposición, agota a 2 Tripulantes', () => {
    const j = conDestino('p2_rebato', { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('NAV', ['capitan'])
    expect(j.decision.tipo).toBe('ventanaAccion')
    expect(j.copia('vigia').agotada).toBe(false)
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

  it('Ciudad: si superas, preparas a 1 Tripulante asignado (fase 13, I4: antes, Inspirado); si fallas, ocupa el muelle (pagas 3)', () => {
    const j = en('ciu', ['p2_quinto', 'chubasco', 'calma'], { mano: ['ojo'] })
    j.comprometer('EXP', ['capitan'], ['ojo'])
    expect(j.copia('capitan').agotada).toBe(true)
    j.seguir() // EXP 4, 2 con un Oficial (Diego); el único asignado se prepara sin preguntar
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.estados('capitan')).toEqual([])
    const k = en('ciu', ['p2_quinto', 'chubasco', 'calma'], { muelle: ['bucanero', 'sable', 'vigia', 'matasanos'] })
    k.comprometer('EXP', []).seguir()
    expect(k.zona('muelle')).toContain('p2_quinto')
    expect(Object.values(k.estado.peligrosEnMuelle ?? {})).toEqual([3])
  })

  it('Destino «La parte del rey»: 0 y, si superas, ya no descartas (fase 13, I1); sin oposición, agota 1 Cañón (fase 10b)', () => {
    const j = conDestino('p2_quinto', { mano: ['ojo', 'timon'] })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir()
    expect(j.registro).toContain('Total 3 contra 2: superas la Prueba.')
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
    const m = conDestino('p2_quinto', { barco: { mejoras: ['bronce'] } })
    m.comprometer('NAV', [])
    expect(m.copia('bronce').agotada).toBe(true)
  })
})

describe('31 · Bajo los cañones del Morro', () => {
  it('Mar: pone en juego la permanente 231 y no puedes superar la misión; Acción: Destina 6 COM: se descarta y da 1 Avance (Albert: antes, una Prueba; P133: antes 5)', () => {
    const j = en('mar', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carne_canon'] })
    expect(j.zona('permanentes')).toEqual(['pm_cadena'])
    expect(avance(j, 'mar')).toBe(2)
    j.usar('pm_cadena.quitar0')
    expect(j.decision).toMatchObject({ tipo: 'cubrirDistancia', motivo: { clave: 'destina', n: 6, texto: 'COM' } })
    // Diego (3) y el Bucanero (2: sin el +1 de Diego, que se agota a la vez) suman 5: ya no llegan (P133). Con la Carne de
    // cañón (2), 7.
    expect(() => j.cubrir('capitan', 'bucanero')).toThrow(/sumas 5/)
    j.cubrir('capitan', 'bucanero', 'carne_canon')
    expect(j.zona('permanentes')).toEqual([])
    expect(avance(j, 'mar')).toBe(3) // 2 de la carta + 1 por cortar la cadena
    expect(j.zona('destino')).toEqual([])
  })

  it('Mar: con un Carpintero preparado destina 5 (lo mira antes de agotar a nadie); un coste no se falla: nada de daño', () => {
    const j = en('mar', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['carpintero', 'reinaldo'] })
    j.usar('pm_cadena.quitar0')
    expect(j.decision).toMatchObject({ tipo: 'cubrirDistancia', distancia: 5 })
    // Rodrigo (3 + 1) y el Carpintero (0 + 1), con Diego preparado: 5.
    j.cubrir('reinaldo', 'carpintero')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.estado.danoBarco).toBe(0)
    // Sin nadie que llegue a 6 (solo Diego), la Acción no se ofrece.
    const k = en('mar', ['p2_morro', 'chubasco', 'calma'])
    expect(k.ofreceCapacidad('pm_cadena.quitar0')).toBe(false)
  })

  it('Naturaleza: COM 6 (Artillero −2); si superas, preparas un Cañón; si fallas, Inflige 3 heridas, libres (fase 13)', () => {
    const j = en('nat', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'canonero'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.copia('bronce').agotada).toBe(false)
    // Fase 13: las heridas del fallo van a quien quiera el jugador, también al Carpintero, que se quedó a bordo.
    const k = en('nat', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carpintero'] })
    k.comprometer('COM', ['capitan', 'bucanero']).seguir().repartir({ capitan: 2, carpintero: 1 })
    expect(k.copia('capitan').heridas).toBe(2)
    expect(k.copia('carpintero').heridas).toBe(1)
    expect(k.copia('bucanero').heridas).toBe(0)
  })

  it('Ciudad (fase 14): si superas, +1 Avance (un preso os cuenta el camino); si fallas, el de más NAV queda Buscado y sufre 1 herida', () => {
    const k = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_morro', 'chubasco', 'calma'], tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(k.avance('pruebas-ciu9')).toBe(4) // 3 + 1
    const m = en('ciu', ['p2_morro', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    m.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir().pasarOfertas()
    expect(m.estados('viejo_lobo')).toEqual(['buscado'])
    expect(m.copia('viejo_lobo').heridas).toBe(1)
    expect(m.zona('tripulacion')).toContain('viejo_lobo')
  })

  it('Destino «Las baterías del castillo»: −2, sin elegir descartar (fase 13, I1: fuera «−4 salvo que descartes 2 cartas»); sin oposición en el Mar, 1 daño', () => {
    const j = conDestino('p2_morro', { mano: ['ojo', 'timon', 'coraje'] })
    j.comprometer('NAV', ['capitan'])
    expect(j.decision.tipo).toBe('ventanaAccion')
    expect(dificultadConDestino(j.estado)).toBe(4)
    expect(j.zona('mano')).toHaveLength(3)
    const m = conDestino('p2_morro')
    m.comprometer('NAV', [])
    expect(dificultadConDestino(m.estado)).toBe(4)
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

  it('Naturaleza: +2 si algún Tripulante está Buscado; si fallas, el asignado con menos Vida queda Buscado y sufre 1 herida (fase 14)', () => {
    const j = en('nat', ['p2_horca', 'chubasco', 'calma'], { tripulacion: [{ id: 'tuerto', estados: ['buscado'] }, 'bucanero'] })
    j.comprometer('EXP', ['tuerto', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(7)
    j.seguir().pasarOfertas()
    // El Bucanero veterano (Vida 2) tiene menos Vida que el Tuerto (3).
    expect(j.estados('bucanero')).toEqual(['buscado'])
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('tuerto').heridas).toBe(0)
  })

  it('Ciudad: al revelarse, el preparado de menor coste está en el patíbulo (no puede comprometerse); si fallas, lo ahorcan: se descarta (fase 14)', () => {
    const j = en('ciu', ['p2_horca', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'], reputacion: 3 })
    const d = j.decision as { tripulantes: `i${number}`[] }
    expect(d.tripulantes).not.toContain(j.inst('marinero_p'))
    expect(d.tripulantes).toContain(j.inst('bucanero'))
    j.comprometer('COM', []).seguir().pasarOfertas()
    expect(j.zona('descartesMuelle')).toContain('marinero_p')
    expect(j.copia('marinero_p').heridas).toBe(0)
    // Ya no cuesta reputación (antes, el rehén perdido: −1).
    expect(j.estado.reputacion).toBe(3)
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

  it('Destino «La soga»: −2 y, si fallas por 3 o más, no le pasa nada más a nadie (fase 13, I1); sin oposición, el Capitán queda Buscado', () => {
    const j = conDestino('p2_horca')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('nat', ['p2_ojos', 'p2_horca', 'calma', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('NAV', ['vigia']).seguir() // 0 + 1 de Diego − 2 del Destino (mín. 0) contra 3: falla por 3
    expect(k.registro).toContain('Total 0 contra 3: fallas la Prueba.')
    expect(k.zona('tripulacion')).toContain('vigia')
    const m = conDestino('p2_horca')
    m.comprometer('NAV', [])
    expect(m.estados('capitan')).toEqual(['buscado'])
  })
})

describe('33 · La Armada de Barlovento', () => {
  it('Mar: +2 si el Barco está Desarbolado; tipo Armada: +1 si estás Perseguido y, si la superas, se quita (fase 10b); si fallas, Abordaje', () => {
    const j = en('mar', ['p2_armada', 'chubasco', 'calma'], { barco: { estados: ['velasRotas'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(6) // NAV 4 (fase 14, antes 6) + 2
    // Perseguido durante la misión (fallas «El guardacostas os reconoce») y luego le ganas el barlovento a la fragata.
    const k = en('mar', ['p2_sebusca', 'chubasco', 'p2_armada', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['brujula'] }] })
    k.comprometer('NAV', []).seguir()
    expect(k.estadosBarco).toEqual(['perseguido'])
    k.seguir().comprometer('NAV', ['capitan', 'viejo_lobo'])
    expect(dificultadConDestino(k.estado)).toBe(5)
    k.pasarOfertas().seguir()
    expect(k.estadosBarco).toEqual([])
    // Abordaje: Diego (2 + 1 del Barco) contra 4: falta 1, 1 herida.
    const m = en('mar', ['p2_armada', 'chubasco', 'calma'])
    m.comprometer('NAV', ['capitan']).seguir()
    expect(m.copia('capitan').heridas).toBe(1)
  })

  it('Naturaleza: si superas, preparas a los asignados; si fallas, Inflige 2 heridas (libres, fase 13) y −1 [avance]', () => {
    const j = en('nat', ['p2_armada', 'chubasco', 'calma'], { tripulacion: ['baqueano'], mano: ['ojo'] })
    j.comprometer('EXP', ['capitan', 'baqueano'], ['ojo']).seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('baqueano').agotada).toBe(false)
    const k = en('nat', ['p2_armada', 'chubasco', 'calma'], { avance: { [MISION.nat]: 1 }, tripulacion: ['carpintero'] })
    k.comprometer('EXP', ['capitan']).seguir().repartir({ capitan: 1, carpintero: 1 })
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.copia('carpintero').heridas).toBe(1)
    expect(avance(k, 'nat')).toBe(2) // 1 − 1 + 2 (Avance 3 / 2: no la supera)
  })

  it('Ciudad: si fallas, descartas 3 cartas al azar', () => {
    const j = en('ciu', ['p2_armada', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje', 'ojo'] })
    j.comprometer('NAV', []).seguir()
    expect(j.zona('mano')).toHaveLength(1)
  })

  it('Destino «La Armada os da caza»: −1 y persigue (vuelve encima del mazo); sin oposición, el encuentro da 1 de Avance menos (mín. 0; fase 13, I6)', () => {
    const j = conDestino('p2_armada')
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_armada')
    // «Arrecife de los Colorados» (Avance 3 / 2) sin nadie asignado: da 2 − 1.
    const k = en('mar', ['p2_arrecife', 'p2_armada', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.registro).toContain('Este encuentro da 1 de Avance menos (mín. 0).')
    expect(avance(k, 'mar')).toBe(1)
    // «Corriente del Golfo» (1 / 1): da 0, y la misión no pierde los 2 de Avance que ya tenía.
    const m = en('mar', ['p2_corriente', 'p2_armada', 'calma'], { avance: { [MISION.mar]: 2 } })
    m.comprometer('NAV', [])
    expect(avance(m, 'mar')).toBe(2)
    m.seguir()
    expect(avance(m, 'mar')).toBe(2)
  })
})
