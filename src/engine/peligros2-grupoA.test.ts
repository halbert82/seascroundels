// Peligros 2.0 · Grupo A (Mar y clima, cartas 1–11): al menos una prueba por carta, con sus encuentros y su Destino.

import { describe, expect, it } from 'vitest'

import { DATOS } from './datos.ts'
import { Jugador, type OpcionesSituacion, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

/** Misiones sin reglas que estorben: Mar (5 de Avance), Naturaleza (3, Distancia 0 con el Barco), Ciudad (4). */
const MISION = { mar: 'pruebas-mar5', nat: 'pruebas-nat3', ciu: 'pruebas-ciu4' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const avance = (j: Jugador, entorno: keyof typeof MISION) => j.avance(MISION[entorno])

describe('1 · La corriente del Golfo', () => {
  it('Mar: +1 [avance] por cada punto que superes, como mucho +2', () => {
    // Diego NAV 2 + Barco 1 = 3 contra NAV 2: supera por 1.
    const j = en('mar', ['p2_corriente', 'chubasco', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(2) // fase 11: NAV 2, Avance 1 / 1: 1 + 1
    // Con el Viejo lobo (NAV 3): 2 + 3 + 1 = 6, supera por 4, pero solo +2.
    const k = en('mar', ['p2_corriente', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(avance(k, 'mar')).toBe(3)
  })

  it('Mar: si fallas, Daña 1', () => {
    const j = en('mar', ['p2_corriente', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Naturaleza: si superas, preparas a un Tripulante', () => {
    const j = en('nat', ['p2_corriente', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }] })
    j.comprometer('NAV', ['capitan']).seguir().elegir('bucanero')
    expect(j.copia('bucanero').agotada).toBe(false)
  })

  it('Naturaleza: si fallas, Inflige 1 herida: la recibe quien elija el jugador, también uno que no fue asignado (fase 13)', () => {
    // El Bucanero (NAV 1 + 1 de Diego) contra NAV 2 con el Destino de «Fauna» (−1): falla.
    const j = en('nat', ['p2_corriente', 'fauna', 'calma'], { tripulacion: ['bucanero', 'viejo_lobo'] })
    j.comprometer('NAV', ['bucanero']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 1 })
    j.repartir({ viejo_lobo: 1 })
    expect(j.copia('viejo_lobo').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Ciudad «Mercante de La Habana» (revisión de Albert: sin límite de coste): agotas a 1 Tripulante y adquieres 1 Mejora del muelle pagando la mitad de su coste, redondeando hacia arriba', () => {
    const j = en('ciu', ['p2_corriente', 'calma'], { tripulacion: ['vigia'], muelle: ['marinero_p', 'bronce', 'cruz'], mano: ['ojo', 'timon'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion' })
    j.opcion('0').elegir('vigia')
    // Solo Mejoras (el Rufián de cubierta es un Tripulante), de cualquier coste: también la Cruz de Santa Bárbara (3).
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'mitadDelMuelle' } })
    expect((j.decision as { candidatas: string[] }).candidatas.map((c) => j.estado.cartas[c as `i${number}`]?.id)).toEqual(['bronce', 'cruz'])
    // La Cruz cuesta 3: la mitad es 1,5 y se redondea hacia arriba (regla general): 2 cartas.
    j.elegir('cruz')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'pagar', n: 2 } })
    j.elegir('ojo', 'timon')
    expect(j.copia('cruz').vinculadaA).toBe('barco')
    expect(j.zona('mano')).toEqual([])
    expect(j.copia('vigia').agotada).toBe(true)
  })

  it('Ciudad «Mercante de La Habana», el ejemplo de «Redondear»: agota a la Carne de cañón y adquiere las Hamacas (coste 1) pagando 1 carta (la mitad de 1 se redondea hacia arriba)', () => {
    const j = en('ciu', ['p2_corriente', 'calma'], { tripulacion: ['carne_canon'], muelle: ['hamacas', 'bronce'], mano: ['ojo', 'timon'] })
    j.opcion('0').elegir('carne_canon')
    j.elegir('hamacas')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'pagar', n: 1 } })
    j.elegir('ojo')
    expect(j.copia('hamacas').vinculadaA).toBe('barco')
    expect(j.zona('mano')).toEqual(['timon'])
    expect(j.copia('carne_canon').agotada).toBe(true)
  })

  it('Destino «Chorro»: +1 en cualquier Prueba (fase 13: fuera «Prueba de NAV: +2 en su lugar»)', () => {
    const j = en('mar', ['chubasco', 'p2_corriente', 'calma']) // Chubasco repentino: NAV 2
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('mar', ['escollos', 'p2_corriente', 'calma']) // Bajíos: NAV 2 o EXP 3
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(2)
  })

  it('Destino «Chorro», Sin oposición «−1 [avance] (mín. 0)»: el encuentro da 1 menos y no quita el Avance que ya tenías', () => {
    // «Bajíos» (Avance 2 / 1) sin nadie asignado: gana 1 − 1 = 0, y la misión conserva sus 2.
    const j = en('mar', ['escollos', 'p2_corriente', 'calma'], { avance: { 'pruebas-mar5': 2 } })
    j.comprometer('NAV', []).seguir()
    expect(j.registro).toContain('Este encuentro da 1 de Avance menos (mín. 0).')
    expect(j.registro).toContain('Ganas 0 de Avance (2/5).')
    expect(avance(j, 'mar')).toBe(2)
  })
})

describe('2 · Cielo estrellado', () => {
  it('Mar «Guiarse por las estrellas»: Otea 2 (revisión de Albert; antes 3); con un Piloto, +1 [avance]', () => {
    const j = en('mar', ['p2_cielo', 'calma', 'chubasco', 'racha', 'hallazgo'], { tripulacion: ['viejo_lobo'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'calma' } })
    j.opcion('fondo').opcion('arriba')
    // Solo 2: la tercera («racha») no se mira.
    expect(j.zona('mazoPeligros')).toEqual(['chubasco', 'racha', 'hallazgo', 'calma'])
    expect(avance(j, 'mar')).toBe(1) // 0 de la carta (fase 10b) + 1 por el Piloto
  })

  it('Mar: sin Piloto, solo el Avance de la carta (0, fase 10b)', () => {
    const j = en('mar', ['p2_cielo', 'calma', 'chubasco', 'racha'])
    j.resolverOteo()
    expect(avance(j, 'mar')).toBe(0)
  })

  it('Ciudad «El cosmógrafo»: si superas, preparas a un Tripulante asignado (fase 13: ya no queda Inspirado)', () => {
    const j = en('ciu', ['p2_cielo', 'chubasco', 'calma'], { tripulacion: ['bucanero'], mano: ['ojo'] })
    j.comprometer('EXP', ['bucanero'], ['ojo']).seguir()
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.estados('bucanero')).toEqual([])
    // Con dos asignados, eliges a cuál.
    const k = en('ciu', ['p2_cielo', 'chubasco', 'calma'], { tripulacion: ['bucanero'], mano: ['ojo'] })
    k.comprometer('EXP', ['capitan', 'bucanero'], ['ojo']).seguir().elegir('capitan')
    expect(k.copia('capitan').agotada).toBe(false)
    expect(k.copia('bucanero').agotada).toBe(true)
  })

  it('Destino «Estrella polar»: +1, y las cartas de la mano suman (fase 13: fuera «no suman», que no servía)', () => {
    const j = en('mar', ['chubasco', 'p2_cielo', 'calma'], { mano: ['timon', 'coraje'] })
    j.comprometer('NAV', ['capitan'], ['timon'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    expect(totalSinDestinoPrueba(j.estado)).toBe(5) // Diego 2 + Barco 1 + «Mano firme al timón» 2
  })
})

describe('3 · Calma chicha', () => {
  it('Mar, «A remar»: agotas a un Marinero y ganas el Avance sin Prueba', () => {
    const j = en('mar', ['p2_calma', 'calma', 'calma'], { tripulacion: ['marinero_p'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('0').opcion('rasgo')
    expect(j.copia('marinero_p').agotada).toBe(true)
    expect(j.copia('capitan').agotada).toBe(false)
    expect(avance(j, 'mar')).toBe(1) // fase 11: NAV 3, Avance 1 / 1
  })

  it('Mar, «Esperar el viento»: NAV 3; si superas, +1 [avance]', () => {
    const j = en('mar', ['p2_calma', 'chubasco', 'calma'], { tripulacion: ['marinero_p'] })
    j.opcion('1').comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(2) // 1 del encuentro y 1 por superarla
  })

  it('Mar: si no puedes pagar «A remar», solo queda la Prueba', () => {
    const j = en('mar', ['p2_calma', 'chubasco', 'calma'])
    expect(j.decision).toMatchObject({ tipo: 'comprometer' })
  })

  it('Mar: si fallas, cada Tripulante sufre 1 herida, asignado o no, Capitán incluido (fase 13)', () => {
    // Destino «Niebla espesa» (−1): el Bucanero (NAV 1 + 1 de Diego + 1 del Barco) no llega a 3.
    const j = en('mar', ['p2_calma', 'niebla', 'calma'], { tripulacion: ['bucanero', 'carpintero'] })
    j.opcion('1').comprometer('NAV', ['bucanero']).seguir()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('carpintero').heridas).toBe(1)
    expect(j.copia('capitan').heridas).toBe(1)
  })

  it('Naturaleza «Bochorno»: suma 1 a la dificultad por cada asignado herido (fase 13); si fallas, agotas a 1 Tripulante', () => {
    const j = en('nat', ['p2_calma', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('COM', ['bucanero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(3) // COM 2 + 1 de Diego: el herido ya no suma menos
    expect(dificultadConDestino(j.estado)).toBe(4) // COM 3 + 1 por el Bucanero herido
    j.seguir()
    expect(j.copia('capitan').agotada).toBe(true)
  })

  it('Naturaleza «Bochorno»: si superas, curas 2 heridas', () => {
    const j = en('nat', ['p2_calma', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'], capitan: { heridas: 2 } })
    j.comprometer('COM', ['capitan']).seguir() // COM 3 contra 3 + 1 (Diego está herido)
    expect(j.copia('capitan').heridas).toBe(2) // falla: no cura
    const k = en('nat', ['p2_calma', 'chubasco', 'calma'], { tripulacion: ['bucanero'], capitan: { heridas: 2 } })
    k.comprometer('COM', ['bucanero']).seguir() // COM 2 + 1 de Diego contra 3: supera
    expect(k.copia('capitan').heridas).toBe(0)
  })

  it('Destino «Ni un soplo»: −1 (fase 13: el Barco sí da su +1 en las Pruebas de NAV)', () => {
    const j = en('mar', ['chubasco', 'p2_calma', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(3)
    expect(dificultadConDestino(j.estado)).toBe(3)
  })
})

describe('4 · Niebla', () => {
  it('Mar: Abordaje sin asignados: 1 herida por cada punto que falta, repartidas como quieras, y nada más (fase 14)', () => {
    const j = en('mar', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carpintero'] })
    j.comprometer('COM', [])
    j.seguir()
    // Faltan 3 (COM 3 contra nadie): 3 heridas repartidas como quieras (fase 10); ya no hay rehén.
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 3, motivo: { clave: 'heridas', n: 3 } })
    j.repartir({ capitan: 3 })
    expect(j.copia('capitan').heridas).toBe(3)
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero', 'carpintero'])
  })

  it('Mar: con un Vigía la dificultad baja 1 (Vigía −1); si superas, nada más (fase 13: ya no prepara un Cañón)', () => {
    const j = en('mar', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['vigia'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir()
    expect(j.copia('bronce').agotada).toBe(true)
  })

  it('Naturaleza «Bruma en la selva»: resuelves 2 cartas de Destino y valen las dos (los modificadores se suman)', () => {
    // «Racha favorable» (+1) y «Guías de la aldea» (+2): +3 al total.
    const j = en('nat', ['p2_niebla', 'racha', 'amigos', 'calma', 'calma'])
    j.comprometer('EXP', ['capitan'])
    expect(j.estado.prueba?.destino).toBe(j.inst('racha'))
    expect(j.estado.prueba?.segundoDestino).toBe(j.inst('amigos'))
    expect(j.zona('destino')).toEqual(expect.arrayContaining(['racha', 'amigos']))
    expect(j.zona('destino')).toHaveLength(2)
    expect(dificultadConDestino(j.estado)).toBe(0) // EXP 3 − 3
    expect(j.registro.some((r) => r.startsWith('Segundo Destino, de la carta'))).toBe(true)
  })

  it('Naturaleza «Bruma en la selva»: sin nadie asignado se aplican los dos Sin oposición', () => {
    // «Percances» y «Niebla espesa»: cada uno, Sin oposición «−1 [avance]».
    const j = en('nat', ['p2_niebla', 'percances', 'niebla', 'calma', 'calma'], { avance: { 'pruebas-nat3': 2 } })
    j.comprometer('EXP', []).seguir()
    expect(j.registro.filter((r) => r === 'Pierdes 1 de Avance.')).toHaveLength(2)
    expect(avance(j, 'nat')).toBe(1) // 2 − 1 − 1, y la Bruma da 1 (Avance 1 / 1)
    expect(j.zona('descartesPeligros')).toEqual(expect.arrayContaining(['percances', 'niebla', 'p2_niebla']))
  })

  it('Naturaleza «Bruma en la selva»: «Reflejos de gato» cancela solo uno de los dos Destinos, el que elijas', () => {
    // «Fauna» (−1) y «Guías de la aldea» (+2): cancela el de Fauna y queda +2.
    const j = en('nat', ['p2_niebla', 'fauna', 'amigos', 'calma', 'calma'], { mano: ['reflejos', 'ojo'] })
    j.comprometer('EXP', ['capitan']).usar('reflejos.jugar').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'cancelarCualDestino' } })
    j.opcion(j.inst('fauna'))
    expect(j.estado.prueba?.destinoCancelado).toBe(true)
    expect(j.estado.prueba?.segundoCancelado).toBe(false)
    expect(dificultadConDestino(j.estado)).toBe(1) // EXP 3 − 2
  })

  it('Naturaleza «Bruma en la selva»: si fallas, se descarta el asignado con menos EXP; si es el Capitán, sufre 1 herida', () => {
    // Diego (EXP 1) y el Bucanero (EXP 0 + 1 de Diego, que se agota a la vez: 0) contra EXP 3 y dos Destinos de 0.
    const j = en('nat', ['p2_niebla', 'chubasco', 'escollos', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('EXP', ['capitan', 'bucanero']).seguir()
    expect(j.zona('tripulacion')).not.toContain('bucanero')
    expect(j.zona('descartesMuelle')).toContain('bucanero')
    // Solo Diego asignado: es el de menos EXP, pero el Capitán no se descarta: sufre 1 herida.
    const k = en('nat', ['p2_niebla', 'chubasco', 'escollos', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.zona('tripulacion')).toContain('capitan')
  })

  it('Naturaleza «Bruma en la selva» (fase 14): es una carta de Peligro la que descarta, así que el Fiador puede ir en su lugar', () => {
    const j = en('nat', ['p2_niebla', 'chubasco', 'escollos', 'calma'], { tripulacion: ['bucanero', 'fiador'] })
    j.comprometer('EXP', ['capitan', 'bucanero']).seguir()
    expect(j.ofreceCapacidad('fiador.descarte')).toBe(true)
    j.usar('fiador.descarte').pasarOfertas()
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.zona('descartesMuelle')).toContain('fiador')
  })

  it('Ciudad: si fallas, el asignado con más EXP queda Buscado', () => {
    const j = en('ciu', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('EXP', ['bucanero']).seguir()
    expect(j.estados('bucanero')).toEqual(['buscado'])
  })

  it('Ciudad, el ejemplo de «Asignado con más (o menos)»: Diego y el Carpintero de a bordo (EXP 1 los dos) empatan; el jugador elige quién queda Buscado', () => {
    // Diego 1 + Carpintero 1 (sin el +1 de Diego, que se agota a la vez) con el −1 de «Fauna»: 1 contra 2, falla.
    const j = en('ciu', ['p2_niebla', 'fauna', 'calma'], { tripulacion: ['carpintero'] })
    j.comprometer('EXP', ['capitan', 'carpintero']).seguir()
    expect(j.registro).toContain('Total 1 contra 2: fallas la Prueba.')
    expect(j.decision.tipo).toBe('elegirCartas')
    const candidatas = (j.decision as { candidatas: string[] }).candidatas
    expect(candidatas.map((c) => j.estado.cartas[c as `i${number}`]?.id).sort()).toEqual(['capitan', 'carpintero'])
    j.elegir('carpintero')
    expect(j.estados('carpintero')).toEqual(['buscado'])
    expect(j.estados('capitan')).toEqual([])
  })

  it('P72, regla general: sin nadie asignado, «el asignado con menos EXP» es el de menos EXP de toda la tripulación (ejemplo del reglamento)', () => {
    // Diego (EXP 1) y la Carne de cañón (EXP 0): se descarta la Carne de cañón.
    const j = en('nat', ['p2_niebla', 'chubasco', 'escollos', 'calma'], { tripulacion: ['carne_canon'] })
    j.comprometer('EXP', []).seguir()
    expect(j.zona('tripulacion')).not.toContain('carne_canon')
    expect(j.zona('descartesMuelle')).toContain('carne_canon')
    // Con la Vigía inexperta (EXP 2), el de menos EXP es Diego: sufre 1 herida en su lugar.
    const k = en('nat', ['p2_niebla', 'chubasco', 'escollos', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('EXP', []).seguir()
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.zona('tripulacion')).toEqual(expect.arrayContaining(['capitan', 'vigia']))
  })

  it('P72, regla general: sin nadie asignado, «el asignado con más EXP queda Buscado» va al de más EXP de toda la tripulación', () => {
    const j = en('ciu', ['p2_niebla', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'baqueano'] })
    j.comprometer('EXP', []).seguir()
    expect(j.estados('baqueano')).toEqual(['buscado'])
    expect(j.estados('capitan')).toEqual([])
  })

  it('Destino «Bruma»: −1 en cualquier encuentro (fase 13); Sin oposición: −1 [avance] (mín. 0)', () => {
    const j = en('mar', ['chubasco', 'p2_niebla', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    // Sin nadie: «Chubasco» (Avance 2 / 1) da 0; la misión no pierde el Avance que tenía.
    const k = en('mar', ['chubasco', 'p2_niebla', 'calma'], { avance: { 'pruebas-mar5': 1 } })
    k.comprometer('NAV', []).seguir()
    expect(avance(k, 'mar')).toBe(1)
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

  it('Naturaleza «El estero sube»: si superas, la siguiente Prueba de esta misión recibe −1 de dificultad (fase 13: de cualquier tipo)', () => {
    const j = en('nat', ['p2_bajamar', 'chubasco', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: -1 }])
    // «Lluvia torrencial» (EXP 1): con el −1 pide 0.
    j.seguir().comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(0)
  })

  it('Naturaleza «El estero sube»: si fallas, el asignado con menos NAV sufre 1 herida y −1 [avance]', () => {
    // Diego (NAV 2) y el Bucanero (NAV 1) suman 3 contra NAV 3, y el Destino de «Fauna» (−1) los deja en 2.
    const j = en('nat', ['p2_bajamar', 'fauna', 'calma'], { tripulacion: ['bucanero'], avance: { 'pruebas-nat3': 1 } })
    j.comprometer('NAV', ['capitan', 'bucanero']).seguir()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('capitan').heridas).toBe(0)
    expect(avance(j, 'nat')).toBe(1) // 1 − 1 + 1 (Avance 1 / 1)
  })

  it('Ciudad «Casco en seco»: si superas, Repara 1 (2 si tienes un Carpintero)', () => {
    const j = en('ciu', ['p2_bajamar', 'chubasco', 'calma'], { barco: { dano: 3 }, mano: ['ojo'] })
    j.comprometer('EXP', ['capitan'], ['ojo']).seguir()
    expect(j.estado.danoBarco).toBe(2)
    const k = en('ciu', ['p2_bajamar', 'chubasco', 'calma'], { barco: { dano: 3 }, tripulacion: ['carpintero'] })
    k.comprometer('EXP', ['capitan', 'carpintero']).seguir()
    expect(k.estado.danoBarco).toBe(1)
  })

  it('Ciudad «Casco en seco»: si fallas, descartas 1 carta por cada daño del Barco (mín. 1, máx. 3)', () => {
    const j = en('ciu', ['p2_bajamar', 'chubasco', 'calma'], { barco: { dano: 2 }, mano: ['ojo', 'timon', 'coraje', 'emboscada'] })
    j.comprometer('EXP', []).seguir().elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje', 'emboscada'])
  })

  it('Destino «Repunte de la marea»: si superas, +1 [avance]; si fallas, −1 [avance]; Sin oposición, este encuentro da 1 menos (mín. 0)', () => {
    const j = en('mar', ['chubasco', 'p2_bajamar', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(avance(j, 'mar')).toBe(3) // 2 de la carta + 1 del Destino
    const k = en('mar', ['chubasco', 'p2_bajamar', 'calma'], { avance: { 'pruebas-mar5': 1 } })
    k.comprometer('NAV', []).seguir()
    // Falla: −1 a la misión (1 → 0); y Sin oposición: «Chubasco» (Avance 2 / 1, no la supera) da 1 − 1 = 0.
    expect(avance(k, 'mar')).toBe(0)
  })
})

describe('6 · Arrecife', () => {
  it('Mar: Vigía −2; si superas, Otea 1 (fase 13: antes descartaba la carta superior)', () => {
    const j = en('mar', ['p2_arrecife', 'chubasco', 'niebla', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2) // NAV 4, Vigía −2
    j.seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear' } })
    j.opcion('fondo')
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'niebla'])
  })

  it('Mar: si fallas, Daña 2 (fase 13: ya no agota un Cañón)', () => {
    const j = en('mar', ['p2_arrecife', 'chubasco', 'calma'], { barco: { mejoras: ['bronce'] } })
    j.comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.copia('bronce').agotada).toBe(false)
  })

  it('Naturaleza «Raqueros de la costa»: si superas, adquieres sin coste una Mejora del muelle, sea cual sea su coste', () => {
    const j = en('nat', ['p2_arrecife', 'chubasco', 'calma'], { tripulacion: ['bucanero'], muelle: ['cruz', 'sable'] })
    j.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'gratisDelMuelle' } })
    j.elegir('cruz') // coste 3
    expect(j.zona('mejoras')).toContain('cruz')
  })

  it('Naturaleza «Raqueros de la costa»: si fallas, Inflige 2 heridas: van a quien quiera el jugador (fase 13)', () => {
    // El ejemplo del «tanque»: el Cañonero (COM 1 + 1 de Diego) falla con el −1 del Destino de «Calma chicha» y las
    // heridas van a Diego, que se quedó a bordo.
    const j = en('nat', ['p2_arrecife', 'p2_calma', 'calma'], { tripulacion: ['canonero'] })
    j.comprometer('COM', ['canonero']).seguir()
    expect(j.registro).toContain('Total 1 contra 3: fallas la Prueba.')
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    j.repartir({ capitan: 2 })
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.copia('canonero').heridas).toBe(0)
  })

  it('Ciudad «La barra del puerto»: Marinero asignado −2; si superas, robas 1; si fallas, Daña 1 aunque estés en tierra', () => {
    const j = en('ciu', ['p2_arrecife', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', 'vigia'], mazoCapitan: ['ojo'] })
    j.comprometer('NAV', ['viejo_lobo'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.pasarOfertas().seguir()
    expect(j.zona('mano')).toContain('ojo')
    const k = en('ciu', ['p2_arrecife', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', 'vigia'] })
    k.comprometer('NAV', ['vigia'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.seguir()
    expect(k.estado.danoBarco).toBe(1)
  })

  it('Destino «Coral bajo la quilla»: −1 siempre (fase 13: ya no es 0 con un Vigía asignado)', () => {
    const j = en('mar', ['chubasco', 'p2_arrecife', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['vigia'])
    expect(dificultadConDestino(j.estado)).toBe(3)
  })

  it('Destino «Coral bajo la quilla», Sin oposición: [mar]: Daña 1; [nat]/[ciu]: Inflige 1 herida', () => {
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
  it('Mar, «Anegar la santabárbara»: agotas todos los Cañones (fase 15, quinta ronda: sin Pólvora mojada)', () => {
    const j = en('mar', ['p2_fuego', 'calma', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    j.opcion('0')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.copia('culebrina').agotada).toBe(true)
    expect(j.estadosBarco).toEqual([])
  })

  it('Mar «Fuego en la Santa Bárbara», «Atacar el fuego» (revisión de Albert): NAV 4; antes de asignar, −1 por cada Cañón que agotes; si fallas, Daña 1 y agota todos tus Cañones', () => {
    // Con 2 Cañones: Anegar, atacar sin agotar, agotando 1 o agotando 2 (no se ofrecen 3, 4 ni 5).
    const opciones = (j: Jugador) => (j.decision.tipo === 'elegirOpcion' ? j.decision.opciones.map((o) => o.clave) : [])
    const sinCanones = en('mar', ['p2_fuego', 'chubasco', 'calma', 'calma'])
    expect(opciones(sinCanones)).toEqual(['0', '1'])
    const j = en('mar', ['p2_fuego', 'chubasco', 'calma', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    expect(opciones(j)).toEqual(['0', '1', '2', '3'])
    const k = en('mar', ['p2_fuego', 'chubasco', 'calma', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    k.opcion('1').comprometer('NAV', [])
    expect(dificultadConDestino(k.estado)).toBe(4)
    j.opcion('3')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.copia('culebrina').agotada).toBe(true)
    j.comprometer('NAV', [])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir()
    expect(j.estado.danoBarco).toBe(1)
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.copia('culebrina').agotada).toBe(true)
    expect(j.estadosBarco).toEqual([])
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

  it('Destino «Pavesas»: −1, con o sin Cañones preparados (fase 13, I1: fuera «−2 con 2 o más Cañones»)', () => {
    const j = en('mar', ['chubasco', 'p2_fuego', 'calma'], { barco: { mejoras: ['bronce', 'culebrina'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('mar', ['chubasco', 'p2_fuego', 'calma'], { barco: { mejoras: ['bronce'] } })
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3)
  })
})

describe('8 · La broma', () => {
  it('Mar «Casco carcomido por la broma» (revisión de Albert y P130): EXP X = 1 + el Espacio que ocupan tus Mejoras de barco (mín. 3), −2 con un Carpintero asignado, sin máximo', () => {
    expect(DATOS.peligros.find((p) => p.id === 'p2_broma')?.encuentros.mar?.notaPrueba).toBe('X = 1 + el Espacio que ocupan tus Mejoras de barco (mín. 3); _Carpintero_ asignado −2.')
    // Vela mayor (1), Hamacas (1) y Casco reforzado (2): Espacio 4, X = 5.
    const mejoras = ['vela', 'hamacas', 'casco']
    const j = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras }, tripulacion: ['carpintero'] })
    j.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    const k = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras }, tripulacion: ['carpintero'] })
    k.comprometer('EXP', ['carpintero'])
    expect(dificultadConDestino(k.estado)).toBe(3)
    // P130 (Albert): sin Mejoras, 1 + 0 = 1, pero el mínimo es 3.
    const l = en('mar', ['p2_broma', 'chubasco', 'calma'])
    l.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(l.estado)).toBe(3)
    // La Bandera negra no ocupa Espacio: también 3.
    const m = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras: ['bandera'] } })
    m.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(m.estado)).toBe(3)
    // Con la Vela mayor (1 de Espacio), 1 + 1 = 2: también 3.
    const v = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras: ['vela'] } })
    v.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(v.estado)).toBe(3)
    // El −2 del Carpintero asignado va después del mínimo: sin Mejoras, 3 − 2 = 1.
    const c = en('mar', ['p2_broma', 'chubasco', 'calma'], { tripulacion: ['carpintero'] })
    c.comprometer('EXP', ['carpintero'])
    expect(dificultadConDestino(c.estado)).toBe(1)
    // Con 6 de Espacio (Casco, Bronce y Chalupa), X = 7 (sin máximo; antes, como mucho 5).
    const n = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { mejoras: ['casco', 'bronce', 'chalupa'] } })
    n.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(n.estado)).toBe(7)
  })

  it('Mar: si fallas, el Barco queda Anegado; si ya lo estaba, 2 daños', () => {
    const j = en('mar', ['p2_broma', 'chubasco', 'calma'])
    j.comprometer('EXP', []).seguir()
    expect(j.estadosBarco).toEqual(['viaDeAgua'])
    j.opcion('1') // Anegado: al terminar la carta en el Mar: no achicas, 1 daño
    expect(j.estado.danoBarco).toBe(1)
    const k = en('mar', ['p2_broma', 'chubasco', 'calma'], { barco: { estados: ['viaDeAgua'] } })
    k.comprometer('EXP', []).seguir().opcion('1')
    expect(k.estado.danoBarco).toBe(3)
  })

  it('Naturaleza «Puente desatendido» (revisión de Albert): +1 por cada Tripulante asignado; si superas, +1 Avance por cada Tripulante asignado', () => {
    const j = en('nat', ['p2_broma', 'chubasco', 'calma'], { tripulacion: ['vigia', 'baqueano'] })
    j.comprometer('EXP', ['vigia', 'baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    // Con uno solo: EXP 3 + 1 = 4. El Rastreador (EXP 3, +1 de Diego) llega: 1 de Avance del encuentro y 1 por el asignado.
    const k = en('nat', ['p2_broma', 'chubasco', 'calma'], { tripulacion: ['baqueano'] })
    k.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.pasarOfertas().seguir().pasarOfertas()
    expect(avance(k, 'nat')).toBe(2)
  })

  it('Ciudad «Muelle carcomido» (revisión de Albert): si fallas, descartas 2 cartas al azar (antes, la de mayor coste)', () => {
    const j = en('ciu', ['p2_broma', 'chubasco', 'calma'], { mano: ['ojo', 'soborno', 'timon'] })
    j.pasarOfertas().comprometer('EXP', []).seguir()
    expect(j.zona('mano')).toHaveLength(1)
    expect(j.zona('descartesCapitan')).toHaveLength(2)
  })

  it('Destino «Carcoma»: 0, y las Mejoras suman (fase 13, I1: fuera «las Mejoras no suman»)', () => {
    const j = en('mar', ['chubasco', 'p2_broma', 'calma'], { capitan: { mejoras: ['brujula'] } })
    j.comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // Diego 2 + Barco 1 + Brújula 1
    expect(dificultadConDestino(j.estado)).toBe(2)
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
  it('Mar «Turbonada a popa» (revisión de Albert): si superas, +1 Avance; la carta ya no va al fondo del mazo de Peligros', () => {
    const j = en('mar', ['p2_turbonada', 'chubasco', 'calma', 'racha'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'racha'])
    expect(j.zona('descartesPeligros')).toContain('p2_turbonada')
    expect(avance(j, 'mar')).toBe(4)
  })

  it('Mar: si fallas, 1 daño y el Barco queda Desarbolado (sin el +1 de NAV del Barco y con Distancias 1 mayores)', () => {
    const j = en('mar', ['p2_turbonada', 'chubasco', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estadosBarco).toEqual(['velasRotas'])
    j.seguir().comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(2)
  })

  it('Naturaleza «Rayos en la sierra» (revisión de Albert): EXP 2, +1 por cada Tripulante herido de toda la tripulación (máx. +2); si fallas, el de menos Vida sufre 2 heridas', () => {
    // Los agotados ya no cuentan: sin heridos, EXP 2.
    const sinHeridos = en('nat', ['p2_turbonada', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }] })
    sinHeridos.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(sinHeridos.estado)).toBe(2)
    // Un herido que no se asigna también cuenta (al pie de la letra).
    const uno = en('nat', ['p2_turbonada', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    uno.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(uno.estado)).toBe(3)
    // Tres heridos: como mucho +2.
    const j = en('nat', ['p2_turbonada', 'chubasco', 'calma'], {
      capitan: { heridas: 1 },
      tripulacion: [{ id: 'bucanero', heridas: 1 }, { id: 'carpintero', heridas: 1 }, 'vigia'],
    })
    j.comprometer('EXP', [])
    expect(dificultadConDestino(j.estado)).toBe(4)
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

  it('Naturaleza: si fallas, por cada punto que falte (máx. 3) eliges: Inflige 1 herida (libre, fase 13) o −1 [avance]', () => {
    const j = en('nat', ['p2_huracan', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'viejo_lobo'], avance: { 'pruebas-nat3': 2 } })
    j.comprometer('EXP', ['bucanero']).seguir() // EXP 0 + 1 = 1 contra 5: faltan 4, como mucho 3
    j.opcion('1').opcion('1') // sin Avance que perder, la tercera es la herida, que va a quien elijas
    j.elegir('viejo_lobo')
    expect(j.copia('viejo_lobo').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
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

  it('Ciudad (fase 14): si fallas, un asignado queda sepultado: sufre 1 herida y queda Extenuado (fase 16)', () => {
    const j = en('ciu', ['p2_maremoto', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('COM', ['bucanero', 'vigia']).seguir() // COM 5: 2 + 0
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('bucanero')
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.estados('bucanero')).toEqual(['extenuado'])
    expect(j.estado.temporales.some((t) => t.clave === 'noPrepara')).toBe(false)
    expect(j.zona('tripulacion')).toContain('bucanero')
  })

  it('Destino «Réplica»: −2 y nada más (fase 13, I1: fuera «la siguiente Prueba +1»); Sin oposición: el Capitán sufre 1 herida', () => {
    const j = en('mar', ['chubasco', 'p2_maremoto', 'chubasco', 'chubasco'])
    j.comprometer('NAV', []).seguir()
    expect(j.copia('capitan').heridas).toBe(1)
    j.seguir().comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2) // la siguiente Prueba, sin nada de más
    const k = en('mar', ['chubasco', 'p2_maremoto', 'calma'])
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(4) // NAV 2 + 2
  })
})

describe('Fase 13 · Dos Destinos y el jugador automático', () => {
  it('con «Reflejos de gato», el jugador automático cancela el peor de los dos Destinos', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const j = en('nat', ['p2_niebla', 'amigos', 'fauna', 'calma', 'calma'], { mano: ['reflejos', 'ojo'] })
    j.comprometer('EXP', ['capitan']).usar('reflejos.jugar').elegir('ojo')
    expect(jugadorConCriterio()(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: j.inst('fauna') })
  })
})
