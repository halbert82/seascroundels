// Reglas nuevas de Peligro (fase 6) que no usa ninguna carta del Grupo A: se prueban con reglas registradas solo
// para este fichero sobre cartas antiguas (cada fichero de pruebas tiene su propio registro).

import { describe, expect, it } from 'vitest'
import { registrarPeligro } from './capacidades/peligros.ts'

import { Jugador, dificultadConDestino } from './pruebas/situacion.ts'

// «Percances» (Mar, sin Prueba): se queda en juego; se quita superando NAV 3, agotando a un Oficial o pagando 2.
// Mientras esté, las Pruebas de COM reciben +1 y, cada vez que falles una Prueba, un comprometido queda Asustado.
registrarPeligro('percances', {
  encuentros: {
    mar: {
      queda: {
        quitar: [
          { tipo: 'prueba', opciones: [{ hab: 'NAV', dificultad: 3 }], fallo: [{ tipo: 'heridas', n: 1, capitan: true }] },
          { tipo: 'agotarRasgo', rasgo: 'Oficial' },
          { tipo: 'pagar', n: 2 },
        ],
        modificadores: [{ a: 'dificultad', hab: 'COM', n: 1 }],
        disparos: [{ cuando: 'fallarPrueba', efectos: [{ tipo: 'estado', estado: 'asustado', a: 'comprometido' }] }],
      },
    },
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

describe('Se queda en juego', () => {
  it('se quita con una Prueba normal: comprometes, sale Destino y, si superas, se descarta', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'chubasco', 'calma'], tripulacion: ['viejo_lobo'] })
    expect(j.zona('peligrosEnJuego')).toEqual(['percances'])
    j.usar('percances.mar.quitar0')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', motivo: { clave: 'comprometerAccion' } })
    j.comprometer('NAV', ['viejo_lobo']).pasarOfertas()
    expect(j.zona('destino')).toEqual(['chubasco'])
    j.seguir()
    expect(j.zona('peligrosEnJuego')).toEqual([])
    expect(j.decision.motivo.clave).toBe('trasEncuentro')
  })

  it('una Prueba de una Acción sin nadie comprometido aplica Sin oposición y falla (con su efecto de fallo)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'niebla', 'calma'] })
    j.usar('percances.mar.quitar0').comprometer('NAV', []).seguir()
    expect(j.zona('peligrosEnJuego')).toEqual(['percances'])
    expect(j.copia('capitan').heridas).toBe(1)
  })

  it('se quita agotando a un Tripulante con el Rasgo pedido, o pagando cartas', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], tripulacion: ['viejo_lobo'] })
    j.usar('percances.mar.quitar1')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar' } })
    j.elegir('viejo_lobo')
    expect(j.zona('peligrosEnJuego')).toEqual([])
    const k = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], mano: ['ojo', 'timon'] })
    k.usar('percances.mar.quitar2').elegir('ojo', 'timon')
    expect(k.zona('peligrosEnJuego')).toEqual([])
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
    expect(j.ofreceCapacidad('percances.mar.quitar0')).toBe(false)
  })

  it('al terminar la misión, se descarta', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'] })
    j.retirarse().opcion('dejar')
    expect(j.zona('peligrosEnJuego')).toEqual([])
    expect(j.zona('descartesPeligros')).toContain('percances')
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
