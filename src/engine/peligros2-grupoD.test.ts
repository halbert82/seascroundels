// Peligros 2.0 · Grupo D (Rivales y tu propia tripulación, cartas 34–44): al menos una prueba por carta, con sus
// encuentros y su Destino.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

/** Misiones sin reglas que estorben: Mar (5 de Avance), Naturaleza (3, Distancia 0 con el Barco), Ciudad (4). */
const MISION = { mar: 'pruebas-mar5', nat: 'pruebas-nat3', ciu: 'pruebas-ciu4' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const avance = (j: Jugador, entorno: keyof typeof MISION) => j.avance(MISION[entorno])
const ids = (j: Jugador, lista: readonly string[]) => lista.map((c) => j.estado.cartas[c as `i${number}`]?.id)

describe('34 · Hermanos de la Costa', () => {
  it('Mar: preparas un Cañón y reparas 1; con un Bucanero (Diego lo es), preparas otro Cañón', () => {
    const j = en('mar', ['p2_hermanos', 'calma'], { barco: { dano: 2, mejoras: [{ id: 'bronce', agotada: true }] } })
    expect(j.copia('bronce').agotada).toBe(false)
    expect(j.estado.danoBarco).toBe(1)
    expect(avance(j, 'mar')).toBe(1) // fase 10b: premio pequeño, Avance 1
  })

  it('Naturaleza: si no tenías heridas, preparas a 1 Tripulante; si las tenías, solo curas 2 repartidas', () => {
    const j = en('nat', ['p2_hermanos', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }] })
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('nat', ['p2_hermanos', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true, heridas: 1 }] })
    expect(k.copia('bucanero').heridas).toBe(0)
    expect(k.copia('bucanero').agotada).toBe(true)
  })

  it('Ciudad (fase 14): si ganas el pulso, reclutas uno de coste 2 o menos del muelle pagando la mitad de su coste', () => {
    const j = en('ciu', ['p2_hermanos', 'chubasco', 'calma'], { muelle: ['bucanero', 'isabela'], mano: ['ojo', 'timon'] })
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'mitadDelMuelle' } })
    // Isabela (coste 3) no vale; el Bucanero veterano (coste 2) paga 1.
    expect(ids(j, (j.decision as { candidatas: string[] }).candidatas)).toEqual(['bucanero'])
    j.elegir('bucanero').elegir('timon')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.zona('mano')).toEqual(['ojo'])
    // Sin cartas en la mano no puede pagar: no se ofrece.
    const k = en('ciu', ['p2_hermanos', 'chubasco', 'calma'], { muelle: ['bucanero'], mano: [] })
    k.comprometer('COM', ['capitan']).seguir()
    expect(k.zona('tripulacion')).not.toContain('bucanero')
  })

  it('Ciudad (fase 14, P92): primero la mitad del coste impreso y después el descuento; «de coste 2 o menos» (P91) mira el coste impreso', () => {
    const j = en('ciu', ['p2_hermanos', 'chubasco', 'calma'], { muelle: ['bucanero', 'contrabandista'], mano: ['ojo'] })
    j.estado.temporales.push({ clave: 'capitan2.descuento', fuente: 'capitan2', hasta: 'finTurno' }) // Catalina: 2 menos
    j.comprometer('COM', ['capitan']).seguir()
    expect(ids(j, (j.decision as { candidatas: string[] }).candidatas)).toEqual(['bucanero'])
    j.elegir('bucanero') // la mitad de 2 es 1; con 2 menos, no paga nada
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.zona('mano')).toEqual(['ojo'])
  })

  it('Ciudad: si pierdes, descartas 1 carta', () => {
    const j = en('ciu', ['p2_hermanos', 'chubasco', 'calma'], { mano: ['ojo', 'timon'] })
    j.comprometer('COM', []).seguir().elegir('ojo')
    expect(j.zona('descartesCapitan')).toContain('ojo')
  })

  it('Destino «Código de la Costa»: +1 en cualquier Prueba, también Pirata con un Bucanero (fase 13, I1); Sin oposición: agota 1 Cañón', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_hermanos', 'calma'])
    j.comprometer('COM', ['capitan']) // Pulso en el muelle es Pirata y Diego es Bucanero: ya no hay +2
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('ciu', ['p2_hermanos', 'p2_hermanos', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('COM', ['vigia'])
    expect(dificultadConDestino(k.estado)).toBe(1)
    const l = en('ciu', ['p2_hermanos', 'p2_hermanos', 'calma'], { barco: { mejoras: ['bronce'] } })
    l.comprometer('COM', [])
    expect(l.copia('bronce').agotada).toBe(true)
  })
})

describe('35 · Barril de ron', () => {
  it('Mar: preparas a todos y el Tripulante con más COM queda Borracho (si empatan, eliges)', () => {
    const j = en('mar', ['p2_barril', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }, 'filibustero'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('filibustero')
    expect(j.estados('filibustero')).toEqual(['borracho'])
    expect(j.copia('bucanero').agotada).toBe(false)
  })

  it('Naturaleza: si superas, preparas un Cañón y preparas a 1; si fallas, 1 herida al comprometido con más EXP', () => {
    const j = en('nat', ['p2_barril', 'chubasco', 'calma'], {
      tripulacion: [{ id: 'bucanero', agotada: true }],
      mano: ['ojo'],
      barco: { mejoras: [{ id: 'bronce', agotada: true }] },
    })
    j.comprometer('EXP', ['capitan'], ['ojo']).seguir()
    expect(j.copia('bronce').agotada).toBe(false)
    j.elegir('bucanero')
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('nat', ['p2_barril', 'chubasco', 'calma'])
    k.comprometer('EXP', []).seguir()
    expect(k.copia('capitan').heridas).toBe(1)
  })

  it('Naturaleza: si fallas sin nadie asignado, la herida va al de más EXP de toda la tripulación (fase 13, P72)', () => {
    const j = en('nat', ['p2_barril', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('EXP', []).seguir()
    expect(j.registro).toContain('Vigía inexperta sufre 1 herida.') // EXP 2 contra la 1 de Diego
    expect(j.copia('capitan').heridas).toBe(0)
  })

  it('Ciudad: miras las 3 de arriba del mazo de muelle, una sustituye a la de más a la izquierda y las otras van al fondo', () => {
    const j = en('ciu', ['p2_barril', 'calma'], {
      muelle: ['marinero_p', 'bucanero', 'sable', 'matasanos'],
      mazoMuelle: ['vigia', 'carpintero', 'vela', 'hamacas'],
    })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'lenguasSueltas' } })
    j.elegir('carpintero')
    expect(j.zona('muelle')).toEqual(['carpintero', 'bucanero', 'sable', 'matasanos'])
    expect(j.zona('descartesMuelle')).toEqual(['marinero_p'])
    expect(j.zona('mazoMuelle')).toEqual(['hamacas', 'vigia', 'vela'])
  })

  it('Destino «Valor de barril»: +1 en cualquier Prueba, también con un Borracho asignado (fase 13, I1); Sin oposición: el preparado con más NAV queda Borracho', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_barril', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['borracho'] }] })
    j.comprometer('COM', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('ciu', ['p2_hermanos', 'p2_barril', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['bucanero'])
    expect(dificultadConDestino(k.estado)).toBe(1)
    const l = en('ciu', ['p2_hermanos', 'p2_barril', 'calma'], { tripulacion: ['bucanero'] })
    l.comprometer('COM', [])
    expect(l.estados('capitan')).toEqual(['borracho']) // Diego NAV 2 contra el Bucanero NAV 1
  })
})

describe('36 · Sangre caliente', () => {
  it('Mar: tus dos Tripulantes con más COM (sin el Capitán) no pueden comprometerse; un Oficial comprometido suma +1', () => {
    const j = en('mar', ['p2_sangre', 'chubasco', 'calma'], { tripulacion: ['filibustero', 'isabela', 'bucanero'] })
    expect(ids(j, (j.decision as { tripulantes: string[] }).tripulantes)).toEqual(['capitan', 'bucanero'])
    j.comprometer('COM', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // Diego COM 3 + 1 por ser Oficial
  })

  it('Mar: si hay empate en el corte, eliges a quién; si fallas, los dos que se pegaban sufren 1 herida cada uno', () => {
    const j = en('mar', ['p2_sangre', 'chubasco', 'calma'], { tripulacion: ['filibustero', 'isabela', 'espadachin'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('filibustero', 'isabela')
    j.comprometer('COM', []).seguir()
    expect(j.copia('filibustero').heridas).toBe(1)
    expect(j.copia('isabela').heridas).toBe(1)
    expect(j.copia('espadachin').heridas).toBe(0)
  })

  it('Naturaleza: si superas, curas 1 herida a dos Tripulantes distintos; si fallas, el de más COM cura 1 y el de menos Vida sufre 1', () => {
    const j = en('nat', ['p2_sangre', 'chubasco', 'calma'], {
      tripulacion: [{ id: 'bucanero', heridas: 1 }, { id: 'carpintero', heridas: 1 }, 'vigia'],
    })
    j.comprometer('EXP', ['vigia']).seguir() // EXP 2 + 1 de Diego contra 2
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.copia('carpintero').heridas).toBe(0)
    const k = en('nat', ['p2_sangre', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: ['bucanero'] })
    k.comprometer('EXP', []).seguir()
    expect(k.copia('capitan').heridas).toBe(0)
    expect(k.copia('bucanero').heridas).toBe(1)
  })

  it('Ciudad: si superas, +1 Avance y robas 1; si fallas, descartas 1 y el asignado con más COM sufre 1 herida (fase 10b)', () => {
    const j = en('ciu', ['p2_sangre', 'chubasco', 'calma'])
    const antes = avance(j, 'ciu')
    j.comprometer('COM', ['capitan']).seguir()
    expect(avance(j, 'ciu')).toBe(antes + 2) // fase 11: COM 3, Avance 1 / 1, y +1 por superarla
    expect(j.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
    const k = en('ciu', ['p2_sangre', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia'], mano: ['ojo'] })
    k.comprometer('COM', ['vigia']).seguir() // COM 0 + 1 de Diego contra 3
    expect(k.registro).toContain('Vigía inexperta sufre 1 herida.') // Vida 1: queda derrotada
    expect(k.zona('descartesCapitan')).toContain('ojo')
  })

  it('Destino «Echarse la culpa» (fase 13, I1): −1 e inflige 1 herida a un Tripulante asignado; sin nadie asignado, solo su Sin oposición: agota a 1 (P83)', () => {
    // «Pasos a tu espalda» (EXP 3): con dos asignados, el jugador elige cuál de ellos sufre la herida (Diego no está).
    const j = en('ciu', ['p2_bastian', 'p2_sangre', 'calma'], { tripulacion: ['bucanero', 'filibustero'] })
    j.comprometer('EXP', ['bucanero', 'filibustero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 1 })
    expect(ids(j, Object.keys((j.decision as { maximos: object }).maximos)).sort()).toEqual(['bucanero', 'filibustero'])
    j.repartir({ filibustero: 1 })
    expect(j.copia('filibustero').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
    // P83: sin nadie asignado, no hay herida; solo se agota a 1 Tripulante (aquí, Diego).
    const k = en('ciu', ['p2_bastian', 'p2_sangre', 'calma'])
    k.comprometer('EXP', [])
    expect(k.copia('capitan').heridas).toBe(0)
    expect(k.copia('capitan').agotada).toBe(true)
  })
})

describe('37 · El tahúr', () => {
  it('Mar: si doblas la apuesta, +2; si fallas, descartas 2 y 1 daño al Barco', () => {
    const j = en('mar', ['p2_tahur', 'chubasco', 'calma'], { mano: ['ojo', 'coraje'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('1').comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir()
    expect(j.zona('mano')).toEqual([])
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Mar: si ganas habiendo doblado, robas 4; sin doblar, robas 2', () => {
    const j = en('mar', ['p2_tahur', 'chubasco', 'calma'], { mano: ['timon'] })
    j.opcion('1').comprometer('NAV', ['capitan'], ['timon']).seguir() // 2 + 1 del Barco + 2 = 5 contra 5
    expect(j.zona('mano')).toHaveLength(4)
    const k = en('mar', ['p2_tahur', 'chubasco', 'calma'])
    k.opcion('0').comprometer('NAV', ['capitan']).seguir()
    expect(k.zona('mano')).toHaveLength(2)
    expect(k.estado.danoBarco).toBe(0)
  })

  it('Naturaleza: si superas, preparas un Cañón; si fallas, agotas a 1 Tripulante preparado', () => {
    const j = en('nat', ['p2_tahur', 'chubasco', 'calma'], { barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.copia('bronce').agotada).toBe(false)
    const k = en('nat', ['p2_tahur', 'chubasco', 'calma'])
    k.comprometer('COM', []).seguir()
    expect(k.copia('capitan').agotada).toBe(true)
  })

  it('Ciudad: Sin ayuda; cada carta comprometida suma +1 más; si fallas, tu jugador sufre 2 heridas', () => {
    const j = en('ciu', ['p2_tahur', 'chubasco', 'calma'], { mano: ['ojo'] })
    expect(j.decision).toMatchObject({ tipo: 'comprometer', sinAyuda: true })
    j.comprometer('EXP', ['capitan'], ['ojo'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // EXP 1 + 2 iconos + 1 por la carta
    j.seguir()
    expect(j.zona('mano')).toHaveLength(3)
    const k = en('ciu', ['p2_tahur', 'chubasco', 'calma'])
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(2)
  })

  it('Destino «Dados cargados»: descartas la de arriba de tu mazo; con icono COM, +2; si no, con EXP, −1; Sin oposición, 2 más', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_tahur', 'calma'], { mazoCapitan: ['abordaje', 'ojo', 'timon'] })
    j.comprometer('COM', ['capitan'])
    expect(j.zona('descartesCapitan')).toEqual(['abordaje'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('ciu', ['p2_hermanos', 'p2_tahur', 'calma'], { mazoCapitan: ['ojo', 'timon'] })
    k.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(1)
    const l = en('ciu', ['p2_hermanos', 'p2_tahur', 'calma'], { mazoCapitan: ['timon', 'ojo', 'coraje', 'abordaje'] })
    l.comprometer('COM', [])
    expect(l.zona('descartesCapitan')).toEqual(['coraje', 'ojo', 'timon'])
    expect(dificultadConDestino(l.estado)).toBe(2) // «Mano firme al timón» solo tiene NAV: +0
  })
})

describe('38 · Paga atrasada', () => {
  it('Mar: pone en juego la permanente 232; cada otro Peligro revelado, 1 ficha; con 3, 2 daños al Barco y se descarta', () => {
    const j = en('mar', ['p2_paga', 'calma', 'calma', 'chubasco', 'calma'], { avance: { 'pruebas-mar5': 0 } })
    expect(j.zona('permanentes')).toEqual(['pm_murmullos'])
    j.seguir() // calma: 1 ficha (Avance 4)
    expect(j.copia('pm_murmullos').fichas).toBe(1)
    j.seguir() // calma: 2 fichas; Avance 6: se supera la misión y la carta se descarta
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Mar: con 3 fichas sabotean el barco', () => {
    const j = en('mar', ['p2_paga', 'calma', 'calma'])
    j.copia('pm_murmullos').fichas = 2 // dos Peligros revelados antes
    j.seguir() // la tercera
    expect(j.estado.danoBarco).toBe(2)
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('descartesPeligros')).toContain('p2_paga')
  })

  it('Mar: Respuesta: si superas una Prueba por 2 o más, quitas 1 ficha; Acción: descarta 2 cartas para descartarla', () => {
    const j = en('mar', ['p2_paga', 'chubasco', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'], mano: ['ojo', 'timon'] })
    j.seguir().comprometer('NAV', ['viejo_lobo']) // NAV 3 + 1 de Diego + 1 del Barco = 5 contra 2
    j.pasarOfertas().seguir()
    expect(j.ofreceCapacidad('pm_murmullos.cap.calma')).toBe(true)
    j.usar('pm_murmullos.cap.calma')
    expect(j.copia('pm_murmullos').fichas).toBe(0)
    j.pasarOfertas()
    j.usar('pm_murmullos.quitar0').elegir('ojo', 'timon')
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Naturaleza: si fallas, tu Tripulante de menor coste (sin el Capitán) deserta: vuelve al muelle (fase 10b)', () => {
    const j = en('nat', ['p2_paga', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'] })
    j.comprometer('EXP', []).seguir()
    expect(j.zonaDe('marinero_p')).toBe('muelle')
    expect(j.zona('tripulacion')).toContain('bucanero')
  })

  it('Ciudad, Elige: pagas 1 carta por cada Tripulante (el Capitán cuenta), o Prueba de COM 3 +1 por cada Bucanero', () => {
    const j = en('ciu', ['p2_paga', 'chubasco', 'calma'], { tripulacion: ['bucanero'], mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje'])
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
    // Sin cartas para pagar, solo queda plantarse.
    const k = en('ciu', ['p2_paga', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(5) // 3 + Diego y el Bucanero
    k.seguir()
    expect(k.copia('capitan').heridas).toBe(1)
  })

  it('Destino «Demasiadas voces»: −1 en cualquier Prueba, también con 3 o más asignados (fase 13, I1); Sin oposición: −1 Mando en tu próximo turno', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_paga', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('COM', ['capitan', 'bucanero', 'vigia'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('ciu', ['p2_hermanos', 'p2_paga', 'calma'])
    k.comprometer('COM', [])
    expect(k.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'menosMando', desdeTurno: k.estado.turno + 1 }))
  })
})

describe('39 · A sueldo', () => {
  it('Mar, Elige (fase 10b): agotas 2 Cañones (si los tienes preparados) y haces la Prueba, o la Prueba recibe +2', () => {
    const j = en('mar', ['p2_sueldo', 'chubasco', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    j.opcion('0')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.copia('culebrina').agotada).toBe(true)
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    // Con un solo Cañón, solo queda la otra opción: se aplica sola.
    const k = en('mar', ['p2_sueldo', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(5)
    k.seguir()
    expect(k.estado.danoBarco).toBe(1)
    expect(k.copia('bronce').agotada).toBe(true)
  })

  it('Naturaleza: si superas, la siguiente Prueba recibe −1; si fallas, pierdes 1 Avance y el de más NAV sufre 1 herida', () => {
    const j = en('nat', ['p2_sueldo', 'chubasco', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: -1 }])
    const k = en('nat', ['p2_sueldo', 'chubasco', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    k.comprometer('NAV', []).seguir()
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.registro).toContain('Pierdes 1 de Avance.')
  })

  it('Ciudad: si fallas, te incautan las 2 cartas de más coste; si no superas la misión, se descartan', () => {
    const j = en('ciu', ['p2_sueldo', 'chubasco', 'calma'], { mano: ['ojo', 'soborno', 'reflejos', 'sangre_fria'] })
    j.pasarOfertas().comprometer('NAV', []).pasarOfertas().seguir()
    expect(j.zona('incautadas')).toEqual(['soborno', 'sangre_fria'])
    j.retirarse()
    if (j.decision.motivo.clave === 'conservarMision') j.opcion('dejar')
    expect(j.zona('descartesCapitan')).toEqual(expect.arrayContaining(['soborno', 'sangre_fria']))
    expect(j.zona('fueraDeJuego')).toEqual([])
  })

  it('Ciudad: si superas la misión, recuperas lo incautado y robas 1', () => {
    // Empieza con todo el Avance: se supera al resolver este Peligro, aunque sin superar su Prueba dé 0 (Avance 1 / 0).
    const j = en('ciu', ['p2_sueldo', 'chubasco', 'calma'], { mano: ['ojo', 'soborno', 'sangre_fria'], avance: { 'pruebas-ciu4': 4 } })
    j.pasarOfertas().comprometer('NAV', []).pasarOfertas().seguir()
    expect(j.zona('mano')).toEqual(expect.arrayContaining(['soborno', 'sangre_fria']))
    expect(j.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
  })

  it('Destino «Lealtad comprada»: 0 y todos los asignados suman (fase 13, I1: fuera «el de menor coste no suma»); Sin oposición: descartas 2', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_sueldo', 'calma'], { tripulacion: ['bucanero', 'isabela'] })
    j.comprometer('COM', ['bucanero', 'isabela'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    expect(totalSinDestinoPrueba(j.estado)).toBe(7) // Bucanero COM 2 + Isabela COM 3, +1 de Diego a cada uno
    const k = en('ciu', ['p2_hermanos', 'p2_sueldo', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    k.comprometer('COM', []).elegir('ojo', 'timon')
    expect(k.zona('mano')).toEqual(['coraje'])
  })
})

describe('40 · La sombra de Bastián', () => {
  it('Mar: +1 si el Barco tiene 2 o más daños; si superas por 2 o más, la carta se retira del juego', () => {
    const j = en('mar', ['p2_bastian', 'chubasco', 'calma'], { barco: { dano: 2 }, tripulacion: ['viejo_lobo'], mano: ['timon'] })
    j.comprometer('NAV', ['viejo_lobo'], ['timon'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.pasarOfertas().seguir() // 3 + 1 de Diego + 1 del Barco + 2 = 7 contra 5
    expect(j.zona('fueraDeJuego')).toContain('p2_bastian')
  })

  it('Mar: si fallas, 1 daño y el Barco queda Perseguido', () => {
    const j = en('mar', ['p2_bastian', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
    expect(j.estadosBarco).toEqual(['perseguido'])
  })

  it('Naturaleza: si fallas, pierdes 2 Avance; Ciudad: si fallas, la siguiente Prueba recibe +2', () => {
    const j = en('nat', ['p2_bastian', 'chubasco', 'calma'], { avance: { 'pruebas-nat3': 2 } })
    j.comprometer('EXP', []).seguir()
    expect(j.registro).toContain('Pierdes 2 de Avance.')
    const k = en('ciu', ['p2_bastian', 'chubasco', 'calma'])
    k.comprometer('EXP', []).seguir()
    expect(k.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: 2 }])
  })

  it('Destino «A tu estela»: −1 y Persigue', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_bastian', 'calma'])
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.pasarOfertas().seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_bastian')
  })

  it('Destino «A tu estela», Sin oposición (fase 13, I6): el encuentro da 1 de Avance menos (mín. 0), sin quitar el que ya tenías', () => {
    // «Pulso en el muelle» da Avance 1 / 1: sin nadie asignado, 1 − 1 = 0.
    const j = en('ciu', ['p2_hermanos', 'p2_bastian', 'calma'], { avance: { 'pruebas-ciu4': 2 } })
    j.comprometer('COM', []).pasarOfertas().seguir()
    expect(j.registro).toContain('Este encuentro da 1 de Avance menos (mín. 0).')
    expect(j.registro).not.toContain('Pierdes 1 de Avance.')
    expect(avance(j, 'ciu')).toBe(2)
  })
})

describe('41 · Los holandeses de Curazao', () => {
  it('Mar: COM 4 (fase 14); puedes agotar un Cañón antes de asignar aunque sea un Abordaje (P89): −1, o −2 con un Artillero asignado', () => {
    const j = en('mar', ['p2_curazao', 'chubasco', 'calma'], { tripulacion: ['canonero'], barco: { mejoras: ['bronce'] } })
    j.opcion('1')
    expect(j.copia('bronce').agotada).toBe(true)
    j.comprometer('COM', ['canonero'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    const k = en('mar', ['p2_curazao', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    k.opcion('1').comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3)
    const l = en('mar', ['p2_curazao', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    l.opcion('0').comprometer('COM', ['capitan'])
    expect(dificultadConDestino(l.estado)).toBe(4)
    // Ya en la Prueba, los Cañones no se pueden disparar (Abordaje).
    expect(l.ofreceCapacidad('bronce.disparar')).toBe(false)
  })

  it('Mar: Abordaje: si fallas, 1 herida por cada punto que falte', () => {
    const j = en('mar', ['p2_curazao', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('COM', ['vigia']).seguir() // 0 + 1 de Diego contra 4: faltan 3
    expect(j.registro).toContain('Abordaje: te faltan 3 puntos: 3 heridas.')
  })

  it('Naturaleza: si superas, curas 1 a cada asignado; si fallas, 1 herida libre por cada asignado (fase 13, P79)', () => {
    const j = en('nat', ['p2_curazao', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: [{ id: 'isabela', heridas: 1 }] })
    j.comprometer('COM', ['capitan', 'isabela']).pasarOfertas().seguir()
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.copia('isabela').heridas).toBe(0)
    // Carpintero y Vigía (COM 0 + 1 de Diego) suman 2 contra 4: 2 heridas, y el jugador se las da a Diego, que no fue.
    const k = en('nat', ['p2_curazao', 'chubasco', 'calma'], { tripulacion: ['carpintero', 'vigia'] })
    k.comprometer('COM', ['carpintero', 'vigia']).seguir()
    expect(k.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    k.repartir({ capitan: 2 })
    expect(k.copia('capitan').heridas).toBe(2)
    expect(k.copia('carpintero').heridas).toBe(0)
    expect(k.copia('vigia').heridas).toBe(0)
  })

  it('Ciudad: «Te roban el barco»: si fallas, 2 daños al Barco aunque estés en tierra, y descartas 1', () => {
    const j = en('ciu', ['p2_curazao', 'chubasco', 'calma'], { mano: ['ojo'] })
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.zona('mano')).toEqual([])
  })

  it('Destino «Cuerpo a cuerpo» (fase 13, I1): −1 e inflige 1 herida a un Tripulante asignado, en cualquier Prueba; sin nadie asignado, solo su Sin oposición (P83, ejemplo del reglamento)', () => {
    // Con dos asignados, el jugador elige cuál sufre la herida (ya no es por fuerza el de más COM).
    const j = en('ciu', ['p2_hermanos', 'p2_curazao', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 1 })
    j.repartir({ bucanero: 1 })
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('capitan').heridas).toBe(0)
    // Con un solo asignado, la sufre él, también en una Prueba de EXP («Pasos a tu espalda»).
    const k = en('ciu', ['p2_bastian', 'p2_curazao', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('EXP', ['bucanero'])
    expect(k.copia('bucanero').heridas).toBe(1)
    // P83: sin nadie asignado, «Inflige 1 herida a un Tripulante asignado» no hace nada; el Sin oposición («Inflige 1
    // herida») da una sola herida, a quien elijas.
    const l = en('ciu', ['p2_hermanos', 'p2_curazao', 'calma'], { tripulacion: ['bucanero'] })
    l.comprometer('COM', [])
    expect(l.registro).toContain('No hay nadie asignado: lo que el Destino le hace a un Tripulante asignado no se aplica.')
    expect(l.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir' } })
    l.elegir('bucanero')
    expect(l.estado.pendiente?.tipo === 'elegirCartas' && l.decision.motivo.clave === 'herir').toBe(false)
    expect(l.copia('bucanero').heridas).toBe(1)
    expect(l.copia('capitan').heridas).toBe(0)
  })
})

describe('42 · Viejas cuentas', () => {
  it('Mar: Sin ayuda; si mandas a otro en lugar del Capitán, +1; si ganas, preparas un Cañón y a 1 asignado (fase 13, I4: ya no queda Inspirado)', () => {
    const j = en('mar', ['p2_cuentas', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const k = en('mar', ['p2_cuentas', 'chubasco', 'calma'], { mano: ['abordaje'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    k.comprometer('COM', ['capitan'], ['abordaje'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.seguir()
    expect(k.copia('bronce').agotada).toBe(false)
    expect(k.copia('capitan').agotada).toBe(false) // se agotó al ser asignado y se prepara
    expect(k.estados('capitan')).toEqual([])
  })

  it('Mar: si pierdes, tu duelista sufre 2 heridas y queda Sangrando', () => {
    const j = en('mar', ['p2_cuentas', 'chubasco', 'calma'])
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.estados('capitan')).toEqual(['sangrando'])
  })

  it('Mar: si nadie acepta el duelo, las 2 heridas son libres (fase 13, P78)', () => {
    const j = en('mar', ['p2_cuentas', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', []).seguir()
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    j.repartir({ capitan: 1, bucanero: 1 })
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(1)
  })

  it('Naturaleza: −2 si comprometes al Capitán; si fallas, 2 heridas al comprometido con más EXP', () => {
    const j = en('nat', ['p2_cuentas', 'chubasco', 'calma'])
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    const k = en('nat', ['p2_cuentas', 'chubasco', 'calma'])
    k.comprometer('EXP', ['capitan']).seguir() // EXP 1 contra 4 − 2
    expect(k.copia('capitan').heridas).toBe(2)
  })

  it('Ciudad: si superas, recuperas 1 carta de tu descarte; si fallas, la carta ocupa el muelle (pagas 3)', () => {
    const j = en('ciu', ['p2_cuentas', 'chubasco', 'calma'], { mano: ['ojo'], descartesCapitan: ['abordaje', 'timon'] })
    j.comprometer('EXP', ['capitan'], ['ojo']).seguir().elegir('abordaje')
    expect(j.zona('mano')).toEqual(['abordaje'])
    const k = en('ciu', ['p2_cuentas', 'chubasco', 'calma'], { muelle: ['marinero_p', 'isabela', 'sable'] })
    k.comprometer('EXP', []).seguir()
    expect(k.zona('muelle')).toContain('p2_cuentas')
    expect(k.zona('muelle')).not.toContain('isabela')
  })

  it('Destino «El que te conoce»: −1 en cualquier Prueba, también con el Capitán asignado (fase 13, I1); Sin oposición: el Capitán sufre 1 herida', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_cuentas', 'calma'])
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('ciu', ['p2_hermanos', 'p2_cuentas', 'calma'])
    k.comprometer('COM', [])
    expect(k.copia('capitan').heridas).toBe(1)
  })
})

describe('43 · Motín', () => {
  it('Mar: solo pueden comprometerse el Capitán y los Oficiales; +1 por cada preparado que no sea Oficial (máx. +3)', () => {
    const j = en('mar', ['p2_motin', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'isabela', 'marinero_p'] })
    expect(ids(j, (j.decision as { tripulantes: string[] }).tripulantes)).toEqual(['capitan', 'isabela'])
    j.comprometer('COM', ['capitan', 'isabela'])
    expect(dificultadConDestino(j.estado)).toBe(7)
  })

  it('Mar: si fallas, te retiras de la misión y el Capitán sufre 1 herida', () => {
    const j = en('mar', ['p2_motin', 'chubasco', 'calma'])
    j.comprometer('COM', []).seguir()
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.registro).toContain('Te retiras de la misión.')
  })

  it('Naturaleza: si fallas, pierdes 2 Avance y sufres 2 heridas', () => {
    const j = en('nat', ['p2_motin', 'chubasco', 'calma'], { avance: { 'pruebas-nat3': 2 } })
    j.comprometer('NAV', []).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.registro).toContain('Pierdes 2 de Avance.')
  })

  it('Ciudad: los que no son Oficiales se agotan y no se preparan; agotar a un Oficial saca a uno, que queda Borracho', () => {
    const j = en('ciu', ['p2_motin', 'calma'], { tripulacion: ['bucanero', 'isabela', 'marinero_p'] })
    expect(j.zona('permanentes')).toEqual(['pm_taberna'])
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.copia('marinero_p').agotada).toBe(true)
    expect(j.copia('isabela').agotada).toBe(false)
    j.usar('pm_taberna.accion0').elegir('isabela').elegir('bucanero')
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.estados('bucanero')).toEqual(['borracho'])
    expect(j.copia('isabela').agotada).toBe(true)
  })

  it('Ciudad: pagas 3 cartas para descartarla', () => {
    const j = en('ciu', ['p2_motin', 'calma'], { tripulacion: ['bucanero'], mano: ['ojo', 'timon', 'coraje'] })
    j.usar('pm_taberna.quitar0').elegir('ojo', 'timon', 'coraje')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.estado.temporales.filter((t) => t.clave === 'noPrepara')).toEqual([])
  })

  it('Destino «Puñal en la espalda»: −2 en cualquier Prueba, también sin ningún Oficial asignado (fase 13, I1); Sin oposición: 2 heridas repartidas', () => {
    const j = en('ciu', ['p2_hermanos', 'p2_motin', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    const k = en('ciu', ['p2_hermanos', 'p2_motin', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    const l = en('ciu', ['p2_hermanos', 'p2_motin', 'calma'], { tripulacion: ['bucanero'] })
    l.comprometer('COM', [])
    expect(l.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
  })
})

describe('44 · El cazador de piratas', () => {
  it('Mar: EXP 4 (3 si asignas a un Vigía; fase 14, antes 5 y 4); si superas, preparas un Cañón', () => {
    const j = en('mar', ['p2_cazador', 'chubasco', 'calma'], { tripulacion: ['vigia'], mano: ['ojo'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('EXP', ['vigia'], ['ojo'])
    expect(j.estado.prueba?.dificultadBase).toBe(3)
    j.seguir() // 2 + 1 de Diego + 2 = 5 contra 3
    expect(j.copia('bronce').agotada).toBe(false)
  })

  it('Naturaleza: si superas, reclutas gratis un Tripulante de coste 2 o menos; sin Capacidad, robas 2', () => {
    const j = en('nat', ['p2_cazador', 'chubasco', 'calma'], { muelle: ['marinero_p'], mano: ['abordaje'] })
    j.comprometer('COM', ['capitan'], ['abordaje']).seguir()
    j.elegir('marinero_p')
    expect(j.zona('tripulacion')).toContain('marinero_p')
    const k = en('nat', ['p2_cazador', 'chubasco', 'calma'], {
      muelle: ['marinero_p'],
      mano: ['abordaje'],
      tripulacion: ['bucanero', 'filibustero', 'carpintero', 'vigia'],
    })
    k.comprometer('COM', ['capitan'], ['abordaje']).seguir()
    expect(k.zona('tripulacion')).not.toContain('marinero_p')
    // Robas 2 por el encuentro (la misión de prueba no da cartas al superarla).
    expect(k.registro.filter((r) => r.startsWith('Robas 2')).length).toBe(1)
  })

  it('Naturaleza: si fallas, descarta al asignado con más COM (fase 14)', () => {
    const j = en('nat', ['p2_cazador', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('COM', ['bucanero', 'vigia']).seguir().pasarOfertas() // COM (2 + 1) + (0 + 1) contra 5
    expect(j.zona('descartesMuelle')).toContain('bucanero') // COM impresa 2 contra la 0 de la Vigía
    expect(j.zona('tripulacion')).toContain('vigia')
  })

  it('Ciudad: si fallas, el asignado con más EXP queda Buscado y entra La Armada (fase 14)', () => {
    const j = en('ciu', ['p2_cazador', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('EXP', ['vigia']).seguir()
    expect(j.estados('vigia')).toEqual(['buscado'])
    expect(j.zona('mazoPeligros')).toContain('armada')
  })

  it('Destino «Recompensa»: −2 y nadie queda rehén aunque falles por 3 o más (fase 13, I1); Sin oposición: + La Armada', () => {
    const j = en('ciu', ['p2_bastian', 'p2_cazador', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('EXP', ['bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir() // EXP 0 + 1 de Diego contra 3 + 2: falla por 4
    expect(j.zona('tripulacion')).toContain('bucanero')
    const k = en('ciu', ['p2_bastian', 'p2_cazador', 'calma'])
    k.comprometer('EXP', [])
    expect(k.zona('mazoPeligros')).toContain('armada')
  })
})
