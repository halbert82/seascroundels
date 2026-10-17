import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'

describe('Valores calculados', () => {
  it('Diego da +1 NAV, COM y EXP a los demás mientras está preparado; a sí mismo, no', () => {
    const j = Jugador.en({ tripulacion: ['bucanero'] })
    const bucanero = j.inst('bucanero')
    expect(j.valor({ tipo: 'habilidad', carta: bucanero, hab: 'NAV' })).toBe(2)
    expect(j.valor({ tipo: 'habilidad', carta: bucanero, hab: 'COM' })).toBe(3)
    expect(j.valor({ tipo: 'habilidad', carta: bucanero, hab: 'EXP' })).toBe(1)
    expect(j.valor({ tipo: 'habilidad', carta: j.estado.capitan, hab: 'COM' })).toBe(3)
  })

  it('con Diego agotado, el +1 desaparece al momento', () => {
    const j = Jugador.en({ capitan: { agotada: true }, tripulacion: ['bucanero'] })
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'NAV' })).toBe(1)
  })

  it('las Mejoras de tripulante suman a su portador; agotadas no aplican su texto', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['sable'] }, { id: 'marinero_p', mejoras: ['coleto'] }] })
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })).toBe(4)
    expect(j.valor({ tipo: 'vida', carta: j.inst('marinero_p') })).toBe(2)
    j.estado.cartas[j.inst('sable')]!.agotada = true
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })).toBe(3)
  })

  it('la Espada del sacerdote da +2 COM a su portador', () => {
    const j = Jugador.en({ capitan: { mejoras: ['espada'] } })
    expect(j.valor({ tipo: 'habilidad', carta: j.estado.capitan, hab: 'COM' })).toBe(5)
  })

  it('Casco reforzado y Mascarón suben el Daño máximo; Hamacas, la Capacidad', () => {
    const j = Jugador.en({ barco: { mejoras: ['casco', 'hamacas', 'mascaron'] } })
    expect(j.valor({ tipo: 'danoMaximo' })).toBe(7)
    expect(j.valor({ tipo: 'capacidad' })).toBe(5)
    expect(j.valor({ tipo: 'espacio' })).toBe(5)
  })

  it('el Barco resta 1 a la Distancia de las misiones lejanas, nunca por debajo de 0', () => {
    const j = Jugador.en({ misiones: ['aguada-I', 'deuda-I', 'prueba-I'] })
    expect(j.valor({ tipo: 'distancia', mision: j.inst('aguada-I') })).toBe(0) // 1 − 1
    expect(j.valor({ tipo: 'distancia', mision: j.inst('deuda-I') })).toBe(0)
    expect(j.valor({ tipo: 'distancia', mision: j.inst('prueba-I') })).toBe(0)
  })

  it('el Mapa de las calas resta 1 al Avance que necesitan las misiones de Naturaleza', () => {
    const j = Jugador.en({ barco: { mejoras: ['mapa_calas'] }, misiones: ['aguada-I', 'deuda-I'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('aguada-I') })).toBe(2)
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('deuda-I') })).toBe(3)
  })

  it('−1 Mando: este turno robas hasta una carta menos', () => {
    const j = Jugador.en({ temporales: [{ clave: 'menosMando', fuente: 'chubasco', hasta: 'finTurno' }] })
    expect(j.valor({ tipo: 'mando' })).toBe(4)
  })
})
