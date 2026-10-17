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
  return Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['calma_ev'], mazoCapitan: [...MAZO_CAPITAN], ...op })
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

  it('«Las puertas de Panamá» solo con 9 de reputación o más', () => {
    const tripulacion = ['viejo_lobo', 'contrabandista']
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-III'], tripulacion, reputacion: 8 }))).toEqual([])
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-III'], tripulacion, reputacion: 9 }))).toEqual(['panama-III'])
  })

  it('no se ofrece una misión lejana si no se puede cubrir su Distancia', () => {
    // «La selva»: Distancia 3, 2 con el Barco. Diego solo tiene NAV 2: llega justo.
    expect(opcionesDeZarpar(enPuerto({ misiones: ['templo-II'] }))).toEqual(['templo-II'])
    expect(opcionesDeZarpar(enPuerto({ misiones: ['panama-II'], capitan: { agotada: true } }))).toEqual([])
  })

  it('ejemplo del reglamento: «La selva» se cubre con el Viejo lobo, o con el Bucanero mientras Diego está preparado', () => {
    const conLobo = enPuerto({ misiones: ['templo-II'], tripulacion: ['viejo_lobo', 'bucanero'], mazoPeligros: ['calma'] })
    conLobo.zarpar('templo-II')
    expect(conLobo.decision).toMatchObject({ tipo: 'cubrirDistancia', distancia: 2 })
    conLobo.cubrir('viejo_lobo')
    expect(conLobo.copia('viejo_lobo').agotada).toBe(true)
    expect(conLobo.copia('capitan').agotada).toBe(false)

    const sinLobo = enPuerto({ misiones: ['templo-II'], tripulacion: ['bucanero'], mazoPeligros: ['calma'] })
    sinLobo.zarpar('templo-II').cubrir('bucanero') // NAV 1 + 1 por Diego = 2
    expect(sinLobo.copia('bucanero').agotada).toBe(true)
    expect(sinLobo.registro).toContain('Cubres la Distancia 2: agotas a Bucanero veterano.')
  })

  it('no vale una combinación que no llega; las cartas con NAV completan la diferencia', () => {
    const j = enPuerto({ misiones: ['templo-II'], tripulacion: ['marinero_p'], mano: ['timon'], mazoPeligros: ['calma'] })
    j.zarpar('templo-II')
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
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I'])
  })

  it('Al zarpar: «Si tienes un Vigía preparado, gana 1»', () => {
    const conVigia = enPuerto({ misiones: ['ladron-I'], tripulacion: ['vigia'], mazoPeligros: ['chubasco', 'calma'] })
    conVigia.zarpar('ladron-I')
    expect(conVigia.registro).toContain('Tienes un Vigía preparado: +1 de Avance (1/4).')
  })

  it('Al zarpar opcional: «Agota a un Oficial para ganar 2» (puedes no hacerlo)', () => {
    const j = enPuerto({ misiones: ['templo-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['racha', 'racha'] })
    j.zarpar('templo-I')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 0, max: 1, motivo: { clave: 'alZarparAgotar', n: 2 } })
    j.elegir('viejo_lobo')
    expect(j.copia('viejo_lobo').agotada).toBe(true)
    expect(j.registro).toContain('Agotas a Viejo lobo de mar: +2 de Avance (2/5).')
  })

  it('Al zarpar opcional: «Descarta 2 cartas para ganar 2»', () => {
    const j = enPuerto({ misiones: ['espia-II'], tripulacion: ['viejo_lobo'], mano: ['ojo', 'timon', 'coraje'], mazoPeligros: ['calma', 'calma'] })
    j.zarpar('espia-II').cubrir('viejo_lobo')
    j.opcion('si').elegir('ojo', 'coraje')
    expect(j.registro).toContain('Al zarpar: +2 de Avance (2/4).')
    expect(j.zona('mano')).toEqual(['timon'])
  })

  it('Al zarpar: «Si tienes 3 o más Tripulantes preparados, gana 2», y el mazo de la Escolta mezclado con 6 Peligros', () => {
    const peligros = ['racha', 'racha', 'hallazgo', 'calma', 'encrucijada', 'oportunidad', 'chubasco']
    const j = enPuerto({ misiones: ['flota-II'], tripulacion: ['marinero_p', 'bucanero'], mazoPeligros: peligros })
    j.zarpar('flota-II')
    expect(j.registro).toContain('Tienes 3 o más Tripulantes preparados: +2 de Avance (2/5).')
    // Mazo propio (6) + 6 del mazo de Peligros; uno ya se ha revelado.
    expect(j.zona('mazoMision').length + j.zona('encuentro').length + j.zona('descartesMision').length).toBe(12)
    expect(j.zona('mazoPeligros')).toEqual(['chubasco'])
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
    expect(j.registro).toContain('Destino: «Sin novedad» (+0).')
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
    expect(j.registro).toContain('Total 0 contra 3: fallas la Prueba (nadie comprometido).')
  })

  it('sin refuerzo: las cartas de la mano solo se añaden al comprometer; en la ventana de acción ya no se descartan por sus iconos', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], mano: ['abordaje'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    j.zarpar('fantasma-I').comprometer('COM', ['capitan'])
    expect(j.decision.motivo.clave).toBe('ventanaPrueba')
    const acciones = (j.decision as { acciones: { tipo: string }[] }).acciones.map((a) => a.tipo)
    expect(acciones).toEqual(['terminarPaso'])
    j.seguir()
    expect(j.registro).toContain('Total 3 contra 3: superas la Prueba.')
    expect(j.zona('mano')).toEqual(['abordaje'])
    const conCarta = enPuerto({ misiones: ['fantasma-I'], mano: ['abordaje'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    conCarta.zarpar('fantasma-I').comprometer('COM', ['capitan'], ['abordaje']).seguir()
    expect(conCarta.registro).toContain('Total 5 contra 3: superas la Prueba.')
  })

  it('el Avance del encuentro se gana se supere o no la Prueba', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    j.zarpar('fantasma-I').comprometer('COM').seguir() // Tiburón tigre fallado sin comprometidos: 2 heridas a un Tripulante
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.avance('fantasma-I')).toBe(2)
  })
})

describe('Destinos', () => {
  it('«Alarma»: +2 si el encuentro es Militar o Guardia', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['bucanero', 'reinaldo'], mazoPeligros: ['ley', 'ley', 'calma'] })
    j.zarpar('fantasma-I').comprometer('COM', ['bucanero', 'reinaldo']).seguir()
    // Patrulla española (Barco, Militar) COM 4 + 2 = 6. Bucanero 3 + Rodrigo 5 = 8.
    expect(j.registro).toContain('Total 8 contra 6: superas la Prueba.')
  })

  it('«Corriente traicionera»: +2 si la Prueba es de NAV; si no, +1', () => {
    const nav = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'arrecifes', 'calma'] })
    nav.zarpar('fantasma-I').comprometer('NAV', ['viejo_lobo']).pasar().seguir() // pasa del Viejo lobo
    // Niebla espesa NAV 3 + 2. Viejo lobo 3 + 1 (Diego) + 1 (Barco, NAV en el Mar) = 5.
    expect(nav.registro).toContain('Total 5 contra 5: superas la Prueba.')
  })

  it('«Golpe de suerte»: si superas, 1 de Avance más; «Ánimo»: si superas, prepara a un comprometido', () => {
    const golpe = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'hallazgo', 'calma'] })
    golpe.zarpar('fantasma-I').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(golpe.avance('fantasma-I')).toBe(3)
    const animo = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'calma', 'racha'] })
    animo.zarpar('fantasma-I').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(animo.copia('viejo_lobo').agotada).toBe(false)
  })

  it('«Fallo» (✕): fallas la Prueba aunque sumes más', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'leyenda', 'calma'] })
    j.zarpar('fantasma-I').comprometer('NAV', ['viejo_lobo']).pasar().seguir()
    expect(j.registro.some((t) => t.includes('fallas la Prueba (el Destino la hace fallar)'))).toBe(true)
    expect(j.avance('fantasma-I')).toBe(2) // Niebla espesa: −1 de Avance al fallar (sin Avance aún), +2 del encuentro
  })

  it('«Puñal escondido»: uno de los comprometidos sufre 1 herida; eliges cuál', () => {
    const j = enPuerto({ misiones: ['fantasma-I'], tripulacion: ['bucanero', 'reinaldo'], mazoPeligros: ['bestias', 'rivales', 'calma'] })
    j.zarpar('fantasma-I').comprometer('COM', ['bucanero', 'reinaldo'])
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: 1 } })
    j.elegir('reinaldo')
    expect(j.copia('reinaldo').heridas).toBe(1)
  })
})

describe('Rehenes', () => {
  it('el rehén sale de entre los comprometidos, sigue ocupando Capacidad y se rescata si superas la misión', () => {
    const j = enPuerto({ misiones: ['aguada-I'], tripulacion: ['marinero_p', 'grumete', 'bucanero', 'carpintero'], mazoPeligros: ['rivales', 'chubasco', 'racha'] })
    j.zarpar('aguada-I')
    // Bandoleros (COM 3): el Grumete suma 1 + 1 = 2; Destino «Sin novedad». Fallas: el Grumete es capturado.
    j.comprometer('COM', ['grumete']).seguir()
    expect(j.zona('rehenes')).toEqual(['grumete'])
    // Capacidad 4 llena: 3 Tripulantes y el rehén, que sigue ocupando su plaza.
    expect(j.zona('tripulacion').filter((c) => c !== 'capitan').length + j.zona('rehenes').length).toBe(4)
    expect(j.valor({ tipo: 'capacidad' })).toBe(4)
    j.seguir() // Manantial: +1 → 3/3
    expect(j.zona('misionesSuperadas')).toEqual(['aguada-I'])
    expect(j.zona('tripulacion')).toContain('grumete')
    expect(j.zona('rehenes')).toEqual([])
  })

  it('si no la superas, pierdes al rehén con sus Mejoras y 1 de reputación; su Tesoro pasa a otro (N1)', () => {
    const j = enPuerto({
      misiones: ['aguada-I'],
      reputacion: 2,
      tripulacion: [{ id: 'grumete', mejoras: ['espada'] }],
      mazoPeligros: ['rivales', 'leyenda', 'calma'],
    })
    j.zarpar('aguada-I')
    j.comprometer('COM', ['grumete']).pasar().seguir() // Destino «Fallo» (no lo cancela con la Espada): fallas; el Grumete es capturado
    expect(j.zona('rehenes')).toEqual(['grumete'])
    j.retirarse().opcion('dejar')
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('fueraDeJuego')).toContain('grumete')
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
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
      misiones: ['fantasma-I'],
      tripulacion: ['bucanero'],
      barco: { dano: 3, mejoras: ['vela', 'cruz'] },
      mazoPeligros: ['cazadores', 'chubasco', 'calma'],
    })
    // Fragata cazadora fallada sin comprometidos: Sin oposición de «Sin novedad» (nada) y 3 daños → 6 ≥ 5.
    j.zarpar('fantasma-I').comprometer('COM').seguir()
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
  it('ejemplo del reglamento: «Un soplo en Port Royal» da 1 de reputación y baraja la carta 136 en el mazo de Misiones', () => {
    const j = enPuerto({
      misiones: ['espia-I', 'prueba-I', 'aguada-I'],
      mazoMisiones: ['fantasma-I'],
      tripulacion: ['viejo_lobo', 'contrabandista'],
      avance: { 'espia-I': 2 },
      mazoPeligros: ['calma', 'calma'],
    })
    j.zarpar('espia-I').cubrir('viejo_lobo')
    j.elegir('contrabandista') // Al zarpar: agota a un Contrabandista para ganar 2 → 4
    expect(j.estado.reputacion).toBe(1)
    expect(j.zona('misionesSuperadas')).toEqual(['espia-I'])
    expect([...j.zona('misionesDisponibles'), ...j.zona('mazoMisiones')].sort()).toEqual(['aguada-I', 'espia-II', 'fantasma-I', 'prueba-I'])
    expect(j.zona('misionesDisponibles')).toHaveLength(3)
  })

  it('el capítulo III da su Tesoro, que entra en juego sin coste', () => {
    const j = enPuerto({ misiones: ['flota-III'], tripulacion: ['bucanero'], avance: { 'flota-III': 4 }, mazoPeligros: ['calma'] })
    j.zarpar('flota-III')
    expect(j.estado.reputacion).toBe(4)
    expect(j.copia('mascaron').vinculadaA).toBe('barco')
    expect(j.zona('mejoras')).toContain('mascaron')
  })

  it('un Tesoro de tripulante lo lleva quien elijas', () => {
    const j = enPuerto({ misiones: ['templo-III'], tripulacion: ['viejo_lobo', 'bucanero'], avance: { 'templo-III': 5 }, mazoPeligros: ['calma'] })
    j.zarpar('templo-III').cubrir('viejo_lobo')
    while (j.decision.motivo.clave !== 'portadorTesoro') j.seguir()
    j.elegir('bucanero')
    expect(j.copia('espada').vinculadaA).toBe(j.inst('bucanero'))
  })

  it('las recompensas de las misiones iniciales: buscar un Tripulante, una Mejora de barco o robar 2', () => {
    const deuda = enPuerto({ avance: { 'deuda-I': 3 }, mazoMuelle: ['bucanero', 'vela'], mazoPeligros: ['calma'] })
    deuda.zarpar('deuda-I').elegir('bucanero')
    expect(deuda.zona('muelle')).toEqual(['bucanero'])
    const aguada = enPuerto({ avance: { 'aguada-I': 3 }, mazoPeligros: ['calma'], mano: [] })
    aguada.zarpar('aguada-I')
    expect(aguada.zona('mano')).toHaveLength(2)
  })

  it('«Las puertas de Panamá»: ¡victoria!', () => {
    const j = enPuerto({ misiones: ['panama-III'], reputacion: 9, tripulacion: ['viejo_lobo', 'contrabandista'], avance: { 'panama-III': 7 }, mazoPeligros: ['calma'] })
    j.zarpar('panama-III').cubrir('viejo_lobo', 'contrabandista')
    expect(j.estado.resultado).toEqual({ gana: true, motivo: 'Has superado «Las puertas de Panamá».' })
  })

  it('ejemplo del reglamento: en el último turno, con 15 de reputación, «La goleta del correo» da 4 y ganas', () => {
    const j = Jugador.en({
      empezarEn: 'quedarseOZarpar',
      escenario: [],
      reputacion: 15,
      misiones: ['espia-III'],
      tripulacion: ['viejo_lobo'],
      avance: { 'espia-III': 2 },
      mazoPeligros: ['racha', 'calma'],
    })
    j.zarpar('espia-III')
    expect(j.estado.resultado).toEqual({ gana: true, motivo: 'Has llegado a 19 de reputación.' })
  })
})

describe('D5a · Superar al reunir el Avance; la primera carta se resuelve siempre', () => {
  it('aunque empieces con el Avance suficiente, resuelves la primera carta antes de superarla', () => {
    const j = enPuerto({ avance: { 'deuda-I': 3 }, tripulacion: ['bucanero'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.zarpar('deuda-I')
    expect(j.decision.motivo.clave).toBe('comprometer') // Pelea de taberna: hay que resolverla
    j.comprometer('COM', ['bucanero']).seguir()
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
    const j = enPuerto({ misiones: ['fantasma-I'], mazoPeligros: ['racha', 'leyenda', 'calma'] })
    j.zarpar('fantasma-I')
    j.pasar() // primera carta: no usamos la Respuesta
    expect(j.avance('fantasma-I')).toBe(3) // Viento de popa
    j.seguir() // revela el Kraken
    j.usar('prueba.avanceAlRevelar') // +2 → 5: superada sin enfrentarse al Kraken
    expect(j.zona('misionesSuperadas')).toEqual(['fantasma-I'])
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
    j.usar('prueba.descartarAlRevelar') // descarta la Pelea de taberna sin resolverla
    expect(j.zona('misionesSuperadas')).toEqual(['deuda-I']) // se resolvió «Hora de la siesta»
    expect(j.registro.filter((t) => t.startsWith('Revelas'))).toHaveLength(2)
  })
})
