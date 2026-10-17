// Cartas de jugador 2.0 (fase 6): una prueba (al menos) por carta, con el ejemplo del documento cuando lo hay.

import { describe, expect, it } from 'vitest'
import { registrarPeligro } from './capacidades/peligros.ts'
import { DATOS } from './datos.ts'
import { dificultadPrueba } from './prueba.ts'
import { Jugador } from './pruebas/situacion.ts'

// Una carta de Peligro que se queda en juego (de nivel Leve) para «Cortar por lo sano», solo en este fichero.
registrarPeligro('percances', { encuentros: { mar: { queda: { quitar: [] } } } })

describe('Herbolaria', () => {
  it('Agotar: quita Envenenado, Fiebre o Sangrando a un Tripulante (si tiene varios, eliges cuál)', () => {
    const j = Jugador.en({ tripulacion: ['herbolaria', { id: 'bucanero', estados: ['envenenado', 'fiebre'] }] })
    j.usar('herbolaria.quitar')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'cualEstado' } })
    j.opcion('envenenado')
    expect(j.estados('bucanero')).toEqual(['fiebre'])
    expect(j.copia('herbolaria').agotada).toBe(true)
  })

  it('no se ofrece si nadie tiene esos Estados', () => {
    const j = Jugador.en({ tripulacion: ['herbolaria', { id: 'bucanero', estados: ['buscado'] }] })
    expect(j.ofreceCapacidad('herbolaria.quitar')).toBe(false)
  })
})

describe('Práctico del puerto', () => {
  it('Respuesta: tras superar una Prueba de NAV en la que participe, quita Vía de agua o Velas rotas', () => {
    const j = Jugador.enMision({ misiones: ['maracaibo-II'], mazoPeligros: ['chubasco', 'chubasco', 'calma'], tripulacion: ['practico'], barco: { estados: ['velasRotas'] } })
    j.comprometer('NAV', ['practico']).seguir()
    expect(j.ofreceCapacidad('practico.barco')).toBe(true)
    j.usar('practico.barco')
    expect(j.estadosBarco).toEqual([])
  })

  it('lleva el Rasgo Piloto (como el Viejo lobo de mar)', () => {
    expect(DATOS.tripulantes.find((t) => t.id === 'practico')?.rasgos).toEqual(['Marinero', 'Piloto'])
    expect(DATOS.tripulantes.find((t) => t.id === 'viejo_lobo')?.rasgos).toContain('Piloto')
  })
})

describe('La Lengua', () => {
  it('los encuentros Civil en los que participa reciben −1 de dificultad', () => {
    const j = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['civiles', 'chubasco', 'calma'], tripulacion: ['lengua'] })
    j.comprometer('EXP', ['lengua'])
    expect(dificultadPrueba(j.estado)).toBe(2) // EXP 3 − 1
    const k = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['civiles', 'chubasco', 'calma'], tripulacion: ['lengua'] })
    k.comprometer('EXP', ['capitan'])
    expect(dificultadPrueba(k.estado)).toBe(3)
  })
})

describe('Fiador de la Hermandad', () => {
  it('Interrupción: queda rehén en lugar de otro; si lo rescatas, robas 2', () => {
    const j = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['p2_maremoto', 'chubasco', 'calma', 'calma', 'calma'], tripulacion: ['isabela', 'fiador'] })
    j.comprometer('COM', ['isabela']).seguir()
    expect(j.ofreceCapacidad('fiador.rehen')).toBe(true)
    j.usar('fiador.rehen')
    expect(j.zona('rehenes')).toEqual(['fiador'])
    expect(j.zona('tripulacion')).toContain('isabela')
    // Superas la misión: lo rescatas y robas 2.
    j.seguir()
    expect(j.zona('tripulacion')).toContain('fiador')
    expect(j.registro.filter((r) => r.startsWith('Robas 2')).length).toBeGreaterThan(0)
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
  it('Acción: descarta 2 cartas (más su coste de 1) para descartar una carta de Peligro en juego que no sea Terrible', () => {
    const j = Jugador.enMision({ misiones: ['maracaibo-II'], mazoPeligros: ['percances', 'calma'], mano: ['cortar', 'ojo', 'timon', 'coraje'] })
    expect(j.zona('peligrosEnJuego')).toEqual(['percances'])
    j.usar('cortar.jugar').elegir('ojo').elegir('timon', 'coraje')
    expect(j.zona('peligrosEnJuego')).toEqual([])
  })

  it('no se puede jugar sin 3 cartas más en la mano', () => {
    const j = Jugador.enMision({ misiones: ['maracaibo-II'], mazoPeligros: ['percances', 'calma'], mano: ['cortar', 'ojo', 'timon'] })
    expect(j.ofreceCapacidad('cortar.jugar')).toBe(false)
  })
})

describe('¡A por ellos!', () => {
  it('Acción: Prueba de COM 3; si la superas, rescatas a todos los rehenes y vuelven preparados', () => {
    const j = Jugador.enMision({ misiones: ['ladron-I'], mazoPeligros: ['p2_maremoto', 'chubasco', 'chubasco', 'calma'], tripulacion: ['bucanero', 'isabela'], mano: ['a_por_ellos', 'ojo'] })
    j.pasarOfertas().comprometer('COM', ['bucanero']).seguir()
    expect(j.zona('rehenes')).toEqual(['bucanero'])
    j.usar('a_por_ellos.jugar').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'comprometer', motivo: { clave: 'comprometerAccion' } })
    j.comprometer('COM', ['isabela']).pasarOfertas().seguir()
    expect(j.zona('rehenes')).toEqual([])
    expect(j.copia('bucanero').agotada).toBe(false)
  })

  it('solo se juega durante una misión', () => {
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
  it('Interrupción: gasta 1 munición y la carta que persigue va al fondo del mazo en vez de encima', () => {
    const j = Jugador.enMision({
      misiones: ['maracaibo-II'],
      mazoPeligros: ['chubasco', 'p2_turbonada', 'calma', 'racha'],
      mano: ['virar'],
      barco: { mejoras: [{ id: 'bronce', municion: 2 }] },
    })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.ofreceCapacidad('virar.jugar')).toBe(true)
    j.usar('virar.jugar')
    expect(j.copia('bronce').municion).toBe(1)
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'racha', 'p2_turbonada'])
  })
})
