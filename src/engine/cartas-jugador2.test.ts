// Cartas de jugador 2.0 (fase 6): una prueba (al menos) por carta, con el ejemplo del documento cuando lo hay.

import { describe, expect, it } from 'vitest'
import { registrarPeligro, registrarPermanente } from './capacidades/peligros.ts'
import { DATOS } from './datos.ts'
import { ejecutar } from './motor.ts'
import { descartarTripulante } from './tareas/peligros2.ts'
import type { CartaId } from './tipos.ts'

import { Jugador, PERMANENTE_DE_PRUEBA, dificultadConDestino } from './pruebas/situacion.ts'

// Una carta de Peligro que pone en juego una permanente (sin forma de quitarla) para «Cortar por lo sano», solo en este
// fichero.
registrarPermanente(PERMANENTE_DE_PRUEBA, { quitar: [] })
registrarPeligro('percances', { encuentros: { mar: { pone: { carta: PERMANENTE_DE_PRUEBA } } } })

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

describe('Cortar por lo sano', () => {
  it('fase 11 · Acción: descarta 2 cartas (su coste es 0) para devolver al mazo de historia una carta de la zona de permanentes', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], mano: ['cortar', 'ojo', 'timon', 'coraje'] })
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
    j.usar('cortar.jugar').elegir('timon', 'coraje')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain(PERMANENTE_DE_PRUEBA)
    expect(j.zona('mano')).toEqual(['ojo'])
  })

  it('fase 10b: también las que antes eran de nivel Terrible («La cadena de la bocana»)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['p2_morro', 'calma'], mano: ['cortar', 'ojo', 'timon', 'coraje'] })
    expect(j.zona('permanentes')).toEqual(['pm_cadena'])
    j.usar('cortar.jugar').elegir('timon', 'coraje')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('pm_cadena')
  })

  it('con dos permanentes en juego, el jugador elige cuál devuelve', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['p2_morro', 'percances', 'calma'], mano: ['cortar', 'ojo', 'timon', 'coraje'] })
    j.seguir()
    expect(j.zona('permanentes')).toEqual(['pm_cadena', PERMANENTE_DE_PRUEBA])
    j.usar('cortar.jugar').elegir('timon', 'coraje')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'quitarPermanente' } })
    j.elegir('pm_cadena')
    expect(j.zona('permanentes')).toEqual([PERMANENTE_DE_PRUEBA])
  })

  it('no se puede jugar sin 2 cartas más en la mano', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['percances', 'calma'], mano: ['cortar', 'ojo'] })
    expect(j.ofreceCapacidad('cortar.jugar')).toBe(false)
  })
})

describe('¡A por ellos!', () => {
  // Fase 14 (fuera el rehén): «Interrupción: Cuando una carta de Peligro vaya a descartar a un Tripulante, haz una Prueba
  // de COM 3. Si la superas, no se descarta.» «Leva forzosa» (COM 4) con la Vigía sola (1): falla y la va a descartar.
  // La Prueba de la leva queda en suspenso (su Destino, en la mesa) mientras se hace la de «¡A por ellos!».
  const leva = (destino: CartaId) =>
    Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['p2_grilletes', 'chubasco', destino, 'calma', 'calma'], tripulacion: ['vigia', 'bucanero'], mano: ['a_por_ellos', 'ojo'] })

  it('Interrupción: Prueba de COM 3 en mitad de la otra; si la superas, no se descarta y se sigue con la leva', () => {
    const j = leva('calma')
    j.comprometer('COM', ['vigia']).seguir()
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(true)
    j.usar('a_por_ellos.jugar').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', motivo: { clave: 'comprometerAccion' } })
    expect(j.zona('destino')).toEqual(['chubasco'])
    // El Bucanero veterano, que se quedó a bordo: 2 + 1 de Diego = 3 contra 3 (Destino de «calma»: +0).
    j.comprometer('COM', ['bucanero']).pasarOfertas()
    expect([...j.zona('destino')].sort()).toEqual(['calma', 'chubasco'])
    j.seguir().pasarOfertas()
    expect(j.zona('tripulacion')).toContain('vigia')
    expect(j.registro).toContain('Vigía inexperta no se descarta.')
    expect(j.zona('descartesCapitan')).toEqual(expect.arrayContaining(['a_por_ellos', 'ojo']))
    // Se sigue con la leva: su Prueba se cierra y su Destino también va a los descartes.
    expect(j.estado.prueba).toBeNull()
    expect(j.zona('destino')).toEqual([])
    expect(j.zona('descartesPeligros')).toEqual(expect.arrayContaining(['p2_grilletes', 'chubasco', 'calma']))
  })

  it('si no la superas, se descarta igual', () => {
    const j = leva('fauna') // Destino −1: el Bucanero suma 2 contra 3.
    j.comprometer('COM', ['vigia']).seguir().usar('a_por_ellos.jugar').elegir('ojo')
    j.comprometer('COM', ['bucanero']).pasarOfertas().seguir().pasarOfertas()
    expect(j.zona('descartesMuelle')).toContain('vigia')
  })

  it('no se ofrece fuera de un descarte (en puerto no hay ninguno)', () => {
    const j = Jugador.en({ mano: ['a_por_ellos', 'ojo'] })
    expect(j.ofreceCapacidad('a_por_ellos.jugar')).toBe(false)
  })
})

describe('Ron para los valientes', () => {
  it('Acción: un Tripulante queda Borracho y Aguerrido', () => {
    const j = Jugador.en({ mano: ['ron_valientes'], tripulacion: ['bucanero'] })
    j.usar('ron_valientes.jugar').elegir('bucanero')
    expect(j.estados('bucanero')).toEqual(['borracho', 'aguerrido'])
  })
})

describe('Virar y dar la cara', () => {
  it('Interrupción: agota un Cañón y la carta que persigue va al fondo del mazo en vez de encima (fase 10b)', () => {
    const j = Jugador.enMision({
      misiones: ['pruebas-mar5'],
      mazoPeligros: ['chubasco', 'p2_turbonada', 'calma', 'racha'],
      mano: ['virar'],
      barco: { mejoras: ['bronce'] },
    })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.ofreceCapacidad('virar.jugar')).toBe(true)
    j.usar('virar.jugar')
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'racha', 'p2_turbonada'])
  })
})
