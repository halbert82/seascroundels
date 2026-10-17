// Infraestructura de ventanas, probada con capacidades de mentira (las de las cartas llegan en la fase 4).

import { afterEach, describe, expect, it } from 'vitest'
import { registrarParaPruebas } from './capacidades/index.ts'
import { Jugador } from './pruebas/situacion.ts'
import type { Capacidad } from './tipos.ts'

let quitar: (() => void) | null = null
function registrar(...caps: Capacidad[]): void {
  quitar = registrarParaPruebas(...caps)
}
afterEach(() => {
  quitar?.()
  quitar = null
})

const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'abordaje', 'abordaje', 'estrellas', 'estrellas']

describe('Respuestas', () => {
  const respuesta: Capacidad = {
    clave: 'prueba.respuesta',
    carta: 'capitan',
    ventana: 'respuesta',
    desde: 'juego',
    disparo: (_s, _yo, ev) => ev.tipo === 'reclutar',
    efecto: () => [{ tipo: 'robar', n: 1 }],
  }

  it('se ofrecen justo después de lo que indican; si la usas, se aplica', () => {
    registrar(respuesta)
    const j = Jugador.en({ mano: ['ojo'], muelle: ['marinero_p'], mazoCapitan: ['timon'] })
    j.reclutar('marinero_p').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'ofrecer', motivo: { clave: 'respuesta' } })
    j.usar('prueba.respuesta')
    expect(j.zona('mano')).toEqual(['timon'])
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('nunca se aplican solas: si pasas, no ocurre nada', () => {
    registrar(respuesta)
    const j = Jugador.en({ mano: ['ojo'], muelle: ['marinero_p'], mazoCapitan: ['timon'] })
    j.reclutar('marinero_p').elegir('ojo').pasar()
    expect(j.zona('mano')).toEqual([])
  })
})

describe('Interrupciones', () => {
  it('se ofrecen antes de que ocurra algo y pueden evitarlo', () => {
    registrar({
      clave: 'prueba.interrupcion',
      carta: 'carpintero',
      ventana: 'interrupcion',
      desde: 'juego',
      disparo: (s, yo, ev) => ev.tipo === 'heridas' && ev.objetivo !== yo && s.zonas.tripulacion.includes(ev.objetivo),
      efecto: (_s, _yo, suceso) => {
        if (suceso) suceso.cancelado = true
        return []
      },
    })
    // El Barco empieza con el daño máximo: se hunde y cada Tripulante sufre 1 herida.
    const j = Jugador.en({ barco: { dano: 5 }, tripulacion: ['carpintero', 'bucanero'] })
    expect(j.decision).toMatchObject({ tipo: 'ofrecer', motivo: { clave: 'interrupcion' } })
    j.pasar() // Diego recibe su herida. Al Carpintero no se le ofrece protegerse a sí mismo.
    j.usar('prueba.interrupcion') // El Carpintero se la evita al Bucanero.
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('carpintero').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })
})

describe('Obligadas', () => {
  it('se aplican solas, sin preguntar', () => {
    registrar({
      clave: 'prueba.obligada',
      carta: 'capitan',
      ventana: 'obligada',
      desde: 'juego',
      disparo: (_s, _yo, ev, fase) => ev.tipo === 'finTurno' && fase === 'despues',
      efecto: () => [{ tipo: 'reparar', n: 1 }],
    })
    const j = Jugador.en({ empezarEn: 'final', barco: { dano: 2 }, mano: ['ojo', 'ojo', 'ojo', 'ojo', 'ojo'], escenario: ['calma_ev'] })
    j.ninguna()
    expect(j.estado.danoBarco).toBe(1)
  })

  it('si dos coinciden, el jugador elige el orden', () => {
    const base: Omit<Capacidad, 'clave'> = {
      carta: 'capitan',
      ventana: 'obligada',
      desde: 'juego',
      disparo: (_s, _yo, ev, fase) => ev.tipo === 'finTurno' && fase === 'despues',
      efecto: () => [],
    }
    registrar({ ...base, clave: 'prueba.obligadaA' }, { ...base, clave: 'prueba.obligadaB' })
    const j = Jugador.en({ empezarEn: 'final', mano: ['ojo', 'ojo', 'ojo', 'ojo', 'ojo'], escenario: ['calma_ev'] })
    j.ninguna()
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'ordenObligadas' } })
  })
})

describe('N2 · Capacidades sin etiqueta: en cualquier pausa, nunca en mitad de otro efecto', () => {
  const libre: Capacidad = {
    clave: 'prueba.libre',
    carta: 'carpintero',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    efecto: () => [{ tipo: 'reparar', n: 1 }],
  }

  it('se ofrecen en la ventana de acción de Jugar cartas', () => {
    registrar(libre)
    const j = Jugador.en({ tripulacion: ['carpintero'], barco: { dano: 2 } })
    j.usar('prueba.libre')
    expect(j.estado.danoBarco).toBe(1)
    expect(j.copia('carpintero').agotada).toBe(true)
    expect(j.ofrece('usar', 'prueba.libre')).toBe(false)
  })

  it('el Inicio tiene su pausa después de aplicar el Escenario; si no hay nada que usar, no se pregunta', () => {
    registrar(libre)
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['astillero', 'calma_ev'], tripulacion: ['carpintero'], barco: { dano: 4 } })
    expect(j.estado.danoBarco).toBe(2) // Astillero ocioso ya aplicado.
    expect(j.decision).toMatchObject({ tipo: 'ventanaAccion', motivo: { clave: 'pausa.inicio' } })
    j.usar('prueba.libre')
    expect(j.estado.danoBarco).toBe(1)
    expect(j.decision.motivo.clave).toBe('jugarCartas')
    const sinNada = Jugador.en({ empezarEn: 'inicio', escenario: ['calma_ev'] })
    expect(sinNada.decision.motivo.clave).toBe('jugarCartas')
  })

  it('se ofrecen al decidir si te quedas o zarpas y en el Final, antes de robar', () => {
    registrar(libre)
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', tripulacion: ['carpintero'], barco: { dano: 3 }, escenario: ['calma_ev'] })
    expect(j.decision.libres).toEqual([{ fuente: j.inst('carpintero'), clave: 'prueba.libre' }])
    const f = Jugador.en({ empezarEn: 'final', tripulacion: ['carpintero'], barco: { dano: 3 }, escenario: ['calma_ev'] })
    expect(f.decision.motivo.clave).toBe('descartarFinal')
    f.usar('prueba.libre')
    expect(f.estado.danoBarco).toBe(2)
    expect(f.decision.motivo.clave).toBe('descartarFinal')
  })

  it('no se ofrecen en mitad de otro efecto (por ejemplo, mientras pagas o pierdes una Mejora)', () => {
    registrar(libre)
    const j = Jugador.en({ mano: ['ojo', 'timon'], muelle: ['bucanero'], tripulacion: ['carpintero'] })
    j.reclutar('bucanero')
    expect(j.decision.motivo.clave).toBe('pagar')
    expect(j.decision.libres).toBeUndefined()
    const impuestos = Jugador.en({ empezarEn: 'inicio', escenario: ['impuestos', 'calma_ev'], tripulacion: ['carpintero'], barco: { mejoras: ['vela', 'bandera'] } })
    expect(impuestos.decision.motivo.clave).toBe('perderMejora')
    expect(impuestos.decision.libres).toBeUndefined()
  })

  it('«Acción:» solo vale en las ventanas de acción, no en las demás pausas', () => {
    registrar({ ...libre, clave: 'prueba.accion', ventana: 'accion' })
    const j = Jugador.en({ tripulacion: ['carpintero'], barco: { dano: 2 } })
    expect(j.ofrece('usar', 'prueba.accion')).toBe(true)
    const f = Jugador.en({ empezarEn: 'final', tripulacion: ['carpintero'], barco: { dano: 2 }, escenario: ['calma_ev'] })
    expect(f.decision.libres).toBeUndefined()
  })

  it('un Evento sin etiqueta se juega desde la mano: paga su coste con otras cartas y se descarta', () => {
    registrar({ clave: 'prueba.vendas', carta: 'mapa', ventana: 'libre', desde: 'mano', efecto: () => [{ tipo: 'curar', n: 2, modo: 'repartir' }] })
    const solo = Jugador.en({ mano: ['mapa'], capitan: { heridas: 2 } })
    expect(solo.ofrece('usar', 'prueba.vendas')).toBe(false) // Cuesta 1 y no hay otra carta.
    const j = Jugador.en({ mano: ['mapa', 'ojo'], capitan: { heridas: 2 } })
    j.usar('prueba.vendas').elegir('ojo')
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.zona('mano')).toEqual([])
    expect(j.zona('descartesCapitan').sort()).toEqual(['mapa', 'ojo'])
  })
})

describe('Costes', () => {
  it('un Tripulante que se descarta como coste sale con sus Mejoras, y sus Tesoros pasan a otro', () => {
    registrar({
      clave: 'prueba.descartarse',
      carta: 'bucanero',
      ventana: 'accion',
      desde: 'juego',
      coste: [{ tipo: 'descartarse' }],
      efecto: () => [{ tipo: 'reparar', n: 1 }],
    })
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['sable', 'espada'] }], barco: { dano: 1 } })
    j.usar('prueba.descartarse')
    expect(j.zona('descartesMuelle').sort()).toEqual(['bucanero', 'sable'])
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
    expect(j.estado.danoBarco).toBe(0)
  })
})

describe('Límites', () => {
  it('«Límite de una vez por turno»: vuelve a estar disponible el turno siguiente', () => {
    registrar({
      clave: 'prueba.limite',
      carta: 'capitan',
      ventana: 'accion',
      desde: 'juego',
      limite: { veces: 1, por: 'turno' },
      efecto: () => [],
    })
    const j = Jugador.en({ escenario: ['calma_ev', 'astillero'], mazoCapitan: [...MAZO] })
    j.usar('prueba.limite')
    expect(j.ofrece('usar', 'prueba.limite')).toBe(false)
    j.pasarTurnoEnPuerto()
    expect(j.ofrece('usar', 'prueba.limite')).toBe(true)
  })
})
