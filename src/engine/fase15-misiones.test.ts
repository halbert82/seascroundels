// Fase 15 · las misiones nuevas: «La Isla del Tesoro» (capítulo II al azar), «La carrera de van Hoorn» y «El fugitivo»,
// y las misiones sueltas «El naufragio del San José», «Escolta del San Telmo», «El asedio de Port Royal» y «La regata de San
// Juan», con sus permanentes, los barcos rivales y los Tesoros nuevos. Al menos una prueba por carta.
// Los Peligros de las pruebas son los antiguos (retirados del mazo), porque sus números son sencillos.

import { describe, expect, it } from 'vitest'

import { encolar } from './estado.ts'
import { motivoSinSuperar } from './misiones2/comun.ts'
import { ejecutar } from './motor.ts'
import { avanceInicialDelEscenario } from './tareas/mision.ts'
import { mover } from './zonas.ts'
import { Jugador, totalSinDestinoPrueba, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { CartaId, Decision } from './tipos.ts'

const MAZO_CAPITAN = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'ojo', 'ojo', 'timon', 'timon']

/** En el paso de zarpar, con un mazo de Peligros concreto (arriba primero). */
function enPuerto(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN], ...op })
}

const fichas = (j: Jugador, f: 'rival' | 'derrumbe') => j.estado.mision?.fichas?.[f] ?? 0
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
// El naufragio del San José: el mazo del naufragio

/** Llega al momento de bucear: «Remanso» dos veces (4 de 4). El mazo del naufragio ya está barajado. */
function naufragio(op: OpcionesSituacion = {}): Jugador {
  const j = enPuerto({
    misiones: ['naufragio-I'],
    tripulacion: ['vigia', 'guia_alquiler', 'bucanero', 'viejo_lobo'],
    mano: ['ojo'],
    mazoPeligros: ['calma', 'calma', 'chubasco', 'chubasco', 'chubasco', 'chubasco', 'chubasco'],
    ...op,
  })
  j.zarpar('naufragio-I').seguir()
  return j
}

const NAUFRAGIO = [
  'naufragio_cofre',
  'naufragio_llave',
  'culebrina_sanjose',
  'campana_sanjose',
  'naufragio_diario',
  'naufragio_bolsa',
  'doblon',
  'naufragio_tiburon',
  'naufragio_coral',
  'naufragio_ahogados',
  'naufragio_raqueros',
  'naufragio_pulpo',
]

describe('268 · El naufragio del San José (bucear en el mazo del naufragio)', () => {
  it('al ir a superarse, prepara a todos tus Tripulantes y baraja el mazo del naufragio (12 cartas); la misión no da reputación', () => {
    const j = enPuerto({ misiones: ['naufragio-I'], tripulacion: ['vigia', 'bucanero'], mazoPeligros: ['calma', 'calma', 'chubasco'] })
    j.copia('bucanero').agotada = true
    j.zarpar('naufragio-I').seguir()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'bucear', carta: 'naufragio-I', n: 0 } })
    expect(j.copia('bucanero').agotada).toBe(false)
    expect([...j.zona('mazoNaufragio')].sort()).toEqual([...NAUFRAGIO].sort())
    expect(j.registro).toContain('Barajas el mazo del naufragio (12 cartas).')
    j.opcion('subir')
    expect(j.estado.reputacion).toBe(0)
    expect(j.zona('misionesSuperadas')).toEqual(['naufragio-I'])
    // Al terminar, todo el mazo del naufragio vuelve al mazo de historia.
    expect(j.zona('mazoNaufragio')).toEqual([])
    for (const id of NAUFRAGIO) expect(j.zona('mazoHistoria'), id).toContain(id)
  })

  it('«El cofre del virrey» y «La llave del cofre»: te los quedas a un lado; al juntar los dos, 1 de reputación, una sola vez', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_cofre', 'naufragio_tiburon', 'naufragio_llave').opcion('bucear')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buzo', carta: 'naufragio-I' } })
    j.elegir('vigia')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.registro).toContain('Robas del mazo del naufragio: «El cofre del virrey».')
    expect(j.registro).toContain('Te quedas «El cofre del virrey», a un lado.')
    expect(j.zona('naufragioQuedadas')).toEqual(['naufragio_cofre'])
    expect(j.estado.reputacion).toBe(0)
    // Un Tiburón por medio (vuelve al mazo) y, después, la llave: ahora sí, 1 de reputación.
    j.opcion('bucear').elegir('capitan').pasarOfertas()
    j.encimaDelNaufragio('naufragio_llave').opcion('bucear').elegir('guia_alquiler')
    expect(j.registro).toContain('Juntas «La llave del cofre» y «El cofre del virrey».')
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('naufragioQuedadas')).toEqual(['naufragio_cofre', 'naufragio_llave'])
    // Bucear más no da más reputación; al terminar, los dos vuelven al mazo de historia.
    j.encimaDelNaufragio('naufragio_tiburon').opcion('bucear').elegir('bucanero').pasarOfertas()
    j.opcion('subir')
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('mazoHistoria')).toContain('naufragio_cofre')
    expect(j.zona('mazoHistoria')).toContain('naufragio_llave')
  })

  it('el cofre solo no da nada', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_llave').opcion('bucear').elegir('vigia').opcion('subir')
    expect(j.estado.reputacion).toBe(0)
  })

  it('una carta que vuelve barajada: «Tiburón», 1 herida al que la ha robado y otra vez al mazo del naufragio', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_tiburon').opcion('bucear').elegir('capitan').pasarOfertas()
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.zona('mazoNaufragio')).toHaveLength(12)
    expect(j.zona('naufragioApartadas')).toEqual([])
    expect(j.registro).toContain('«Tiburón» vuelve barajada al mazo del naufragio.')
  })

  it('«Coral cortante» deja Sangrando al que la ha robado; «Los ahogados del San José», Maldito; los raqueros, el Barco Perseguido', () => {
    const j = naufragio()
    // Cada una vuelve barajada al mazo: se pone otra vez encima la siguiente.
    j.encimaDelNaufragio('naufragio_coral').opcion('bucear').elegir('capitan')
    expect(j.estados('capitan')).toContain('sangrando')
    j.encimaDelNaufragio('naufragio_ahogados').opcion('bucear').elegir('viejo_lobo')
    expect(j.estados('viejo_lobo')).toContain('maldito')
    j.encimaDelNaufragio('naufragio_raqueros').opcion('bucear').elegir('guia_alquiler')
    expect(j.estado.estadosBarco).toContain('perseguido')
    // Las tres vuelven al mazo.
    expect(j.zona('mazoNaufragio')).toHaveLength(12)
  })

  it('el pulpo, sacarlo entre dos: otro Tripulante preparado se agota y el que lo ha robado no sufre nada', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_pulpo').opcion('bucear').elegir('capitan')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'pulpo', carta: 'naufragio_pulpo' } })
    j.opcion('dos')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'pulpoAyuda' } })
    j.elegir('bucanero')
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.zona('mazoNaufragio')).toHaveLength(12)
  })

  it('el pulpo, que se suelte solo: 2 heridas al que lo ha robado; sin nadie más preparado, no hay elección', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_pulpo').opcion('bucear').elegir('capitan').opcion('solo').pasarOfertas()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.registro).toContain('El pulpo se suelta solo.')
    const k = naufragio({ tripulacion: [] })
    k.encimaDelNaufragio('naufragio_pulpo').opcion('bucear').pasarOfertas()
    expect(k.copia('capitan').heridas).toBe(2)
    // Ya no queda nadie preparado: se deja de bucear y la misión se supera.
    expect(k.registro).toContain('No te queda ningún Tripulante preparado: no puedes bucear más.')
    expect(k.zona('misionesSuperadas')).toEqual(['naufragio-I'])
  })

  it('«Una bolsa de aire» prepara a todos tus Tripulantes y se aparta (no dice qué hacer con ella)', () => {
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_tiburon').opcion('bucear').elegir('capitan').pasarOfertas()
    j.encimaDelNaufragio('naufragio_bolsa').opcion('bucear').elegir('vigia')
    expect(j.copia('vigia').agotada).toBe(false)
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.registro).toContain('«Una bolsa de aire» se aparta.')
    expect(j.zona('naufragioApartadas')).toEqual(['naufragio_bolsa'])
    expect(j.zona('mazoNaufragio')).toHaveLength(11)
  })

  it('«La culebrina del San José» entra en juego en el Barco y se queda al terminar; sin Espacio, vuelve barajada al mazo', () => {
    const j = naufragio()
    j.encimaDelNaufragio('culebrina_sanjose').opcion('bucear').elegir('vigia')
    expect(j.copia('culebrina_sanjose').vinculadaA).toBe('barco')
    expect(j.registro).toContain('«La culebrina del San José» entra en juego en el Barco.')
    j.opcion('subir')
    expect(j.zonaDe('culebrina_sanjose')).toBe('mejoras')
    // El Barco tiene Espacio 5: con el Casco (2) y la Chalupa (2) solo queda 1, y la culebrina ocupa 1; con 3 Mejoras, 0.
    const k = naufragio({ barco: { mejoras: ['casco', 'chalupa', 'vela'] } })
    k.encimaDelNaufragio('culebrina_sanjose').opcion('bucear').elegir('vigia')
    expect(k.registro).toContain('No tienes Espacio para «La culebrina del San José»: vuelve barajada al mazo del naufragio.')
    expect(k.zonaDe('culebrina_sanjose')).toBe('mazoNaufragio')
    expect(k.zona('mazoNaufragio')).toHaveLength(12)
  })

  it('«El diario del capitán»: un capítulo I de travesía del mazo de Misiones pasa a tus misiones disponibles con 2 de Avance', () => {
    const j = naufragio({ misiones: ['naufragio-I', 'prueba-I', 'aguada-I'], mazoMisiones: ['ladron-I', 'espia-I', 'fantasma-I', 'gobernador-I'] })
    j.encimaDelNaufragio('naufragio_diario').opcion('bucear').elegir('vigia')
    // Solo se ofrecen los capítulos I de travesía (no las aventuras).
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'diarioCapitulo' } })
    expect(j.decision.tipo === 'elegirCartas' && j.decision.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['espia-I', 'fantasma-I'])
    j.elegir('espia-I')
    // Cambia una de las disponibles; la misión en curso no cuenta.
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'diarioCambiar' } })
    expect(j.decision.tipo === 'elegirCartas' && j.decision.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['aguada-I', 'prueba-I'])
    j.elegir('aguada-I')
    expect(disponibles(j)).toEqual(['naufragio-I', 'prueba-I', 'espia-I'])
    expect(j.avance('espia-I')).toBe(2)
    expect(j.zona('mazoMisiones').at(-1)).toBe('aguada-I')
    expect(j.registro).toContain('«Seguirle por Port Royal» pasa a tus misiones disponibles con 2 de Avance, en lugar de «Agua y leña», que va al fondo del mazo de Misiones.')
    // El diario se aparta; al terminar, el Avance se queda en la misión.
    expect(j.zona('naufragioApartadas')).toEqual(['naufragio_diario'])
    j.opcion('subir')
    expect(j.avance('espia-I')).toBe(2)
    expect(j.zona('mazoHistoria')).toContain('naufragio_diario')
  })

  it('«El diario del capitán» sin capítulos I de travesía en el mazo de Misiones: no ocurre nada', () => {
    const j = naufragio({ mazoMisiones: ['ladron-I', 'gobernador-I'] })
    j.encimaDelNaufragio('naufragio_diario').opcion('bucear').elegir('vigia')
    expect(j.registro).toContain('No queda ningún capítulo I de travesía en el mazo de Misiones: no ocurre nada.')
    expect(j.decision).toMatchObject({ motivo: { clave: 'bucear', n: 1 } })
  })
})

describe('Las cartas del mazo del naufragio que se quedan en juego', () => {
  it('La campana del San José (270): al zarpar a una misión de Mar, oteas 2; a una de Naturaleza, no', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['campana_sanjose'] }, mazoPeligros: ['leyenda', 'cazadores', 'calma', 'calma'] })
    j.opcion('fondo').opcion('fondo')
    expect(j.zona('mazoPeligros').slice(-2)).toEqual(['leyenda', 'cazadores'])
    const k = Jugador.enMision({ misiones: ['pruebas-nat3'], barco: { mejoras: ['campana_sanjose'] }, mazoPeligros: ['fauna', 'calma', 'calma'] })
    expect(k.registro.some((r) => r.includes('Otea'))).toBe(false)
    expect(k.decision).not.toMatchObject({ motivo: { clave: 'otear' } })
  })

  it('La culebrina del San José (278): en el Mar, se agota y una Prueba de COM o de NAV recibe +2', () => {
    const com = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['culebrina_sanjose'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    com.comprometer('COM', ['capitan']).usar('culebrina_sanjose.disparar')
    expect(totalSinDestinoPrueba(com.estado)).toBe(5)
    expect(com.copia('culebrina_sanjose').agotada).toBe(true)
    // Niebla espesa (NAV 3) con el Destino de «Fauna» (−1): Diego 2 + 1 (Barco) + 2 − 1 = 4.
    const nav = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['culebrina_sanjose'] }, mazoPeligros: ['niebla', 'fauna', 'calma'] })
    nav.comprometer('NAV', ['capitan']).usar('culebrina_sanjose.disparar').seguir()
    expect(nav.registro).toContain('Total 4 contra 3: superas la Prueba.')
  })

  it('La culebrina es un Cañón: en un Abordaje no se ofrece', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['culebrina_sanjose'] }, mazoPeligros: ['p2_niebla', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan'])
    expect(j.ofreceCapacidad('culebrina_sanjose.disparar')).toBe(false)
  })

  it('La culebrina perdida no va a los descartes del muelle: vuelve al mazo de historia (P108)', () => {
    const j = Jugador.en({ barco: { dano: 5, mejoras: ['culebrina_sanjose', 'vela'] }, mazoHistoria: [] })
    expect(j.zona('mejoras')).toEqual([])
    expect(j.zona('mazoHistoria')).toEqual(['culebrina_sanjose'])
    expect(j.zona('descartesMuelle')).toEqual(['vela'])
  })

  it('El doblón de la calavera, sacado del naufragio: entra en juego, tu Capitán queda Maldito y no da reputación', () => {
    const j = naufragio()
    j.encimaDelNaufragio('doblon').opcion('bucear').elegir('vigia')
    expect(j.copia('doblon').vinculadaA).toBe('barco')
    expect(j.estado.reputacion).toBe(0)
    expect(j.estados('capitan')).toContain('maldito')
  })

  it('El doblón: tu Capitán no puede quedar derrotado (queda con 1 Vida restante)', () => {
    const j = naufragio()
    j.encimaDelNaufragio('doblon', 'naufragio_tiburon').opcion('bucear').elegir('vigia')
    j.copia('capitan').heridas = 3
    // «Tiburón» al Capitán (Vida 4, 3 heridas): iba a quedar derrotado; se queda con 1 de Vida.
    j.opcion('bucear').elegir('capitan').pasarOfertas()
    expect(j.estado.resultado).toBeNull()
    expect(j.copia('capitan').heridas).toBe(3)
    expect(j.registro).toContain('El doblón de la calavera: Diego «Garra» Mendoza no queda derrotado, se queda con 1 de Vida.')
  })

  it('El doblón: el Maldito del Capitán no se quita en la Taberna ni al superar una Prueba', () => {
    const j = Jugador.en({ barco: { mejoras: ['doblon'] }, capitan: { estados: ['maldito'] }, tripulacion: ['bucanero'], mazoCapitan: [...MAZO_CAPITAN] })
    j.copia('bucanero').estados = ['maldito']
    j.pasarTurnoEnPuerto(['taberna', 'astillero'])
    expect(j.estados('capitan')).toContain('maldito')
    expect(j.estados('bucanero')).not.toContain('maldito')
    // Al superar una Prueba a la que está asignado, tampoco.
    const p = enPuerto({ misiones: ['pruebas-mar5'], barco: { mejoras: ['doblon'] }, capitan: { estados: ['maldito'] }, mazoPeligros: ['chubasco', 'calma', 'calma', 'calma'] })
    p.zarpar('pruebas-mar5').comprometer('NAV', ['capitan']).seguir()
    expect(p.registro.some((r) => r.includes('superas la Prueba'))).toBe(true)
    expect(p.estados('capitan')).toContain('maldito')
  })

  it('El doblón no se puede descartar: no se pierde al hundirse el Barco ni al terminar el naufragio', () => {
    const j = naufragio()
    j.encimaDelNaufragio('doblon').opcion('bucear').elegir('vigia').opcion('subir')
    expect(j.copia('doblon').vinculadaA).toBe('barco')
    const h = enPuerto({ misiones: ['pruebas-mar5'], barco: { mejoras: ['doblon', 'vela'], dano: 4 }, mazoPeligros: ['rivales', 'calma', 'calma', 'calma'] })
    h.zarpar('pruebas-mar5').comprometer('COM', []).pasarOfertas().seguir().pasarOfertas()
    expect(h.registro.some((r) => r.includes('se hunde'))).toBe(true)
    expect(h.copia('doblon').vinculadaA).toBe('barco')
  })
})

describe('Jugador automático en el naufragio (Albert)', () => {
  it('se planta cuando quedan tantas cartas que hacen daño como de las otras, salvo si busca la otra mitad del cofre', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const decide = jugadorConCriterio()
    const j = naufragio()
    // 7 que ayudan y 5 que hacen daño, con todos preparados: baja.
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'bucear' })
    // Fuera la bolsa y el diario (5 y 5): se planta.
    const apartar = (k: Jugador, ...ids: CartaId[]) => {
      for (const id of ids) mover(k.estado, k.inst(id, ['mazoNaufragio']), 'naufragioApartadas', 'abajo')
    }
    apartar(j, 'naufragio_bolsa', 'naufragio_diario')
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'subir' })
    // Con el cofre a un lado y la llave aún en el mazo (5 y 5): baja a buscarla.
    const k = naufragio()
    apartar(k, 'naufragio_bolsa')
    mover(k.estado, k.inst('naufragio_cofre', ['mazoNaufragio']), 'naufragioQuedadas', 'abajo')
    expect(decide(k.estado, k.decision)).toEqual({ tipo: 'opcion', clave: 'bucear' })
  })

  it('no baja nadie a quien la siguiente herida o el pulpo podrían derrotar', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const decide = jugadorConCriterio()
    // Solo el Capitán, con 2 de Vida: el pulpo (2 heridas, sin nadie que lo saque) podría derrotarlo.
    const j = naufragio({ tripulacion: [] })
    j.copia('capitan').heridas = 2
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'subir' })
    // Con 3 de Vida, sí baja.
    j.copia('capitan').heridas = 1
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'bucear' })
    // Con alguien más preparado que pueda sacarlo del pulpo, basta con que aguante el Tiburón (2 de Vida).
    const k = naufragio({ tripulacion: ['bucanero'] })
    k.copia('capitan').heridas = 3
    expect(decide(k.estado, k.decision)).toEqual({ tipo: 'opcion', clave: 'bucear' })
    k.opcion('bucear')
    expect(decide(k.estado, k.decision)).toEqual({ tipo: 'cartas', ids: [k.inst('bucanero')] })
  })

  it('el pulpo: lo sacan entre dos si hay alguien preparado', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const decide = jugadorConCriterio()
    const j = naufragio()
    j.encimaDelNaufragio('naufragio_pulpo').opcion('bucear').elegir('capitan')
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'dos' })
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

  it('cualquier Prueba que falles le inflige 1 daño, también las de NAV', () => {
    // «Chubasco» (NAV 2): sin nadie asignado, se falla.
    const j = enPuerto({ misiones: ['escolta-I'], mazoPeligros: ['chubasco', 'calma', 'calma', 'calma'] })
    j.zarpar('escolta-I').comprometer('NAV', []).pasarOfertas().seguir().pasarOfertas()
    expect(vida(j, 'pm_galeon', 4)).toBe(3)
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
    // Diego 3 + Bucanero veterano 2 + Rufián de cubierta 2 contra COM 3. El Destino «Remanso» prepara a uno.
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

// ---------------------------------------------------------------------------
// P98 (Albert): Alerta al otear, los barcos rivales con Alerta y «Vivo, no muerto» sin prisionero

describe('P98 · Alerta al otear, los barcos rivales y el prisionero', () => {
  it('los Despachos del Rey (Al zarpar: Otea 2) ven el barco del fugitivo: tiene Alerta y no se ofrece mandarlo al fondo', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], barco: { mejoras: ['despachos'] }, mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('fugitivo-II')
    expect(j.registro).toContain('«El barco del fugitivo» tiene Alerta: se queda encima del mazo.')
    // Solo se pregunta por la otra carta («Remanso»).
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'calma' } })
    j.opcion('fondo').pasarOfertas()
    expect(j.registro).toContain('Revelas «El barco del fugitivo»: El barco del fugitivo.')
  })

  it('fuera de una misión, la Vigía inexperta (Otea 1) tampoco puede mandar al fondo el barco de van Hoorn', () => {
    const j = Jugador.en({ tripulacion: ['vigia'], mazoPeligros: ['barco_vanhoorn', 'calma', 'calma'], mazoCapitan: [...MAZO_CAPITAN] })
    j.usar('vigia.otear')
    expect(j.registro).toContain('«El barco de van Hoorn» tiene Alerta: se queda encima del mazo.')
    expect(j.zona('mazoPeligros')[0]).toBe('barco_vanhoorn')
  })

  it('«pon 1 al fondo» no puede elegir una carta con Alerta', () => {
    const j = Jugador.en({ mazoPeligros: ['p2_ronda', 'calma', 'calma'], mazoCapitan: [...MAZO_CAPITAN] })
    // (Ninguna carta de la caja dice todavía «pon 1 al fondo»: se pide la tarea directamente.)
    const s = j.estado
    encolar(s, { tipo: 'otear', n: 2, cartas: [], arriba: [], fondo: [], fondoMax: 1, fondoMin: 1 })
    s.pendiente = null
    ejecutar(s)
    const d = s.pendiente as Decision | null
    expect(d).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'alFondo', n: 1 } })
    if (d?.tipo === 'elegirCartas') expect(d.candidatas.map((c) => s.cartas[c]?.id)).toEqual(['calma'])
  })

  it('el barco del fugitivo es COM 3: Diego solo (COM 3) lo supera y el prisionero entra en juego', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('fugitivo-II').comprometer('COM', ['capitan']).pasarOfertas().seguir()
    if (j.decision.tipo === 'elegirCartas') j.elegir('capitan')
    expect(j.registro).toContain('Total 3 contra 3: superas la Prueba.')
    expect(j.zona('permanentes')).toEqual(['pm_prisionero'])
  })

  it('«Vivo, no muerto» no se supera si la carta 267 (el prisionero) no está en juego', () => {
    const j = enPuerto({ misiones: ['fugitivo-II'], mazoPeligros: ['calma', 'calma', 'calma', 'calma', 'calma'] })
    // Sin el barco del fugitivo (nunca se captura al prisionero): con 6 de Avance, la misión sigue.
    mover(j.estado, j.inst('barco_fugitivo', ['mazoHistoria']), 'fueraDeJuego')
    j.zarpar('fugitivo-II').seguir().seguir().seguir()
    expect(j.avance('fugitivo-II')).toBeGreaterThanOrEqual(6)
    expect(j.estado.mision?.fin).toBeNull()
    expect(motivoSinSuperar(j.estado)).toBe('Sin el prisionero (carta 267) en juego, no puedes superarla')
  })
})

