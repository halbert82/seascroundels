// Fase 15 · misiones nuevas: las travesías «La Isla del Tesoro» (capítulo II al azar), «La carrera de van Hoorn» (el
// rival con su barra y Destina) y «El fugitivo» (el prisionero), y las misiones sueltas «El pecio del San José»
// (bucear), «Escolta del San Telmo» y «El asedio de Port Royal» (cartas que se protegen) y «La regata de San Juan».
// También las permanentes con Vida (Galeón San Telmo, Murallas de Port Royal, El prisionero), los dos barcos rivales del
// mazo de historia y los Tesoros nuevos.

import { entero } from '../azar.ts'
import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { porId } from '../catalogo.ts'
import type { CapacidadDeCarta } from '../definiciones.ts'
import type { Efecto } from '../efectos.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { mazoActivo } from '../peligros.ts'
import { agotaCanones, avance, codigo, dano, robar } from '../peligros2/comun.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { registrarEspecial } from '../tareas/peligros2.ts'
import type { CartaId, Estado, InstId, NuevaTarea, TareaDe } from '../tipos.ts'
import { mover } from '../zonas.ts'
import { alFallarPrueba, alRevelarPeligro, alSuperarPrueba, dificultadClaves, fichas, ponerFichas, registrarMision, ultimaPrueba } from './comun.ts'
import { registrarVigilante } from './registro.ts'

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

/** Una carta al azar de entre las de esta lista que estén en el mazo de historia («baraja boca abajo…»). */
function alAzarDeHistoria(s: Estado, nums: number[]): number | undefined {
  const presentes = nums.filter((n) => s.zonas.mazoHistoria.some((c) => porId(copia(s, c).id).num === n))
  if (presentes.length === 0) return undefined
  s.infoRevelada++
  return presentes[entero(s, presentes.length)]
}

registrarMision('isla-I', {
  alZarpar: () => [{ tipo: 'alZarparOpcional', coste: { tipo: 'descartar', n: 2 }, efectos: [avance(2)], texto: 'Descartar 2 cartas para ganar 2 de Avance (compras el mapa a la viuda)' }],
  // «Baraja boca abajo las cartas 256, 257 y 258 del mazo de historia. Pon una encima del mazo de Misiones sin mirarla y
  // devuelve las otras al mazo de historia.»
  siguiente: (s) => alAzarDeHistoria(s, [256, 257, 258]) ?? 256,
  conservarOtros: true,
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
  // Elige: cargar con todo el oro (3 y cada Tripulante sufre 1 herida) o salir a tiempo (2 y robas 2).
  alElegir: (_s, clave) =>
    clave === 'oro' ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', cada: true }, hacer: { tipo: 'heridas', n: 1 } }] : clave === 'salir' ? [robarN(2)] : [],
})

// «El mapa era falso»: cada Prueba de EXP que superes, 1 de Avance adicional. Al superarla, uno de los otros dos capítulos
// II al azar.
registrarMision('isla-II-falso', {
  capacidades: [alSuperarPrueba('pista', (_s, p) => (p.hab === 'EXP' ? [{ tipo: 'ganarAvance', n: 1, motivo: 'La pista buena' }] : []))],
  siguiente: (s) => alAzarDeHistoria(s, [256, 257]) ?? 256,
  conservarOtros: true,
})

// ---------------------------------------------------------------------------
// El rival con su barra: «Después de que reveles una carta de Peligro, pon 2 fichas de Rival» y «Después de que superes
// una Prueba de NAV en esta misión, gana 1 de Avance adicional».

const FICHA_RIVAL = (nota: string) => ({ ficha: 'rival' as const, nombre: 'Rival', umbral: 8, inicial: 0, nota })
const reglasDeRival = (): CapacidadDeCarta[] => [
  alRevelarPeligro('rival', () => [ponerFichas('rival', 2)]),
  alSuperarPrueba('ceñir', (_s, p) => (p.hab === 'NAV' ? [{ tipo: 'ganarAvance', n: 1, motivo: 'Ceñís el viento' }] : [])),
]

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
      exito: [robar(1)],
    },
  },
  // −1. Sin oposición: daña 1.
  destino: { sinOposicion: [dano(1)] },
})

// ---------------------------------------------------------------------------
// El fugitivo (264–267)

registrarMision('fugitivo-I', {})

registrarMision('fugitivo-II', { alZarpar: () => [aplicar([codigo('fugitivo.barco')])] })

// La carta 266, «El barco del fugitivo»: Mar · Abordaje · COM 4. Si la superas, pon en juego la carta 267 (el
// prisionero). Si la fallas, Abordaje y el fugitivo escapa: la misión falla.
registrarCodigo('fugitivo.escapa', (s) => {
  fallaPor(s, 'el fugitivo escapa')
  return []
})
registrarPeligro('barco_fugitivo', {
  encuentros: { unico: { abordaje: true, exito: [{ tipo: 'ponerEnJuego', carta: 'pm_prisionero' }], fallo: [codigo('fugitivo.escapa')] } },
  destino: { sinOposicion: [dano(1)] },
})

// Permanente 267, «El prisionero» (Vida 3): puede sufrir las heridas de un Tripulante en su lugar; sin Vida, la misión
// falla. (Vuelve al mazo de historia al terminar la misión, como todas.)
// TODO(regla): no hace falta tener al prisionero para superar «Vivo, no muerto» (opción por defecto; la carta no lo dice).
registrarPermanente('pm_prisionero', { quitar: [], capacidades: [desviar('heridas', 'heridas')] })
SIN_VIDA.set('pm_prisionero', (s) => fallaPor(s, 'el prisionero muere'))

// ---------------------------------------------------------------------------
// El pecio del San José (268–271): bucear

const PECIO = 'pecio-I'
const MAX_PROFUNDIDAD = 4
const PECIO_FIN = 'pecio.fin'
const dejoDeBucear = (s: Estado) => s.mision?.hecho?.includes(PECIO_FIN) ?? false

registrarCodigo('pecio.sube', () => [ponerFichas('profundidad', 1)])
registrarCodigo('pecio.falla', (s) => {
  const m = s.mision
  if (!m) return []
  m.hecho = [...(m.hecho ?? []), PECIO_FIN]
  const antes = fichas(s, 'profundidad')
  if (antes > 0) anotar(s, 'aviso', `La inmersión sale mal: pierdes las ${antes === 1 ? 'fichas' : `${antes} fichas`} de Profundidad y dejas de bucear.`)
  else anotar(s, 'aviso', 'La inmersión sale mal: dejas de bucear.')
  return antes > 0 ? [ponerFichas('profundidad', -antes)] : []
})

/** «Puedes bucear las veces que quieras» (con la misión ya superada, antes de cobrarla). */
registrarEspecial('pecio.bucear', (s, _t, e) => {
  const m = s.mision
  if (!m || m.fin !== 'superada' || dejoDeBucear(s)) return 'hecha'
  const prof = fichas(s, 'profundidad')
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  if (prof >= MAX_PROFUNDIDAD || preparados.length === 0) return 'hecha'
  const dificultad = 2 + prof
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'bucear', carta: PECIO, n: dificultad },
      opciones: [
        { clave: 'bucear', texto: `Bucear: Prueba de EXP ${dificultad} con un solo Tripulante (Profundidad ${prof} de ${MAX_PROFUNDIDAD})` },
        { clave: 'subir', texto: `Subir con lo que tienes (Profundidad ${prof})` },
      ],
    })
  }
  if (eleccionDe(e, 'opcion').clave !== 'bucear') {
    anotar(s, 'jugada', `Subes con Profundidad ${prof}.`)
    return 'hecha'
  }
  encolar(s, {
    tipo: 'pruebaSuelta',
    fuente: m.carta,
    paso: 'empezar',
    definicion: {
      nombre: `Bucear en el pecio (Profundidad ${prof})`,
      palabrasClave: [],
      opciones: [{ hab: 'EXP', dificultad }],
      exito: [codigo('pecio.sube')],
      fallo: [codigo('pecio.falla')],
      maximo: 1,
      trasSuperar: true,
    },
  })
  return 'sigue'
})

registrarMision(PECIO, {
  fichas: [{ ficha: 'profundidad', nombre: 'Profundidad', umbral: MAX_PROFUNDIDAD, inicial: 0, nota: 'Cuando vayas a superarla, puedes bucear: EXP 2 más tus fichas de Profundidad.' }],
  antesDeSuperar: (s) => (s.mision ? [{ tipo: 'especial', clave: 'pecio.bucear', datos: {}, paso: 0 }] : []),
  // Después de su 1 de reputación: mira la carta 269 y aplica sus recompensas hasta tu Profundidad (se suman).
  alSuperar: (s) => {
    const prof = fichas(s, 'profundidad')
    const tareas: NuevaTarea[] = []
    const premios = ['roba 2 cartas', '+1 de reputación', 'el Tesoro 270, «Cadena de oro del San José»', 'el Tesoro 271, «La custodia de esmeraldas»']
    anotar(
      s,
      'efecto',
      prof > 0
        ? `Miras la carta 269 («El fondo del San José»): con Profundidad ${prof}, ${premios.slice(0, prof).join('; ')}.`
        : 'Miras la carta 269 («El fondo del San José»): sin Profundidad, no hay nada más.',
    )
    if (prof >= 1) tareas.push(robarN(2))
    if (prof >= 2) tareas.push(reputacion(1))
    for (const [nivel, id] of [
      [3, 'cadena_oro'],
      [4, 'custodia'],
    ] as const) {
      const tesoro = prof >= nivel ? s.zonas.mazoHistoria.find((c) => copia(s, c).id === id) : undefined
      if (tesoro) tareas.push({ tipo: 'ponerTesoro', carta: tesoro })
    }
    return tareas
  },
})

// ---------------------------------------------------------------------------
// Escolta del San Telmo (272–273)

const GALEON = 'pm_galeon'

registrarMision('escolta-I', {
  alZarpar: () => [ponerEnJuego(GALEON)],
  // {+2 rep}. Si la carta 273 tiene 3 o más Vida restante, +1 de reputación adicional y roba 2.
  alSuperar: (s) => {
    const vida = vidaRestanteDe(s, GALEON) ?? 0
    if (vida < 3) return []
    anotar(s, 'efecto', `El galeón llega con ${vida} de Vida: +1 de reputación y robas 2.`)
    return [reputacion(1), robarN(2)]
  },
})

// Permanente 273, «Galeón San Telmo» (Vida 4).
registrarPermanente(GALEON, {
  quitar: [],
  capacidades: [
    {
      clave: 'fuego',
      ventana: 'obligada',
      disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba' && (s.prueba?.hab ?? ultimaPrueba(s)?.hab) === 'COM',
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

registrarMision(ASEDIO, {
  // {+2 rep}. Si la carta 275 tiene 4 o más Vida restante, +1 de reputación adicional.
  alSuperar: (s) => {
    const vida = vidaRestanteDe(s, MURALLAS) ?? 0
    if (vida < 4) return []
    anotar(s, 'efecto', `Las murallas aguantan con ${vida} de Vida: +1 de reputación.`)
    return [reputacion(1)]
  },
})

// «Obligado: Cuando esta misión pase a estar disponible, pon en juego la carta 275.» Las Murallas están en juego mientras
// la misión esté disponible (también durante ella); si deja de estarlo (superada o al fondo del mazo de Misiones), vuelven
// al mazo de historia.
// TODO(regla): «Sigue en juego mientras “El asedio de Port Royal” esté disponible» (línea añadida por defecto): si la
// misión deja las disponibles sin superarse (al fondo, o con el Tablón de encargos), las Murallas vuelven al mazo de
// historia; si vuelve a salir, entran otra vez con toda su Vida.
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

// Permanente 275, «Murallas de Port Royal» (Vida 6). TODO(regla): «al final de cada turno en que no hayas zarpado a
// esta misión» cuenta también el turno en que aparece (al pie de la letra; opción por defecto).
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
