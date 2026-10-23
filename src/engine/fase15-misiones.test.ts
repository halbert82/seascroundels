// Fase 15 · las misiones nuevas: «La Isla del Tesoro» (capítulo II al azar), «La carrera de van Hoorn» y «El fugitivo»,
// y las misiones sueltas «El pecio del San José», «Escolta del San Telmo», «El asedio de Port Royal» y «La regata de San
// Juan», con sus permanentes, los barcos rivales y los Tesoros nuevos. Al menos una prueba por carta.
// Los Peligros de las pruebas son los antiguos (retirados del mazo), porque sus números son sencillos.

import { describe, expect, it } from 'vitest'

import { avanceInicialDelEscenario } from './tareas/mision.ts'
import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

const MAZO_CAPITAN = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'ojo', 'ojo', 'timon', 'timon']

/** En el paso de zarpar, con un mazo de Peligros concreto (arriba primero). */
function enPuerto(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN], ...op })
}

const fichas = (j: Jugador, f: 'rival' | 'profundidad' | 'derrumbe') => j.estado.mision?.fichas?.[f] ?? 0
const disponibles = (j: Jugador) => j.zona('misionesDisponibles')
const acciones = (j: Jugador) => (j.decision.tipo === 'ventanaAccion' ? j.decision.acciones.map((a) => a.tipo) : [])
const vida = (j: Jugador, id: CartaId, total: number) => total - j.copia(id).heridas
const ISLA_II = ['isla-II-ingleses', 'isla-II-temblor', 'isla-II-falso']

// ---------------------------------------------------------------------------
// La Isla del Tesoro

/** Juega «El mapa del ahorcado» hasta superarlo y devuelve el capítulo II que sale. */
function islaI(semilla: number): { j: Jugador; sale: CartaId } {
  const j = enPuerto({ semilla, misiones: ['isla-I'], tripulacion: ['viejo_lobo'], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['calma', 'calma', 'calma'] })
  // Distancia 2 − 1 del Barco: el Viejo lobo de mar la cubre.
  j.zarpar('isla-I').cubrir('viejo_lobo')
  // Al zarpar: puedes descartar 2 cartas para ganar 2 de Avance (compras el mapa a la viuda).
  expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'alZarparDescartar', carta: 'isla-I' } })
  j.opcion('si').elegir('ojo', 'timon')
  // 2 + «Hora de la siesta» (2) + «Hora de la siesta» (2) = 6 de 5.
  j.seguir()
  const sale = disponibles(j).find((id) => ISLA_II.includes(id))
  if (!sale) throw new Error(`No ha salido ningún capítulo II: ${disponibles(j).join(', ')}`)
  return { j, sale }
}

describe('255 · El mapa del ahorcado (La Isla del Tesoro I)', () => {
  it('al zarpar, puedes descartar 2 cartas para ganar 2; al superarla, 1 de reputación y uno de los tres capítulos II al azar', () => {
    const { j, sale } = islaI(1)
    expect(j.registro).toContain('El mapa del ahorcado: +2 de Avance (2/5).')
    expect(j.estado.reputacion).toBe(1)
    expect(j.registro).toContain('Barajas boca abajo las cartas 256, 257 y 258 del mazo de historia y pones una encima del mazo de Misiones sin mirarla.')
    // Los otros dos vuelven al mazo de historia (no salen de la partida).
    for (const otro of ISLA_II.filter((x) => x !== sale)) expect(j.zona('mazoHistoria'), otro).toContain(otro)
    expect(j.zona('fueraDeJuego').filter((id) => ISLA_II.includes(id))).toEqual([])
  })

  it('el capítulo II es al azar, pero con la misma semilla sale el mismo; en 30 partidas salen los tres', () => {
    expect(islaI(7).sale).toBe(islaI(7).sale)
    const vistos = new Set<CartaId>()
    for (let semilla = 1; semilla <= 30; semilla++) vistos.add(islaI(semilla).sale)
    expect([...vistos].sort()).toEqual([...ISLA_II].sort())
  })

  it('Rumores del tesoro: un capítulo II de la isla (sin letra) cuenta como capítulo II y da 2', () => {
    const j = enPuerto({ misiones: ['isla-II-ingleses', 'isla-I'], temporales: [{ clave: 'rumores.turno', fuente: 'rumores', hasta: 'finTurno' }] })
    expect(avanceInicialDelEscenario(j.estado, j.inst('isla-II-ingleses', ['misionesDisponibles']))).toEqual([{ n: 2, motivo: 'Rumores del tesoro' }])
    expect(avanceInicialDelEscenario(j.estado, j.inst('isla-I', ['misionesDisponibles']))).toEqual([{ n: 1, motivo: 'Rumores del tesoro' }])
  })
})

describe('256 · …tomada por los ingleses', () => {
  it('al zarpar, la carta 95 entra en el mazo de Peligros; los encuentros de tipo Armada reciben +1; final: 3 de reputación', () => {
    const j = enPuerto({ misiones: ['isla-II-ingleses'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('isla-II-ingleses')
    expect(j.registro).toContain('«La Armada te persigue» entra en el mazo de Peligros.')
    expect(j.valor({ tipo: 'dificultad', base: 4, hab: 'NAV', claves: ['Armada', 'Barco'] })).toBe(5)
    expect(j.valor({ tipo: 'dificultad', base: 4, hab: 'NAV', claves: ['Tormenta'] })).toBe(4)
  })
})

describe('257 · …sacudida por un temblor', () => {
  it('no puedes retirarte; cada Prueba que falles pone 1 ficha de Derrumbe; con 3, la misión falla', () => {
    // «Lluvia torrencial» (EXP 1): sin nadie asignado, se falla. Cada Prueba saca su Destino de la carta siguiente.
    const j = enPuerto({ misiones: ['isla-II-temblor'], tripulacion: ['viejo_lobo'], mazoPeligros: ['chubasco', 'calma', 'chubasco', 'calma', 'chubasco', 'calma', 'calma'] })
    j.zarpar('isla-II-temblor').cubrir('viejo_lobo')
    j.comprometer('EXP', []).seguir()
    expect(fichas(j, 'derrumbe')).toBe(1)
    expect(acciones(j)).not.toContain('retirarse')
    j.seguir().comprometer('EXP', []).seguir()
    j.seguir().comprometer('EXP', []).seguir()
    expect(j.registro).toContain('La misión falla: la cueva se viene abajo.')
    expect(j.decision.motivo.clave).toBe('conservarMision')
  })

  it('final con elección: cargar con todo el oro (3 y cada Tripulante sufre 1 herida) o salir a tiempo (2 y robas 2)', () => {
    const oro = enPuerto({ misiones: ['isla-II-temblor'], tripulacion: ['viejo_lobo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    oro.zarpar('isla-II-temblor').cubrir('viejo_lobo').seguir().seguir()
    expect(oro.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'finalMision', carta: 'isla-II-temblor' } })
    oro.opcion('oro')
    expect(oro.estado.reputacion).toBe(3)
    expect(oro.copia('capitan').heridas).toBe(1)
    expect(oro.copia('viejo_lobo').heridas).toBe(1)
    const salir = enPuerto({ misiones: ['isla-II-temblor'], tripulacion: ['viejo_lobo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    salir.zarpar('isla-II-temblor').cubrir('viejo_lobo').seguir().seguir().opcion('salir')
    expect(salir.estado.reputacion).toBe(2)
    expect(salir.registro.some((r) => r.startsWith('Robas 2'))).toBe(true)
  })
})

describe('258 · El mapa era falso', () => {
  it('cada Prueba de EXP superada da 1 de Avance adicional; al superarla, 1 de reputación, robas 2 y sale uno de los otros dos capítulos II', () => {
    const j = enPuerto({ semilla: 3, misiones: ['isla-II-falso'], tripulacion: ['viejo_lobo', 'vigia'], mazoPeligros: ['fauna', 'chubasco', 'calma', 'calma'] })
    j.zarpar('isla-II-falso').cubrir('viejo_lobo')
    // «Serpientes» (EXP 2): la Vigía inexperta (2, +1 por Diego) la supera: 2 del encuentro + 1 de la pista.
    j.comprometer('EXP', ['vigia']).seguir()
    expect(j.registro).toContain('Ganas 3 de Avance (3/4).')
    j.seguir()
    expect(j.estado.reputacion).toBe(1)
    expect(j.registro.some((r) => r.startsWith('Robas 2'))).toBe(true)
    expect(j.registro).toContain('Barajas boca abajo las cartas 256 y 257 del mazo de historia y pones una encima del mazo de Misiones sin mirarla.')
    expect(disponibles(j).some((id) => id === 'isla-II-ingleses' || id === 'isla-II-temblor')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// El pecio del San José

/** Llega al momento de bucear: «Mar en calma» dos veces (4 de 3). */
function pecio(op: OpcionesSituacion = {}): Jugador {
  const j = enPuerto({
    misiones: ['pecio-I'],
    tripulacion: ['vigia', 'guia_alquiler', 'baqueano', 'herbolaria'],
    mano: ['ojo'],
    mazoPeligros: ['calma', 'calma', 'chubasco', 'chubasco', 'chubasco', 'chubasco', 'chubasco'],
    ...op,
  })
  j.zarpar('pecio-I').seguir()
  return j
}

describe('268 · El pecio del San José (bucear) y la carta de consulta 269', () => {
  it('cuando va a superarse, puedes bucear: EXP 2 más tu Profundidad con un solo Tripulante; si la fallas, lo pierdes todo', () => {
    const j = pecio()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'bucear', carta: 'pecio-I', n: 2 } })
    j.opcion('bucear')
    expect(() => j.comprometer('EXP', ['vigia', 'baqueano'])).toThrow(/más de 1/)
    // Vigía inexperta (2, +1 por Diego) contra 2; Destino de «Chubasco repentino»: 0.
    j.comprometer('EXP', ['vigia']).seguir()
    expect(fichas(j, 'profundidad')).toBe(1)
    expect(j.decision).toMatchObject({ motivo: { clave: 'bucear', n: 3 } })
    // Diego (EXP 1) solo contra 3: falla, pierde la Profundidad y deja de bucear.
    j.opcion('bucear').comprometer('EXP', ['capitan']).seguir()
    expect(fichas(j, 'profundidad')).toBe(0)
    expect(j.registro).toContain('Miras la carta 269 («El fondo del San José»): sin Profundidad, no hay nada más.')
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('misionesSuperadas')).toEqual(['pecio-I'])
  })

  it('subir con Profundidad 3: 1 de reputación de la misión, robas 2, +1 de reputación y el Tesoro 270 (Cadena de oro)', () => {
    const j = pecio()
    j.opcion('bucear').comprometer('EXP', ['vigia']).seguir().pasarOfertas()
    j.opcion('bucear').comprometer('EXP', ['guia_alquiler']).seguir().pasarOfertas()
    j.opcion('bucear').comprometer('EXP', ['baqueano']).seguir().pasarOfertas()
    expect(fichas(j, 'profundidad')).toBe(3)
    j.opcion('subir')
    expect(j.estado.reputacion).toBe(2)
    expect(j.registro.some((r) => r.startsWith('Robas 2'))).toBe(true)
    expect(j.copia('cadena_oro').vinculadaA).toBe('barco')
    expect(j.zona('mazoHistoria')).toContain('custodia')
  })

  it('con Profundidad 4 ya no se bucea más: también el Tesoro 271, que al entrar en juego da 2 de reputación', () => {
    const j = pecio()
    j.opcion('bucear').comprometer('EXP', ['vigia']).seguir().pasarOfertas()
    j.opcion('bucear').comprometer('EXP', ['guia_alquiler']).seguir().pasarOfertas()
    j.opcion('bucear').comprometer('EXP', ['baqueano']).seguir().pasarOfertas()
    // EXP 5: la Herbolaria (2, +1 por Diego) y «Ojo avizor» (2 iconos de EXP).
    j.opcion('bucear').comprometer('EXP', ['herbolaria'], ['ojo']).seguir().pasarOfertas()
    expect(j.estado.reputacion).toBe(1 + 1 + 2)
    expect(j.copia('custodia').vinculadaA).toBe('barco')
    expect(j.copia('cadena_oro').vinculadaA).toBe('barco')
  })

  it('sin Tripulantes preparados no se puede bucear: la misión se supera con su 1 de reputación', () => {
    const j = enPuerto({ misiones: ['pecio-I'], capitan: { agotada: true }, mazoPeligros: ['calma', 'calma'] })
    j.zarpar('pecio-I').seguir()
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('misionesSuperadas')).toEqual(['pecio-I'])
  })
})

describe('Tesoros 270 y 271 (El pecio del San José)', () => {
  it('Cadena de oro: «Acción: Descarta esta carta: este turno, el próximo Tripulante o Mejora que consigas cuesta 3 menos»', () => {
    const j = Jugador.en({ barco: { mejoras: ['cadena_oro'] }, muelle: ['contrabandista', 'bucanero'], mano: ['ojo', 'timon'] })
    const contrabandista = j.inst('contrabandista', ['muelle'])
    expect(j.valor({ tipo: 'coste', carta: contrabandista })).toBe(3)
    j.usar('cadena_oro.gastar')
    expect(j.zona('mazoHistoria')).toContain('cadena_oro')
    expect(j.valor({ tipo: 'coste', carta: contrabandista })).toBe(0)
    j.reclutar('contrabandista')
    expect(j.zona('mano')).toHaveLength(2)
    // El descuento se gasta con el primero.
    expect(j.valor({ tipo: 'coste', carta: j.inst('bucanero', ['muelle']) })).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Escolta del San Telmo

describe('272 · Escolta del San Telmo y la permanente 273 «Galeón San Telmo»', () => {
  it('al zarpar, el galeón entra en juego; al superarla con 3 o más de Vida: 2 + 1 de reputación y robas 2', () => {
    const j = enPuerto({ misiones: ['escolta-I'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('escolta-I')
    expect(j.zona('permanentes')).toEqual(['pm_galeon'])
    j.seguir().seguir()
    expect(j.estado.reputacion).toBe(3)
    expect(j.registro).toContain('El galeón llega con 4 de Vida: +1 de reputación y robas 2.')
    // Al terminar la misión vuelve al mazo de historia.
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('pm_galeon')
  })

  it('cada Prueba de COM que falles le inflige 1 daño; puede sufrir parte del daño del Barco, o todo, en su lugar', () => {
    // «Piratas rivales» (COM 4): sin nadie, se falla: el galeón sufre 1 y el Barco iría a sufrir 1.
    const j = enPuerto({ misiones: ['escolta-I'], mazoPeligros: ['rivales', 'calma', 'calma', 'calma'] })
    j.zarpar('escolta-I').comprometer('COM', []).pasarOfertas().seguir()
    expect(j.ofreceCapacidad('pm_galeon.cap.cubrir')).toBe(true)
    j.usar('pm_galeon.cap.cubrir')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'desviarAProtegido', carta: 'pm_galeon', n: 1 } })
    j.opcion('1')
    expect(j.estado.danoBarco).toBe(0)
    expect(vida(j, 'pm_galeon', 4)).toBe(2)
  })

  it('sin Vida restante, la misión falla', () => {
    // «Mercante armado» (COM 3, Avance 2 / 1; si fallas, Daña 1) cuatro veces, con «Chubasco» (0) de Destino.
    const j = enPuerto({ misiones: ['escolta-I'], mazoPeligros: ['civiles', 'chubasco', 'civiles', 'chubasco', 'civiles', 'chubasco', 'civiles', 'chubasco', 'calma'] })
    j.zarpar('escolta-I')
    for (let i = 0; i < 4; i++) {
      j.comprometer('COM', []).seguir().pasarOfertas()
      if (i < 3) j.seguir()
    }
    expect(vida(j, 'pm_galeon', 4)).toBe(0)
    expect(j.registro).toContain('La misión falla: el galeón San Telmo se hunde.')
  })
})

// ---------------------------------------------------------------------------
// El asedio de Port Royal

describe('274 · El asedio de Port Royal y la permanente 275 «Murallas de Port Royal»', () => {
  it('cuando la misión está disponible, las Murallas entran en juego; al final de cada turno sin zarpar a ella, 1 daño', () => {
    const j = Jugador.en({ misiones: ['asedio-I', 'deuda-I'], escenario: ['pruebas-calma', 'pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN] })
    expect(j.zona('permanentes')).toEqual(['pm_murallas'])
    j.pasarTurnoEnPuerto()
    expect(vida(j, 'pm_murallas', 6)).toBe(5)
  })

  it('sin Vida restante (en puerto): −2 de reputación, la misión va al fondo del mazo de Misiones y las Murallas vuelven al mazo de historia', () => {
    const j = Jugador.en({ misiones: ['asedio-I', 'deuda-I'], reputacion: 3, escenario: ['pruebas-calma', 'pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN] })
    j.copia('pm_murallas').heridas = 5
    j.pasarTurnoEnPuerto()
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('mazoMisiones').at(-1)).toBe('asedio-I')
    expect(j.zona('mazoHistoria')).toContain('pm_murallas')
    expect(j.zona('permanentes')).toEqual([])
  })

  it('el turno en que zarpas a ella no sufre el daño de final de turno; cada Prueba que falles en ella, sí, 1', () => {
    const j = enPuerto({ misiones: ['asedio-I'], mazoPeligros: ['fauna', 'calma', 'calma', 'calma', 'calma'] })
    j.zarpar('asedio-I')
    // «Ratas en el almacén» (EXP 1): sin nadie, se falla.
    j.comprometer('EXP', []).pasarOfertas().seguir()
    expect(vida(j, 'pm_murallas', 6)).toBe(5)
  })

  it('al superarla con 4 o más de Vida: 2 + 1 de reputación; después, las Murallas vuelven al mazo de historia', () => {
    const j = enPuerto({ misiones: ['asedio-I'], mazoPeligros: ['calma', 'calma', 'calma', 'calma', 'calma'] })
    j.zarpar('asedio-I').seguir().seguir().seguir()
    expect(j.estado.reputacion).toBe(3)
    expect(j.registro).toContain('Las murallas aguantan con 6 de Vida: +1 de reputación.')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('pm_murallas')
  })

  it('durante la misión, pueden sufrir el daño del Barco en su lugar; si caen, la misión falla y va al fondo sin preguntar', () => {
    // «Comerciante estafador» no; «Mercante armado»… en Ciudad: «Pelea de taberna» (COM 3) no daña el Barco. Se usa un daño
    // de la Vía de agua: no, en Ciudad no achica. Se prueba con las Murallas a 1 de Vida y una Prueba fallada.
    const j = enPuerto({ misiones: ['asedio-I'], reputacion: 4, mazoPeligros: ['fauna', 'calma', 'calma'] })
    j.zarpar('asedio-I')
    j.copia('pm_murallas').heridas = 5
    j.comprometer('EXP', []).pasarOfertas()
    if (j.decision.tipo === 'ventanaAccion' && j.decision.motivo.clave === 'ventanaPrueba') j.seguir()
    j.pasarOfertas()
    expect(j.registro).toContain('La misión falla: caen las murallas de Port Royal.')
    expect(j.estado.reputacion).toBe(2)
    expect(j.zona('mazoMisiones').at(-1)).toBe('asedio-I')
  })
})

// ---------------------------------------------------------------------------
// El rival con su barra

describe('276 · La regata de San Juan y el Tesoro 148 «Gallardete de San Juan»', () => {
  it('cada Peligro revelado, 2 fichas de Rival; cada Prueba de NAV superada, 1 de Avance más; ganas: 2 y el Gallardete (+1 Mando)', () => {
    const j = enPuerto({ misiones: ['regata-I'], mazoPeligros: ['oportunidad', 'calma', 'calma', 'calma', 'calma'] })
    j.zarpar('regata-I')
    expect(fichas(j, 'rival')).toBe(2)
    // «Navío a la deriva» (NAV 3): Diego 2 + Barco 1; Destino de «Mar en calma»: 0.
    j.comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    if (j.decision.tipo === 'elegirCartas') j.elegir('capitan')
    expect(j.registro).toContain('Ganas 3 de Avance (3/6).')
    j.seguir().seguir()
    expect(j.estado.reputacion).toBe(2)
    expect(j.copia('gallardete').vinculadaA).toBe('barco')
    expect(j.valor({ tipo: 'mando' })).toBe(6)
  })

  it('con 8 o más fichas de Rival, el rival gana la regata: al superarla, solo 1 de reputación (sin el Gallardete)', () => {
    // Se revelan «Chubasco» (falla: 1), «Chubasco» (1), «Mar en calma» (2) y «Mar en calma» (2): 6 de Avance, pero el
    // cuarto Peligro revelado lleva el Rival a 8. (Cada Prueba saca su Destino de la carta siguiente.)
    const j = enPuerto({ misiones: ['regata-I'], mazoPeligros: ['chubasco', 'calma', 'chubasco', 'calma', 'calma', 'calma', 'calma'] })
    j.zarpar('regata-I')
    j.comprometer('NAV', []).seguir().seguir()
    j.comprometer('NAV', []).seguir().seguir()
    j.seguir()
    expect(j.registro).toContain('Rival: +2 (8 de 8).')
    expect(j.estado.reputacion).toBe(1)
    expect(j.registro).toContain('El rival gana la regata: ganas 1 de reputación en lugar de la recompensa.')
    expect(j.zona('mazoHistoria')).toContain('gallardete')
  })
})

describe('259–263 · La carrera de van Hoorn', () => {
  it('I: Acción: Destina 3 NAV para quitar 2 fichas de Rival (una vez por misión)', () => {
    const j = enPuerto({ misiones: ['vanhoorn-I'], tripulacion: ['viejo_lobo', 'piloto_sueldo'], mazoPeligros: ['calma', 'calma', 'calma', 'calma'] })
    j.zarpar('vanhoorn-I')
    expect(fichas(j, 'rival')).toBe(2)
    j.usar('vanhoorn-I.alisio')
    expect(j.decision).toMatchObject({ tipo: 'cubrirDistancia', motivo: { clave: 'destina', n: 3 } })
    // Viejo lobo de mar: 3 (+1 por Diego) basta.
    j.cubrir('viejo_lobo')
    expect(fichas(j, 'rival')).toBe(0)
    expect(j.copia('viejo_lobo').agotada).toBe(true)
    expect(j.ofreceCapacidad('vanhoorn-I.alisio')).toBe(false)
  })

  it('I: con 8 fichas de Rival la misión termina: se aparta y la carta 261 (II-b) va encima del mazo de Misiones', () => {
    const j = enPuerto({ misiones: ['vanhoorn-I'], mazoPeligros: ['chubasco', 'calma', 'chubasco', 'calma', 'chubasco', 'calma', 'chubasco', 'calma'] })
    j.zarpar('vanhoorn-I')
    for (let i = 0; i < 3; i++) j.comprometer('NAV', []).seguir().seguir()
    expect(j.registro).toContain('Van Hoorn llega antes (8 fichas de Rival): la misión termina.')
    expect(j.zona('fueraDeJuego')).toContain('vanhoorn-I')
    expect(disponibles(j)).toContain('vanhoorn-II-b')
  })

  it('I: si te retiras, también se aparta y llega el II-b; si la superas, 1 de reputación y llega el II-a (el II-b sale)', () => {
    const r = enPuerto({ misiones: ['vanhoorn-I'], mazoPeligros: ['calma', 'calma', 'calma', 'calma'] })
    r.zarpar('vanhoorn-I').retirarse()
    expect(r.zona('fueraDeJuego')).toContain('vanhoorn-I')
    expect(disponibles(r)).toContain('vanhoorn-II-b')
    const s = enPuerto({ misiones: ['vanhoorn-I'], mazoPeligros: ['calma', 'calma', 'calma', 'calma'] })
    s.zarpar('vanhoorn-I').seguir().seguir()
    expect(s.estado.reputacion).toBe(1)
    expect(disponibles(s)).toContain('vanhoorn-II-a')
    expect(s.zona('fueraDeJuego')).toContain('vanhoorn-II-b')
  })

  it('II-a «La isla de Aves»: 3 de reputación y el Tesoro 263, «Carta de marear» (tus misiones de Mar necesitan 1 menos)', () => {
    const j = enPuerto({ misiones: ['vanhoorn-II-a', 'pruebas-mar5'], tripulacion: ['viejo_lobo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('vanhoorn-II-a').cubrir('viejo_lobo').seguir().seguir()
    expect(j.estado.reputacion).toBe(3)
    expect(j.copia('carta_marear').vinculadaA).toBe('barco')
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('pruebas-mar5', ['misionesDisponibles']) })).toBe(4)
  })

  it('II-b: al zarpar, la carta 262 va encima del mazo de Peligros: Abordaje, COM 4 (−1 si agotas un Cañón); después vuelve al mazo de historia', () => {
    const j = enPuerto({ misiones: ['vanhoorn-II-b'], barco: { mejoras: ['bronce'] }, mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('vanhoorn-II-b')
    expect(j.registro).toContain('Revelas «El barco de van Hoorn»: El barco de van Hoorn.')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige', carta: 'barco_vanhoorn' } })
    j.opcion('1')
    // Diego (COM 3) contra 3; Destino de «Mar en calma» (0). En un Abordaje no se pueden disparar los Cañones.
    expect(j.copia('bronce').agotada).toBe(true)
    j.comprometer('COM', ['capitan']).pasarOfertas()
    expect(j.ofreceCapacidad('bronce.disparar')).toBe(false)
    j.seguir()
    if (j.decision.tipo === 'elegirCartas') j.elegir('capitan')
    expect(j.registro).toContain('Total 3 contra 3: superas la Prueba.')
    expect(j.registro.some((r) => r.startsWith('Robas 1'))).toBe(true)
    expect(j.zona('mazoHistoria')).toContain('barco_vanhoorn')
  })

  it('II-b: superada, 2 de reputación y la Carta de marear', () => {
    const j = enPuerto({ misiones: ['vanhoorn-II-b'], tripulacion: ['bucanero', 'marinero_p'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('vanhoorn-II-b').comprometer('COM', ['capitan', 'bucanero', 'marinero_p']).pasarOfertas().seguir()
    if (j.decision.tipo === 'elegirCartas') j.elegir('capitan')
    j.seguir()
    expect(j.estado.reputacion).toBe(2)
    expect(j.copia('carta_marear').vinculadaA).toBe('barco')
  })
})

// ---------------------------------------------------------------------------
// El fugitivo

describe('264–267 · El fugitivo', () => {
  it('I «Tras la pista»: sin reglas; al superarla, 1 de reputación y la carta 265 encima del mazo de Misiones', () => {
    const j = enPuerto({ misiones: ['fugitivo-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('fugitivo-I').cubrir('viejo_lobo').seguir().seguir()
    expect(j.estado.reputacion).toBe(1)
    expect(disponibles(j)).toContain('fugitivo-II')
  })

  it('II: si superas el barco del fugitivo, el prisionero entra en juego; puede sufrir las heridas de un Tripulante en su lugar', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], tripulacion: ['bucanero', 'marinero_p'], mazoPeligros: ['calma', 'fauna', 'chubasco', 'calma', 'calma'] })
    j.zarpar('fugitivo-II')
    expect(j.registro).toContain('Revelas «El barco del fugitivo»: El barco del fugitivo.')
    // Diego 3 + Bucanero veterano 2 + Rufián de cubierta 2 contra COM 4. El Destino «Remanso» prepara a uno.
    j.comprometer('COM', ['capitan', 'bucanero', 'marinero_p']).pasarOfertas().seguir().elegir('capitan')
    expect(j.zona('permanentes')).toEqual(['pm_prisionero'])
    // «Tiburones» (COM 2): sin nadie asignado, se falla: 1 herida, que puede sufrir el prisionero en lugar del Bucanero.
    j.seguir().comprometer('COM', []).seguir().repartir({ bucanero: 1 })
    expect(j.ofreceCapacidad('pm_prisionero.cap.heridas')).toBe(true)
    j.usar('pm_prisionero.cap.heridas')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'desviarAProtegido', carta: 'pm_prisionero', n: 1 } })
    j.opcion('1')
    expect(vida(j, 'pm_prisionero', 3)).toBe(2)
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('II: si fallas el barco del fugitivo, Abordaje y el fugitivo escapa: la misión falla', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], tripulacion: ['bucanero'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('fugitivo-II').comprometer('COM', []).pasarOfertas().seguir()
    expect(j.registro).toContain('La misión falla: el fugitivo escapa.')
  })

  it('El prisionero: sin Vida restante, la misión falla', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], tripulacion: ['bucanero', 'marinero_p'], mazoPeligros: ['calma', 'fauna', 'chubasco', 'calma', 'calma'] })
    j.zarpar('fugitivo-II').comprometer('COM', ['capitan', 'bucanero', 'marinero_p']).pasarOfertas().seguir().elegir('capitan')
    j.copia('pm_prisionero').heridas = 2
    j.seguir().comprometer('COM', []).seguir().repartir({ bucanero: 1 })
    j.usar('pm_prisionero.cap.heridas').opcion('1')
    expect(j.registro).toContain('La misión falla: el prisionero muere.')
  })
})
