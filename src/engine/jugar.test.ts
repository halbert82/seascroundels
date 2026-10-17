import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'

describe('Pagar un coste', () => {
  it('se paga descartando de la mano tantas cartas como indica el timón; van a los descartes del capitán', () => {
    const j = Jugador.en({ mano: ['ojo', 'timon', 'abordaje'], muelle: ['bucanero'] })
    j.reclutar('bucanero')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 2, max: 2, motivo: { clave: 'pagar', carta: 'bucanero', n: 2 } })
    j.elegir('ojo', 'abordaje')
    expect(j.zona('mano')).toEqual(['timon'])
    expect(j.zona('descartesCapitan')).toEqual(['abordaje', 'ojo'])
    expect(j.registro).toContain('Pagas 2 por «Bucanero veterano»: Ojo avizor, ¡Al abordaje!.')
  })

  it('no se ofrece lo que no puedes pagar', () => {
    const j = Jugador.en({ mano: ['ojo'], muelle: ['bucanero', 'marinero_p'] })
    expect(j.ofrece('reclutar', 'bucanero')).toBe(false)
    expect(j.ofrece('reclutar', 'marinero_p')).toBe(true)
  })

  it('el Ron de la reserva cuesta 0', () => {
    const j = Jugador.en({ mano: [], muelle: ['ron_reserva'] })
    j.adquirir('ron_reserva', 'capitan')
    expect(j.zonaDe('ron_reserva')).toBe('mejoras')
  })
})

describe('Reclutar', () => {
  it('el Tripulante entra en juego preparado y deja vacío su hueco del muelle', () => {
    const j = Jugador.en({ mano: ['ojo'], muelle: ['marinero_p', 'sable'] })
    j.reclutar('marinero_p').elegir('ojo')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'marinero_p'])
    expect(j.copia('marinero_p').agotada).toBe(false)
    expect(j.zona('muelle')).toEqual(['sable'])
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('el Barco no puede llevar más Tripulantes que su Capacidad; el Capitán no cuenta', () => {
    const cuatro = ['marinero_p', 'grumete', 'bucanero', 'carpintero']
    const j = Jugador.en({ mano: ['ojo', 'ojo'], muelle: ['saqueador'], tripulacion: cuatro })
    expect(j.ofrece('reclutar', 'saqueador')).toBe(false)
    const conHamacas = Jugador.en({ mano: ['ojo'], muelle: ['saqueador'], tripulacion: cuatro, barco: { mejoras: ['hamacas'] } })
    expect(conHamacas.ofrece('reclutar', 'saqueador')).toBe(true)
  })

  it('no puede haber en juego dos copias de una carta única (★)', () => {
    const j = Jugador.en({ mano: ['ojo', 'ojo', 'ojo'], muelle: ['isabela'], tripulacion: ['isabela'] })
    expect(j.ofrece('reclutar', 'isabela')).toBe(false)
  })
})

describe('Adquirir', () => {
  it('una Mejora de barco necesita tanto Espacio libre como cuadros tenga', () => {
    // Espacio 5: Cañones (2) + Carronadas (2) = 4; queda 1.
    const j = Jugador.en({ mano: ['ojo', 'ojo', 'ojo'], muelle: ['casco', 'vela', 'bandera'], barco: { mejoras: ['bronce', 'carronadas'] } })
    expect(j.ofrece('adquirir', 'casco')).toBe(false)
    expect(j.ofrece('adquirir', 'vela')).toBe(true)
    expect(j.ofrece('adquirir', 'bandera')).toBe(true) // Espacio 0
  })

  it('se vincula al Barco y no ocupa el sitio de nadie', () => {
    const j = Jugador.en({ mano: ['ojo'], muelle: ['vela'] })
    j.adquirir('vela', 'barco').elegir('ojo')
    expect(j.copia('vela').vinculadaA).toBe('barco')
    expect(j.registro).toContain('Adquieres «Vela mayor» para el Barco.')
  })

  it('una Mejora de tripulante necesita un hueco de Mejora libre en ese Tripulante', () => {
    const j = Jugador.en({ mano: ['ojo'], muelle: ['sable'], tripulacion: ['grumete', 'bucanero'] })
    expect(j.ofrece('adquirir', 'sable', 'grumete')).toBe(false) // 0 huecos
    expect(j.ofrece('adquirir', 'sable', 'bucanero')).toBe(true)
    expect(j.ofrece('adquirir', 'sable', 'capitan')).toBe(true)
    j.adquirir('sable', 'bucanero').elegir('ojo')
    expect(j.copia('sable').vinculadaA).toBe(j.inst('bucanero'))
  })

  it('las fichas de Entrenamiento ocupan hueco; los Tesoros no', () => {
    const entrenado = Jugador.en({ mano: ['ojo'], muelle: ['sable'], tripulacion: [{ id: 'bucanero', entrenamiento: ['COM'] }] })
    expect(entrenado.ofrece('adquirir', 'sable', 'bucanero')).toBe(false)
    const conTesoro = Jugador.en({ mano: ['ojo'], muelle: ['sable'], tripulacion: [{ id: 'bucanero', mejoras: ['espada'] }] })
    expect(conTesoro.ofrece('adquirir', 'sable', 'bucanero')).toBe(true)
  })

  it('la Patente de corso solo puede llevarla el Capitán', () => {
    const j = Jugador.en({ mano: ['ojo', 'ojo'], muelle: ['patente'], tripulacion: ['bucanero'] })
    expect(j.ofrece('adquirir', 'patente', 'bucanero')).toBe(false)
    expect(j.ofrece('adquirir', 'patente', 'capitan')).toBe(true)
  })
})

describe('Despedir', () => {
  it('el Tripulante va a los descartes del muelle junto con sus Mejoras', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['sable'], heridas: 1 }] })
    j.despedir('bucanero')
    expect(j.zona('tripulacion')).toEqual(['capitan'])
    expect(j.zona('descartesMuelle').sort()).toEqual(['bucanero', 'sable'])
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('no puedes despedir al Capitán', () => {
    const j = Jugador.en({ tripulacion: ['bucanero'] })
    expect(j.ofrece('despedir', 'capitan')).toBe(false)
    expect(j.ofrece('despedir', 'bucanero')).toBe(true)
  })

  it('N1: sus Tesoros pasan al Tripulante que elijas, Capitán incluido, y nunca al mazo de muelle', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['espada', 'sable'] }, 'marinero_p'] })
    j.despedir('bucanero')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'reasignarTesoro', carta: 'espada' } })
    j.elegir('capitan')
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
    expect(j.zona('descartesMuelle').sort()).toEqual(['bucanero', 'sable'])
  })
})
