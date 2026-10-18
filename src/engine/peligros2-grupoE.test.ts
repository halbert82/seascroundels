// Peligros 2.0 · Grupo E (Leyendas, sobrenatural y fortuna, cartas 45–55): al menos una prueba por carta, con sus
// encuentros y su Destino.

import { describe, expect, it } from 'vitest'
import { dificultadPrueba, totalPrueba } from './prueba.ts'
import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { CartaId, InstId } from './tipos.ts'

/** Misiones sin reglas que estorben: Mar (5 de Avance), Naturaleza (3), Ciudad (4). */
const MISION = { mar: 'maracaibo-II', nat: 'aguada-I', ciu: 'ladron-I' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const robas = (j: Jugador, n: number) => j.registro.some((r) => r.startsWith(`Robas ${n}`))
const tripulantes = (j: Jugador) => (j.decision as { tripulantes: InstId[] }).tripulantes.map((c) => j.estado.cartas[c]?.id)
const marcado = (j: Jugador, clave: string) => {
  const t = j.estado.temporales.find((x) => x.clave === clave)
  return t?.inst ? j.estado.cartas[t.inst]?.id : undefined
}

describe('45 · Buena estrella', () => {
  it('Mar: se queda en juego y cada Prueba de NAV superada da 1 Avance más', () => {
    // Navío a la deriva (NAV 3): Diego 2 + Barco 1.
    const j = en('mar', ['p2_estrella', 'oportunidad', 'chubasco', 'calma'])
    expect(j.zona('peligrosEnJuego')).toEqual(['p2_estrella'])
    j.seguir().comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    expect(j.registro.some((r) => r.startsWith('Ganas 3 de Avance'))).toBe(true)
  })

  it('Mar: Respuesta tras revelar el Destino de una Prueba de NAV: la descartas y la Prueba recibe −2', () => {
    const j = en('mar', ['p2_estrella', 'oportunidad', 'chubasco', 'calma'])
    j.seguir().comprometer('NAV', ['capitan'])
    expect(j.ofreceCapacidad('p2_estrella.mar.cap.racha')).toBe(true)
    j.usar('p2_estrella.mar.cap.racha')
    expect(dificultadPrueba(j.estado)).toBe(1)
    expect(j.zona('peligrosEnJuego')).toEqual([])
  })

  it('Mar: se descarta si fallas una Prueba', () => {
    const j = en('mar', ['p2_estrella', 'oportunidad', 'chubasco', 'calma'])
    j.seguir().comprometer('NAV', []).pasarOfertas().seguir()
    expect(j.zona('peligrosEnJuego')).toEqual([])
    expect(j.zona('descartesPeligros')).toContain('p2_estrella')
  })

  it('Mar: se descarta si se revela un encuentro #Tormenta#', () => {
    const j = en('mar', ['p2_estrella', 'p2_calma', 'calma'])
    j.seguir()
    expect(j.zona('encuentro')).toEqual(['p2_calma'])
    expect(j.zona('peligrosEnJuego')).toEqual([])
  })

  it('Naturaleza: quita Envenenado de todos y después cura 1 a cada uno (P45: el Bucanero acaba sin ficha y sin herida)', () => {
    const j = en('nat', ['p2_estrella', 'calma'], {
      capitan: { heridas: 1 },
      tripulacion: [
        { id: 'bucanero', heridas: 1, estados: ['envenenado'] },
        { id: 'vigia', estados: ['envenenado'] },
      ],
    })
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.estados('vigia')).toEqual([])
    expect(j.estados('bucanero')).toEqual([])
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Ciudad: la lotería: descartas 1 y revelas la de arriba; si su Destino es −1 o −2, robas 3', () => {
    const j = en('ciu', ['p2_estrella', 'p2_corriente', 'calma'], { mano: ['ojo'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elegirEfectos' } })
    j.opcion('0')
    expect(robas(j, 3)).toBe(true)
    expect(j.zona('descartesPeligros')).toContain('p2_corriente')
    const k = en('ciu', ['p2_estrella', 'chubasco', 'calma'], { mano: ['ojo'] })
    k.opcion('0')
    expect(robas(k, 3)).toBe(false)
    expect(k.zona('mano')).toEqual([])
    expect(k.zona('descartesPeligros')).toContain('chubasco')
  })

  it('Destino «Estrella fugaz»: −2, pero la siguiente Prueba +1 (+2 sin oposición)', () => {
    const j = en('mar', ['oportunidad', 'p2_estrella', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(1)
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: 1 }])
    const k = en('mar', ['oportunidad', 'p2_estrella', 'calma'])
    k.comprometer('NAV', [])
    expect(k.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: 2 }])
  })
})

describe('46 · Restos del naufragio', () => {
  it('Mar: si superas, robas 1 por cada comprometido', () => {
    const j = en('mar', ['p2_restos', 'chubasco', 'calma'], { tripulacion: ['baqueano', 'vigia'] })
    j.comprometer('EXP', ['baqueano', 'vigia']).pasarOfertas().seguir()
    expect(robas(j, 2)).toBe(true)
  })

  it('Mar: si fallas, cada comprometido después del primero sufre 1 herida (eliges quién se libra)', () => {
    const j = en('mar', ['p2_restos', 'leyenda', 'calma'], { tripulacion: ['bucanero', 'filibustero'] })
    j.comprometer('EXP', ['capitan', 'bucanero', 'filibustero']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' }, min: 2, max: 2 })
    j.elegir('bucanero', 'filibustero')
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('filibustero').heridas).toBe(1)
    expect(j.copia('capitan').heridas).toBe(0)
  })

  it('Naturaleza: el barril de ron prepara a los agotados, que quedan Borrachos; o el de pólvora da 2 munición', () => {
    const j = en('nat', ['p2_restos', 'calma'], { tripulacion: [{ id: 'bucanero', agotada: true }, 'vigia'] })
    j.opcion('0')
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.estados('bucanero')).toEqual(['borracho'])
    expect(j.estados('vigia')).toEqual([])
    const k = en('nat', ['p2_restos', 'calma'], { barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    k.opcion('1')
    expect(k.copia('bronce').municion).toBe(2)
  })

  it('Ciudad: si superas, pones en juego una Mejora del muelle pagando 2 cartas menos', () => {
    const j = en('ciu', ['p2_restos', 'chubasco', 'calma'], { muelle: ['casco', 'bucanero'], mano: ['ojo'] })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'subasta' } })
    j.elegir('casco')
    expect(j.zona('mejoras')).toContain('casco')
    expect(j.zona('mano')).toEqual(['ojo'])
  })

  it('Ciudad: si fallas, se descarta del muelle la Mejora más cara y se repone', () => {
    const j = en('ciu', ['p2_restos', 'chubasco', 'calma'], { muelle: ['sable', 'casco', 'vela'], mazoMuelle: ['vigia'] })
    j.comprometer('NAV', []).seguir()
    expect(j.zona('muelle')).toEqual(['sable', 'vela', 'vigia'])
    expect(j.zona('descartesMuelle')).toContain('casco')
  })

  it('Destino «Madera del pecio»: si superas, reparas 1; sin oposición, 1 daño', () => {
    const j = en('mar', ['oportunidad', 'p2_restos', 'calma'], { barco: { dano: 1 } })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.estado.danoBarco).toBe(0)
    const k = en('mar', ['oportunidad', 'p2_restos', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estado.danoBarco).toBe(1)
  })

  it('Destino «Madera del pecio», sin oposición en Naturaleza o Ciudad: descartas 1 carta (no daña el Barco)', () => {
    const j = en('ciu', ['oportunidad', 'p2_restos', 'calma'], { mano: ['ojo', 'timon'] })
    j.comprometer('EXP', []).elegir('timon').seguir()
    expect(j.estado.danoBarco).toBe(0)
    expect(j.zona('mano')).toEqual(['ojo'])
  })
})

describe('47 · Presa fácil', () => {
  it('Mar: con la Bandera negra superas sin Prueba y eliges el botín', () => {
    const j = en('mar', ['p2_presa', 'chubasco', 'calma'], { barco: { mejoras: ['bandera'] } })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elegirEfectos' } })
    j.opcion('0')
    expect(robas(j, 2)).toBe(true)
    expect(j.zona('destino')).toEqual([])
  })

  it('Mar: si fallas, 1 daño', () => {
    const j = en('mar', ['p2_presa', 'chubasco', 'calma'])
    j.comprometer('COM', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Naturaleza: si superas, robas 3 y la siguiente Prueba de EXP recibe +1', () => {
    const j = en('nat', ['p2_presa', 'chubasco', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(robas(j, 3)).toBe(true)
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', hab: 'EXP', n: 1 }])
  })

  it('Ciudad: si te cuelas, recuperas 2 cartas del descarte y un Tripulante queda Buscado', () => {
    const j = en('ciu', ['p2_presa', 'calma'], { descartesCapitan: ['ojo', 'timon', 'coraje'] })
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(expect.arrayContaining(['ojo', 'timon']))
    expect(j.estados('capitan')).toEqual(['buscado'])
  })

  it('Destino «Bolsa sin dueño»: si superas, robas 1 (2 con un Contrabandista); sin oposición, descartas 1 al azar', () => {
    const j = en('mar', ['oportunidad', 'p2_presa', 'calma'], { tripulacion: ['contrabandista'] })
    j.comprometer('NAV', ['contrabandista']).pasarOfertas().seguir().pasarOfertas()
    expect(robas(j, 2)).toBe(true)
    const k = en('mar', ['oportunidad', 'p2_presa', 'calma'], { mano: ['ojo'] })
    k.comprometer('NAV', [])
    expect(k.zona('mano')).toEqual([])
  })
})

describe('48 · Fuego de San Telmo', () => {
  it('Mar: si superas, el comprometido con más NAV queda Inspirado; si fallas, la siguiente Prueba revela 2 Destinos', () => {
    const j = en('mar', ['p2_santelmo', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(j.estados('viejo_lobo')).toEqual(['inspirado'])
    const k = en('mar', ['p2_santelmo', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', dosDestinos: true }])
  })

  it('Naturaleza: un Vigía comprometido suma +2; si superas, buscas una Mejora para el muelle (P46)', () => {
    const j = en('nat', ['p2_santelmo', 'chubasco', 'calma'], { tripulacion: ['vigia'], mazoMuelle: ['bucanero', 'sable'] })
    j.comprometer('NAV', ['vigia'])
    expect(totalPrueba(j.estado)).toBe(3) // 0 + 1 de Diego + 2
    j.seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buscar' } })
    j.elegir('sable')
    expect(j.zona('muelle')).toContain('sable')
  })

  it('Ciudad: con un Marinero preparado superas sin Prueba y reclutas gratis un Marinero; si no hay, robas 2', () => {
    const j = en('ciu', ['p2_santelmo', 'chubasco', 'calma'], { tripulacion: ['marinero_p'], muelle: ['bucanero'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'gratisDelMuelle' } })
    j.elegir('bucanero')
    expect(j.zona('tripulacion')).toContain('bucanero')
    const k = en('ciu', ['p2_santelmo', 'chubasco', 'calma'], { tripulacion: ['marinero_p'] })
    expect(robas(k, 2)).toBe(true)
  })

  it('Destino «Fuego del santo»: −1 y no se pueden usar capacidades de Tripulantes; sin oposición, +1', () => {
    const j = en('mar', ['oportunidad', 'p2_santelmo', 'calma'], { tripulacion: ['carpintero'], barco: { dano: 1 } })
    j.comprometer('NAV', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(2)
    expect(j.ofreceCapacidad('carpintero.reparar')).toBe(false)
    const k = en('mar', ['oportunidad', 'p2_santelmo', 'calma'])
    k.comprometer('NAV', [])
    expect(dificultadPrueba(k.estado)).toBe(4)
  })
})

describe('49 · La sirena', () => {
  it('Mar: el preparado con menos EXP oye el canto; si lo atáis, se agotan él y otro, y ganas el Avance', () => {
    const j = en('mar', ['p2_sirena', 'calma'], { tripulacion: ['vigia'] })
    expect(marcado(j, 'p2_sirena.canto')).toBe('capitan')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige' } })
    j.opcion('0')
    expect(j.copia('capitan').agotada).toBe(true)
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.avance(MISION.mar)).toBe(2)
  })

  it('Mar: atarlo no se ofrece sin otro Tripulante preparado; si vas tras él y fallas, sufre 2 heridas y queda Asustado', () => {
    const solo = en('mar', ['p2_sirena', 'chubasco', 'calma'])
    // Solo una opción posible: se aplica sola (la Prueba).
    expect(solo.decision).toMatchObject({ tipo: 'comprometer' })
    const j = en('mar', ['p2_sirena', 'chubasco', 'calma'], { tripulacion: ['vigia'] })
    j.opcion('1').comprometer('NAV', ['vigia']).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.estados('capitan')).toEqual(['asustado'])
  })

  it('Naturaleza: el modificador del Destino se invierte', () => {
    // «Refuerzos» (+1) cuenta como −1: EXP 3 − 1.
    const j = en('nat', ['p2_sirena', 'fauna', 'calma'])
    j.comprometer('EXP', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(2)
  })

  it('Ciudad: las cartas de la mano no suman', () => {
    const j = en('ciu', ['p2_sirena', 'chubasco', 'calma'], { mano: ['abordaje'] })
    j.comprometer('COM', ['capitan'], ['abordaje'])
    expect(totalPrueba(j.estado)).toBe(3)
    j.seguir()
    expect(j.estados('capitan')).toEqual(['inspirado'])
  })

  it('Destino «Canto lejano»: el comprometido con la habilidad más baja no suma; sin oposición, el preparado con menos EXP sufre 1 herida', () => {
    const j = en('mar', ['oportunidad', 'p2_sirena', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas()
    expect(totalPrueba(j.estado)).toBe(4) // Diego (NAV 2) no suma: Viejo lobo 3 + Barco 1
    const k = en('mar', ['oportunidad', 'p2_sirena', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('NAV', [])
    expect(k.copia('capitan').heridas).toBe(1)
  })
})

describe('50 · Mal presagio', () => {
  it('Mar: el preparado con más COM no puede comprometerse; si fallas, −1 Mando en tu próximo turno', () => {
    const j = en('mar', ['p2_presagio', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    expect(tripulantes(j)).toEqual(['bucanero'])
    j.comprometer('NAV', []).seguir()
    expect(j.estado.temporales).toContainEqual(expect.objectContaining({ clave: 'menosMando', desdeTurno: j.estado.turno + 1 }))
  })

  it('Naturaleza: la lechuza señala a un Tripulante; con 3 fichas sufre 2 heridas y queda Maldito', () => {
    const j = Jugador.enMision({ misiones: ['panama-II'], mazoPeligros: ['p2_presagio', 'calma', 'racha', 'calma'], cubrir: ['capitan'] })
    expect(marcado(j, 'p2_presagio.lechuza')).toBe('capitan')
    expect(j.copia('p2_presagio').fichas).toBe(1)
    j.seguir()
    expect(j.copia('p2_presagio').fichas).toBe(2)
    j.seguir()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.estados('capitan')).toEqual(['maldito'])
    expect(j.zona('peligrosEnJuego')).toEqual([])
  })

  it('Naturaleza: agotando a un Vigía la espantas y el señalado queda Aguerrido', () => {
    const j = en('nat', ['p2_presagio', 'calma'], { tripulacion: ['vigia'] })
    const senalado = marcado(j, 'p2_presagio.lechuza') as CartaId
    j.usar('p2_presagio.nat.quitar0')
    expect(j.zona('peligrosEnJuego')).toEqual([])
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.estados(senalado)).toEqual(['aguerrido'])
  })

  it('Ciudad: el Destino se revela antes de comprometer (y no se revela otro); si fallas, el comprometido con más EXP queda Asustado', () => {
    const j = en('ciu', ['p2_presagio', 'chubasco', 'calma'])
    expect(j.decision).toMatchObject({ tipo: 'comprometer' })
    expect(j.zona('destino')).toEqual(['chubasco'])
    j.comprometer('EXP', ['capitan']).seguir()
    expect(j.estados('capitan')).toEqual(['asustado'])
    expect(j.registro.filter((r) => r.startsWith('Destino:')).length).toBe(1)
  })

  it('Destino «Mal agüero»: si fallas, la siguiente Prueba +1; sin oposición, agotas 1', () => {
    const j = en('mar', ['oportunidad', 'p2_presagio', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('NAV', [])
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'agotar' } })
    j.elegir('bucanero').seguir()
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.estado.mision?.modsSiguientes).toEqual([{ de: 'prueba', n: 1 }])
  })
})

describe('51 · La maldición del bokor', () => {
  it('Mar: cada comprometido herido suma 1 menos; si fallas, el comprometido con más COM sufre 1 herida y queda Maldito', () => {
    const j = en('mar', ['p2_bokor', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.comprometer('COM', ['bucanero'])
    expect(totalPrueba(j.estado)).toBe(2) // 2 + 1 de Diego − 1
    const k = en('mar', ['p2_bokor', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('COM', ['bucanero']).seguir()
    expect(k.copia('bucanero').heridas).toBe(1)
    expect(k.estados('bucanero')).toEqual(['maldito'])
  })

  it('Mar: si superas, esta carta Se retira', () => {
    const j = en('mar', ['p2_bokor', 'chubasco', 'calma'], { tripulacion: ['isabela'] })
    j.comprometer('COM', ['capitan', 'isabela']).pasarOfertas().seguir()
    expect(j.zona('descartesPeligros')).not.toContain('p2_bokor')
    expect(j.zonaDe('p2_bokor')).not.toBe('mazoPeligros')
  })

  it('Naturaleza: si fallas, agotas a 2 preparados, que no se preparan en tu próximo Inicio', () => {
    const j = en('nat', ['p2_bokor', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'vigia'] })
    j.comprometer('EXP', []).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 2, max: 2 })
    j.elegir('bucanero', 'vigia')
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.estado.temporales.filter((t) => t.clave === 'noPrepara' && t.hasta === 'inicio')).toHaveLength(2)
  })

  it('Ciudad: pagarle (3 cartas) quita Maldito a todos y uno queda Aguerrido; con el Amuleto, 2 cartas', () => {
    const j = en('ciu', ['p2_bokor', 'calma'], { mano: ['ojo', 'timon', 'coraje'], tripulacion: [{ id: 'bucanero', estados: ['maldito'] }] })
    const opciones = (j.decision as { opciones: { clave: string }[] }).opciones.map((o) => o.clave)
    expect(opciones).toEqual(['0', '2'])
    j.opcion('0').elegir('bucanero')
    expect(j.zona('mano')).toEqual([])
    expect(j.estados('bucanero')).toEqual(['aguerrido'])
    const k = en('ciu', ['p2_bokor', 'calma'], { mano: ['ojo', 'timon'], capitan: { mejoras: ['amuleto'] } })
    expect((k.decision as { opciones: { clave: string }[] }).opciones.map((o) => o.clave)).toEqual(['1', '2'])
  })

  it('Ciudad: si buscas tú el muñeco y fallas, el Capitán queda Maldito y descartas 1', () => {
    const j = en('ciu', ['p2_bokor', 'chubasco', 'calma'], { mano: ['ojo'] })
    j.comprometer('EXP', ['capitan']).seguir()
    expect(j.estados('capitan')).toEqual(['maldito'])
    expect(j.zona('mano')).toEqual([])
  })

  it('Destino «Alfiler en el muñeco»: si fallas, la herida va al Maldito comprometido; sin oposición, al Capitán', () => {
    const j = en('nat', ['oportunidad', 'p2_bokor', 'calma'], { tripulacion: ['marinero_p', { id: 'bucanero', estados: ['maldito'] }] })
    j.comprometer('EXP', ['bucanero', 'marinero_p']).seguir()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('marinero_p').heridas).toBe(0)
    const k = en('nat', ['oportunidad', 'p2_bokor', 'calma'])
    k.comprometer('EXP', [])
    expect(k.copia('capitan').heridas).toBe(1)
  })
})

describe('52 · El oro de los muertos', () => {
  it('Mar: si superas, robas 3 y no puedes retirarte; si fallas, 2 daños', () => {
    const j = en('mar', ['p2_oro', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(robas(j, 3)).toBe(true)
    expect(j.ofrece('retirarse')).toBe(false)
    const k = en('mar', ['p2_oro', 'chubasco', 'calma'])
    k.comprometer('NAV', []).seguir()
    expect(k.estado.danoBarco).toBe(2)
  })

  it('Naturaleza: incauta una Mejora de un Tripulante (o 2 cartas); si superas la misión, la recuperas y robas 2', () => {
    const j = en('nat', ['p2_oro', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', mejoras: ['sable'] }, 'baqueano'], mano: ['ojo', 'timon'] })
    j.opcion('0')
    expect(j.zona('incautadas')).toEqual(['sable'])
    // Baqueano (EXP 3 + 1 de Diego) supera: 1 (al zarpar, Explorador) + 2 + 1 = 4 de Avance: supera la misión.
    j.comprometer('EXP', ['baqueano']).pasarOfertas().seguir().pasarOfertas()
    expect(j.copia('sable').vinculadaA).toBe(j.inst('bucanero'))
    expect(robas(j, 2)).toBe(true)
  })

  it('Ciudad: +1 por cada Maldito; si fallas, descartas 2 y cada Maldito sufre 1 herida', () => {
    const j = en('ciu', ['p2_oro', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', estados: ['maldito'] }], mano: ['ojo', 'timon'] })
    j.comprometer('COM', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(4)
    j.seguir()
    expect(j.zona('mano')).toEqual([])
    expect(j.copia('bucanero').heridas).toBe(1)
  })

  it('Destino «Oro de los muertos»: −2, pero el comprometido con la habilidad más alta queda Maldito; sin oposición, el Capitán', () => {
    const j = en('mar', ['oportunidad', 'p2_oro', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(1)
    expect(j.estados('capitan')).toEqual(['maldito'])
    const k = en('mar', ['oportunidad', 'p2_oro', 'calma'])
    k.comprometer('NAV', [])
    expect(k.estados('capitan')).toEqual(['maldito'])
  })
})

describe('53 · La serpiente marina', () => {
  it('Mar: cada Artillero comprometido suma +1; si superas, +2 munición', () => {
    const j = en('mar', ['p2_serpiente_marina', 'chubasco', 'calma'], { tripulacion: ['canonero'], barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    j.comprometer('COM', ['capitan', 'canonero'])
    expect(totalPrueba(j.estado)).toBe(5) // Diego 3 + Cañonero 1 + 1
    j.seguir()
    expect(j.copia('bronce').municion).toBe(2)
  })

  it('Mar: si fallas, 2 daños y, si el Barco ya tenía 2 o más, Velas rotas', () => {
    const j = en('mar', ['p2_serpiente_marina', 'chubasco', 'calma'], { barco: { dano: 2 } })
    j.comprometer('COM', []).seguir()
    expect(j.estado.danoBarco).toBe(4)
    expect(j.estadosBarco).toEqual(['velasRotas'])
    const k = en('mar', ['p2_serpiente_marina', 'chubasco', 'calma'], { barco: { dano: 1 } })
    k.comprometer('COM', []).seguir()
    expect(k.estadosBarco).toEqual([])
  })

  it('Naturaleza: la boa se traga al preparado con menos Vida (no puede comprometerse); si fallas, sufre 2 heridas', () => {
    const j = en('nat', ['p2_serpiente_marina', 'chubasco', 'calma'], { tripulacion: ['vigia', 'isabela'] })
    expect(tripulantes(j)).toEqual(['capitan', 'isabela'])
    j.comprometer('COM', ['capitan', 'isabela']).pasarOfertas().seguir()
    expect(robas(j, 2)).toBe(true)
    expect(j.copia('vigia').heridas).toBe(0)
    const k = en('nat', ['p2_serpiente_marina', 'chubasco', 'calma'], { tripulacion: ['vigia', 'isabela'] })
    k.comprometer('COM', []).seguir().pasarOfertas()
    expect(k.zona('descartesMuelle')).toContain('vigia')
  })

  it('Naturaleza: con un Animal no se traga a nadie; si fallas, el comprometido con más COM sufre 2 heridas', () => {
    const j = en('nat', ['p2_serpiente_marina', 'chubasco', 'calma'], { tripulacion: ['loro', 'bucanero'] })
    expect(tripulantes(j)).toEqual(['capitan', 'loro', 'bucanero'])
    j.comprometer('COM', []).pasarOfertas().seguir()
    expect(j.copia('capitan').heridas).toBe(2)
  })

  it('Ciudad: si fallas, −1 reputación', () => {
    const j = en('ciu', ['p2_serpiente_marina', 'chubasco', 'calma'], { reputacion: 3 })
    j.comprometer('COM', []).seguir()
    expect(j.estado.reputacion).toBe(2)
  })

  it('Destino «Coletazo»: en una Prueba de COM, el comprometido con la habilidad más alta sufre 1 herida aunque superes', () => {
    const j = en('mar', ['civiles', 'p2_serpiente_marina', 'calma'], { tripulacion: ['isabela'] })
    j.comprometer('COM', ['capitan', 'isabela']).pasarOfertas()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } }) // empatan a COM 3
    j.elegir('capitan')
    expect(j.copia('capitan').heridas).toBe(1)
    const k = en('mar', ['oportunidad', 'p2_serpiente_marina', 'calma'])
    k.comprometer('NAV', ['capitan'])
    expect(k.copia('capitan').heridas).toBe(0)
    const sin = en('mar', ['oportunidad', 'p2_serpiente_marina', 'calma'], { tripulacion: ['vigia'] })
    sin.comprometer('NAV', [])
    expect(sin.zona('descartesMuelle')).toContain('vigia') // el preparado con menos Vida sufre 2 heridas
  })
})

describe('54 · La Santa Compaña', () => {
  it('Mar: si fallas, el Barco queda con Incendio a bordo', () => {
    const j = en('mar', ['p2_compana', 'chubasco', 'calma'])
    j.comprometer('NAV', []).seguir()
    expect(j.estadosBarco).toEqual(['incendio'])
  })

  it('Naturaleza: los Tripulantes con Escapulario suman +2; si fallas, el comprometido con menos EXP queda Asustado y sufre 1 herida', () => {
    const j = en('nat', ['p2_compana', 'chubasco', 'calma'], { tripulacion: [{ id: 'bucanero', mejoras: ['escapulario'] }] })
    j.comprometer('EXP', ['bucanero'])
    expect(totalPrueba(j.estado)).toBe(3) // 0 + 1 de Diego + 2
    j.pasarOfertas().seguir()
    expect(j.estados('bucanero')).toEqual(['asustado'])
    expect(j.copia('bucanero').heridas).toBe(1)
  })

  it('Ciudad: si superas, el comprometido con más NAV queda Aguerrido; si fallas, queda rehén', () => {
    const j = en('ciu', ['p2_compana', 'chubasco', 'calma'], { tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir()
    expect(j.estados('viejo_lobo')).toEqual(['aguerrido'])
    const k = en('ciu', ['p2_compana', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    k.comprometer('NAV', ['bucanero']).seguir()
    expect(k.zona('rehenes')).toEqual(['bucanero'])
  })

  it('Destino «La Compaña»: si fallas, un comprometido queda Asustado; sin oposición, el más herido sufre 1 herida y queda Asustado', () => {
    const j = en('nat', ['oportunidad', 'p2_compana', 'calma'], { tripulacion: ['bucanero', 'marinero_p'] })
    j.comprometer('EXP', ['bucanero', 'marinero_p']).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('marinero_p')
    expect(j.estados('marinero_p')).toEqual(['asustado'])
    const k = en('nat', ['oportunidad', 'p2_compana', 'calma'], { capitan: { heridas: 2 }, tripulacion: ['bucanero'] })
    k.comprometer('EXP', [])
    expect(k.copia('capitan').heridas).toBe(3)
    expect(k.estados('capitan')).toEqual(['asustado'])
  })
})

describe('55 · El Holandés errante', () => {
  it('Mar: −2 si un comprometido lleva un Escapulario; los Cañones no suman; si superas, +1 reputación y Se retira', () => {
    const j = en('mar', ['p2_holandes', 'chubasco', 'calma'], { tripulacion: [{ id: 'isabela', mejoras: ['escapulario'] }], reputacion: 2 })
    j.comprometer('COM', ['capitan', 'isabela'])
    expect(dificultadPrueba(j.estado)).toBe(4)
    expect(j.estado.prueba?.sinCanones).toBe(true)
    j.pasarOfertas().seguir()
    expect(j.estado.reputacion).toBe(3)
    expect(j.zona('descartesPeligros')).not.toContain('p2_holandes')
  })

  it('Mar: Abordaje: sin nadie comprometido, 3 heridas y un rehén', () => {
    const j = en('mar', ['p2_holandes', 'chubasco', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', []).seguir().elegir('capitan')
    expect(j.copia('capitan').heridas).toBe(3)
    expect(j.zona('rehenes')).toEqual(['bucanero'])
  })

  it('Naturaleza: cada preparado que no comprometas sufre 1 herida; si fallas, 3 heridas entre los comprometidos', () => {
    const j = en('nat', ['p2_holandes', 'chubasco', 'calma'], { tripulacion: ['bucanero', 'isabela'] })
    j.comprometer('COM', ['capitan'])
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('isabela').heridas).toBe(1)
    j.pasarOfertas().seguir()
    expect(j.copia('capitan').heridas).toBe(3)
  })

  it('Ciudad: si superas, miras las 5 de arriba; si fallas, Perseguido y descartas 2', () => {
    const j = en('ciu', ['p2_holandes', 'chubasco', 'calma', 'calma'], { tripulacion: ['baqueano', 'viejo_lobo'] })
    j.comprometer('EXP', ['baqueano', 'viejo_lobo']).pasarOfertas().seguir().pasarOfertas()
    expect(j.registro.some((r) => r.startsWith('Oteas:'))).toBe(true)
    const k = en('ciu', ['p2_holandes', 'chubasco', 'calma'], { mano: ['ojo', 'timon'] })
    k.comprometer('EXP', []).seguir()
    expect(k.estadosBarco).toEqual(['perseguido'])
    expect(k.zona('mano')).toEqual([])
  })

  it('Destino: en el Mar falla la Prueba; en tierra, +1; sin oposición, Perseguido', () => {
    const j = en('mar', ['oportunidad', 'p2_holandes', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(j.estado.prueba?.falla).toBe(true)
    const k = en('ciu', ['oportunidad', 'p2_holandes', 'calma'])
    k.comprometer('EXP', ['capitan'])
    expect(dificultadPrueba(k.estado)).toBe(4)
    const sin = en('ciu', ['oportunidad', 'p2_holandes', 'calma'])
    sin.comprometer('EXP', [])
    expect(sin.estadosBarco).toEqual(['perseguido'])
  })
})
