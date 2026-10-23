// Fase 15 · las misiones nuevas: «La Isla del Tesoro» (capítulo II al azar), «La carrera de van Hoorn» y «El fugitivo»,
// y las misiones sueltas «El pecio del San José», «Escolta del San Telmo», «El asedio de Port Royal» y «La regata de San
// Juan», con sus permanentes, los barcos rivales y los Tesoros nuevos. Al menos una prueba por carta.
// Los Peligros de las pruebas son los antiguos (retirados del mazo), porque sus números son sencillos.

import { describe, expect, it } from 'vitest'

import { encolar } from './estado.ts'
import { motivoSinSuperar } from './misiones2/comun.ts'
import { ejecutar } from './motor.ts'
import { avanceInicialDelEscenario } from './tareas/mision.ts'
import { mover } from './zonas.ts'
import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
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
// El pecio del San José: el mazo del pecio

/** Llega al momento de bucear: «Remanso» dos veces (4 de 4). El mazo del pecio ya está barajado. */
function pecio(op: OpcionesSituacion = {}): Jugador {
  const j = enPuerto({
    misiones: ['pecio-I'],
    tripulacion: ['vigia', 'guia_alquiler', 'bucanero', 'viejo_lobo'],
    mano: ['ojo'],
    mazoPeligros: ['calma', 'calma', 'chubasco', 'chubasco', 'chubasco', 'chubasco', 'chubasco'],
    ...op,
  })
  j.zarpar('pecio-I').seguir()
  return j
}

const PECIO = ['pecio_doblones', 'pecio_tablones', 'pecio_culebrina', 'pecio_botica', 'cadena_oro', 'doblon', 'pecio_tiburon', 'pecio_morena', 'pecio_sinaire', 'pecio_corriente']
const cuenta = (j: Jugador) => {
  const buenas = j.zona('mazoPecio').filter((id) => !['pecio_tiburon', 'pecio_morena', 'pecio_sinaire', 'pecio_corriente'].includes(id)).length
  return { buenas, malas: j.zona('mazoPecio').length - buenas }
}

describe('268 · El pecio del San José (bucear en el mazo del pecio)', () => {
  it('al ir a superarse, baraja el mazo del pecio (10 cartas: 6 buenas y 4 malas); la misión ya no da reputación', () => {
    const j = pecio()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'bucear', carta: 'pecio-I', n: 0 } })
    expect([...j.zona('mazoPecio')].sort()).toEqual([...PECIO].sort())
    expect(cuenta(j)).toEqual({ buenas: 6, malas: 4 })
    expect(j.registro).toContain('Barajas el mazo del pecio: 10 cartas, 6 buenas y 4 malas.')
    j.opcion('subir')
    expect(j.estado.reputacion).toBe(0)
    expect(j.zona('misionesSuperadas')).toEqual(['pecio-I'])
    // Al terminar, el mazo del pecio vuelve al mazo de historia.
    expect(j.zona('mazoPecio')).toEqual([])
    for (const id of PECIO) expect(j.zona('mazoHistoria'), id).toContain(id)
  })

  it('una buena sale del mazo: agotas al buzo, la aplicas y te la quedas («Doblones sueltos»: robas 2)', () => {
    const j = pecio()
    j.encimaDelPecio('pecio_doblones').opcion('bucear')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buzo', carta: 'pecio-I' } })
    const mano = j.zona('mano').length
    j.elegir('vigia')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.registro).toContain('Robas del mazo del pecio: «Doblones sueltos» (buena: te la quedas).')
    expect(j.zona('mano')).toHaveLength(mano + 2)
    expect(j.zona('pecioSacadas')).toEqual(['pecio_doblones'])
    expect(cuenta(j)).toEqual({ buenas: 5, malas: 4 })
    expect(j.decision).toMatchObject({ motivo: { clave: 'bucear', n: 1 } })
  })

  it('una mala se aplica al buzo y vuelve barajada al mazo del pecio («Tiburón»: 2 heridas)', () => {
    const j = pecio()
    j.encimaDelPecio('pecio_tiburon').opcion('bucear').elegir('capitan').pasarOfertas()
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.zona('pecioSacadas')).toEqual([])
    expect(j.zona('mazoPecio')).toHaveLength(10)
    expect(cuenta(j)).toEqual({ buenas: 6, malas: 4 })
    expect(j.registro.some((r) => r.startsWith('«Tiburón» vuelve barajada al mazo del pecio'))).toBe(true)
  })

  it('«Sin aire»: 1 herida al buzo y no puedes bucear más; la misión se supera y el pecio vuelve al mazo de historia', () => {
    const j = pecio()
    j.encimaDelPecio('pecio_doblones', 'pecio_sinaire').opcion('bucear').elegir('vigia')
    j.opcion('bucear').elegir('bucanero').pasarOfertas()
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.registro).toContain('Sin aire: no puedes bucear más en esta misión.')
    expect(j.zona('misionesSuperadas')).toEqual(['pecio-I'])
    expect(j.zona('mazoPecio')).toEqual([])
    expect(j.zona('pecioSacadas')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('pecio_doblones')
    expect(j.zona('mazoHistoria')).toContain('pecio_sinaire')
  })

  it('«Corriente de fondo» devuelve al mazo del pecio una buena que hayas sacado (si es un Tesoro, sale del juego)', () => {
    const j = pecio()
    j.encimaDelPecio('pecio_doblones', 'cadena_oro', 'pecio_corriente').opcion('bucear').elegir('vigia')
    j.opcion('bucear').elegir('guia_alquiler')
    expect(j.copia('cadena_oro').vinculadaA).toBe('barco')
    j.opcion('bucear').elegir('bucanero')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'corrienteDeFondo' } })
    j.elegir('cadena_oro')
    expect(j.zonaDe('cadena_oro')).toBe('mazoPecio')
    expect(j.registro).toContain('Corriente de fondo: «Cadena de oro del San José» vuelve al mazo del pecio (el Tesoro sale del juego).')
    // Los Doblones siguen a un lado; la Corriente también vuelve al mazo: 9 cartas, 5 buenas.
    expect(j.zona('pecioSacadas')).toEqual(['pecio_doblones'])
    expect(cuenta(j)).toEqual({ buenas: 5, malas: 4 })
  })

  it('«Corriente de fondo» sin ninguna buena sacada: no ocurre nada', () => {
    const j = pecio()
    j.encimaDelPecio('pecio_corriente').opcion('bucear').elegir('vigia')
    expect(j.registro).toContain('Corriente de fondo: no tienes ninguna carta buena del pecio que devolver; no ocurre nada.')
    expect(cuenta(j)).toEqual({ buenas: 6, malas: 4 })
  })

  it('las otras buenas: «Tablones y jarcia» repara 2, «La botica del cirujano» cura 2 y «Una culebrina del galeón» pone un Cañón sin coste', () => {
    const j = pecio({ barco: { dano: 3 }, mazoMuelle: ['bronce', 'contrabandista', 'pedrero'] })
    j.copia('capitan').heridas = 2
    j.encimaDelPecio('pecio_tablones', 'pecio_botica', 'pecio_culebrina').opcion('bucear').elegir('vigia')
    expect(j.estado.danoBarco).toBe(1)
    j.opcion('bucear').elegir('guia_alquiler')
    if (j.decision.tipo === 'repartir') j.repartir({ capitan: 2 })
    expect(j.copia('capitan').heridas).toBe(0)
    j.opcion('bucear').elegir('bucanero')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'culebrinaPecio' } })
    j.elegir('bronce')
    expect(j.copia('bronce').vinculadaA).toBe('barco')
    expect(j.zona('pecioSacadas')).toEqual(['pecio_tablones', 'pecio_botica', 'pecio_culebrina'])
  })

  it('«Una culebrina del galeón» sin Espacio: no pones nada', () => {
    const j = pecio({ barco: { mejoras: ['casco', 'chalupa'] }, mazoMuelle: ['bronce', 'contrabandista'] })
    j.encimaDelPecio('pecio_culebrina').opcion('bucear').elegir('vigia')
    expect(j.registro).toContain('Buscas un Cañón en el mazo de muelle, pero no hay ninguno que quepa en el Barco: no pones nada.')
    expect(j.zonaDe('bronce')).toBe('mazoMuelle')
  })

  it('sin Tripulantes preparados no se puede bucear: la misión se supera sin nada', () => {
    const j = enPuerto({ misiones: ['pecio-I'], capitan: { agotada: true }, mazoPeligros: ['calma', 'calma'] })
    j.zarpar('pecio-I').seguir()
    expect(j.estado.reputacion).toBe(0)
    expect(j.zona('misionesSuperadas')).toEqual(['pecio-I'])
    expect(j.zona('mazoHistoria')).toContain('doblon')
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

  it('El doblón de la calavera, sacado del pecio: 2 de reputación y tu Capitán queda Maldito', () => {
    const j = pecio()
    j.encimaDelPecio('doblon').opcion('bucear').elegir('vigia')
    expect(j.copia('doblon').vinculadaA).toBe('barco')
    expect(j.estado.reputacion).toBe(2)
    expect(j.estados('capitan')).toContain('maldito')
  })

  it('El doblón: tu Capitán no puede quedar derrotado (queda con 1 Vida restante)', () => {
    const j = pecio()
    j.encimaDelPecio('doblon', 'pecio_tiburon').opcion('bucear').elegir('vigia')
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

  it('El doblón no se puede descartar: no se pierde al hundirse el Barco y «Corriente de fondo» no lo devuelve', () => {
    const j = pecio()
    j.encimaDelPecio('doblon', 'pecio_corriente').opcion('bucear').elegir('vigia')
    j.opcion('bucear').elegir('guia_alquiler')
    expect(j.registro).toContain('Corriente de fondo: no tienes ninguna carta buena del pecio que devolver; no ocurre nada.')
    expect(j.copia('doblon').vinculadaA).toBe('barco')
    const h = enPuerto({ misiones: ['pruebas-mar5'], barco: { mejoras: ['doblon', 'vela'], dano: 4 }, mazoPeligros: ['rivales', 'calma', 'calma', 'calma'] })
    h.zarpar('pruebas-mar5').comprometer('COM', []).pasarOfertas().seguir().pasarOfertas()
    expect(h.registro.some((r) => r.includes('se hunde'))).toBe(true)
    expect(h.copia('doblon').vinculadaA).toBe('barco')
  })
})

describe('Jugador automático en el pecio (Albert)', () => {
  it('se planta cuando quedan tantas malas como buenas, o cuando la peor mala podría derrotar al buzo', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const decide = jugadorConCriterio()
    const j = pecio()
    // Con 6 buenas y 4 malas, y el Capitán (4 de Vida) preparado: baja.
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'bucear' })
    // Con 2 buenas fuera (4 y 4): se planta.
    for (const id of ['pecio_doblones', 'pecio_tablones']) j.estado.zonas.pecioSacadas.push(...j.estado.zonas.mazoPecio.splice(j.zona('mazoPecio').indexOf(id), 1))
    expect(decide(j.estado, j.decision)).toEqual({ tipo: 'opcion', clave: 'subir' })
    // Con 5 y 4, pero todos los preparados con 2 o menos de Vida (el Tiburón hace 2): se planta.
    const k = pecio()
    k.estado.zonas.pecioSacadas.push(...k.estado.zonas.mazoPecio.splice(k.zona('mazoPecio').indexOf('pecio_doblones'), 1))
    k.copia('capitan').heridas = 2
    expect(decide(k.estado, k.decision)).toEqual({ tipo: 'opcion', clave: 'subir' })
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

