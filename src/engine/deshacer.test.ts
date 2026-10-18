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

  it('rechaza las partidas guardadas antes de las misiones 2.0 (sin Pasajeros, o con capítulos que ya no existen)', () => {
    const s = montar({ escenario: ['calma_ev'] })
    const sinPasajeros = JSON.parse(serializar(s)) as { zonas: Record<string, unknown> }
    delete sinPasajeros.zonas.pasajeros
    expect(() => deserializar(JSON.stringify(sinPasajeros))).toThrow(/versión/)
    const conCapituloAntiguo = JSON.parse(serializar(s)) as { cartas: Record<string, { id: string }> }
    const historia = s.zonas.mazoHistoria[0]
    if (historia) conCapituloAntiguo.cartas[historia] = { ...conCapituloAntiguo.cartas[historia]!, id: 'maracaibo-II' }
    expect(() => deserializar(JSON.stringify(conCapituloAntiguo))).toThrow(/versión/)
  })
})
