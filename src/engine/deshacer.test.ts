import { describe, expect, it } from 'vitest'
import { conHistorial, deshacer, jugar, puedeDeshacer } from './deshacer.ts'
import { deserializar, serializar } from './guardado.ts'
import { responder } from './motor.ts'
import { montar } from './pruebas/situacion.ts'

describe('Deshacer', () => {
  it('deshace la última acción mientras no se haya revelado información nueva', () => {
    const inicial = montar({ mano: ['ojo', 'timon'], muelle: ['marinero_p'], tripulacion: ['bucanero'], mazoMuelle: ['vela', 'casco', 'sable', 'loro'] })
    let p = conHistorial(inicial)
    const d = p.estado.pendiente
    if (d?.tipo !== 'ventanaAccion') throw new Error()
    const reclutar = d.acciones.find((a) => a.tipo === 'reclutar')
    if (!reclutar) throw new Error()
    p = jugar(p, { tipo: 'accion', accion: reclutar })
    expect(p.estado.pendiente?.motivo.clave).toBe('pagar')
    expect(puedeDeshacer(p)).toBe(true)
    p = deshacer(p)
    expect(p.estado).toEqual(inicial)
  })

  it('no se puede deshacer después de revelar información (reponer el muelle revela cartas)', () => {
    let p = conHistorial(montar({ mazoMuelle: ['vela', 'casco', 'sable', 'loro'] }))
    p = jugar(p, { tipo: 'accion', accion: { tipo: 'terminarPaso' } })
    expect(puedeDeshacer(p)).toBe(false)
  })
})

describe('Guardado', () => {
  it('una partida guardada y recuperada sigue exactamente igual', () => {
    const s = montar({ mano: ['ojo'], muelle: ['marinero_p'], mazoMuelle: ['vela', 'casco', 'sable', 'loro'], escenario: ['calma_ev'] })
    const recuperada = deserializar(serializar(s))
    expect(recuperada).toEqual(s)
    const fin = { tipo: 'accion', accion: { tipo: 'terminarPaso' } } as const
    expect(responder(recuperada, fin)).toEqual(responder(s, fin))
  })

  it('rechaza partidas guardadas de otra versión', () => {
    expect(() => deserializar('{"version":2}')).toThrow()
  })
})
