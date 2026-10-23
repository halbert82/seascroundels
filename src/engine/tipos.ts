// Tipos del motor de reglas. Todo el estado de la partida es JSON simple: se guarda y se recupera tal cual.

import type { Habilidad } from './datos.ts'
import type { AccionSobre, Efecto, Incautar, ModSiguiente, OpcionEfectos, Selector } from './efectos.ts'
import type { DefinicionPrueba } from './definiciones.ts'
import type { EstadoBarco, FichaTripulante } from './estados.ts'

/** Identificador de carta del catálogo («bucanero», «templo-I»…). */
export type CartaId = string
/** Identificador de una copia física concreta («i17»). Nunca un número a secas. */
export type InstId = `i${number}`

export const ZONAS = [
  'mazoCapitan',
  'mano',
  'descartesCapitan',
  /** Evento que se está jugando. */
  'resolviendo',
  'mazoMuelle',
  'muelle',
  'descartesMuelle',
  /** Tripulantes en juego, Capitán incluido. */
  'tripulacion',
  /** Pasajeros: viajan contigo y ocupan Capacidad, pero no son Tripulantes. */
  'pasajeros',
  /** Mejoras y Tesoros vinculados al Barco o a un Tripulante. */
  'mejoras',
  'mazoEscenario',
  /** La carta de Escenario revelada este turno. */
  'escenarioEnCurso',
  'descartesEscenario',
  'mazoPeligros',
  'descartesPeligros',
  /** Mazo mezclado de una misión con mazo propio (mazo propio + cartas del mazo de Peligros). */
  'mazoMision',
  'descartesMision',
  /** Carta de Peligro cuyo encuentro se está resolviendo. */
  'encuentro',
  /** Cartas cuyo Destino se ha revelado en la Prueba en curso. */
  'destino',
  /** «La Armada te persigue» y «Amigos en la costa», fuera del mazo hasta que una carta las meta. */
  'apartados',
  /**
   * Zona de permanentes (fase 11): cartas del mazo de historia que un encuentro pone en juego junto a la misión (o junto
   * a un Tripulante), con su texto activo, hasta que se descartan (vuelven al mazo de historia) o termina la misión.
   */
  'permanentes',
  /** Cartas y Mejoras incautadas: debajo de la misión hasta superarla (se recuperan) o no (se pierden). */
  'incautadas',
  'misionesDisponibles',
  'mazoMisiones',
  'mazoHistoria',
  'misionesSuperadas',
  'fueraDeJuego',
] as const

export type Zona = (typeof ZONAS)[number]

/** Situación de una copia física de carta. Sus números impresos se leen del catálogo. */
export interface Copia {
  id: CartaId
  agotada: boolean
  heridas: number
  /** Fichas de Avance (en las misiones). */
  avance: number
  /** Para Mejoras y Tesoros: a qué van vinculados. */
  vinculadaA: InstId | 'barco' | null
  /** Fichas de Entrenamiento (+1 a una habilidad; ocupan hueco de Mejora). */
  entrenamiento: Habilidad[]
  /** Fichas de Estado de un Tripulante (Envenenado, Borracho…). Nunca dos iguales. */
  estados?: FichaTripulante[]
  /** Fichas sobre la carta: el contador de una permanente (siempre sube) o las de la Pólvora del Rey. */
  fichas?: number
  /** Permanente puesta junto a un Tripulante («Pon en juego la carta N … junto a él»): ese Tripulante. */
  junto?: InstId
  /** Permanente: la carta del encuentro que la puso en juego (su «Al revelarse» señala a quién afecta). */
  origen?: InstId
  /** Fase 14: fichas de Enrolado que le quedan a un Tripulante «Enrolado N» (se quita 1 al final de cada turno). */
  enrolado?: number
}

export type Paso = 'preparacion' | 'inicio' | 'jugarCartas' | 'quedarseOZarpar' | 'mision' | 'final' | 'terminada'
export type Modo = 'corta' | 'normal' | 'larga'

/** Efecto que dura un tiempo («Este turno, …»). Su regla está en el registro de capacidades con la misma clave. */
export interface Temporal {
  clave: string
  fuente: CartaId
  /**
   * `inicio`: hasta después de preparar en tu próximo Inicio. `carta`: mientras la carta `carta` siga en juego.
   * (Fase 13: fuera `superarPrueba`, que solo usaba «Bruma en la selva»; guardado.ts quita los de partidas viejas.)
   */
  hasta: 'finTurno' | 'finMision' | 'finPrueba' | 'inicio' | 'carta'
  /** La copia concreta a la que afecta (el Filibustero que se ha herido, el Tripulante del Náufrago…). */
  inst?: InstId
  /** Para `hasta: 'carta'`: la permanente (o la carta del encuentro en curso) de la que depende. */
  carta?: InstId
  /** Solo cuenta a partir de ese turno («−1 Mando en tu próximo turno»). */
  desdeTurno?: number
}

export type TipoRegistro = 'turno' | 'revelar' | 'robar' | 'pagar' | 'jugada' | 'efecto' | 'aviso' | 'fin'

export interface EntradaRegistro {
  turno: number
  paso: Paso
  tipo: TipoRegistro
  texto: string
  /** Lo mismo en datos, para estadísticas y animaciones. */
  dato?: Suceso
}

/** Sucesos destacados de la partida, en datos. */
export type Suceso =
  | { tipo: 'zarpar'; mision: CartaId }
  | { tipo: 'prueba'; peligro: CartaId; encuentro: string; superada: boolean }
  | { tipo: 'finMision'; mision: CartaId; resultado: FinMision; resueltas?: number; avance?: number; necesario?: number; motivo?: string }
  /** Cambian las fichas sobre la misión (Ladrón, Alarma…): cuántas hay ahora. */
  | { tipo: 'fichasMision'; ficha: FichaMision; n: number }
  /** Se cumple la Gesta de la misión. */
  | { tipo: 'gesta'; mision: CartaId }
  | { tipo: 'hundimiento' }
  | { tipo: 'derrota'; carta: CartaId }
  | { tipo: 'seRetira'; carta: CartaId }
  | { tipo: 'entraEnMazo'; carta: CartaId }
  | { tipo: 'mazoMisionBarajado' }
  | { tipo: 'superadaAMitad' }
  // Para el informe por carta.
  | { tipo: 'reclutar'; carta: CartaId }
  /** Un Tripulante sale de la tripulación, con el motivo de la tarea que lo saca (para medir la rotación). */
  | { tipo: 'sale'; inst: InstId; motivo: string }
  | { tipo: 'adquirir'; carta: CartaId }
  /** Capacidad usada o Evento jugado por su efecto. */
  | { tipo: 'usar'; carta: CartaId; clave: string }
  /** Cartas descartadas por sus iconos (al comprometer o al cubrir la Distancia). */
  | { tipo: 'iconos'; cartas: CartaId[] }
  // Para animar la mesa: qué copia concreta cambia.
  | { tipo: 'revelado'; inst: InstId; como: 'encuentro' | 'destino' | 'escenario' }
  | { tipo: 'avance'; n: number; total: number }
  | { tipo: 'heridas'; inst: InstId; n: number }
  | { tipo: 'dano'; n: number }
  | { tipo: 'reputacion'; n: number }
  /** Se pierde Avance de la misión. */
  | { tipo: 'avancePerdido'; n: number }
  /** Cartas de la mano descartadas para pagar un coste. */
  | { tipo: 'pago'; n: number }

export type FinMision = 'superada' | 'retirada' | 'hundida'

/** Fichas que se ponen sobre la carta de misión. Se descartan al terminarla. */
export type FichaMision = 'ladron' | 'alarma' | 'sospecha' | 'persecucion' | 'mecha' | 'defensa' | 'derrumbe' | 'rival' | 'profundidad'

/** Una Prueba ya resuelta en la misión en curso. */
export interface PruebaHecha {
  hab: Habilidad
  superada: boolean
  /** Puntos por los que se superó (o, en negativo, los que faltaron: al menos 1). */
  margen: number
  /** Palabras clave de lo que se probaba. */
  claves: string[]
  /** Salía de un encuentro (no de la Acción de una carta). */
  encuentro: boolean
  /** No se comprometió a nadie (Sin oposición). */
  nadie: boolean
}

export interface MisionEnCurso {
  carta: InstId
  /** Cartas de Peligro ya resueltas (D5a: hasta resolver la primera no se puede superar). */
  cartasResueltas: number
  /** Revela del mazo mezclado de la misión. */
  mazoMezclado: boolean
  /** Fin decidido; la misión se cierra en el siguiente punto seguro. */
  fin: FinMision | null
  /** Cartas que «se retiran» del juego al descartarse. */
  retirar: InstId[]
  /** «No puedes retirarte de esta misión». */
  sinRetirada?: boolean
  /** Carta de Peligro cuya Prueba se superará automáticamente al leerla («Soborno»). */
  automatica: InstId | null
  /** La carta del encuentro irá al muelle en vez de a los descartes al terminar de resolverse («ocupa el muelle»). */
  alMuelle?: { carta: InstId; coste: number }
  /** La carta del encuentro irá al fondo del mazo de Peligros al terminar de resolverse. */
  alFondo?: InstId
  /** «La siguiente Prueba / el siguiente encuentro de esta misión…», pendientes de aplicar. */
  modsSiguientes?: ModSiguiente[]
  /** Datos de una carta concreta durante la misión («Tripulantes agotados al revelarla»…), por clave. */
  marcas?: Partial<Record<string, number>>
  /** Palabras clave de cada encuentro ya resuelto en esta misión. */
  resueltas?: string[][]
  /** Lo que pasa además si superas la misión y recuperas lo incautado («las recuperas y robas 2»). */
  alRecuperar?: Efecto[]
  // Misiones 2.0 (fase 7)
  /** Fichas sobre la carta de misión (Ladrón, Alarma, Sospecha…). */
  fichas?: Partial<Record<FichaMision, number>>
  /** Pruebas resueltas en esta misión, en orden. */
  pruebas?: PruebaHecha[]
  /** Veces que un Tripulante ha quedado Buscado en esta misión. */
  buscados?: number
  /** Te retiras por tu cuenta, entre dos Peligros (no porque lo diga una carta). */
  retiradaVoluntaria?: boolean
  /** La misión falla por una regla suya («el ladrón se escapa»): cuenta como retirarse. */
  motivoFallo?: string
  /** Carta que vuelve a apartarse al terminar de resolverla («La Armada te persigue» en la Flota III). */
  alApartar?: InstId
  /** Pruebas empezadas en esta misión («la primera Prueba de esta misión es Sin ayuda»). */
  pruebasEmpezadas?: number
  /** Daño que ha sufrido el Barco en esta misión (el evitado no cuenta). */
  danoSufrido?: number
  /** Algo que la misión recuerda («avistáis la isla»), por clave. */
  hecho?: string[]
  /** La permanente que acaba de poner en juego el encuentro en curso (su propio final de encuentro no le cuenta). */
  permanenteNueva?: InstId
  /**
   * Fase 15: adónde va la misión si no se supera, sin preguntar: al fondo del mazo de Misiones (las Murallas de Port Royal
   * caen) o fuera de la partida («apártala»: La ruta de los alisios).
   */
  destinoForzado?: 'fondo' | 'fuera'
  /** Fase 15: ya se ha hecho lo de «cuando esta misión vaya a superarse» (bucear). */
  antesDeSuperarHecho?: boolean
}

export interface Bono {
  n: number
  /** Viene de un Cañón: «Los Cañones no suman» lo anula. */
  canon: boolean
  fuente: CartaId
}

export interface PruebaEnCurso {
  encuentro: InstId
  /** Índice de la opción elegida y su habilidad (null hasta comprometer). */
  opcion: number | null
  hab: Habilidad | null
  /** Dificultad de la opción congelada al comprometer, con la rebaja por Rasgo (D1b). */
  dificultadBase: number
  comprometidos: InstId[]
  /** Cartas de la mano añadidas al comprometer, y sus iconos de la habilidad. */
  cartas: InstId[]
  iconos: number
  bonos: Bono[]
  /** Carta cuyo Destino se aplica. */
  destino: InstId | null
  destinoCancelado: boolean
  /** Nadie comprometido al revelar el Destino. */
  sinOposicion: boolean
  modDestino: number
  falla: boolean
  sinCartas: boolean
  sinCanones: boolean
  sinFallo: boolean
  /** «Perdidos en la espesura»: se ignora el recuadro rojo (y con él, la herida extra de la misión). */
  ignorarFallo: boolean
  heridaSiFallas: number
  avanceSiSuperas: number
  preparaSiSuperas: boolean
  /** Se supera sin comprometer ni revelar Destino («Carronadas», «Soborno»). */
  automatica: boolean
  /** Cartas agotadas para pagar capacidades durante esta Prueba (para distinguirlas en la mesa). */
  agotadas: InstId[]
  /** De dónde sale: un encuentro, o la Acción de una carta («Prueba de COM 5 para descartar esta carta»). */
  origen?: 'encuentro' | 'accion'
  /** Para las Pruebas que no salen de un encuentro: lo que se prueba y qué pasa al superarla o fallarla. */
  definicion?: DefinicionPrueba
  /** Tripulantes comprometidos que no suman (Aturdido). */
  sinSumar?: InstId[]
  /** Dificultad extra de «la siguiente Prueba recibe ±X» o de «Elige: … o la Prueba recibe +2». */
  modExtra?: number
  /** El Destino revelado «persigue»: al terminar la Prueba vuelve encima del mazo de Peligros. */
  persigue?: boolean
  /** Sin ayuda: solo un Tripulante, solo suman las Habilidades de la mano y no se juegan Eventos. */
  sinAyuda?: boolean
  /** Lo que un Destino o un encuentro cambia en esta Prueba. */
  sinMejoras?: boolean
  sinCapTripulantes?: boolean
  sinCapMejoras?: boolean
  sinEventos?: boolean
  /** «Las Mejoras no suman» (pero se pueden usar). */
  mejorasNoSuman?: boolean
  /** «Invierte el modificador del Destino» (La Madre de agua). «Fallas la Prueba» no cambia. */
  invertirDestino?: boolean
  /** «Revela el Destino antes de comprometer a nadie» (La echadora de cartas). */
  destinoAntes?: boolean
  /** Se revelan 2 Destinos y se aplica el peor. */
  dosDestinos?: boolean
  /**
   * Fase 13, «Bruma en la selva»: «Resuelve 2 cartas de Destino en esta Prueba». Se revelan las dos cartas superiores
   * del mazo de Peligros y valen las dos (`segundoDestino`): se suman sus modificadores y se aplican sus efectos.
   */
  dosDestinosSuman?: boolean
  /** El segundo Destino de una Prueba que resuelve dos («Bruma en la selva»), si se ha cancelado y si persigue. */
  segundoDestino?: InstId | null
  segundoCancelado?: boolean
  segundoPersigue?: boolean
  /**
   * Fase 13: Sin oposición «−1 [avance] (mín. 0)»: el encuentro de esta Prueba da tanto Avance menos (nunca baja de 0
   * ni quita el Avance que ya tenía la misión).
   */
  avanceMenos?: number
  /** Total y dificultad al resolver (para «si fallas por 3 o más» y «por cada punto que superes»). */
  final?: { total: number; dificultad: number }
  resultado: 'superada' | 'fallada' | null
}

export interface Resultado {
  gana: boolean
  motivo: string
}

export interface Estado {
  version: 1
  /** Estado del generador de azar (sfc32). */
  azar: [number, number, number, number]
  sigInst: number
  sigTarea: number
  cartas: Record<InstId, Copia>
  /** Cada zona, de arriba (índice 0) abajo. */
  zonas: Record<Zona, InstId[]>
  capitan: InstId
  puerto: CartaId
  modo: Modo
  reputacionObjetivo: number
  reputacion: number
  danoBarco: number
  /** 0 durante la preparación. */
  turno: number
  paso: Paso
  /** No quedaba carta de Escenario al empezar este turno: al terminarlo, se pierde. */
  ultimoTurno: boolean
  /**
   * Partida de aprendizaje (fase 10c): sin mazo de Escenario. Un contador de días hace de reloj, con el mismo límite que
   * tendría el mazo: cada turno gasta un día y «pierdes un día» gasta otro. Con 0 días, el turno es el último.
   */
  sinEscenario?: { dias: number; total: number }
  /** Misión en curso (la carta sigue en «misionesDisponibles» hasta que termina). */
  mision: MisionEnCurso | null
  /** Prueba en curso dentro de la misión. */
  prueba: PruebaEnCurso | null
  temporales: Temporal[]
  /** Fichas de Estado del Barco (Vía de agua, Incendio a bordo…). */
  estadosBarco?: EstadoBarco[]
  /** Carta de Peligro que «persigue»: está encima del mazo de Peligros y será el siguiente encuentro. */
  persigue?: InstId | null
  /**
   * Solo para simular en el informe de equilibrio: otra regla para el Avance de un encuentro cuya Prueba no superas
   * («mitadAbajo»: la mitad redondeando hacia abajo, la regla hasta el 19 de octubre de 2026; «entero»: el Avance
   * entero, como antes del Avance doble). En una partida normal no está.
   */
  variante?: { avanceSinSuperar?: 'entero' | 'mitadAbajo' }
  /** Cartas de Peligro que ocupan el muelle y lo que cuesta descartarlas. */
  peligrosEnMuelle?: Partial<Record<InstId, number>>
  /** De dónde salió cada carta incautada, para devolverla si superas la misión. */
  incautadas?: Partial<Record<InstId, { zona: 'mano' | 'mejoras'; portador?: InstId | 'barco'; siPierdes?: 'descartar' }>>
  /** Usos de capacidades con límite: «iN/clave» → veces este turno o misión. */
  usos: Record<string, number>
  /** Pila de tareas: la última es la que se está resolviendo. */
  pila: Tarea[]
  /** Si hay decisión pendiente, la ha pedido la tarea de arriba. */
  pendiente: Decision | null
  /** Cuenta cada vez que se revela información (robar, revelar, barajar, mirar un mazo). Corta el deshacer. */
  infoRevelada: number
  registro: EntradaRegistro[]
  resultado: Resultado | null
}

// ---------------------------------------------------------------------------
// Sucesos: pasan por una ventana «antes» (Interrupciones), se aplican y luego una ventana «después» (Respuestas).

export type Evento =
  | { tipo: 'inicioTurno' }
  | { tipo: 'finTurno' }
  | { tipo: 'reclutar'; carta: InstId }
  | { tipo: 'heridas'; objetivo: InstId; cantidad: number }
  | { tipo: 'derrota'; carta: InstId }
  | { tipo: 'danoBarco'; cantidad: number }
  | { tipo: 'zarpar'; mision: InstId }
  | { tipo: 'revelarPeligro'; carta: InstId }
  | { tipo: 'comprometer' }
  | { tipo: 'revelarDestino'; carta: InstId }
  | { tipo: 'superarPrueba' }
  | { tipo: 'fallarPrueba' }
  /** Una carta en juego acaba de descartarse (para los efectos «después de que descartes esta carta»). */
  | { tipo: 'descartada'; carta: InstId }
  /** Acaba de resolverse (o quitarse) una carta de Peligro de la misión. */
  /** `permanente`: la que ha puesto en juego este encuentro (no cuenta su propio final). */
  | { tipo: 'cartaResuelta'; carta: InstId; permanente?: InstId }
  /**
   * Fase 14 (fuera el rehén): un efecto va a descartar a este Tripulante (nunca el Capitán). `dePeligro`: lo descarta una
   * carta de Peligro o una permanente (el Fiador y «¡A por ellos!» solo responden a esas; no a las heridas). P90.
   */
  | { tipo: 'descartarTripulante'; carta: InstId; dePeligro: boolean }
  /** Un Destino va a ponerse encima del mazo de Peligros («Persigue»). */
  | { tipo: 'persigue'; carta: InstId; alFondo?: boolean }
  /** El jugador acaba de agotar un Cañón para pagar una capacidad (la Pólvora del Rey lo mira). */
  | { tipo: 'canonAgotado'; carta: InstId }
  /** Un Tripulante acaba de quedar con un Estado que no tenía. */
  | { tipo: 'estadoPuesto'; carta: InstId; estado: FichaTripulante }
  /** Fase 15: un Tesoro acaba de entrar en juego («Al entrar en juego, gana 2 de reputación»: La custodia de esmeraldas). */
  | { tipo: 'entraEnJuego'; carta: InstId }

// ---------------------------------------------------------------------------
// Tareas: pasos de reglas pendientes. Son datos, para que la partida se pueda guardar en cualquier momento.

export type PasoTurno = 'inicio' | 'jugar' | 'quedarseOZarpar' | 'final' | 'robar' | 'enrolado' | 'cierre'

export type Tarea = { id: number } & (
  | { tipo: 'cambioMano' }
  | { tipo: 'turno'; paso: PasoTurno }
  | { tipo: 'aplicarEscenario'; carta: InstId }
  | { tipo: 'prepararTodo' }
  | { tipo: 'ventanaJugar' }
  /** Pausa en la que solo se pueden usar capacidades sin etiqueta (N2). Se salta si no hay ninguna. */
  | { tipo: 'ventanaLibre'; momento: 'inicio' }
  /** `gratis`: sin pagar su coste. `mitad`: pagando la mitad de su coste impreso, redondeando hacia arriba (fase 14). */
  | { tipo: 'reclutar'; carta: InstId; paso: 'pagar' | 'entrar'; gratis?: boolean; mitad?: boolean }
  | { tipo: 'adquirir'; carta: InstId; destino: InstId | 'barco'; paso: 'pagar' | 'vincular'; gratis?: boolean; mitad?: boolean }
  | { tipo: 'despedir'; carta: InstId }
  | { tipo: 'jugarEvento'; carta: InstId; clave: string; evento: number | null; paso: 'pagar' | 'efecto' | 'descartar' }
  /** `descartarAlFinal`: una Mejora que se descarta como coste lo hace tras calcular su efecto (para saber su portador). */
  | { tipo: 'usar'; uso: Uso; evento: number | null; paso: 'coste' | 'efecto'; descartarAlFinal?: boolean }
  | { tipo: 'pagar'; cantidad: number; motivo: CartaId }
  | { tipo: 'robar'; n: number }
  | { tipo: 'perderDia' }
  | { tipo: 'reponerMuelle' }
  | { tipo: 'revelarMuelle'; n: number }
  /** `marca`: deja la carta encontrada señalada este turno («Marineros sin barco»: reclutarlo cuesta 1 menos). */
  | { tipo: 'buscarMuelle'; filtro: 'tripulante' | 'mejoraBarco' | 'mejora'; marca?: { clave: string; fuente: CartaId } }
  | { tipo: 'perderMejora'; soloBarco?: boolean; portadores?: InstId[]; mayorCoste?: boolean }
  /** «repartir»: como quieras; «cadaUno»: N a cada Tripulante; «uno»: N a un Tripulante (el indicado o el que elijas). */
  | { tipo: 'curar'; n: number; modo: 'repartir' | 'cadaUno' | 'uno'; objetivo?: InstId }
  | { tipo: 'reparar'; n: number }
  /** «Deserción»: tu Tripulante de menor coste vuelve al muelle y sus Mejoras se descartan. */
  | { tipo: 'desercion' }
  /** `mejorasA`: adónde van sus Mejoras, si no van con él (al desertar, a los descartes del muelle). */
  | { tipo: 'sacarTripulante'; carta: InstId; destino: 'descartesMuelle' | 'fueraDeJuego' | 'muelle'; motivo: string; mejorasA?: 'descartesMuelle' }
  /** Puerto: la Taberna quita todos los Estados de tus Tripulantes; el Astillero, todos los del Barco. */
  | { tipo: 'quitarTodosLosEstados'; de: 'tripulacion' | 'barco' }
  | { tipo: 'reasignarTesoro'; tesoro: InstId }
  | { tipo: 'exceso' }
  | { tipo: 'hundirse' }
  | { tipo: 'quedarseEnPuerto'; elegidas: string[] }
  | { tipo: 'tablon' }
  | { tipo: 'soplos' }
  | { tipo: 'reponerMisiones' }
  | { tipo: 'descartarFinal' }
  | { tipo: 'robarHastaMando' }
  | { tipo: 'anadirTemporal'; temporal: Temporal }
  // Misiones (fase 3)
  | { tipo: 'zarpar'; mision: InstId }
  | { tipo: 'mision'; paso: 'inicio' | 'alZarpar' | 'encuentros' | 'terminar' }
  | { tipo: 'ganarAvance'; n: number; si?: { rasgo: string } | { preparados: number }; motivo?: string }
  /** «Puedes agotar a un Oficial para ganar 2 de Avance», «puedes descartar 2 cartas para mirar…»: opcionales. */
  | { tipo: 'alZarparOpcional'; coste: { tipo: 'agotarRasgo'; rasgos: string[] } | { tipo: 'descartar'; n: number }; efectos: Efecto[]; texto: string }
  | { tipo: 'mezclarMazoPropio'; n: number }
  /** `sinVentana`: sin la ventana de retirarse al terminar (el Peligro de más de «Perseguido»). */
  | {
      tipo: 'encuentro'
      carta: InstId | null
      paso: 'revelar' | 'leer' | 'avance' | 'despues'
      sinVentana?: boolean
      sinAvance?: boolean
      /** El encuentro pone en juego una permanente: da su Avance como hoy (sin el de más si es 0). */
      pone?: boolean
    }
  | { tipo: 'prueba'; paso: 'comprometer' | 'destino' | 'aplicarDestino' | 'ventana' | 'resolver' }
  /** `fuente`: la carta que los aplica (para «descarta esta carta» y «ocupa el muelle»). */
  | { tipo: 'aplicarEfectos'; efectos: Efecto[]; contexto: 'efecto' | 'exito' | 'fallo' | 'sinOposicion' | 'pago' | 'disparo'; fuente?: InstId }
  | { tipo: 'aplicarFallo' }
  | { tipo: 'herirUno'; n: number; entre: InstId[] }
  | { tipo: 'repartirHeridas'; n: number; entre: InstId[] }
  | { tipo: 'agotarTripulantes'; n: number | 'todos' }
  | { tipo: 'agotarMejora' }
  | { tipo: 'descartarMano'; n: number }
  | { tipo: 'perderAvance'; n: number | 'todo' }
  /** Agota N Cañones preparados, o todos (los eliges tú). */
  | { tipo: 'agotarCanones'; n: number | 'todos'; coste?: boolean }
  | { tipo: 'cambiarReputacion'; n: number }
  | { tipo: 'entrarEnMazo'; carta: CartaId }
  | { tipo: 'reclutaEncuentro' }
  | { tipo: 'prepararUno'; entre: InstId[] }
  | { tipo: 'superarMision' }
  /** Final con elección: eliges una de las recompensas de la misión. */
  | { tipo: 'elegirFinal'; mision: InstId }
  // Misiones 2.0 (fase 7)
  /** Pon (o quita, con `n` negativo) fichas sobre la misión en curso, y mira si llegan a su número. */
  | { tipo: 'fichasMision'; ficha: FichaMision; n: number }
  /** Un Pasajero entra en juego (si no cabe, devuelves un Tripulante al muelle). */
  | { tipo: 'ponerPasajero'; carta: CartaId }
  /** Un Pasajero se va: vuelve a apartarse. */
  | { tipo: 'bajarPasajero'; carta: CartaId; motivo: string }
  | { tipo: 'fallarMision'; paso: 'anotar' | 'conservar' }
  | { tipo: 'ponerTesoro'; carta: InstId }
  | { tipo: 'cerrarMision' }
  // Capacidades de las cartas del jugador (fase 4)
  /**
   * Otear N: mira las N primeras del mazo de Peligros activo y deja cada una arriba o al fondo.
   * `fondoMax`: cuántas se pueden poner al fondo como mucho; `fondoMin`, como poco («pon 1 al fondo»).
   */
  /** Otea N de un mazo (fase 10b: el de Peligros, por defecto, o el de Misiones). */
  | { tipo: 'otear'; n: number; mazo?: 'misiones'; cartas: InstId[]; arriba: InstId[]; fondo: InstId[]; fondoMax?: number; fondoMin?: number }
  /** Quita la carta de Peligro revelada sin resolverla (no cuenta como resuelta, D5b). */
  | { tipo: 'quitarEncuentro'; modo: 'descartar' | 'fondo'; avance: boolean }
  /** Cancela el Destino revelado, o lo descarta y revela otro. */
  /** `cual`: con dos Destinos (fase 13, «Bruma en la selva»), el que eligió el jugador. */
  | { tipo: 'cambiarDestino'; modo: 'cancelar' | 'otro'; cual?: InstId }
  /** Las heridas de un participante las sufre otro participante («Ni un hombre atrás»). */
  | { tipo: 'desviarHeridas'; suceso: number; entre: InstId[] }
  /** Compromete a un Tripulante en la Prueba en curso, ya revelado el Destino (el Loro). */
  | { tipo: 'comprometerUno'; carta: InstId }
  | { tipo: 'prepararTripulantes' }
  /** Prepara un Cañón agotado (lo eliges tú), o todos. */
  | { tipo: 'prepararCanon'; todos?: boolean }
  /** Recluta sin pagar un Tripulante del muelle de coste N o menos (el «Prisionero liberado» de antes de la fase 14). */
  | { tipo: 'reclutarGratis'; maxCoste: number }
  /** «Náufrago en la playa»: mira las 3 primeras del mazo de muelle y recluta gratis a uno. */
  | { tipo: 'naufrago'; n: number; cartas: InstId[] }
  /**
   * Fase 14: «Mira las 3 cartas superiores del mazo de muelle. Puedes reclutar sin coste un Tripulante de coste 2 o menos
   * de entre ellas. Pon las demás al fondo del mazo de muelle.» (Prisionero liberado, Galera de forzados.)
   */
  | { tipo: 'reclutarDelMazoMuelle'; n: number; maxCoste: number; cartas: InstId[] }
  /** Ficha de Entrenamiento en uno de esos Tripulantes; si `hab` es null, eliges la habilidad. */
  | { tipo: 'ponerEntrenamiento'; entre: InstId[]; hab: Habilidad | null; carta: InstId | null }
  /** Volver al muelle: el Tripulante (no el Capitán) vuelve al muelle con sus Mejoras. */
  | { tipo: 'volverAlMuelle'; carta: InstId }
  // Reglas nuevas de Peligro (fase 6)
  /** «Elige»: antes de comprometer, una Prueba o pagar algo (o entre dos o tres pagos). */
  | { tipo: 'elegirEncuentro'; carta: InstId; extra?: number }
  /** Una Prueba que no sale de un encuentro (Acción de una carta, liberar a un Encadenado…). */
  /**
   * `anidada` (fase 14, «¡A por ellos!»): una Interrupción que hace una Prueba mientras otra está a medio resolver. La de
   * fuera se aparta aquí (con sus efectos «para esta Prueba») y vuelve al cerrar esta. `cancelaSuceso`: si se supera, ese
   * suceso no ocurre.
   */
  | {
      tipo: 'pruebaSuelta'
      definicion: DefinicionPrueba
      fuente: InstId
      paso: 'empezar' | 'cerrar'
      anidada?: boolean
      exterior?: { prueba: PruebaEnCurso; temporales: Temporal[] }
      cancelaSuceso?: number
    }
  /** La carta de Peligro revelada se queda en juego junto a la misión. */
  /** Pone en juego la permanente `permanente` desde el mazo de historia (si no está, descarta el encuentro sin Avance). */
  | { tipo: 'ponerPermanente'; carta: InstId; permanente: CartaId; junto?: Selector; fichas?: number }
  /** «Descarta esta carta» en una permanente: vuelve al mazo de historia. */
  | { tipo: 'devolverPermanente'; carta: InstId }
  /** Suma una ficha al contador de una carta en juego y, si llega al umbral, aplica lo que dice. */
  | { tipo: 'contador'; carta: InstId; clave: string }
  | { tipo: 'ponerEstado'; estado: FichaTripulante; entre: InstId[] }
  | { tipo: 'ponerEstadoBarco'; estado: EstadoBarco }
  | { tipo: 'quitarEstado'; estado: FichaTripulante; de: InstId[] | 'todos' }
  | { tipo: 'quitarEstadoBarco'; estado: EstadoBarco }
  /** Estados al final del turno: Envenenado hiere, Borracho se pasa. */
  | { tipo: 'estadosFinTurno'; paso: 'veneno' | 'borracho'; pendientes: InstId[] }
  | ({ tipo: 'incautar' } & Incautar)
  /** La carta de Peligro (la del encuentro) ocupa el muelle en lugar de la carta de coste más alto. */
  | { tipo: 'ocuparMuelle'; carta: InstId; coste: number }
  | { tipo: 'descartarDelMuelle'; carta: InstId }
  | { tipo: 'mirarPeligros'; n: number }
  | { tipo: 'descartarArriba'; n: number }
  /** Agotar a un Tripulante preparado (con un Rasgo, si se pide) para pagar un coste. */
  | { tipo: 'agotarParaPagar'; rasgo: string | null; rasgos?: string[] }
  /** Al empezar una misión de Mar con el Barco «Perseguido»: una carta de Peligro de más. */
  // Peligros 2.0
  /** A quién le pasa algo (según el criterio de la carta; si hay empate, eliges). */
  | { tipo: 'aQuien'; quien: Selector; hacer: AccionSobre; fuente?: InstId }
  /** Elige una de estas opciones (solo las que se pueden pagar enteras). */
  | { tipo: 'elegirEfectos'; opciones: OpcionEfectos[]; fuente?: InstId }
  /** Paso propio de una carta (su manejador está registrado con la clave). */
  | { tipo: 'especial'; clave: string; fuente?: InstId; datos: Record<string, number | string | boolean | null>; paso: number }
  | { tipo: 'prepararN'; n: number }
  | { tipo: 'descartarAzar'; n: number }
  | { tipo: 'descartarMayorCoste' }
  | { tipo: 'agotarPago'; n: number; oRasgo?: string }
  /** `mitad` (fase 14): no es gratis, se paga la mitad de su coste impreso, redondeando hacia arriba. */
  | { tipo: 'gratisDelMuelle'; maxCoste: number; que: 'tripulante' | 'mejora' | 'cualquiera'; rasgo?: string; siNo?: Efecto[]; carta?: InstId; mitad?: boolean }
  | { tipo: 'recuperarDescarte'; n: number }
  /** Quita uno de estos Estados a un Tripulante (eliges a quién y, si tiene varios, cuál); luego, si lo dice, cúrale N. */
  | { tipo: 'quitarUnEstado'; estados: FichaTripulante[]; carta?: InstId; curar?: number }
  /** Descarta una de estas cartas de Peligro en juego (eliges cuál). */
  | { tipo: 'quitarPermanente'; candidatas: InstId[] }
  /** Fase 15: paga «Destina X [habilidad]» (eliges a quién agotas). */
  | { tipo: 'destina'; n: number; hab: Habilidad }
  /** Fase 15: descarta las N cartas superiores del mazo del capitán (si está vacío, nada). */
  | { tipo: 'descartarMazoCapitan'; n: number }
  /** Fase 15: pone en juego una permanente desde el mazo de historia (si no está allí, aplica `siYa`). */
  | { tipo: 'ponerEnJuego'; carta: CartaId; siYa?: Efecto[] }
  /** Descarta una carta del muelle (la de más a la izquierda, o la Mejora más cara) y, si lo dice, repón el hueco. */
  | { tipo: 'descartarMuelle'; cual: 'izquierda' | 'mejoraMasCara'; reponer?: boolean }
  | {
      tipo: 'evento'
      ev: Evento
      fase: 'antes' | 'aplicar' | 'despues'
      cancelado: boolean
      /** Capacidades ya usadas en este suceso (cada una, una vez). */
      usadas: string[]
    }
)

export type TipoTarea = Tarea['tipo']
export type TareaDe<K extends TipoTarea> = Extract<Tarea, { tipo: K }>
type SinId<T> = T extends unknown ? Omit<T, 'id'> : never
/** Tarea aún sin identificador (lo pone `encolar`). */
export type NuevaTarea = SinId<Tarea>

// ---------------------------------------------------------------------------
// Decisiones pendientes y elecciones del jugador

/** Por qué se pregunta: la interfaz lo usa para redactar la pregunta. */
export interface Motivo {
  clave: string
  carta?: CartaId
  n?: number
  /** Lo que va a pasar, ya redactado («sufre 2 heridas»), cuando la pregunta es genérica. */
  texto?: string
}

export type Accion =
  | { tipo: 'reclutar'; carta: InstId }
  | { tipo: 'adquirir'; carta: InstId; destino: InstId | 'barco' }
  | { tipo: 'despedir'; carta: InstId }
  /** Usar una capacidad o jugar un Evento de la mano. */
  | { tipo: 'usar'; uso: Uso }
  | { tipo: 'retirarse' }
  | { tipo: 'terminarPaso' }

/** Una capacidad concreta de una carta concreta. `fuente` es null para efectos temporales y el Barco. */
export interface Uso {
  fuente: InstId | null
  clave: string
}

export interface Opcion {
  clave: string
  texto: string
}

export type Decision = {
  tarea: number
  motivo: Motivo
  /**
   * N2: capacidades y Eventos sin etiqueta que se pueden usar ahora. Solo aparecen en las pausas
   * del turno (cuando no se está resolviendo otro efecto). Se eligen con `{ tipo: 'usar' }`.
   */
  libres?: Uso[]
} & (
  | { tipo: 'ventanaAccion'; acciones: Accion[] }
  | { tipo: 'elegirCartas'; candidatas: InstId[]; min: number; max: number }
  | { tipo: 'elegirOpcion'; opciones: Opcion[] }
  /** Interrupciones o Respuestas disponibles; siempre se puede pasar. */
  | { tipo: 'ofrecer'; usos: Uso[] }
  /** Repartir exactamente `cantidad` entre varias cartas, sin pasar del máximo de cada una. */
  | { tipo: 'repartir'; cantidad: number; maximos: Partial<Record<InstId, number>> }
  /** Cubrir la Distancia: Tripulantes preparados que se agotan a la vez y cartas con iconos de NAV. */
  | { tipo: 'cubrirDistancia'; distancia: number; tripulantes: InstId[]; cartas: InstId[] }
  /** Elegir opción de la Prueba y comprometer Tripulantes y cartas de la mano. */
  | { tipo: 'comprometer'; opciones: OpcionPruebaDecision[]; tripulantes: InstId[]; cartas: InstId[]; sinAyuda?: boolean }
)

export interface OpcionPruebaDecision {
  hab: Habilidad
  dificultad: number
  alternativa?: { rasgo: string; dificultad: number; comprometido?: boolean }
}


export type Eleccion =
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'cartas'; ids: InstId[] }
  | { tipo: 'opcion'; clave: string }
  | { tipo: 'usar'; uso: Uso }
  | { tipo: 'pasar' }
  | { tipo: 'reparto'; n: Partial<Record<InstId, number>> }
  | { tipo: 'compromiso'; opcion: number; tripulantes: InstId[]; cartas: InstId[] }

// ---------------------------------------------------------------------------
// Capacidades de las cartas (registro por identificador de carta)

/** Lo que se pregunta a `valor()`: base impresa + modificadores activos. */
export type Consulta =
  | { tipo: 'habilidad'; carta: InstId; hab: Habilidad }
  | { tipo: 'vida'; carta: InstId }
  | { tipo: 'huecos'; carta: InstId }
  | { tipo: 'coste'; carta: InstId }
  | { tipo: 'capacidad' }
  | { tipo: 'espacio' }
  | { tipo: 'danoMaximo' }
  | { tipo: 'mando' }
  /** Cartas hasta las que robas al final del turno. */
  | { tipo: 'objetivoRobo' }
  | { tipo: 'distancia'; mision: InstId }
  | { tipo: 'avanceNecesario'; mision: InstId }
  /** Dificultad de una Prueba: `base` más modificadores (reglas de misión, Escenario…). */
  | { tipo: 'dificultad'; base: number; hab: Habilidad; claves: readonly string[] }
  /** Bonificación constante al total de una Prueba (La Sombra del Alba: +1 NAV en el Mar). */
  | { tipo: 'totalPrueba'; hab: Habilidad }
  /** Heridas que añade cada efecto de fallo (D2b). */
  | { tipo: 'heridaExtraFallo' }
  /** Avance extra al superar una Prueba de esa habilidad. */
  | { tipo: 'avanceExtraPrueba'; hab: Habilidad }
  /**
   * Avance extra que da un encuentro al ganar su Avance («los encuentros #Civil# dan 1 más», «cada Prueba de EXP que
   * superes por 2 o más da 1 más»). `hab` y `margen`: los de su Prueba, si la hubo y se superó.
   */
  | { tipo: 'avanceExtraEncuentro'; claves: readonly string[]; hab: Habilidad | null; margen: number }
  /** Mayor que 0: los Cañones no suman. */
  | { tipo: 'sinCanones' }
  /** Mayor que 0: este Tripulante se compromete en esta Prueba sin agotarse (Rodrigo). */
  | { tipo: 'sinAgotarAlComprometer'; carta: InstId; hab: Habilidad }
  /** Mayor que 0: este Tripulante comprometido no suma en la Prueba en curso. */
  | { tipo: 'noSuma'; carta: InstId }
  /** Mayor que 0: el Barco no da su +1 de NAV. */
  | { tipo: 'sinNavBarco' }

/** Contexto de cálculo: permite suponer agotadas algunas cartas (agotarse a la vez, D1a). */
export interface Contexto {
  s: Estado
  agotada: (carta: InstId) => boolean
  /** Para prever una Prueba antes de comprometer: quiénes participarían (el Espadachín lo mira). */
  participantes?: readonly InstId[]
}

export type Coste =
  | { tipo: 'agotarse' }
  | { tipo: 'descartarse' }
  | { tipo: 'pagar'; n: number }
  | { tipo: 'herida'; n: number }
  | { tipo: 'agotarCapitan' }
  /** Agota a un Tripulante preparado (con ese Rasgo, si lo hay; o con uno de esos Rasgos). */
  | { tipo: 'agotarTripulante'; rasgo: string | null; rasgos?: string[] }
  /** Agota a N Tripulantes preparados, o a 1 con ese Rasgo («agota a un Marinero o a 2 Tripulantes»). */
  | { tipo: 'agotarVarios'; n: number; oRasgo?: string }
  /** Agota uno de tus Cañones preparados (eliges cuál). */
  | { tipo: 'agotarCanon' }
  /**
   * Fase 15, «Destina X [habilidad]»: agota Tripulantes preparados cuya habilidad sume al menos X (con sus bonificaciones,
   * como al cubrir una Distancia). No es una Prueba.
   */
  | { tipo: 'destina'; n: number; hab: Habilidad }

export type Ventana =
  | 'constante'
  /** Escenario: se aplica al revelarse. */
  | 'alRevelar'
  | 'accion'
  /** Sin etiqueta: en cualquier pausa del turno, nunca en mitad de otro efecto (decisión N2). */
  | 'libre'
  | 'respuesta'
  | 'interrupcion'
  | 'obligada'
  | 'alZarpar'

export interface Capacidad {
  clave: string
  carta: CartaId
  ventana: Ventana
  /** Desde dónde funciona: carta en juego, en la mano, efecto temporal, el Barco o la carta de Escenario. */
  /** `descartada`: la carta acaba de descartarse («después de que descartes esta carta»). */
  /** `encuentro`: la carta cuyo encuentro se resuelve; `destino`: la carta cuyo Destino se aplica en la Prueba en curso. */
  desde:
    | 'juego'
    | 'mano'
    | 'temporal'
    | 'barco'
    | 'escenario'
    | 'mision'
    | 'descartada'
    /** Una permanente en la zona de permanentes (fase 11). */
    | 'permanente'
    | 'peligroEnMuelle'
    | 'estado'
    | 'estadoBarco'
    | 'encuentro'
    | 'destino'
    /** Un Tripulante marcado por una carta («se pierde», «atrapado», «señalado»): la capacidad es de esa marca. */
    | 'marca'
    /** Un Pasajero en juego. */
    | 'pasajero'
  /** Condición extra para poder usarla ahora (p. ej., «solo en Pruebas de COM en el Mar»). */
  requisito?: (s: Estado, yo: InstId | null) => boolean
  /** Lo que dice, para la mesa, cuando no sale del texto de una carta del jugador (capacidades de los Peligros). */
  texto?: string
  limite?: { veces: number; por: 'turno' | 'mision' }
  coste?: Coste[]
  /** Modificador constante a un valor. */
  modifica?: (ctx: Contexto, yo: InstId | null, c: Consulta) => number
  /** Para Respuestas, Interrupciones y Obligadas: ¿se dispara con este suceso? */
  disparo?: (s: Estado, yo: InstId | null, ev: Evento, fase: 'antes' | 'despues') => boolean
  /** Lo que hace: tareas a encolar. Recibe la tarea del suceso para poder cambiarlo o cancelarlo. */
  efecto?: (s: Estado, yo: InstId | null, suceso: TareaDe<'evento'> | null) => NuevaTarea[]
}
