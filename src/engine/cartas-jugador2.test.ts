// Cartas de jugador 2.0 (fase 6): una prueba (al menos) por carta, con el ejemplo del documento cuando lo hay.

import { describe, expect, it } from 'vitest'
import { DATOS } from './datos.ts'
import { ejecutar } from './motor.ts'
import { descartarTripulante } from './tareas/peligros2.ts'
import type { CartaId } from './tipos.ts'

import { Jugador, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import { nombreDe } from './catalogo.ts'

describe('Herbolaria', () => {
  it('Agotar: quita el Estado Envenenado o Sangrando de un Tripulante (si tiene los dos, eliges cuál)', () => {
    const j = Jugador.en({ tripulacion: ['herbolaria', { id: 'bucanero', estados: ['envenenado', 'sangrando'] }] })
    j.usar('herbolaria.quitar')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'cualEstado' } })
    j.opcion('sangrando')
    expect(j.estados('bucanero')).toEqual(['envenenado'])
    expect(j.copia('herbolaria').agotada).toBe(true)
  })

  it('no se ofrece si nadie tiene esos Estados (fase 15, quinta ronda: ya no quita Asustado)', () => {
    const j = Jugador.en({ tripulacion: ['herbolaria', { id: 'bucanero', estados: ['buscado', 'borracho', 'asustado'] }] })
    expect(j.ofreceCapacidad('herbolaria.quitar')).toBe(false)
  })
})

describe('Práctico del puerto (166)', () => {
  it('fase 15, quinta ronda: sale de la caja y del mazo de muelle', () => {
    expect(DATOS.tripulantes.some((t) => t.id === 'practico' || t.num === 166)).toBe(false)
    expect(DATOS.mazosPredefinidos.mazoDeMuelle).not.toContain('practico')
    expect(DATOS.tripulantes.find((t) => t.id === 'viejo_lobo')?.rasgos).toContain('Piloto')
  })
})

describe('Lenguaraz (antes «La Lengua»)', () => {
  it('los encuentros Civil en los que participa reciben −1 de dificultad', () => {
    const j = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['civiles', 'chubasco', 'calma'], tripulacion: ['lengua'] })
    j.comprometer('EXP', ['lengua'])
    expect(dificultadConDestino(j.estado)).toBe(2) // EXP 3 − 1
    const k = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['civiles', 'chubasco', 'calma'], tripulacion: ['lengua'] })
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(3)
  })
})

describe('Fiador de la Hermandad', () => {
  // Fase 14 (fuera el rehén): «Interrupción: Cuando una carta de Peligro vaya a descartar a otro Tripulante, descarta a
  // Fiador de la Hermandad en su lugar y roba 2.» «Leva forzosa» (COM 4) fallada: «Descarta al Tripulante asignado con
  // menos Vida».
  const leva = (tripulacion: CartaId[]) => Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['p2_grilletes', 'chubasco', 'calma', 'calma'], tripulacion })

  it('Interrupción: una carta de Peligro va a descartar a otro: se descarta él y robas 2', () => {
    const j = leva(['vigia', 'fiador'])
    j.comprometer('COM', ['vigia']).seguir()
    expect(j.ofreceCapacidad('fiador.descarte')).toBe(true)
    const mano = j.zona('mano').length
    j.usar('fiador.descarte')
    expect(j.zona('descartesMuelle')).toContain('fiador')
    expect(j.zona('tripulacion')).toContain('vigia')
    expect(j.zona('mano').length).toBe(mano + 2)
  })

  it('si pasas, se descarta el otro; no se ofrece para salvarse a sí mismo ni al Capitán (que sufre 1 herida)', () => {
    const j = leva(['vigia', 'fiador'])
    j.comprometer('COM', ['vigia']).seguir().pasarOfertas()
    expect(j.zona('descartesMuelle')).toContain('vigia')
    const k = leva(['fiador'])
    k.comprometer('COM', ['fiador']).seguir()
    expect(k.ofreceCapacidad('fiador.descarte')).toBe(false)
    expect(k.zona('descartesMuelle')).toContain('fiador')
    // Solo Diego asignado: el Capitán no se descarta, sufre 1 herida en su lugar, y no hay Interrupción.
    const m = leva(['fiador'])
    m.comprometer('COM', ['capitan']).seguir()
    expect(m.ofreceCapacidad('fiador.descarte')).toBe(false)
    expect(m.copia('capitan').heridas).toBe(1)
    expect(m.zona('tripulacion')).toEqual(expect.arrayContaining(['capitan', 'fiador']))
  })

  it('fase 15, quinta ronda: vale contra cualquier efecto de juego, no solo Peligros y permanentes; y es Pirata', () => {
    expect(DATOS.tripulantes.find((t) => t.id === 'fiador')?.rasgos).toEqual(['Pirata'])
    // Un efecto que no viene de ninguna carta de Peligro ni permanente descarta a la Vigía.
    const j = Jugador.en({ tripulacion: ['vigia', 'fiador'], mazoCapitan: ['ojo', 'ojo', 'timon'] })
    const s = j.estado
    descartarTripulante(s, j.inst('vigia'), undefined)
    s.pendiente = null
    ejecutar(s)
    expect(j.ofreceCapacidad('fiador.descarte')).toBe(true)
    const mano = j.zona('mano').length
    j.usar('fiador.descarte')
    expect(j.zona('descartesMuelle')).toContain('fiador')
    expect(j.zona('tripulacion')).toContain('vigia')
    expect(j.zona('mano').length).toBe(mano + 2)
  })
})

describe('Cataplasma', () => {
  it('quita Envenenado o Sangrando a un Tripulante y le cura 1 herida', () => {
    const j = Jugador.en({ mano: ['cataplasma'], tripulacion: [{ id: 'bucanero', heridas: 1, estados: ['sangrando'] }] })
    j.usar('cataplasma.jugar')
    expect(j.estados('bucanero')).toEqual([])
    expect(j.copia('bucanero').heridas).toBe(0)
  })
})

describe('¡Nadie se queda atrás! (revisión de Albert; antes «¡A por ellos!»)', () => {
  // «Interrupción: Cuando un Tripulante vaya a ser descartado por un efecto de juego, destina 3 [COM] para evitarlo.» Ya no
  // es una Prueba: Destina es un coste (agotas Tripulantes preparados cuya COM sume 3), sin Destino ni cartas de la mano.
  // «Leva forzosa» (COM 4) con la Vigía sola (1): falla y la va a descartar.
  const leva = (op: { tripulacion?: CartaId[]; capitanAgotado?: boolean } = {}) =>
    Jugador.enMision({
      misiones: ['ladron-I'],
      mazoPeligros: ['p2_grilletes', 'chubasco', 'calma', 'calma'],
      tripulacion: op.tripulacion ?? ['vigia', 'bucanero'],
      mano: ['a_por_ellos', 'ojo'],
      ...(op.capitanAgotado ? { capitan: { agotada: true } } : {}),
    })

  it('se llama así, y el ejemplo del reglamento: el Bucanero (2 + 1 de Diego) destina 3 COM y la Vigía no se descarta', () => {
    expect(nombreDe('a_por_ellos')).toBe('¡Nadie se queda atrás!')
    // La Vigía (Vida 1) y el Carpintero de a bordo (Vida 2) asignados: se va a descartar la Vigía, la de menos Vida.
    const j = leva({ tripulacion: ['vigia', 'carpintero', 'bucanero'] })
    j.comprometer('COM', ['vigia', 'carpintero']).seguir()
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(true)
    j.usar('a_por_ellos.jugar')
    // Coste impreso (1 carta) y Destina 3 COM, en el orden en que los pida el motor.
    for (let i = 0; i < 3 && j.decision.tipo !== 'ventanaAccion'; i++) {
      if (j.decision.tipo === 'cubrirDistancia') {
        expect(j.decision.motivo).toMatchObject({ clave: 'destina', n: 3, texto: 'COM' })
        j.cubrir('bucanero')
      } else if (j.decision.tipo === 'elegirCartas' && j.decision.motivo.clave === 'pagar') j.elegir('ojo')
      else break
    }
    expect(j.copia('bucanero').agotada).toBe(true)
    expect(j.zona('tripulacion')).toEqual(expect.arrayContaining(['vigia', 'carpintero']))
    expect(j.registro).toContain('Vigía inexperta no se descarta.')
    expect(j.registro.some((t) => t.startsWith('Destinas 3 de COM'))).toBe(true)
    // No es una Prueba: no se revela otro Destino.
    expect(j.zona('destino').length + j.zona('descartesPeligros').filter((c) => c === 'calma').length).toBeLessThanOrEqual(1)
    expect(j.zona('descartesCapitan')).toEqual(expect.arrayContaining(['a_por_ellos', 'ojo']))
  })

  it('si pasas, se descarta; no se ofrece si los preparados no suman 3 de COM', () => {
    const j = leva()
    j.comprometer('COM', ['vigia']).seguir().pasarOfertas()
    expect(j.zona('descartesMuelle')).toContain('vigia')
    // Diego agotado y solo queda el Grumete leal preparado: no llega a 3.
    const k = leva({ tripulacion: ['vigia', 'grumete'], capitanAgotado: true })
    k.comprometer('COM', ['vigia']).seguir()
    expect(k.ofreceCapacidad('a_por_ellos.jugar')).toBe(false)
  })

  it('vale contra cualquier efecto de juego (no solo Peligros y permanentes), y no fuera de un descarte', () => {
    const j = Jugador.en({ tripulacion: ['vigia', 'bucanero'], mano: ['a_por_ellos', 'ojo'] })
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(false)
    const s = j.estado
    descartarTripulante(s, j.inst('vigia'), undefined)
    s.pendiente = null
    ejecutar(s)
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(true)
  })
})

describe('Ron para los valientes', () => {
  it('Acción: un Tripulante queda Borracho y Aguerrido', () => {
    const j = Jugador.en({ mano: ['ron_valientes'], tripulacion: ['bucanero'] })
    j.usar('ron_valientes.jugar').elegir('bucanero')
    expect(j.estados('bucanero')).toEqual(['borracho', 'aguerrido'])
  })
})

describe('Virar y dar la cara (revisión de Albert)', () => {
  // «Respuesta: [Mar]: Después de que reveles una carta de Peligro cuyo encuentro tenga una Prueba de [NAV], agota un
  // Cañón: esa Prueba es de [COM] en lugar de [NAV].» El ejemplo de Albert: sale un encuentro de NAV 4 («Turbonada a
  // popa»), agotas la Culebrina de proa y se resuelve como COM 4 con los mismos asignados y modificadores.
  const turbonada = (op: { misiones?: string[]; mejoras?: CartaId[] } = {}) =>
    Jugador.enMision({
      misiones: op.misiones ?? ['pruebas-mar5'],
      mazoPeligros: ['p2_turbonada', 'calma', 'calma', 'calma'],
      tripulacion: ['bucanero'],
      mano: ['virar'],
      barco: { mejoras: op.mejoras ?? ['culebrina', 'bronce'] },
    })

  it('el ejemplo: NAV 4 pasa a COM 4 agotando la Culebrina de proa', () => {
    const j = turbonada()
    expect(j.ofreceCapacidad('virar.jugar')).toBe(true)
    j.usar('virar.jugar')
    if (j.decision.tipo === 'elegirCartas') j.elegir('culebrina')
    expect(j.copia('culebrina').agotada).toBe(true)
    expect(j.copia('bronce').agotada).toBe(false)
    expect(j.registro).toContain('Viráis y dais la cara: la Prueba de NAV de este encuentro es de COM.')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', opciones: [{ hab: 'COM', dificultad: 4 }] })
    j.comprometer('COM', ['capitan', 'bucanero'])
    expect(j.estado.prueba?.hab).toBe('COM')
    // Diego 3 + Bucanero 2 (los dos asignados: Diego ya no da su +1): 5 contra 4, la misma dificultad.
    expect(totalSinDestinoPrueba(j.estado)).toBe(5)
    expect(j.estado.prueba?.dificultadBase).toBe(4)
    // Los Cañones de bronce (COM, en el Mar) sí se pueden usar en esa Prueba.
    expect(j.ofreceCapacidad('bronce.disparar')).toBe(true)
  })

  it('ejemplo del reglamento (Persigue): el Destino de «La sombra de Bastián» la pone encima; «Velas a popa» (NAV 4) pasa a COM 4 agotando los Cañones de bronce', () => {
    // «Chubasco repentino» (NAV) con el Destino de «La sombra de Bastián» (−1, Persigue): su carta es el siguiente encuentro.
    const j = Jugador.enMision({
      misiones: ['pruebas-mar5'],
      mazoPeligros: ['chubasco', 'p2_bastian', 'calma', 'calma', 'calma'],
      tripulacion: ['bucanero'],
      mano: ['virar'],
      barco: { mejoras: ['bronce'] },
    })
    j.pasarOfertas().comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_bastian')
    j.seguir()
    expect(j.registro).toContain('Revelas «La sombra de Bastián»: Velas a popa (Mar). Te ha alcanzado.')
    expect(j.ofreceCapacidad('virar.jugar')).toBe(true)
    j.usar('virar.jugar')
    if (j.decision.tipo === 'elegirCartas') j.elegir('bronce')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.decision).toMatchObject({ tipo: 'comprometer', opciones: [{ hab: 'COM', dificultad: 4 }] })
    j.comprometer('COM', ['bucanero'])
    expect(j.estado.prueba?.hab).toBe('COM')
  })

  it('P122: la Prueba pasa a ser de COM a todos los efectos: suman los modificadores de COM (Bandera negra) y ya no los de NAV (Desarbolado)', () => {
    // El ejemplo de P122: Bandera negra («[mar]: Tus Pruebas de COM reciben +1») y el Barco Desarbolado («[mar]: Tus
    // Pruebas de NAV reciben −1»). Se vira «Turbonada a popa» (NAV 4) agotando la Culebrina de proa.
    const mesa = () =>
      Jugador.enMision({
        misiones: ['pruebas-mar5'],
        mazoPeligros: ['p2_turbonada', 'calma', 'calma', 'calma'],
        tripulacion: ['bucanero'],
        mano: ['virar'],
        barco: { mejoras: ['culebrina', 'bandera'], estados: ['velasRotas'] },
      })
    const j = mesa()
    j.usar('virar.jugar')
    if (j.decision.tipo === 'elegirCartas') j.elegir('culebrina')
    j.comprometer('COM', ['capitan'])
    // Diego COM 3 + 1 de la Bandera negra; el −1 de Desarbolado (NAV) ya no resta, ni el +1 del Barco (NAV) suma.
    expect(totalSinDestinoPrueba(j.estado)).toBe(4)
    expect(j.estado.prueba?.dificultadBase).toBe(4)
    // Sin virar, la misma Prueba de NAV: Diego NAV 2 + 1 del Barco − 1 de Desarbolado; la Bandera no suma.
    const k = mesa()
    k.pasarOfertas().comprometer('NAV', ['capitan'])
    expect(totalSinDestinoPrueba(k.estado)).toBe(2)
  })

  it('solo en el Mar, con un Cañón preparado y si el encuentro tiene Prueba de NAV', () => {
    expect(turbonada({ mejoras: [] }).ofreceCapacidad('virar.jugar')).toBe(false)
    expect(turbonada({ mejoras: [{ id: 'culebrina', agotada: true } as unknown as CartaId] }).ofreceCapacidad('virar.jugar')).toBe(false)
    // En Ciudad («Cobrar la deuda»), no.
    const ciudad = Jugador.enMision({ mazoPeligros: ['p2_turbonada', 'calma', 'calma'], mano: ['virar'], barco: { mejoras: ['culebrina'] } })
    expect(ciudad.ofreceCapacidad('virar.jugar')).toBe(false)
    // Un encuentro del Mar sin Prueba de NAV («Pelea de taberna» en el Mar es de COM): no.
    const com = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['rivales', 'calma', 'calma'], mano: ['virar'], barco: { mejoras: ['culebrina'] } })
    expect(com.ofreceCapacidad('virar.jugar')).toBe(false)
  })

  it('ya no tiene nada que ver con Persigue: la carta que persigue va encima del mazo como siempre', () => {
    // «Chubasco repentino» (NAV) con «Turbonada a popa» de Destino, que persigue: va encima del mazo de Peligros.
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['chubasco', 'p2_turbonada', 'calma', 'racha'], mano: ['virar'], barco: { mejoras: ['bronce'] } })
    j.pasarOfertas().comprometer('NAV', ['capitan']).seguir()
    expect(j.zona('mazoPeligros')[0]).toBe('p2_turbonada')
    expect(j.copia('bronce').agotada).toBe(false)
  })
})
