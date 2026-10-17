import { describe, expect, it } from 'vitest'
import { Jugador } from './pruebas/situacion.ts'

const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'abordaje', 'abordaje', 'estrellas', 'estrellas']

/** Empieza un turno revelando esa carta de Escenario (con otra detrás, para que no sea el último). */
function revelar(carta: string, extra: Parameters<typeof Jugador.en>[0] = {}) {
  return Jugador.en({ empezarEn: 'inicio', escenario: [carta, 'calma_ev'], mazoCapitan: [...MAZO], ...extra })
}

describe('Cartas de Escenario', () => {
  it('Mercado próspero: revela 2 cartas más al muelle; al reponerlo vuelve a su tamaño', () => {
    const j = revelar('mercado', { muelle: ['sable', 'vela', 'loro', 'casco'], mazoMuelle: ['bandera', 'chalupa', 'botica', 'viveres', 'cruz', 'bronce'] })
    expect(j.zona('muelle')).toEqual(['sable', 'vela', 'loro', 'casco', 'bandera', 'chalupa'])
    j.terminar()
    expect(j.zona('muelle')).toEqual(['botica', 'viveres', 'cruz', 'bronce'])
  })

  it('Astillero ocioso: repara 2', () => {
    expect(revelar('astillero', { barco: { dano: 3 } }).estado.danoBarco).toBe(1)
  })

  it('Impuestos del gobernador: eliges una Mejora y la pierdes', () => {
    const j = revelar('impuestos', { barco: { mejoras: ['vela', 'bandera'] }, tripulacion: [{ id: 'bucanero', mejoras: ['sable'] }] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 1, max: 1, motivo: { clave: 'perderMejora' } })
    j.elegir('sable')
    expect(j.zona('descartesMuelle')).toEqual(['sable'])
    expect(j.zona('mejoras').sort()).toEqual(['bandera', 'vela'])
  })

  it('Impuestos del gobernador: los Tesoros y las indestructibles no se pierden', () => {
    const j = revelar('impuestos', { barco: { mejoras: ['cruz', 'mascaron'] }, capitan: { mejoras: ['espada'] } })
    expect(j.zona('mejoras').sort()).toEqual(['cruz', 'espada', 'mascaron'])
    expect(j.registro).toContain('No tienes ninguna Mejora que se pueda perder.')
  })

  it('Marineros sin barco: buscas un Tripulante en el mazo de muelle; va al muelle y lo puedes reclutar ya', () => {
    const j = revelar('reclutas', { mano: ['ojo'], muelle: ['sable'], mazoMuelle: ['vela', 'marinero_p', 'casco', 'grumete'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buscar' } })
    const d = j.decision
    if (d.tipo !== 'elegirCartas') throw new Error()
    expect(d.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['grumete', 'marinero_p'])
    j.elegir('grumete')
    expect(j.zona('muelle')).toEqual(['sable', 'grumete'])
    expect(j.zona('mazoMuelle')).toHaveLength(3)
    j.reclutar('grumete').elegir('ojo')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'grumete'])
  })

  it('Noticias de un botín: robas 2', () => {
    const j = revelar('noticias', { mano: ['soborno'] })
    expect(j.zona('mano')).toEqual(['soborno', 'ojo', 'ojo'])
  })

  it('Bando del virrey: deja su efecto este turno', () => {
    const j = revelar('bando')
    expect(j.estado.temporales).toEqual([{ clave: 'bando.turno', fuente: 'bando', hasta: 'finTurno' }])
  })

  it('Deserción: descarta a tu Tripulante de menor coste con sus Mejoras', () => {
    const j = revelar('desercion', { tripulacion: [{ id: 'marinero_p', mejoras: ['sable'] }, 'bucanero'] })
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.zona('descartesMuelle').sort()).toEqual(['marinero_p', 'sable'])
  })

  it('Deserción: si hay empate, eliges tú; nunca el Capitán', () => {
    const j = revelar('desercion', { tripulacion: ['marinero_p', 'grumete', 'bucanero'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'desercion' } })
    j.elegir('grumete')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'marinero_p', 'bucanero'])
    const solo = revelar('desercion')
    expect(solo.zona('tripulacion')).toEqual(['capitan'])
  })

  it('Deserción: si el desertor llevaba un Tesoro, pasa a otro Tripulante (N1)', () => {
    const j = revelar('desercion', { tripulacion: [{ id: 'bucanero', mejoras: ['espada'] }] })
    expect(j.zona('descartesMuelle')).toEqual(['bucanero'])
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
  })

  it('Rumores del tesoro: deja su efecto este turno', () => {
    expect(revelar('rumores').estado.temporales.map((t) => t.clave)).toEqual(['rumores.turno'])
  })

  it('Escasez de pertrechos: al final de este turno robas hasta 2 cartas menos que tu Mando', () => {
    const j = revelar('escasez', { mano: [] })
    j.pasarTurnoEnPuerto()
    expect(j.zona('mano')).toHaveLength(3)
  })

  it('Carpinteros de ribera: buscas una Mejora de barco', () => {
    const j = revelar('ribera', { mazoMuelle: ['sable', 'vela', 'marinero_p'] })
    j.elegir('vela')
    expect(j.zona('muelle')).toEqual(['vela'])
  })

  it('Temporada de huracanes y Vientos alisios: cambian el Avance de las misiones de Mar este turno', () => {
    const huracanes = revelar('huracanes', { misiones: ['prueba-I', 'aguada-I'] })
    expect(huracanes.valor({ tipo: 'avanceNecesario', mision: huracanes.inst('prueba-I') })).toBe(4)
    expect(huracanes.valor({ tipo: 'avanceNecesario', mision: huracanes.inst('aguada-I') })).toBe(3)
    const alisios = revelar('alisios', { misiones: ['prueba-I'] })
    expect(alisios.valor({ tipo: 'avanceNecesario', mision: alisios.inst('prueba-I') })).toBe(2)
  })

  it('Feria en la isla: robas 1 y curas 1 a cada Tripulante', () => {
    const j = revelar('feria', { capitan: { heridas: 2 }, tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    expect(j.zona('mano')).toEqual(['ojo'])
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Días tranquilos: curas 1 a cada Tripulante', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['calma_ev', 'noticias'], capitan: { heridas: 3 }, tripulacion: [{ id: 'grumete', heridas: 0 }] })
    expect(j.copia('capitan').heridas).toBe(2)
    expect(j.copia('grumete').heridas).toBe(0)
  })
})
