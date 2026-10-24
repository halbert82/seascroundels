// Fase 15 · misiones nuevas: las travesías «La Isla del Tesoro» (capítulo II al azar), «La carrera de van Hoorn» (el
// rival con su barra y Destina) y «El fugitivo» (el prisionero), y las misiones sueltas «El naufragio del San José»
// (bucear en el mazo del naufragio), «Escolta del San Telmo» y «El asedio de Port Royal» (cartas que se protegen) y «La regata
// de San Juan».
// También las permanentes con Vida (Galeón San Telmo, Murallas de Port Royal, El prisionero), los dos barcos rivales del
// mazo de historia y los Tesoros nuevos.

import { entero } from '../azar.ts'
import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { cartasDelNaufragio, destinoNaufragio, porId } from '../catalogo.ts'
import { DATOS } from '../datos.ts'
import type { CapacidadDeCarta } from '../definiciones.ts'
import type { Efecto } from '../efectos.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { agotar } from '../estados.ts'
import { mazoActivo } from '../peligros.ts'
import { agotaCanones, avance, codigo, dano, robar } from '../peligros2/comun.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { registrarEspecial } from '../tareas/peligros2.ts'
import { numeroConIcono, textoDe } from '../textos.ts'
import type { CartaId, Estado, InstId, NuevaTarea, TareaDe } from '../tipos.ts'
import { espacioLibre } from '../valores.ts'
import { barajar, mover } from '../zonas.ts'
import { alFallarPrueba, alRevelarPeligro, alSuperarPrueba, dificultadClaves, fichas, ponerFichas, registrarMision } from './comun.ts'
import { registrarCartaDeRecompensa, registrarVigilante } from './registro.ts'

const reputacion = (n: number): NuevaTarea => ({ tipo: 'cambiarReputacion', n })
const robarN = (n: number): NuevaTarea => ({ tipo: 'robar', n })
const aplicar = (efectos: Efecto[]): NuevaTarea => ({ tipo: 'aplicarEfectos', efectos, contexto: 'efecto' })

/** «La misión termina» (no se supera): como «la misión falla», pero con sus propias palabras. */
function terminaLaMision(s: Estado, motivo: string): void {
  const m = s.mision
  if (!m || m.fin) return
  m.fin = 'retirada'
  m.motivoFallo = motivo
  anotar(s, 'aviso', `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}: la misión termina.`)
}

/** «La misión falla» por una permanente (el galeón se hunde, el prisionero muere). */
function fallaPor(s: Estado, motivo: string): void {
  const m = s.mision
  if (!m || m.fin) return
  m.fin = 'retirada'
  m.motivoFallo = motivo
  anotar(s, 'aviso', `La misión falla: ${motivo}.`)
}

// ---------------------------------------------------------------------------
// Permanentes con Vida: se les inflige daño (o heridas) y, sin Vida restante, pasa lo que dicen.

/** Vida impresa de una permanente que se puede dañar. */
function vidaDe(s: Estado, inst: InstId): number {
  const e = porId(copia(s, inst).id)
  return e.tipo === 'permanente' ? (e.carta.vida ?? 0) : 0
}

/** Vida que le queda (impresa menos el daño sufrido). */
export function vidaRestante(s: Estado, inst: InstId): number {
  return Math.max(0, vidaDe(s, inst) - copia(s, inst).heridas)
}

/** Vida restante de una permanente con Vida en juego (por su identificador), o null si no está en juego. */
export function vidaRestanteDe(s: Estado, id: CartaId): number | null {
  const c = s.zonas.permanentes.find((x) => copia(s, x).id === id)
  return c ? vidaRestante(s, c) : null
}

/** Lo que pasa cuando una permanente se queda sin Vida («Obligado: Cuando esta carta no tenga Vida restante, …»). */
const SIN_VIDA = new Map<CartaId, (s: Estado, inst: InstId) => void>()

/** Inflige N de daño (o heridas) a una permanente con Vida; sin Vida restante, se aplica lo que dice. */
export function danarPermanente(s: Estado, inst: InstId, n: number, que: 'daño' | 'heridas'): void {
  if (n <= 0 || !s.zonas.permanentes.includes(inst)) return
  const c = copia(s, inst)
  c.heridas += n
  const palabra = que === 'daño' ? (n === 1 ? 'daño' : 'daños') : n === 1 ? 'herida' : 'heridas'
  anotar(s, 'aviso', `«${nombre(s, inst)}» sufre ${n} ${palabra}: le ${vidaRestante(s, inst) === 1 ? 'queda' : 'quedan'} ${vidaRestante(s, inst)} de Vida.`)
  if (vidaRestante(s, inst) <= 0) SIN_VIDA.get(c.id)?.(s, inst)
}

registrarCodigo('protegido.dano', (s, fuente) => {
  if (fuente) danarPermanente(s, fuente, 1, 'daño')
  return []
})

/**
 * «Interrupción: Cuando el Barco vaya a sufrir daño (o un Tripulante, heridas), esta carta puede sufrir parte de ese
 * daño o todo, en su lugar.» Se pregunta cuánto (de 1 a todo; también más de lo que le queda de Vida).
 */
registrarEspecial('protegido.desviar', (s, t, e) => {
  const suceso = s.pila.find((x) => x.id === t.datos.suceso) as TareaDe<'evento'> | undefined
  const carta = t.datos.carta as InstId
  if (!suceso || suceso.cancelado || !s.zonas.permanentes.includes(carta)) return 'hecha'
  const ev = suceso.ev
  if (ev.tipo !== 'danoBarco' && ev.tipo !== 'heridas') return 'hecha'
  const total = ev.cantidad
  if (total <= 0) return 'hecha'
  const que = ev.tipo === 'danoBarco' ? 'daño' : 'heridas'
  if (!e) {
    const quien = ev.tipo === 'danoBarco' ? 'el Barco' : nombre(s, ev.objetivo)
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'desviarAProtegido', carta: copia(s, carta).id, n: total },
      opciones: Array.from({ length: total }, (_, i) => {
        const k = i + 1
        const unidades = que === 'daño' ? (k === 1 ? '1 daño' : `${k} daños`) : k === 1 ? '1 herida' : `${k} heridas`
        return { clave: String(k), texto: `«${nombre(s, carta)}» sufre ${unidades}${k < total ? ` y ${quien}, el resto (${total - k})` : ` y ${quien}, nada`}` }
      }),
    })
  }
  const k = Math.max(1, Math.min(total, Number(eleccionDe(e, 'opcion').clave)))
  ev.cantidad = total - k
  if (ev.cantidad === 0) suceso.cancelado = true
  danarPermanente(s, carta, k, que)
  return 'hecha'
})

/** La Interrupción de desviar daño al Barco (o heridas de un Tripulante) a esta carta. */
function desviar(clave: string, de: 'danoBarco' | 'heridas', si: (s: Estado) => boolean = () => true): CapacidadDeCarta {
  return {
    clave,
    ventana: 'interrupcion',
    texto: de === 'danoBarco' ? 'Esta carta sufre parte del daño del Barco, o todo, en su lugar' : 'Esta carta sufre parte de las heridas, o todas, en su lugar',
    disparo: (s, _yo, ev, fase) =>
      fase === 'antes' && si(s) && (de === 'danoBarco' ? ev.tipo === 'danoBarco' && ev.cantidad > 0 : ev.tipo === 'heridas' && ev.cantidad > 0 && s.zonas.tripulacion.includes(ev.objetivo)),
    efecto: (_s, yo, suceso) => (yo && suceso ? [{ tipo: 'especial', clave: 'protegido.desviar', datos: { suceso: suceso.id, carta: yo }, paso: 0 }] : []),
  }
}

/**
 * «Después de que superes una Prueba de [HAB] (en esta misión), gana 1 de Avance adicional.» En la Prueba de un encuentro
 * se suma a su Avance (así se ve antes, en «Si la superas: +N»); en la de una Acción, se gana al superarla.
 */
function avanceAdicional(clave: string, hab: 'NAV' | 'EXP', motivo: string): CapacidadDeCarta[] {
  return [
    { clave, ventana: 'constante', modifica: (_ctx, _yo, c) => (c.tipo === 'avanceExtraPrueba' && c.hab === hab ? 1 : 0) },
    alSuperarPrueba(`${clave}.accion`, (_s, p) => (p.hab === hab && !p.encuentro ? [{ tipo: 'ganarAvance', n: 1, motivo }] : [])),
  ]
}

/** Pon en juego una permanente del mazo de historia (como efecto de una misión). */
const ponerEnJuego = (id: CartaId): NuevaTarea => aplicar([{ tipo: 'ponerEnJuego', carta: id }])

// ---------------------------------------------------------------------------
// «Pon la carta N del mazo de historia encima del mazo de Peligros»: los barcos rivales. Vuelven al mazo de historia al
// terminar de resolverse o, si no llegan a salir, al terminar la misión.

function encimaDePeligros(clave: string, id: CartaId): void {
  registrarCodigo(clave, (s) => {
    const m = s.mision
    const carta = s.zonas.mazoHistoria.find((c) => copia(s, c).id === id)
    if (!m || !carta) return []
    mover(s, carta, mazoActivo(s).mazo, 'arriba')
    m.alApartar = carta
    anotar(s, 'aviso', `Pones la carta ${porId(id).num} del mazo de historia («${nombre(s, carta)}») encima del mazo de Peligros.`)
    return []
  })
}
encimaDePeligros('vanhoorn.barco', 'barco_vanhoorn')
encimaDePeligros('fugitivo.barco', 'barco_fugitivo')

// ---------------------------------------------------------------------------
// La Isla del Tesoro (255–258): el capítulo II, al azar
// Fase 15, cuarta ronda (Albert): el sorteo lo hace la carta de recompensa 293, «Las tres cruces del mapa», que dan «El mapa
// del ahorcado» (255) y «El mapa era falso» (258).

/** Los tres capítulos II de la isla, por número de colección. */
const CAPITULOS_II_ISLA = [256, 257, 258]

/**
 * Los capítulos que ya has superado en esta partida (lo dice el registro), con el que se está superando ahora. Un capítulo
 * II superado vuelve al mazo de historia (regla general de Albert), así que no basta con mirar si está allí.
 */
function capitulosSuperados(s: Estado): Set<number> {
  const nums = new Set<number>()
  for (const r of s.registro) if (r.dato?.tipo === 'finMision' && r.dato.resultado === 'superada') nums.add(porId(r.dato.mision).num)
  if (s.mision?.fin === 'superada') nums.add(porId(copia(s, s.mision.carta).id).num)
  return nums
}

/** «256, 257 y 258». */
function listaDeNumeros(nums: readonly number[]): string {
  return nums.length <= 1 ? nums.join('') : `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`
}

/**
 * Carta 293, «Las tres cruces del mapa»: «Baraja boca abajo los capítulos II de La Isla del Tesoro que no hayas superado
 * (cartas 256, 257 y 258 del mazo de historia). Pon uno encima del mazo de Misiones sin mirarlo y devuelve los demás al mazo
 * de historia.» Desde la 258, quedan la 256 y la 257.
 */
registrarEspecial('isla.tresCruces', (s) => {
  const superados = capitulosSuperados(s)
  const enHistoria = (n: number) => s.zonas.mazoHistoria.find((c) => porId(copia(s, c).id).num === n)
  const nums = CAPITULOS_II_ISLA.filter((n) => !superados.has(n) && enHistoria(n) !== undefined)
  if (nums.length === 0) {
    anotar(s, 'efecto', 'No queda ningún capítulo II de «La Isla del Tesoro» por superar: no ocurre nada.')
    return 'hecha'
  }
  s.infoRevelada++
  const num = nums[entero(s, nums.length)] as number
  const carta = enHistoria(num) as InstId
  mover(s, carta, 'mazoMisiones', 'arriba')
  anotar(s, 'efecto', `Barajas boca abajo las cartas ${listaDeNumeros(nums)} del mazo de historia y pones una encima del mazo de Misiones sin mirarla.`)
  return 'hecha'
})

registrarCartaDeRecompensa('tres_cruces', () => [{ tipo: 'especial', clave: 'isla.tresCruces', datos: {}, paso: 0 }])

registrarMision('isla-I', {
  alZarpar: () => [{ tipo: 'alZarparOpcional', coste: { tipo: 'descartar', n: 2 }, efectos: [avance(2)], texto: 'Descartar 2 cartas para ganar 2 de Avance (compras el mapa a la viuda)' }],
})

// «…tomada por los ingleses»: al zarpar, la carta 95 entra en el mazo de Peligros; los #Armada# reciben +1.
registrarMision('isla-II-ingleses', {
  alZarpar: () => [{ tipo: 'entrarEnMazo', carta: 'armada' }],
  capacidades: [dificultadClaves('ingleses', ['Armada'], 1)],
})

// «…sacudida por un temblor»: sin retirada; cada Prueba que falles, 1 ficha de Derrumbe; con 3, la misión falla.
registrarMision('isla-II-temblor', {
  sinRetirada: true,
  fichas: [{ ficha: 'derrumbe', nombre: 'Derrumbe', umbral: 3, inicial: 0, nota: 'Cada Prueba que falles pone 1. Con 3, la cueva se viene abajo y la misión falla.' }],
  capacidades: [alFallarPrueba('derrumbe', () => [ponerFichas('derrumbe', 1)])],
  alCambiarFichas: (s, _f, antes, ahora) => {
    if (antes < 3 && ahora >= 3) fallaPor(s, 'la cueva se viene abajo')
    return []
  },
})

// 294 «La cueva se viene abajo» (la recompensa de «…sacudida por un temblor»). «Elige: Cargas con todo el oro: gana 3 de
// reputación; cada Tripulante sufre 1 herida. Sales a tiempo: gana 2 y roba 2.»
registrarCartaDeRecompensa('cueva_abajo', {
  efecto: (_s, carta) => [{ tipo: 'elegirFinal', carta }],
  alElegir: (_s, clave) =>
    clave === 'oro' ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', cada: true }, hacer: { tipo: 'heridas', n: 1 } }] : clave === 'salir' ? [robarN(2)] : [],
})

// «El mapa era falso»: cada Prueba de EXP que superes, 1 de Avance adicional. Su recompensa también es la carta 293 (como
// ya está superado, se sortean los otros dos capítulos II).
registrarMision('isla-II-falso', {
  capacidades: avanceAdicional('pista', 'EXP', 'La pista buena'),
})

// ---------------------------------------------------------------------------
// El rival con su barra: «Después de que reveles una carta de Peligro, pon 2 fichas de Rival» y «Después de que superes
// una Prueba de NAV en esta misión, gana 1 de Avance adicional».

const FICHA_RIVAL = (nota: string) => ({ ficha: 'rival' as const, nombre: 'Rival', umbral: 8, inicial: 0, nota })
const reglasDeRival = (): CapacidadDeCarta[] => [alRevelarPeligro('rival', () => [ponerFichas('rival', 2)]), ...avanceAdicional('ceñir', 'NAV', 'Ceñís el viento')]

// La regata de San Juan (276): con 8 o más fichas de Rival, el rival gana la regata y, al superarla, ganas 1 de reputación
// en lugar de su recompensa (sin el Gallardete).
registrarMision('regata-I', {
  fichas: [FICHA_RIVAL('Con 8 o más, el rival gana la regata: al superarla, solo ganas 1 de reputación.')],
  capacidades: reglasDeRival(),
  recompensaEnLugar: (s) => {
    if (fichas(s, 'rival') < 8) return null
    anotar(s, 'aviso', 'El rival gana la regata: ganas 1 de reputación en lugar de la recompensa.')
    return [reputacion(1)]
  },
})

// La carrera de van Hoorn · I «La ruta de los alisios» (259). Acción: Destina 3 NAV: quita 2 fichas de Rival (una vez
// por misión). Con 8 fichas de Rival, la misión termina; si no la superas, se aparta y llega el capítulo II-b (261).
registrarMision('vanhoorn-I', {
  fichas: [FICHA_RIVAL('Con 8, van Hoorn llega antes: la misión termina y llega el capítulo II-b.')],
  capacidades: [
    ...reglasDeRival(),
    {
      clave: 'alisio',
      ventana: 'accion',
      texto: 'Destina 3 NAV: quita 2 fichas de Rival de esta misión',
      coste: [{ tipo: 'destina', n: 3, hab: 'NAV' }],
      limite: { veces: 1, por: 'mision' },
      requisito: (s) => fichas(s, 'rival') > 0 && !s.mision?.fin,
      efecto: () => [ponerFichas('rival', -2)],
    },
  ],
  alCambiarFichas: (s, _f, antes, ahora) => {
    if (antes < 8 && ahora >= 8) terminaLaMision(s, 'van Hoorn llega antes (8 fichas de Rival)')
    return []
  },
  apartarSiNoSuperas: true,
  alNoSuperar: (s) => {
    const iib = s.zonas.mazoHistoria.find((c) => copia(s, c).id === 'vanhoorn-II-b')
    if (iib) {
      mover(s, iib, 'mazoMisiones', 'arriba')
      anotar(s, 'efecto', `«${nombre(s, iib)}» (carta 261) se pone encima del mazo de Misiones.`)
    }
    return []
  },
})

registrarMision('vanhoorn-II-a', {})

registrarMision('vanhoorn-II-b', { alZarpar: () => [aplicar([codigo('vanhoorn.barco')])] })

// La carta 262, «El barco de van Hoorn»: Mar · Abordaje · COM 4. Antes de asignar, puedes agotar un Cañón: −1.
registrarPeligro('barco_vanhoorn', {
  encuentros: {
    unico: {
      elige: [
        { texto: 'Sin agotar ningún Cañón: Prueba de COM 4', prueba: true },
        { texto: 'Agotar un Cañón: esta Prueba recibe −1', prueba: true, modDificultad: -1, efectos: [agotaCanones(1)] },
      ],
      abordaje: true,
      // P98 (Albert): los barcos rivales llevan Alerta (un Otear no puede mandarlos al fondo).
      alerta: true,
      exito: [robar(1)],
    },
  },
  // −1. Sin oposición: daña 1.
  destino: { sinOposicion: [dano(1)] },
})

// ---------------------------------------------------------------------------
// El fugitivo (264–267)

registrarMision('fugitivo-I', {})

// P98 (Albert): «No puedes superar esta misión si la carta 267 (el prisionero) no está en juego.»
registrarMision('fugitivo-II', {
  alZarpar: () => [aplicar([codigo('fugitivo.barco')])],
  impideSuperar: (s) => (s.zonas.permanentes.some((c) => copia(s, c).id === 'pm_prisionero') ? null : 'Sin el prisionero (carta 267) en juego, no puedes superarla'),
})

// La carta 266, «El barco del fugitivo»: Mar · Abordaje · COM 4. Si la superas, pon en juego la carta 267 (el
// prisionero). Si la fallas, Abordaje y el fugitivo escapa: la misión falla.
registrarCodigo('fugitivo.escapa', (s) => {
  fallaPor(s, 'el fugitivo escapa')
  return []
})
registrarPeligro('barco_fugitivo', {
  // P98 (Albert): Alerta y COM 3 (antes, 4).
  encuentros: { unico: { abordaje: true, alerta: true, exito: [{ tipo: 'ponerEnJuego', carta: 'pm_prisionero' }], fallo: [codigo('fugitivo.escapa')] } },
  destino: { sinOposicion: [dano(1)] },
})

// Permanente 267, «El prisionero» (Vida 3): puede sufrir las heridas de un Tripulante en su lugar; sin Vida, la misión
// falla. (Vuelve al mazo de historia al terminar la misión, como todas.) P99 (Albert): puede sufrir más heridas de las que
// le queda de Vida.
registrarPermanente('pm_prisionero', { quitar: [], capacidades: [desviar('heridas', 'heridas')] })
SIN_VIDA.set('pm_prisionero', (s) => fallaPor(s, 'el prisionero muere'))

// ---------------------------------------------------------------------------
// El naufragio del San José (268): bucear en el mazo del naufragio (269–271 y 277–285)
// Fase 15, tercera ronda (Albert): la misión no tiene reglas; su recompensa es «Coge la carta 286 del mazo de historia», y la
// carta 286, «Fondeáis sobre el San José», es la que hace bucear. Al terminar, ella y el mazo del naufragio vuelven al mazo de
// historia (regla general), salvo las cartas que estén en juego.

const NAUFRAGIO = 'naufragio-I'
/** La carta 286, «Fondeáis sobre el San José»: las preguntas del buceo vienen de ella. */
const FONDEO = 'fondeo_sanjose'

const cuantas = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`

/** Tripulantes preparados que pueden bucear (el que baja se agota). */
const preparadosParaBucear = (s: Estado) => s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)

/** ¿Se puede bucear otra vez? Misión superada, sin haber dejado de bucear, con cartas en el mazo y alguien preparado. */
export function puedeBucear(s: Estado): boolean {
  const m = s.mision
  return !!m?.naufragio && m.fin === 'superada' && !m.naufragio.fin && s.zonas.mazoNaufragio.length > 0 && preparadosParaBucear(s).length > 0
}

/** ¿Tienes esta carta del mazo del naufragio a un lado («Quédate esta carta»)? */
export function tienesDelNaufragio(s: Estado, id: CartaId): boolean {
  return s.zonas.naufragioQuedadas.some((c) => copia(s, c).id === id)
}

/**
 * Carta 286: «Prepara a todos tus Tripulantes y baraja el mazo del naufragio.» Sus cartas salen del mazo de historia (las
 * que ya están en juego, no). Después se bucea.
 */
registrarEspecial('naufragio.barajar', (s) => {
  const m = s.mision
  if (!m || m.fin !== 'superada') return 'hecha'
  const ids = cartasDelNaufragio()
  for (const c of s.zonas.mazoHistoria.filter((x) => ids.includes(copia(s, x).id))) mover(s, c, 'mazoNaufragio', 'abajo')
  barajar(s, 'mazoNaufragio')
  m.naufragio = { inmersiones: 0 }
  anotar(s, 'efecto', `Barajas el mazo del naufragio (${cuantas(s.zonas.mazoNaufragio.length, 'carta', 'cartas')}).`)
  return 'hecha'
})

/**
 * Al dejar de bucear, todo el mazo del naufragio vuelve al mazo de historia (el mazo, lo que te has quedado y lo apartado),
 * salvo las cartas que estén en juego (regla general de Albert). La carta 286 vuelve después (`devolverCogida`).
 */
function recogerElNaufragio(s: Estado): void {
  const vuelven = [...s.zonas.mazoNaufragio, ...s.zonas.naufragioQuedadas, ...s.zonas.naufragioApartadas]
  for (const c of vuelven) mover(s, c, 'mazoHistoria', 'abajo')
  if (vuelven.length > 0) anotar(s, 'efecto', 'El mazo del naufragio vuelve al mazo de historia.')
}

/**
 * «Puedes bucear las veces que quieras: agota a un Tripulante preparado y roba 1 carta del mazo del naufragio.»
 * Paso 0: ¿bajas otra vez?; paso 1: quién baja. Se repite hasta que dices basta, no queda nadie preparado o el mazo se acaba.
 */
registrarEspecial('naufragio.bucear', (s, t, e) => {
  const m = s.mision
  const naufragio = m?.naufragio
  if (!m || m.fin !== 'superada' || !naufragio) return 'hecha'
  if (t.paso === 0) {
    if (!puedeBucear(s)) {
      if (!naufragio.fin) {
        if (s.zonas.mazoNaufragio.length === 0) anotar(s, 'efecto', 'El mazo del naufragio se ha quedado sin cartas: no puedes bucear más.')
        else anotar(s, 'efecto', 'No te queda ningún Tripulante preparado: no puedes bucear más.')
        naufragio.fin = true
      }
      recogerElNaufragio(s)
      return 'hecha'
    }
    if (!e) {
      const quedan = cuantas(s.zonas.mazoNaufragio.length, 'carta', 'cartas')
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'bucear', carta: FONDEO, n: naufragio.inmersiones, texto: quedan },
        opciones: [
          { clave: 'bucear', texto: `Bucear: agota a un Tripulante preparado y roba 1 carta del mazo del naufragio (quedan ${quedan})` },
          { clave: 'subir', texto: 'Dejar de bucear' },
        ],
      })
    }
    if (eleccionDe(e, 'opcion').clave !== 'bucear') {
      naufragio.fin = true
      anotar(s, 'jugada', naufragio.inmersiones === 0 ? 'No buceas en el naufragio.' : `Dejas de bucear después de ${cuantas(naufragio.inmersiones, 'inmersión', 'inmersiones')}.`)
      recogerElNaufragio(s)
      return 'hecha'
    }
    t.paso = 1
    return 'sigue'
  }
  // Paso 1: quién baja.
  const posibles = preparadosParaBucear(s)
  let buzo: InstId | undefined = posibles.length === 1 ? posibles[0] : undefined
  if (!buzo) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'buzo', carta: FONDEO }, candidatas: posibles, min: 1, max: 1 })
    buzo = eleccionDe(e, 'cartas').ids[0]
  }
  t.paso = 0
  if (!buzo) return 'sigue'
  naufragio.buzo = buzo
  naufragio.inmersiones++
  anotar(s, 'jugada', `${nombre(s, buzo)} baja al naufragio (inmersión ${naufragio.inmersiones}).`)
  encolar(s, { tipo: 'especial', clave: 'naufragio.robar', datos: {}, paso: 0 })
  // Agotar va antes que robar (uno que está Sangrando sufre su herida al agotarse).
  agotar(s, buzo)
  return 'sigue'
})

/** Heridas al Tripulante que ha robado la carta (si sigue en la tripulación). */
function heridasAlBuzo(s: Estado, buzo: InstId | undefined, n: number): NuevaTarea[] {
  if (!buzo || !s.zonas.tripulacion.includes(buzo) || n <= 0) return []
  return [{ tipo: 'evento', ev: { tipo: 'heridas', objetivo: buzo, cantidad: n }, fase: 'antes', cancelado: false, usadas: [] }]
}

/** Un Estado al Tripulante que ha robado la carta (si sigue en la tripulación). */
function estadoAlBuzo(s: Estado, buzo: InstId | undefined, estado: 'sangrando' | 'maldito'): NuevaTarea[] {
  if (!buzo || !s.zonas.tripulacion.includes(buzo)) return []
  return [aplicar([{ tipo: 'sobre', carta: buzo, hacer: { tipo: 'estado', estado } }])]
}

/** «Si también tienes "La llave del cofre", gana 1 [rep].» La reputación se gana una vez, al juntar las dos. */
function mitadDelCofre(otra: CartaId, esta: CartaId) {
  return (s: Estado): NuevaTarea[] => {
    if (!tienesDelNaufragio(s, otra)) return []
    anotar(s, 'efecto', `Juntas «${porId(esta).carta.nombre}» y «${porId(otra).carta.nombre}».`)
    return [reputacion(numeroConIcono(textoDe(esta), 'rep'))]
  }
}

/**
 * Lo que hace cada carta del mazo del naufragio al robarla, antes de decidir adónde va (eso lo dice su texto: ver
 * `destinoNaufragio`). Los números se leen de su texto. La culebrina, la campana y el doblón solo se ponen en juego.
 */
const EFECTOS_NAUFRAGIO: Record<CartaId, (s: Estado, buzo: InstId | undefined) => NuevaTarea[]> = {
  naufragio_cofre: mitadDelCofre('naufragio_llave', 'naufragio_cofre'),
  naufragio_llave: mitadDelCofre('naufragio_cofre', 'naufragio_llave'),
  culebrina_sanjose: () => [],
  campana_sanjose: () => [],
  doblon: () => [],
  // «Busca en el mazo de Misiones el capítulo I de una travesía…»
  naufragio_diario: () => [{ tipo: 'especial', clave: 'naufragio.diario', datos: {}, paso: 0 }],
  // «Prepara a todos tus Tripulantes.»
  naufragio_bolsa: () => [{ tipo: 'prepararTripulantes' }],
  // «El Tripulante que ha robado esta carta sufre 1 [herida].»
  naufragio_tiburon: (s, buzo) => heridasAlBuzo(s, buzo, numeroConIcono(textoDe('naufragio_tiburon'), 'herida')),
  // «… queda Sangrando.» / «… queda Maldito.»
  naufragio_coral: (s, buzo) => estadoAlBuzo(s, buzo, 'sangrando'),
  naufragio_ahogados: (s, buzo) => estadoAlBuzo(s, buzo, 'maldito'),
  // «El Barco queda Perseguido.»
  naufragio_raqueros: () => [aplicar([{ tipo: 'estadoBarco', estado: 'perseguido' }])],
  // «El pulpo atrapa al Tripulante que ha robado esta carta. Elige: …»
  naufragio_pulpo: () => [{ tipo: 'especial', clave: 'naufragio.pulpo', datos: {}, paso: 0 }],
}

/** Roba la carta superior del mazo del naufragio, la aparta mientras se aplica y después la lleva adonde diga. */
registrarEspecial('naufragio.robar', (s) => {
  const m = s.mision
  const carta = s.zonas.mazoNaufragio[0]
  if (!m?.naufragio || !carta) return 'hecha'
  const id = copia(s, carta).id
  s.infoRevelada++
  anotar(s, 'revelar', `Robas del mazo del naufragio: «${nombre(s, carta)}».`, { tipo: 'naufragio', inst: carta, carta: id })
  mover(s, carta, 'naufragioApartadas', 'abajo')
  const efecto = EFECTOS_NAUFRAGIO[id]
  if (!efecto) throw new Error(`Carta del naufragio sin efecto: ${id}`)
  encolar(s, ...efecto(s, m.naufragio.buzo), { tipo: 'especial', clave: 'naufragio.destino', datos: { carta }, paso: 0 })
  return 'hecha'
})

/**
 * Regla del motor (Albert): «Quédate esta carta», a un lado; «Pon esta carta en juego», en juego (la culebrina, solo si
 * tienes Espacio: si no, vuelve barajada); «Vuelve a barajar esta carta…», otra vez al mazo; si no dice nada, se aparta.
 */
registrarEspecial('naufragio.destino', (s, t) => {
  const carta = t.datos.carta as InstId
  if (!s.zonas.naufragioApartadas.includes(carta)) return 'hecha'
  const id = copia(s, carta).id
  const volverAlMazo = (texto: string) => {
    mover(s, carta, 'mazoNaufragio', 'abajo')
    barajar(s, 'mazoNaufragio')
    anotar(s, 'efecto', texto)
  }
  switch (destinoNaufragio(id)) {
    case 'quedar':
      mover(s, carta, 'naufragioQuedadas', 'abajo')
      anotar(s, 'efecto', `Te quedas «${nombre(s, carta)}», a un lado.`)
      break
    case 'enJuego': {
      const e = porId(id)
      if (e.tipo === 'tesoro') {
        encolar(s, { tipo: 'ponerTesoro', carta })
        break
      }
      if (e.tipo === 'mejoraBarco' && espacioLibre(s) < e.carta.espacio) {
        volverAlMazo(`No tienes Espacio para «${nombre(s, carta)}»: vuelve barajada al mazo del naufragio.`)
        break
      }
      mover(s, carta, 'mejoras', 'abajo')
      copia(s, carta).vinculadaA = 'barco'
      anotar(s, 'efecto', `«${nombre(s, carta)}» entra en juego en el Barco.`)
      break
    }
    case 'barajar':
      volverAlMazo(`«${nombre(s, carta)}» vuelve barajada al mazo del naufragio.`)
      break
    case 'apartar':
      anotar(s, 'efecto', `«${nombre(s, carta)}» se aparta.`)
      break
  }
  return 'hecha'
})

/**
 * «El pulpo atrapa al Tripulante que ha robado esta carta. Elige: Sacarlo entre dos: agota a otro Tripulante preparado.
 * Que se suelte solo: el Tripulante que ha robado esta carta sufre 2 [herida].» Sin nadie más preparado, solo la segunda.
 * Paso 0: qué opción; paso 1: a quién agotas.
 */
registrarEspecial('naufragio.pulpo', (s, t, e) => {
  const buzo = s.mision?.naufragio?.buzo
  const otros = preparadosParaBucear(s).filter((c) => c !== buzo)
  const soltarse = () => {
    anotar(s, 'efecto', 'El pulpo se suelta solo.')
    encolar(s, ...heridasAlBuzo(s, buzo, numeroConIcono(textoDe('naufragio_pulpo'), 'herida')))
  }
  if (t.paso === 0) {
    if (otros.length === 0) {
      soltarse()
      return 'hecha'
    }
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'pulpo', carta: 'naufragio_pulpo' },
        opciones: [
          { clave: 'dos', texto: 'Sacarlo entre dos: agota a otro Tripulante preparado' },
          { clave: 'solo', texto: `Que se suelte solo: ${buzo ? nombre(s, buzo) : 'el Tripulante que ha robado esta carta'} sufre 2 heridas` },
        ],
      })
    }
    if (eleccionDe(e, 'opcion').clave !== 'dos') {
      soltarse()
      return 'hecha'
    }
    t.paso = 1
    return 'sigue'
  }
  let ayuda: InstId | undefined = otros.length === 1 ? otros[0] : undefined
  if (!ayuda) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'pulpoAyuda', carta: 'naufragio_pulpo' }, candidatas: otros, min: 1, max: 1 })
    ayuda = eleccionDe(e, 'cartas').ids[0]
  }
  if (ayuda && otros.includes(ayuda)) {
    anotar(s, 'efecto', `${nombre(s, ayuda)} baja a ayudar: lo sacan entre dos.`)
    agotar(s, ayuda)
  }
  return 'hecha'
})

/** Los capítulos I de travesía que quedan en el mazo de Misiones (para «El diario del capitán»). */
export function capitulosIDeTravesia(s: Estado): InstId[] {
  return s.zonas.mazoMisiones.filter((c) => {
    const e = porId(copia(s, c).id)
    return e.tipo === 'capitulo' && e.carta.capitulo === 'I' && DATOS.ordenMisiones.travesias.includes(e.mision.id)
  })
}

/**
 * «El diario del capitán»: «Busca en el mazo de Misiones el capítulo I de una travesía. Ponlo entre tus misiones
 * disponibles en lugar de una de ellas, que va al fondo del mazo de Misiones, y pon 2 [avance] sobre él.» Si no hay
 * ninguno, no ocurre nada. La misión en curso (el naufragio) no cuenta entre las que se pueden cambiar.
 * P107 (Albert): después de buscar, el mazo de Misiones se baraja (como el de muelle al buscar), y la misión cambiada va al
 * fondo después.
 * Paso 0: qué capítulo; paso 1: qué misión disponible cambias.
 */
registrarEspecial('naufragio.diario', (s, t, e) => {
  if (t.paso === 0) {
    const capitulos = capitulosIDeTravesia(s)
    if (capitulos.length === 0) {
      anotar(s, 'efecto', 'No queda ningún capítulo I de travesía en el mazo de Misiones: no ocurre nada.')
      return 'hecha'
    }
    let capitulo: InstId | undefined = capitulos.length === 1 ? capitulos[0] : undefined
    if (!capitulo) {
      if (!e) {
        s.infoRevelada++
        return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'diarioCapitulo', carta: 'naufragio_diario' }, candidatas: capitulos, min: 1, max: 1 })
      }
      capitulo = eleccionDe(e, 'cartas').ids[0]
    }
    if (!capitulo || !capitulos.includes(capitulo)) return 'hecha'
    t.datos.capitulo = capitulo
    t.paso = 1
    return 'sigue'
  }
  const capitulo = t.datos.capitulo as InstId
  const cambiables = s.zonas.misionesDisponibles.filter((c) => c !== s.mision?.carta)
  let cambiada: InstId | undefined = cambiables.length === 1 ? cambiables[0] : undefined
  if (!cambiada && cambiables.length > 1) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'diarioCambiar', carta: 'naufragio_diario', texto: nombre(s, capitulo) }, candidatas: cambiables, min: 1, max: 1 })
    cambiada = eleccionDe(e, 'cartas').ids[0]
  }
  const sitio = cambiada ? s.zonas.misionesDisponibles.indexOf(cambiada) : s.zonas.misionesDisponibles.length
  mover(s, capitulo, 'misionesDisponibles', 'abajo')
  // En el mismo sitio que la que sale.
  s.zonas.misionesDisponibles = s.zonas.misionesDisponibles.filter((c) => c !== capitulo)
  s.zonas.misionesDisponibles.splice(sitio, 0, capitulo)
  barajar(s, 'mazoMisiones')
  if (cambiada) mover(s, cambiada, 'mazoMisiones', 'abajo')
  const n = numeroConIcono(textoDe('naufragio_diario'), 'avance')
  copia(s, capitulo).avance += n
  s.infoRevelada++
  anotar(
    s,
    'efecto',
    `«${nombre(s, capitulo)}» pasa a tus misiones disponibles con ${n} de Avance${cambiada ? `, en lugar de «${nombre(s, cambiada)}», que va al fondo del mazo de Misiones` : ''}.`,
  )
  return 'hecha'
})

// La misión no tiene reglas: su recompensa es la carta 286.
registrarMision(NAUFRAGIO, {})

// Carta 286, «Fondeáis sobre el San José»: «Prepara a todos tus Tripulantes y baraja el mazo del naufragio (cartas 269–271
// y 277–285). Puedes bucear las veces que quieras: agota a un Tripulante preparado y roba 1 carta del mazo del naufragio.»
registrarCartaDeRecompensa(FONDEO, (s) =>
  s.mision
    ? [
        { tipo: 'prepararTripulantes' },
        { tipo: 'especial', clave: 'naufragio.barajar', datos: {}, paso: 0 },
        { tipo: 'especial', clave: 'naufragio.bucear', datos: {}, paso: 0 },
      ]
    : [],
)

// ---------------------------------------------------------------------------
// Escolta del San Telmo (272–273)

const GALEON = 'pm_galeon'

registrarMision('escolta-I', {
  alZarpar: () => [ponerEnJuego(GALEON)],
})

// 295 «El galeón llega a puerto» (fase 15, cuarta ronda: la recompensa de la escolta, con «+2 [rep]» en el recuadro). «Si la
// carta 273 tiene 3 o más Vida restante, gana 1 de reputación y roba 2.» Se coge antes de que el galeón vuelva al mazo de
// historia (al terminar la misión).
registrarCartaDeRecompensa('galeon_puerto', (s) => {
  const vida = vidaRestanteDe(s, GALEON) ?? 0
  if (vida < 3) {
    anotar(s, 'efecto', `El galeón llega con ${vida} de Vida: no ganas nada más.`)
    return []
  }
  anotar(s, 'efecto', `El galeón llega con ${vida} de Vida: +1 de reputación y robas 2.`)
  return [reputacion(1), robarN(2)]
})

// Permanente 273, «Galeón San Telmo» (Vida 4).
registrarPermanente(GALEON, {
  quitar: [],
  capacidades: [
    {
      clave: 'fuego',
      ventana: 'obligada',
      // «Obligado: Después de que falles una Prueba, inflige 1 daño a esta carta» (cualquier Prueba, no solo las de COM).
      disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba',
      efecto: (s, yo) => {
        if (yo) danarPermanente(s, yo, 1, 'daño')
        return []
      },
    },
    desviar('cubrir', 'danoBarco'),
  ],
})
SIN_VIDA.set(GALEON, (s) => fallaPor(s, 'el galeón San Telmo se hunde'))

// ---------------------------------------------------------------------------
// El asedio de Port Royal (274–275)

const ASEDIO = 'asedio-I'
const MURALLAS = 'pm_murallas'
const enElAsedio = (s: Estado) => s.mision !== null && copia(s, s.mision.carta).id === ASEDIO

/** ¿Has zarpado este turno a esta misión? (lo dice el registro de la partida) */
function zarpasteEsteTurno(s: Estado, mision: CartaId): boolean {
  for (let i = s.registro.length - 1; i >= 0; i--) {
    const r = s.registro[i]
    if (!r || r.turno !== s.turno) break
    if (r.dato?.tipo === 'zarpar' && r.dato.mision === mision) return true
  }
  return false
}

registrarMision(ASEDIO, {})

// 296 «Port Royal resiste» (fase 15, cuarta ronda: la recompensa del asedio, con «+2 [rep]» en el recuadro). «Si la carta
// 275 tiene 4 o más Vida restante, gana 1 de reputación.»
registrarCartaDeRecompensa('port_royal_resiste', (s) => {
  const vida = vidaRestanteDe(s, MURALLAS) ?? 0
  if (vida < 4) {
    anotar(s, 'efecto', `Las murallas aguantan con ${vida} de Vida: no ganas nada más.`)
    return []
  }
  anotar(s, 'efecto', `Las murallas aguantan con ${vida} de Vida: +1 de reputación.`)
  return [reputacion(1)]
})

// «Obligado: Cuando esta misión pase a estar disponible, pon en juego la carta 275.» Las Murallas están en juego mientras
// la misión esté disponible (también durante ella); si deja de estarlo (superada o al fondo del mazo de Misiones), vuelven
// al mazo de historia.
// P96 (Albert): «Sigue en juego mientras “El asedio de Port Royal” esté disponible»: si la misión deja las disponibles sin
// superarse (al fondo, o con el Tablón de encargos), las Murallas vuelven al mazo de historia; si vuelve a salir, entran
// otra vez con toda su Vida.
registrarVigilante((s) => {
  const disponible = s.zonas.misionesDisponibles.some((c) => copia(s, c).id === ASEDIO)
  const enJuego = s.zonas.permanentes.find((c) => copia(s, c).id === MURALLAS)
  if (disponible === Boolean(enJuego)) return false
  // Mientras se cierra una misión del asedio que no se ha superado, no se toca nada (aún está entre las disponibles).
  if (enElAsedio(s) && s.mision?.fin && s.mision.fin !== 'superada') return false
  if (disponible) {
    const murallas = s.zonas.mazoHistoria.find((c) => copia(s, c).id === MURALLAS)
    if (!murallas || (enElAsedio(s) && s.mision?.fin)) return false
    mover(s, murallas, 'permanentes', 'abajo')
    anotar(s, 'aviso', `«El asedio de Port Royal» está disponible: pones en juego la carta 275 del mazo de historia, «${nombre(s, murallas)}».`)
    return true
  }
  if (enJuego) {
    mover(s, enJuego, 'mazoHistoria', 'abajo')
    anotar(s, 'efecto', `«${nombre(s, enJuego)}» vuelve al mazo de historia.`)
    return true
  }
  return false
})

// Permanente 275, «Murallas de Port Royal» (Vida 6). P97 (Albert): «al final de cada turno en que no hayas zarpado a esta
// misión» cuenta también el turno en que aparece (no hay que recordar en qué turno entró).
registrarPermanente(MURALLAS, {
  quitar: [],
  seQueda: true,
  capacidades: [
    {
      clave: 'brecha',
      ventana: 'obligada',
      disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'finTurno' && !zarpasteEsteTurno(s, ASEDIO),
      efecto: (s, yo) => {
        if (yo) {
          anotar(s, 'aviso', 'No has zarpado a «El asedio de Port Royal» este turno: las murallas sufren el cañoneo.')
          danarPermanente(s, yo, 1, 'daño')
        }
        return []
      },
    },
    {
      clave: 'asalto',
      ventana: 'obligada',
      disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba' && enElAsedio(s),
      efecto: (s, yo) => {
        if (yo) danarPermanente(s, yo, 1, 'daño')
        return []
      },
    },
    desviar('cubrir', 'danoBarco', enElAsedio),
  ],
})
// «Cuando esta carta no tenga Vida restante: −2 reputación, pon la misión al fondo del mazo de Misiones y devuelve esta
// carta al mazo de historia.» Durante la misión, la misión falla y va al fondo sin preguntar.
SIN_VIDA.set(MURALLAS, (s, inst) => {
  anotar(s, 'aviso', 'Caen las murallas de Port Royal: −2 de reputación.')
  encolar(s, reputacion(-2))
  mover(s, inst, 'mazoHistoria', 'abajo')
  const m = s.mision
  if (m && enElAsedio(s)) {
    fallaPor(s, 'caen las murallas de Port Royal')
    m.destinoForzado = 'fondo'
    return
  }
  const mision = s.zonas.misionesDisponibles.find((c) => copia(s, c).id === ASEDIO)
  if (mision) {
    mover(s, mision, 'mazoMisiones', 'abajo')
    anotar(s, 'efecto', '«El asedio de Port Royal» va al fondo del mazo de Misiones.')
  }
})
