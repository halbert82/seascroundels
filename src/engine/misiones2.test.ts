// Misiones 2.0 (docs/misiones-2.0.md): al menos una prueba por capítulo, por Pasajero y por «¡La guardia!».
// Los Peligros de las pruebas son los antiguos (retirados del mazo), porque sus números son sencillos.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion, dificultadConDestino } from './pruebas/situacion.ts'
import { plazasOcupadas } from './valores.ts'

const MAZO_CAPITAN = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'ojo', 'ojo', 'timon', 'timon']

/** En el paso de zarpar, con un mazo de Peligros concreto (arriba primero). */
function enPuerto(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN], ...op })
}

const fichas = (j: Jugador, f: 'ladron' | 'alarma' | 'sospecha' | 'persecucion' | 'mecha' | 'defensa' | 'derrumbe') => j.estado.mision?.fichas?.[f] ?? 0
/** Misiones en el mazo de Misiones o ya disponibles (al reponer, el capítulo nuevo puede salir enseguida). */
const enMisiones = (j: Jugador) => [...j.zona('misionesDisponibles'), ...j.zona('mazoMisiones')]
const acciones = (j: Jugador) => (j.decision.tipo === 'ventanaAccion' ? j.decision.acciones.map((a) => a.tipo) : [])

// ---------------------------------------------------------------------------
// Misiones iniciales

describe('113 · Cobrar la deuda', () => {
  it('los encuentros #Pirata# reciben −1; el pagaré se recupera al superarla y robas 1 más', () => {
    const j = enPuerto({ misiones: ['deuda-I'], mano: ['ojo', 'timon'], mazoMuelle: ['bucanero'], mazoPeligros: ['rivales', 'chubasco', 'calma', 'calma'] })
    j.zarpar('deuda-I')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elegirEfectos' } })
    j.opcion('0').elegir('ojo')
    expect(j.registro).toContain('Dejas como pagaré: Ojo avizor.')
    expect(j.zona('incautadas')).toEqual(['ojo'])
    // Pelea de taberna (Pirata): COM 3 − 1 = 2.
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.registro).toContain('Total 3 contra 2: superas la Prueba.')
    j.seguir().resolverOteo() // Hora de la siesta: 4 de 3; otea 3 del mazo de Misiones (fase 10b)
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I'])
    expect(j.registro).toContain('Recuperas «Ojo avizor».')
    expect(j.zona('mano')).toEqual(expect.arrayContaining(['ojo', 'timon', 'coraje']))
  })

  it('si no la superas, pierdes el pagaré; sin cartas en la mano no se pregunta', () => {
    const j = enPuerto({ misiones: ['deuda-I'], mano: ['ojo'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.zarpar('deuda-I').opcion('0').comprometer('COM', ['capitan']).seguir().retirarse().opcion('dejar')
    expect(j.zona('fueraDeJuego')).toContain('ojo')
    const sinMano = enPuerto({ misiones: ['deuda-I'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    sinMano.zarpar('deuda-I')
    expect(sinMano.decision.tipo).toBe('comprometer')
  })
})

describe('114 · Rumbo a mar abierto', () => {
  it('el primer daño de la misión se evita; el segundo, no; sin Gesta con el Barco dañado', () => {
    // Bajíos traicioneros (NAV 2 / EXP 3): sin nadie comprometido, 1 daño. Empieza con 1 de Avance: cada Bajío sin
    // superar da el Avance pequeño (1).
    const j = enPuerto({ misiones: ['prueba-I'], avance: { 'prueba-I': 1 }, mazoPeligros: ['escollos', 'chubasco', 'escollos', 'chubasco', 'calma'] })
    j.zarpar('prueba-I').comprometer('NAV').seguir()
    expect(j.registro).toContain('El Barco sale de carena: evitas ese daño.')
    expect(j.estado.danoBarco).toBe(0)
    j.seguir().comprometer('NAV').seguir()
    expect(j.estado.danoBarco).toBe(1)
    expect(j.zona('misionesSuperadas')).toEqual(['prueba-I'])
    expect(j.estado.reputacion).toBe(0) // fase 11: 0 de reputación (y sin Gesta)
  })

  it('Gesta: superada sin que el Barco haya sufrido daño en esta misión, +1 de reputación', () => {
    const j = enPuerto({ misiones: ['prueba-I'], muelle: ['vela'], mazoPeligros: ['racha', 'calma'] })
    j.zarpar('prueba-I').elegir('vela')
    expect(j.registro).toContain('¡Gesta cumplida!: +1 de reputación.')
    expect(j.estado.reputacion).toBe(1) // fase 11: 0 y 1 de la Gesta
  })

  it('P50: el daño que el Barco traía de antes no cuenta para la Gesta; el que evita la carena, tampoco', () => {
    const antes = enPuerto({ misiones: ['prueba-I'], barco: { dano: 2 }, muelle: ['vela'], mazoPeligros: ['racha', 'calma'] })
    antes.zarpar('prueba-I').elegir('vela')
    expect(antes.estado.reputacion).toBe(1)
    // Bajíos fallados: su daño lo evita la carena; después, Viento de popa la supera.
    const evitado = enPuerto({ misiones: ['prueba-I'], muelle: ['vela'], mazoPeligros: ['escollos', 'chubasco', 'racha', 'calma'] })
    evitado.zarpar('prueba-I').comprometer('NAV').seguir().seguir().elegir('vela')
    expect(evitado.estado.danoBarco).toBe(0)
    expect(evitado.estado.reputacion).toBe(1)
  })
})

describe('115 · Agua y leña', () => {
  it('al superar una Prueba, curas 1 herida a un comprometido herido (si hay varios, eliges)', () => {
    const j = enPuerto({ misiones: ['aguada-I'], capitan: { heridas: 2 }, tripulacion: ['baqueano'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.zarpar('aguada-I').comprometer('EXP', ['capitan', 'baqueano']).seguir()
    expect(j.copia('capitan').heridas).toBe(1)
    // Lluvia torrencial (EXP 1): Diego 1 y el Bucanero 0 (sin el +1 de Diego).
    const dos = enPuerto({ misiones: ['aguada-I'], capitan: { heridas: 2 }, tripulacion: [{ id: 'bucanero', heridas: 1 }], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    dos.zarpar('aguada-I').comprometer('EXP', ['capitan', 'bucanero']).seguir()
    expect(dos.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'se cura 1' } })
    dos.elegir('bucanero')
    expect([dos.copia('capitan').heridas, dos.copia('bucanero').heridas]).toEqual([2, 0])
  })
})

// ---------------------------------------------------------------------------
// Aventuras

describe('116 · El ladrón del puerto', () => {
  it('Fichas de Ladrón: empieza con 2; cada Peligro sin Prueba +1; con 5, se escapa y la misión falla', () => {
    // Tarde de lluvia (Ciudad): sin Prueba, 1 de Avance.
    const j = enPuerto({ misiones: ['ladron-I'], mazoPeligros: ['chubasco', 'chubasco', 'chubasco', 'calma'] })
    j.zarpar('ladron-I')
    expect(fichas(j, 'ladron')).toBe(3)
    j.seguir().seguir()
    expect(j.registro).toContain('La misión falla: el ladrón se escapa.')
    expect(j.registro).toContain('La misión falla (el ladrón se escapa): no superas «El ladrón del puerto».')
    expect(j.decision.motivo.clave).toBe('conservarMision')
  })

  it('cada Prueba fallada +1; cada Prueba de NAV o EXP superada por 2 o más −1; con 0, lo atrapas y superas la misión', () => {
    // Un soplo en la taberna (EXP 2) con «Buen augurio» (−1): el Rastreador suma 4 y la Herbolaria 3.
    const j = enPuerto({ misiones: ['ladron-I'], tripulacion: ['baqueano', 'herbolaria'], mazoPeligros: ['encrucijada', 'encrucijada', 'encrucijada', 'encrucijada'] })
    j.zarpar('ladron-I').comprometer('EXP', ['baqueano']).seguir().pasarOfertas()
    expect(fichas(j, 'ladron')).toBe(1)
    j.seguir().comprometer('EXP', ['herbolaria']).seguir().pasarOfertas()
    expect(j.registro).toContain('Lo atrapas: superas la misión.')
    expect(j.zona('misionesSuperadas')).toEqual(['ladron-I'])
    expect(j.estado.reputacion).toBe(1) // fase 11: 1 de reputación (antes 2)
    const falla = enPuerto({ misiones: ['ladron-I'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'] })
    falla.zarpar('ladron-I').comprometer('EXP').seguir()
    expect(fichas(falla, 'ladron')).toBe(3)
  })
})

describe('117 · La casa del gobernador', () => {
  it('Alarma: cada Prueba de COM superada, 1; con 2, la misión pide 1 de Avance más; con 3, ¡La guardia! (todas las Pruebas +1)', () => {
    // Timba en la taberna (COM 3, 1 de Avance) con «Ocasión» (−1).
    const timbas = Array.from({ length: 9 }, () => 'oportunidad')
    const j = enPuerto({ misiones: ['gobernador-I'], tripulacion: ['reinaldo', 'filibustero', 'espadachin'], mazoPeligros: timbas })
    j.zarpar('gobernador-I').comprometer('COM', ['filibustero']).seguir()
    expect(fichas(j, 'alarma')).toBe(1)
    j.seguir().comprometer('COM', ['espadachin']).seguir()
    expect(fichas(j, 'alarma')).toBe(2)
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('gobernador-I') })).toBe(6)
    j.seguir().comprometer('COM', ['reinaldo']).seguir()
    // Fase 11 (P63): «pon en juego la carta 220 del mazo de historia»: va a la zona de permanentes.
    expect(j.zona('permanentes')).toEqual(['guardia'])
    expect(j.registro).toContain('La Alarma llega a 3: pones en juego la carta 220 del mazo de historia, «¡La guardia!». Todas las Pruebas reciben +1.')
    expect(j.ofreceCapacidad('guardia.quitar0') && j.ofreceCapacidad('guardia.accion0')).toBe(true)
    j.seguir().comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // 3 + 1 (¡La guardia!) − 1 (Ocasión)
  })

  it('cada vez que un Tripulante queda Buscado, 1 de Alarma', () => {
    // «Ojos del gobernador» (Ciudad): si no le pagas y fallas, el Capitán queda Buscado.
    const j = enPuerto({ misiones: ['gobernador-I'], mazoPeligros: ['p2_ojos', 'chubasco', 'calma'] })
    j.zarpar('gobernador-I').comprometer('COM').seguir()
    expect(j.copia('capitan').estados).toContain('buscado')
    expect(fichas(j, 'alarma')).toBe(1)
  })

  it('¡La guardia! se quita agotando a 2 Tripulantes (vuelve al mazo de historia), y vuelve también al terminar la misión', () => {
    const timbas = Array.from({ length: 9 }, () => 'oportunidad')
    const j = enPuerto({ misiones: ['gobernador-I'], tripulacion: ['reinaldo', 'filibustero', 'espadachin', 'bucanero'], avance: { 'gobernador-I': 0 }, mazoPeligros: timbas })
    j.zarpar('gobernador-I').comprometer('COM', ['filibustero']).seguir().seguir().comprometer('COM', ['espadachin']).seguir().seguir()
    j.comprometer('COM', ['reinaldo']).seguir()
    expect(j.zona('permanentes')).toEqual(['guardia'])
    j.usar('guardia.accion0').elegir('capitan', 'bucanero')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('guardia')
  })

  it('saqueo: si te retiras con 2 o 3 de Avance, robas 2; con 4 o más, +1 de reputación y buscas una Mejora', () => {
    const poco = enPuerto({ misiones: ['gobernador-I'], avance: { 'gobernador-I': 2 }, mazoPeligros: ['chubasco', 'calma'] })
    poco.zarpar('gobernador-I').retirarse()
    expect(poco.registro).toContain('Saqueo: te retiras con 3 de Avance: robas 2 cartas.')
    expect(poco.zona('mano')).toHaveLength(2)
    const mucho = enPuerto({ misiones: ['gobernador-I'], avance: { 'gobernador-I': 3 }, mazoMuelle: ['sable'], mazoPeligros: ['chubasco', 'calma'] })
    mucho.zarpar('gobernador-I').retirarse().elegir('sable')
    expect(mucho.estado.reputacion).toBe(1)
    expect(mucho.zona('muelle')).toContain('sable')
  })
})

// ---------------------------------------------------------------------------
// El templo perdido

describe('118 · Rumbo a la isla', () => {
  it('no se supera hasta superar una Prueba de NAV o de EXP, aunque tengas el Avance', () => {
    const j = enPuerto({ misiones: ['templo-I'], avance: { 'templo-I': 4 }, mazoPeligros: ['racha', 'calma', 'chubasco', 'calma'] })
    j.zarpar('templo-I').ninguna() // no agota a Diego (Oficial)
    expect(j.avance('templo-I')).toBe(7)
    expect(j.estado.mision?.fin).toBeNull()
    j.seguir().seguir().comprometer('NAV', ['capitan']).seguir() // Chubasco repentino (NAV 2): 3
    expect(j.zona('misionesSuperadas')).toEqual(['templo-I'])
    expect(enMisiones(j)).toContain('templo-II')
  })
})

describe('118 · Rumbo a la isla: avistar la isla', () => {
  it('Acción: agotar a un Vigía o a un Piloto también permite superarla, sin Prueba de NAV ni de EXP', () => {
    const j = enPuerto({ misiones: ['templo-I'], tripulacion: ['vigia'], avance: { 'templo-I': 4 }, mazoPeligros: ['racha', 'calma', 'calma'] })
    j.zarpar('templo-I').ninguna()
    expect(j.avance('templo-I')).toBe(7)
    expect(j.ofreceCapacidad('templo-I.isla')).toBe(true)
    j.usar('templo-I.isla')
    expect(j.copia('vigia').agotada).toBe(true)
    expect(j.registro).toContain('Avistáis la isla: ya podéis superar la misión.')
    expect(j.zona('misionesSuperadas')).toEqual(['templo-I'])
    const sinVigia = enPuerto({ misiones: ['templo-I'], tripulacion: ['bucanero'], avance: { 'templo-I': 4 }, mazoPeligros: ['racha', 'calma', 'calma'] })
    sinVigia.zarpar('templo-I').ninguna()
    expect(sinVigia.ofreceCapacidad('templo-I.isla')).toBe(false)
  })
})

describe('119 · La selva', () => {
  it('no puedes retirarte; cada Prueba de EXP superada por 2 o más da 1 de Avance más', () => {
    // Serpientes (EXP 2) con «Viento a favor» (−1): el Rastreador suma 4.
    const j = enPuerto({ misiones: ['templo-II'], tripulacion: ['viejo_lobo', 'baqueano'], mazoPeligros: ['fauna', 'racha', 'calma', 'calma'] })
    j.zarpar('templo-II').cubrir('viejo_lobo').comprometer('EXP', ['baqueano']).seguir().pasarOfertas()
    expect(j.registro).toContain('Ganas 3 de Avance (3/4).')
    expect(acciones(j)).not.toContain('retirarse')
  })
})

describe('239 · La escalinata de los sacerdotes (fase 12, capítulo III nuevo)', () => {
  it('cada Prueba de EXP fallada pone 1 ficha de Derrumbe; con 3, la escalera cede y la misión falla', () => {
    // Ruinas olvidadas (EXP 3) sin nadie asignado: se fallan.
    const ruinas = ['oportunidad', 'calma', 'oportunidad', 'calma', 'oportunidad', 'calma', 'calma']
    const j = enPuerto({ misiones: ['templo-III'], mazoPeligros: ruinas })
    j.zarpar('templo-III').comprometer('EXP').seguir()
    expect(fichas(j, 'derrumbe')).toBe(1)
    j.seguir().comprometer('EXP').seguir()
    expect(fichas(j, 'derrumbe')).toBe(2)
    j.seguir().comprometer('EXP').seguir()
    expect(j.registro).toContain('La misión falla: la escalera cede.')
    expect(j.zona('misionesSuperadas')).toEqual([])
  })

  it('cada Prueba de EXP superada por 2 o más quita 1 ficha; superada, 2 de reputación y añade la carta 120', () => {
    // Ruinas fallada (1 ficha); Serpientes (EXP 2) con «Viento a favor»: el Rastreador suma 4 y la supera por 3.
    const j = enPuerto({ misiones: ['templo-III'], tripulacion: ['baqueano'], mazoPeligros: ['oportunidad', 'calma', 'fauna', 'racha', 'calma', 'calma', 'calma'] })
    j.zarpar('templo-III').comprometer('EXP').seguir()
    expect(fichas(j, 'derrumbe')).toBe(1)
    j.seguir().comprometer('EXP', ['baqueano']).pasarOfertas().seguir()
    expect(j.registro).toContain('Derrumbe: −1 (0 de 3).')
    while (j.estado.mision) {
      if (j.decision.tipo === 'ofrecer') j.pasar()
      else j.seguir()
    }
    expect(j.zona('misionesSuperadas')).toEqual(['templo-III'])
    expect(j.estado.reputacion).toBe(2)
    expect(enMisiones(j)).toContain('templo-IV')
  })
})

describe('120 · El templo (capítulo IV desde la fase 12)', () => {
  it('al zarpar se baraja el mazo del Templo con 6 cartas del mazo de Peligros', () => {
    const peligros = ['calma', 'calma', 'calma', 'calma', 'calma', 'calma', 'chubasco']
    const j = enPuerto({ misiones: ['templo-IV'], mazoPeligros: peligros })
    j.zarpar('templo-IV')
    const mision = [...j.zona('mazoMision'), ...j.zona('encuentro'), ...j.zona('descartesMision'), ...j.zona('permanentes'), ...j.zona('destino')]
    expect(mision).toHaveLength(12)
    expect(j.zona('mazoPeligros')).toEqual(['chubasco'])
  })

  it('final con elección: la Espada (Tesoro y 2 de reputación; tu Capitán queda Maldito) o el ídolo (3 de reputación)', () => {
    const op: OpcionesSituacion = { misiones: ['templo-IV'], avance: { 'templo-IV': 3 }, mazoHistoria: ['espada'], mazoPeligros: Array.from({ length: 7 }, () => 'calma') }
    const espada = enPuerto(op)
    espada.zarpar('templo-IV')
    expect(espada.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'finalMision', carta: 'templo-IV' } })
    espada.opcion('espada')
    expect(espada.estado.reputacion).toBe(2)
    expect(espada.copia('espada').vinculadaA).toBe(espada.estado.capitan)
    expect(espada.copia('capitan').estados).toContain('maldito')
    const idolo = enPuerto(op)
    idolo.zarpar('templo-IV').opcion('idolo')
    expect(idolo.estado.reputacion).toBe(3)
    expect(idolo.zona('mazoHistoria')).toContain('espada')
  })
})

// ---------------------------------------------------------------------------
// La Flota de la Plata

describe('126 · El Paso de los Vientos', () => {
  it('los encuentros #Tormenta# reciben +1; al zarpar puedes agotar a un Piloto o a un Marinero para ganar 2', () => {
    const j = enPuerto({ misiones: ['flota-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.zarpar('flota-I')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'alZarparAgotar' } })
    j.elegir('viejo_lobo')
    expect(j.avance('flota-I')).toBe(2)
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // Chubasco repentino: NAV 2 + 1
  })
})

describe('127 · El galeón rezagado', () => {
  it('se baraja el mazo de la Escolta con 6 Peligros; cada Prueba de COM superada, robas 1', () => {
    const peligros = ['racha', 'racha', 'hallazgo', 'calma', 'encrucijada', 'oportunidad', 'chubasco']
    const j = enPuerto({ misiones: ['flota-II'], tripulacion: ['reinaldo'], mazoPeligros: peligros })
    j.zarpar('flota-II')
    const mision = [...j.zona('mazoMision'), ...j.zona('encuentro'), ...j.zona('descartesMision'), ...j.zona('permanentes'), ...j.zona('destino')]
    expect(mision).toHaveLength(12)
    expect(j.zona('mazoPeligros')).toEqual(['chubasco'])
    // Sin mazo de la Escolta, solo Piratas rivales (COM 4): Diego y Rodrigo suman 3 + 4.
    const k = enPuerto({ misiones: ['flota-II'], tripulacion: ['reinaldo'], mazoHistoria: [], mazoPeligros: Array.from({ length: 7 }, () => 'rivales') })
    k.zarpar('flota-II').comprometer('COM', ['capitan', 'reinaldo'])
    if (k.decision.motivo.clave === 'herir') k.elegir('reinaldo') // «Puñal escondido»
    k.seguir()
    expect(k.registro.some((r) => r.startsWith('Total 6 contra 4: superas'))).toBe(true)
    expect(k.registro.some((r) => r.startsWith('Robas 1:'))).toBe(true)
  })
})

describe('238 · Al abordaje del galeón (fase 12, capítulo III nuevo)', () => {
  it('los Cañones no suman; cada Prueba de COM superada por 2 o más da 1 de Avance más', () => {
    // Tiburones (COM 2): Rodrigo (COM 4, +1 de Diego) la supera por 2 o más: 1 del encuentro y 1 más.
    const j = enPuerto({ misiones: ['flota-III'], tripulacion: ['reinaldo'], mazoPeligros: ['fauna', 'calma', 'calma', 'calma'] })
    j.zarpar('flota-III')
    expect(j.valor({ tipo: 'sinCanones' })).toBeGreaterThan(0)
    j.comprometer('COM', ['reinaldo']).pasarOfertas().seguir()
    expect(j.registro).toContain('Ganas 2 de Avance (2/6).')
    // Por lo justo (Diego, COM 3 contra 2 y el Destino de «Remanso»), solo el del encuentro.
    const k = enPuerto({ misiones: ['flota-III'], mazoPeligros: ['fauna', 'calma', 'calma', 'calma'] })
    k.zarpar('flota-III').comprometer('COM', ['capitan']).pasarOfertas().seguir()
    expect(k.registro).toContain('Ganas 1 de Avance (1/6).')
  })
})

describe('128 · La huida con la plata (capítulo IV desde la fase 12)', () => {
  it('Persecución: con 3, La Armada te persigue es el siguiente encuentro (Navío de línea, NAV 4, Abordaje) y después vuelve a apartarse', () => {
    // Cofre a la deriva (sin Prueba): 2. Chubasco repentino fallado sin nadie (NAV): 3.
    const j = enPuerto({ misiones: ['flota-IV'], mazoPeligros: ['hallazgo', 'chubasco', 'calma', 'calma', 'calma'] })
    j.zarpar('flota-IV')
    expect(fichas(j, 'persecucion')).toBe(2)
    j.seguir().comprometer('NAV').seguir()
    expect(j.registro).toContain('Os dan alcance: «La Armada te persigue» será tu siguiente encuentro. La Persecución vuelve a 1.')
    expect(fichas(j, 'persecucion')).toBe(1)
    j.seguir()
    expect(j.zona('encuentro')).toEqual(['armada'])
    expect(j.registro).toContain('Revelas «La Armada te persigue»: Navío de línea de la Armada (Mar). Te ha alcanzado.')
    j.comprometer('NAV', ['capitan']).seguir() // Abordaje: Diego 2 + 1 del Barco contra 4 (fase 14): falta 1, 1 herida
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.zona('mazoHistoria')).toContain('armada')
    expect(j.registro).toContain('«La Armada te persigue» vuelve al mazo de historia.')
  })

  it('cada Prueba de NAV superada por 2 o más quita 1; superada, 4 de reputación y el Mascarón', () => {
    const j = enPuerto({ misiones: ['flota-IV'], tripulacion: ['viejo_lobo'], avance: { 'flota-IV': 3 }, mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.zarpar('flota-IV').comprometer('NAV', ['viejo_lobo']).pasarOfertas().seguir() // 3 + 1 (Diego) + 1 (Barco) contra 2
    expect(j.zona('misionesSuperadas')).toEqual(['flota-IV'])
    expect(j.registro).toContain('Persecución: −1 (0 de 3).')
    expect(j.estado.reputacion).toBe(4) // fase 11: 4 (antes 5)
    expect(j.zona('mejoras')).toContain('mascaron')
  })
})

// ---------------------------------------------------------------------------
// El espía de Cádiz

describe('135 · Seguirle por Port Royal (fase 12: une «Un soplo en Port Royal» y «Seguirle por los muelles»)', () => {
  it('Ciudad 6 con Distancia 2; al zarpar puedes descartar 2 cartas para otear 3 (fase 13, I7: también al fondo); los #Civil# ya no dan Avance de más', () => {
    const j = enPuerto({ misiones: ['espia-I'], tripulacion: ['viejo_lobo'], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['chubasco', 'civiles', 'calma', 'calma'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('espia-I') })).toBe(6)
    expect(j.valor({ tipo: 'distancia', mision: j.inst('espia-I') })).toBe(1) // 2, y −1 del Barco
    j.zarpar('espia-I').cubrir('viejo_lobo')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'alZarparDescartar' } })
    j.opcion('si').elegir('ojo', 'coraje')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'chubasco' } })
    j.opcion('fondo').opcion('arriba').opcion('arriba')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'ordenarOteo' } })
    j.elegir('civiles', 'calma')
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'calma', 'chubasco']) // «Civiles» ya se ha revelado; «Chubasco», al fondo
    // Comerciante estafador (Civil, EXP 3, Avance 1 / 1) fallado: solo 1.
    j.comprometer('EXP').seguir()
    expect(j.registro).toContain('Ganas 1 de Avance (1/6).')
  })

  it('Sospecha: cada Prueba de COM superada, 1; con 3, el espía te descubre y la misión falla', () => {
    const timbas = Array.from({ length: 7 }, () => 'oportunidad')
    const j = enPuerto({ misiones: ['espia-I'], tripulacion: ['reinaldo', 'filibustero', 'viejo_lobo'], mazoPeligros: timbas })
    j.zarpar('espia-I').cubrir('viejo_lobo').comprometer('COM', ['capitan']).seguir().seguir().comprometer('COM', ['filibustero']).seguir()
    expect(fichas(j, 'sospecha')).toBe(2)
    j.seguir().comprometer('COM', ['reinaldo']).seguir()
    expect(j.registro).toContain('La misión falla: el espía te descubre.')
  })

  it('fallar por 2 o más con alguien asignado pone Sospecha; sin nadie, no (P55)', () => {
    // Vidente callejera (EXP 3) con «Mal fario» (+1): Diego suma 1 y le faltan 3.
    const j = enPuerto({ misiones: ['espia-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['sirenas', 'sirenas', 'calma'] })
    j.zarpar('espia-I').cubrir('viejo_lobo').comprometer('EXP', ['capitan']).seguir()
    expect(fichas(j, 'sospecha')).toBe(1)
    const nadie = enPuerto({ misiones: ['espia-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['sirenas', 'sirenas', 'calma'] })
    nadie.zarpar('espia-I').cubrir('viejo_lobo').comprometer('EXP').seguir()
    expect(fichas(nadie, 'sospecha')).toBe(0)
  })
})

describe('137 · La goleta del correo (capítulo II desde la fase 12)', () => {
  it('cada Prueba de NAV superada da 1 de Avance más; si fallas una de COM, no ganas el Tesoro', () => {
    const nav = enPuerto({ misiones: ['espia-II'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    nav.zarpar('espia-II').comprometer('NAV', ['capitan']).seguir()
    expect(nav.registro).toContain('Ganas 3 de Avance (3/5).')
    // Tiburones (COM 2) fallados sin nadie; luego Mar en calma: 3 + 1 + 2.
    const com = enPuerto({ misiones: ['espia-II'], avance: { 'espia-II': 3 }, mazoPeligros: ['fauna', 'chubasco', 'calma', 'calma'] })
    com.zarpar('espia-II').comprometer('COM').seguir()
    com.seguir()
    expect(com.zona('misionesSuperadas')).toEqual(['espia-II'])
    expect(com.estado.reputacion).toBe(3) // fase 12: 3
    expect(com.registro).toContain('No ganas el Tesoro «Los despachos del Rey».')
    expect(com.zona('mejoras')).not.toContain('despachos')
  })
})

// ---------------------------------------------------------------------------
// El cargamento de Maracaibo

describe('139 · Los muelles de Maracaibo', () => {
  it('al zarpar sube Don Anselmo; sin Buscados ni #Guardia# fallados, añade el II-a y el II-b sale de la partida', () => {
    const j = enPuerto({ misiones: ['maracaibo-I'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-I': 2 }, mazoPeligros: ['calma', 'calma'] })
    j.zarpar('maracaibo-I').cubrir('viejo_lobo')
    expect(j.zona('pasajeros')).toEqual(['anselmo'])
    expect(j.zona('misionesSuperadas')).toEqual(['maracaibo-I'])
    expect(enMisiones(j)).toContain('maracaibo-II-a')
    expect(j.zona('fueraDeJuego')).toContain('maracaibo-II-b')
  })

  it('con un encuentro #Guardia# fallado, los guardacostas te esperan: añade el II-b', () => {
    // Sereno curioso (Guardia, EXP 1; con Don Anselmo, 0) fallado sin nadie.
    // Empieza con todo el Avance: se supera al resolver el primer Peligro, aunque sin superar su Prueba dé poco.
    const j = enPuerto({ misiones: ['maracaibo-I'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-I': 4 }, mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    j.zarpar('maracaibo-I').cubrir('viejo_lobo').comprometer('EXP').seguir()
    expect(enMisiones(j)).toContain('maracaibo-II-b')
    expect(j.zona('fueraDeJuego')).toContain('maracaibo-II-a')
  })

  it('con un Tripulante Buscado, también el II-b', () => {
    const j = enPuerto({ misiones: ['maracaibo-I'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-I': 4 }, mazoPeligros: ['p2_ojos', 'chubasco', 'calma'] })
    j.zarpar('maracaibo-I').cubrir('viejo_lobo').comprometer('COM').seguir()
    expect(j.estado.mision === null || (j.estado.mision.buscados ?? 0) > 0).toBe(true)
    expect(enMisiones(j)).toContain('maracaibo-II-b')
  })

  it('Don Anselmo ocupa 1 de Capacidad: si no cabe, un Tripulante vuelve al muelle', () => {
    const j = enPuerto({ misiones: ['maracaibo-I'], tripulacion: ['viejo_lobo', 'bucanero', 'grumete', 'marinero_p'], mazoPeligros: ['calma', 'calma'] })
    j.zarpar('maracaibo-I').cubrir('viejo_lobo')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'pasajeroSinSitio', carta: 'anselmo' } })
    j.elegir('marinero_p')
    expect(j.zona('muelle')).toContain('marinero_p')
    expect(plazasOcupadas(j.estado)).toBe(4)
  })
})

describe('218 · La barra de noche (II-a)', () => {
  it('las Pruebas de NAV reciben −1 y los encuentros #Militar# +2; Gesta si no superas ninguna Prueba de COM', () => {
    const j = enPuerto({ misiones: ['maracaibo-II-a'], avance: { 'maracaibo-II-a': 3 }, mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.zarpar('maracaibo-II-a')
    expect(j.valor({ tipo: 'dificultad', base: 4, hab: 'COM', claves: ['Militar'] })).toBe(6)
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(1)
    j.seguir()
    expect(j.zona('misionesSuperadas')).toEqual(['maracaibo-II-a'])
    expect(j.estado.reputacion).toBe(3) // 2 + 1 de la Gesta
  })
})

describe('140 · Romper el bloqueo (II-b)', () => {
  it('los encuentros #Militar# reciben +1; cada Prueba de COM superada da 1 de Avance más', () => {
    const j = enPuerto({ misiones: ['maracaibo-II-b'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.zarpar('maracaibo-II-b')
    expect(j.valor({ tipo: 'dificultad', base: 4, hab: 'COM', claves: ['Militar'] })).toBe(5)
    j.comprometer('COM', ['capitan']).seguir() // Tiburones (COM 2, 1 de Avance)
    expect(j.registro).toContain('Ganas 2 de Avance (2/5).')
  })
})

describe('141 · La cala de los contrabandistas', () => {
  it('con Don Anselmo: Tesoro, y se baja y paga (robas 2)', () => {
    const j = enPuerto({ misiones: ['maracaibo-III'], pasajeros: ['anselmo'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-III': 2 }, mazoPeligros: ['calma'] })
    j.zarpar('maracaibo-III').cubrir('viejo_lobo')
    expect(j.estado.reputacion).toBe(2) // fase 11: 2 (antes 3)
    expect(j.zona('mejoras')).toContain('mapa_calas')
    expect(j.zona('mano')).toHaveLength(2)
    expect(j.zona('pasajeros')).toEqual([])
    expect(j.registro).toContain('Don Anselmo, el comerciante se baja y paga: deja el Barco.')
  })

  it('sin Don Anselmo no hay Tesoro; si fallas una misión de la travesía, Don Anselmo se baja asustado', () => {
    const sin = enPuerto({ misiones: ['maracaibo-III'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-III': 2 }, mazoPeligros: ['calma'] })
    sin.zarpar('maracaibo-III').cubrir('viejo_lobo')
    expect(sin.zona('mejoras')).not.toContain('mapa_calas')
    const huye = enPuerto({ misiones: ['maracaibo-III'], pasajeros: ['anselmo'], tripulacion: ['viejo_lobo'], mazoPeligros: ['chubasco', 'calma'] })
    huye.zarpar('maracaibo-III').cubrir('viejo_lobo').comprometer('EXP').seguir().retirarse().opcion('dejar')
    expect(huye.zona('pasajeros')).toEqual([])
    expect(huye.registro).toContain('Don Anselmo, el comerciante se baja asustado: deja el Barco.')
  })
})

// ---------------------------------------------------------------------------
// La fortaleza de San Felipe

describe('143 · Desembarco nocturno', () => {
  it('COM +1 y EXP −1; sin superar ninguna Prueba de COM, añade el II-a (Por el aljibe)', () => {
    const j = enPuerto({ misiones: ['sanfelipe-I'], tripulacion: ['viejo_lobo'], avance: { 'sanfelipe-I': 2 }, mazoPeligros: ['calma', 'calma'] })
    j.zarpar('sanfelipe-I').cubrir('viejo_lobo')
    expect(enMisiones(j)).toContain('sanfelipe-II-a')
    expect(j.zona('fueraDeJuego')).toContain('sanfelipe-II-b')
    expect(j.estado.reputacion).toBe(1) // fase 11: 1 (antes 2)
  })

  it('si superas una Prueba de COM, añade el II-b (Al asalto de las murallas)', () => {
    // Jaguar (COM 3 + 1) con «Zarpazo» (+1): Diego 3 y el Bucanero 2 (sin el +1 de Diego) suman 5.
    const j = enPuerto({ misiones: ['sanfelipe-I'], tripulacion: ['viejo_lobo', 'bucanero'], avance: { 'sanfelipe-I': 2 }, mazoPeligros: ['bestias', 'bestias', 'calma'] })
    j.zarpar('sanfelipe-I').cubrir('viejo_lobo')
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'EXP', claves: [] })).toBe(2)
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(dificultadConDestino(j.estado)).toBe(5)
    if (j.decision.motivo.clave === 'herir') j.elegir('bucanero')
    j.seguir()
    expect(enMisiones(j)).toContain('sanfelipe-II-b')
    expect(j.zona('fueraDeJuego')).toContain('sanfelipe-II-a')
  })
})

describe('219 · Por el aljibe (II-a)', () => {
  it('Alarma: cada Prueba de COM superada pone 1 ficha', () => {
    const j = enPuerto({ misiones: ['sanfelipe-II-a'], mazoPeligros: ['rivales', 'calma', 'calma'] })
    j.zarpar('sanfelipe-II-a').comprometer('COM', ['capitan']).seguir()
    expect(fichas(j, 'alarma')).toBe(1)
  })
})

describe('144 · Al asalto de las murallas (II-b)', () => {
  it('#Militar# y #Guardia# +1; si fallas una Prueba de COM, cada comprometido sufre además 1 herida', () => {
    // Ronda de la guardia (Guardia, Militar): COM 3 + 1. Diego suma 3.
    const j = enPuerto({ misiones: ['sanfelipe-II-b'], mazoPeligros: ['ley', 'chubasco', 'calma'] })
    j.zarpar('sanfelipe-II-b').comprometer('COM', ['capitan']).seguir()
    expect(j.registro).toContain('Total 3 contra 4: fallas la Prueba.')
    expect(j.copia('capitan').heridas).toBe(1)
  })
})

describe('145 · El polvorín', () => {
  it('Mecha: 1 ficha por cada Peligro revelado; con 4, se resuelve ese Peligro y, si no la has superado, estalla (P52)', () => {
    // Tarde de lluvia (Ciudad): sin Prueba, 1 de Avance.
    const j = enPuerto({ misiones: ['sanfelipe-III'], mazoPeligros: ['chubasco', 'chubasco', 'chubasco', 'chubasco', 'calma'] })
    j.zarpar('sanfelipe-III').seguir().seguir()
    expect(fichas(j, 'mecha')).toBe(3)
    j.seguir()
    expect(j.registro).toContain('Ganas 1 de Avance (4/5).')
    expect(j.registro).toContain('La misión falla: el polvorín estalla.')
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.decision.motivo.clave).toBe('conservarMision')
  })

  it('si el cuarto Peligro te da el Avance que faltaba, superas la misión y no estalla', () => {
    const j = enPuerto({ misiones: ['sanfelipe-III'], avance: { 'sanfelipe-III': 1 }, mazoPeligros: ['chubasco', 'chubasco', 'chubasco', 'chubasco', 'calma'] })
    j.zarpar('sanfelipe-III').seguir().seguir().seguir()
    expect(j.registro).not.toContain('La misión falla: el polvorín estalla.')
    expect(j.decision.motivo.clave).toBe('finalMision')
  })

  it('final con elección: rescatas a tu amigo (4) o vuelas el polvorín (3, Tesoro y el Barco Perseguido)', () => {
    const amigo = enPuerto({ misiones: ['sanfelipe-III'], avance: { 'sanfelipe-III': 3 }, mazoPeligros: ['calma'] })
    amigo.zarpar('sanfelipe-III').opcion('amigo')
    expect(amigo.estado.reputacion).toBe(4) // fase 11: 4 (antes 5)
    const vuela = enPuerto({ misiones: ['sanfelipe-III'], avance: { 'sanfelipe-III': 3 }, mazoPeligros: ['calma'] })
    vuela.zarpar('sanfelipe-III').opcion('polvorin')
    expect(vuela.estado.reputacion).toBe(3)
    expect(vuela.zona('mejoras')).toContain('polvora_rey')
    expect(vuela.copia('polvora_rey').fichas).toBe(3) // fase 10b: entra en juego con 3 fichas
    expect(vuela.estadosBarco).toEqual(['perseguido'])
  })
})

// ---------------------------------------------------------------------------
// El barco fantasma

describe('147 · A bordo del fantasma (fase 12: une «Niebla en el estrecho» y «A bordo del fantasma»)', () => {
  it('Mar 6; los Cañones no suman; el Barco no sufre daño: cada daño es 1 herida a quien elijas; sin modificadores de #Sobrenatural#', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], mazoPeligros: ['escollos', 'chubasco', 'calma'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('fantasma-I') })).toBe(6)
    j.zarpar('fantasma-I')
    expect(j.valor({ tipo: 'sinCanones' })).toBeGreaterThan(0)
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'NAV', claves: ['Sobrenatural'] })).toBe(3)
    expect(j.valor({ tipo: 'avanceExtraEncuentro', claves: ['Sobrenatural'], hab: null, margen: 0 })).toBe(0)
    j.comprometer('NAV').seguir() // Bajíos fallados: 1 daño
    expect(j.estado.danoBarco).toBe(0)
    expect(j.copia('capitan').heridas).toBe(1)
  })
})

describe('149 · El camarote del capitán (capítulo II desde la fase 12)', () => {
  it('la primera Prueba de la misión es Sin ayuda (solo un Tripulante); la siguiente, no', () => {
    const j = enPuerto({ misiones: ['fantasma-II'], tripulacion: ['viejo_lobo'], mazoPeligros: ['chubasco', 'calma', 'chubasco', 'calma'] })
    j.zarpar('fantasma-II')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', sinAyuda: true })
    expect(() => j.comprometer('NAV', ['capitan', 'viejo_lobo'])).toThrow(/Sin ayuda/)
    j.comprometer('NAV', ['capitan']).seguir().seguir()
    expect((j.decision as { sinAyuda?: boolean }).sinAyuda).toBeUndefined()
  })

  it('Gesta sin superar Pruebas de COM; final: el Farol (Tesoro y 3) o la bitácora (4 y quita Maldito de todos)', () => {
    const bitacora = enPuerto({ misiones: ['fantasma-II'], tripulacion: [{ id: 'bucanero', estados: ['maldito'] }], avance: { 'fantasma-II': 2 }, mazoPeligros: ['calma'] })
    bitacora.zarpar('fantasma-II').opcion('bitacora')
    expect(bitacora.estado.reputacion).toBe(5) // fase 12: 4 y 1 de la Gesta
    expect(bitacora.copia('bucanero').estados ?? []).not.toContain('maldito')
    const farol = enPuerto({ misiones: ['fantasma-II'], avance: { 'fantasma-II': 2 }, mazoPeligros: ['calma'] })
    farol.zarpar('fantasma-II').opcion('farol')
    expect(farol.estado.reputacion).toBe(4) // fase 12: 3 y 1 de la Gesta
    expect(farol.zona('mejoras')).toContain('farol')
  })
})

// ---------------------------------------------------------------------------
// El saqueo de Panamá

describe('151 · El prisionero de Portobelo', () => {
  it('#Guardia# +1; al superarla, 1 de reputación y sube El guía del istmo', () => {
    const j = enPuerto({ misiones: ['panama-I'], tripulacion: ['viejo_lobo'], avance: { 'panama-I': 3 }, mazoPeligros: ['calma'] })
    j.zarpar('panama-I').cubrir('viejo_lobo')
    expect(j.estado.reputacion).toBe(1) // fase 11: 1 (antes 2)
    expect(j.zona('pasajeros')).toEqual(['guia'])
    expect(enMisiones(j)).toContain('panama-II')
  })
})

describe('152 · Cruzar el istmo', () => {
  it('con El guía, Distancia 0; sin él, las Pruebas de EXP +1; no puedes retirarte', () => {
    const con = enPuerto({ misiones: ['panama-II'], pasajeros: ['guia'] })
    expect(con.valor({ tipo: 'distancia', mision: con.inst('panama-II') })).toBe(0)
    const sin = enPuerto({ misiones: ['panama-II'], tripulacion: ['viejo_lobo'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    expect(sin.valor({ tipo: 'distancia', mision: sin.inst('panama-II') })).toBe(1)
    sin.zarpar('panama-II').cubrir('viejo_lobo')
    sin.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(sin.estado)).toBe(2) // Lluvia torrencial: EXP 1 + 1
    sin.seguir()
    expect(acciones(sin)).not.toContain('retirarse')
  })
})

describe('153 · Las puertas de Panamá', () => {
  it('Defensa: empieza con 3; no se supera mientras quede alguna', () => {
    const j = enPuerto({ misiones: ['panama-III'], reputacion: 9, avance: { 'panama-III': 5 }, mazoPeligros: ['calma', 'calma', 'calma'] })
    j.zarpar('panama-III')
    expect(fichas(j, 'defensa')).toBe(3)
    expect(j.estado.mision?.fin).toBeNull()
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
  })
})

// ---------------------------------------------------------------------------
// Pasajeros

describe('221 · Don Anselmo, el comerciante', () => {
  it('los encuentros #Guardia# y #Civil# reciben −1; si el Barco se hunde, se baja', () => {
    const j = enPuerto({ misiones: ['pruebas-mar3'], pasajeros: ['anselmo'], barco: { dano: 4 }, mazoPeligros: ['escollos', 'chubasco', 'calma'] })
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'COM', claves: ['Civil'] })).toBe(2)
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'COM', claves: ['Guardia'] })).toBe(2)
    j.zarpar('pruebas-mar3').comprometer('NAV').seguir() // Bajíos fallados: 1 daño, 5 de 5
    expect(j.registro).toContain('¡El Barco se hunde!')
    expect(j.zona('pasajeros')).toEqual([])
  })
})

describe('222 · El guía del istmo', () => {
  it('las Pruebas de EXP en Naturaleza reciben −1; si fallas una Prueba de EXP, se marcha', () => {
    const j = enPuerto({ misiones: ['pruebas-nat3'], pasajeros: ['guia'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.zarpar('pruebas-nat3')
    expect(j.valor({ tipo: 'dificultad', base: 2, hab: 'EXP', claves: [] })).toBe(1)
    j.comprometer('EXP').seguir()
    expect(j.zona('pasajeros')).toEqual([])
    expect(j.registro).toContain('El guía del istmo se marcha por su cuenta: deja el Barco.')
  })
})

describe('220 · ¡La guardia!', () => {
  it('Acción: Prueba de COM 5 (con su propio +1, 6); si la superas, se descarta', () => {
    const timbas = Array.from({ length: 9 }, () => 'oportunidad')
    const j = enPuerto({ misiones: ['gobernador-I'], tripulacion: ['reinaldo', 'filibustero', 'espadachin', 'isabela'], mazoPeligros: timbas })
    j.zarpar('gobernador-I').comprometer('COM', ['filibustero']).seguir().seguir().comprometer('COM', ['espadachin']).seguir().seguir()
    j.comprometer('COM', ['isabela']).seguir()
    expect(j.zona('permanentes')).toEqual(['guardia'])
    j.usar('guardia.quitar0').comprometer('COM', ['capitan', 'reinaldo'])
    expect(dificultadConDestino(j.estado)).toBe(5) // 5 + 1 (¡La guardia!) − 1 (Ocasión)
    j.seguir()
    expect(j.zona('permanentes')).toEqual([])
    expect(j.registro).toContain('«¡La guardia!» vuelve al mazo de historia.')
  })

  it('fase 11 (P63): es una permanente: «Cortar por lo sano» puede devolverla al mazo de historia', () => {
    const timbas = Array.from({ length: 9 }, () => 'oportunidad')
    const j = enPuerto({ misiones: ['gobernador-I'], tripulacion: ['reinaldo', 'filibustero', 'espadachin'], mazoPeligros: timbas, mano: ['cortar', 'ojo', 'timon', 'coraje'] })
    j.zarpar('gobernador-I').comprometer('COM', ['filibustero']).seguir().seguir().comprometer('COM', ['espadachin']).seguir().seguir()
    j.comprometer('COM', ['reinaldo']).seguir()
    expect(j.zona('permanentes')).toEqual(['guardia'])
    j.usar('cortar.jugar').elegir('timon', 'coraje')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('guardia')
  })
})

// ---------------------------------------------------------------------------
// Fase 12: cada travesía de 2 o 4 capítulos, de principio a fin

/**
 * Juega en una sola partida los capítulos de una travesía, en orden: cada uno va encima del mazo de Misiones al superar
 * el anterior, sale entre las disponibles y se juega en el turno siguiente. Para no depender del azar, cada capítulo
 * empieza a 2 de terminarse y los encuentros son «Remanso» (2 de Avance, sin Prueba). Devuelve la reputación y el
 * turno al terminar cada capítulo, y si el siguiente ya estaba entre las disponibles al volver a puerto.
 */
function recorrer(
  capitulos: string[],
  historia: string[],
  op: { final?: string; tripulacion?: string[]; otras?: string[]; mazoMisiones?: string[] } = {},
): { j: Jugador; reputacion: number[]; turnos: number[]; disponibleAlVolver: boolean[] } {
  const j = Jugador.en({
    empezarEn: 'quedarseOZarpar',
    escenario: Array.from({ length: 8 }, () => 'pruebas-calma'),
    mazoCapitan: [...MAZO_CAPITAN, ...MAZO_CAPITAN],
    misiones: [capitulos[0] ?? '', ...(op.otras ?? [])],
    mazoMisiones: op.mazoMisiones ?? [],
    mazoHistoria: historia,
    mazoPeligros: Array.from({ length: 30 }, () => 'calma'),
    tripulacion: op.tripulacion ?? ['viejo_lobo', 'vigia'],
  })
  const reputacion: number[] = []
  const turnos: number[] = []
  const disponibleAlVolver: boolean[] = []
  for (const [k, id] of capitulos.entries()) {
    // Hasta poder zarpar a este capítulo.
    for (let n = 0; n < 40 && !(j.decision.motivo.clave === 'quedarseOZarpar' && j.zona('misionesDisponibles').includes(id)); n++) {
      const d = j.decision
      if (d.motivo.clave === 'descartarFinal') j.ninguna()
      else if (d.tipo === 'ofrecer') j.pasar()
      else j.terminar()
    }
    const inst = j.inst(id, ['misionesDisponibles'])
    const c = j.estado.cartas[inst]
    if (c) c.avance = j.valor({ tipo: 'avanceNecesario', mision: inst }) - 2
    j.zarpar(id)
    // Hasta volver a puerto (antes de empezar la misión hay que cubrir la Distancia y decidir lo de «Al zarpar»).
    // (Tras el último capítulo no quedan misiones y la partida termina: ya no hay decisión.)
    for (let n = 0; n < 40 && j.estado.pendiente && (j.estado.mision || j.decision.tipo === 'cubrirDistancia'); n++) {
      const d = j.decision
      if (d.tipo === 'cubrirDistancia') j.cubrir('viejo_lobo')
      else if (d.motivo.clave === 'finalMision' && d.tipo === 'elegirOpcion') j.opcion(op.final ?? d.opciones[0]?.clave ?? '')
      else if (d.motivo.clave === 'alZarparDescartar') j.opcion('no')
      else if (d.motivo.clave === 'alZarparAgotar') j.ninguna()
      else if (d.motivo.clave === 'portadorTesoro') j.elegir('capitan')
      else if (d.tipo === 'ventanaAccion' && j.ofreceCapacidad('templo-I.isla')) j.usar('templo-I.isla').elegir('vigia')
      else if (d.tipo === 'ofrecer') j.pasar()
      else j.seguir()
    }
    expect(j.zona('misionesSuperadas'), id).toContain(id)
    reputacion.push(j.estado.reputacion)
    turnos.push(j.estado.turno)
    const siguiente = capitulos[k + 1]
    if (siguiente) disponibleAlVolver.push(j.zona('misionesDisponibles').includes(siguiente))
  }
  return { j, reputacion, turnos, disponibleAlVolver }
}

describe('Fase 12: las travesías de 2 y 4 capítulos, de principio a fin', () => {
  it('El espía de Cádiz (2 capítulos): 1 y 3 de reputación, y los despachos del Rey', () => {
    const { j, reputacion } = recorrer(['espia-I', 'espia-II'], ['espia-II', 'despachos'])
    expect(reputacion).toEqual([1, 4])
    expect(j.zona('mejoras')).toContain('despachos')
  })

  it('El barco fantasma (2 capítulos): 1 y, con la bitácora, 4 más la Gesta', () => {
    const { reputacion } = recorrer(['fantasma-I', 'fantasma-II'], ['fantasma-II', 'farol'], { final: 'bitacora' })
    expect(reputacion).toEqual([1, 6])
    const farol = recorrer(['fantasma-I', 'fantasma-II'], ['fantasma-II', 'farol'], { final: 'farol' })
    expect(farol.reputacion).toEqual([1, 5])
    expect(farol.j.zona('mejoras')).toContain('farol')
  })

  it('La Flota de la Plata (4 capítulos): 1, 2, 2 y 4 de reputación, y el Mascarón del galeón', () => {
    const { j, reputacion } = recorrer(['flota-I', 'flota-II', 'flota-III', 'flota-IV'], ['flota-II', 'flota-III', 'flota-IV', 'mascaron'])
    expect(reputacion).toEqual([1, 3, 5, 9])
    expect(j.zona('mejoras')).toContain('mascaron')
  })

  it('fase 12 · la Flota entera con otras misiones en juego: cada capítulo sale al volver a puerto y se juegan en cuatro turnos seguidos', () => {
    const mazo = ['fantasma-I', 'templo-I', 'espia-I']
    const { j, reputacion, turnos, disponibleAlVolver } = recorrer(['flota-I', 'flota-II', 'flota-III', 'flota-IV'], ['flota-II', 'flota-III', 'flota-IV', 'mascaron'], {
      otras: ['prueba-I', 'aguada-I'],
      mazoMisiones: mazo,
    })
    expect(reputacion).toEqual([1, 3, 5, 9])
    expect(disponibleAlVolver).toEqual([true, true, true])
    const [primero = 0] = turnos
    expect(turnos).toEqual([primero, primero + 1, primero + 2, primero + 3])
    // El mazo de Misiones no cambia mientras dura la travesía: cada capítulo entra encima y sale enseguida. Al superar
    // el IV ya no hay capítulo siguiente y sale la de arriba del mazo.
    expect(j.zona('mazoMisiones')).toEqual(mazo.slice(1))
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'fantasma-I'])
  })

  it('El templo perdido (4 capítulos): 1, 2, 2 y, con el ídolo, 3 de reputación', () => {
    const { reputacion } = recorrer(['templo-I', 'templo-II', 'templo-III', 'templo-IV'], ['templo-II', 'templo-III', 'templo-IV', 'espada'], { final: 'idolo' })
    expect(reputacion).toEqual([1, 3, 5, 8])
    const espada = recorrer(['templo-I', 'templo-II', 'templo-III', 'templo-IV'], ['templo-II', 'templo-III', 'templo-IV', 'espada'], { final: 'espada' })
    expect(espada.reputacion).toEqual([1, 3, 5, 7])
    expect(espada.j.copia('espada').vinculadaA).toBe(espada.j.estado.capitan)
  })
})
