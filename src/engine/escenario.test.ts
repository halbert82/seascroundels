import { describe, expect, it } from 'vitest'
import { costeImpreso } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { Jugador, MISIONES_DE_PRUEBA } from './pruebas/situacion.ts'

const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'abordaje', 'abordaje', 'estrellas', 'estrellas']

/** Empieza un turno revelando esa carta de Escenario (con otra detrás, para que no sea el último). */
function revelar(carta: string, extra: Parameters<typeof Jugador.en>[0] = {}) {
  return Jugador.en({ empezarEn: 'inicio', escenario: [carta, 'pruebas-calma'], mazoCapitan: [...MAZO], ...extra })
}

/** Textos de las opciones de la decisión de «Elige» en curso. */
function opciones(j: Jugador): string[] {
  const d = j.decision
  if (d.tipo !== 'elegirOpcion' || d.motivo.clave !== 'elegirEfectos') throw new Error(`Se esperaba un «Elige» y la decisión es «${d.tipo}»`)
  return d.opciones.map((o) => o.texto)
}

describe('Escenario 2.0: el mazo', () => {
  it('tiene 14 cartas: 6 buenas, 2 mixtas y 6 malas, con los números de colección del 97 al 110', () => {
    expect(DATOS.escenario.map((e) => e.num).sort((a, b) => a - b)).toEqual([97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110])
    // Las nuevas toman los números de las que salen: Días tranquilos (110), Noticias de un botín (101) y Astillero ocioso (98).
    const por = (num: number) => DATOS.escenario.find((e) => e.num === num)?.nombre
    expect([por(110), por(101), por(98)]).toEqual(['Fiesta de San Juan', 'Cuarentena', 'La Armada patrulla'])
  })
})

describe('Escenario 2.0: buenas', () => {
  it('Vientos alisios: las misiones de Mar necesitan 1 de Avance menos este turno', () => {
    const j = revelar('alisios', { misiones: ['prueba-I', 'aguada-I'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('prueba-I') })).toBe(2)
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('aguada-I') })).toBe(3)
  })

  it('Vientos alisios y Temporada de huracanes: las Distancias de todas las misiones son 1 menores o mayores (P57)', () => {
    // «La selva» (Naturaleza, Distancia 2), «El prisionero de Portobelo» (Ciudad, Distancia 3) y «Agua y leña»
    // (Naturaleza, Distancia 1). El Barco resta 1 a todas: sin carta de Escenario piden 1, 2 y 0.
    const misiones = ['templo-II', 'panama-I', 'aguada-I']
    const distancias = (j: Jugador) => misiones.map((m) => j.valor({ tipo: 'distancia', mision: j.inst(m) }))
    expect(distancias(Jugador.en({ misiones }))).toEqual([1, 2, 0])
    expect(distancias(revelar('huracanes', { misiones }))).toEqual([2, 3, 1])
    expect(distancias(revelar('alisios', { misiones }))).toEqual([0, 1, 0])
  })

  it('Vientos alisios y Temporada de huracanes: una misión sin Distancia (de Mar o en tu isla) sigue en 0 (D7)', () => {
    for (const carta of ['alisios', 'huracanes']) {
      const j = revelar(carta, { misiones: ['prueba-I', 'deuda-I'] })
      expect(j.valor({ tipo: 'distancia', mision: j.inst('prueba-I') })).toBe(0)
      expect(j.valor({ tipo: 'distancia', mision: j.inst('deuda-I') })).toBe(0)
    }
  })

  it('Temporada de huracanes: para zarpar a «La selva» tienes que cubrir 2 de Distancia en vez de 1', () => {
    const j = revelar('huracanes', { misiones: ['templo-II'], tripulacion: ['viejo_lobo'] })
    j.zarpar('templo-II')
    expect(j.decision).toMatchObject({ tipo: 'cubrirDistancia', distancia: 2 })
  })

  it('Vientos alisios: «La selva» queda a Distancia 0 con el Barco y zarpas sin agotar a nadie', () => {
    const j = revelar('alisios', { misiones: ['templo-II'], tripulacion: ['viejo_lobo'] })
    j.zarpar('templo-II')
    expect(j.decision.tipo).not.toBe('cubrirDistancia')
    expect(j.copia('viejo_lobo').agotada).toBe(false)
    expect(j.copia('capitan').agotada).toBe(false)
  })

  it('Marineros sin barco (revisión de Albert, fuera Buscar): miras 3 del mazo de muelle y pones un Tripulante en lugar de la carta de más a la izquierda; este turno, reclutarlo cuesta 1 menos', () => {
    const j = revelar('reclutas', { mano: ['ojo'], muelle: ['sable', 'vela'], mazoMuelle: ['casco', 'bucanero', 'grumete', 'vigia'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'marinerosSinBarco' } })
    const d = j.decision
    if (d.tipo !== 'elegirCartas') throw new Error()
    // Solo los Tripulantes de las 3 de arriba (la Vigía, la cuarta, no).
    expect(d.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['bucanero', 'grumete'])
    j.elegir('bucanero')
    // El Sable, la de más a la izquierda, se descarta; las demás van al fondo del mazo de muelle.
    expect(j.zona('muelle')).toEqual(['bucanero', 'vela'])
    expect(j.zona('descartesMuelle')).toEqual(['sable'])
    expect(j.zona('mazoMuelle')).toEqual(['vigia', 'casco', 'grumete'])
    // El Bucanero veterano cuesta 2: este turno, 1.
    expect(j.valor({ tipo: 'coste', carta: j.inst('bucanero') })).toBe(1)
    j.reclutar('bucanero').elegir('ojo')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.zona('mano')).toEqual([])
  })

  it('Marineros sin barco: con un solo Tripulante entre las 3 no se pregunta; sin ninguno, van al fondo, no se descarta nada y no hay descuento', () => {
    const uno = revelar('reclutas', { muelle: ['sable'], mazoMuelle: ['casco', 'grumete', 'vela'] })
    expect(uno.zona('muelle')).toEqual(['grumete'])
    expect(uno.valor({ tipo: 'coste', carta: uno.inst('grumete') })).toBe(Math.max(0, costeImpreso('grumete') - 1))
    expect(uno.zona('descartesMuelle')).toEqual(['sable'])
    const ninguno = revelar('reclutas', { muelle: ['sable'], mazoMuelle: ['casco', 'vela', 'catalejo', 'bucanero'] })
    expect(ninguno.zona('muelle')).toEqual(['sable'])
    expect(ninguno.zona('descartesMuelle')).toEqual([])
    expect(ninguno.zona('mazoMuelle')).toEqual(['bucanero', 'casco', 'vela', 'catalejo'])
    expect(ninguno.registro).toContain('No sale ningún Tripulante: no entra nadie en el muelle.')
  })

  it('Marineros sin barco: el descuento es solo para la carta que entra', () => {
    const j = revelar('reclutas', { muelle: ['sable', 'bucanero'], mazoMuelle: ['bucanero'] })
    const [viejo, nuevo] = [j.estado.zonas.muelle[1]!, j.estado.zonas.muelle[0]!]
    expect(j.valor({ tipo: 'coste', carta: viejo })).toBe(2)
    expect(j.valor({ tipo: 'coste', carta: nuevo })).toBe(1)
  })

  it('Carpinteros de ribera: eliges reparar 2 daños del Barco', () => {
    const j = revelar('ribera', { barco: { dano: 3 }, muelle: ['vela'] })
    expect(opciones(j)).toEqual(['Reparar 2 daños del Barco', 'La primera Mejora de barco que adquieras este turno cuesta 1 menos'])
    j.opcion('0')
    expect(j.estado.danoBarco).toBe(1)
    expect(j.valor({ tipo: 'coste', carta: j.inst('vela') })).toBe(costeImpreso('vela'))
  })

  it('Carpinteros de ribera (P123): el texto dice «la primera Mejora de barco que adquieras este turno»', () => {
    expect(DATOS.escenario.find((e) => e.id === 'ribera')?.texto).toBe(
      '**Elige:** repara {2 dano g}, o la primera Mejora de barco que adquieras este turno cuesta 1 menos.',
    )
  })

  it('Carpinteros de ribera (P123, el ejemplo): con la Vela mayor (1) y el Casco reforzado (2) en el muelle, pagas 0 y 2', () => {
    const j = revelar('ribera', { muelle: ['vela', 'casco'], mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('1')
    expect(j.valor({ tipo: 'coste', carta: j.inst('vela') })).toBe(0)
    expect(j.valor({ tipo: 'coste', carta: j.inst('casco') })).toBe(1)
    // La primera, la Vela mayor, sin pagar nada (no se pregunta qué descartar).
    j.adquirir('vela', 'barco')
    expect(j.zona('mano')).toHaveLength(3)
    // El descuento ya se ha gastado: el Casco reforzado cuesta sus 2.
    expect(j.valor({ tipo: 'coste', carta: j.inst('casco') })).toBe(2)
    j.adquirir('casco', 'barco').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje'])
    expect(j.zona('mejoras')).toEqual(['vela', 'casco'])
  })

  it('Carpinteros de ribera (P123): una Mejora de tripulante no gasta el descuento', () => {
    const j = revelar('ribera', { muelle: ['sable', 'vela'], mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('1')
    j.adquirir('sable', 'capitan').elegir('ojo')
    expect(j.valor({ tipo: 'coste', carta: j.inst('vela') })).toBe(costeImpreso('vela') - 1)
  })

  it('Carpinteros de ribera (revisión de Albert, fuera Buscar): o la primera Mejora de barco que adquieras cuesta 1 menos (solo las de barco)', () => {
    const j = revelar('ribera', { barco: { dano: 3 }, muelle: ['vela', 'sable', 'bucanero'] })
    j.opcion('1')
    expect(j.estado.danoBarco).toBe(3)
    // La Vela mayor (Mejora de barco) cuesta 1 menos; el Sable (de tripulante) y el Bucanero, no.
    expect(j.valor({ tipo: 'coste', carta: j.inst('vela') })).toBe(costeImpreso('vela') - 1)
    expect(j.valor({ tipo: 'coste', carta: j.inst('sable') })).toBe(costeImpreso('sable'))
    expect(j.valor({ tipo: 'coste', carta: j.inst('bucanero') })).toBe(costeImpreso('bucanero'))
  })

  it('Feria en la isla: robas 1 y curas 1 a cada Tripulante', () => {
    const j = revelar('feria', { capitan: { heridas: 2 }, tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    expect(j.zona('mano')).toEqual(['ojo'])
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(0)
  })

  it('Rumores del tesoro: si zarpas este turno, empiezas la misión con 1 de Avance', () => {
    const j = revelar('rumores', { misiones: [MISIONES_DE_PRUEBA.mar5] })
    j.zarpar(MISIONES_DE_PRUEBA.mar5)
    expect(j.registro).toContain('Rumores del tesoro: +1 de Avance (1/5).')
  })

  it('Rumores del tesoro: en un capítulo II, III o IV empiezas con 2', () => {
    for (const id of ['espia-II', 'flota-III', 'templo-IV']) {
      const j = revelar('rumores', { misiones: [id] })
      j.zarpar(id)
      expect(j.registro.some((t) => t.startsWith('Rumores del tesoro: +2 de Avance')), id).toBe(true)
    }
  })

  it('Rumores del tesoro: si te quedas en puerto, no pasa nada', () => {
    const j = revelar('rumores', { misiones: [MISIONES_DE_PRUEBA.mar5] })
    j.pasarTurnoEnPuerto()
    expect(j.copia(MISIONES_DE_PRUEBA.mar5).avance).toBe(0)
  })

  it('Mercado próspero: revela 2 cartas más al muelle; al reponerlo vuelve a su tamaño', () => {
    const j = revelar('mercado', { muelle: ['sable', 'vela', 'loro', 'casco'], mazoMuelle: ['bandera', 'chalupa', 'botica', 'viveres', 'cruz', 'bronce'] })
    expect(j.zona('muelle')).toEqual(['sable', 'vela', 'loro', 'casco', 'bandera', 'chalupa'])
    j.terminar()
    expect(j.zona('muelle')).toEqual(['botica', 'viveres', 'cruz', 'bronce'])
  })
})

describe('Escenario 2.0: mixtas', () => {
  it('Fiesta de San Juan: prepara a todos, todos quedan Borrachos y, si zarpas, empiezas con 1 de Avance', () => {
    const j = revelar('sanjuan', { capitan: { agotada: true }, tripulacion: [{ id: 'bucanero', agotada: true }], misiones: [MISIONES_DE_PRUEBA.ciu4] })
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('capitan').estados).toEqual(['borracho'])
    expect(j.copia('bucanero').estados).toEqual(['borracho'])
    // Borracho: +1 COM (el Bucanero tiene COM 2, +1 de Diego preparado y +1 de Borracho).
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'COM' })).toBe(4)
    j.zarpar(MISIONES_DE_PRUEBA.ciu4)
    expect(j.registro).toContain('Fiesta de San Juan: +1 de Avance (1/4).')
  })

  it('Fiesta de San Juan y Rumores del tesoro se suman (el ejemplo de Albert: una misión de Ciudad a golpes)', () => {
    const j = Jugador.en({ empezarEn: 'inicio', escenario: ['sanjuan', 'pruebas-calma'], mazoCapitan: [...MAZO], misiones: [MISIONES_DE_PRUEBA.ciu4] })
    j.estado.temporales.push({ clave: 'rumores.turno', fuente: 'rumores', hasta: 'finTurno' })
    j.zarpar(MISIONES_DE_PRUEBA.ciu4)
    expect(j.registro).toContain('Rumores del tesoro: +1 de Avance (1/4).')
    expect(j.registro).toContain('Fiesta de San Juan: +1 de Avance (2/4).')
  })

  it('Fiesta de San Juan: el Borracho se pasa al final del turno', () => {
    const j = revelar('sanjuan')
    j.pasarTurnoEnPuerto()
    expect(j.copia('capitan').estados).toBeUndefined()
  })

  it('Cuarentena: la Taberna no se puede elegir este turno y el Tripulante con menos Vida queda Envenenado (fase 10b)', () => {
    const j = revelar('cuarentena', { tripulacion: ['bucanero', 'grumete'] })
    expect(j.copia('grumete').estados).toEqual(['envenenado'])
    expect(j.copia('bucanero').estados).toBeUndefined()
    j.terminar().opcion('quedarse')
    const d = j.decision
    if (d.tipo !== 'elegirOpcion') throw new Error()
    expect(d.opciones.map((o) => o.clave)).toEqual(['astillero', 'tablon', 'propia'])
  })

  it('Cuarentena: si empatan en Vida, eliges tú; al turno siguiente la Taberna vuelve a abrir', () => {
    const j = revelar('cuarentena', { tripulacion: ['marinero_p', 'grumete'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('marinero_p')
    expect(j.copia('marinero_p').estados).toEqual(['envenenado'])
    j.pasarTurnoEnPuerto()
    j.terminar().opcion('quedarse')
    const d = j.decision
    if (d.tipo !== 'elegirOpcion') throw new Error()
    expect(d.opciones.map((o) => o.clave)).toContain('taberna')
  })
})

describe('Escenario 2.0: malas', () => {
  it('Temporada de huracanes: las misiones de Mar necesitan 1 de Avance más y los encuentros #Tormenta# reciben +1', () => {
    const j = revelar('huracanes', { misiones: ['prueba-I', 'aguada-I'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('prueba-I') })).toBe(4)
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('aguada-I') })).toBe(3)
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'NAV', claves: ['Tormenta'] })).toBe(4)
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'NAV', claves: ['Terreno'] })).toBe(3)
  })

  it('Impuestos del gobernador: eliges descartar 2 cartas', () => {
    const j = revelar('impuestos', { mano: ['ojo', 'timon', 'coraje'], barco: { mejoras: ['vela'] } })
    expect(opciones(j)).toEqual(['Descartar 2 cartas', 'Perder tu Mejora de mayor coste'])
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje'])
    expect(j.zona('mejoras')).toEqual(['vela'])
  })

  it('Impuestos del gobernador: o pierdes tu Mejora de mayor coste, sin elegir cuál', () => {
    // Vela mayor (1), Bandera negra (2) y Sable de abordaje (1): se pierde la Bandera.
    const j = revelar('impuestos', { mano: ['ojo', 'timon'], barco: { mejoras: ['vela', 'bandera'] }, tripulacion: [{ id: 'bucanero', mejoras: ['sable'] }] })
    j.opcion('1')
    expect(j.zona('descartesMuelle')).toEqual(['bandera'])
    expect(j.zona('mejoras').sort()).toEqual(['sable', 'vela'])
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
  })

  it('Impuestos del gobernador: si empatan en coste, eliges entre las más caras', () => {
    // Bandera negra y Cañones de bronce cuestan 2; la Vela mayor, 1.
    const j = revelar('impuestos', { mano: ['ojo', 'timon'], barco: { mejoras: ['vela', 'bandera', 'bronce'] } })
    j.opcion('1')
    const d = j.decision
    if (d.tipo !== 'elegirCartas') throw new Error(`Se esperaba elegir una Mejora y la decisión es «${d.tipo}»`)
    expect(d.motivo).toMatchObject({ clave: 'perderMejora', texto: 'Empatan en coste (2): eliges cuál pierdes.' })
    expect(d.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['bandera', 'bronce'])
    j.elegir('bronce')
    expect(j.zona('descartesMuelle')).toEqual(['bronce'])
  })

  it('Impuestos del gobernador: la de mayor coste es entre las que se pueden perder (no los Tesoros)', () => {
    // La Cruz de Santa Bárbara (Tesoro, 3) no se pierde: la más cara que se puede perder es la Vela mayor (1).
    const j = revelar('impuestos', { mano: ['ojo'], barco: { mejoras: ['cruz', 'vela'] } })
    expect(j.zona('descartesMuelle')).toEqual(['vela'])
    expect(j.zona('mejoras')).toEqual(['cruz'])
  })

  it('Impuestos del gobernador: con menos de 2 cartas en la mano, solo puedes perder la Mejora (P11)', () => {
    const j = revelar('impuestos', { mano: ['ojo'], barco: { mejoras: ['vela'] } })
    expect(j.zona('mejoras')).toEqual([])
    expect(j.zona('descartesMuelle')).toEqual(['vela'])
  })

  it('Impuestos del gobernador: sin Mejoras que perder, descartas 2; los Tesoros y las indestructibles no se pierden', () => {
    const j = revelar('impuestos', { mano: ['ojo', 'timon', 'coraje'], barco: { mejoras: ['cruz', 'mascaron'] }, capitan: { mejoras: ['espada'] } })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 2, max: 2 })
    j.elegir('ojo', 'timon')
    expect(j.zona('mejoras').sort()).toEqual(['cruz', 'espada', 'mascaron'])
  })

  it('Impuestos del gobernador: si no puedes cumplir ninguna opción entera, no pasa nada (P59a)', () => {
    const j = revelar('impuestos', { mano: ['ojo'], barco: { mejoras: ['cruz'] } })
    expect(j.zona('mano')).toEqual(['ojo'])
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('Impuestos del gobernador: con la Patente de corso no pagas', () => {
    const j = revelar('impuestos', { mano: ['ojo', 'timon'], capitan: { mejoras: ['patente'] }, barco: { mejoras: ['vela'] } })
    expect(j.registro).toContain('Impuestos del gobernador: con la Patente de corso no pagas.')
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
    expect(j.zona('mejoras').sort()).toEqual(['patente', 'vela'])
  })

  it('Deserción: pagas la soldada, 1 carta por cada Tripulante (el Capitán cuenta), máximo 3', () => {
    const j = revelar('desercion', { mano: ['ojo', 'timon', 'coraje', 'abordaje'], tripulacion: ['marinero_p', 'bucanero', 'grumete'] })
    expect(opciones(j)).toEqual(['Pagar la soldada: descartar 3 cartas', 'Tu Tripulante de menor coste deserta y vuelve al muelle (sus Mejoras se descartan)'])
    j.opcion('0').elegir('ojo', 'timon', 'coraje')
    expect(j.zona('mano')).toEqual(['abordaje'])
    expect(j.zona('tripulacion')).toEqual(['capitan', 'marinero_p', 'bucanero', 'grumete'])
    const dos = revelar('desercion', { mano: ['ojo', 'timon', 'coraje'], tripulacion: ['bucanero'] })
    expect(opciones(dos)[0]).toBe('Pagar la soldada: descartar 2 cartas')
  })

  it('Deserción: o tu Tripulante de menor coste deserta y vuelve al muelle; sus Mejoras se descartan', () => {
    const j = revelar('desercion', { mano: ['ojo', 'timon', 'coraje'], tripulacion: [{ id: 'marinero_p', mejoras: ['sable'] }, 'bucanero'] })
    j.opcion('1')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.zona('muelle')).toContain('marinero_p')
    expect(j.zona('descartesMuelle')).toEqual(['sable'])
    expect(j.registro).toContain('Rufián de cubierta deserta y vuelve al muelle (se descartan Sable de abordaje).')
    // Vuelve a estar en el muelle: se puede reclutar otra vez este turno.
    j.reclutar('marinero_p').elegir('ojo')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero', 'marinero_p'])
  })

  it('Deserción: si no puedes pagar la soldada, deserta; si hay empate, eliges tú; nunca el Capitán', () => {
    const j = revelar('desercion', { mano: ['ojo'], tripulacion: ['marinero_p', 'grumete', 'bucanero'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'desercion' } })
    j.elegir('grumete')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'marinero_p', 'bucanero'])
  })

  it('Deserción: con solo el Capitán, nadie puede desertar y pagas 1 carta de soldada; sin cartas, no pasa nada (P59b)', () => {
    const j = revelar('desercion', { mano: ['ojo', 'timon'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 1, max: 1 })
    j.elegir('ojo')
    expect(j.zona('mano')).toEqual(['timon'])
    const sinNada = revelar('desercion', { mano: [] })
    expect(sinNada.zona('tripulacion')).toEqual(['capitan'])
    expect(sinNada.decision.motivo.clave).toBe('jugarCartas')
  })

  it('Deserción: si el desertor llevaba un Tesoro, pasa a otro Tripulante (N1)', () => {
    const j = revelar('desercion', { mano: [], tripulacion: [{ id: 'bucanero', mejoras: ['espada'] }] })
    expect(j.zona('muelle')).toContain('bucanero')
    expect(j.copia('espada').vinculadaA).toBe(j.estado.capitan)
  })

  it('Bando del virrey: tu Tripulante con más COM queda Buscado y, este turno, #Guardia# y #Militar# reciben +1', () => {
    const j = revelar('bando', { tripulacion: ['bucanero', 'grumete'] })
    expect(j.copia('capitan').estados).toEqual(['buscado'])
    expect(j.copia('bucanero').estados).toBeUndefined()
    expect(j.estado.temporales.map((t) => t.clave)).toEqual(['bando.turno'])
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'COM', claves: ['Guardia'] })).toBe(4)
    expect(j.valor({ tipo: 'dificultad', base: 3, hab: 'COM', claves: ['Pirata'] })).toBe(3)
  })

  it('Bando del virrey: si empatan en COM (impresa), eliges tú', () => {
    // Diego y el Filibustero borracho tienen COM 3 (fase 15, quinta ronda: el Espadachín errante baja a COM 2).
    const j = revelar('bando', { tripulacion: ['filibustero', 'marinero_p'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('filibustero')
    expect(j.copia('filibustero').estados).toEqual(['buscado'])
    expect(j.copia('capitan').estados).toBeUndefined()
  })

  it('La Armada patrulla: eliges descartar 1 carta (P60)', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'] })
    expect(opciones(j)).toEqual(['Descartar 1 carta', 'Poner «La Armada te persigue» encima del mazo de Peligros'])
    j.opcion('0').elegir('ojo')
    expect(j.zona('mano')).toEqual(['timon'])
    expect(j.zona('apartados')).toEqual(['armada'])
  })

  it('La Armada patrulla: con 1 sola carta en la mano también puedes sobornar', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo'] })
    expect(opciones(j)).toHaveLength(2)
    j.opcion('0')
    expect(j.zona('mano')).toEqual([])
    expect(j.zona('mazoPeligros')).not.toContain('armada')
  })

  it('La Armada patrulla: o la pones encima del mazo; es el primer encuentro de tu próxima misión y después se queda en el mazo', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje'], misiones: [MISIONES_DE_PRUEBA.mar5], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.opcion('1')
    expect(j.zona('apartados')).toEqual([])
    expect(j.zona('mazoPeligros')).toEqual(['armada', 'calma', 'calma', 'calma'])
    expect(j.registro).toContain('«La Armada te persigue» va encima del mazo de Peligros: será el primer encuentro de tu próxima misión.')
    expect(j.zona('mano')).toHaveLength(3)
    j.zarpar(MISIONES_DE_PRUEBA.mar5)
    expect(j.zona('encuentro')).toEqual(['armada'])
    j.comprometer('NAV', ['capitan']).seguir() // Navío de línea, NAV 4 (fase 14): Diego 2 + 1 del Barco, Abordaje, 1 herida
    expect(j.zona('descartesPeligros')).toContain('armada')
    expect(j.zona('apartados')).toEqual([])
  })

  it('La Armada patrulla: aunque te quedes en puerto, sigue esperando encima del mazo y sale en la misión siguiente', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje'], misiones: [MISIONES_DE_PRUEBA.mar5], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.opcion('1').pasarTurnoEnPuerto()
    j.zarpar(MISIONES_DE_PRUEBA.mar5)
    expect(j.zona('encuentro')).toEqual(['armada'])
  })

  it('La Armada patrulla: con la mano vacía, La Armada va encima sin preguntar', () => {
    const j = revelar('armada_patrulla', { mano: [] })
    expect(j.zona('mazoPeligros')[0]).toBe('armada')
    expect(j.decision.motivo.clave).toBe('jugarCartas')
  })

  it('La Armada patrulla: si La Armada ya está en el mazo o en los descartes, se saca y se pone encima', () => {
    const enMazo = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje', 'abordaje'], apartados: [], mazoPeligros: ['calma', 'calma', 'armada'] })
    expect(opciones(enMazo)[1]).toBe('Poner «La Armada te persigue» encima del mazo de Peligros')
    enMazo.opcion('1')
    expect(enMazo.zona('mazoPeligros')).toEqual(['armada', 'calma', 'calma'])
    const enDescartes = revelar('armada_patrulla', { mano: [], apartados: [], mazoPeligros: ['calma'], descartesPeligros: ['chubasco', 'armada'] })
    expect(enDescartes.zona('mazoPeligros')).toEqual(['armada', 'calma'])
    expect(enDescartes.zona('descartesPeligros')).toEqual(['chubasco'])
  })

  it('La Armada patrulla: si La Armada ya no está en la partida, solo queda descartar 1; sin cartas, no pasa nada (P59c)', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'], apartados: [] })
    expect(j.registro).toContain('«La Armada patrulla»: «La Armada te persigue» ya no está en la partida.')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 1, max: 1 })
    j.elegir('ojo')
    expect(j.zona('mano')).toEqual(['timon'])
    const sinCartas = revelar('armada_patrulla', { mano: [], apartados: [] })
    expect(sinCartas.zona('apartados')).toEqual([])
    expect(sinCartas.decision.motivo.clave).toBe('jugarCartas')
  })

  it('Escasez de pertrechos (fase 10b): este turno tus Cañones no se preparan en la Fase de Inicio; el resto, sí', () => {
    const j = revelar('escasez', { mano: [], capitan: { agotada: true }, barco: { mejoras: [{ id: 'bronce', agotada: true }, { id: 'casco' }] } })
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.registro).toContain('Escasez de pertrechos: tus Cañones no se preparan.')
  })

  it('Escasez de pertrechos: al final del turno robas hasta 2 cartas menos que tu Mando; al turno siguiente los Cañones se preparan', () => {
    const j = revelar('escasez', { mano: [], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    expect(j.copia('bronce').agotada).toBe(true)
    j.pasarTurnoEnPuerto()
    expect(j.zona('mano')).toHaveLength(3)
    expect(j.copia('bronce').agotada).toBe(false)
  })
})

describe('Jugador automático: La Armada patrulla', () => {
  const eleccion = (j: Jugador) => jugadorConCriterio()(j.estado, j.decision)

  it('soborna (1 carta) si no tiene ningún Tripulante preparado con NAV 3 o más', () => {
    // Diego tiene NAV 2 y el Bucanero veterano, 1 + 1 de Diego.
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'], tripulacion: ['bucanero'] })
    expect(eleccion(j)).toEqual({ tipo: 'opcion', clave: '0' })
  })

  it('pone La Armada encima con el Viejo lobo de mar (NAV 3), aunque siga agotado del turno anterior', () => {
    // La carta se revela antes de preparar: cuenta quien se prepara en este mismo Inicio.
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'], tripulacion: [{ id: 'viejo_lobo', agotada: true }] })
    expect(eleccion(j)).toEqual({ tipo: 'opcion', clave: '1' })
  })

  it('cuenta la NAV que tendrá ya preparado: el Contrabandista (NAV 2) llega a 3 con el +1 de Diego', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'], capitan: { agotada: true }, tripulacion: [{ id: 'contrabandista', agotada: true }] })
    expect(eleccion(j)).toEqual({ tipo: 'opcion', clave: '1' })
  })
})

describe('Partida de aprendizaje, sin Escenario (fase 10c)', () => {
  it('no hay mazo de Escenario: un contador con tantos días como cartas tendría el modo', async () => {
    const { nuevaPartida } = await import('./preparacion.ts')
    const s = nuevaPartida({ semilla: 1, sinEscenario: true })
    expect(s.zonas.mazoEscenario).toHaveLength(0)
    expect(s.sinEscenario).toEqual({ dias: 11, total: 11 })
    const corta = nuevaPartida({ semilla: 1, modo: 'corta', sinEscenario: true })
    expect(corta.sinEscenario).toEqual({ dias: 8, total: 8 })
  })

  it('«pierdes un día» gasta un día del contador, y sin días no pasa nada más', async () => {
    const { nuevaPartida } = await import('./preparacion.ts')
    const { perderUnDia } = await import('./tareas/cartas.ts')
    const s = nuevaPartida({ semilla: 1, sinEscenario: true })
    perderUnDia(s)
    expect(s.sinEscenario?.dias).toBe(10)
    s.sinEscenario = { dias: 0, total: 11 }
    perderUnDia(s)
    expect(s.sinEscenario.dias).toBe(0)
  })

  // Juega 5 partidas enteras (unos 2 s): con toda la batería en paralelo pasaba de los 5 s por defecto.
  it('como con el mazo: 11 días dan 12 turnos, y el último se juega y se pierde', { timeout: 60_000 }, async () => {
    const { jugarPartida } = await import('./pruebas/equilibrio.ts')
    const jugador = jugadorConCriterio()
    for (const semilla of [1, 2, 3, 4, 5]) {
      const p = jugarPartida(semilla, jugador, { sinEscenario: true, invariantes: true })
      expect(p.turnoFinal).toBeLessThanOrEqual(12)
      expect(p.final.zonas.escenarioEnCurso).toHaveLength(0)
      if (!p.gana && p.motivo.startsWith('Se ha acabado el tiempo')) expect(p.motivo).toContain('no quedaban días')
    }
  })
})
