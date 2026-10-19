// Tipos de los datos de las cartas (data/cartas.json) y acceso a ellos.
// El motor no depende de React: este módulo es TypeScript puro.

import datosJson from '../../data/cartas.json'

export type Habilidad = 'NAV' | 'COM' | 'EXP'
export type Entorno = 'mar' | 'nat' | 'ciu'
export type Senda = 'Piratería' | 'Neutral'
export type NivelPeligro = 'Favorable' | 'Leve' | 'Duro' | 'Terrible'

/** Operación de ayuda heredada del prototipo: ["wound", 1], ["exhaustAll"]… */
export type OperacionPrototipo = [string, ...(string | number)[]]

export interface CapitanDatos {
  id: string
  num: number
  nombre: string
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
  coste: number
  unico: boolean
  texto: string
  ambientacion: string
  espacio: number
  /** Es un Cañón (Rasgo «Cañón»). */
  canon: boolean
  /** Munición máxima (0 si no tiene). */
  municion: number
  bonificacion_vida?: number
  bonificacion_capacidad?: number
}

export interface MejoraTripulanteDatos {
  id: string
  num: number
  nombre: string
  copias: number
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
  /** Peligros 2.0: «Elige», «Sin ayuda», «Se queda en juego», «Incautado». */
  etiquetas?: string[]
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
  nivel: NivelPeligro
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
  nivel: NivelPeligro
  /** 2: formato de los Peligros 2.0 (textos completos; lo que hacen está en sus reglas). */
  version?: 2
  encuentro: EncuentroDatos
  destino: DestinoDatos
}

/** Pasajero: viaja contigo y ocupa Capacidad, pero no es Tripulante. */
export interface PasajeroDatos {
  id: string
  num: number
  nombre: string
  /** Travesía a la que pertenece. */
  mision: string
  texto: string
  ambientacion: string
}

/** Carta de misión apartada que una misión pone en juego («¡La guardia!»). */
export interface CartaMisionDatos {
  id: string
  num: number
  nombre: string
  entorno: Entorno
  texto: string
  ambientacion: string
  /** Capítulos que la usan. */
  misiones: string[]
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
  capitulo: 'I' | 'II' | 'III'
  /** Capítulo con salida doble: «a» o «b» (II-a, II-b). */
  rama?: 'a' | 'b'
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
  cartasDeMision: CartaMisionDatos[]
  misiones: MisionDatos[]
  ordenMisiones: { iniciales: string[]; aventuras: string[]; travesias: string[] }
  escenario: EscenarioDatos[]
  puertos: PuertoDatos[]
  mazosPredefinidos: MazosPredefinidos
}

/** Todas las cartas de la Caja básica, tal y como vienen de data/cartas.json. */
export const DATOS: DatosCartas = datosJson as unknown as DatosCartas
