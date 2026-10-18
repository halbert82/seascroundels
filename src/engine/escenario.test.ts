import { describe, expect, it } from 'vitest'
import { DATOS } from './datos.ts'
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

  it('Vientos alisios y Temporada de huracanes: «sus Distancias» son las de las misiones de Mar, así que ninguna cambia (TODO(regla))', () => {
    for (const carta of ['alisios', 'huracanes']) {
      const j = revelar(carta, { misiones: ['templo-II', 'aguada-I', 'prueba-I'] })
      const sin = Jugador.en({ misiones: ['templo-II', 'aguada-I', 'prueba-I'] })
      for (const m of ['templo-II', 'aguada-I', 'prueba-I']) {
        expect(j.valor({ tipo: 'distancia', mision: j.inst(m) })).toBe(sin.valor({ tipo: 'distancia', mision: sin.inst(m) }))
      }
    }
  })

  it('Marineros sin barco: buscas un Tripulante, va al muelle y este turno reclutarlo cuesta 1 menos', () => {
    const j = revelar('reclutas', { mano: ['ojo'], muelle: ['sable'], mazoMuelle: ['vela', 'bucanero', 'casco', 'grumete'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buscar' } })
    const d = j.decision
    if (d.tipo !== 'elegirCartas') throw new Error()
    expect(d.candidatas.map((c) => j.estado.cartas[c]?.id).sort()).toEqual(['bucanero', 'grumete'])
    j.elegir('bucanero')
    expect(j.zona('muelle')).toEqual(['sable', 'bucanero'])
    // El Bucanero veterano cuesta 2: este turno, 1.
    expect(j.valor({ tipo: 'coste', carta: j.inst('bucanero') })).toBe(1)
    j.reclutar('bucanero').elegir('ojo')
    expect(j.zona('tripulacion')).toEqual(['capitan', 'bucanero'])
    expect(j.zona('mano')).toEqual([])
  })

  it('Marineros sin barco: el descuento es solo para la carta encontrada', () => {
    const j = revelar('reclutas', { muelle: ['bucanero'], mazoMuelle: ['bucanero'] })
    j.elegir('bucanero')
    const [viejo, nuevo] = j.zona('muelle').map((_, i) => j.estado.zonas.muelle[i]!)
    expect(j.valor({ tipo: 'coste', carta: viejo! })).toBe(2)
    expect(j.valor({ tipo: 'coste', carta: nuevo! })).toBe(1)
  })

  it('Carpinteros de ribera: eliges reparar 2 daños del Barco', () => {
    const j = revelar('ribera', { barco: { dano: 3 }, mazoMuelle: ['vela'] })
    expect(opciones(j)).toEqual(['Reparar 2 daños del Barco', 'Buscar una Mejora de barco y ponerla en el muelle'])
    j.opcion('0')
    expect(j.estado.danoBarco).toBe(1)
    expect(j.zona('muelle')).toEqual([])
  })

  it('Carpinteros de ribera: o buscas una Mejora de barco y la pones en el muelle', () => {
    const j = revelar('ribera', { barco: { dano: 3 }, mazoMuelle: ['sable', 'vela', 'marinero_p'] })
    j.opcion('1')
    j.elegir('vela')
    expect(j.zona('muelle')).toEqual(['vela'])
    expect(j.estado.danoBarco).toBe(3)
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

  it('Rumores del tesoro: en un capítulo II o III empiezas con 2', () => {
    const j = revelar('rumores', { misiones: ['espia-II'] })
    j.zarpar('espia-II')
    expect(j.registro.some((t) => t.startsWith('Rumores del tesoro: +2 de Avance'))).toBe(true)
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

  it('Cuarentena: la Taberna no se puede elegir este turno y el Tripulante con menos Vida queda Aturdido', () => {
    const j = revelar('cuarentena', { tripulacion: ['bucanero', 'grumete'] })
    expect(j.copia('grumete').estados).toEqual(['aturdido'])
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
    expect(j.copia('marinero_p').estados).toEqual(['aturdido'])
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
    expect(opciones(j)).toEqual(['Descartar 2 cartas', 'Perder una Mejora a tu elección'])
    j.opcion('0').elegir('ojo', 'timon')
    expect(j.zona('mano')).toEqual(['coraje'])
    expect(j.zona('mejoras')).toEqual(['vela'])
  })

  it('Impuestos del gobernador: o pierdes una Mejora a tu elección', () => {
    const j = revelar('impuestos', { mano: ['ojo', 'timon'], barco: { mejoras: ['vela', 'bandera'] }, tripulacion: [{ id: 'bucanero', mejoras: ['sable'] }] })
    j.opcion('1')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 1, max: 1, motivo: { clave: 'perderMejora' } })
    j.elegir('sable')
    expect(j.zona('descartesMuelle')).toEqual(['sable'])
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
  })

  it('Impuestos del gobernador: con menos de 2 cartas en la mano, solo puedes perder una Mejora (P11)', () => {
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

  it('Impuestos del gobernador: si no puedes cumplir ninguna opción entera, no pasa nada (TODO(regla))', () => {
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

  it('Deserción: con solo el Capitán, nadie puede desertar y pagas 1 carta de soldada; sin cartas, no pasa nada (TODO(regla))', () => {
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
    // Diego y el Espadachín errante tienen COM 3.
    const j = revelar('bando', { tripulacion: ['espadachin', 'marinero_p'] })
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'aQuien' } })
    j.elegir('espadachin')
    expect(j.copia('espadachin').estados).toEqual(['buscado'])
    expect(j.copia('capitan').estados).toBeUndefined()
  })

  it('La Armada patrulla: eliges descartar 3 cartas', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje', 'abordaje'] })
    expect(opciones(j)).toEqual(['Descartar 3 cartas (sobornas a un oficial del almirantazgo)', 'Barajar «La Armada te persigue» en el mazo de Peligros'])
    j.opcion('0').elegir('ojo', 'timon', 'coraje')
    expect(j.zona('mano')).toEqual(['abordaje'])
    expect(j.zona('apartados')).toEqual(['armada'])
  })

  it('La Armada patrulla: o barajas La Armada en el mazo de Peligros', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje'] })
    j.opcion('1')
    expect(j.zona('apartados')).toEqual([])
    expect(j.zona('mazoPeligros')).toContain('armada')
    expect(j.zona('mano')).toHaveLength(3)
  })

  it('La Armada patrulla: con menos de 3 cartas, entra La Armada sin preguntar', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon'] })
    expect(j.zona('mazoPeligros')).toContain('armada')
    expect(j.zona('mano')).toEqual(['ojo', 'timon'])
  })

  it('La Armada patrulla: si La Armada ya está en el mazo, solo queda descartar 3 (TODO(regla))', () => {
    const j = revelar('armada_patrulla', { mano: ['ojo', 'timon', 'coraje', 'abordaje'], apartados: [], mazoPeligros: ['armada'] })
    expect(j.registro).toContain('«La Armada patrulla»: La Armada ya está en el mazo de Peligros.')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', min: 3, max: 3 })
    j.elegir('ojo', 'timon', 'coraje')
    expect(j.zona('mano')).toEqual(['abordaje'])
  })

  it('Escasez de pertrechos: pierdes 1 munición (la Recarga la devuelve, TODO(regla)) y al final del turno robas hasta 2 cartas menos que tu Mando', () => {
    const j = revelar('escasez', { mano: [], barco: { mejoras: [{ id: 'bronce', municion: 2 }] } })
    expect(j.registro.some((t) => /munición/.test(t))).toBe(true)
    // La carta se aplica en el paso 1 del Inicio y la Recarga (paso 3) vuelve a llenar los Cañones.
    expect(j.copia('bronce').municion).toBe(2)
    j.pasarTurnoEnPuerto()
    expect(j.zona('mano')).toHaveLength(3)
  })

  it('Escasez de pertrechos: con Pólvora mojada, la munición perdida no vuelve', () => {
    const j = revelar('escasez', { barco: { estados: ['polvoraMojada'], mejoras: [{ id: 'bronce', municion: 2 }] } })
    expect(j.copia('bronce').municion).toBe(1)
  })
})
