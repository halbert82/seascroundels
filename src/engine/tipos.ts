// Tipos del motor de reglas. Todo el estado de la partida es JSON simple: se guarda y se recupera tal cual.

import type { Habilidad } from './datos.ts'

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
  /** Mejoras y Tesoros vinculados al Barco o a un Tripulante. */
  'mejoras',
  'rehenes',
  'mazoEscenario',
  /** La carta de Escenario revelada este turno. */
  'escenarioEnCurso',
  'descartesEscenario',
  'mazoPeligros',
  'descartesPeligros',
  /** «La Armada te persigue» y «Amigos en la costa», fuera del mazo hasta que una carta las meta. */
  'apartados',
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
  municion: number
  /** Fichas de Avance (en las misiones). */
  avance: number
  /** Para Mejoras y Tesoros: a qué van vinculados. */
  vinculadaA: InstId | 'barco' | null
  /** Fichas de Entrenamiento (+1 a una habilidad; ocupan hueco de Mejora). */
  entrenamiento: Habilidad[]
}

export type Paso = 'preparacion' | 'inicio' | 'jugarCartas' | 'quedarseOZarpar' | 'mision' | 'final' | 'terminada'
export type Modo = 'corta' | 'normal' | 'larga'

/** Efecto que dura un tiempo («Este turno, …»). Su regla está en el registro de capacidades con la misma clave. */
export interface Temporal {
  clave: string
  fuente: CartaId
  hasta: 'finTurno' | 'finMision'
}

export type TipoRegistro = 'turno' | 'revelar' | 'robar' | 'pagar' | 'jugada' | 'efecto' | 'aviso' | 'fin'

export interface EntradaRegistro {
  turno: number
  paso: Paso
  tipo: TipoRegistro
  texto: string
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
  temporales: Temporal[]
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

// ---------------------------------------------------------------------------
// Tareas: pasos de reglas pendientes. Son datos, para que la partida se pueda guardar en cualquier momento.

export type PasoTurno = 'inicio' | 'jugar' | 'quedarseOZarpar' | 'final' | 'robar' | 'cierre'

export type Tarea = { id: number } & (
  | { tipo: 'cambioMano' }
  | { tipo: 'turno'; paso: PasoTurno }
  | { tipo: 'aplicarEscenario'; carta: InstId }
  | { tipo: 'prepararTodo' }
  | { tipo: 'recargar' }
  | { tipo: 'ventanaJugar' }
  /** Pausa en la que solo se pueden usar capacidades sin etiqueta (N2). Se salta si no hay ninguna. */
  | { tipo: 'ventanaLibre'; momento: 'inicio' }
  | { tipo: 'reclutar'; carta: InstId; paso: 'pagar' | 'entrar' }
  | { tipo: 'adquirir'; carta: InstId; destino: InstId | 'barco'; paso: 'pagar' | 'vincular' }
  | { tipo: 'despedir'; carta: InstId }
  | { tipo: 'jugarEvento'; carta: InstId; clave: string; paso: 'pagar' | 'efecto' | 'descartar' }
  | { tipo: 'usar'; uso: Uso; evento: number | null; paso: 'coste' | 'efecto' }
  | { tipo: 'pagar'; cantidad: number; motivo: CartaId }
  | { tipo: 'robar'; n: number }
  | { tipo: 'perderDia' }
  | { tipo: 'reponerMuelle' }
  | { tipo: 'revelarMuelle'; n: number }
  | { tipo: 'buscarMuelle'; filtro: 'tripulante' | 'mejoraBarco' | 'mejora' }
  | { tipo: 'perderMejora' }
  | { tipo: 'curar'; n: number; modo: 'repartir' | 'cadaUno' }
  | { tipo: 'reparar'; n: number }
  | { tipo: 'desercion' }
  | { tipo: 'sacarTripulante'; carta: InstId; destino: 'descartesMuelle' | 'fueraDeJuego'; motivo: string }
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
}

export type Accion =
  | { tipo: 'reclutar'; carta: InstId }
  | { tipo: 'adquirir'; carta: InstId; destino: InstId | 'barco' }
  | { tipo: 'despedir'; carta: InstId }
  /** Usar una capacidad o jugar un Evento de la mano. */
  | { tipo: 'usar'; uso: Uso }
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
)


export type Eleccion =
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'cartas'; ids: InstId[] }
  | { tipo: 'opcion'; clave: string }
  | { tipo: 'usar'; uso: Uso }
  | { tipo: 'pasar' }
  | { tipo: 'reparto'; n: Partial<Record<InstId, number>> }

// ---------------------------------------------------------------------------
// Capacidades de las cartas (registro por identificador de carta)

/** Lo que se pregunta a `valor()`: base impresa + modificadores activos. */
export type Consulta =
  | { tipo: 'habilidad'; carta: InstId; hab: Habilidad }
  | { tipo: 'vida'; carta: InstId }
  | { tipo: 'huecos'; carta: InstId }
  | { tipo: 'municionMaxima'; carta: InstId }
  | { tipo: 'coste'; carta: InstId }
  | { tipo: 'capacidad' }
  | { tipo: 'espacio' }
  | { tipo: 'danoMaximo' }
  | { tipo: 'mando' }
  /** Cartas hasta las que robas al final del turno. */
  | { tipo: 'objetivoRobo' }
  | { tipo: 'distancia'; mision: InstId }
  | { tipo: 'avanceNecesario'; mision: InstId }

/** Contexto de cálculo: permite suponer agotadas algunas cartas (agotarse a la vez, D1a). */
export interface Contexto {
  s: Estado
  agotada: (carta: InstId) => boolean
}

export type Coste =
  | { tipo: 'agotarse' }
  | { tipo: 'descartarse' }
  | { tipo: 'pagar'; n: number }
  | { tipo: 'municion'; n: number }
  | { tipo: 'herida'; n: number }

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
  desde: 'juego' | 'mano' | 'temporal' | 'barco' | 'escenario'
  limite?: { veces: number; por: 'turno' | 'mision' }
  coste?: Coste[]
  /** Modificador constante a un valor. */
  modifica?: (ctx: Contexto, yo: InstId | null, c: Consulta) => number
  /** Para Respuestas, Interrupciones y Obligadas: ¿se dispara con este suceso? */
  disparo?: (s: Estado, yo: InstId | null, ev: Evento, fase: 'antes' | 'despues') => boolean
  /** Lo que hace: tareas a encolar. Recibe la tarea del suceso para poder cambiarlo o cancelarlo. */
  efecto?: (s: Estado, yo: InstId | null, suceso: TareaDe<'evento'> | null) => NuevaTarea[]
}
