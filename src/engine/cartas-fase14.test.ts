// Fase 14 · Rotación de la tripulación: las palabras clave Enrolado y Desgaste y los seis Tripulantes nuevos (241–246).

import { describe, expect, it } from 'vitest'

import { porId } from './catalogo.ts'
import { Jugador, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import { valor } from './valores.ts'

const nuevas = ['soldado_fortuna', 'piloto_sueldo', 'guia_alquiler', 'carne_canon', 'galeote', 'tuerto']

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
  it('ejemplo del reglamento: el Piloto a sueldo entra con 2 fichas al reclutarlo', () => {
    const j = Jugador.en({ muelle: ['piloto_sueldo'], mano: ['ojo', 'ojo', 'timon'] })
    j.reclutar('piloto_sueldo').elegir('ojo', 'ojo')
    expect(j.zona('tripulacion')).toContain('piloto_sueldo')
    expect(j.copia('piloto_sueldo').enrolado).toBe(2)
    expect(j.registro).toContain('Piloto a sueldo se enrola por 2 misiones: 2 fichas de Enrolado.')
  })

  it('al terminar una misión superada pierde 1 ficha; al terminar la segunda, cumple su contrato y se va con sus Mejoras (no queda derrotado)', () => {
    // «Chubasco repentino» (NAV 2, Avance 2): con 1 de Avance, la misión de 3 se supera.
    const mision = (enrolado: number) =>
      Jugador.enMision({
        misiones: ['pruebas-mar3'],
        avance: { 'pruebas-mar3': 1 },
        tripulacion: [{ id: 'piloto_sueldo', enrolado, mejoras: ['brujula'] }],
        mazoPeligros: ['chubasco', 'chubasco', 'calma'],
      })
        .comprometer('NAV', ['capitan'])
        .pasarOfertas()
        .seguir()
    const primera = mision(2)
    expect(primera.registro.some((r) => r.startsWith('¡Superas'))).toBe(true)
    expect(primera.copia('piloto_sueldo').enrolado).toBe(1)
    expect(primera.registro).toContain('Piloto a sueldo pierde 1 ficha de Enrolado: le queda 1.')
    const segunda = mision(1)
    expect(segunda.zona('tripulacion')).not.toContain('piloto_sueldo')
    expect(segunda.zona('descartesMuelle')).toEqual(expect.arrayContaining(['piloto_sueldo', 'brujula']))
    expect(segunda.registro.some((r) => r.startsWith('Piloto a sueldo cumple su contrato y se va'))).toBe(true)
    expect(segunda.estado.registro.some((r) => r.dato?.tipo === 'derrota')).toBe(false)
  })

  it('también al retirarse de la misión (o al fallarla): pierde 1 ficha', () => {
    const j = Jugador.enMision({
      misiones: ['pruebas-mar5'],
      tripulacion: [{ id: 'soldado_fortuna', enrolado: 1 }],
      mazoPeligros: ['chubasco', 'chubasco', 'calma'],
    })
    j.comprometer('NAV', ['capitan']).pasarOfertas().seguir().retirarse().opcion('dejar')
    expect(j.zona('tripulacion')).not.toContain('soldado_fortuna')
    expect(j.zona('descartesMuelle')).toContain('soldado_fortuna')
  })

  it('si te quedas en puerto ese turno, no pierde ninguna ficha', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', tripulacion: [{ id: 'guia_alquiler', enrolado: 1 }] })
    j.opcion('quedarse').opcion('taberna').opcion('astillero')
    expect(j.zona('tripulacion')).toContain('guia_alquiler')
    expect(j.copia('guia_alquiler').enrolado).toBe(1)
  })

  it('los demás Tripulantes no llevan fichas de Enrolado', () => {
    const j = Jugador.en({ muelle: ['bucanero'], mano: ['ojo', 'ojo', 'timon'] })
    j.reclutar('bucanero').elegir('ojo', 'ojo')
    expect(j.copia('bucanero').enrolado).toBeUndefined()
  })
})

describe('Desgaste', () => {
  it('ejemplo del reglamento: la Carne de cañón (Vida 2) ya tiene 1 herida; asignada, sus 3 de COM suman y después cae', () => {
    // «Tiburones» (COM 2): Carne de cañón 3 + 1 de Diego.
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: [{ id: 'carne_canon', heridas: 1 }], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.comprometer('COM', ['carne_canon'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4)
    j.pasarOfertas().seguir()
    const registro = j.registro
    const prueba = registro.findIndex((r) => r.startsWith('Total 4 contra 2: superas la Prueba'))
    const desgaste = registro.indexOf('Desgaste: Carne de cañón paga el esfuerzo.')
    expect(prueba).toBeGreaterThanOrEqual(0)
    expect(desgaste).toBeGreaterThan(prueba)
    expect(j.zona('tripulacion')).not.toContain('carne_canon')
    expect(j.zona('descartesMuelle')).toContain('carne_canon')
  })

  it('el Galeote fugado suma a una Prueba de NAV y después sufre 1 herida; si no lo asignas, nada', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: ['galeote'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.comprometer('NAV', ['galeote'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4) // 2 + 1 de Diego + 1 del Barco
    j.pasarOfertas().seguir()
    expect(j.copia('galeote').heridas).toBe(1)
    const k = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: ['galeote'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    k.comprometer('NAV', ['capitan']).pasarOfertas().seguir()
    expect(k.copia('galeote').heridas).toBe(0)
  })

  it('también en una Prueba Sin ayuda: la herida llega después del fallo («La fiera en la bodega»)', () => {
    // COM 5 Sin ayuda: el Galeote (COM 1 + 1) falla, sufre 2 heridas del fallo y después 1 de Desgaste: cae (Vida 3).
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], tripulacion: ['galeote'], mazoPeligros: ['p2_jaguar', 'chubasco', 'calma'] })
    j.comprometer('COM', ['galeote']).pasarOfertas().seguir()
    expect(j.zona('tripulacion')).not.toContain('galeote')
    expect(j.registro).toContain('Desgaste: Galeote fugado paga el esfuerzo.')
  })

  it('también en la Prueba de una Acción (la cacería del jaguar, permanente 229)', () => {
    // COM 5 solo con él: el Galeote falla; «el Tripulante asignado sufre 1 herida» y después 1 de Desgaste.
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], tripulacion: ['galeote'], mazoPeligros: ['p2_jaguar', 'chubasco', 'calma'] })
    j.usar('pm_ojos.accion0').elegir('galeote')
    j.comprometer('COM', ['galeote']).pasarOfertas().seguir()
    expect(j.copia('galeote').heridas).toBe(2)
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
      muelle: ['espadachin'],
      mano: ['ojo', 'ojo', 'timon', 'timon', 'coraje'],
    })

  it('con el barco lleno, despide al Tripulante que menos vale si en el muelle hay uno claramente mejor que puede pagar', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    const j = lleno()
    // El Fiador de ron (COM 1, Vida 1) frente al Espadachín (COM 3, Vida 2): 2 puntos o más de diferencia.
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

  it('no asigna a uno con Desgaste si la herida lo mata y fallar no duele; si sobrevive, sí', async () => {
    const { jugadorConCriterio } = await import('./pruebas/jugadores.ts')
    // «Tiburones» (COM 2), con Diego agotado: solo queda la Carne de cañón (COM 3).
    const conHeridas = (heridas: number) =>
      Jugador.enMision({ misiones: ['pruebas-mar5'], capitan: { agotada: true }, tripulacion: [{ id: 'carne_canon', heridas }], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    const herida = conHeridas(1)
    expect(jugadorConCriterio()(herida.estado, herida.decision)).toMatchObject({ tipo: 'compromiso', tripulantes: [] })
    const sana = conHeridas(0)
    expect(jugadorConCriterio()(sana.estado, sana.decision)).toMatchObject({ tipo: 'compromiso', tripulantes: [sana.inst('carne_canon')] })
  })
})
