// Lo que el motor necesita para resolver un encuentro o una Prueba: lo impreso en la carta (cartas.json, con sus
// recuadros de iconos) más las reglas especiales de los Peligros nuevos, que se registran por carta:
// la permanente que pone en juego, «Elige», Sin ayuda, Abordaje, Persigue, Estados, Incautado, ocupar el muelle…
// Fase 11: lo que hace cada permanente (zona de permanentes) se registra aparte, por la carta permanente.

import type { Entorno, Habilidad, OpcionPrueba } from './datos.ts'
import { interpretarEfectos, type Condicion, type Efecto, type Selector } from './efectos.ts'
import { copia } from './estado.ts'
import { porId } from './catalogo.ts'
import { encuentroDe, entornoActual } from './peligros.ts'
import type { Capacidad, CartaId, Coste, Estado, InstId, PruebaEnCurso } from './tipos.ts'

/** Capacidad escrita en las reglas de una carta (el registro le pone la carta, desde dónde funciona y su clave). */
export type CapacidadDeCarta = Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }

/** Lo que se necesita para resolver una Prueba (de un encuentro o de una Acción). */
export interface DefinicionPrueba {
  nombre: string
  palabrasClave: string[]
  opciones: OpcionPrueba[]
  exito: Efecto[]
  fallo: Efecto[]
  /** Solo un Tripulante; suman las Habilidades de la mano; no se juegan Eventos. */
  sinAyuda?: boolean
  /** Si fallas, 1 herida por cada punto que falte (máximo 3); si faltan 3 o más, además un rehén. */
  abordaje?: boolean
  /** Como mucho, tantos Tripulantes comprometidos. */
  maximo?: number
  /**
   * Fase 15, «Descomunal N»: asigna al menos N Tripulantes a esta Prueba; si no puedes, la fallas. Se puede asignar a
   * nadie (Sin oposición) o a N o más; con menos de N asignados, la Prueba se falla.
   */
  minimo?: number
  /** Solo puede hacerla este Tripulante (ya agotado como coste, se compromete solo). */
  soloCon?: InstId
}

/**
 * Una opción de «Elige»: hacer la Prueba (quizá más difícil) o pagar algo. Con `efectos` y `prueba` a la vez, pagas
 * y después haces la Prueba («le das 2 munición, o la Prueba recibe +2»).
 */
export interface OpcionElige {
  texto: string
  /** Lo que se paga (si es una opción de pago). */
  efectos?: Efecto[]
  /** Solo se ofrece si se cumple. */
  si?: Condicion
  /** Con esta opción se hace la Prueba. */
  prueba?: boolean
  /** «… o la Prueba recibe +2»: dificultad de más. */
  modDificultad?: number
  /** Dificultad de más si se cumple algo («+1 si tienes 2 o más munición»). */
  modSi?: { condicion: Condicion; n: number }
  /** Esta opción gana el Avance sin hacer la Prueba (además de pagar). */
  sinPrueba?: boolean
}

/** Momentos en que una permanente hace algo (o suma una ficha a su contador). */
export type Disparo = 'revelarPeligro' | 'cartaResuelta' | 'finTurno' | 'superarPrueba' | 'fallarPrueba'

/** Cómo se quita una permanente (lo dice la propia carta): vuelve al mazo de historia. */
export type FormaDeQuitar =
  | { tipo: 'prueba'; opciones: OpcionPrueba[]; fallo?: Efecto[]; exito?: Efecto[] }
  | { tipo: 'agotarRasgo'; rasgo: string | null }
  | { tipo: 'pagar'; n: number }

/** Una Acción de una permanente: su coste (si lo tiene) y lo que hace. */
export interface AccionDeCarta {
  texto: string
  coste?: Coste[]
  requisito?: (s: Estado, yo: InstId) => boolean
  efectos: Efecto[]
}

/** Lo que hace una permanente mientras está en la zona de permanentes (fase 11). */
export interface ReglasPermanente {
  quitar: FormaDeQuitar[]
  /** Al ponerla en juego (con ella como fuente): «el atrapado no puede ser asignado ni prepararse». */
  alEntrar?: Efecto[]
  /** Otras Acciones de la carta («agota 2 Tripulantes para poner 1 ficha»). */
  acciones?: AccionDeCarta[]
  /** Respuestas, Obligadas y modificadores escritos a mano. */
  capacidades?: CapacidadDeCarta[]
  /** Mientras esté en juego, no puedes retirarte. */
  bloqueaRetirada?: boolean
  /** Fichas con las que entra en juego. */
  fichasIniciales?: number
  /** «Pon 1 ficha cada vez que…; con N, ocurre X»: siempre cuenta hacia arriba. */
  contador?: { cuando: Disparo; umbral: number; efectos: Efecto[]; despues: 'descartar' | 'reiniciar' | 'seguir' }
  /** Lo que hace mientras está en juego cada vez que ocurre algo. */
  disparos?: { cuando: Disparo; efectos: Efecto[] }[]
  /** Lo que cambia mientras está en juego. */
  modificadores?: { a: 'dificultad' | 'totalPrueba'; hab?: Habilidad; n: number }[]
  /** Mientras esté en juego, no puedes superar la misión. */
  bloqueaSuperar?: boolean
  /** Lo que pasa además cuando la quitas con una de sus formas de quitarla (no al llegar a su contador). */
  alQuitar?: Efecto[]
  /**
   * Fase 15: no vuelve al mazo de historia al terminar la misión («Mala fama»; las Murallas de Port Royal, que están en
   * juego mientras su misión esté disponible). Se quita con su Acción o cuando su texto lo dice.
   */
  seQueda?: boolean
}

/**
 * «Pon en juego la carta N del mazo de historia (junto a él).» `junto`: a qué Tripulante va junto (se resuelve al leer
 * el encuentro; con una función, según la situación). `fichas`: con cuántas fichas entra (si no, las de sus reglas).
 */
export interface PonePermanente {
  carta: CartaId
  junto?: Selector | ((s: Estado) => Selector)
  fichas?: number
}

/** Lo que el texto de un encuentro cambia en su Prueba («las Mejoras no suman», «las cartas de la mano no suman»…). */
export type CambiosDePrueba = Partial<
  Pick<
    PruebaEnCurso,
    | 'sinMejoras'
    | 'mejorasNoSuman'
    | 'sinCapTripulantes'
    | 'sinCapMejoras'
    | 'sinEventos'
    | 'sinCartas'
    | 'sinCanones'
    | 'invertirDestino'
    | 'destinoAntes'
    | 'dosDestinosSuman'
  >
>

/** Restricciones al comprometer de un encuentro («los Tripulantes heridos no pueden comprometerse»…). */
export interface Restriccion {
  maximo?: number
  /** Devuelve el motivo si este Tripulante no puede comprometerse. */
  veto?: (s: Estado, c: InstId) => string | null
}

/**
 * Reglas de un encuentro. En las cartas con reglas registradas (los Peligros 2.0), sustituyen por completo a lo que
 * se leía de los iconos impresos: lo impreso es solo para leerlo.
 */
export interface ReglasEncuentro {
  efecto?: Efecto[]
  exito?: Efecto[]
  fallo?: Efecto[]
  sinAyuda?: boolean
  abordaje?: boolean
  elige?: OpcionElige[]
  /** Fase 11: el encuentro pone en juego una permanente (antes, «Se queda en juego»). */
  pone?: PonePermanente
  /** Se aplica en cuanto se revela la carta. */
  alRevelarse?: Efecto[]
  restriccion?: Restriccion
  /** Modificadores y demás mientras se resuelve el encuentro (el «Texto» de la carta). */
  capacidades?: CapacidadDeCarta[]
  /** Si se cumple al leerla, la Prueba se supera sin hacerla. */
  superaSi?: Condicion
  /** Si se cumple al leerla, no hay Prueba: se gana el Avance y ya. */
  sinPruebaSi?: Condicion
  /** Lo que cambia en su Prueba. */
  prueba?: CambiosDePrueba
  /** Fase 15, «Descomunal N»: asigna al menos N Tripulantes a esta Prueba; si no puedes, la fallas. */
  descomunal?: number
  /**
   * Fase 15, «Alerta»: este encuentro se resuelve siempre. Ninguna carta puede descartarlo, devolverlo al mazo ni evitar
   * que se resuelva (Sangre fría, Soborno, Velas de tormenta, Íñigo, Cambio de rumbo, Retirada a tiempo, Pedrero de borda).
   */
  alerta?: boolean
}

export interface ReglasDestino {
  /** Después de aplicar el Destino, la carta vuelve encima del mazo de Peligros: será el siguiente encuentro. */
  persigue?: boolean
  /** Modificador según la situación (si no, el impreso). */
  modificador?: (s: Estado, p: PruebaEnCurso) => number | 'fallo'
  /** Al aplicarlo (después del modificador). */
  efectos?: Efecto[]
  siSuperas?: Efecto[]
  siFallas?: Efecto[]
  sinOposicion?: Efecto[]
  /** Lo que cambia en esta Prueba mientras se aplica. */
  prueba?: CambiosDePrueba
  capacidades?: CapacidadDeCarta[]
}

export interface ReglasPeligro {
  /** Por Entorno; «unico» para las cartas de mazo propio. */
  encuentros?: Partial<Record<Entorno | 'unico', ReglasEncuentro>>
  destino?: ReglasDestino
}

export interface DefinicionEncuentro extends DefinicionPrueba, Omit<ReglasEncuentro, 'efecto' | 'exito' | 'fallo'> {
  /** Si superas la Prueba (o el encuentro no tiene Prueba). */
  avance: number
  /** Si no superas la Prueba («Avance 3 / 2»): ver `avanceSinSuperar()`. */
  avanceSinSuperar?: number
  /** Recuadro único de un encuentro sin Prueba. */
  efecto: Efecto[]
}

const REGLAS = new Map<CartaId, ReglasPeligro>()

/** Registra las reglas especiales de una carta de Peligro (las cartas nuevas y las de prueba). */
export function registrarReglasPeligro(id: CartaId, reglas: ReglasPeligro): void {
  REGLAS.set(id, reglas)
}

export function reglasDe(id: CartaId): ReglasPeligro | undefined {
  return REGLAS.get(id)
}

/** ¿Tiene esta carta reglas registradas? (Peligros 2.0: lo impreso no se interpreta) */
export function tieneReglas(id: CartaId): boolean {
  return REGLAS.has(id)
}

/** Reglas del encuentro que se lee de esta carta en la misión en curso. */
export function reglasEncuentro(s: Estado, carta: InstId): ReglasEncuentro | undefined {
  const id = copia(s, carta).id
  const r = REGLAS.get(id)
  if (!r?.encuentros) return undefined
  if (porId(id).tipo === 'mazoPropio') return r.encuentros.unico
  const entorno = entornoActual(s)
  return entorno ? r.encuentros[entorno] : undefined
}

/**
 * Fase 15, «Alerta»: el encuentro de esta carta se resuelve siempre (ninguna carta puede descartarlo, devolverlo al mazo
 * ni evitar que se resuelva).
 */
export function esAlerta(s: Estado, carta: InstId): boolean {
  if (!s.mision || !s.cartas[carta]) return false
  const tipo = porId(copia(s, carta).id).tipo
  if (tipo !== 'peligro' && tipo !== 'mazoPropio') return false
  return reglasEncuentro(s, carta)?.alerta === true
}

/**
 * P98 (Albert), «Alerta»: si ves esta carta al otear, debe quedarse encima del mazo (no se puede poner al fondo). Fuera de
 * una misión (otear en puerto), cuenta si alguno de sus encuentros tiene Alerta.
 */
export function alertaAlOtear(s: Estado, carta: InstId): boolean {
  if (!s.cartas[carta]) return false
  if (s.mision) return esAlerta(s, carta)
  const r = REGLAS.get(copia(s, carta).id)
  return Object.values(r?.encuentros ?? {}).some((x) => x?.alerta === true)
}

/** Todo lo que hace falta para resolver el encuentro de esta carta en la misión en curso. */
export function definicionEncuentro(s: Estado, carta: InstId): DefinicionEncuentro {
  const impreso = encuentroDe(s, carta)
  // «Virar y dar la cara»: la Prueba de NAV de este encuentro es de COM en su lugar (misma dificultad y modificadores).
  const enc = s.mision?.navAcom === carta ? { ...impreso, prueba: impreso.prueba.map((o) => (o.hab === 'NAV' ? { ...o, hab: 'COM' as const } : o)) } : impreso
  const r = reglasEncuentro(s, carta) ?? {}
  const { efecto, exito, fallo, ...resto } = r
  // Con reglas registradas, lo impreso es solo para leerlo.
  if (REGLAS.has(copia(s, carta).id)) {
    return {
      ...resto,
      ...(r.restriccion?.maximo ? { maximo: r.restriccion.maximo } : {}),
      ...(r.descomunal ? { minimo: r.descomunal } : {}),
      nombre: enc.nombre,
      palabrasClave: enc.palabrasClave,
      avance: enc.avance,
      ...(enc.avanceSinSuperar !== undefined ? { avanceSinSuperar: enc.avanceSinSuperar } : {}),
      opciones: enc.prueba,
      efecto: efecto ?? [],
      exito: exito ?? [],
      fallo: fallo ?? [],
    }
  }
  // «Sin ayuda» y «Abordaje» pueden venir impresos como palabras clave del encuentro.
  const sinAyuda = resto.sinAyuda ?? enc.palabrasClave.includes('Sin ayuda')
  const abordaje = resto.abordaje ?? enc.palabrasClave.includes('Abordaje')
  return {
    ...resto,
    ...(sinAyuda ? { sinAyuda } : {}),
    ...(abordaje ? { abordaje } : {}),
    nombre: enc.nombre,
    palabrasClave: enc.palabrasClave,
    avance: enc.avance,
    ...(enc.avanceSinSuperar !== undefined ? { avanceSinSuperar: enc.avanceSinSuperar } : {}),
    opciones: enc.prueba,
    efecto: efecto ?? interpretarEfectos(enc.textoEfecto ?? ''),
    exito: exito ?? interpretarEfectos(enc.textoExito ?? ''),
    fallo: fallo ?? interpretarEfectos(enc.textoFallo ?? ''),
  }
}

const PERMANENTES = new Map<CartaId, ReglasPermanente>()

/** Registra lo que hace una permanente (sin sus capacidades: ver `registrarPermanente` en capacidades/peligros.ts). */
export function registrarReglasPermanente(id: CartaId, reglas: ReglasPermanente): void {
  PERMANENTES.set(id, reglas)
}

export function reglasPermanente(id: CartaId): ReglasPermanente | undefined {
  return PERMANENTES.get(id)
}

/** Las reglas de una permanente en juego (por su copia). */
export function quedaDe(s: Estado, carta: InstId): ReglasPermanente | undefined {
  return PERMANENTES.get(copia(s, carta).id)
}

/** Alguna permanente impide superar la misión mientras esté. */
export function impideSuperar(s: Estado): boolean {
  return s.zonas.permanentes.some((c) => quedaDe(s, c)?.bloqueaSuperar)
}

/** Alguna permanente impide retirarse mientras esté. */
export function impideRetirarse(s: Estado): boolean {
  return s.zonas.permanentes.some((c) => quedaDe(s, c)?.bloqueaRetirada)
}

/**
 * Avance que da un encuentro con Prueba si no la superas (fallas, no comprometes a nadie o el Destino dice «Fallas la
 * Prueba»): el segundo número de «Avance 3 / 2». Por defecto, la mitad del primero, redondeando hacia arriba
 * (1 / 1, 2 / 1, 3 / 2, 4 / 2). `s.variante` cambia la regla solo para simular en el informe de equilibrio.
 */
export function avanceSinSuperar(s: Estado, def: Pick<DefinicionEncuentro, 'avance' | 'avanceSinSuperar'>): number {
  switch (s.variante?.avanceSinSuperar) {
    case 'entero':
      return def.avance
    case 'mitadAbajo':
      return Math.floor(def.avance / 2)
    default:
      return def.avanceSinSuperar ?? Math.ceil(def.avance / 2)
  }
}
