// Tipos de los datos de las cartas (data/cartas.json) y acceso a ellos.
// El motor no depende de React: este módulo es TypeScript puro.

import datosJson from '../../data/cartas.json'
import type { Efecto } from './efectos.ts'

export type Habilidad = 'NAV' | 'COM' | 'EXP'
export type Entorno = 'mar' | 'nat' | 'ciu'
/** Clase de una carta de jugador (en los datos, campo `senda`). Fase 11: todas la llevan, salvo los Tesoros. */
export type Senda = 'Piratería' | 'Neutral'

/** Operación de ayuda heredada del prototipo: ["wound", 1], ["exhaustAll"]… */
export type OperacionPrototipo = [string, ...(string | number)[]]

export interface CapitanDatos {
  id: string
  num: number
  nombre: string
  senda: Senda
  rasgos: string[]
  NAV: number
  COM: number
  EXP: number
  vida: number
  mejoras: number
  mando: number
  texto: string
  ambientacion: string
}

export interface BarcoDatos {
  nombre: string
  senda: Senda
  capacidad: number
  danoMaximo: number
  espacio: number
  texto: string
  ambientacion: string
  num: number
}

export interface TripulanteDatos {
  id: string
  num: number
  nombre: string
  copias: number
  senda: Senda
  rasgos: string[]
  unico: boolean
  coste: number
  NAV: number
  COM: number
  EXP: number
  vida: number
  mejoras: number
  texto: string
  ambientacion: string
}

export interface MejoraBarcoDatos {
  id: string
  num: number
  nombre: string
  copias: number
  senda: Senda
  coste: number
  unico: boolean
  texto: string
  ambientacion: string
  espacio: number
  /** Es un Cañón (Rasgo «Cañón»). */
  canon: boolean
  bonificacion_vida?: number
  bonificacion_capacidad?: number
  /**
   * Fase 15: no es una carta del jugador, sino del mazo de una misión («La culebrina del San José», del mazo del
   * naufragio). Espera en el mazo de historia, no se compra y no va en ningún mazo del jugador.
   */
  mision?: string
}

export interface MejoraTripulanteDatos {
  id: string
  num: number
  nombre: string
  copias: number
  senda: Senda
  coste: number
  unico: boolean
  texto: string
  ambientacion: string
  bonificacion_NAV?: number
  bonificacion_COM?: number
  bonificacion_EXP?: number
  bonificacion_vida?: number
  soloCapitan?: boolean
}

export interface EventoDatos {
  id: string
  num: number
  nombre: string
  copias: number
  senda: Senda
  coste: number
  iconos: Habilidad[]
  texto: string
  ambientacion: string
}

export interface HabilidadCartaDatos {
  id: string
  num: number
  nombre: string
  copias: number
  senda: Senda
  iconos: Habilidad[]
  ambientacion: string
}

export interface TesoroDatos {
  id: string
  num: number
  nombre: string
  tipo: 'Mejora de tripulante' | 'Mejora de barco'
  texto: string
  ambientacion: string
}

export interface OpcionPrueba {
  hab: Habilidad
  dificultad: number
  /** «NAV 4, NAV 2 con un Vigía» (`comprometido`: solo si comprometes a uno: «2 si comprometes a un Marinero»). */
  alternativa?: { rasgo: string; dificultad: number; comprometido?: boolean }
  /** La dificultad es «X» (la calcula la carta; `dificultad` es la mínima). */
  variable?: boolean
}

export interface EncuentroDatos {
  nombre: string
  palabrasClave: string[]
  /** Avance del encuentro; en uno con Prueba, el que ganas si la superas. */
  avance: number
  /** En un encuentro con Prueba, el Avance que ganas si no la superas («Avance 3 / 2»). Por defecto, la mitad hacia arriba. */
  avanceSinSuperar?: number
  prueba: OpcionPrueba[]
  fallo: OperacionPrototipo[]
  exito: OperacionPrototipo[]
  siempre: OperacionPrototipo[]
  nota: string
  /** Recuadro único de un encuentro sin Prueba (iconos separados por « · »). */
  textoEfecto?: string
  /** Recuadro rojo. */
  textoFallo?: string
  /** Recuadro verde. */
  textoExito?: string
  /** Peligros 2.0: aclaración de la dificultad («X = 2 + tus Mejoras de barco…», «+1 por cada…»). */
  notaPrueba?: string
  /** Peligros 2.0: «Elige», «Sin ayuda», «Incautado». */
  etiquetas?: string[]
  /** Fase 11: número de la permanente que pone en juego (desde el mazo de historia). */
  pone?: number
}

export interface DestinoDatos {
  nombre: string
  /** null = «Fallas la Prueba» (✕). */
  modificador: number | null
  textoPrototipo: string
  sinOposicion?: { texto: string; ops: OperacionPrototipo[]; ignoraFallo?: boolean }
  /** Texto 1.0 del efecto añadido (puede estar vacío). */
  texto: string
  /** Modificador tal y como se imprime: «+1», «−1», «✕»… */
  mod: string
  ambientacion: string
  /** Línea Sin oposición tal y como se imprime (iconos separados por « · »). */
  textoSinOposicion: string
  // Ayudas del prototipo
  modKw?: { kw: string[]; n: number }
  modHab?: { hab: Habilidad; n: number }
  noGuns?: number
  noCards?: number
  fail?: number
  sentWound?: number
  strongWound?: number
  failWound?: number
  winAv?: number
  spare?: number
}

export interface PeligroDatos {
  id: string
  num: number
  nombre: string
  copias: number
  entraDuranteLaPartida: boolean
  /** 2: Peligros 2.0 (textos completos; lo que hacen está en sus reglas, no en los iconos). */
  version?: 2
  /** Peligro antiguo, fuera del mazo desde la fase 6: solo se conserva para las pruebas (no sale en la galería). */
  retirada?: boolean
  encuentros: Record<Entorno, EncuentroDatos>
  destino: DestinoDatos
}

export interface CartaMazoPropioDatos {
  id: string
  num: number
  nombre: string
  /** 2: formato de los Peligros 2.0 (textos completos; lo que hacen está en sus reglas). */
  version?: 2
  /**
   * Fase 15: carta de Peligro de un solo encuentro que no es de ningún mazo propio (el barco de van Hoorn, el del
   * fugitivo): la travesía que la pone encima del mazo de Peligros. Las de un mazo propio no lo llevan.
   */
  mision?: string
  encuentro: EncuentroDatos
  destino: DestinoDatos
}

/**
 * Pasajero: viaja contigo, pero no es un Tripulante. Fase 15: ya no es una regla general y no ocupa Capacidad; su carta
 * dice todo lo necesario (que no puede ser asignado ni recibir heridas, Estados ni Ventajas, y cuándo se va).
 */
export interface PasajeroDatos {
  id: string
  num: number
  nombre: string
  /** Travesía a la que pertenece. */
  mision: string
  texto: string
  ambientacion: string
}

/**
 * Permanente (fase 11): carta del mazo de historia que un encuentro (o una misión: «¡La guardia!») pone en juego en la
 * zona de permanentes, junto a la misión (o junto a un Tripulante). Su texto es para leerlo: lo que hace está escrito a mano en las reglas de su Peligro.
 */
export interface PermanenteDatos {
  id: string
  num: number
  nombre: string
  /**
   * Su tipo, como el de un encuentro (Terreno, Guardia…): casi siempre, el del encuentro que la pone en juego; «¡La
   * guardia!», que la pone una misión, es de tipo Guardia (fase 14, Albert). No son Rasgos: la Prueba de su Acción es de
   * ese tipo.
   */
  palabrasClave: string[]
  texto: string
  ambientacion: string
  /** La carta de Peligro (o de mazo propio) que la pone en juego (si la pone un encuentro). */
  origen?: string
  /** El Entorno de ese encuentro («unico» si es de un mazo propio). */
  entorno?: Entorno | 'unico'
  /** Las misiones que la ponen en juego («¡La guardia!»). */
  misiones?: string[]
  /** Va junto a un Tripulante («Pon en juego la carta N … junto a él»). */
  junto: boolean
  /** Fase 15: una permanente que se puede dañar (Galeón San Telmo, Murallas de Port Royal, El prisionero): su Vida. */
  vida?: number
}

/**
 * Fase 15: una carta del mazo del naufragio («El naufragio del San José»). Al bucear se roba una y se aplica; lo que pasa
 * después lo dice su texto («Quédate esta carta», «Pon esta carta en juego», «Vuelve a barajar esta carta…») y, si no dice
 * nada, se aparta. La culebrina (una Mejora de barco) y la campana y el doblón (Tesoros) también son del mazo del
 * naufragio, pero conservan su tipo.
 */
export interface NaufragioDatos {
  id: string
  num: number
  nombre: string
  /** La misión de su mazo. */
  mision: string
  texto: string
  ambientacion: string
}


/** Una de las opciones de un final con elección. */
export interface OpcionFinal {
  clave: string
  texto: string
  rep?: number
  tesoro?: string
  /** Lo que pasa además, en palabras («tu Capitán queda Maldito»). */
  efecto?: string
}

export interface RecompensaDatos {
  rep?: number
  /** Buscar en el mazo de muelle: Tripulante, Mejora de barco o Mejora. */
  search?: 'crew' | 'ship' | 'up'
  draw?: number
  /** Fase 10b: recluta sin coste un Tripulante del muelle de este coste o menos (si cabe). */
  reclutaGratis?: number
  /** Fase 10b: adquiere sin coste una Mejora del muelle de este coste o menos. */
  adquiereGratis?: number
  /** Fase 10b: otea N del mazo de Misiones (antes de reponer las misiones disponibles). */
  oteaMisiones?: number
  /** Fase 11: lo que cuesta la recompensa («El Barco sufre 1 daño»). Se paga después de cobrarla. */
  precio?: Efecto[]
  /** id del Tesoro que se gana. */
  tesoro?: string
  victoria?: boolean
  /** Pasajero que se pone en juego. */
  pasajero?: string
  /** Final con elección: eliges una de estas recompensas. */
  elige?: OpcionFinal[]
  /** La recompensa tal y como se imprime, cuando no basta con las fichas («Elige: …»). */
  texto?: string
}

export interface CapituloDatos {
  /** Fase 12: las travesías tienen de 2 a 4 capítulos. */
  capitulo: 'I' | 'II' | 'III' | 'IV'
  /** Capítulo con salida doble: «a» o «b» (II-a, II-b). */
  rama?: 'a' | 'b'
  /**
   * Fase 15: varios capítulos del mismo número que no son una salida doble (los tres capítulos II de «La Isla del
   * Tesoro», uno al azar). Solo distingue su identificador («isla-II-ingleses»): en la carta se ve «II», sin letra.
   */
  clave?: string
  num: number
  nombre: string
  entorno: Entorno
  avanceNecesario: number
  distancia: number
  /** Reglas impresas (para leerlas: lo que hacen está escrito a mano en src/engine/misiones2/). */
  reglas: string[]
  ambientacion: string
  recompensa: RecompensaDatos
  /** Números de colección de la carta que añade al superarla (dos si tiene salida doble: primero la II-a). */
  siguiente: number[]
  textoSiguiente: string
  /** Mazo propio que baraja al zarpar. */
  mazoPropio?: { nombre: string; cartas: string[] }
  /**
   * Fase 15: el mazo del naufragio («El naufragio del San José»), por número de colección: sus cartas, la culebrina (Mejora
   * de barco) y los Tesoros 270 y 271.
   */
  mazoNaufragio?: number[]
}

export interface MisionDatos {
  id: string
  nombre: string
  reto: string
  intro: string
  inicial: boolean
  aventura: boolean
  capitulos: CapituloDatos[]
}

export interface EscenarioDatos {
  id: string
  num: number
  nombre: string
  texto: string
  ambientacion: string
}

export interface PuertoDatos {
  id: string
  num: number
  nombre: string
  muelle: number
  /** Cuántas misiones disponibles hay (fase 10: lo dice la carta de puerto, junto al muelle). */
  misiones: number
  habilidadPropia: { nombre: string; texto: string }
  opcionesComunes: string[]
  ambientacion: string
}

export interface MazosPredefinidos {
  mazoDelCapitan: string[]
  mazoDeMuelle: string[]
  mazoDePeligros: string[]
  apartadosDePeligros: string[]
  capitanInicial: string
  puertoInicial: string
  modo: 'corta' | 'normal' | 'larga'
}

export interface DatosCartas {
  capitanes: CapitanDatos[]
  barco: BarcoDatos
  tripulantes: TripulanteDatos[]
  mejorasBarco: MejoraBarcoDatos[]
  mejorasTripulante: MejoraTripulanteDatos[]
  eventos: EventoDatos[]
  habilidades: HabilidadCartaDatos[]
  tesoros: TesoroDatos[]
  peligros: PeligroDatos[]
  cartasDeMazoPropio: CartaMazoPropioDatos[]
  pasajeros: PasajeroDatos[]
  permanentes: PermanenteDatos[]
  /** Fase 15: las cartas del mazo del naufragio que no son Tesoros ni Mejoras. */
  naufragio: NaufragioDatos[]
  misiones: MisionDatos[]
  ordenMisiones: { iniciales: string[]; aventuras: string[]; travesias: string[] }
  escenario: EscenarioDatos[]
  puertos: PuertoDatos[]
  mazosPredefinidos: MazosPredefinidos
}

/** Todas las cartas de la Caja básica, tal y como vienen de data/cartas.json. */
export const DATOS: DatosCartas = datosJson as unknown as DatosCartas
