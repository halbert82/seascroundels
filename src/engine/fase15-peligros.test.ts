// Fase 15 · las ocho cartas de Peligro nuevas (247–254), con las palabras clave Descomunal y Alerta, y la permanente
// «Mala fama» (136): al menos una prueba por carta, con sus encuentros y su Destino.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { CartaId, InstId } from './tipos.ts'

/** Misiones de prueba, sin reglas que estorben: Mar (5 de Avance), Naturaleza (4) y Ciudad (4), y las largas. */
const MISION = { mar: 'pruebas-mar5', nat: 'pruebas-nat4', ciu: 'pruebas-ciu4', nat9: 'pruebas-nat9', ciu9: 'pruebas-ciu9' } as const

function en(entorno: keyof typeof MISION, mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  return Jugador.enMision({ misiones: [MISION[entorno]], mazoPeligros, ...op })
}

const tripulantes = (j: Jugador) => (j.decision as { tripulantes: InstId[] }).tripulantes.map((c) => j.estado.cartas[c]?.id)
const heridas = (j: Jugador, id: CartaId) => j.copia(id).heridas
const ganas = (j: Jugador, n: number) => j.registro.some((r) => r.startsWith(`Ganas ${n} de Avance`))
/** Reparte las heridas de la decisión en curso a estos Tripulantes (en orden). */
function repartirA(j: Jugador, ...ids: CartaId[]): Jugador {
  const d = j.decision
  if (d.tipo !== 'repartir') return j
  const reparto: Record<CartaId, number> = {}
  let resto = d.cantidad
  for (const id of ids) {
    const n = Math.min(resto, 1)
    reparto[id] = (reparto[id] ?? 0) + n
    resto -= n
  }
  if (resto > 0 && ids[0]) reparto[ids[0]] = (reparto[ids[0]] ?? 0) + resto
  return j.repartir(reparto)
}

// ---------------------------------------------------------------------------
// Descomunal

describe('247 · Fuerza bruta (Descomunal 2)', () => {
  it('Mar «El cachalote» (NAV 5): asignar a uno solo no vale; con dos que lleguen, se supera y da 3', () => {
    const j = en('mar', ['p2_fuerza', 'calma', 'calma'], { tripulacion: ['bucanero', 'grumete'] })
    expect(j.decision.tipo).toBe('comprometer')
    expect(() => j.comprometer('NAV', ['bucanero'])).toThrow(/Descomunal 2/)
    // Bucanero veterano 1 y Grumete leal 1 (+1 cada uno por Diego, que sigue preparado) + Barco 1 = 5 contra 5; Destino
    // de «Mar en calma»: 0.
    j.comprometer('NAV', ['bucanero', 'grumete']).seguir()
    expect(j.registro).toContain('Total 5 contra 5: superas la Prueba.')
    // El Destino «Remanso» prepara a uno de los asignados.
    j.elegir('bucanero')
    expect(ganas(j, 3)).toBe(true)
  })

  it('Naturaleza «El árbol caído» (COM 4): sin nadie asignado se falla; Inflige 2 heridas (libres)', () => {
    const j = en('nat9', ['p2_fuerza', 'calma', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('COM', []).seguir()
    expect(j.registro.some((r) => r.includes('fallas la Prueba (nadie asignado)'))).toBe(true)
    repartirA(j, 'capitan', 'bucanero')
    expect(heridas(j, 'capitan') + heridas(j, 'bucanero')).toBe(2)
  })

  it('Ciudad «Una carreta en el barro»: con un solo Tripulante preparado no se puede llegar a 2; se falla y descartas 1', () => {
    const j = en('ciu9', ['p2_fuerza', 'calma', 'calma'], { mano: ['ojo', 'timon'] })
    expect(tripulantes(j)).toEqual(['capitan'])
    expect(() => j.comprometer('COM', ['capitan'])).toThrow(/Descomunal 2/)
    j.comprometer('COM', []).seguir()
    expect(j.decision.motivo.clave).toBe('descartar')
  })

  it('aunque el Loro se una después del Destino, uno solo no basta: la Prueba se falla', () => {
    const j = en('ciu9', ['p2_fuerza', 'oportunidad', 'calma'], { tripulacion: ['loro'] })
    j.comprometer('COM', [])
    if (j.ofreceCapacidad('loro.unirse')) j.usar('loro.unirse')
    j.pasarOfertas().seguir()
    expect(j.registro.some((r) => r.includes('fallas la Prueba'))).toBe(true)
  })

  it('Destino «Espaldas molidas» (−1): sin nadie asignado, agota a 1 Tripulante', () => {
    // «Mar en calma» no tiene Prueba; «Niebla espesa» (NAV 3) sí: su Destino sale de «Fuerza bruta».
    const j = en('mar', ['niebla', 'p2_fuerza', 'calma'], { tripulacion: ['bucanero'] })
    j.comprometer('NAV', []).pasarOfertas()
    expect(j.registro.some((r) => r.includes('Destino de la carta «Fuerza bruta»: −1'))).toBe(true)
    if (j.decision.tipo === 'elegirCartas') j.elegir('bucanero')
    expect(j.copia('bucanero').agotada || j.copia('capitan').agotada).toBe(true)
  })
})

describe('248 · Arrimar el hombro (Descomunal 2)', () => {
  it('Mar «El ancla enganchada» (NAV 3): si fallas, agota a 1 Tripulante', () => {
    const j = en('mar', ['p2_hombro', 'calma', 'calma'], { tripulacion: ['bucanero', 'grumete'] })
    j.comprometer('NAV', []).seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas' })
    j.elegir('grumete')
    expect(j.copia('grumete').agotada).toBe(true)
  })

  it('Naturaleza «Arrastrar la chalupa» (COM 3): si fallas, −1 de Avance (y el encuentro da su 1)', () => {
    const j = en('nat9', ['p2_hombro', 'calma', 'calma'], { misiones: ['pruebas-nat9'], avance: { 'pruebas-nat9': 2 } })
    j.comprometer('COM', []).seguir()
    expect(j.registro.some((r) => r.startsWith('Pierdes 1 de Avance'))).toBe(true)
  })

  it('Ciudad «Descargar de noche» (NAV 3): si la superas, robas 2; si la fallas, descartas 2 al azar', () => {
    const bien = en('ciu9', ['p2_hombro', 'calma', 'calma'], { tripulacion: ['viejo_lobo'] })
    // Diego 2 + Viejo lobo 3 (+1) = 6 contra 3.
    bien.comprometer('NAV', ['capitan', 'viejo_lobo']).pasarOfertas().seguir()
    expect(bien.registro.some((r) => r.startsWith('Robas 2'))).toBe(true)
    const mal = en('ciu9', ['p2_hombro', 'calma', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    mal.comprometer('NAV', []).seguir()
    expect(mal.zona('mano')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Alerta

describe('249 · La ronda de noche (Alerta)', () => {
  it('Mar «El bergantín de ronda»: las Velas de tormenta no se ofrecen; si fallas, el Barco queda Perseguido', () => {
    const j = en('mar', ['p2_ronda', 'calma', 'calma'], { barco: { mejoras: ['velas_tormenta'] } })
    expect(j.ofreceCapacidad('velas_tormenta.esquivar')).toBe(false)
    j.pasarOfertas().comprometer('NAV', []).seguir()
    expect(j.estadosBarco).toContain('perseguido')
  })

  it('con una carta sin Alerta, las Velas de tormenta sí se ofrecen (comparación)', () => {
    const j = en('mar', ['niebla', 'calma', 'calma'], { barco: { mejoras: ['velas_tormenta'] } })
    expect(j.ofreceCapacidad('velas_tormenta.esquivar')).toBe(true)
  })

  it('Naturaleza «El centinela de la loma»: si fallas, el asignado con más EXP queda Buscado', () => {
    const j = en('nat9', ['p2_ronda', 'calma', 'calma'], { tripulacion: ['vigia'] })
    j.comprometer('EXP', ['vigia']).seguir()
    expect(j.estados('vigia')).toContain('buscado')
  })

  it('Ciudad «Los vigías del fuerte»: ni «Sangre fría» ni «Soborno» se ofrecen; si fallas, 2 heridas', () => {
    const j = en('ciu9', ['p2_ronda', 'calma', 'calma'], { mano: ['sangre_fria', 'soborno', 'ojo', 'timon', 'coraje'] })
    expect(j.ofreceCapacidad('sangre_fria.jugar')).toBe(false)
    expect(j.ofreceCapacidad('soborno.jugar')).toBe(false)
    j.pasarOfertas().comprometer('EXP', []).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
  })
})

describe('250 · Sin escapatoria (Alerta)', () => {
  it('Mar «La resaca»: ni «Cambio de rumbo» ni Íñigo «Lince» Quintero se ofrecen; si fallas, Daña 1', () => {
    const j = en('mar', ['p2_escapatoria', 'calma', 'calma'], { tripulacion: ['bartolome'], mano: ['cambio_rumbo', 'ojo'] })
    expect(j.ofreceCapacidad('cambio_rumbo.jugar')).toBe(false)
    expect(j.ofreceCapacidad('bartolome.descartar')).toBe(false)
    j.pasarOfertas().comprometer('NAV', []).seguir()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Naturaleza «Los perros cimarrones» (COM 4): si fallas, 2 heridas', () => {
    const j = en('nat9', ['p2_escapatoria', 'calma', 'calma'])
    j.comprometer('COM', []).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
  })

  it('Ciudad «La cuenta del tabernero» (EXP 2): si fallas, descartas 2 («Retirada a tiempo» ya no está en la caja)', () => {
    const j = en('ciu9', ['p2_escapatoria', 'fauna', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    j.comprometer('EXP', [])
    j.pasarOfertas().seguir()
    expect(j.decision.motivo.clave).toBe('descartar')
  })

  it('si reúnes el Avance a mitad de un encuentro con Alerta, se resuelve igual antes de superar la misión', () => {
    // Mar 5: «¡A toda vela!» da 1 al revelar «La resaca» y se llega al Avance de la misión.
    const j = Jugador.en({
      empezarEn: 'quedarseOZarpar',
      escenario: ['pruebas-calma'],
      misiones: ['pruebas-mar5'],
      avance: { 'pruebas-mar5': 2 },
      mazoPeligros: ['calma', 'p2_escapatoria', 'calma', 'calma'],
      mano: ['viento', 'ojo'],
      mazoCapitan: ['coraje'],
    })
    // «Mar en calma» da 2 (4 de 5); al revelar «La resaca», «¡A toda vela!» da 1 más: 5 de 5.
    j.zarpar('pruebas-mar5').pasarOfertas().seguir()
    j.usar('viento.jugar').elegir('ojo').pasarOfertas()
    // La misión no se supera todavía: hay que resolver «La resaca».
    expect(j.decision.tipo).toBe('comprometer')
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.registro.some((r) => r.startsWith('¡Superas'))).toBe(true)
    expect(j.registro).not.toContain('Reúnes el Avance a mitad del encuentro: lo dejas sin resolver.')
  })

  it('Destino «Acorralados» (−2): sin nadie asignado, inflige 1 herida', () => {
    const j = en('mar', ['niebla', 'p2_escapatoria', 'calma'])
    j.comprometer('NAV', []).pasarOfertas().seguir()
    expect(j.copia('capitan').heridas).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Un respiro

describe('251 · Un respiro (Elige: descansar o seguir)', () => {
  it('Mar: descansar cuesta 2 de Avance, prepara a todos y cura 1 herida a cada uno', () => {
    const j = en('mar', ['p2_respiro', 'calma', 'calma'], {
      misiones: ['pruebas-mar5'],
      avance: { 'pruebas-mar5': 3 },
      capitan: { agotada: true, heridas: 2 },
      tripulacion: [{ id: 'bucanero', agotada: true, heridas: 1 }],
    })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elegirEfectos', carta: 'p2_respiro' } })
    j.opcion('0')
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.registro.some((r) => r.startsWith('Pierdes 2 de Avance'))).toBe(true)
  })

  it('sin 2 de Avance en la misión no se puede descansar: solo queda seguir (+1 de Avance, sin preguntar)', () => {
    const j = en('mar', ['p2_respiro', 'calma', 'calma'])
    expect(j.decision.tipo).not.toBe('elegirOpcion')
    expect(j.registro.some((r) => r.includes('+1 de Avance'))).toBe(true)
  })

  it('Naturaleza: descansar prepara a todos; Ciudad: quita todos los Estados (no las Ventajas)', () => {
    const nat = en('nat9', ['p2_respiro', 'calma'], { misiones: ['pruebas-nat9'], avance: { 'pruebas-nat9': 2 }, capitan: { agotada: true } })
    nat.opcion('0')
    expect(nat.copia('capitan').agotada).toBe(false)
    const ciu = en('ciu9', ['p2_respiro', 'calma'], {
      misiones: ['pruebas-ciu9'],
      avance: { 'pruebas-ciu9': 2 },
      capitan: { estados: ['buscado', 'envenenado', 'inspirado'] },
    })
    ciu.opcion('0')
    expect(ciu.estados('capitan')).toEqual(['inspirado'])
  })

  it('Destino «Agua fresca» (+1): sin nadie asignado, el encuentro da 1 de Avance menos', () => {
    const j = en('mar', ['niebla', 'p2_respiro', 'calma'])
    j.comprometer('NAV', []).pasarOfertas().seguir()
    // «Niebla espesa» da 1 si no la superas (2 / 1): con −1, 0.
    expect(ganas(j, 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Provisiones perdidas

describe('252 · Provisiones perdidas', () => {
  it('Mar «El remolino» (NAV 4): si fallas, descartas las 2 cartas superiores de tu mazo del capitán', () => {
    const j = en('mar', ['p2_provisiones', 'calma', 'calma'], { mazoCapitan: ['ojo', 'timon', 'coraje'] })
    j.comprometer('NAV', []).seguir()
    expect(j.zona('descartesCapitan')).toEqual(expect.arrayContaining(['ojo', 'timon']))
    expect(j.zona('mazoCapitan')).toEqual(['coraje'])
  })

  it('Naturaleza «El barranco»: la carta superior; con el mazo vacío, no pasa nada (no se baraja, P40)', () => {
    const j = en('nat9', ['p2_provisiones', 'calma'], { mazoCapitan: [], descartesCapitan: ['ojo'] })
    j.comprometer('EXP', []).seguir()
    expect(j.zona('descartesCapitan')).toEqual(['ojo'])
    expect(j.registro).toContain('Tu mazo del capitán está vacío: no descartas nada.')
  })

  it('Ciudad «Ratas en el almacén»: las 2 superiores. Destino «Galleta con gusanos»: sin nadie, la superior', () => {
    const j = en('ciu9', ['p2_provisiones', 'calma'], { mazoCapitan: ['ojo', 'timon', 'coraje'] })
    j.comprometer('EXP', []).seguir()
    expect(j.zona('mazoCapitan')).toEqual(['coraje'])
    const d = en('mar', ['niebla', 'p2_provisiones', 'calma'], { mazoCapitan: ['ojo', 'timon'] })
    d.comprometer('NAV', []).pasarOfertas()
    expect(d.zona('descartesCapitan')).toContain('ojo')
  })
})

// ---------------------------------------------------------------------------
// Malas lenguas y «Mala fama»

describe('253 · Malas lenguas y la permanente 136 «Mala fama»', () => {
  it('Mar «Una presa que escapa» (COM 2): si fallas, pon en juego «Mala fama»; si ya está, descartas 1 carta', () => {
    const j = en('mar', ['p2_lenguas', 'calma', 'calma'], { mano: ['ojo'] })
    j.comprometer('COM', []).seguir()
    expect(j.zona('permanentes')).toEqual(['pm_malafama'])
    const otra = en('mar', ['p2_lenguas', 'calma', 'calma'], { mano: ['ojo', 'timon'], permanentes: ['pm_malafama'] })
    otra.comprometer('COM', []).seguir()
    expect(otra.registro).toContain('«Mala fama» ya está en juego.')
    expect(otra.decision.motivo.clave).toBe('descartar')
  })

  it('«Mala fama»: los Tripulantes cuestan 1 carta más; se queda al terminar la misión y se quita descartando 2 cartas', () => {
    // En juego desde una misión anterior.
    const j = Jugador.en({ muelle: ['bucanero', 'vela'], mano: ['ojo', 'timon', 'coraje', 'emboscada'], permanentes: ['pm_malafama'] })
    const bucanero = j.inst('bucanero', ['muelle'])
    const vela = j.inst('vela', ['muelle'])
    expect(j.valor({ tipo: 'coste', carta: bucanero })).toBe(3)
    expect(j.valor({ tipo: 'coste', carta: vela })).toBe(1)
    j.usar('pm_malafama.quitar0').elegir('ojo', 'timon')
    expect(j.zona('mazoHistoria')).toContain('pm_malafama')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.valor({ tipo: 'coste', carta: bucanero })).toBe(2)
  })

  it('al terminar la misión, «Mala fama» no vuelve al mazo de historia (las demás permanentes, sí)', () => {
    const j = en('mar', ['p2_lenguas', 'calma', 'calma', 'calma'])
    j.comprometer('COM', []).seguir().retirarse().opcion('dejar')
    expect(j.zona('permanentes')).toEqual(['pm_malafama'])
  })

  it('Naturaleza «Los cimarrones no os fían»: si fallas, descartas 2; Ciudad «Tu nombre corre por las tabernas», como el Mar', () => {
    const nat = en('nat9', ['p2_lenguas', 'calma'], { mano: ['ojo', 'timon', 'coraje'] })
    nat.comprometer('EXP', []).seguir()
    expect(nat.decision).toMatchObject({ motivo: { clave: 'descartar', n: 2 } })
    const ciu = en('ciu9', ['p2_lenguas', 'calma'])
    ciu.comprometer('COM', []).seguir()
    expect(ciu.zona('permanentes')).toEqual(['pm_malafama'])
  })
})

// ---------------------------------------------------------------------------
// Mar de fondo

describe('254 · Mar de fondo (según por cuánto falles)', () => {
  it('Mar (NAV 3): fallar por 1 daña 1; por 2 o más, daña 2 y el Barco queda con Vía de agua', () => {
    // Diego 2 + Barco 1 = 3; con «Tiburones» (−1) de Destino, 2: falla por 1.
    const uno = en('mar', ['p2_fondo', 'fauna', 'calma'])
    uno.comprometer('NAV', ['capitan']).seguir()
    expect(uno.estado.danoBarco).toBe(1)
    expect(uno.estadosBarco).not.toContain('viaDeAgua')
    const dos = en('mar', ['p2_fondo', 'calma', 'calma'])
    dos.comprometer('NAV', []).seguir()
    expect(dos.estado.danoBarco).toBe(2)
    expect(dos.estadosBarco).toContain('viaDeAgua')
  })

  it('Naturaleza «La ladera suelta» (EXP 3): por 1, 1 herida; por 2 o más, 3 heridas', () => {
    // Diego EXP 1 + «Emboscada» (1 icono de EXP) = 2 contra 3: falla por 1.
    const uno = en('nat9', ['p2_fondo', 'calma'], { mano: ['emboscada'] })
    uno.comprometer('EXP', ['capitan'], ['emboscada']).seguir()
    expect(uno.copia('capitan').heridas).toBe(1)
    const tres = en('nat9', ['p2_fondo', 'calma'])
    tres.comprometer('EXP', []).seguir()
    expect(tres.copia('capitan').heridas).toBe(3)
  })

  it('Ciudad «Pleito en la Audiencia» (EXP 4): por 1, descartas 1; por 2 o más, −1 reputación', () => {
    const rep = en('ciu9', ['p2_fondo', 'calma'], { reputacion: 3 })
    rep.comprometer('EXP', []).seguir()
    expect(rep.estado.reputacion).toBe(2)
  })

  it('Destino «Mar de leva» (−1): sin nadie asignado, daña 1 en el Mar e inflige 1 herida en tierra', () => {
    const mar = en('mar', ['niebla', 'p2_fondo', 'calma'])
    mar.comprometer('NAV', []).pasarOfertas()
    expect(mar.estado.danoBarco).toBe(1)
    const tierra = en('nat9', ['fauna', 'p2_fondo', 'calma'])
    tierra.comprometer('EXP', []).pasarOfertas()
    expect(tierra.copia('capitan').heridas).toBeGreaterThanOrEqual(1)
  })
})
