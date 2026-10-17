// Una prueba por cada decisión de reglas de docs/decisiones.md. Las que dependen de mecánicas de las
// fases 3 y 4 quedan como pendientes (aparecen en el informe de pruebas) hasta que llegue su mecánica.

import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'
import { navParaDistancia } from './valores.ts'

describe('D1a · «Mientras esté preparado» se pierde al agotarse, también a la vez', () => {
  it('Diego y el Rufián agotados juntos para cubrir «Las puertas de Panamá» (Distancia 3 con el Barco) suman 2', () => {
    const j = Jugador.en({ tripulacion: ['marinero_p'], misiones: ['panama-III'] })
    expect(j.valor({ tipo: 'distancia', mision: j.inst('panama-III') })).toBe(3)
    expect(navParaDistancia(j.estado, [j.estado.capitan, j.inst('marinero_p')])).toBe(2)
  })

  it('si Diego se queda preparado, el Bucanero y el Grumete reciben su +1 y suman 4', () => {
    const j = Jugador.en({ tripulacion: ['bucanero', 'grumete'] })
    expect(navParaDistancia(j.estado, [j.inst('bucanero'), j.inst('grumete')])).toBe(4)
  })

  it.todo('D1a en una Prueba: Diego (NAV 2) y el Bucanero (NAV 1) comprometidos juntos suman 3 (fase 3)')
})

describe('D7 · Los cambios a «las Distancias» solo afectan a las misiones lejanas', () => {
  it('con «Temporada de huracanes», «La selva» pasa de 2 a 3 (con el Barco) y «Cobrar la deuda» sigue en 0', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['huracanes', 'calma_ev'],
      misiones: ['templo-II', 'deuda-I', 'prueba-I'],
    })
    expect(j.valor({ tipo: 'distancia', mision: j.inst('templo-II') })).toBe(3)
    expect(j.valor({ tipo: 'distancia', mision: j.inst('deuda-I') })).toBe(0)
    expect(j.valor({ tipo: 'distancia', mision: j.inst('prueba-I') })).toBe(0)
  })

  it('con «Vientos alisios», «Agua y leña» (Distancia 1) queda en 0, nunca por debajo', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['alisios', 'calma_ev'], misiones: ['aguada-I', 'templo-II', 'deuda-I'] })
    expect(j.valor({ tipo: 'distancia', mision: j.inst('aguada-I') })).toBe(0)
    expect(j.valor({ tipo: 'distancia', mision: j.inst('templo-II') })).toBe(1)
  })
})

describe('D8 · Perder o agotar una Mejora que sube un máximo se comprueba al momento', () => {
  it('Hamacas: con 5 Tripulantes y sin las Hamacas, despides a uno al momento', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['impuestos', 'calma_ev'],
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
      escenario: ['impuestos', 'calma_ev'],
      tripulacion: [{ id: 'bucanero', heridas: 2, mejoras: ['coleto'] }],
    })
    expect(j.zona('tripulacion')).toEqual(['capitan'])
    expect(j.zona('descartesMuelle').sort()).toEqual(['bucanero', 'coleto'])
    expect(j.registro).toContain('Bucanero veterano queda derrotado.')
  })

  it('Casco: con 5 daños, perder el Casco hunde el Barco en puerto (heridas a todos, se reflota)', () => {
    const j = Jugador.en({
      empezarEn: 'inicio',
      escenario: ['impuestos', 'calma_ev'],
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
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['impuestos', 'calma_ev'], capitan: { heridas: 4, mejoras: ['coleto'] } })
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
    const j = Jugador.en({ empezarEn: 'final', turno: 10, escenario: ['calma_ev'], mano: [], descartesCapitan: ['ojo', 'timon'] })
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
  it.todo('N1 al perder un rehén y al volver al muelle (fases 3 y 4)')
})

describe('Pendientes de su mecánica (fases 3 y 4)', () => {
  it.todo('D1b · Arrecife de los Ahorcados (NAV 2 con un Vigía): comprometer a Íñigo no sube la dificultad a 4')
  it.todo('D1c · el Loro que se une tras el Destino con Diego ya agotado suma su EXP 1 sin el +1')
  it.todo('D2a · Escorbuto fallado sin comprometidos: 1 herida a Diego y 1 al Bucanero; el Tiburón tigre (2) va a uno solo')
  it.todo('D2b · en «El templo», fallar la Trampa de dardos («1 · 1») son 3 heridas en total')
  it.todo('D2c · en «El polvorín», fallar «Un soplo en la taberna» (rojo vacío) no da herida extra')
  it.todo('D3 · un Destino «Fallo» en el Mar no se puede mandar al fondo con «Cambio de rumbo» ni da Avance con «¡A toda vela!»')
  it.todo('D4 · la Patrulla española (COM 4 / NAV 4) se puede descartar con las Velas de tormenta y con el Pedrero')
  it.todo('D5a · «Rumbo a la isla» con 3 de Avance tras la primera carta: el Kraken y «¡A toda vela!» la superan sin resolverlo; si es la primera carta, hay que resolverla')
  it.todo('D5b · la primera carta quitada con «Sangre fría» no cuenta: hay que resolver otra')
  it.todo('D6 · el Viejo lobo que cubrió la Distancia de «La selva» puede comprometerse tras «Víveres de reserva» y recibir heridas')
  it.todo('D9 · «Mal fario» anula también el «Ojo avizor» añadido al comprometer a la Vigía (3 contra 4: fallas)')
  it.todo('D10 · se acaba el mazo mezclado de «El templo»: se barajan sus descartes de esta misión')
  it.todo('D11 · «Lección aprendida» no puede poner la ficha en el Grumete leal (0 huecos)')
  it.todo('N2 · Barco con 4 daños de 5, sale la Fragata cazadora: antes de comprometer, «Remiendo de urgencia» lo baja a 2')
})
