// Catálogo de la Caja básica: una entrada por número de colección (001–153).

import {
  DATOS,
  type BarcoDatos,
  type CapitanDatos,
  type CapituloDatos,
  type CartaMazoPropioDatos,
  type CartaRecompensaDatos,
  type DatosCartas,
  type EscenarioDatos,
  type EventoDatos,
  type HabilidadCartaDatos,
  type MejoraBarcoDatos,
  type MejoraTripulanteDatos,
  type MisionDatos,
  type NaufragioDatos,
  type PasajeroDatos,
  type PeligroDatos,
  type PermanenteDatos,
  type PuertoDatos,
  type TesoroDatos,
  type TripulanteDatos,
} from './datos.ts'
import { INFO_ESTADO, type EstadoBarco, type FichaTripulante } from './infoEstados.ts'

export type EntradaCatalogo =
  | { tipo: 'capitan'; num: number; id: string; copias: number; carta: CapitanDatos }
  | { tipo: 'barco'; num: number; id: string; copias: number; carta: BarcoDatos }
  | { tipo: 'tripulante'; num: number; id: string; copias: number; carta: TripulanteDatos }
  | { tipo: 'mejoraBarco'; num: number; id: string; copias: number; carta: MejoraBarcoDatos }
  | { tipo: 'mejoraTripulante'; num: number; id: string; copias: number; carta: MejoraTripulanteDatos }
  | { tipo: 'evento'; num: number; id: string; copias: number; carta: EventoDatos }
  | { tipo: 'habilidad'; num: number; id: string; copias: number; carta: HabilidadCartaDatos }
  | { tipo: 'tesoro'; num: number; id: string; copias: number; carta: TesoroDatos }
  | { tipo: 'peligro'; num: number; id: string; copias: number; carta: PeligroDatos }
  | {
      tipo: 'mazoPropio'
      num: number
      id: string
      copias: number
      carta: CartaMazoPropioDatos
      /** Nombre del mazo propio, p. ej. «mazo del Templo». */
      mazo: string
      mision: MisionDatos
    }
  | { tipo: 'pasajero'; num: number; id: string; copias: number; carta: PasajeroDatos; mision: MisionDatos }
  /** Fase 11: carta del mazo de historia que un encuentro pone en la zona de permanentes. */
  | { tipo: 'permanente'; num: number; id: string; copias: number; carta: PermanenteDatos }
  /** Fase 15: carta del mazo del naufragio (salvo la culebrina y los Tesoros, que conservan su tipo), del mazo de historia. */
  | { tipo: 'naufragio'; num: number; id: string; copias: number; carta: NaufragioDatos; mision: MisionDatos }
  /** Fase 15: carta de recompensa del mazo de historia («Coge la carta 286 del mazo de historia»). */
  | { tipo: 'recompensa'; num: number; id: string; copias: number; carta: CartaRecompensaDatos; mision: MisionDatos }
  | { tipo: 'escenario'; num: number; id: string; copias: number; carta: EscenarioDatos }
  | { tipo: 'puerto'; num: number; id: string; copias: number; carta: PuertoDatos }
  | {
      tipo: 'capitulo'
      num: number
      /** `${mision.id}-${capitulo}`, p. ej. «templo-I» (con su rama si tiene salida doble: «maracaibo-II-a»). */
      id: string
      copias: number
      carta: CapituloDatos
      mision: MisionDatos
    }

export type TipoCarta = EntradaCatalogo['tipo']

export const NOMBRE_TIPO: Record<TipoCarta, string> = {
  capitan: 'Capitán',
  barco: 'Barco',
  tripulante: 'Tripulante',
  mejoraBarco: 'Mejora de barco',
  mejoraTripulante: 'Mejora de tripulante',
  evento: 'Evento',
  habilidad: 'Habilidad',
  tesoro: 'Tesoro',
  peligro: 'Peligro',
  mazoPropio: 'Mazo propio',
  pasajero: 'Pasajero',
  permanente: 'Permanente',
  naufragio: 'Carta del naufragio',
  recompensa: 'Carta de recompensa',
  escenario: 'Escenario',
  puerto: 'Puerto',
  capitulo: 'Misión',
}

/** Construye el catálogo completo, ordenado por número de colección. */
export function construirCatalogo(datos: DatosCartas = DATOS): EntradaCatalogo[] {
  const lista: EntradaCatalogo[] = []

  for (const carta of datos.capitanes) lista.push({ tipo: 'capitan', num: carta.num, id: carta.id, copias: 1, carta })
  lista.push({ tipo: 'barco', num: datos.barco.num, id: 'barco', copias: 1, carta: datos.barco })
  for (const carta of datos.tripulantes)
    lista.push({ tipo: 'tripulante', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.mejorasBarco)
    lista.push({ tipo: 'mejoraBarco', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.mejorasTripulante)
    lista.push({ tipo: 'mejoraTripulante', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.eventos) lista.push({ tipo: 'evento', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.habilidades)
    lista.push({ tipo: 'habilidad', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.tesoros) lista.push({ tipo: 'tesoro', num: carta.num, id: carta.id, copias: 1, carta })
  for (const carta of datos.peligros) lista.push({ tipo: 'peligro', num: carta.num, id: carta.id, copias: carta.copias, carta })
  for (const carta of datos.escenario) lista.push({ tipo: 'escenario', num: carta.num, id: carta.id, copias: 1, carta })
  for (const carta of datos.puertos) lista.push({ tipo: 'puerto', num: carta.num, id: carta.id, copias: 1, carta })

  for (const mision of datos.misiones) {
    for (const capitulo of mision.capitulos) {
      lista.push({
        tipo: 'capitulo',
        num: capitulo.num,
        id: idCapitulo(mision.id, capitulo),
        copias: 1,
        carta: capitulo,
        mision,
      })
    }
  }

  // Cada carta de mazo propio pertenece al capítulo que la baraja al zarpar. Fase 15: las de un solo encuentro que no son
  // de ningún mazo propio (los barcos rivales) dicen de qué travesía son; su «mazo» es el nombre de la travesía.
  for (const carta of datos.cartasDeMazoPropio) {
    if (carta.mision) {
      const mision = datos.misiones.find((m) => m.id === carta.mision)
      if (!mision) throw new Error(`La carta «${carta.id}» no pertenece a ninguna travesía`)
      lista.push({ tipo: 'mazoPropio', num: carta.num, id: carta.id, copias: 1, carta, mazo: mision.nombre, mision })
      continue
    }
    let encontrada = false
    for (const mision of datos.misiones) {
      for (const capitulo of mision.capitulos) {
        const mazo = capitulo.mazoPropio
        if (!mazo) continue
        const copias = mazo.cartas.filter((id) => id === carta.id).length
        if (copias === 0) continue
        lista.push({ tipo: 'mazoPropio', num: carta.num, id: carta.id, copias, carta, mazo: mazo.nombre, mision })
        encontrada = true
      }
    }
    if (!encontrada) throw new Error(`La carta de mazo propio «${carta.id}» no pertenece a ningún mazo propio`)
  }

  for (const carta of datos.pasajeros ?? []) {
    const mision = datos.misiones.find((m) => m.id === carta.mision)
    if (!mision) throw new Error(`El Pasajero «${carta.id}» no pertenece a ninguna travesía`)
    lista.push({ tipo: 'pasajero', num: carta.num, id: carta.id, copias: 1, carta, mision })
  }
  for (const carta of datos.permanentes ?? []) lista.push({ tipo: 'permanente', num: carta.num, id: carta.id, copias: 1, carta })
  for (const carta of datos.naufragio ?? []) {
    const mision = datos.misiones.find((m) => m.id === carta.mision)
    if (!mision) throw new Error(`La carta del naufragio «${carta.id}» no pertenece a ninguna misión`)
    lista.push({ tipo: 'naufragio', num: carta.num, id: carta.id, copias: 1, carta, mision })
  }
  for (const carta of datos.cartasDeRecompensa ?? []) {
    const mision = datos.misiones.find((m) => m.id === carta.mision)
    if (!mision) throw new Error(`La carta de recompensa «${carta.id}» no pertenece a ninguna misión`)
    lista.push({ tipo: 'recompensa', num: carta.num, id: carta.id, copias: 1, carta, mision })
  }

  return lista.sort((a, b) => a.num - b.num)
}

/**
 * Identificador de un capítulo: «templo-I», o «maracaibo-II-a» si tiene salida doble. Fase 15: con varios capítulos del
 * mismo número sin salida doble, su clave («isla-II-ingleses»).
 */
export function idCapitulo(mision: string, capitulo: Pick<CapituloDatos, 'capitulo' | 'rama' | 'clave'>): string {
  const sufijo = capitulo.rama ?? capitulo.clave
  return `${mision}-${capitulo.capitulo}${sufijo ? `-${sufijo}` : ''}`
}

export const CATALOGO: EntradaCatalogo[] = construirCatalogo()

/** «Caja básica · 007» */
export function codigoColeccion(num: number): string {
  return `Caja básica · ${String(num).padStart(3, '0')}`
}

// ---------------------------------------------------------------------------
// Consultas por identificador de carta («bucanero», «templo-I»…)

const POR_ID = new Map<string, EntradaCatalogo>(CATALOGO.map((e) => [e.id, e]))

/**
 * Cartas que no son de la Caja básica (las de Peligro de prueba, y más adelante las rediseñadas mientras no
 * estén en cartas.json). Se pueden consultar por identificador, pero no aparecen en el catálogo ni en la galería.
 */
export function registrarCartasExtra(...entradas: EntradaCatalogo[]): void {
  for (const e of entradas) {
    const ya = POR_ID.get(e.id)
    if (ya && ya !== e && CATALOGO.includes(ya)) throw new Error(`La carta «${e.id}» ya está en la Caja básica`)
    POR_ID.set(e.id, e)
  }
}

/** Fuentes de capacidades que no son cartas: las fichas de Estado y la carta de Peligro que ocupa el muelle. */
function nombreDeFuente(id: string): string | null {
  if (id.startsWith('estado:')) {
    const info = INFO_ESTADO[id.slice('estado:'.length) as FichaTripulante | EstadoBarco]
    return info ? info.nombre : null
  }
  if (id === 'peligroEnMuelle') return 'Peligro en el muelle'
  return null
}

/** Entrada del catálogo de una carta por su identificador. */
export function porId(id: string): EntradaCatalogo {
  const entrada = POR_ID.get(id)
  if (!entrada) throw new Error(`No existe ninguna carta con identificador «${id}»`)
  return entrada
}

/** ¿Es una carta (de la caja o registrada aparte)? Las fichas de Estado, por ejemplo, no lo son. */
export function esCarta(id: string): boolean {
  return POR_ID.has(id)
}

/** ¿Es una carta del jugador (no de Peligro, misión, Escenario ni puerto)? */
export function esCartaDelJugador(id: string): boolean {
  const e = POR_ID.get(id)
  return e !== undefined && ['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad', 'tesoro'].includes(e.tipo)
}

/** Nombre impreso de la carta. */
export function nombreDe(id: string): string {
  const fuente = nombreDeFuente(id)
  if (fuente) return fuente
  const e = porId(id)
  return e.tipo === 'peligro' || e.tipo === 'mazoPropio' || 'nombre' in e.carta ? e.carta.nombre : id
}

export function tipoDe(id: string): TipoCarta {
  return porId(id).tipo
}

/** Coste impreso (el número del timón). 0 si la carta no tiene coste. */
export function costeImpreso(id: string): number {
  const c = porId(id).carta
  return 'coste' in c && typeof c.coste === 'number' ? c.coste : 0
}

/** Cañones: las Mejoras de barco con el Rasgo Cañón (N18; fase 13: el Entorno lo dice su carta, «[mar], [agotar]»). */
export function esCanon(id: string): boolean {
  const e = porId(id)
  return e.tipo === 'mejoraBarco' && e.carta.canon
}

/** Una carta indestructible no se puede perder ni agotar. Los Tesoros tampoco. */
export function esIndestructible(id: string): boolean {
  const e = porId(id)
  if (e.tipo === 'tesoro') return true
  return 'texto' in e.carta && typeof e.carta.texto === 'string' && e.carta.texto.startsWith('Indestructible')
}

/** Las palabras clave de la primera línea del texto de una carta del jugador («Enrolado 2.»). */
function palabrasClaveDe(id: string): string[] {
  const e = porId(id)
  const texto = 'texto' in e.carta && typeof e.carta.texto === 'string' ? e.carta.texto : ''
  const primera = texto.split('\n')[0] ?? ''
  return primera
    .split('.')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** Fase 14, «Enrolado N»: cuántas fichas de Enrolado recibe al reclutarlo (null si no es Enrolado). */
export function enroladoDe(id: string): number | null {
  for (const p of palabrasClaveDe(id)) {
    const m = /^Enrolado (\d+)$/.exec(p)
    if (m) return Number(m[1])
  }
  return null
}

export function esUnica(id: string): boolean {
  const e = porId(id)
  if (e.tipo === 'capitan' || e.tipo === 'tesoro') return true
  return 'unico' in e.carta && e.carta.unico === true
}

/** Iconos de una habilidad en una carta de la mano (Eventos y Habilidades). */
export function iconosDe(id: string, hab: 'NAV' | 'COM' | 'EXP'): number {
  const c = porId(id).carta
  return 'iconos' in c && Array.isArray(c.iconos) ? c.iconos.filter((i) => i === hab).length : 0
}

/** Rasgos de un Tripulante o Capitán. */
export function rasgosDe(id: string): string[] {
  const e = porId(id)
  return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta.rasgos : []
}

// ---------------------------------------------------------------------------
// Fase 15: el mazo del naufragio («El naufragio del San José»)

/**
 * Las cartas del mazo del naufragio, por identificador, en el orden de la carta que lo baraja («Fondeáis sobre el San
 * José», 286), con la culebrina y los Tesoros 270 y 271.
 */
export function cartasDelNaufragio(): string[] {
  const nums = DATOS.cartasDeRecompensa.flatMap((c) => c.mazoNaufragio ?? [])
  return nums.map((n) => {
    const e = CATALOGO.find((x) => x.num === n)
    if (!e) throw new Error(`El mazo del naufragio cita la carta ${n}, que no existe`)
    return e.id
  })
}

/** ¿Es del mazo del naufragio? */
export function esDelNaufragio(id: string): boolean {
  return cartasDelNaufragio().includes(id)
}

/** Lo que se hace con una carta del mazo del naufragio después de aplicarla. */
export type DestinoNaufragio = 'quedar' | 'enJuego' | 'barajar' | 'apartar'

/**
 * Regla del motor (Albert, fase 15): lo dice el texto de la carta. «Quédate esta carta»: a un lado, hasta que termine la
 * misión; «Pon esta carta en juego»: en juego; «Vuelve a barajar esta carta…»: otra vez al mazo del naufragio. Una carta que
 * no dice nada de esto se aparta después de aplicarla.
 */
export function destinoNaufragio(id: string): DestinoNaufragio {
  const c = porId(id).carta
  const texto = 'texto' in c && typeof c.texto === 'string' ? c.texto : ''
  if (texto.includes('Quédate esta carta')) return 'quedar'
  if (texto.includes('Pon esta carta en juego')) return 'enJuego'
  if (texto.includes('Vuelve a barajar esta carta')) return 'barajar'
  return 'apartar'
}

/**
 * ¿Es una carta del mazo de historia? Las que no empiezan la partida en ningún mazo: los capítulos II, III y IV, los
 * Tesoros, los mazos propios y los barcos rivales, los Pasajeros, las permanentes, el mazo del naufragio (con su
 * culebrina), las cartas de recompensa y «La Armada te persigue». Fase 15 (Albert, tercera ronda): cuando una de ellas sale
 * del juego (se descarta, se pierde o termina su misión), vuelve al mazo de historia (ver `mover` en zonas.ts).
 */
export function esDeHistoria(id: string): boolean {
  const e = porId(id)
  switch (e.tipo) {
    case 'capitulo':
      return e.carta.capitulo !== 'I'
    case 'tesoro':
    case 'mazoPropio':
    case 'pasajero':
    case 'permanente':
    case 'naufragio':
    case 'recompensa':
      return true
    case 'mejoraBarco':
      return e.carta.mision !== undefined
    case 'peligro':
      return DATOS.mazosPredefinidos.apartadosDePeligros.includes(e.id)
    default:
      return false
  }
}
