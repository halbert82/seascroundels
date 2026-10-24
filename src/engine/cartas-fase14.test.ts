// Fase 14 · Rotación de la tripulación: la palabra clave Enrolado y los seis Tripulantes nuevos (241–246).

import { describe, expect, it } from 'vitest'

import { porId } from './catalogo.ts'
import { Jugador, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { Eleccion } from './tipos.ts'
import { valor } from './valores.ts'

const nuevas = ['soldado_fortuna', 'piloto_sueldo', 'guia_alquiler', 'carne_canon', 'galeote', 'tuerto']
const DIAS = ['pruebas-calma', 'pruebas-calma', 'pruebas-calma', 'pruebas-calma']
const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'ojo', 'timon', 'coraje', 'ojo']

/** La capacidad que usa el jugador automático con esta elección (null si no usa ninguna). */
const usada = (e: Eleccion): string | null => (e.tipo === 'usar' ? e.uso.clave : e.tipo === 'accion' && e.accion.tipo === 'usar' ? e.accion.uso.clave : null)

describe('Fase 14 · Los seis Tripulantes nuevos', () => {
  it('están en la colección (241–246) con sus números, y en el mazo de muelle de inicio', async () => {
    const { DATOS } = await import('./datos.ts')
    expect(nuevas.map((id) => porId(id).num)).toEqual([241, 242, 243, 244, 245, 246])
    for (const id of nuevas) expect(DATOS.mazosPredefinidos.mazoDeMuelle).toContain(id)
    const tuerto = porId('tuerto')
    expect(tuerto.tipo === 'tripulante' && tuerto.carta.unico).toBe(true)
  })
})

describe('Enrolado N', () => {
  it('al reclutarlo entra con N fichas; los demás Tripulantes no llevan', () => {
    const j = Jugador.en({ muelle: ['piloto_sueldo', 'bucanero'], mano: ['ojo', 'ojo', 'timon', 'timon'] })
    j.reclutar('piloto_sueldo').elegir('ojo', 'ojo')
    expect(j.zona('tripulacion')).toContain('piloto_sueldo')
    expect(j.copia('piloto_sueldo').enrolado).toBe(2)
    expect(j.registro).toContain('Piloto a sueldo se enrola por 2 turnos: 2 fichas de Enrolado.')
    j.reclutar('bucanero').elegir('timon', 'timon')
    expect(j.copia('bucanero').enrolado).toBeUndefined()
  })

  it('ejemplo del reglamento: reclutado en el turno 3, al final del turno 3 le queda 1 ficha y al final del turno 4 se va (sin zarpar)', () => {
    const j = Jugador.en({ turno: 3, muelle: ['piloto_sueldo'], mano: ['ojo', 'ojo', 'timon'], mazoCapitan: [...MAZO], escenario: [...DIAS] })
    j.reclutar('piloto_sueldo').elegir('ojo', 'ojo')
    j.pasarTurnoEnPuerto()
    expect(j.estado.turno).toBe(4)
    expect(j.copia('piloto_sueldo').enrolado).toBe(1)
    expect(j.registro).toContain('Piloto a sueldo: su Enrolado baja a 1.')
    j.pasarTurnoEnPuerto()
    expect(j.zona('tripulacion')).not.toContain('piloto_sueldo')
    expect(j.zona('descartesMuelle')).toContain('piloto_sueldo')
    expect(j.registro).toContain('Piloto a sueldo cumple su contrato y se va.')
  })

  it('zarpando: la ficha no se quita al terminar la misión, sino al final del turno; se va con sus Mejoras y no queda derrotado', () => {
    // «Chubasco repentino» (NAV 2, Avance 2): con 1 de Avance, la misión de 3 se supera.
    const j = Jugador.enMision({
      misiones: ['pruebas-mar3'],
      avance: { 'pruebas-mar3': 1 },
      tripulacion: [{ id: 'piloto_sueldo', enrolado: 1, mejoras: ['brujula'] }],
      mazoPeligros: ['chubasco', 'chubasco', 'calma'],
      mazoCapitan: [...MAZO],
      escenario: [...DIAS],
    })
    j.comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    expect(j.registro.some((r) => r.startsWith('¡Superas'))).toBe(true)
    // Ya en el Final de turno: sigue en la tripulación con su ficha.
    expect(j.zona('tripulacion')).toContain('piloto_sueldo')
    expect(j.copia('piloto_sueldo').enrolado).toBe(1)
    if (j.decision.motivo.clave === 'descartarFinal') j.ninguna()
    j.pasarOfertas()
    expect(j.zona('tripulacion')).not.toContain('piloto_sueldo')
    expect(j.zona('descartesMuelle')).toEqual(expect.arrayContaining(['piloto_sueldo', 'brujula']))
    expect(j.registro.some((r) => r.startsWith('Piloto a sueldo cumple su contrato y se va junto con'))).toBe(true)
    expect(j.estado.registro.some((r) => r.dato?.tipo === 'derrota')).toBe(false)
  })

})

describe('Carne de cañón', () => {
  it('sufre 1 herida: los demás asignados a la Prueba de COM (el Capitán también) reciben +1 COM; una vez por turno', () => {
    // «Piratas rivales» (COM 4): Diego 2, Carne de cañón 2 y Bucanero veterano 2 (Diego, asignado, ya no da su +1).
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['carne_canon', 'bucanero'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['capitan', 'carne_canon', 'bucanero'])
    const antes = totalSinDestinoPrueba(j.estado)
    expect(j.ofreceCapacidad('carne_canon.esfuerzo')).toBe(true)
    j.usar('carne_canon.esfuerzo')
    expect(j.copia('carne_canon').heridas).toBe(1)
    expect(totalSinDestinoPrueba(j.estado)).toBe(antes + 2)
    expect(j.ofreceCapacidad('carne_canon.esfuerzo')).toBe(false)
  })

  it('si la herida del coste la derrota, los demás conservan su +1 (el coste se da por pagado)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: [{ id: 'carne_canon', heridas: 1 }, 'bucanero'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['carne_canon', 'bucanero'])
    const bucanero = () => valor(j.estado, { tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })
    const antes = bucanero()
    j.usar('carne_canon.esfuerzo').pasarOfertas()
    expect(j.zona('tripulacion')).not.toContain('carne_canon')
    expect(bucanero()).toBe(antes + 1)
  })

  it('no se ofrece en una Prueba de NAV', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['carne_canon'], mazoPeligros: ['chubasco', 'fauna', 'calma'] })
    j.comprometer('NAV', ['carne_canon'])
    expect(j.ofreceCapacidad('carne_canon.esfuerzo')).toBe(false)
  })
})

describe('Galeote fugado', () => {
  it('coste 1, NAV 1 / COM 0 / EXP 0 y Vida 3 (fase 14, tercera ronda)', () => {
    const e = porId('galeote')
    expect(e.tipo === 'tripulante' && [e.carta.coste, e.carta.NAV, e.carta.COM, e.carta.EXP, e.carta.vida]).toEqual([1, 1, 0, 0, 3])
  })

  it('sufre 1 herida: recibe +2 NAV para esta Prueba; una vez por turno; en una Prueba de COM no se ofrece', () => {
    // «Chubasco repentino» (NAV 2): Galeote 1 + 1 de Diego + 1 del Barco = 3; con el esfuerzo, 5.
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: ['galeote'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.comprometer('NAV', ['galeote'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(3)
    j.usar('galeote.esfuerzo')
    expect(j.copia('galeote').heridas).toBe(1)
    expect(totalSinDestinoPrueba(j.estado)).toBe(5)
    expect(j.ofreceCapacidad('galeote.esfuerzo')).toBe(false)
    const k = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: ['galeote'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    k.comprometer('COM', ['galeote'])
    expect(k.ofreceCapacidad('galeote.esfuerzo')).toBe(false)
  })
})

describe('El Tuerto', () => {
  it('recibe +1 COM por cada herida que tenga: sube con cada herida y baja al curarse', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'tuerto', heridas: 2 }] })
    const com = () => valor(j.estado, { tipo: 'habilidad', carta: j.inst('tuerto'), hab: 'COM' })
    expect(com()).toBe(1 + 2 + 1) // impreso 1, 2 heridas y 1 de Diego
    j.copia('tuerto').heridas = 0
    expect(com()).toBe(1 + 1)
  })
})

describe('Fase 14 · El jugador automático', () => {
  const lleno = () =>
    Jugador.en({
      tripulacion: ['fiador', 'grumete', 'saqueador', 'marinero_p'],
      muelle: ['isabela'],
      mano: ['ojo', 'ojo', 'timon', 'timon', 'coraje'],
    })

  it('con el barco lleno, despide al Tripulante que menos vale si en el muelle hay uno claramente mejor que puede pagar', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const j = lleno()
    // El Fiador de ron (COM 1, Vida 1) frente a Isabela (NAV 1, COM 3, Vida 2): 2 puntos o más de diferencia. (Fase 15,
    // quinta ronda: el Espadachín baja a COM 2 y ya no basta.)
    expect(jugadorConCriterio()(j.estado, j.decision)).toEqual({ tipo: 'accion', accion: { tipo: 'despedir', carta: j.inst('fiador') } })
    // Sin la opción de despedir (la medida de referencia), no lo hace.
    expect(jugadorConCriterio({ despide: false })(j.estado, j.decision)).toEqual({ tipo: 'accion', accion: { tipo: 'terminarPaso' } })
  })

  it('nunca despide a un Enrolado (se va solo) ni al Capitán', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const j = Jugador.en({
      tripulacion: [
        { id: 'piloto_sueldo', enrolado: 1 },
        { id: 'guia_alquiler', enrolado: 1 },
        { id: 'soldado_fortuna', enrolado: 1 },
        { id: 'galeote', heridas: 2 },
      ],
      muelle: ['reinaldo'],
      mano: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje'],
    })
    const eleccion = jugadorConCriterio()(j.estado, j.decision)
    const despedido = eleccion.tipo === 'accion' && eleccion.accion.tipo === 'despedir' ? eleccion.accion.carta : null
    expect(despedido === null || despedido === j.inst('galeote')).toBe(true)
  })

  it('usa el esfuerzo del Galeote si le faltan 2 o menos para superar la Prueba y la herida no lo derrota', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const { dificultadPrueba, totalPrueba } = await import('./prueba.ts')
    // «Turbonada a popa» (NAV 4), con Diego agotado: Galeote 2 + 1 del Barco = 3.
    const con = (heridas: number) => {
      const j = Jugador.enMision({ misiones: ['pruebas-mar5'], capitan: { agotada: true }, tripulacion: [{ id: 'galeote', heridas }], mazoPeligros: ['p2_turbonada', 'chubasco', 'calma'] })
      return j.comprometer('NAV', ['galeote'])
    }
    const sano = con(0)
    const falta = dificultadPrueba(sano.estado) - totalPrueba(sano.estado)
    expect(falta).toBeGreaterThan(0)
    expect(falta).toBeLessThanOrEqual(2)
    expect(usada(jugadorConCriterio()(sano.estado, sano.decision))).toBe('galeote.esfuerzo')
    // Con 2 heridas (Vida 3), la herida lo derrotaría: no lo usa.
    const herido = con(2)
    expect(usada(jugadorConCriterio()(herido.estado, herido.decision))).toBeNull()
  })

  it('usa el esfuerzo de la Carne de cañón si el +1 de los demás asignados basta', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const { dificultadPrueba, totalPrueba } = await import('./prueba.ts')
    // «Al abordaje del filibote» (COM 4, fase 14), con Diego agotado: Carne de cañón 2 + Grumete leal 1 = 3; con el +1, 4.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], capitan: { agotada: true }, tripulacion: ['carne_canon', 'grumete'], mazoPeligros: ['p2_curazao', 'chubasco', 'calma'] })
    j.comprometer('COM', ['carne_canon', 'grumete'])
    const falta = dificultadPrueba(j.estado) - totalPrueba(j.estado)
    expect(falta).toBeGreaterThan(0)
    expect(falta).toBeLessThanOrEqual(2)
    expect(usada(jugadorConCriterio()(j.estado, j.decision))).toBe('carne_canon.esfuerzo')
  })
})
