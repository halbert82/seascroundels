// Una prueba por cada decisión de reglas de docs/decisiones.md, con el ejemplo de juego de cada una.

import { afterEach, describe, expect, it } from 'vitest'
import { registrarParaPruebas } from './capacidades/index.ts'
import { desgloseDificultad, desgloseTotal, dificultadPrueba, totalPrueba } from './prueba.ts'
import { Jugador, type OpcionesSituacion, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import { navParaDistancia } from './valores.ts'
import type { Capacidad } from './tipos.ts'

/**
 * «Cada efecto de fallo inflige además 1 herida» (D2b, D2c, N15). Ninguna misión 2.0 lo tiene ya, pero la regla sigue
 * en el motor: se prueba con una regla de mentira en una misión de prueba.
 */
function heridaExtraEn(mision: string): Capacidad {
  return { clave: 'prueba.heridaExtra', carta: mision, ventana: 'constante', desde: 'mision', modifica: (_ctx, _yo, c) => (c.tipo === 'heridaExtraFallo' ? 1 : 0) }
}

/** En una misión ya empezada: zarpa (cubriendo la Distancia si hace falta) y se para en la primera decisión. */
function enMision(op: OpcionesSituacion & { cubrir?: string[] }): Jugador {
  const { cubrir, ...resto } = op
  const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma'], mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje'], ...resto })
  const mision = resto.misiones?.[0] ?? 'deuda-I'
  j.zarpar(mision)
  if (cubrir) j.cubrir(...cubrir)
  return j
}

let quitar: (() => void) | null = null
afterEach(() => {
  quitar?.()
  quitar = null
})

describe('D1a · «Mientras esté preparado» se pierde al agotarse, también a la vez', () => {
  it('Diego y el Rufián agotados juntos para cubrir «El prisionero de Portobelo» (Distancia 2 con el Barco) suman 2', () => {
    const j = Jugador.en({ tripulacion: ['marinero_p'], misiones: ['panama-I'] })
    expect(j.valor({ tipo: 'distancia', mision: j.inst('panama-I') })).toBe(2)
    expect(navParaDistancia(j.estado, [j.estado.capitan, j.inst('marinero_p')])).toBe(2)
  })

  it('si Diego se queda preparado, el Bucanero y el Grumete reciben su +1 y suman 4', () => {
    const j = Jugador.en({ tripulacion: ['bucanero', 'grumete'] })
    expect(navParaDistancia(j.estado, [j.inst('bucanero'), j.inst('grumete')])).toBe(4)
  })

  it('en una Prueba: Diego (NAV 2) y el Bucanero (NAV 1) comprometidos juntos suman 3', () => {
    // Riada (Naturaleza): NAV 4. En tierra, el Barco no suma.
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma'], misiones: ['aguada-I'], tripulacion: ['bucanero'], mazoPeligros: ['temporal', 'chubasco', 'calma'] })
    j.zarpar('aguada-I').comprometer('NAV', ['capitan', 'bucanero']).seguir()
    expect(j.registro).toContain('Total 3 contra 4: fallas la Prueba.')
  })
})

describe('D7 · Los cambios a «las Distancias» solo afectan a las misiones lejanas', () => {
  // Fase 8: ninguna carta de Escenario cambia ya las Distancias de las misiones lejanas (ver la prueba de los Vientos
  // alisios y la Temporada de huracanes); la regla se sigue viendo con Velas rotas.
  it('con Velas rotas, «La selva» sube 1 y «Cobrar la deuda» y «Rumbo a mar abierto» siguen en 0', () => {
    const sin = Jugador.en({ misiones: ['templo-II', 'deuda-I', 'prueba-I'] })
    const con = Jugador.en({ misiones: ['templo-II', 'deuda-I', 'prueba-I'], barco: { estados: ['velasRotas'] } })
    expect(con.valor({ tipo: 'distancia', mision: con.inst('templo-II') })).toBe(sin.valor({ tipo: 'distancia', mision: sin.inst('templo-II') }) + 1)
    expect(con.valor({ tipo: 'distancia', mision: con.inst('deuda-I') })).toBe(0)
    expect(con.valor({ tipo: 'distancia', mision: con.inst('prueba-I') })).toBe(0)
  })
})

describe('D8 · Perder o agotar una Mejora que sube un máximo se comprueba al momento', () => {
  it('Hamacas: con 5 Tripulantes y sin las Hamacas, despides a uno al momento', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['impuestos', 'pruebas-calma'],
      barco: { mejoras: ['hamacas'] },
      tripulacion: ['marinero_p', 'grumete', 'bucanero', 'carpintero', 'saqueador'],
    })
    expect(j.registro).toContain('Pierdes «Hamacas en el entrepuente».')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 1, max: 1, motivo: { clave: 'exceso', n: 1 } })
    j.elegir('grumete')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'marinero_p', 'bucanero', 'carpintero', 'saqueador'])
    expect(j.zona('descartesMuelle')).toEqual(['grumete', 'hamacas'])
  })

  it('Coleto: un Bucanero con Coleto (Vida 3) y 2 heridas que pierde el Coleto queda derrotado', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['impuestos', 'pruebas-calma'],
      tripulacion: [{ id: 'bucanero', heridas: 2, mejoras: ['coleto'] }],
    })
    expect(j.zona('tripulacion')).toEqual(['capitan'])
    expect(j.zona('descartesMuelle').sort()).toEqual(['bucanero', 'coleto'])
    expect(j.registro).toContain('Bucanero veterano queda derrotado.')
  })

  it('Casco: con 5 daños, perder el Casco hunde el Barco en puerto (heridas a todos, se reflota)', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['impuestos', 'pruebas-calma'],
      barco: { dano: 5, mejoras: ['casco'] },
      tripulacion: ['bucanero'],
    })
    expect(j.registro).toContain('¡El Barco se hunde!')
    expect(j.estado.danoBarco).toBe(0)
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.zona('descartesMuelle')).toEqual(['casco'])
  })

  it('si el Capitán queda derrotado, pierdes la partida', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['impuestos', 'pruebas-calma'], capitan: { heridas: 4, mejoras: ['coleto'] } })
    expect(j.estado.resultado).toEqual({ gana: false, motivo: 'Tu Capitán ha quedado derrotado.' })
  })
})

describe('D12 · Una partida normal dura 12 turnos', () => {
  it('el turno 12 se juega sin carta de Escenario y al terminarlo se pierde', () => {
    const j = Jugador.partida({ semilla: 5 })
    j.ninguna()
    let turnos = 0
    while (!j.estado.resultado && turnos < 20) {
      // Responde a lo que pidan las cartas de Escenario (buscar, perder Mejora, Deserción…).
      while (j.estado.pendiente && j.decision.motivo.clave !== 'jugarCartas') {
        const d = j.decision
        if (d.tipo === 'elegirCartas') j.responder({ tipo: 'cartas', ids: d.candidatas.slice(0, d.min) })
        else if (d.tipo === 'elegirOpcion') j.opcion(d.opciones[0]?.clave ?? '')
        else if (d.tipo === 'ofrecer') j.pasar()
        else if (d.tipo === 'ventanaAccion') j.terminar()
        else break
      }
      if (j.estado.resultado) break
      expect(j.estado.ultimoTurno).toBe(j.estado.turno === 12)
      j.pasarTurnoEnPuerto()
      turnos++
    }
    expect(j.estado.turno).toBe(12)
    expect(j.estado.resultado).toEqual({ gana: false, motivo: 'Se ha acabado el tiempo: no quedaban cartas de Escenario.' })
  })

  it('perder días acorta la partida', () => {
    const j = Jugador.en({ empezarEn: 'final', turno: 10, escenario: ['pruebas-calma'], mano: [], descartesCapitan: ['ojo', 'timon'] })
    j.ninguna() // Robar con el mazo vacío: se pierde el último día.
    expect(j.zona('mazoEscenario')).toEqual([])
    expect(j.estado.turno).toBe(11)
    expect(j.estado.ultimoTurno).toBe(true)
  })
})

describe('N1 · Un Tesoro nunca acaba en el mazo de muelle', () => {
  it('al despedir a su portador, el Tesoro pasa al Tripulante que elijas', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['espada'] }, 'marinero_p'] })
    j.despedir('bucanero').elegir('marinero_p')
    expect(j.copia('espada').vinculadaA).toBe(j.inst('marinero_p'))
    expect(j.zona('descartesMuelle')).toEqual(['bucanero'])
  })
  it('al volver al muelle (ninguna carta de la caja lo hace: se prueba con una capacidad de prueba)', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.volver',
      carta: 'marinero_p',
      ventana: 'libre',
      desde: 'juego',
      efecto: (s) => [{ tipo: 'volverAlMuelle', carta: s.zonas.tripulacion.find((c) => s.cartas[c]?.id === 'bucanero') ?? s.capitan }],
    })
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['espada', 'sable'] }, 'marinero_p'] })
    j.usar('prueba.volver').elegir('capitan')
    expect(j.zona('muelle')).toEqual(expect.arrayContaining(['bucanero', 'sable']))
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
  })
})

describe('N3 (fase 10b: sin munición) · Los Cañones entran en juego preparados', () => {
  it('adquieres los Cañones y zarpas contra los Piratas rivales (COM 4): ya puedes agotarlos para +2', () => {
    const j = Jugador.en({ mano: ['ojo', 'timon'], muelle: ['bronce'], misiones: ['prueba-I'], mazoPeligros: ['rivales', 'chubasco', 'calma'], escenario: ['pruebas-calma'] })
    j.adquirir('bronce', 'barco').elegir('ojo', 'timon')
    expect(j.copia('bronce').agotada).toBe(false)
    j.zarpar('prueba-I').comprometer('COM', ['capitan']).usar('bronce.disparar').seguir()
    expect(j.registro).toContain('Total 5 contra 4: superas la Prueba.')
    expect(j.copia('bronce').agotada).toBe(true)
  })
})

describe('N4 · La pausa del Inicio va al final del paso, después de preparar', () => {
  it('el Carpintero usado en la pausa del Inicio se queda agotado en Jugar cartas', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.carpintero',
      carta: 'carpintero',
      ventana: 'libre',
      desde: 'juego',
      coste: [{ tipo: 'agotarse' }],
      efecto: () => [{ tipo: 'reparar', n: 1 }],
    })
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['pruebas-calma', 'pruebas-calma'], tripulacion: ['carpintero'], barco: { dano: 3 } })
    expect(j.decision.motivo.clave).toBe('pausa.inicio')
    j.usar('prueba.carpintero')
    expect(j.estado.danoBarco).toBe(2)
    expect(j.decision.motivo.clave).toBe('jugarCartas')
    expect(j.copia('carpintero').agotada).toBe(true)
    expect(j.ofrece('usar', 'prueba.carpintero')).toBe(false)
  })
})

describe('D1b · La rebaja por Rasgo se mantiene aunque ese Tripulante se comprometa', () => {
  it('Arrecife de los Ahorcados (NAV 4, Vigía −2): comprometer a Íñigo deja la dificultad en 2', () => {
    const j = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bartolome'], mazoPeligros: ['arrecifes', 'chubasco', 'calma'] })
    j.pasar() // No descarta el Arrecife con Íñigo.
    j.comprometer('NAV', ['bartolome']).seguir()
    // Íñigo: NAV 0 + 1 (Diego) + 1 (Barco en el Mar) = 2 contra 2.
    expect(j.registro).toContain('Total 2 contra 2: superas la Prueba.')
  })
})

describe('D2 · Heridas de un fallo', () => {
  // Fase 10 (heridas libres; sustituye a D2a y N6): las heridas de un fallo se reparten como quiera el jugador entre
  // todos sus Tripulantes, preparados o agotados, Capitán incluido, haya asignado a alguien o no.
  it('heridas libres: sin asignados, «1 · 1» y «2» se reparten como quieras entre todos tus Tripulantes', () => {
    const j = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero'], mazoPeligros: ['fiebre', 'chubasco', 'calma'] })
    j.comprometer('EXP').seguir() // Escorbuto fallado: 1 herida · 1 herida
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 2, motivo: { clave: 'heridas', n: 2 } })
    j.repartir({ capitan: 1, bucanero: 1 })
    expect([j.copia('capitan').heridas, j.copia('bucanero').heridas]).toEqual([1, 1])
    const tigre = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    tigre.comprometer('COM').seguir() // Tiburón tigre: 2 heridas, también a dos Tripulantes
    expect(tigre.decision).toMatchObject({ tipo: 'repartir', cantidad: 2 })
    tigre.repartir({ capitan: 1, bucanero: 1 })
    expect([tigre.copia('capitan').heridas, tigre.copia('bucanero').heridas]).toEqual([1, 1])
  })

  it('heridas libres: con asignados, las heridas del fallo pueden ir a un Tripulante que no se asignó', () => {
    const j = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero'], mazoPeligros: ['fiebre', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['bucanero']).seguir() // Escorbuto fallado con el Bucanero asignado: 1 herida · 1 herida
    expect(Object.keys(j.decision.tipo === 'repartir' ? j.decision.maximos : {}).length).toBe(2)
    j.repartir({ capitan: 2 })
    expect([j.copia('capitan').heridas, j.copia('bucanero').heridas]).toEqual([2, 0])
  })

  it('D2b · con «cada efecto de fallo inflige además 1 herida», fallar la Fiebre amarilla («1 · 1») son 3 heridas en total', () => {
    quitar = registrarParaPruebas(heridaExtraEn('pruebas-nat3'))
    const j = enMision({ misiones: ['pruebas-nat3'], tripulacion: ['viejo_lobo'], mazoPeligros: ['fiebre', 'calma', 'calma'] })
    j.comprometer('EXP').seguir()
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 3 })
    j.repartir({ capitan: 3 })
    expect(j.copia('capitan').heridas).toBe(3)
  })

  it('D2c · un recuadro rojo vacío no da herida extra («Un soplo en la taberna»)', () => {
    quitar = registrarParaPruebas(heridaExtraEn('pruebas-ciu4'))
    const j = enMision({ misiones: ['pruebas-ciu4'], tripulacion: ['viejo_lobo', 'contrabandista'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'] })
    j.comprometer('EXP').seguir()
    expect(j.registro.some((t) => t.includes('sufre'))).toBe(false)
  })

  it('N6 · con comprometidos, las heridas se reparten libremente entre ellos, también un «2 heridas»', () => {
    // Tiburón tigre (2 heridas). Diego y el Bucanero llegarían, pero el Destino de la Leyenda es «Fallas la Prueba».
    const f = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero'], mazoPeligros: ['bestias', 'leyenda', 'calma'] })
    f.comprometer('COM', ['capitan', 'bucanero']).seguir()
    expect(f.decision).toMatchObject({ tipo: 'repartir', cantidad: 2, motivo: { clave: 'heridas' } })
    f.repartir({ capitan: 1, bucanero: 1 })
    expect([f.copia('capitan').heridas, f.copia('bucanero').heridas]).toEqual([1, 1])
  })
})

describe('N5 · Agotar sin preparados suficientes', () => {
  it('«2 agotar» con un solo preparado: lo agotas y otro Tripulante sufre 1 herida', () => {
    // Espíritus de la selva (Naturaleza): EXP 3, fallo 2 agotar.
    const j = enMision({ misiones: ['aguada-I'], tripulacion: ['bucanero'], mazoPeligros: ['sirenas', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['capitan']).seguir() // Diego: EXP 1 contra 3; queda preparado el Bucanero
    expect(j.copia('bucanero').agotada).toBe(true)
    j.elegir('capitan')
    expect(j.copia('capitan').heridas).toBe(1)
  })

  it('«Todos agotar» sin nadie preparado no hace nada', () => {
    const j = enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['leyenda', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).seguir() // Kraken fallado: 3 daños · todos agotar
    expect(j.registro.some((t) => t.startsWith('Agotas'))).toBe(false)
    expect(j.registro.some((t) => t.includes('sufre'))).toBe(false)
  })
})

describe('N7 · Si ya no queda ningún comprometido, heridas y rehén como sin comprometidos', () => {
  it('el Grumete muere por el Destino; el rehén de Bandoleros se elige al azar entre los demás', () => {
    const j = enMision({ misiones: ['aguada-I'], tripulacion: ['grumete', 'bucanero'], mazoPeligros: ['rivales', 'rivales', 'calma'] })
    j.comprometer('COM', ['grumete']) // «Puñal escondido»: el Grumete (Vida 1) sufre 1 herida y queda derrotado
    expect(j.zona('descartesMuelle')).toContain('grumete')
    j.seguir()
    expect(j.zona('rehenes')).toEqual(['bucanero'])
  })
})

describe('N8 · Si el Barco se hunde con el recuadro rojo a medias, el resto se aplica igual', () => {
  it('Kraken fallado con 3 daños: se hunde y después agotas a todos', () => {
    const j = enMision({ misiones: ['pruebas-mar5'], tripulacion: ['bucanero'], barco: { dano: 3 }, mazoPeligros: ['leyenda', 'chubasco', 'calma'] })
    j.comprometer('COM').seguir()
    expect(j.registro).toContain('¡El Barco se hunde!')
    expect(j.copia('capitan').agotada).toBe(true)
    expect(j.copia('bucanero').agotada).toBe(true)
  })
})

describe('N9 · El Destino se aplica después de su ventana; cancelado, no se aplica nada', () => {
  it('una Interrupción que cancela «Zarpazo» evita también su herida', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.cancelarDestino',
      carta: 'capitan',
      ventana: 'interrupcion',
      desde: 'juego',
      disparo: (_s, _yo, ev) => ev.tipo === 'revelarDestino',
      efecto: (s) => {
        if (s.prueba) s.prueba.destinoCancelado = true
        return []
      },
    })
    const j = enMision({ misiones: ['aguada-I'], mazoPeligros: ['bestias', 'bestias', 'calma'] })
    j.comprometer('COM', ['capitan'])
    j.usar('prueba.cancelarDestino')
    j.seguir()
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.registro).toContain('Total 3 contra 3: superas la Prueba.')
  })
})

describe('N10 · La Armada entra en el mazo de Peligros normal aunque la misión use un mazo mezclado', () => {
  it('en «El galeón rezagado», fallar la Patrulla española baraja la Armada en el mazo de Peligros', () => {
    // Las 6 cartas que se mezclan son Patrullas: la primera es el encuentro y la segunda, su Destino.
    const j = enMision({ misiones: ['flota-II'], mazoHistoria: [], mazoPeligros: ['ley', 'ley', 'ley', 'ley', 'ley', 'ley', 'racha'] })
    j.comprometer('COM').seguir() // fallas: «1 daño · + La Armada»
    while (j.decision.tipo === 'elegirCartas') j.responder({ tipo: 'cartas', ids: j.decision.candidatas.slice(0, j.decision.min) })
    expect(j.zona('mazoPeligros').sort()).toEqual(['armada', 'racha'])
    expect([...j.zona('mazoMision'), ...j.zona('descartesMision')]).not.toContain('armada')
  })
})

describe('N11 · Rehén con solo el Capitán en juego: no pasa nada', () => {
  it('fallas Bandoleros con Diego solo: nadie es capturado', () => {
    const j = enMision({ misiones: ['aguada-I'], mazoPeligros: ['rivales', 'leyenda', 'calma'] })
    j.comprometer('COM', ['capitan']).seguir()
    expect(j.zona('rehenes')).toEqual([])
    expect(j.registro).toContain('No hay nadie a quien capturar.')
  })
})

describe('D9 · «Las cartas de tu mano no suman» anula también las añadidas al comprometer', () => {
  it('la Vigía con «Ojo avizor» contra Espíritus de la selva y «Mal fario»: 3 contra 4, fallas', () => {
    const j = enMision({ misiones: ['aguada-I'], tripulacion: ['vigia'], mano: ['ojo'], mazoPeligros: ['sirenas', 'sirenas', 'calma'] })
    j.comprometer('EXP', ['vigia'], ['ojo']).seguir()
    // Fase 10: «Mal fario» (−1) resta del total: 3 − 1 = 2 contra 3.
    expect(j.registro).toContain('Total 2 contra 3: fallas la Prueba.')
  })
})

describe('D10 · Si se acaba el mazo mezclado de una misión, se barajan los descartes de esa misión', () => {
  it('en «El templo», el mazo mezclado se rebaraja con sus propios descartes', () => {
    const j = enMision({
      misiones: ['templo-IV'],
      tripulacion: ['viejo_lobo', 'baqueano', 'bucanero', 'contrabandista'],
      mazoHistoria: ['pasadizo'],
      mazoPeligros: ['calma'],
      reputacion: 0,
    })
    // Mazo mezclado: el Pasadizo secreto y un Claro tranquilo (2 cartas, 2 de Avance cada una). Con 5 de Avance
    // necesario, hay que resolver 3 cartas: la tercera sale de rebarajar los descartes de la misión.
    for (let i = 0; i < 20 && j.estado.mision; i++) {
      const d = j.decision
      if (d.motivo.clave === 'trasEncuentro') j.seguir()
      else if (d.tipo === 'comprometer') j.comprometer(d.opciones[0]!.hab, [], []).seguir()
      else if (d.tipo === 'elegirCartas') j.responder({ tipo: 'cartas', ids: d.candidatas.slice(0, d.min) })
      else if (d.tipo === 'elegirOpcion') j.responder({ tipo: 'opcion', clave: d.opciones[0]!.clave })
      else j.seguir()
    }
    expect(j.registro).toContain('Se acaba el mazo de la misión: se barajan sus descartes.')
    expect(j.zona('mazoHistoria')).toContain('pasadizo')
  })
})

describe('N1 · Tesoro de un rehén perdido', () => {
  it('pasa a otro Tripulante', () => {
    const j = enMision({ misiones: ['aguada-I'], tripulacion: [{ id: 'grumete', mejoras: ['espada'] }], mazoPeligros: ['rivales', 'leyenda', 'calma'] })
    j.comprometer('COM', ['grumete']).pasar().seguir().retirarse().opcion('dejar') // no cancela el «Fallo» con la Espada
    expect(j.zona('fueraDeJuego')).toContain('grumete')
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
  })
})

describe('Decisiones que dependen de cartas concretas', () => {
  it('D1c · el Loro que se une tras el Destino con Diego ya agotado suma su EXP 1, sin el +1', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], tripulacion: ['loro'], mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['capitan']).usar('loro.unirse')
    expect(totalSinDestinoPrueba(j.estado)).toBe(1 + 1)
  })

  it('D3 · un Destino «Fallo» en el Mar no se puede mandar al fondo con «Cambio de rumbo» ni da Avance con «¡A toda vela!»', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], mano: ['cambio_rumbo', 'viento', 'ojo', 'timon'], mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    expect(j.ofreceCapacidad('cambio_rumbo.jugar') && j.ofreceCapacidad('viento.jugar')).toBe(true) // al revelar los Tiburones, sí
    j.pasar().comprometer('COM', ['capitan'])
    expect(j.decision.motivo.clave).toBe('ventanaPrueba') // revelado el Destino, no se ofrece ninguna
  })

  it('D4 · la Patrulla española (COM 4 / NAV 4) se puede descartar con las Velas de tormenta y con el Pedrero', () => {
    const velas = Jugador.enMision({ misiones: ['prueba-I'], barco: { mejoras: ['velas_tormenta'] }, mazoPeligros: ['ley', 'calma', 'calma'] })
    expect(velas.ofreceCapacidad('velas_tormenta.esquivar')).toBe(true)
    const pedrero = Jugador.enMision({ misiones: ['prueba-I'], barco: { mejoras: ['pedrero'] }, mazoPeligros: ['ley', 'calma', 'calma'] })
    expect(pedrero.ofreceCapacidad('pedrero.disparar')).toBe(true)
  })

  it('D5a · en una misión de Mar 5, resuelta una carta y con 3, revelas el Kraken y «¡A toda vela!» la supera sin resolverlo', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], avance: { 'pruebas-mar5': 1 }, mano: ['viento', 'ojo'], mazoPeligros: ['calma', 'leyenda', 'chubasco'] })
    j.pasar() // no juega «¡A toda vela!» con el Mar en calma
    expect(j.avance('pruebas-mar5')).toBe(3)
    j.seguir() // revela el Kraken
    j.usar('viento.jugar').elegir('ojo')
    expect(j.registro).toContain('Reúnes el Avance a mitad del encuentro: lo dejas sin resolver.')
    expect(j.zona('misionesSuperadas')).toContain('pruebas-mar5')
  })

  it('D5b · empiezas una misión de Ciudad 4 con 4 y quitas la primera carta con «Sangre fría»: hay que resolver otra', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu4'], avance: { 'pruebas-ciu4': 4 }, mano: ['sangre_fria', 'ojo', 'timon'], mazoPeligros: ['rivales', 'calma', 'calma'] })
    j.usar('sangre_fria.jugar').elegir('ojo', 'timon')
    // Con 6 de 4 no se supera aún: hay que revelar y resolver otra carta (la Hora de la siesta).
    const r = j.registro
    const sangre = r.indexOf('«Pelea de taberna»: +2 de Avance (6/4).')
    const siesta = r.findIndex((t) => t.endsWith(': Hora de la siesta (Ciudad).'))
    const superada = r.findIndex((t) => t.startsWith('¡Superas «Prueba (ciu 4)»'))
    expect(sangre).toBeGreaterThanOrEqual(0)
    expect(siesta).toBeGreaterThan(sangre)
    expect(superada).toBeGreaterThan(siesta)
  })

  it('D6 · el Viejo lobo cubre la Distancia de «La selva», se prepara con Víveres y se compromete en el segundo encuentro', () => {
    const j = Jugador.enMision({
      misiones: ['templo-II'],
      tripulacion: ['viejo_lobo'],
      barco: { mejoras: ['viveres'] },
      mazoPeligros: ['calma', 'fauna', 'leyenda', 'calma'],
      cubrir: ['viejo_lobo'],
    })
    expect(j.copia('viejo_lobo').agotada).toBe(true)
    j.usar('viveres.preparar').seguir() // tras el Claro tranquilo
    j.comprometer('EXP', ['viejo_lobo']).pasar().seguir() // Serpientes con el Destino «Fallo»: 1 herida
    j.repartir({ viejo_lobo: 1 }) // heridas libres (fase 10): las reparte el jugador entre todos
    expect(j.copia('viejo_lobo').heridas).toBe(1)
  })

  it('D11 · «Lección aprendida» no puede poner la ficha en el Grumete leal (0 huecos)', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], mano: ['leccion', 'ojo'], tripulacion: ['grumete'], mazoPeligros: ['chubasco', 'leyenda', 'calma'] })
    j.comprometer('NAV', ['grumete']).seguir()
    expect(j.ofreceCapacidad('leccion.jugar')).toBe(false)
  })

  it('N2 · Barco con 4 daños de 5, sale la Fragata cazadora: antes de comprometer, «Remiendo de urgencia» lo baja a 2', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], barco: { dano: 4 }, mano: ['reparacion'], mazoPeligros: ['cazadores', 'chubasco', 'calma'] })
    expect(j.decision.tipo).toBe('comprometer')
    j.usar('reparacion.jugar')
    expect(j.estado.danoBarco).toBe(2)
    expect(j.decision.tipo).toBe('comprometer')
  })
})

describe('N13 · Una herida pagada como coste se puede evitar o desviar', () => {
  it('el Filibustero paga su herida; el Grumete la reduce a 0 y el Filibustero conserva el +2', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], tripulacion: ['filibustero', 'grumete'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['filibustero']).usar('filibustero.furia').usar('grumete.salvar')
    expect(j.copia('filibustero').heridas).toBe(0)
    expect(totalSinDestinoPrueba(j.estado)).toBe(6)
  })

  it('también se desvía con «Ni un hombre atrás»', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], mano: ['ni_hombre', 'ojo'], tripulacion: ['filibustero', 'bucanero'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['filibustero', 'bucanero']).usar('filibustero.furia').usar('ni_hombre.jugar').elegir('ojo')
    expect([j.copia('filibustero').heridas, j.copia('bucanero').heridas]).toEqual([0, 1])
  })

  it('si esa herida lo derrota, Isabela lo salva', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], tripulacion: [{ id: 'filibustero', heridas: 1 }, 'isabela'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['filibustero']).usar('filibustero.furia').usar('isabela.salvar')
    expect(j.copia('filibustero').heridas).toBe(1)
    expect(totalSinDestinoPrueba(j.estado)).toBe(6)
  })
})

describe('N14 · El Loro que se une a una Prueba sin comprometidos anula Sin oposición', () => {
  it('Espíritus de la selva (EXP 3) con «Contratiempo»: no pierdes Avance; el Loro se une solo, sin cartas de la mano (ya no hay refuerzo)', () => {
    const j = Jugador.enMision({
      misiones: ['aguada-I'],
      avance: { 'aguada-I': 1 },
      capitan: { agotada: true },
      tripulacion: ['loro'],
      mano: ['ojo', 'estrellas'],
      mazoPeligros: ['sirenas', 'percances', 'calma'],
    })
    j.comprometer('EXP', []).usar('loro.unirse')
    expect(j.registro.some((t) => t.startsWith('Pierdes'))).toBe(false)
    expect(j.decision).toMatchObject({ tipo: 'ventanaAccion', motivo: { clave: 'ventanaPrueba' } })
    j.seguir()
    // Fase 10: «Contratiempo» (−1) resta del total: 1 − 1 = 0 contra 3.
    expect(j.registro).toContain('Total 0 contra 3: fallas la Prueba.')
    expect(j.zona('mano')).toEqual(['ojo', 'estrellas'])
  })
})

describe('N15 · «Perdidos en la espesura» ignora el recuadro rojo y la herida extra de la misión, no la del Destino', () => {
  // Una misión con «cada efecto de fallo inflige además 1 herida». Mazo solo con Fiebres: el encuentro es la
  // Fiebre amarilla (1 herida · 1 herida) y el Destino, «Fiebre» (si fallas, además 1 herida).
  const fiebres = ['fiebre', 'fiebre', 'fiebre', 'fiebre', 'fiebre', 'fiebre']
  const montarTemplo = (mano: string[]) =>
    Jugador.enMision({ misiones: ['pruebas-nat3'], tripulacion: ['viejo_lobo'], capitan: { heridas: 0 }, mano, mazoPeligros: fiebres })

  it('sin la carta, 4 heridas; con ella, 1 (la de «Fiebre»)', () => {
    quitar = registrarParaPruebas(heridaExtraEn('pruebas-nat3'))
    const sin = montarTemplo([])
    sin.comprometer('EXP', ['capitan']).seguir()
    expect(sin.decision).toMatchObject({ tipo: 'repartir', cantidad: 4 })
    sin.repartir({ capitan: 4 })
    expect(sin.copia('capitan').heridas).toBe(4)
    const con = montarTemplo(['espesura', 'ojo'])
    con.comprometer('EXP', ['capitan']).seguir().usar('espesura.jugar').elegir('ojo')
    con.repartir({ capitan: 1 })
    expect(con.copia('capitan').heridas).toBe(1)
  })
})

describe('N16 · «Retirada a tiempo» quita el encuentro, pero el Destino ya revelado se aplica', () => {
  it('la Patrulla española con «Celada»: el Bucanero sufre la herida, pero te ahorras el fallo', () => {
    const j = Jugador.enMision({ misiones: ['prueba-I'], mano: ['retirada', 'ojo'], tripulacion: ['bucanero'], mazoPeligros: ['ley', 'asalto', 'calma', 'calma'] })
    j.comprometer('COM', ['bucanero']).usar('retirada.jugar').elegir('ojo')
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.estado.danoBarco).toBe(0)
    expect(j.zona('apartados')).toContain('armada') // sin el fallo, la Armada no entra
  })
})

describe('N17 · Una Prueba superada automáticamente cuenta como superada, sin participantes', () => {
  it('«Soborno» ante «Perros de la guardia» (COM 3 o EXP 3): eliges COM y puedes jugar «Prisionero liberado»; Uñas largas no roba', () => {
    const j = Jugador.enMision({
      mano: ['soborno', 'prisionero', 'ojo', 'timon', 'coraje'],
      tripulacion: ['saqueador'],
      muelle: ['grumete'],
      mazoPeligros: ['bestias', 'leyenda', 'calma'],
    })
    j.usar('soborno.jugar').elegir('ojo', 'timon')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'opcionAutomatica' } })
    j.opcion('0')
    expect(j.ofreceCapacidad('prisionero.jugar')).toBe(true)
    expect(j.ofreceCapacidad('saqueador.superar')).toBe(false)
    j.usar('prisionero.jugar').elegir('coraje').elegir('grumete')
    expect(j.zona('tripulacion')).toContain('grumete')
  })
})

describe('N18 · Son Cañones las cuatro Mejoras con el Rasgo Cañón (fase 13: solo en el Mar si su carta lo dice, «[mar], [agotar]»)', () => {
  it('el Pedrero («[mar], [agotar]») no se usa en Ciudad; «Los Cañones no suman» anula también la Culebrina', () => {
    const tierra = Jugador.enMision({ barco: { mejoras: ['pedrero'] }, mazoPeligros: ['rivales', 'calma', 'calma'] })
    expect(tierra.ofreceCapacidad('pedrero.disparar')).toBe(false)
    const niebla = Jugador.enMision({ misiones: ['fantasma-I'], barco: { mejoras: ['culebrina'] }, mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    niebla.comprometer('NAV', ['capitan']).usar('culebrina.disparar')
    expect(totalSinDestinoPrueba(niebla.estado)).toBe(2 + 1)
  })
})

describe('N19 · El descuento de Catalina se gasta con el siguiente Tripulante que reclutes, aunque sea gratis', () => {
  it('agotas a Catalina y reclutas gratis con «Náufrago en la playa»: el siguiente cuesta lo normal', () => {
    const j = Jugador.en({ capitanId: 'capitan2', mano: ['naufrago', 'ojo', 'timon'], mazoMuelle: ['bucanero', 'sable', 'vela'], muelle: ['contrabandista'] })
    j.usar('capitan2.agotar').usar('naufrago.jugar').elegir('ojo').elegir('bucanero')
    expect(j.valor({ tipo: 'coste', carta: j.inst('contrabandista') })).toBe(3)
  })
})

describe('Barco hundido: las Mejoras que se pierden activan sus efectos «después de que descartes esta carta»', () => {
  it('se ofrece la Respuesta de la Mejora recién descartada (ninguna carta de la caja la tiene: capacidad de prueba)', () => {
    quitar = registrarParaPruebas({
      clave: 'prueba.alDescartarse',
      carta: 'vela',
      ventana: 'respuesta',
      desde: 'descartada',
      disparo: (_s, yo, ev) => ev.tipo === 'descartada' && ev.carta === yo,
      efecto: () => [{ tipo: 'robar', n: 1 }],
    })
    const j = Jugador.en({ barco: { dano: 5, mejoras: ['vela'] }, mazoCapitan: ['ojo'] })
    expect(j.zona('descartesMuelle')).toEqual(['vela'])
    j.usar('prueba.alDescartarse')
    expect(j.zona('mano')).toEqual(['ojo'])
  })
})

describe('P61 y fase 10 · La dificultad suma sus modificadores y el Destino va al total; los dos, si quedan por debajo de 0, cuentan como 0', () => {
  // «Desembarco nocturno»: las Pruebas de EXP reciben −1. El Guía del istmo: −1 a EXP en Naturaleza.
  // «Manzanillas de la muerte» (El hambre): EXP 3, Explorador −2 (el Rastreador de la selva).
  const manzanillas = (destino: string) =>
    Jugador.enMision({
      misiones: ['sanfelipe-I'],
      tripulacion: ['baqueano'],
      pasajeros: ['guia'],
      // Fase 10: la Distancia se cubre agotando al menos a un Tripulante (Diego, NAV 2).
      cubrir: ['capitan'],
      mazoPeligros: ['p2_hambre', destino, 'calma', 'calma'],
    }).comprometer('EXP', ['baqueano'])

  it('el ejemplo del reglamento: la dificultad 1 − 1 − 1 cuenta como 0; con «La sirena» (−1) el Rastreador suma 3 − 1 = 2, y superas', () => {
    const j = manzanillas('p2_sirena')
    expect(dificultadPrueba(j.estado)).toBe(0)
    expect(desgloseDificultad(j.estado).map((p) => [p.etiqueta, p.n])).toEqual([
      ['Manzanillas de la muerte', 1],
      ['Desembarco nocturno', -1],
      ['El guía del istmo', -1],
      ['No baja de 0', 1],
    ])
    // Fase 13 (I1): «Canto lejano» ya no anula a nadie; solo queda su −1.
    expect(totalPrueba(j.estado)).toBe(2)
    expect(desgloseTotal(j.estado).map((p) => [p.etiqueta, p.n, p.anulada ?? false])).toEqual([
      ['Rastreador de la selva', 3, false],
      ['Destino de «La sirena»', -1, false],
    ])
    j.seguir()
    expect(j.registro).toContain('Total 2 contra 0: superas la Prueba.')
  })

  it('el Destino suma al total y su resultado no baja de 0: con «Aguja de marear» (+1) el Rastreador suma 4', () => {
    const j = manzanillas('p2_sinrumbo')
    expect(dificultadPrueba(j.estado)).toBe(0)
    const partes = desgloseDificultad(j.estado)
    expect(partes.filter((p) => p.etiqueta === 'No baja de 0')).toEqual([{ etiqueta: 'No baja de 0', n: 1, tipo: 'modificador' }])
    expect(partes.at(-1)?.etiqueta).toBe('No baja de 0')
    expect(partes.reduce((n, p) => n + p.n, 0)).toBe(0)
    expect(totalPrueba(j.estado)).toBe(4)
  })

  it('el total no baja de 0: sin nadie asignado, «La sirena» (−1) deja el total en 0, no en −1', () => {
    const j = Jugador.enMision({
      misiones: ['sanfelipe-I'],
      pasajeros: ['guia'],
      cubrir: ['capitan'],
      mazoPeligros: ['p2_hambre', 'p2_sirena', 'calma', 'calma'],
    }).comprometer('EXP', [])
    expect(totalPrueba(j.estado)).toBe(0)
    expect(desgloseTotal(j.estado).map((p) => [p.etiqueta, p.n])).toEqual([
      ['Destino de «La sirena»', -1],
      ['No baja de 0', 1],
    ])
  })
})
