// Peligros 2.0 · Grupo E: Leyendas, sobrenatural y fortuna (cartas 45–55).

import { esUnica, porId, tipoDe } from '../catalogo.ts'
import { registrarPeligro } from '../capacidades/peligros.ts'
import type { CapacidadDeCarta } from '../definiciones.ts'
import { destinoDe } from '../destinos.ts'
import type { AccionSobre, Condicion, Efecto, Selector } from '../efectos.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { agotar as agotarCarta } from '../estados.ts'
import { cartaDeArriba, descartarPeligro, encuentroDe, entornoActual } from '../peligros.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { marcado, registrarEspecial } from '../tareas/peligros2.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { espacioLibre, huecosLibres, valor } from '../valores.ts'
import { vinculadas } from '../zonas.ts'
import {
  agotar,
  avance,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  enElMar,
  habilidadDe,
  heridasAsignados,
  mas,
  menos,
  municion,
  participantesCtx,
  pierdesAvance,
  preparar,
  reparar,
  reputacion,
  robar,
  tieneRasgo,
} from './comun.ts'

// Ayudas ----------------------------------------------------------------------

const estado = (e: Extract<AccionSobre, { tipo: 'estado' }>['estado']): AccionSobre => ({ tipo: 'estado', estado: e })
const varios = (...acciones: AccionSobre[]): AccionSobre => ({ tipo: 'varios', acciones })
const alguno = (de: Selector['de'], por: Selector['por'], hacer: AccionSobre): Efecto => ({ tipo: 'aQuien', quien: por ? { de, por } : { de }, hacer })
const siguientePrueba = (n: number): Efecto => ({ tipo: 'siguiente', mod: { de: 'prueba', n } })
const hayComprometidos: Condicion = { tipo: 'comprometidos', minimo: 1 }

/**
 * «El comprometido con más X sufre N y queda Y»: si hay comprometidos, todo le pasa al mismo; si no, la herida va a
 * quien toque (D2a) y el Estado a nadie (no hay «comprometido»).
 */
function alComprometido(por: Selector['por'], hacer: AccionSobre): Efecto {
  const herida = hacer.tipo === 'varios' ? hacer.acciones.find((a) => a.tipo === 'heridas') : undefined
  return { tipo: 'si', condicion: hayComprometidos, entonces: [comprometidoCon(por, hacer)], sino: herida ? [comprometidoCon(por, herida)] : [] }
}

/** ¿Lleva este Tripulante una Mejora con ese id? */
function lleva(s: Estado, c: InstId, id: string): boolean {
  return vinculadas(s, c).some((m) => copia(s, m).id === id)
}

// 45. Buena estrella · Favorable ---------------------------------------------------

registrarCodigo('p2_estrella.loteria', (s) => {
  const carta = cartaDeArriba(s, 'destino')
  if (!carta) return []
  s.infoRevelada++
  const d = destinoDe(copia(s, carta).id)
  // Favorable: +1 o +2 impreso (−1 o −2 en sentido de la dificultad).
  const premio = typeof d.modificador === 'number' && d.modificador <= -1
  anotar(s, 'revelar', `Revelas «${nombre(s, carta)}»: su Destino es ${d.impreso}.${premio ? ' ¡Te toca!' : ' No te toca.'}`)
  descartarPeligro(s, carta)
  return premio ? [{ tipo: 'robar', n: 3 }] : []
})

/** «Respuesta: después de revelar el Destino de una Prueba de NAV, descarta esta carta: esa Prueba recibe −2.» */
const ultimaRacha: CapacidadDeCarta = {
  clave: 'racha',
  ventana: 'respuesta',
  disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarDestino' && s.prueba?.hab === 'NAV',
  efecto: (s, yo) => {
    if (!s.prueba || !yo) return []
    s.prueba.modExtra = (s.prueba.modExtra ?? 0) - 2
    anotar(s, 'jugada', 'Aprovecháis la última racha: esta Prueba recibe −2.')
    return [{ tipo: 'descartarPeligroEnJuego', carta: yo }]
  },
}

/** «Se descarta también si se revela un encuentro #Tormenta# (el viento rola).» */
const vientoRola: CapacidadDeCarta = {
  clave: 'tormenta',
  ventana: 'obligada',
  disparo: (s, yo, ev, fase) =>
    fase === 'despues' && ev.tipo === 'revelarPeligro' && ev.carta !== yo && s.zonas.encuentro.includes(ev.carta) && encuentroDe(s, ev.carta).palabrasClave.includes('Tormenta'),
  efecto: (_s, yo) => (yo ? [{ tipo: 'descartarPeligroEnJuego', carta: yo }] : []),
}

registrarPeligro('p2_estrella', {
  encuentros: {
    // Se queda en juego: cada Prueba de NAV que superes da 1 Avance más. Se descarta si fallas una Prueba o si se
    // revela un encuentro #Tormenta#; o la descartas tú tras revelar el Destino de una Prueba de NAV (−2).
    mar: {
      queda: {
        quitar: [],
        capacidades: [
          { clave: 'avance', ventana: 'constante', modifica: (_ctx, _yo, c) => (c.tipo === 'avanceExtraPrueba' && c.hab === 'NAV' ? 1 : 0) },
          ultimaRacha,
          vientoRola,
        ],
        disparos: [{ cuando: 'fallarPrueba', efectos: [{ tipo: 'descartarEsta' }] }],
      },
    },
    // Quita Envenenado de todos tus Tripulantes y después cura 1 herida a cada uno (P45): un Envenenado con 1 herida
    // acaba sin ficha y sin herida.
    nat: { efecto: [{ tipo: 'quitarEstado', estado: 'envenenado', a: 'todos' }, { tipo: 'curar', n: 1, modo: 'cadaUno' }] },
    // Puedes comprar un billete: descarta 1 carta y revela la de arriba del mazo de Peligros; si su Destino es −1 o −2,
    // robas 3. Después, descarta la carta revelada.
    ciu: {
      efecto: [
        {
          tipo: 'elegir',
          opciones: [
            { texto: 'Comprar un billete: descartas 1 carta y revelas la de arriba del mazo de Peligros', efectos: [descartar(1), codigo('p2_estrella.loteria')] },
            { texto: 'No comprar', efectos: [] },
          ],
        },
      ],
    },
  },
  // −2, pero la siguiente Prueba de esta misión recibe +1. Sin oposición: +2 en vez de +1.
  destino: { efectos: [{ tipo: 'si', condicion: hayComprometidos, entonces: [siguientePrueba(1)], sino: [siguientePrueba(2)] }] },
})

// 46. Restos del naufragio · Favorable -----------------------------------------------

// «Cada Tripulante comprometido después del primero sufre 1 herida»: eliges al que se libra.
registrarCodigo('p2_restos.aire', (s) => {
  const comprometidos = (s.prueba?.comprometidos ?? []).filter((c) => s.zonas.tripulacion.includes(c))
  const n = comprometidos.length - 1
  if (n <= 0) return []
  return [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true, maximo: n }, hacer: { tipo: 'heridas', n: 1 } }]
})

/** Portadores posibles de una Mejora del muelle. */
function portadores(s: Estado, carta: InstId): (InstId | 'barco')[] {
  const e = porId(copia(s, carta).id)
  if (e.tipo === 'mejoraBarco') return espacioLibre(s) >= e.carta.espacio ? ['barco'] : []
  if (e.tipo === 'mejoraTripulante') return s.zonas.tripulacion.filter((c) => huecosLibres(s, c) >= 1 && (!e.carta.soloCapitan || c === s.capitan))
  return []
}

const costeRebajado = (s: Estado, c: InstId) => Math.max(0, valor(s, { tipo: 'coste', carta: c }) - 2)

// «Pon en juego una Mejora del muelle pagando 2 cartas menos de su coste.» Paso 0: cuál (o ninguna); paso 1: portador.
// P47 (confirmada): es opcional (puedes no pujar), como «recluta gratis»: no obliga a pagar si hay una Mejora asequible.
registrarEspecial('p2_restos.subasta', (s, t, e) => {
  if (t.paso === 0) {
    const candidatas = s.zonas.muelle.filter((c) => {
      const id = copia(s, c).id
      if (s.peligrosEnMuelle?.[c] !== undefined || !['mejoraBarco', 'mejoraTripulante'].includes(tipoDe(id))) return false
      if (esUnica(id) && [...s.zonas.tripulacion, ...s.zonas.mejoras, ...s.zonas.rehenes].some((x) => copia(s, x).id === id)) return false
      return portadores(s, c).length > 0 && s.zonas.mano.length >= costeRebajado(s, c)
    })
    if (candidatas.length === 0) return 'hecha'
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'subasta' }, candidatas, min: 0, max: 1 })
    const [c] = eleccionDe(e, 'cartas').ids
    if (!c) return 'hecha'
    t.datos.carta = c
    t.paso = 1
    return 'sigue'
  }
  const carta = t.datos.carta as InstId
  const lista = portadores(s, carta)
  if (lista.length === 0) return 'hecha'
  const destino = lista.length === 1 ? lista[0] : e ? (eleccionDe(e, 'cartas').ids[0] as InstId | undefined) : undefined
  if (!destino) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'portadorGratis', carta: copia(s, carta).id }, candidatas: lista.filter((x): x is InstId => x !== 'barco'), min: 1, max: 1 })
  }
  const coste = costeRebajado(s, carta)
  anotar(s, 'jugada', `Pujas por «${nombre(s, carta)}» pagando ${coste} ${coste === 1 ? 'carta' : 'cartas'}.`)
  encolar(s, ...(coste > 0 ? [{ tipo: 'pagar' as const, cantidad: coste, motivo: copia(s, carta).id }] : []), { tipo: 'adquirir', carta, destino, paso: 'vincular' })
  return 'hecha'
})
registrarCodigo('p2_restos.subasta', () => [{ tipo: 'especial', clave: 'p2_restos.subasta', datos: {}, paso: 0 }])

registrarPeligro('p2_restos', {
  encuentros: {
    // Éxito: robas 1 por cada Tripulante comprometido (máx. 3). Fallo: cada comprometido después del primero, 1 herida.
    mar: { exito: [{ tipo: 'porCada', medida: 'comprometidos', efectos: [robar(1)], maximo: 3 }], fallo: [codigo('p2_restos.aire')] },
    // A tu elección: el de ron (prepara a todos los agotados, que quedan Borrachos) o el de pólvora (+2 munición).
    nat: {
      efecto: [
        {
          tipo: 'elegir',
          opciones: [
            {
              texto: 'Abrís el de ron: preparas a todos los Tripulantes agotados, pero quedan Borrachos',
              efectos: [{ tipo: 'aQuien', quien: { de: 'agotados', cada: true }, hacer: varios({ tipo: 'preparar' }, estado('borracho')) }],
            },
            { texto: 'Abrís el de pólvora: ganas 2 munición', efectos: [municion(2)] },
          ],
        },
      ],
    },
    // Éxito: pon en juego una Mejora del muelle pagando 2 cartas menos. Fallo: se descarta del muelle la Mejora más cara (se repone).
    ciu: { exito: [codigo('p2_restos.subasta')], fallo: [{ tipo: 'descartarMuelle', cual: 'mejoraMasCara', reponer: true }] },
  },
  // +0. Si superas, repara 1 daño. Sin oposición: en el Mar, el Barco sufre 1 daño; en Naturaleza o Ciudad, descarta
  // 1 carta.
  destino: { siSuperas: [reparar(1)], sinOposicion: [enElMar([dano(1)], [descartar(1)])] },
})

// 47. Presa fácil · Favorable ------------------------------------------------------

registrarPeligro('p2_presa', {
  encuentros: {
    // Si tienes una Bandera negra, superas sin Prueba. Éxito: robas 2 o ganas 2 munición. Fallo: 1 daño.
    mar: {
      superaSi: { tipo: 'cartaEnJuego', id: 'bandera' },
      exito: [
        {
          tipo: 'elegir',
          opciones: [
            { texto: 'Saqueáis la bodega: robas 2', efectos: [robar(2)] },
            { texto: 'Saqueáis la santabárbara: ganas 2 munición', efectos: [municion(2)] },
          ],
        },
      ],
      fallo: [dano(1)],
    },
    // Éxito: robas 3, pero la siguiente Prueba de EXP de esta misión recibe +1. Fallo: pierdes 1 Avance.
    nat: { exito: [robar(3), { tipo: 'siguiente', mod: { de: 'prueba', hab: 'EXP', n: 1 } }], fallo: [pierdesAvance(1)] },
    // Puedes colarte: recuperas 2 cartas de tu descarte y un Tripulante a tu elección queda Buscado.
    ciu: {
      efecto: [
        {
          tipo: 'elegir',
          opciones: [
            {
              texto: 'Colarte en su casa: recuperas 2 cartas de tu descarte y un Tripulante a tu elección queda Buscado',
              efectos: [{ tipo: 'recuperarDescarte', n: 2 }, { tipo: 'estado', estado: 'buscado', a: 'uno' }],
            },
            { texto: 'No entrar', efectos: [] },
          ],
        },
      ],
    },
  },
  // +0. Si superas, robas 1 (2 si comprometiste a un Contrabandista). Sin oposición: descartas 1 al azar.
  destino: {
    siSuperas: [{ tipo: 'si', condicion: { tipo: 'comprometidoRasgo', rasgo: 'Contrabandista' }, entonces: [robar(2)], sino: [robar(1)] }],
    sinOposicion: [{ tipo: 'descartarAzar', n: 1 }],
  },
})

// 48. Fuego de San Telmo · Leve -------------------------------------------------------

registrarPeligro('p2_santelmo', {
  encuentros: {
    // Éxito: el comprometido con más NAV queda Inspirado. Fallo: en la siguiente Prueba, 2 Destinos y el peor.
    mar: { exito: [comprometidoCon(mas('NAV'), estado('inspirado'))], fallo: [{ tipo: 'siguiente', mod: { de: 'prueba', dosDestinos: true } }] },
    // Un Vigía comprometido suma +2. Éxito: busca una Mejora. Fallo: pierdes 2 Avance.
    // P46 (confirmada): «busca una Mejora en tu mazo y añádela a tu mano»: las Mejoras van en el mazo de muelle, no en
    // la mano. Por defecto: buscas una Mejora en el mazo de muelle y la pones en el muelle, como las recompensas.
    nat: {
      capacidades: [habilidadDe('vigias', (ctx, c) => (tieneRasgo(ctx.s, c, 'Vigía') ? 2 : 0))],
      exito: [codigo('p2_santelmo.buscar')],
      fallo: [pierdesAvance(2)],
    },
    // Si tienes un Marinero preparado, superas sin Prueba. Éxito: recluta gratis un Marinero de coste 3 o menos; si no
    // hay o no tienes Capacidad, robas 2. Fallo: descartas 1.
    ciu: {
      superaSi: { tipo: 'rasgoPreparado', rasgo: 'Marinero' },
      exito: [{ tipo: 'gratisDelMuelle', maxCoste: 3, que: 'tripulante', rasgo: 'Marinero', siNo: [robar(2)] }],
      fallo: [descartar(1)],
    },
  },
  // −1. No se pueden usar capacidades de Tripulantes ni de Mejoras. Sin oposición: +1 en vez de −1.
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 1 : -1), prueba: { sinCapTripulantes: true, sinCapMejoras: true } },
})
registrarCodigo('p2_santelmo.buscar', () => [{ tipo: 'buscarMuelle', filtro: 'mejora' }])

// 49. La sirena · Leve ------------------------------------------------------------

const CANTO = 'p2_sirena.canto'

// Atarlo al palo mayor: se agota él y otro Tripulante preparado.
registrarCodigo('p2_sirena.atar', (s, fuente) => {
  const m = marcado(s, CANTO, fuente)
  if (!m) return []
  if (!copia(s, m).agotada) {
    anotar(s, 'pagar', `Atáis a ${nombre(s, m)} al palo mayor.`)
    agotarCarta(s, m)
  }
  return [{ tipo: 'agotarPago', n: 1 }]
})
// Fallo: el que oyó el canto sufre 2 heridas y queda Asustado.
registrarCodigo('p2_sirena.ahogado', (s, fuente) => {
  const m = marcado(s, CANTO, fuente)
  return m ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: m }, hacer: varios({ tipo: 'heridas', n: 2 }, estado('asustado')) }] : []
})

registrarPeligro('p2_sirena', {
  encuentros: {
    // Al revelarse, el preparado con menos EXP oye el canto. Elige: atarlo (agótalo a él y a otro preparado) o ir tras
    // él en el bote (NAV 3).
    mar: {
      alRevelarse: [alguno('preparados', menos('EXP'), { tipo: 'marcar', clave: CANTO })],
      elige: [
        { texto: 'Atarlo al palo mayor: lo agotas a él y a otro Tripulante preparado', si: { tipo: 'preparados', minimo: 2 }, efectos: [codigo('p2_sirena.atar')] },
        { texto: 'Dejarle saltar e ir tras él en el bote: Prueba de NAV 3', prueba: true },
      ],
      exito: [robar(3)],
      fallo: [codigo('p2_sirena.ahogado')],
    },
    // Invierte el modificador del Destino. Éxito: cura 1 a cada comprometido. Fallo: el comprometido con menos EXP, 2 heridas.
    nat: { prueba: { invertirDestino: true }, exito: [{ tipo: 'curar', n: 1, modo: 'cadaComprometido' }], fallo: [comprometidoCon(menos('EXP'), { tipo: 'heridas', n: 2 })] },
    // Las cartas de la mano no suman. Éxito: un comprometido queda Inspirado. Fallo: descartas 2 al azar.
    ciu: { prueba: { sinCartas: true }, exito: [comprometidoCon('eleccion', estado('inspirado'))], fallo: [{ tipo: 'descartarAzar', n: 2 }] },
  },
  // +1. El comprometido con la habilidad más baja no suma. Sin oposición: el preparado con menos EXP sufre 1 herida.
  destino: {
    efectos: [comprometidoCon(menos('prueba'), { tipo: 'noSuma' })],
    sinOposicion: [alguno('preparados', menos('EXP'), { tipo: 'heridas', n: 1 })],
  },
})

// 50. Mal presagio · Leve ----------------------------------------------------------

const LECHUZA = 'p2_presagio.lechuza'
registrarCodigo('p2_presagio.cumple', (s, fuente) => {
  const m = marcado(s, LECHUZA, fuente)
  return m ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: m }, hacer: varios({ tipo: 'heridas', n: 2 }, estado('maldito')) }] : []
})
registrarCodigo('p2_presagio.pasa', (s, fuente) => {
  const m = marcado(s, LECHUZA, fuente)
  return m ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: m }, hacer: estado('aguerrido') }] : []
})

registrarPeligro('p2_presagio', {
  encuentros: {
    // Al revelarse, el preparado con más COM no puede comprometerse en esta Prueba. Éxito: +1 Avance. Fallo: −1 Mando
    // en tu próximo turno.
    mar: {
      alRevelarse: [alguno('preparados', mas('COM'), { tipo: 'noCompromete', hasta: 'finPrueba' })],
      exito: [avance(1)],
      fallo: [{ tipo: 'menosMando', proximo: true }],
    },
    // Al revelarse, un Tripulante al azar queda señalado. Se queda en juego con 1 ficha; 1 ficha por cada encuentro
    // nuevo; con 3, el señalado sufre 2 heridas y queda Maldito. Acción: agota a un Vigía o supera EXP 3 para
    // descartarla: el señalado queda Aguerrido.
    nat: {
      efecto: [alguno('tripulacion', 'azar', { tipo: 'marcar', clave: LECHUZA })],
      queda: {
        quitar: [
          { tipo: 'agotarRasgo', rasgo: 'Vigía' },
          { tipo: 'prueba', opciones: [{ hab: 'EXP', dificultad: 3 }] },
        ],
        fichasIniciales: 1,
        contador: { cuando: 'revelarPeligro', umbral: 3, efectos: [codigo('p2_presagio.cumple')], despues: 'descartar' },
        alQuitar: [codigo('p2_presagio.pasa')],
      },
    },
    // Revela el Destino antes de comprometer. Éxito: mira las 3 de arriba y ordénalas. Fallo: el comprometido con más
    // EXP queda Asustado.
    ciu: {
      prueba: { destinoAntes: true },
      exito: [{ tipo: 'mirarOrdenar', n: 3, fondo: 'no' }],
      fallo: [comprometidoCon(mas('EXP'), estado('asustado'))],
    },
  },
  // +1. Si fallas, la siguiente Prueba de esta misión recibe +1. Sin oposición: agota 1 Tripulante.
  destino: { siFallas: [siguientePrueba(1)], sinOposicion: [agotar(1)] },
})

// 51. La maldición del bokor · Duro ---------------------------------------------------

const quitarMaldicion: Efecto[] = [{ tipo: 'quitarEstado', estado: 'maldito', a: 'todos' }]

registrarPeligro('p2_bokor', {
  encuentros: {
    // Cada comprometido con heridas suma 1 menos. Éxito: esta carta Se retira. Fallo: el comprometido con más COM
    // sufre 1 herida y queda Maldito.
    mar: {
      capacidades: [habilidadDe('heridos', (ctx, c) => (copia(ctx.s, c).heridas > 0 ? -1 : 0))],
      exito: [{ tipo: 'seRetira' }],
      fallo: [alComprometido(mas('COM'), varios({ tipo: 'heridas', n: 1 }, estado('maldito')))],
    },
    // Éxito: prepara a todos. Fallo: agota a 2 preparados, que no se preparan en tu próximo Inicio.
    nat: {
      exito: [preparar('todos')],
      fallo: [{ tipo: 'aQuien', quien: { de: 'preparados', cada: true, maximo: 2 }, hacer: varios({ tipo: 'agotar' }, { tipo: 'noPrepara', hasta: 'inicio' }) }],
    },
    // Elige: le pagas (3 cartas; 2 si llevas un Amuleto): quita Maldito a todos y uno queda Aguerrido. O buscas tú el
    // muñeco: EXP 4. Éxito: quita Maldito a todos y robas 2. Fallo: el Capitán queda Maldito y descartas 1.
    ciu: {
      elige: [
        {
          texto: 'Pagarle (descartas 3 cartas): quita Maldito a todos y uno queda Aguerrido',
          si: { tipo: 'no', condicion: { tipo: 'cartaEnJuego', id: 'amuleto' } },
          efectos: [descartar(3), ...quitarMaldicion, { tipo: 'estado', estado: 'aguerrido', a: 'uno' }],
        },
        {
          texto: 'Pagarle (descartas 2 cartas: llevas el Amuleto): quita Maldito a todos y uno queda Aguerrido',
          si: { tipo: 'cartaEnJuego', id: 'amuleto' },
          efectos: [descartar(2), ...quitarMaldicion, { tipo: 'estado', estado: 'aguerrido', a: 'uno' }],
        },
        { texto: 'Buscar tú el muñeco: Prueba de EXP 4', prueba: true },
      ],
      exito: [...quitarMaldicion, robar(2)],
      fallo: [{ tipo: 'estado', estado: 'maldito', a: 'capitan' }, descartar(1)],
    },
  },
  // +1. Si fallas, uno de los comprometidos sufre 1 herida. Sin oposición: el Capitán sufre 1 herida.
  destino: { siFallas: [{ tipo: 'herirComprometido', n: 1 }], sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
})

// 52. El oro de los muertos · Duro ----------------------------------------------------

registrarPeligro('p2_oro', {
  encuentros: {
    // Éxito: robas 3 y no puedes retirarte. Fallo: 2 daños.
    mar: { exito: [robar(3), { tipo: 'noRetirarse' }], fallo: [dano(2)] },
    // Incautado al revelarse: una Mejora de un Tripulante o 2 cartas de la mano; si superas la misión, la recuperas y
    // robas 2. Éxito: +1 Avance. Fallo: el comprometido con más EXP, 2 heridas.
    nat: {
      alRevelarse: [
        {
          tipo: 'elegir',
          opciones: [
            { texto: 'Una Mejora de uno de tus Tripulantes', efectos: [{ tipo: 'incautar', que: 'mejora', n: 1, deTripulantes: true, alRecuperar: [robar(2)] }] },
            { texto: '2 cartas de tu mano', efectos: [{ tipo: 'incautar', que: 'mano', n: 2, alRecuperar: [robar(2)] }] },
          ],
        },
      ],
      exito: [avance(1)],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'heridas', n: 2 })],
    },
    // COM 3, +1 por cada Maldito (máx. 5). Éxito: robas 2. Fallo: descartas 2 y cada Maldito sufre 1 herida.
    ciu: {
      capacidades: [dificultad('malditos', (ctx) => Math.min(2, ctx.s.zonas.tripulacion.filter((c) => (copia(ctx.s, c).estados ?? []).includes('maldito')).length))],
      exito: [robar(2)],
      fallo: [descartar(2), { tipo: 'aQuien', quien: { de: 'tripulacion', conEstado: 'maldito', cada: true }, hacer: { tipo: 'heridas', n: 1 } }],
    },
  },
  // −2, pero el comprometido con la habilidad más alta queda Maldito. Sin oposición: el Capitán queda Maldito.
  destino: { efectos: [comprometidoCon(mas('prueba'), estado('maldito'))], sinOposicion: [{ tipo: 'estado', estado: 'maldito', a: 'capitan' }] },
})

// 53. La serpiente marina · Duro ------------------------------------------------------

const TRAGADO = 'p2_serpiente_marina.tragado'
registrarCodigo('p2_serpiente_marina.escupe', (s, fuente) => {
  const m = marcado(s, TRAGADO, fuente)
  if (m) return [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: m }, hacer: { tipo: 'heridas', n: 2 } }]
  return [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: mas('COM') }, hacer: { tipo: 'heridas', n: 2 } }]
})

registrarPeligro('p2_serpiente_marina', {
  encuentros: {
    // Cada Artillero comprometido suma +1. Éxito: +2 munición. Fallo: 2 daños y, si ya tenía 2 o más, Velas rotas.
    mar: {
      capacidades: [habilidadDe('artilleros', (ctx, c) => (tieneRasgo(ctx.s, c, 'Artillero') ? 1 : 0))],
      exito: [municion(2)],
      // La condición se mira al aplicar el recuadro, antes de que llegue el daño («si ya tenía»).
      fallo: [dano(2), { tipo: 'si', condicion: { tipo: 'danoBarco', minimo: 2 }, entonces: [{ tipo: 'estadoBarco', estado: 'velasRotas' }] }],
    },
    // Al revelarse, si no tienes un Animal, se traga al preparado con menos Vida: no puede comprometerse. Éxito: robas
    // 2. Fallo: el tragado (o, si no hubo, el comprometido con más COM) sufre 2 heridas.
    nat: {
      alRevelarse: [
        {
          tipo: 'si',
          condicion: { tipo: 'no', condicion: { tipo: 'rasgoEnJuego', rasgo: 'Animal' } },
          entonces: [alguno('preparados', 'menosVida', varios({ tipo: 'noCompromete', hasta: 'finPrueba' }, { tipo: 'marcar', clave: TRAGADO }))],
        },
      ],
      exito: [robar(2)],
      fallo: [codigo('p2_serpiente_marina.escupe')],
    },
    // Éxito: robas 2. Fallo: −1 reputación.
    ciu: { exito: [robar(2)], fallo: [reputacion(-1)] },
  },
  // +1. Si la Prueba es de COM, el comprometido con la habilidad más alta sufre 1 herida aunque superes. Sin oposición:
  // el preparado con menos Vida sufre 2 heridas.
  destino: {
    efectos: [
      {
        tipo: 'si',
        condicion: { tipo: 'todas', condiciones: [{ tipo: 'hab', hab: 'COM' }, hayComprometidos] },
        entonces: [comprometidoCon(mas('prueba'), { tipo: 'heridas', n: 1 })],
      },
    ],
    sinOposicion: [alguno('preparados', 'menosVida', { tipo: 'heridas', n: 2 })],
  },
})

// 54. La Santa Compaña · Duro ---------------------------------------------------------

registrarPeligro('p2_compana', {
  encuentros: {
    // NAV 4 (3 con un Vigía comprometido). Éxito: +1 Avance. Fallo: Incendio a bordo.
    mar: { exito: [avance(1)], fallo: [{ tipo: 'estadoBarco', estado: 'incendio' }] },
    // Los Tripulantes con Escapulario suman +2. Éxito: robas 2. Fallo: el comprometido con menos EXP queda Asustado
    // y sufre 1 herida.
    nat: {
      capacidades: [habilidadDe('escapulario', (ctx, c) => (lleva(ctx.s, c, 'escapulario') ? 2 : 0))],
      exito: [robar(2)],
      fallo: [alComprometido(menos('EXP'), varios(estado('asustado'), { tipo: 'heridas', n: 1 }))],
    },
    // Éxito: el comprometido con más NAV queda Aguerrido. Fallo: el comprometido con más NAV queda rehén.
    ciu: { exito: [comprometidoCon(mas('NAV'), estado('aguerrido'))], fallo: [comprometidoCon(mas('NAV'), { tipo: 'rehen' })] },
  },
  // +2. Si fallas, uno de los comprometidos queda Asustado. Sin oposición: el Tripulante con más heridas sufre 1 herida
  // y queda Asustado.
  destino: {
    siFallas: [comprometidoCon('eleccion', estado('asustado'))],
    sinOposicion: [alguno('tripulacion', 'masHeridas', varios({ tipo: 'heridas', n: 1 }, estado('asustado')))],
  },
})

// 55. El Holandés errante · Terrible --------------------------------------------------

/** «Antes de resolver, cada Tripulante preparado que no hayas comprometido sufre 1 herida»: tras comprometer. */
const rezagados: CapacidadDeCarta = {
  clave: 'rezagados',
  ventana: 'obligada',
  disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'comprometer',
  efecto: (): NuevaTarea[] => [{ tipo: 'aQuien', quien: { de: 'noComprometidosPreparados', cada: true }, hacer: { tipo: 'heridas', n: 1 } }],
}

registrarPeligro('p2_holandes', {
  encuentros: {
    // Abordaje. Los Cañones y la munición no suman. −2 si un comprometido lleva un Escapulario. Éxito: +1 reputación
    // y esta carta Se retira.
    mar: {
      abordaje: true,
      prueba: { sinCanones: true },
      capacidades: [dificultad('escapulario', (ctx) => (participantesCtx(ctx).some((c) => lleva(ctx.s, c, 'escapulario')) ? -2 : 0))],
      exito: [reputacion(1), { tipo: 'seRetira' }],
    },
    // Antes de resolver, cada preparado no comprometido sufre 1 herida. Éxito: robas 2. Fallo: 3 heridas repartidas
    // entre los comprometidos.
    nat: { capacidades: [rezagados], exito: [robar(2)], fallo: [heridasAsignados(3)] },
    // Éxito: mira las 5 de arriba; las que quieras al fondo y el resto encima, en el orden que quieras. Fallo: el Barco
    // queda Perseguido y descartas 2.
    ciu: { exito: [{ tipo: 'mirarOrdenar', n: 5, fondo: 'libre' }], fallo: [{ tipo: 'estadoBarco', estado: 'perseguido' }, descartar(2)] },
  },
  // Fallas la Prueba, solo en el Mar; en Naturaleza y Ciudad, +1. Sin oposición: el Barco queda Perseguido.
  destino: { modificador: (s) => (entornoActual(s) === 'mar' ? 'fallo' : 1), sinOposicion: [{ tipo: 'estadoBarco', estado: 'perseguido' }] },
})

