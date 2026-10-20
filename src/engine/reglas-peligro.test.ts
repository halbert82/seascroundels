// Reglas nuevas de Peligro (fase 6) que no usa ninguna carta del Grupo A: se prueban con reglas registradas solo
// para este fichero sobre cartas antiguas (cada fichero de pruebas tiene su propio registro).

import { describe, expect, it } from 'vitest'
import { registrarPeligro, registrarPermanente } from './capacidades/peligros.ts'

import { Jugador, PERMANENTE_DE_PRUEBA, dificultadConDestino } from './pruebas/situacion.ts'

// «Percances» (Mar, sin Prueba): pone en juego la permanente de prueba, que se quita superando NAV 3, agotando a un
// Oficial o pagando 2. Mientras esté, las Pruebas de COM reciben +1 y, cada vez que falles una Prueba, un comprometido
// queda Asustado.
registrarPermanente(PERMANENTE_DE_PRUEBA, {
  quitar: [
    { tipo: 'prueba', opciones: [{ hab: 'NAV', dificultad: 3 }], fallo: [{ tipo: 'heridas', n: 1, capitan: true }] },
    { tipo: 'agotarRasgo', rasgo: 'Oficial' },
    { tipo: 'pagar', n: 2 },
  ],
  modificadores: [{ a: 'dificultad', hab: 'COM', n: 1 }],
  disparos: [{ cuando: 'fallarPrueba', efectos: [{ tipo: 'estado', estado: 'asustado', a: 'comprometido' }] }],
})
registrarPeligro('percances', {
  encuentros: {
    mar: { pone: { carta: PERMANENTE_DE_PRUEBA } },
    // Ciudad: Sin ayuda.
    ciu: { sinAyuda: true, exito: [{ tipo: 'robar', n: 1 }] },
  },
})

// «Encrucijada»: Incautado al revelarse (2 de la mano en el Mar, una Mejora en Naturaleza, un Tripulante en Ciudad).
registrarPeligro('encrucijada', {
  encuentros: {
    mar: { alRevelarse: [{ tipo: 'incautar', que: 'mano', n: 2 }], exito: [{ tipo: 'recuperarIncautadas' }] },
    nat: { alRevelarse: [{ tipo: 'incautar', que: 'mejora', n: 1 }] },
    ciu: { alRevelarse: [{ tipo: 'incautar', que: 'tripulante', n: 1 }, { tipo: 'noRetirarse' }] },
  },
})

// «Oportunidad» (Mar): mira las 2 de arriba, descarta la de arriba y «por cada Mejora, 1 herida (máx. 2)».
registrarPeligro('oportunidad', {
  encuentros: {
    mar: {
      exito: [{ tipo: 'mirarPeligros', n: 2 }, { tipo: 'descartarArriba', n: 1 }],
      fallo: [{ tipo: 'porCada', medida: 'mejoras', efectos: [{ tipo: 'heridas', n: 1 }], maximo: 2 }],
    },
  },
})

describe('Zona de permanentes (fase 11)', () => {
  it('el encuentro pone en juego la permanente; la carta del Peligro se descarta como cualquier otra', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'] })
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
    expect(j.zona('descartesPeligros')).toEqual(['percances'])
    expect(j.zona('mazoHistoria')).not.toContain(PERMANENTE_DE_PRUEBA)
    expect(j.registro).toContain('Pones en juego «Percances (prueba)» (carta 9201 del mazo de historia).')
  })

  it('se quita con una Prueba normal: comprometes, sale Destino y, si superas, vuelve al mazo de historia', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'chubasco', 'calma'], tripulacion: ['viejo_lobo'] })
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
    j.usar(`${PERMANENTE_DE_PRUEBA}.quitar0`)
    expect(j.decision).toMatchObject({ tipo: 'comprometer', motivo: { clave: 'comprometerAccion' } })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas()
    expect(j.zona('destino')).toEqual(['chubasco'])
    j.seguir()
    expect(j.zona('permanentes')).toEqual([])
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
  })

  it('una Prueba de una Acción sin nadie comprometido aplica Sin oposición y falla (con su efecto de fallo)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'niebla', 'calma'] })
    j.usar(`${PERMANENTE_DE_PRUEBA}.quitar0`).comprometer('NAV', []).seguir()
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
    expect(j.copia('capitan').heridas).toBe(1)
  })

  it('se quita agotando a un Tripulante con el Rasgo pedido, o pagando cartas', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], tripulacion: ['viejo_lobo'] })
    j.usar(`${PERMANENTE_DE_PRUEBA}.quitar1`)
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar' } })
    j.elegir('viejo_lobo')
    expect(j.zona('permanentes')).toEqual([])
    const k = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], mano: ['ojo', 'timon'] })
    k.usar(`${PERMANENTE_DE_PRUEBA}.quitar2`).elegir('ojo', 'timon')
    expect(k.zona('permanentes')).toEqual([])
  })

  it('mientras está, cambia las Pruebas y reacciona cuando fallas', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'fauna', 'chubasco', 'calma'], tripulacion: ['carpintero'] })
    j.seguir().comprometer('COM', ['carpintero'])
    expect(dificultadConDestino(j.estado)).toBe(3) // Bestia en el Mar COM 2 + 1 de «Percances»; el Destino es −0
    j.seguir()
    if (j.decision.tipo === 'repartir') j.repartir({ capitan: 1 }) // heridas libres (fase 10)
    expect(j.estados('carpintero')).toEqual(['asustado'])
  })

  it('no se puede hacer la Prueba de una Acción durante otra Prueba', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'chubasco', 'chubasco', 'calma'] })
    j.seguir().comprometer('NAV', ['capitan'])
    expect(j.ofreceCapacidad(`${PERMANENTE_DE_PRUEBA}.quitar0`)).toBe(false)
  })

  it('al terminar la misión, la permanente vuelve al mazo de historia (y la carta del Peligro ya estaba descartada)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'] })
    j.retirarse().opcion('dejar')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain(PERMANENTE_DE_PRUEBA)
    expect(j.zona('descartesPeligros')).toContain('percances')
  })

  it('el Peligro vuelve a salir con su permanente en juego: se descarta sin dar Avance y se revela otra', () => {
    // El mazo se acaba y se baraja: «Percances» vuelve a salir mientras su permanente sigue en juego.
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'] })
    const avance = j.avance('pruebas-mar5')
    // Se pone «Percances» otra vez encima del mazo (como si se hubiera barajado y saliera de nuevo).
    const peligro = j.inst('percances')
    j.estado.zonas.descartesPeligros = j.estado.zonas.descartesPeligros.filter((c) => c !== peligro)
    j.estado.zonas.mazoPeligros.unshift(peligro)
    j.seguir()
    expect(j.registro).toContain(
      'La carta 9201 («Percances (prueba)») no está en el mazo de historia: descartas «Percances» sin ganar su Avance y revelas otra.',
    )
    // Se revela la siguiente («Calma chicha» en el Mar), que da su Avance; «Percances» no da nada.
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
    expect(j.zona('descartesPeligros')).toContain('percances')
    expect(j.registro.filter((r) => r.startsWith('Revelas «Percances»'))).toHaveLength(2)
    expect(j.avance('pruebas-mar5')).toBeGreaterThanOrEqual(avance)
  })
})

describe('Sin ayuda', () => {
  it('solo un Tripulante; suman las Habilidades de la mano; no se juegan Eventos', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu4'], mazoPeligros: ['percances', 'chubasco', 'calma'], tripulacion: ['bucanero'], mano: ['ojo', 'vendas'] })
    expect(j.decision).toMatchObject({ tipo: 'comprometer', sinAyuda: true })
    expect(() => j.comprometer('EXP', ['capitan', 'bucanero'])).toThrow(/solo puede ser asignado un Tripulante/)
    expect((j.decision as { cartas: `i${number}`[] }).cartas.map((c) => j.estado.cartas[c]?.id)).toEqual(['ojo']) // las Vendas (Evento) no
    j.comprometer('EXP', ['capitan'], ['ojo'])
    expect(j.ofreceCapacidad('vendas.jugar')).toBe(false)
  })
})

describe('Incautado', () => {
  it('cartas de la mano van debajo de la misión; si superas, se recuperan', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'], mano: ['ojo', 'timon', 'coraje'] })
    j.elegir('ojo', 'timon')
    expect(j.zona('incautadas')).toEqual(['ojo', 'timon'])
    j.comprometer('NAV', ['capitan']).seguir() // éxito: recupera ya lo incautado
    expect(j.zona('incautadas')).toEqual([])
    expect(j.zona('mano')).toEqual(expect.arrayContaining(['ojo', 'timon', 'coraje']))
  })

  it('una Mejora incautada vuelve a su portador si superas la misión; si no, se pierde', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'], capitan: { mejoras: ['sable'] }, mano: ['ojo'] })
    expect(j.zona('incautadas')).toEqual(['sable'])
    j.comprometer('EXP', ['capitan'], ['ojo']).seguir().seguir() // 2 + 2 de Avance: supera la misión
    expect(j.copia('sable').vinculadaA).toBe(j.inst('capitan'))
    const k = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'], capitan: { mejoras: ['sable'] } })
    k.comprometer('EXP', []).seguir().retirarse()
    expect(k.zona('fueraDeJuego')).toContain('sable')
  })

  it('un Tripulante incautado sigue ocupando su plaza y se pierde si no superas la misión', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu4'], mazoPeligros: ['encrucijada', 'calma', 'calma'], tripulacion: ['bucanero', 'vigia'] })
    j.elegir('bucanero')
    expect(j.zona('incautadas')).toEqual(['bucanero'])
    expect(j.ofrece('retirarse')).toBe(false) // «No puedes retirarte de esta misión»
  })
})

describe('Efectos que leen la mesa y miran el mazo', () => {
  it('mirar las 2 de arriba y descartar la de arriba sin resolverla', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['oportunidad', 'chubasco', 'niebla', 'calma'], tripulacion: ['viejo_lobo'] })
    j.comprometer('NAV', ['viejo_lobo', 'capitan']).pasarOfertas().seguir()
    expect(j.registro.some((r) => r.startsWith('Miras las 2 cartas de arriba'))).toBe(true)
    expect(j.zona('descartesPeligros')).toContain('niebla')
  })

  it('«1 herida por cada Mejora (máx. 2)»', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['oportunidad', 'chubasco', 'calma'], barco: { mejoras: ['vela', 'hamacas', 'casco'] } })
    j.comprometer('NAV', []).seguir()
    expect(j.copia('capitan').heridas).toBe(2)
  })
})
