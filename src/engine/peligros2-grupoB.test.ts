// Peligros 2.0 · Grupo B (Bestias, naturaleza y enfermedades, cartas 12–22): al menos una prueba por carta, con sus
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

describe('12 · Tortugas', () => {
  it('Mar: si superas, preparas a los comprometidos; si fallas, agotas a 1 Tripulante preparado', () => {
    const j = en('mar', ['p2_tortugas', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', ['bucanero']).pasarOfertas().seguir()
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('mar', ['p2_tortugas', 'chubasco', 'calma'])
    k.comprometer('COM', []).seguir()
    expect(k.copia('capitan').agotada).toBe(true)
  })

  it('Naturaleza (sin Prueba): curas 2 repartidas y, con un Animal o un Explorador, preparas 1', () => {
    const j = en('nat', ['p2_tortugas', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1, agotada: true }, 'loro'] })
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(avance(j, 'nat')).toBe(0) // fase 10b: sin Prueba y con premio, Avance 0
  })

  it('Ciudad: si superas, robas 2', () => {
    const j = en('ciu', ['p2_tortugas', 'chubasco', 'calma'], { tripulacion: ['baqueano'] })
    const antes = j.zona('mano').length
    j.comprometer('EXP', ['baqueano']).pasarOfertas().seguir()
    expect(j.zona('mano').length).toBe(antes + 2)
  })

  it('Destino «Concha dura»: +1 y nada más (fase 13, I1: ya no deja Aguerrido); Sin oposición, el encuentro da 1 de Avance menos (mín. 0)', () => {
    const j = en('mar', ['p2_corriente', 'p2_tortugas', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(1)
    j.seguir()
    expect(j.estados('viejo_lobo')).toEqual([])
    // «Arrecife de los Colorados» (Avance 3 / 2) sin nadie asignado: da 2 − 1.
    const k = en('mar', ['p2_arrecife', 'p2_tortugas', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.registro).toContain('Este encuentro da 1 de Avance menos (mín. 0).')
    expect(avance(k, 'mar')).toBe(1)
    // «Corriente del Golfo» (1 / 1): da 0, y la misión no pierde el Avance que ya tenía.
    const m = en('mar', ['p2_corriente', 'p2_tortugas', 'calma'], { avance: { 'pruebas-mar5': 2 } })
    m.comprometer('NAV', []).seguir()
    expect(avance(m, 'mar')).toBe(2)
  })
})

describe('13 · Sol de justicia', () => {
  it('Mar: NAV 1 con un Carpintero; si superas, preparas 1; si fallas, Vía de agua', () => {
    const j = en('mar', ['p2_sol', 'chubasco', 'calma'], { tripulacion: ['carpintero'] })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    j.seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    const k = en('mar', ['p2_sol', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estadosBarco).toContain('viaDeAgua')
  })

  it('Naturaleza, Elige: volver al arroyo (pierdes 1 Avance y ganas el del encuentro) o la Prueba; si la fallas, 1 herida a cada asignado (fase 10b)', () => {
    const j = en('nat', ['p2_sol', 'calma', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('0')
    expect(avance(j, 'nat')).toBe(1) // 1 − 1 + 1 (fase 11: EXP 3, Avance 1 / 1)
    const k = en('nat', ['p2_sol', 'chubasco', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    k.opcion('1').comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(1)
  })

  it('Naturaleza: si fallas la Prueba, 1 herida por cada asignado, libres (fase 13, P79): pueden ir a un no asignado', () => {
    const j = en('nat', ['p2_sol', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'] })
    j.comprometer('EXP', ['bucanero', 'marinero_p']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    j.repartir({ capitan: 2 })
    expect([j.copia('capitan').heridas, j.copia('bucanero').heridas, j.copia('marinero_p').heridas]).toEqual([2, 0, 0])
  })

  it('Naturaleza: sin Avance que perder, no se puede volver al arroyo: se hace la Prueba', () => {
    const j = en('nat', ['p2_sol', 'chubasco', 'calma'])
    expect(j.decision).toMatchObject({ tipo: 'comprometer' })
  })

  it('Ciudad: EXP 2, +1 por cada comprometido después del primero; si fallas, el comprometido con más EXP queda Buscado', () => {
    const j = en('ciu', ['p2_sol', 'chubasco', 'calma'], { tripulacion: ['marinero_p'] })
    j.comprometer('EXP', ['capitan', 'marinero_p']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(j.estados('capitan')).toEqual(['buscado'])
  })

  it('Destino «Mediodía»: −1 en cualquier Prueba (fase 13, I1: ya no −2 en las de COM); Sin oposición, el Capitán sufre 1 herida', () => {
    const j = en('mar', ['p2_corriente', 'p2_sol', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('mar', ['fauna', 'p2_sol', 'calma'])
    k.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3) // «Tiburones» (COM 2) + 1
    const m = en('mar', ['p2_corriente', 'p2_sol', 'calma'])
    m.comprometer('NAV', [])
    expect(m.copia('capitan').heridas).toBe(1)
  })
})

describe('14 · El hambre', () => {
  it('Mar: si fallas, cada Tripulante ya herido sufre 1 herida más; si superas (EXP 1 con un Cirujano), curas 1 a cada herido', () => {
    const j = en('mar', ['p2_hambre', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: ['viejo_lobo'] })
    j.comprometer('EXP', []).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.copia('viejo_lobo').heridas).toBe(0)
    const k = en('mar', ['p2_hambre', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: ['matasanos'] })
    k.comprometer('EXP', ['capitan']).pasarOfertas()
    expect(dificultadConDestino(k.estado)).toBe(1)
    k.seguir()
    expect(k.copia('capitan').heridas).toBe(0)
  })

  it('Naturaleza: si superas, preparas 2; si fallas, el Tripulante con menos Vida sufre 2 heridas', () => {
    const j = en('nat', ['p2_hambre', 'chubasco', 'calma'], { tripulacion: ['baqueano', { id: 'bucanero', agotada: true }] })
    j.comprometer('EXP', ['capitan']).pasarOfertas().seguir()
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    const k = en('nat', ['p2_hambre', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['coleto'] }] })
    k.comprometer('EXP', []).seguir()
    expect(k.copia('viejo_lobo').heridas).toBe(2)
  })

  it('Ciudad, Elige: pagas 2 cartas (y ganas el Avance) o regateas; si fallas, −1 Mando en tu próximo turno', () => {
    const j = en('ciu', ['p2_hambre', 'calma', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje'])
    expect(avance(j, 'ciu')).toBe(1) // pagar cuenta como superar: X (fase 11: 1 / 1)
    const k = en('ciu', ['p2_hambre', 'chubasco', 'calma'], { mano: ['ojo', 'timon'] })
    const mando = k.valor({ tipo: 'objetivoRobo' })
    k.opcion('1').comprometer('EXP', []).seguir()
    expect(k.valor({ tipo: 'objetivoRobo' })).toBe(mando) // este turno no
    expect(k.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'menosMando', desdeTurno: k.estado.turno + 1 }))
  })

  it('Destino «Ración corta»: 0 y nada más (fase 13, I1: el de la habilidad más alta ya no se queda sin preparar); Sin oposición, descartas 1', () => {
    const j = en('mar', ['p2_corriente', 'p2_hambre', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(2)
    expect(j.estado.temporales.some((t) => t.clave === 'noPrepara')).toBe(false)
    const k = en('mar', ['p2_corriente', 'p2_hambre', 'calma'], { mano: ['ojo'] })
    k.comprometer('NAV', [])
    expect(k.zona('mano')).toEqual([])
  })
})

describe('15 · Sin rumbo', () => {
  it('Mar: si superas, Otea 2 (fase 13, I7: cada una arriba o al fondo); si fallas, −1 Avance (I2: el siguiente encuentro sí da el suyo)', () => {
    const j = en('mar', ['p2_sinrumbo', 'chubasco', 'racha', 'calma', 'fauna'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'racha' } })
    j.opcion('fondo')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'calma' } })
    j.opcion('arriba')
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'fauna', 'racha'])
    const k = en('mar', ['p2_sinrumbo', 'chubasco', 'calma', 'calma'], { avance: { 'pruebas-mar5': 2 } })
    k.comprometer('NAV', []).seguir()
    expect(avance(k, 'mar')).toBe(2) // 2 − 1 del fallo + 1 del encuentro (1 / 1)
    k.seguir()
    expect(avance(k, 'mar')).toBe(4) // la «calma» siguiente da sus 2
  })

  it('Naturaleza: NAV 1 si un comprometido lleva una Brújula', () => {
    const j = en('nat', ['p2_sinrumbo', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', mejoras: ['brujula'] }] })
    j.comprometer('NAV', ['bucanero']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(1)
  })

  it('Naturaleza: si fallas, el comprometido con más NAV se pierde; un Vigía o un Explorador lo encuentra', () => {
    const j = en('nat', ['p2_sinrumbo', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'noPrepara', hasta: 'finMision', inst: j.inst('capitan') }))
    expect(j.ofreceCapacidad('p2_sinrumbo.encontrar')).toBe(true)
    j.usar('p2_sinrumbo.encontrar')
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.estado.temporales.some((t) => t.fuente === 'p2_sinrumbo')).toBe(false)
  })

  it('Ciudad: si superas, la siguiente Prueba −1; si fallas, descartas 1 al azar', () => {
    const j = en('ciu', ['p2_sinrumbo', 'chubasco', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: -1 }])
    const k = en('ciu', ['p2_sinrumbo', 'chubasco', 'calma'], { mano: ['ojo', 'timon'] })
    k.comprometer('NAV', []).seguir()
    expect(k.zona('mano')).toHaveLength(1)
  })

  it('Destino «Aguja de marear»: +1, también con un Vigía asignado (fase 13, I1); Sin oposición, el encuentro da 1 de Avance menos (mín. 0)', () => {
    const j = en('mar', ['p2_corriente', 'p2_sinrumbo', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    const k = en('mar', ['p2_corriente', 'p2_sinrumbo', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('NAV', ['capitan', 'vigia']).pasarOfertas()
    expect(dificultadConDestino(k.estado)).toBe(1)
    // Sin nadie asignado, «Arrecife de los Colorados» (3 / 2) da 1 de Avance, y no quita los 2 que ya tenía la misión.
    const m = en('mar', ['p2_arrecife', 'p2_sinrumbo', 'calma'], { avance: { 'pruebas-mar5': 2 } })
    m.comprometer('NAV', []).seguir()
    expect(avance(m, 'mar')).toBe(3)
  })
})

describe('16 · Serpientes', () => {
  it('Mar: con un Animal superas sin Prueba (y robas 1); si fallas, el no comprometido con menos Vida sufre 2 heridas', () => {
    const j = en('mar', ['p2_serpientes', 'calma'], { tripulacion: ['loro'] })
    expect(j.registro).toContain('Superas la Prueba sin hacerla.')
    const k = en('mar', ['p2_serpientes', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['coleto'] }] })
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('viejo_lobo').heridas).toBe(2)
    expect(k.copia('capitan').heridas).toBe(0)
  })

  it('Naturaleza: si fallas, el comprometido con menos COM queda Envenenado', () => {
    const j = en('nat', ['p2_serpientes', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('COM', ['vigia']).pasarOfertas().seguir()
    expect(j.estados('vigia')).toEqual(['envenenado'])
  })

  it('Ciudad: si superas, quitas un Estado a un Tripulante o curas 2', () => {
    const j = en('ciu', ['p2_serpientes', 'chubasco', 'calma'], { tripulacion: ['baqueano', { id: 'bucanero', estados: ['asustado'] }] })
    j.comprometer('EXP', ['baqueano']).pasarOfertas().seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion' })
    j.opcion('0')
    expect(j.estados('bucanero')).toEqual([])
  })

  it('Destino «Colmillo»: 0 y nada más (fase 13, I1: ya no Envenena al fallar); Sin oposición, el preparado con menos Vida sufre 1', () => {
    const j = en('mar', ['p2_arrecife', 'p2_serpientes', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.registro).toContain('Total 3 contra 4: fallas la Prueba.')
    expect(j.estados('capitan')).toEqual([])
    const k = en('mar', ['p2_corriente', 'p2_serpientes', 'calma'], { tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', [])
    expect(k.copia('viejo_lobo').heridas).toBe(1)
  })
})

describe('17 · Fiebre amarilla', () => {
  it('Mar: NAV 4; si superas, curas 1 herida a cada Tripulante', () => {
    const j = en('mar', ['p2_fiebre', 'chubasco', 'calma'], {
      capitan: { heridas: 1 },
      tripulacion: [{ id: 'viejo_lobo', heridas: 1 }, { id: 'bucanero', heridas: 1 }],
    })
    j.comprometer('NAV', ['capitan', 'viejo_lobo'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.pasarOfertas().seguir()
    expect(j.registro).toContain('Total 6 contra 4: superas la Prueba.')
    expect([j.copia('capitan').heridas, j.copia('viejo_lobo').heridas, j.copia('bucanero').heridas]).toEqual([0, 0, 0])
  })

  it('Mar: si fallas, no puedes retirarte de esta misión', () => {
    const j = en('mar', ['p2_fiebre', 'chubasco', 'calma', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.mision?.sinRetirada).toBe(true)
    expect(j.decision.tipo).toBe('ventanaAccion')
    expect((j.decision as { acciones: { tipo: string }[] }).acciones.some((a) => a.tipo === 'retirarse')).toBe(false)
  })

  it('Naturaleza: EXP 4, o 2 si tienes un Cirujano; si superas, curas 2 heridas', () => {
    const sin = en('nat', ['p2_fiebre', 'chubasco', 'calma'], { tripulacion: ['baqueano'] })
    sin.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(sin.estado)).toBe(4)
    const j = en('nat', ['p2_fiebre', 'chubasco', 'calma'], { capitan: { heridas: 2 }, tripulacion: ['matasanos', 'baqueano'] })
    j.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.pasarOfertas().seguir()
    while (j.decision.tipo === 'repartir') j.repartir({ capitan: 2 })
    expect(j.copia('capitan').heridas).toBe(0)
  })

  it('Naturaleza: si fallas, cada Tripulante asignado queda Envenenado (fase 10b)', () => {
    const j = en('nat', ['p2_fiebre', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'marinero_p'] })
    j.comprometer('EXP', ['bucanero', 'marinero_p']).seguir()
    expect(j.estados('bucanero')).toEqual(['envenenado'])
    expect(j.estados('marinero_p')).toEqual(['envenenado'])
    expect(j.estados('capitan')).toEqual([])
  })

  it('Ciudad: EXP 3, +1 por cada Tripulante herido (máx. 5); si superas, +1 Avance', () => {
    const j = en('ciu', ['p2_fiebre', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: [{ id: 'baqueano' }, { id: 'bucanero', heridas: 1 }] })
    j.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(5) // 3 + 2 heridos (Diego y el Bucanero)
    const k = en('ciu', ['p2_fiebre', 'chubasco', 'calma'], {
      capitan: { heridas: 1 },
      tripulacion: [{ id: 'baqueano' }, { id: 'herbolaria' }, { id: 'bucanero', heridas: 1 }, { id: 'viejo_lobo', heridas: 1 }],
    })
    k.comprometer('EXP', ['capitan', 'baqueano', 'herbolaria'])
    expect(dificultadConDestino(k.estado)).toBe(5) // 3 heridos, pero como mucho 5
    expect(totalSinDestinoPrueba(k.estado)).toBeGreaterThanOrEqual(5)
    const antes = avance(k, 'ciu')
    k.pasarOfertas().seguir().pasarOfertas()
    expect(avance(k, 'ciu')).toBe(antes + 1 + 1) // fase 11: EXP 3, Avance 1 / 1, y +1 por superarla
  })

  it('Ciudad: si fallas, el comprometido con más EXP queda rehén en el lazareto; si lo rescatas, vuelve sin heridas', () => {
    const j = en('ciu', ['p2_fiebre', 'chubasco', 'calma', 'calma', 'calma'], {
      tripulacion: [{ id: 'bucanero', heridas: 1 }, 'marinero_p'],
    })
    // EXP 3 + 1 (el Bucanero está herido); el Bucanero y el Rufián no llegan. Empatan a EXP: eliges al Bucanero.
    j.comprometer('EXP', ['bucanero', 'marinero_p']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'queda rehén' } })
    j.elegir('bucanero')
    expect(j.zona('rehenes')).toEqual(['bucanero'])
    // Superas la misión con los «Calma»: lo rescatas y vuelve sin su herida.
    while (j.estado.mision && j.decision.tipo === 'ventanaAccion') j.seguir()
    expect(j.registro).toContain('Rescatas a Bucanero veterano.')
    expect(j.registro).toContain('Bucanero veterano vuelve del lazareto sin heridas.')
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Destino «Vómito negro»: −1 e inflige 1 herida a un asignado (fase 13, I1: antes, solo al fallar y a los ya heridos); sin nadie asignado, solo su Sin oposición: el Capitán queda Envenenado (P83)', () => {
    const j = en('mar', ['chubasco', 'p2_fiebre', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // Chubasco repentino, NAV 2, +1
    expect(j.copia('capitan').heridas).toBe(1) // el único asignado, aunque supere la Prueba
    // Con dos asignados, eliges a cuál de ellos: el Capitán, que no está asignado, no puede recibirla.
    const k = en('mar', ['chubasco', 'p2_fiebre', 'calma'], { tripulacion: ['bucanero', 'viejo_lobo'] })
    k.comprometer('NAV', ['bucanero', 'viejo_lobo']).pasarOfertas()
    expect(k.decision).toMatchObject({ tipo: 'repartir', cantidad: 1 })
    expect(() => k.repartir({ capitan: 1 })).toThrow(/No se puede repartir/)
    k.repartir({ viejo_lobo: 1 })
    expect([k.copia('capitan').heridas, k.copia('bucanero').heridas, k.copia('viejo_lobo').heridas]).toEqual([0, 0, 1])
    // P83: sin nadie asignado, no hay herida; solo el Sin oposición (el Capitán queda Envenenado).
    const m = en('mar', ['chubasco', 'p2_fiebre', 'calma'], { tripulacion: ['viejo_lobo'] })
    m.comprometer('NAV', [])
    expect(m.registro).toContain('No hay nadie asignado: lo que el Destino le hace a un Tripulante asignado no se aplica.')
    expect(m.copia('viejo_lobo').heridas).toBe(0)
    expect(m.copia('capitan').heridas).toBe(0)
    expect(m.estados('capitan')).toEqual(['envenenado'])
  })
})

describe('18 · Tiburones', () => {
  it('Mar: si nadie está herido, ganas el Avance sin Prueba; si lo están, COM 3 +1 por herido y el que más heridas tiene sufre 2', () => {
    const j = en('mar', ['p2_tiburones', 'calma'])
    expect(j.registro).toContain('Ganas el Avance sin Prueba.')
    const k = en('mar', ['p2_tiburones', 'chubasco', 'calma'], { capitan: { heridas: 1 }, tripulacion: ['viejo_lobo'] })
    k.comprometer('COM', [])
    expect(dificultadConDestino(k.estado)).toBe(4)
    k.seguir()
    expect(k.copia('capitan').heridas).toBe(3)
  })

  it('Naturaleza: los heridos no pueden comprometerse', () => {
    const j = en('nat', ['p2_tiburones', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', heridas: 1 }] })
    expect(() => j.comprometer('NAV', ['viejo_lobo'])).toThrow(/no se puede comprometer/)
  })

  it('Naturaleza: si fallas, 1 herida por cada asignado, libres (fase 13, P79): las repartes entre todos tus Tripulantes', () => {
    const j = en('nat', ['p2_tiburones', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'carpintero', 'viejo_lobo'] })
    j.comprometer('NAV', ['bucanero', 'carpintero']).seguir() // 2 + 1 contra NAV 4
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    j.repartir({ capitan: 1, viejo_lobo: 1 })
    expect([j.copia('capitan').heridas, j.copia('viejo_lobo').heridas]).toEqual([1, 1])
    expect([j.copia('bucanero').heridas, j.copia('carpintero').heridas]).toEqual([0, 0])
  })

  it('Ciudad: al revelarse, Incautado 1 carta al azar por herido (mín. 1); si superas, las recuperas ya y robas 1', () => {
    const j = en('ciu', ['p2_tiburones', 'chubasco', 'calma'], { mano: ['ojo', 'timon', 'coraje'], tripulacion: ['isabela'] })
    expect(j.zona('incautadas')).toHaveLength(1)
    j.comprometer('COM', ['capitan', 'isabela']).pasarOfertas().seguir()
    expect(j.zona('incautadas')).toEqual([])
    expect(j.zona('mano')).toHaveLength(4)
  })

  it('Destino «Sangre en el agua»: −1 y nada más (fase 13, I1: el más herido ya no sufre 1 más); Sin oposición, el de menos Vida sufre 1', () => {
    const j = en('mar', ['p2_corriente', 'p2_tiburones', 'calma'], { capitan: { heridas: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    expect(j.copia('capitan').heridas).toBe(1)
    const k = en('mar', ['p2_corriente', 'p2_tiburones', 'calma'], { tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', [])
    expect(k.copia('viejo_lobo').heridas).toBe(1)
  })
})

describe('19 · Murciélagos vampiro', () => {
  it('Mar: si fallas, los comprometidos no se preparan en tu próximo Inicio', () => {
    const j = en('mar', ['p2_murcielagos', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('COM', ['vigia']).pasarOfertas().seguir()
    expect(j.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'noPrepara', hasta: 'inicio', inst: j.inst('vigia') }))
  })

  it('Naturaleza: +1 si alguien está Sangrando; si fallas, el comprometido con menos Vida queda Sangrando', () => {
    const j = en('nat', ['p2_murcielagos', 'chubasco', 'calma'], { tripulacion: [{ id: 'viejo_lobo', estados: ['sangrando'] }, 'vigia'] })
    j.comprometer('EXP', ['vigia']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(4)
    j.seguir()
    expect(j.estados('vigia')).toEqual(['sangrando'])
  })

  it('Ciudad: si fallas, el Capitán sufre 1 herida y descartas 1', () => {
    const j = en('ciu', ['p2_murcielagos', 'chubasco', 'calma'], { mano: ['ojo'] })
    j.comprometer('COM', []).seguir()
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.zona('mano')).toEqual([])
  })

  it('Destino «Alas en la noche»: −1 y ya no Persigue (fase 13, I1): se descarta; Sin oposición, el agotado con menos Vida sufre 1', () => {
    const j = en('mar', ['p2_corriente', 'p2_murcielagos', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(j.zona('mazoPeligros')).toEqual(['calma'])
    expect(j.zona('descartesPeligros')).toContain('p2_murcielagos')
    const k = en('mar', ['p2_corriente', 'p2_murcielagos', 'calma'], { tripulacion: [{ id: 'viejo_lobo', agotada: true }] })
    k.comprometer('NAV', [])
    expect(k.copia('viejo_lobo').heridas).toBe(1)
  })
})

describe('20 · Arenas movedizas', () => {
  it('Mar: NAV 4, +1 por cada 2 Mejoras de barco; si fallas, 1 daño por cada punto que te falte (máx. 3)', () => {
    const j = en('mar', ['p2_arenas', 'chubasco', 'calma'], { barco: { mejoras: ['vela', 'hamacas'] } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    j.seguir() // 2 + 1 del Barco contra 5: faltan 2
    expect(j.estado.danoBarco).toBe(2)
  })

  it('Naturaleza: pone en juego la permanente 228 junto al preparado con más EXP, que queda atrapado; con 3 fichas sufre 2 heridas', () => {
    // Sin Explorador preparado (la misión daría 1 de Avance y se superaría en seguida). El Vigía (EXP 2) iba delante.
    const j = en('nat', ['p2_arenas', 'chubasco', 'calma', 'calma'], { tripulacion: ['viejo_lobo', 'vigia'] })
    expect(j.zona('permanentes')).toEqual(['pm_arenas'])
    expect(j.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'noCompromete', inst: j.inst('vigia') }))
    expect(j.copia('pm_arenas').fichas).toBe(0)
    // Con la tercera ficha, el Vigía (Vida 1) sale medio ahogado: 2 heridas.
    j.copia('pm_arenas').fichas = 2
    j.seguir()
    expect(j.zona('tripulacion')).not.toContain('vigia')
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Naturaleza, Acción: agota tantos preparados como fichas más 1 para sacarlo; queda libre', () => {
    const j = en('nat', ['p2_arenas', 'calma', 'calma'], { tripulacion: ['viejo_lobo', 'vigia'] })
    j.usar('pm_arenas.accion0').elegir('viejo_lobo')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.estado.temporales.some((t) => t.inst === j.inst('vigia') && t.clave === 'noCompromete')).toBe(false)
  })

  it('Ciudad: si superas, añades gratis una Mejora del muelle; si fallas, pierdes 1 Mejora de un comprometido', () => {
    const j = en('ciu', ['p2_arenas', 'chubasco', 'calma'], { tripulacion: ['marinero_p'], muelle: ['sable', 'casco'] })
    j.comprometer('NAV', ['capitan']).pasarOfertas().seguir().elegir('casco')
    expect(j.zona('mejoras')).toContain('casco')
    const k = en('ciu', ['p2_arenas', 'chubasco', 'calma'], { capitan: { mejoras: ['sable'] }, barco: { mejoras: ['vela'] } })
    k.comprometer('NAV', []).seguir()
    expect(k.zona('mejoras')).toEqual(['sable', 'vela']) // sin comprometidos, nadie pierde nada
  })

  it('Destino «Cuanto más peso»: −1, sin más por cada asignado (fase 13, I1); Sin oposición, agotas a 1 Tripulante', () => {
    const j = en('mar', ['p2_corriente', 'p2_arenas', 'calma'], { tripulacion: ['viejo_lobo', 'bucanero', 'vigia'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo', 'bucanero', 'vigia']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('mar', ['p2_corriente', 'p2_arenas', 'calma'], { tripulacion: ['viejo_lobo'] })
    k.comprometer('NAV', []).elegir('viejo_lobo')
    expect(k.copia('viejo_lobo').agotada).toBe(true)
    expect(k.copia('capitan').agotada).toBe(false)
  })
})

describe('21 · El jaguar', () => {
  it('Mar: Sin ayuda; si fallas, tu Tripulante sufre 2 heridas y queda Asustado', () => {
    const j = en('mar', ['p2_jaguar', 'chubasco', 'calma'])
    expect(j.decision).toMatchObject({ tipo: 'comprometer', sinAyuda: true })
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.estados('capitan')).toEqual(['asustado'])
  })

  it('Naturaleza: pone en juego la permanente 229; al final de cada encuentro siguiente, el agotado con menos Vida sufre 1 herida', () => {
    const j = en('nat', ['p2_jaguar', 'calma', 'calma'], { tripulacion: [{ id: 'viejo_lobo', agotada: true }] })
    expect(j.zona('permanentes')).toEqual(['pm_ojos'])
    j.seguir()
    expect(j.copia('viejo_lobo').heridas).toBe(1)
  })

  it('Naturaleza, Acción: agota a un preparado para cazarlo, solo con él (COM 5); si superas, robas 2 y se descarta', () => {
    const j = en('nat', ['p2_jaguar', 'racha', 'calma'], { tripulacion: ['isabela'], capitan: { mejoras: ['sable'] } })
    j.usar('pm_ojos.accion0').elegir('capitan')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', opciones: [{ hab: 'COM', dificultad: 5 }] })
    expect(() => j.comprometer('COM', ['isabela'])).toThrow(/no se puede comprometer/)
    // Diego COM 3 + Sable 1 contra 5 − 1 de «Viento a favor».
    j.comprometer('COM', ['capitan']).pasarOfertas().seguir()
    expect(j.zona('permanentes')).toEqual([])
  })

  it('Ciudad: +1 si tienes un Animal; si fallas, el de más COM sufre 2 y se descarta la carta de más a la izquierda del muelle', () => {
    const j = en('ciu', ['p2_jaguar', 'chubasco', 'calma'], { tripulacion: ['loro', { id: 'viejo_lobo', mejoras: ['coleto'] }], muelle: ['sable', 'casco'] })
    j.comprometer('COM', ['viejo_lobo']).pasarOfertas()
    expect(dificultadConDestino(j.estado)).toBe(6)
    j.seguir()
    expect(j.copia('viejo_lobo').heridas).toBe(2)
    expect(j.zona('muelle')).toEqual(['casco'])
  })

  it('Destino «Salto desde la rama»: −2 y nada más (fase 13, I1: el preparado no asignado con menos Vida ya no sufre 1); Sin oposición, el de menos Vida sufre 2', () => {
    const j = en('mar', ['p2_corriente', 'p2_jaguar', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    expect(j.copia('viejo_lobo').heridas).toBe(0)
    // Sin nadie asignado, solo las 2 heridas de Sin oposición.
    const k = en('mar', ['p2_corriente', 'p2_jaguar', 'calma'])
    k.comprometer('NAV', [])
    expect(k.copia('capitan').heridas).toBe(2)
  })
})

describe('22 · El caimán', () => {
  it('Mar: al revelarse, el preparado con menos Vida cae al agua y no se compromete; si superas, se prepara y queda Aguerrido', () => {
    const j = en('mar', ['p2_caiman', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', 'bucanero', 'practico'] })
    expect(() => j.comprometer('NAV', ['practico'])).toThrow(/no se puede comprometer/)
    // Diego 2 + Viejo lobo 3 + Bucanero 1 + Barco 1 = 7 contra 6.
    j.comprometer('NAV', ['capitan', 'viejo_lobo', 'bucanero']).pasarOfertas().seguir()
    expect(j.estados('practico')).toEqual(['aguerrido'])
  })

  it('Mar: si fallas, el que cayó sufre 2 heridas y el Barco 1 daño', () => {
    // Empatan en Vida el Viejo lobo y Reinaldo: eliges quién cae.
    const j = en('mar', ['p2_caiman', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo', { id: 'reinaldo', mejoras: ['coleto'] }] })
    j.elegir('reinaldo').comprometer('NAV', ['capitan']).seguir()
    expect(j.copia('reinaldo').heridas).toBe(2)
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Naturaleza: las Mejoras no suman; si fallas con un Animal, el caimán se lo lleva al muelle', () => {
    const j = en('nat', ['p2_caiman', 'chubasco', 'calma'], { capitan: { mejoras: ['sable'] }, tripulacion: ['loro'] })
    j.comprometer('COM', ['capitan']).pasarOfertas()
    expect(totalSinDestinoPrueba(j.estado)).toBe(3)
    j.seguir()
    expect(j.zona('muelle')).toContain('loro')
  })

  it('Ciudad: si superas, +1 Avance (fase 13, I2: antes, la siguiente Prueba Guardia o Militar −2)', () => {
    const j = en('ciu', ['p2_caiman', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir() // Diego 2 + Viejo lobo 3 contra NAV 5
    expect(j.registro).toContain('El caimán: +1 de Avance (1/4).')
    expect(j.registro).toContain('Ganas 3 de Avance (4/4).') // con los 3 del encuentro, supera la misión
  })

  it('Ciudad: si fallas, el comprometido con más NAV elige entre 2 heridas o quedar rehén', () => {
    const j = en('ciu', ['p2_caiman', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion' })
    j.opcion('1')
    expect(j.zona('rehenes')).toEqual(['viejo_lobo'])
  })

  it('Destino «Giro de la muerte»: fallas, salvo que el comprometido con la habilidad más alta sufra 2 heridas: entonces +1', () => {
    const j = en('mar', ['p2_corriente', 'p2_caiman', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['coleto'] }] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'giroDeLaMuerte' } })
    j.opcion(j.inst('viejo_lobo'))
    expect(j.copia('viejo_lobo').heridas).toBe(2)
    expect(dificultadConDestino(j.estado)).toBe(3)
    const k = en('mar', ['p2_corriente', 'p2_caiman', 'calma'], { tripulacion: [{ id: 'viejo_lobo', mejoras: ['coleto'] }] })
    k.comprometer('NAV', [])
    expect(k.copia('viejo_lobo').heridas).toBe(2) // Sin oposición: el de menos Vida
  })
})
