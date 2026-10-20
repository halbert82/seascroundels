// Zona de permanentes (fase 11): las cartas que antes «se quedaban en juego» son cartas aparte del mazo de historia.
// Aquí, lo común a las 12: los datos, «junto a él», el momento de sus efectos, la vuelta al mazo de historia, el Peligro
// que vuelve a salir con su permanente en juego y las partidas guardadas antes del cambio. Lo propio de cada una, en las
// pruebas de su Peligro (peligros2-grupoX.test.ts y mazosPropios2.test.ts).

import { describe, expect, it } from 'vitest'
import { CATALOGO, porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { reglasPermanente } from './definiciones.ts'
import { deserializar, serializar } from './guardado.ts'
import { nuevaPartida } from './preparacion.ts'
import { Jugador } from './pruebas/situacion.ts'
import type { CartaId, InstId } from './tipos.ts'

const SEGUNDA = 'Si no está en el mazo de historia, descarta esta carta sin ganar su Avance y revela otra.'

/** El encuentro (o la carta de mazo propio) que pone en juego cada permanente. */
function encuentroDe(p: (typeof DATOS.permanentes)[number]) {
  if (!p.entorno) return undefined
  if (p.entorno === 'unico') return DATOS.cartasDeMazoPropio.find((c) => c.id === p.origen)?.encuentro
  return DATOS.peligros.find((c) => c.id === p.origen)?.encuentros[p.entorno]
}
/** Las que pone en juego un encuentro (todas menos «¡La guardia!», que la ponen misiones). */
const DE_ENCUENTRO = DATOS.permanentes.filter((p) => p.origen)

const junto = (j: Jugador, permanente: CartaId): CartaId | undefined => {
  const c = j.copia(permanente).junto
  return c ? j.estado.cartas[c]?.id : undefined
}

describe('Las 12 permanentes en los datos', () => {
  it('son las cartas 220 («¡La guardia!») y 226–237, de tamaño normal, del mazo de historia, con los Rasgos de su encuentro', () => {
    expect(DATOS.permanentes.map((p) => p.num)).toEqual([220, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237])
    for (const p of DATOS.permanentes) expect(reglasPermanente(p.id), p.id).toBeDefined()
    for (const p of DE_ENCUENTRO) {
      const enc = encuentroDe(p)
      expect(enc, p.id).toBeDefined()
      expect(p.rasgos, p.id).toEqual(enc?.palabrasClave)
      expect(enc?.nombre, p.id).toBe(p.nombre)
      expect(porId(p.id).tipo).toBe('permanente')
      expect(reglasPermanente(p.id), p.id).toBeDefined()
    }
  })

  it('cada encuentro dice «Pon en juego la carta N del mazo de historia (junto a él)» y la segunda frase', () => {
    for (const p of DE_ENCUENTRO) {
      const texto = encuentroDe(p)?.textoEfecto ?? ''
      const frase = `Pon en juego la carta ${p.num} del mazo de historia${p.junto ? ' junto a él' : ''}`
      expect(texto, p.id).toContain(frase)
      expect(texto.endsWith(SEGUNDA), p.id).toBe(true)
      expect(encuentroDe(p)?.pone, p.id).toBe(p.num)
    }
  })

  it('«Se queda en juego» ya no está en ninguna carta (tampoco en «¡La guardia!», fase 11, P63)', () => {
    const textos = CATALOGO.flatMap((e) => {
      if (e.tipo === 'peligro') return Object.values(e.carta.encuentros).map((x) => x?.textoEfecto ?? '')
      if (e.tipo === 'mazoPropio') return [e.carta.encuentro.textoEfecto ?? '']
      return 'texto' in e.carta && typeof e.carta.texto === 'string' ? [e.carta.texto] : []
    })
    expect(textos.filter((t) => /[Ss]e queda en juego/.test(t))).toEqual([])
  })

  it('«¡La guardia!» (220) la ponen en juego La casa del gobernador y Por el aljibe: «pon en juego la carta 220 del mazo de historia»', () => {
    const guardia = DATOS.permanentes.find((p) => p.id === 'guardia')
    expect(guardia?.texto).toBe(
      'Mientras esté, todas las Pruebas reciben {+1 r} de dificultad.\n**Acción:** Haz una Prueba de [COM] 5 ~(los echáis a palos)~, o agota a 2 Tripulantes ~(os escabullís por los tejados)~: descarta esta carta.',
    )
    for (const id of ['gobernador-I', 'sanfelipe-II-a']) {
      const e = porId(id)
      const reglas = e.tipo === 'capitulo' ? e.carta.reglas.join(' ') : ''
      expect(reglas, id).toContain('pon en juego la carta 220 del mazo de historia')
      expect(reglas, id).not.toContain('¡La guardia!')
    }
  })

  it('al preparar la partida, las 13 esperan en el mazo de historia; la zona de permanentes está vacía', () => {
    const s = nuevaPartida({ semilla: 3 })
    const enHistoria = s.zonas.mazoHistoria.map((c) => s.cartas[c]?.id)
    for (const p of DATOS.permanentes) expect(enHistoria, p.id).toContain(p.id)
    expect(s.zonas.permanentes).toEqual([])
  })
})

describe('Poner en juego una permanente', () => {
  it('va a la zona de permanentes; el Peligro se descarta como cualquier otro y da su Avance (Campanas a rebato: 2)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_rebato', 'calma', 'calma'] })
    expect(j.zona('permanentes')).toEqual(['pm_campanas'])
    expect(j.zona('descartesPeligros')).toEqual(['p2_rebato'])
    expect(j.avance('pruebas-ciu9')).toBe(2)
    expect(j.registro).toContain('Pones en juego «Campanas a rebato» (carta 230 del mazo de historia).')
    // Es una carta resuelta: después de ella ya se puede retirar.
    expect(j.ofrece('retirarse')).toBe(true)
  })

  it('su propio encuentro no le cuenta: «al terminar cada encuentro» empieza con el siguiente', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_rebato', 'calma', 'calma'] })
    expect(j.copia('pm_campanas').fichas).toBe(0)
    j.seguir()
    expect(j.copia('pm_campanas').fichas).toBe(1)
  })

  it('«cada vez que reveles otro Peligro» tampoco cuenta el que la puso en juego (Murmullos en el sollado)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['p2_paga', 'calma', 'calma'] })
    expect(j.copia('pm_murmullos').fichas).toBe(0)
    j.seguir()
    expect(j.copia('pm_murmullos').fichas).toBe(1)
  })

  it('«junto a él»: Arenas movedizas (228) va junto al preparado con más EXP; la lechuza (235), junto a uno al azar', () => {
    const arenas = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['p2_arenas', 'calma', 'calma'], tripulacion: ['viejo_lobo', 'vigia'] })
    expect(junto(arenas, 'pm_arenas')).toBe('vigia')
    expect(arenas.registro).toContain('Pones en juego «Arenas movedizas» (carta 228 del mazo de historia), junto a Vigía inexperta.')
    const lechuza = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['p2_presagio', 'calma', 'calma'], tripulacion: ['bucanero'] })
    expect(['capitan', 'bucanero']).toContain(junto(lechuza, 'pm_lechuza'))
    expect(lechuza.copia('pm_lechuza').fichas).toBe(1)
  })

  it('«descarta esta carta» la devuelve al mazo de historia, sin fichas y ya junto a nadie', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['p2_arenas', 'calma', 'calma'], tripulacion: ['viejo_lobo', 'vigia'] })
    j.copia('pm_arenas').fichas = 1
    j.usar('pm_arenas.accion0').elegir('capitan', 'viejo_lobo')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toContain('pm_arenas')
    expect(j.copia('pm_arenas').fichas).toBeUndefined()
    expect(j.copia('pm_arenas').junto).toBeUndefined()
    expect(j.registro).toContain('«Arenas movedizas» vuelve al mazo de historia.')
  })

  it('al terminar la misión, todas vuelven al mazo de historia (también la de un Tripulante)', () => {
    const j = Jugador.enMision({
      misiones: ['pruebas-nat9'],
      mazoPeligros: ['p2_arenas', 'p2_jaguar', 'calma', 'calma'],
      tripulacion: ['viejo_lobo', 'vigia', 'bucanero'],
    })
    j.seguir()
    expect(j.zona('permanentes')).toEqual(['pm_arenas', 'pm_ojos'])
    j.retirarse().opcion('dejar')
    expect(j.zona('permanentes')).toEqual([])
    expect(j.zona('mazoHistoria')).toEqual(expect.arrayContaining(['pm_arenas', 'pm_ojos']))
    // El atrapado ya no está atrapado.
    expect(j.estado.temporales.filter((t) => t.clave === 'noCompromete' || t.clave === 'noPrepara')).toEqual([])
  })

  it('el Peligro vuelve a salir con su permanente en juego: se descarta sin dar Avance y se revela otra (Campanas a rebato)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_rebato', 'calma', 'calma'] })
    expect(j.avance('pruebas-ciu9')).toBe(2)
    // Como si el mazo se hubiera barajado y saliera otra vez «Toque a rebato».
    const rebato = j.inst('p2_rebato')
    j.estado.zonas.descartesPeligros = j.estado.zonas.descartesPeligros.filter((c) => c !== rebato)
    j.estado.zonas.mazoPeligros.unshift(rebato)
    j.seguir()
    expect(j.registro).toContain(
      'La carta 230 («Campanas a rebato») no está en el mazo de historia: descartas «Toque a rebato» sin ganar su Avance y revelas otra.',
    )
    // Solo la carta que sale después da su Avance (2) y cuenta como encuentro terminado para las campanas.
    expect(j.avance('pruebas-ciu9')).toBe(4)
    expect(j.copia('pm_campanas').fichas).toBe(1)
    expect(j.zona('permanentes')).toEqual(['pm_campanas'])
  })

  it('después de devolverla al mazo de historia, el mismo Peligro puede volver a ponerla en juego', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu9'], mazoPeligros: ['p2_rebato', 'calma', 'calma'] })
    j.usar('pm_campanas.quitar0') // agota a Diego, que es Oficial
    expect(j.zona('mazoHistoria')).toContain('pm_campanas')
    const rebato = j.inst('p2_rebato')
    j.estado.zonas.descartesPeligros = j.estado.zonas.descartesPeligros.filter((c) => c !== rebato)
    j.estado.zonas.mazoPeligros.unshift(rebato)
    j.seguir()
    expect(j.zona('permanentes')).toEqual(['pm_campanas'])
    expect(j.avance('pruebas-ciu9')).toBe(4)
  })
})

describe('Partidas guardadas antes de la fase 11', () => {
  it('la carta que «se quedaba en juego» pasa a ser su permanente, con sus fichas y quien estaba atrapado', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], mazoPeligros: ['p2_arenas', 'calma', 'calma'], tripulacion: ['viejo_lobo', 'vigia'] })
    // Se deshace a mano lo de la fase 11: la carta del Peligro en su zona antigua, con 2 fichas, y las 12 permanentes fuera.
    const viejo = JSON.parse(serializar(j.estado)) as Record<string, unknown> & typeof j.estado
    const zonas = viejo.zonas as unknown as Record<string, InstId[]>
    const arenas = j.inst('p2_arenas')
    const perm = j.inst('pm_arenas')
    const vigia = j.inst('vigia')
    zonas.descartesPeligros = (zonas.descartesPeligros ?? []).filter((c) => c !== arenas)
    zonas.peligrosEnJuego = [arenas]
    delete zonas.permanentes
    for (const [inst, c] of Object.entries(viejo.cartas)) {
      if (c.id.startsWith('pm_') || c.id.startsWith('pruebas-permanente')) {
        delete viejo.cartas[inst as InstId]
        for (const z of Object.keys(zonas)) zonas[z] = (zonas[z] ?? []).filter((x) => x !== inst)
      }
    }
    const carta = viejo.cartas[arenas]
    if (carta) carta.fichas = 2
    viejo.temporales = viejo.temporales.map((t) => (t.carta === perm ? { ...t, carta: arenas, fuente: 'p2_arenas' } : t))
    viejo.temporales.push({ clave: 'p2_arenas.atrapado', fuente: 'p2_arenas', hasta: 'finMision', inst: vigia, carta: arenas })

    const s = deserializar(JSON.stringify(viejo))
    expect(s.zonas.permanentes).toHaveLength(1)
    const nueva = s.zonas.permanentes[0] as InstId
    expect(s.cartas[nueva]?.id).toBe('pm_arenas')
    expect(s.cartas[nueva]?.fichas).toBe(2)
    expect(s.cartas[nueva]?.junto).toBe(vigia)
    expect(s.zonas.descartesPeligros).toContain(arenas)
    expect(s.temporales).toContainEqual(expect.objectContaining({ clave: 'noCompromete', inst: vigia, carta: nueva }))
    // Las otras 11 permanentes, al mazo de historia.
    const enHistoria = s.zonas.mazoHistoria.map((c) => s.cartas[c]?.id)
    for (const p of DATOS.permanentes.filter((x) => x.id !== 'pm_arenas')) expect(enHistoria).toContain(p.id)
  })
})
