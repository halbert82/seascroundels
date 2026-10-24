// Partidas guardadas de versiones anteriores: cuáles se convierten y cuáles no se pueden continuar.

import { describe, expect, it } from 'vitest'
import { deserializar, serializar } from './guardado.ts'
import { nombreDe } from './catalogo.ts'
import { INFO_ESTADO } from './infoEstados.ts'
import { nuevaPartida } from './preparacion.ts'
import { Jugador } from './pruebas/situacion.ts'
import type { Estado, InstId } from './tipos.ts'

const inst = (s: Estado, id: string) => {
  const e = Object.entries(s.cartas).find(([, c]) => c.id === id)
  if (!e) throw new Error(`no hay ${id}`)
  return e[0] as InstId
}
const ids = (s: Estado, zona: keyof Estado['zonas']) => s.zonas[zona].map((i) => s.cartas[i]?.id).sort()
const mover = (s: Estado, i: InstId, a: keyof Estado['zonas']) => {
  for (const z of Object.keys(s.zonas) as (keyof Estado['zonas'])[]) s.zonas[z] = s.zonas[z].filter((x) => x !== i)
  s.zonas[a].push(i)
}

/**
 * Una partida nueva convertida en una de antes de la fase 12: El espía y El barco fantasma con tres capítulos (el II de
 * hoy era el III y había otro II en medio); La Flota y El templo, también con tres (su IV era el III).
 */
function partidaDeAntes(semilla = 12): Estado {
  const s = nuevaPartida({ semilla })
  for (const t of ['flota', 'templo']) {
    const nuevo = inst(s, `${t}-III`)
    s.zonas.mazoHistoria = s.zonas.mazoHistoria.filter((x) => x !== nuevo)
    delete s.cartas[nuevo]
    s.cartas[inst(s, `${t}-IV`)]!.id = `${t}-III`
  }
  for (const t of ['espia', 'fantasma']) {
    s.cartas[inst(s, `${t}-II`)]!.id = `${t}-III`
    const ii: InstId = `i${s.sigInst++}`
    s.cartas[ii] = { id: `${t}-II`, agotada: false, heridas: 0, avance: 0, vinculadaA: null, entrenamiento: [] }
    s.zonas.mazoHistoria.push(ii)
  }
  return s
}

describe('Fase 12 · partidas guardadas con las travesías de antes', () => {
  it('sin empezar esas travesías: queda igual que una partida nueva (II del espía y del fantasma; III y IV de la Flota y el templo)', () => {
    const s = deserializar(serializar(partidaDeAntes()))
    const nueva = nuevaPartida({ semilla: 12 })
    for (const z of ['mazoMisiones', 'misionesDisponibles', 'mazoHistoria'] as const) expect(ids(s, z), z).toEqual(ids(nueva, z))
    expect(Object.values(s.cartas).some((c) => c.id === 'espia-III' || c.id === 'fantasma-III')).toBe(false)
  })

  it('el capítulo II de antes, pendiente en el mazo de Misiones, pasa a ser el II de hoy (y el III de antes sobra)', () => {
    const s = partidaDeAntes()
    mover(s, inst(s, 'espia-I'), 'misionesSuperadas')
    mover(s, inst(s, 'espia-II'), 'mazoMisiones')
    const r = deserializar(serializar(s))
    expect(ids(r, 'mazoMisiones').filter((id) => id?.startsWith('espia'))).toEqual(['espia-II'])
    expect(ids(r, 'mazoHistoria').filter((id) => id?.startsWith('espia'))).toEqual([])
    expect(Object.values(r.cartas).filter((c) => c.id.startsWith('espia-')).map((c) => c.id).sort()).toEqual(['espia-I', 'espia-II'])
  })

  it('el capítulo II de antes ya superado: el III de antes (la goleta, el camarote) pasa a ser el II', () => {
    const s = partidaDeAntes()
    mover(s, inst(s, 'fantasma-I'), 'misionesSuperadas')
    mover(s, inst(s, 'fantasma-II'), 'misionesSuperadas')
    const camarote = inst(s, 'fantasma-III')
    mover(s, camarote, 'misionesDisponibles')
    const r = deserializar(serializar(s))
    expect(r.cartas[camarote]?.id).toBe('fantasma-II')
    expect(r.zonas.misionesDisponibles).toContain(camarote)
    expect(ids(r, 'misionesSuperadas').filter((id) => id?.startsWith('fantasma'))).toEqual(['fantasma-I'])
  })

  it('la Flota a mitad de travesía: su III de antes es el IV y el III nuevo espera en el mazo de historia', () => {
    const s = partidaDeAntes()
    const huida = inst(s, 'flota-III')
    mover(s, huida, 'misionesDisponibles')
    const r = deserializar(serializar(s))
    expect(r.cartas[huida]?.id).toBe('flota-IV')
    expect(ids(r, 'mazoHistoria')).toContain('flota-III')
  })

  it('a mitad de «Seguirle por los muelles» o del antiguo «A bordo del fantasma»: no se puede continuar, y lo dice', () => {
    for (const t of ['espia', 'fantasma']) {
      const s = partidaDeAntes()
      const ii = inst(s, `${t}-II`)
      mover(s, ii, 'misionesDisponibles')
      s.mision = { carta: ii } as Estado['mision']
      expect(() => deserializar(serializar(s)), t).toThrow(/capítulo que ya no existe/)
    }
  })

  it('una partida de hoy no cambia', () => {
    const s = nuevaPartida({ semilla: 5 })
    expect(deserializar(serializar(s))).toEqual(s)
  })
})

describe('Fase 14 · partidas guardadas con rehenes', () => {
  it('los rehenes y los Tripulantes incautados vuelven a la tripulación', () => {
    const s = nuevaPartida({ semilla: 5 })
    const a = s.zonas.mazoMuelle.find((c) => s.cartas[c]?.id === 'bucanero') ?? s.zonas.mazoMuelle[0]!
    const b = s.zonas.mazoMuelle.find((c) => c !== a && s.cartas[c]?.id !== 'bucanero')!
    const viejo = JSON.parse(serializar(s)) as Estado & { zonas: Record<string, InstId[]> }
    viejo.zonas.mazoMuelle = viejo.zonas.mazoMuelle.filter((c) => c !== a && c !== b)
    viejo.zonas.rehenes = [a]
    viejo.zonas.incautadas = [b]
    viejo.incautadas = { [b]: { zona: 'tripulacion' as never } }
    const t = deserializar(JSON.stringify(viejo))
    expect('rehenes' in t.zonas).toBe(false)
    expect(t.zonas.tripulacion).toEqual(expect.arrayContaining([a, b]))
    expect(t.zonas.incautadas).toEqual([])
  })

  it('una partida guardada a mitad de una captura no se puede continuar', () => {
    const s = nuevaPartida({ semilla: 5 })
    const viejo = JSON.parse(serializar(s)) as Estado & { zonas: Record<string, InstId[]> }
    viejo.zonas.rehenes = []
    ;(viejo.pila as unknown[]).push({ id: 9999, tipo: 'rehen', entre: [] })
    expect(() => deserializar(JSON.stringify(viejo))).toThrow()
  })
})

describe('Fase 15 · partidas guardadas con el pecio del San José', () => {
  /** Una partida nueva convertida en una con el pecio: sus cartas, la Cadena de oro, la misión «pecio-I» y sus zonas. */
  function partidaConElPecio(): Estado & { zonas: Record<string, InstId[]> } {
    const s = nuevaPartida({ semilla: 5 })
    const viejo = JSON.parse(serializar(s)) as Estado & { zonas: Record<string, InstId[]> }
    const antes: Record<string, string> = {
      naufragio_cofre: 'pecio_doblones',
      naufragio_llave: 'pecio_tablones',
      culebrina_sanjose: 'pecio_culebrina',
      naufragio_diario: 'pecio_botica',
      naufragio_tiburon: 'pecio_tiburon',
      naufragio_coral: 'pecio_morena',
      naufragio_bolsa: 'pecio_sinaire',
      naufragio_ahogados: 'pecio_corriente',
      campana_sanjose: 'cadena_oro',
      'naufragio-I': 'pecio-I',
    }
    for (const [i, c] of Object.entries(viejo.cartas)) {
      if (c.id === 'naufragio_raqueros' || c.id === 'naufragio_pulpo') {
        delete viejo.cartas[i as InstId]
        viejo.zonas.mazoHistoria = viejo.zonas.mazoHistoria.filter((x) => x !== i)
      } else c.id = antes[c.id] ?? c.id
    }
    const zonas = viejo.zonas as Record<string, InstId[] | undefined>
    for (const z of ['mazoNaufragio', 'naufragioQuedadas', 'naufragioApartadas']) delete zonas[z]
    zonas.mazoPecio = []
    zonas.pecioSacadas = []
    return viejo
  }

  it('las cartas del pecio pasan a ser las del naufragio con su número, y las dos nuevas esperan en el mazo de historia', () => {
    const t = deserializar(JSON.stringify(partidaConElPecio()))
    const historia = ids(t, 'mazoHistoria')
    for (const id of ['naufragio_cofre', 'naufragio_raqueros', 'naufragio_pulpo', 'culebrina_sanjose', 'campana_sanjose', 'doblon']) expect(historia).toContain(id)
    expect(Object.values(t.cartas).some((c) => c.id.startsWith('pecio') || c.id === 'cadena_oro')).toBe(false)
    expect([...ids(t, 'mazoMisiones'), ...ids(t, 'misionesDisponibles')]).toContain('naufragio-I')
    expect(t.zonas.mazoNaufragio).toEqual([])
    expect('mazoPecio' in t.zonas).toBe(false)
  })

  it('una partida guardada mientras se buceaba en el pecio no se puede continuar, y lo dice', () => {
    const viejo = partidaConElPecio()
    viejo.zonas.mazoPecio = [viejo.zonas.mazoHistoria[0]!]
    expect(() => deserializar(JSON.stringify(viejo))).toThrow('buceando en «El pecio del San José»')
  })
})

describe('Fase 15, tercera ronda · partidas guardadas antes de la carta 286 («Fondeáis sobre el San José»)', () => {
  it('la carta 286 espera en el mazo de historia y la zona de la carta cogida existe', () => {
    const s = nuevaPartida({ semilla: 5 })
    const viejo = JSON.parse(serializar(s)) as Estado
    const fondeo = inst(viejo, 'fondeo_sanjose')
    viejo.zonas.mazoHistoria = viejo.zonas.mazoHistoria.filter((x) => x !== fondeo)
    delete viejo.cartas[fondeo]
    delete (viejo.zonas as Partial<Estado['zonas']>).cogidas
    const t = deserializar(JSON.stringify(viejo))
    expect(ids(t, 'mazoHistoria')).toContain('fondeo_sanjose')
    expect(t.zonas.cogidas).toEqual([])
  })
})

describe('Fase 15, cuarta ronda · partidas guardadas antes de las cartas de recompensa 287–296', () => {
  it('las diez cartas nuevas esperan en el mazo de historia', () => {
    const s = nuevaPartida({ semilla: 5 })
    const viejo = JSON.parse(serializar(s)) as Estado
    const nuevas = ['soplo_deudor', 'pertrechos', 'gente_aguada', 'ante_altar', 'mecha_encendida', 'bitacora_capitan', 'tres_cruces', 'cueva_abajo', 'galeon_puerto', 'port_royal_resiste']
    for (const id of nuevas) {
      const i = inst(viejo, id)
      viejo.zonas.mazoHistoria = viejo.zonas.mazoHistoria.filter((x) => x !== i)
      delete viejo.cartas[i]
    }
    const t = deserializar(JSON.stringify(viejo))
    for (const id of nuevas) expect(ids(t, 'mazoHistoria'), id).toContain(id)
  })

  it('con «El templo» superado y el final a medio elegir: al seguir, se coge «Ante el altar» y se elige en ella', () => {
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['pruebas-calma'], misiones: ['templo-IV'], avance: { 'templo-IV': 3 }, mazoPeligros: Array.from({ length: 7 }, () => 'calma') })
    j.zarpar('templo-IV')
    expect(j.decision).toMatchObject({ motivo: { clave: 'finalMision', carta: 'ante_altar' } })
    // Así estaba antes: la carta de recompensa no se había cogido y la tarea apuntaba a la misión.
    const viejo = JSON.parse(serializar(j.estado)) as Estado
    const altar = inst(viejo, 'ante_altar')
    const templo = inst(viejo, 'templo-IV')
    mover(viejo, altar, 'mazoHistoria')
    viejo.pila = viejo.pila.filter((t) => t.tipo !== 'devolverCogida')
    const tarea = viejo.pila.find((t) => t.tipo === 'elegirFinal') as unknown as { carta?: InstId; mision?: InstId }
    delete tarea.carta
    tarea.mision = templo
    if (viejo.pendiente) viejo.pendiente.motivo = { clave: 'finalMision', carta: 'templo-IV' }
    const t = new Jugador(deserializar(JSON.stringify(viejo)))
    t.opcion('idolo')
    expect(t.registro).toContain('Coges la carta 290 del mazo de historia: «Ante el altar».')
    expect(t.decision).toMatchObject({ motivo: { clave: 'finalMision', carta: 'ante_altar' } })
    t.opcion('idolo')
    expect(t.estado.reputacion).toBe(3)
    expect(ids(t.estado, 'mazoHistoria')).toEqual(expect.arrayContaining(['ante_altar', 'templo-IV']))
  })
})

describe('Fase 15, quinta ronda · partidas guardadas con Pólvora mojada o con el Práctico del puerto', () => {
  it('el Barco pierde la Pólvora mojada y el Práctico sale de la partida (sus Mejoras, a los descartes del muelle)', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero' }], barco: { estados: ['viaDeAgua'] } })
    const viejo = JSON.parse(serializar(j.estado)) as Estado
    viejo.estadosBarco = ['viaDeAgua', 'polvoraMojada' as never]
    // Un Práctico en la tripulación, con la Brújula, como en una partida de antes.
    const practico = 'i900' as InstId
    const brujula = 'i901' as InstId
    viejo.cartas[practico] = { ...viejo.cartas[inst(viejo, 'bucanero')], id: 'practico' } as Estado['cartas'][InstId]
    viejo.cartas[brujula] = { ...viejo.cartas[inst(viejo, 'bucanero')], id: 'brujula', vinculadaA: practico } as Estado['cartas'][InstId]
    viejo.zonas.tripulacion.push(practico)
    viejo.zonas.mejoras.push(brujula)
    const t = deserializar(JSON.stringify(viejo))
    expect(t.estadosBarco).toEqual(['viaDeAgua'])
    expect(Object.values(t.cartas).some((c) => c.id === 'practico')).toBe(false)
    expect(ids(t, 'tripulacion')).not.toContain('practico')
    expect(ids(t, 'descartesMuelle')).toContain('brujula')
    expect(t.cartas[brujula]?.vinculadaA).toBeNull()
  })
})

describe('Fase 16 · partidas guardadas con fichas de Estado y de Ventaja', () => {
  it('las fichas que había siguen puestas como cartas, y «no se prepara en tu próxima Fase de Inicio» pasa a Extenuado', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', estados: ['envenenado', 'inspirado'] }, 'vigia'], barco: { estados: ['viaDeAgua'] } })
    const viejo = JSON.parse(serializar(j.estado)) as Estado
    viejo.temporales.push({ clave: 'noPrepara', fuente: 'p2_murcielagos', hasta: 'inicio', inst: inst(viejo, 'vigia') })
    const t = deserializar(JSON.stringify(viejo))
    expect(t.cartas[inst(t, 'bucanero')]?.estados).toEqual(['envenenado', 'inspirado'])
    expect(t.estadosBarco).toEqual(['viaDeAgua'])
    expect(t.cartas[inst(t, 'vigia')]?.estados).toEqual(['extenuado'])
    expect(t.temporales.some((x) => x.clave === 'noPrepara')).toBe(false)
  })
})

describe('Revisión de Albert de las cartas de jugador · partidas guardadas con las cartas eliminadas o con los nombres antiguos', () => {
  /** Una partida «de antes»: con Botín escondido en la mano, Retirada a tiempo en el mazo y Cortar por lo sano en los descartes. */
  function conCartasEliminadas(): Estado {
    const j = Jugador.en({ mano: ['ni_hombre', 'ojo'], mazoCapitan: ['timon', 'a_por_ellos'], tripulacion: ['bucanero'] })
    const viejo = JSON.parse(serializar(j.estado)) as Estado
    const copiaDe = (id: string, n: number) => {
      const i = `i9${n}` as InstId
      viejo.cartas[i] = { ...viejo.cartas[inst(viejo, 'ojo')], id } as Estado['cartas'][InstId]
      return i
    }
    viejo.zonas.mano.push(copiaDe('botin', 11))
    viejo.zonas.mazoCapitan.push(copiaDe('retirada', 12))
    viejo.zonas.descartesCapitan.push(copiaDe('cortar', 13))
    return viejo
  }

  it('las tres cartas eliminadas salen de la partida estén donde estén; lo demás sigue igual', () => {
    const t = deserializar(JSON.stringify(conCartasEliminadas()))
    expect(Object.values(t.cartas).some((c) => ['botin', 'retirada', 'cortar'].includes(c.id))).toBe(false)
    expect(ids(t, 'mano')).toEqual(['ni_hombre', 'ojo'])
    expect(ids(t, 'mazoCapitan')).toEqual(['a_por_ellos', 'timon'])
    expect(ids(t, 'descartesCapitan')).toEqual([])
  })

  it('las cartas que cambian de nombre conservan su identificador: se leen con el nombre nuevo', () => {
    const t = deserializar(JSON.stringify(conCartasEliminadas()))
    expect(nombreDe('ni_hombre')).toBe('Cubrir las espaldas')
    expect(nombreDe('a_por_ellos')).toBe('¡Nadie se queda atrás!')
    expect(nombreDe('polvora_c')).toBe('Pólvora robada')
    expect(ids(t, 'mano')).toContain('ni_hombre')
  })

  it('una partida guardada a mitad de buscar en el mazo de muelle no se puede continuar, y lo dice', () => {
    const viejo = conCartasEliminadas()
    viejo.pendiente = { tipo: 'elegirCartas', motivo: { clave: 'buscar' }, candidatas: [], min: 1, max: 1 } as unknown as Estado['pendiente']
    expect(() => deserializar(JSON.stringify(viejo))).toThrow(/buscar en un mazo/)
  })
})

describe('Albert: Vía de agua, Velas rotas y Desánimo pasan a llamarse Anegado, Desarbolado y Desmoralizado', () => {
  it('una partida guardada con esos Estados se carga igual (la clave no cambia) y los muestra con el nombre nuevo', () => {
    const j = Jugador.en({ barco: { dano: 1, estados: ['viaDeAgua', 'velasRotas', 'desanimo'] } })
    // La partida se guardó antes del cambio: en el guardado solo van las claves, no los nombres.
    const guardada = serializar(j.estado)
    expect(guardada).not.toMatch(/Anegado|Desarbolado|Desmoralizado/)
    const t = deserializar(guardada)
    expect(t.estadosBarco).toEqual(['viaDeAgua', 'velasRotas', 'desanimo'])
    // En la mesa (la carta junto al Barco) y en la galería y la ampliación (su carta mini).
    expect(t.estadosBarco?.map((e) => INFO_ESTADO[e].nombre)).toEqual(['Anegado', 'Desarbolado', 'Desmoralizado'])
    expect(t.estadosBarco?.map((e) => nombreDe(`estado:${e}`))).toEqual(['Anegado', 'Desarbolado', 'Desmoralizado'])
  })
})
