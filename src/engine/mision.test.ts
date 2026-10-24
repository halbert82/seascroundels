// Reglas de las misiones: zarpar, Al zarpar, revelar, Pruebas, Destino, recompensas, retirarse, hundirse y ganar.

import { afterEach, describe, expect, it } from 'vitest'
import { registrarParaPruebas } from './capacidades/index.ts'
import { Jugador, type OpcionesSituacion } from './pruebas/situacion.ts'
import type { Capacidad } from './tipos.ts'

let quitar: (() => void) | null = null
afterEach(() => {
  quitar?.()
  quitar = null
})

const MAZO_CAPITAN = ['coraje', 'emboscada', 'estrellas', 'coraje', 'emboscada', 'estrellas', 'ojo', 'ojo', 'timon', 'timon']

/** Situación en el paso de zarpar, con un mazo de Peligros concreto (arriba primero). */
function enPuerto(op: OpcionesSituacion): Jugador {
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma'], mazoCapitan: [...MAZO_CAPITAN], ...op })
}

function opcionesDeZarpar(j: Jugador): string[] {
  const d = j.decision
  return d.tipo === 'elegirOpcion' ? d.opciones.filter((o) => o.clave.startsWith('zarpar:')).map((o) => j.estado.cartas[o.clave.slice(7) as `i${number}`]?.id ?? '') : []
}

describe('Zarpar', () => {
  it('se ofrece zarpar a cada misión disponible a la que se puede llegar', () => {
    const j = enPuerto({})
    expect(opcionesDeZarpar(j)).toEqual(['deuda-I', 'prueba-I', 'aguada-I'])
  })

  it('«Las puertas de Panamá» solo con 6 de reputación o más (fase 11, P66; antes 9)', () => {
    const tripulacion = ['viejo_lobo', 'contrabandista']
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-III'], tripulacion, reputacion: 5 }))).toEqual([])
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-III'], tripulacion, reputacion: 6 }))).toEqual(['panama-III'])
  })

  it('no se ofrece una misión lejana si no se puede cubrir su Distancia', () => {
    // «El prisionero de Portobelo»: Distancia 3, 2 con el Barco. Diego solo tiene NAV 2: llega justo.
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-I'] }))).toEqual(['panama-I'])
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-II'], capitan: { agotada: true } }))).toEqual([])
  })

  it('ejemplo del reglamento: «El prisionero de Portobelo» se cubre con el Viejo lobo, con «Mano firme al timón» o con el Bucanero mientras Diego está preparado', () => {
    const conLobo = enPuerto({ misiones: ['panama-I'], tripulacion: ['viejo_lobo', 'bucanero'], mazoPeligros: ['calma'] })
    conLobo.zarpar('panama-I')
    expect(conLobo.decision).toMatchObject({ tipo: 'cubrirDistancia', distancia: 2 })
    conLobo.cubrir('viejo_lobo')
    expect(conLobo.copia('viejo_lobo').agotada).toBe(true)
    expect(conLobo.copia('capitan').agotada).toBe(false)

    const sinLobo = enPuerto({ misiones: ['panama-I'], tripulacion: ['bucanero'], mazoPeligros: ['calma'] })
    sinLobo.zarpar('panama-I').cubrir('bucanero') // NAV 1 + 1 por Diego = 2
    expect(sinLobo.copia('bucanero').agotada).toBe(true)
    expect(sinLobo.registro).toContain('Cubres la Distancia 2: agotas a Bucanero veterano.')

    // Fase 10: hay que agotar siempre al menos un Tripulante (aunque tenga NAV 0); las cartas con NAV solo completan.
    const soloCarta = enPuerto({ misiones: ['panama-I'], tripulacion: ['viejo_lobo', 'marinero_p'], mano: ['timon'], mazoPeligros: ['calma'] })
    soloCarta.zarpar('panama-I')
    expect(() => soloCarta.cubrir('timon')).toThrow('hay que agotar al menos a un Tripulante preparado')
    const conCarta = enPuerto({ misiones: ['panama-I'], tripulacion: ['viejo_lobo', 'marinero_p'], mano: ['timon'], mazoPeligros: ['calma'] })
    conCarta.zarpar('panama-I').cubrir('marinero_p', 'timon') // Rufián NAV 0 + 1 (Diego) y dos iconos de NAV
    expect(conCarta.copia('marinero_p').agotada).toBe(true)
    expect(conCarta.copia('viejo_lobo').agotada).toBe(false)
    expect(conCarta.copia('capitan').agotada).toBe(false)
    expect(conCarta.zona('descartesCapitan')).toEqual(['timon'])
    expect(conCarta.registro).toContain('Cubres la Distancia 2: agotas a Rufián de cubierta y descartas Mano firme al timón.')
  })

  it('no vale una combinación que no llega; Tripulantes y cartas con NAV se suman', () => {
    const j = enPuerto({ misiones: ['panama-I'], tripulacion: ['marinero_p'], mano: ['timon'], mazoPeligros: ['calma'] })
    j.zarpar('panama-I')
    expect(() => j.cubrir('marinero_p')).toThrow(/sumas 1/) // 0 + 1 por Diego
    j.cubrir('marinero_p', 'timon')
    expect(j.zona('descartesCapitan')).toEqual(['timon'])
  })
})

describe('Al empezar la misión', () => {
  it('el Avance que ya tenía la misión cuenta, y «Rumores del tesoro» suma 1 si zarpas este turno', () => {
    const j = enPuerto({ avance: { 'deuda-I': 1 }, temporales: [{ clave: 'rumores.turno', fuente: 'rumores', hasta: 'finTurno' }], mazoPeligros: ['chubasco'] })
    j.zarpar('deuda-I')
    expect(j.registro).toContain('Rumores del tesoro: +1 de Avance (2/3).')
    expect(j.registro).toContain('Ganas 1 de Avance (3/3).') // «Tarde de lluvia»
    j.resolverOteo() // la recompensa de «Cobrar la deuda»: otea 3 del mazo de Misiones
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I'])
  })

  it('Al zarpar: «Si tienes un Contrabandista preparado, gana 2»', () => {
    const j = enPuerto({ misiones: ['maracaibo-III'], tripulacion: ['viejo_lobo', 'contrabandista'], mazoPeligros: ['chubasco', 'calma'] })
    j.zarpar('maracaibo-III').cubrir('viejo_lobo')
    expect(j.registro).toContain('Tienes un Contrabandista preparado: +2 de Avance (2/4).')
  })

  it('Al zarpar opcional: «Puedes agotar a un Oficial para ganar 2» (puedes no hacerlo)', () => {
    const j = enPuerto({ misiones: ['templo-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['racha', 'racha'] })
    j.zarpar('templo-I')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 0, max: 1, motivo: { clave: 'alZarparAgotar', carta: 'templo-I' } })
    j.elegir('viejo_lobo')
    expect(j.copia('viejo_lobo').agotada).toBe(true)
    expect(j.registro).toContain('Agotas a Viejo lobo de mar al zarpar.')
    expect(j.registro).toContain('Rumbo a la isla: +2 de Avance (2/5).')
    const sin = enPuerto({ misiones: ['templo-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['racha', 'racha'] })
    sin.zarpar('templo-I').ninguna()
    expect(sin.copia('viejo_lobo').agotada).toBe(false)
  })
})

describe('Revelar y resolver encuentros', () => {
  it('se lee solo el encuentro del Entorno de la misión; uno sin Prueba da su Avance y aplica su efecto', () => {
    // «Agua y leña»: Distancia 1, que el Barco deja en 0.
    const j = enPuerto({ misiones: ['aguada-I'], capitan: { heridas: 1 }, mazoPeligros: ['racha', 'calma'] })
    j.zarpar('aguada-I')
    expect(j.registro).toContain('Revelas «Buena racha»: Manantial (Naturaleza).')
    expect(j.copia('capitan').heridas).toBe(0) // «1 curar»
    expect(j.avance('aguada-I')).toBe(1)
  })

  it('Prueba: comprometes, se revela el Destino, superas con total ≥ dificultad y ganas el Avance', () => {
    const j = enPuerto({ misiones: ['deuda-I'], tripulacion: ['bucanero'], mazoPeligros: ['rivales', 'chubasco', 'calma', 'calma'] })
    j.zarpar('deuda-I')
    expect(j.registro).toContain('Revelas «Rivales»: Pelea de taberna (Ciudad).')
    // Pelea de taberna: COM 3, Pirata −1 por «Cobrar la deuda» → 2. Bucanero: COM 2 + 1 por Diego = 3.
    j.comprometer('COM', ['bucanero'])
    expect(j.registro).toContain('Destino de la carta «Chubasco»: 0.')
    j.seguir()
    expect(j.registro).toContain('Total 3 contra 2: superas la Prueba.')
    expect(j.avance('deuda-I')).toBe(2)
  })

  it('si no comprometes a nadie, la fallas y se aplica la línea Sin oposición del Destino', () => {
    const j = enPuerto({ misiones: ['deuda-I'], tripulacion: ['bucanero'], mazoPeligros: ['rivales', 'rivales', 'calma'] })
    j.zarpar('deuda-I').comprometer('COM')
    // Destino «Puñal escondido»: Sin oposición, 1 herida a un Tripulante.
    expect(j.decision.motivo.clave).toBe('herir')
    j.elegir('bucanero')
    j.seguir()
    // Fase 10: el Destino resta del total (0 − 1 cuenta como 0); la Pelea de taberna pide 3 − 1 por la misión.
    expect(j.registro).toContain('Total 0 contra 2: fallas la Prueba (nadie asignado).')
  })

  it('sin refuerzo: las cartas de la mano solo se añaden al comprometer; en la ventana de acción ya no se descartan por sus iconos', () => {
    const j = enPuerto({ misiones: ['pruebas-mar5'], mano: ['abordaje'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    j.zarpar('pruebas-mar5').comprometer('COM', ['capitan'])
    expect(j.decision.motivo.clave).toBe('ventanaPrueba')
    const acciones = (j.decision as { acciones: { tipo: string }[] }).acciones.map((a) => a.tipo)
    expect(acciones).toEqual(['terminarPaso'])
    j.seguir()
    expect(j.registro).toContain('Total 3 contra 3: superas la Prueba.')
    expect(j.zona('mano')).toEqual(['abordaje'])
    const conCarta = enPuerto({ misiones: ['pruebas-mar5'], mano: ['abordaje'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    conCarta.zarpar('pruebas-mar5').comprometer('COM', ['capitan'], ['abordaje']).seguir()
    expect(conCarta.registro).toContain('Total 5 contra 3: superas la Prueba.')
  })

  it('el encuentro da Avance aunque no superes la Prueba, pero el segundo valor (Avance 2 / 1: 1)', () => {
    const j = enPuerto({ misiones: ['pruebas-mar5'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    j.zarpar('pruebas-mar5').comprometer('COM').seguir() // Tiburón tigre fallado sin comprometidos: 2 heridas a un Tripulante
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.avance('pruebas-mar5')).toBe(1)
  })
})

describe('Destinos', () => {
  it('«Alarma»: +2 si el encuentro es Militar o Guardia', () => {
    const j = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero', 'reinaldo'], mazoPeligros: ['ley', 'ley', 'calma'] })
    j.zarpar('pruebas-mar5').comprometer('COM', ['bucanero', 'reinaldo']).seguir()
    // Patrulla española (Barco, Militar) COM 4. Bucanero 3 + Rodrigo 5 = 8, y el Destino «Alarma» resta 2: 6.
    expect(j.registro).toContain('Total 6 contra 4: superas la Prueba.')
  })

  it('«Corriente traicionera»: +2 si la Prueba es de NAV; si no, +1', () => {
    const nav = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'arrecifes', 'calma'] })
    nav.zarpar('pruebas-mar5').comprometer('NAV', ['viejo_lobo']).pasar().seguir() // pasa del Viejo lobo
    // Niebla espesa NAV 3. Viejo lobo 3 + 1 (Diego) + 1 (Barco, NAV en el Mar) = 5, y el Destino resta 2: 3.
    expect(nav.registro).toContain('Total 3 contra 3: superas la Prueba.')
  })

  it('«Golpe de suerte»: si superas, 1 de Avance más; «Ánimo»: si superas, prepara a un comprometido', () => {
    const golpe = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'hallazgo', 'calma'] })
    golpe.zarpar('pruebas-mar5').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(golpe.avance('pruebas-mar5')).toBe(3)
    const animo = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'calma', 'racha'] })
    animo.zarpar('pruebas-mar5').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(animo.copia('viejo_lobo').agotada).toBe(false)
  })

  it('«Fallo» (✕): fallas la Prueba aunque sumes más', () => {
    const j = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'leyenda', 'calma'] })
    j.zarpar('pruebas-mar5').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(j.registro.some((t) => t.includes('fallas la Prueba (el Destino la hace fallar)'))).toBe(true)
    expect(j.avance('pruebas-mar5')).toBe(1) // Niebla espesa: −1 de Avance al fallar (sin Avance aún), +1 del encuentro (2 / 1, no la supera)
  })

  it('«Puñal escondido»: uno de los comprometidos sufre 1 herida; eliges cuál', () => {
    const j = enPuerto({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero', 'reinaldo'], mazoPeligros: ['bestias', 'rivales', 'calma'] })
    j.zarpar('pruebas-mar5').comprometer('COM', ['bucanero', 'reinaldo'])
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: 1 } })
    j.elegir('reinaldo')
    expect(j.copia('reinaldo').heridas).toBe(1)
  })
})

describe('Descartar a un Tripulante (fase 14: fuera el rehén)', () => {
  it('se va a la pila de descartes del muelle con sus Mejoras, deja libre su plaza y no cuesta reputación', () => {
    // «Leva forzosa» (COM 4) con la Vigía sola: falla y «Descarta al Tripulante asignado con menos Vida».
    const j = Jugador.enMision({ misiones: ['ladron-I'], reputacion: 2, tripulacion: [{ id: 'vigia', mejoras: ['catalejo'] }, 'bucanero'], mazoPeligros: ['p2_grilletes', 'chubasco', 'calma'] })
    const libres = j.valor({ tipo: 'capacidad' }) - 2
    j.comprometer('COM', ['vigia']).seguir().pasarOfertas()
    expect(j.zona('descartesMuelle')).toEqual(expect.arrayContaining(['vigia', 'catalejo']))
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.valor({ tipo: 'capacidad' }) - (j.zona('tripulacion').length - 1)).toBe(libres + 1)
    expect(j.estado.reputacion).toBe(2)
  })
})

describe('Retirarse y hundirse', () => {
  it('ejemplo del reglamento: si te retiras de «Rumbo a la isla» con 3 de Avance, no te llevas nada', () => {
    const j = enPuerto({ misiones: ['templo-I'], tripulacion: ['marinero_p'], mazoPeligros: ['racha', 'cazadores', 'calma'] })
    j.zarpar('templo-I').ninguna() // no agota a ningún Oficial
    expect(j.avance('templo-I')).toBe(3) // Viento de popa
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
    j.retirarse()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'conservarMision' } })
    j.opcion('fondo')
    expect(j.avance('templo-I')).toBe(0)
    expect(j.zona('mazoMisiones').at(-1)).toBe('templo-I')
    expect(j.estado.reputacion).toBe(0)
  })

  it('el Barco se hunde: heridas a todos, pierdes las Mejoras de barco salvo las indestructibles y vuelves a puerto', () => {
    const j = enPuerto({
      misiones: ['pruebas-mar5'],
      tripulacion: ['bucanero'],
      barco: { dano: 3, mejoras: ['vela', 'cruz'] },
      mazoPeligros: ['cazadores', 'chubasco', 'calma'],
    })
    // Fragata cazadora fallada sin comprometidos: Sin oposición de «Sin novedad» (nada) y 3 daños → 6 ≥ 5.
    j.zarpar('pruebas-mar5').comprometer('COM').seguir()
    expect(j.registro).toContain('¡El Barco se hunde!')
    expect(j.estado.danoBarco).toBe(0)
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.zona('mejoras')).toEqual(['cruz'])
    j.opcion('dejar')
    expect(j.estado.mision).toBeNull()
    expect(j.decision.motivo.clave).toBe('descartarFinal')
  })
})

describe('Superar una misión', () => {
  it('ejemplo del reglamento: «El Paso de los Vientos» da 1 de reputación, pone la carta 127 encima del mazo de Misiones y sale enseguida', () => {
    // Fase 12: antes era «Un soplo en Port Royal», que se ha unido a «Seguirle por los muelles». El capítulo siguiente
    // ya no se baraja: va encima del mazo de Misiones y sale al reponer las disponibles.
    const j = enPuerto({
      misiones: ['flota-I', 'prueba-I', 'aguada-I'],
      mazoMisiones: ['fantasma-I'],
      avance: { 'flota-I': 4 },
      mazoPeligros: ['calma', 'calma'],
    })
    j.zarpar('flota-I') // sin Piloto ni Marinero no hay a quién agotar al zarpar
    expect(j.avance('flota-I')).toBe(0) // «Mar en calma»: 4 + 2 = 6, superada
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('misionesSuperadas')).toEqual(['flota-I'])
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'flota-II'])
    expect(j.zona('mazoMisiones')).toEqual(['fantasma-I'])
  })

  it('el último capítulo da su Tesoro, que entra en juego sin coste', () => {
    // Fase 12: «La huida con la plata» es el capítulo IV de la Flota.
    const j = enPuerto({ misiones: ['flota-IV'], tripulacion: ['bucanero'], avance: { 'flota-IV': 3 }, mazoPeligros: ['calma'] })
    j.zarpar('flota-IV')
    expect(j.estado.reputacion).toBe(4) // fase 11: 4 de reputación (antes 5)
    expect(j.copia('mascaron').vinculadaA).toBe('barco')
    expect(j.zona('mejoras')).toContain('mascaron')
  })

  it('un Tesoro de tripulante lo lleva quien elijas', () => {
    // «El templo»: final con elección; la Espada del sacerdote es un Tesoro de tripulante.
    const j = enPuerto({ misiones: ['templo-IV'], tripulacion: ['viejo_lobo', 'bucanero'], avance: { 'templo-IV': 5 }, mazoPeligros: ['calma'], mazoHistoria: ['espada'] })
    j.zarpar('templo-IV')
    while (j.decision.motivo.clave !== 'finalMision') j.seguir()
    j.opcion('espada')
    expect(j.decision.motivo.clave).toBe('portadorTesoro')
    j.elegir('bucanero')
    expect(j.copia('espada').vinculadaA).toBe(j.inst('bucanero'))
  })

  it('fase 10b · las recompensas de las misiones iniciales: otear 3 del mazo de Misiones, adquirir o reclutar gratis', () => {
    // «Cobrar la deuda» (0 de reputación desde la fase 11): otea 3 del mazo de Misiones antes de reponer las disponibles.
    const deuda = enPuerto({ avance: { 'deuda-I': 3 }, mazoMisiones: ['templo-I', 'flota-I', 'ladron-I', 'gobernador-I'], mazoPeligros: ['calma'] })
    deuda.zarpar('deuda-I')
    expect(deuda.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'templo-I' } })
    deuda.opcion('fondo').opcion('arriba').opcion('arriba').elegir('ladron-I', 'flota-I')
    expect(deuda.estado.reputacion).toBe(0)
    // Se repone con la de arriba: el Ladrón, que ha quedado encima.
    expect(deuda.zona('misionesDisponibles')).toContain('ladron-I')
    expect(deuda.zona('mazoMisiones')).toEqual(['flota-I', 'gobernador-I', 'templo-I'])
    // «Rumbo a mar abierto» (0 y la Gesta): adquiere sin coste una Mejora del muelle de coste 1 o menos. Fase 11: con
    // precio, un Tripulante sufre 1 herida (aquí solo está Diego).
    const prueba = enPuerto({ misiones: ['prueba-I'], avance: { 'prueba-I': 3 }, muelle: ['vela', 'casco'], mazoPeligros: ['calma'] })
    prueba.zarpar('prueba-I').elegir('vela')
    expect(prueba.zona('mejoras')).toEqual(['vela'])
    expect(prueba.estado.reputacion).toBe(1) // 0 de la recompensa y 1 de la Gesta
    expect(prueba.copia('capitan').heridas).toBe(1)
    // «Agua y leña» (0): recluta sin coste un Tripulante del muelle de coste 2 o menos, si cabe. Fase 11: con precio, el
    // Barco sufre 1 daño, también en esta misión de Naturaleza (como en la medida I2 de la fase 10c).
    const aguada = enPuerto({ avance: { 'aguada-I': 3 }, muelle: ['bucanero', 'contrabandista'], mazoPeligros: ['calma'], tripulacion: ['vigia'] })
    aguada.zarpar('aguada-I').elegir('bucanero') // Distancia 1 − 1 del Barco: 0, no se agota a nadie (P3)
    expect(aguada.zona('tripulacion')).toContain('bucanero')
    expect(aguada.estado.reputacion).toBe(0)
    expect(aguada.estado.danoBarco).toBe(1)
  })

  it('«Las puertas de Panamá»: ¡victoria! (sin fichas de Defensa)', () => {
    // Pelea de taberna (COM 3): Diego la supera justo y «Ánimo» lo prepara para la siguiente. Cada una quita 1 Defensa.
    const peleas = ['rivales', 'calma', 'rivales', 'calma', 'rivales', 'calma', 'calma']
    const j = enPuerto({ misiones: ['panama-III'], reputacion: 6, avance: { 'panama-III': 5 }, mazoPeligros: peleas })
    j.zarpar('panama-III')
    expect(j.estado.mision?.fichas?.defensa).toBe(3)
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.estado.mision?.fichas?.defensa).toBe(2)
    expect(j.estado.resultado).toBeNull() // 7 de 5 de Avance, pero quedan fichas de Defensa
    j.seguir().comprometer('COM', ['capitan']).seguir().seguir().comprometer('COM', ['capitan']).seguir()
    expect(j.estado.resultado).toEqual({ gana: true, motivo: 'Has superado «Las puertas de Panamá».' })
  })

  it('ejemplo del reglamento: en el último turno, con 9 de reputación, «La goleta del correo» da 3 y ganas', () => {
    // Fase 12: «La goleta del correo» es el capítulo II del espía y da 3.
    const j = Jugador.en({
      empezarEn: 'quedarseOZarpar',
      escenario: [],
      reputacion: 9,
      misiones: ['espia-II'],
      tripulacion: ['viejo_lobo'],
      avance: { 'espia-II': 2 },
      mazoPeligros: ['racha', 'calma'],
    })
    j.zarpar('espia-II') // Viento de popa: 2 + 3 = 5
    expect(j.estado.resultado).toEqual({ gana: true, motivo: 'Has llegado a 12 de reputación.' })
  })
})

describe('D5a · Superar al reunir el Avance; la primera carta se resuelve siempre', () => {
  it('aunque empieces con el Avance suficiente, resuelves la primera carta antes de superarla', () => {
    const j = enPuerto({ avance: { 'deuda-I': 3 }, tripulacion: ['bucanero'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.zarpar('deuda-I')
    expect(j.decision.motivo.clave).toBe('comprometer') // Pelea de taberna: hay que resolverla
    j.comprometer('COM', ['bucanero']).seguir().resolverOteo()
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I'])
  })

  it('a partir de la segunda carta, si el Avance llega a mitad de un encuentro, la superas sin resolverlo', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.avanceAlRevelar',
      carta: 'capitan',
      ventana: 'respuesta',
      desde: 'juego',
      disparo: (_s, _yo, ev) => ev.tipo === 'revelarPeligro',
      efecto: () => [{ tipo: 'ganarAvance', n: 2 }],
    } satisfies Capacidad)
    const j = enPuerto({ misiones: ['pruebas-mar5'], mazoPeligros: ['racha', 'leyenda', 'calma'] })
    j.zarpar('pruebas-mar5')
    j.pasar() // primera carta: no usamos la Respuesta
    expect(j.avance('pruebas-mar5')).toBe(3) // Viento de popa
    j.seguir() // revela el Kraken
    j.usar('prueba.avanceAlRevelar') // +2 → 5: superada sin enfrentarse al Kraken
    expect(j.zona('misionesSuperadas')).toEqual(['pruebas-mar5'])
    expect(j.registro).toContain('Reúnes el Avance a mitad del encuentro: lo dejas sin resolver.')
    expect(j.zona('descartesPeligros')).toContain('leyenda')
  })
})

describe('D5b · Una carta descartada sin resolverla no cuenta como resuelta', () => {
  it('se revela otra y la misión no se supera hasta resolver una', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.descartarAlRevelar',
      carta: 'capitan',
      ventana: 'respuesta',
      desde: 'juego',
      limite: { veces: 1, por: 'turno' },
      disparo: (_s, _yo, ev) => ev.tipo === 'revelarPeligro',
      efecto: (s) => {
        const carta = s.zonas.encuentro[0]
        if (carta) {
          s.zonas.encuentro = []
          s.zonas.descartesPeligros.unshift(carta)
        }
        return []
      },
    } satisfies Capacidad)
    const j = enPuerto({ avance: { 'deuda-I': 3 }, mazoPeligros: ['rivales', 'calma', 'chubasco'] })
    j.zarpar('deuda-I')
    j.usar('prueba.descartarAlRevelar').resolverOteo() // descarta la Pelea de taberna sin resolverla
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I']) // se resolvió «Hora de la siesta»
    expect(j.registro.filter((t) => t.startsWith('Revelas'))).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Fase 12 (Albert): al superar un capítulo, el siguiente va siempre encima del mazo de Misiones (sin barajar ni elegir)
// y después se reponen las misiones disponibles, así que sale enseguida.

/** Pasa al «¿te quedas o zarpas?» del turno siguiente sin hacer nada más. */
function hastaElSiguienteZarpe(j: Jugador): void {
  const turno = j.estado.turno
  for (let n = 0; n < 40 && !(j.decision.motivo.clave === 'quedarseOZarpar' && j.estado.turno > turno); n++) {
    const d = j.decision
    if (d.motivo.clave === 'descartarFinal') j.ninguna()
    else if (d.tipo === 'ofrecer') j.pasar()
    else j.terminar()
  }
}

describe('Fase 12 · el capítulo siguiente va encima del mazo de Misiones', () => {
  const superarPasoDeLosVientos = (mazoMisiones: string[]) => {
    const j = enPuerto({
      misiones: ['flota-I', 'prueba-I', 'aguada-I'],
      mazoMisiones,
      avance: { 'flota-I': 4 },
      mazoPeligros: ['calma', 'calma'],
      escenario: ['pruebas-calma', 'pruebas-calma'],
    })
    j.zarpar('flota-I')
    return j
  }

  it('primero va encima del mazo y después se reponen las disponibles: el mazo no cambia', () => {
    const j = superarPasoDeLosVientos(['fantasma-I', 'templo-I'])
    const encima = j.registro.indexOf('«El galeón rezagado» se pone encima del mazo de Misiones.')
    const sale = j.registro.indexOf('Nueva misión disponible: «El galeón rezagado».')
    expect(encima).toBeGreaterThanOrEqual(0)
    expect(sale).toBeGreaterThan(encima)
    expect(j.registro.some((t) => t.includes('se baraja en el mazo de Misiones'))).toBe(false)
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'flota-II'])
    expect(j.zona('mazoMisiones')).toEqual(['fantasma-I', 'templo-I'])
  })

  it('con el mazo de Misiones vacío, el capítulo pasa a ser el mazo y sale igual', () => {
    const j = superarPasoDeLosVientos([])
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'flota-II'])
    expect(j.zona('mazoMisiones')).toEqual([])
  })

  it('salida doble: el capítulo que toca va encima y sale; el otro se queda en el mazo de historia (fase 15)', () => {
    const j = enPuerto({ misiones: ['maracaibo-I', 'prueba-I', 'aguada-I'], mazoMisiones: ['fantasma-I'], tripulacion: ['viejo_lobo'], avance: { 'maracaibo-I': 2 }, mazoPeligros: ['calma', 'calma'] })
    j.zarpar('maracaibo-I').cubrir('viejo_lobo')
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'maracaibo-II-a'])
    expect(j.zona('mazoMisiones')).toEqual(['fantasma-I'])
    expect(j.zona('mazoHistoria')).toContain('maracaibo-II-b')
    expect(j.zona('fueraDeJuego')).toEqual([])
    expect(j.registro).toContain('«Romper el bloqueo» se queda en el mazo de historia.')
  })

  it('no obliga a zarpar a él: en el turno siguiente, el Tablón de encargos lo manda al fondo y sale la de arriba', () => {
    const j = superarPasoDeLosVientos(['fantasma-I', 'templo-I'])
    hastaElSiguienteZarpe(j)
    expect(opcionesDeZarpar(j)).toContain('flota-II')
    j.opcion('quedarse').opcion('tablon').elegir('flota-II')
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'fantasma-I'])
    expect(j.zona('mazoMisiones')).toEqual(['templo-I', 'flota-II'])
  })
})
