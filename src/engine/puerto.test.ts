import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'

describe('Quedarte en puerto (Tortuga)', () => {
  it('eliges dos opciones distintas de la carta de puerto', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar' })
    j.opcion('quedarse')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'opcionPuerto', n: 1 } })
    const claves = (d: typeof j.decision) => (d.tipo === 'elegirOpcion' ? d.opciones.map((o) => o.clave) : [])
    expect(claves(j.decision)).toEqual(['astillero', 'taberna', 'tablon', 'propia'])
    j.opcion('astillero')
    expect(claves(j.decision)).toEqual(['taberna', 'tablon', 'propia'])
    j.opcion('taberna')
    expect(j.decision.motivo.clave).toBe('descartarFinal')
  })

  it('Astillero repara 3 daños', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', barco: { dano: 4 } })
    j.opcion('quedarse').opcion('astillero')
    expect(j.estado.danoBarco).toBe(1)
  })

  it('Taberna cura 3 heridas; si hay más, las repartes como quieras', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', capitan: { heridas: 2 }, tripulacion: [{ id: 'bucanero', heridas: 1 }, { id: 'contrabandista', heridas: 1 }] })
    j.opcion('quedarse').opcion('taberna')
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 3 })
    j.repartir({ capitan: 2, contrabandista: 1 })
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('contrabandista').heridas).toBe(0)
  })

  it('Tablón de encargos: mandas al fondo las misiones que quieras (pierden su Avance) y repones', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', mazoMisiones: ['templo-I', 'flota-I'] })
    j.estado.cartas[j.inst('deuda-I')]!.avance = 2
    j.opcion('quedarse').opcion('tablon').elegir('deuda-I')
    expect(j.zona('misionesDisponibles')).toEqual(['prueba-I', 'aguada-I', 'templo-I'])
    expect(j.zona('mazoMisiones')).toEqual(['flota-I', 'deuda-I'])
    expect(j.copia('deuda-I').avance).toBe(0)
  })

  it('Soplos de la Hermandad: pon 2 de Avance en una misión disponible; se quedan para cuando zarpes', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', mazoCapitan: ['ojo', 'ojo', 'ojo', 'ojo', 'ojo', 'ojo'] })
    j.opcion('quedarse').opcion('propia').elegir('aguada-I')
    expect(j.copia('aguada-I').avance).toBe(2)
    j.opcion('astillero').ninguna()
    expect(j.copia('aguada-I').avance).toBe(2)
  })
})
