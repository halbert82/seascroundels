// Tipos del motor de reglas. Todo el estado de la partida es JSON simple: se guarda y se recupera tal cual.

import type { Habilidad } from './datos.ts'
import type { Efecto } from './efectos.ts'

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
  /** Mazo mezclado de una misión con mazo propio (mazo propio + cartas del mazo de Peligros). */
  'mazoMision',
  'descartesMision',
  /** Carta de Peligro cuyo encuentro se está resolviendo. */
  'encuentro',
  /** Cartas cuyo Destino se ha revelado en la Prueba en curso. */
  'destino',
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
  hasta: 'finTurno' | 'finMision' | 'finPrueba'
  /** La copia concreta a la que afecta (el Filibustero que se ha herido, el Tripulante del Náufrago…). */
  inst?: InstId
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
  | { tipo: 'finMision'; mision: CartaId; resultado: FinMision }
  | { tipo: 'hundimiento' }
  | { tipo: 'derrota'; carta: CartaId }
  | { tipo: 'rehenPerdido'; carta: CartaId }
  | { tipo: 'seRetira'; carta: CartaId }
  | { tipo: 'entraEnMazo'; carta: CartaId }
  | { tipo: 'mazoMisionBarajado' }
  | { tipo: 'superadaAMitad' }
  // Para el informe por carta.
  | { tipo: 'reclutar'; carta: CartaId }
  | { tipo: 'adquirir'; carta: CartaId }
  /** Capacidad usada o Evento jugado por su efecto. */
  | { tipo: 'usar'; carta: CartaId; clave: string }
  /** Cartas descartadas por sus iconos (comprometer, reforzar o cubrir la Distancia). */
  | { tipo: 'iconos'; cartas: CartaId[] }
  // Para animar la mesa: qué copia concreta cambia.
  | { tipo: 'revelado'; inst: InstId; como: 'encuentro' | 'destino' | 'escenario' }
  | { tipo: 'avance'; n: number; total: number }
  | { tipo: 'heridas'; inst: InstId; n: number }
  | { tipo: 'dano'; n: number }
  | { tipo: 'reputacion'; n: number }

export type FinMision = 'superada' | 'retirada' | 'hundida'

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
  /** Carta de Peligro cuya Prueba se superará automáticamente al leerla («Soborno»). */
  automatica: InstId | null
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
  /** Cartas de la mano añadidas al comprometer y al reforzar, y sus iconos de la habilidad. */
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
  /** Misión en curso (la carta sigue en «misionesDisponibles» hasta que termina). */
  mision: MisionEnCurso | null
  /** Prueba en curso dentro de la misión. */
  prueba: PruebaEnCurso | null
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
  | { tipo: 'danoBarco'; cantidad: number }
  | { tipo: 'zarpar'; mision: InstId }
  | { tipo: 'revelarPeligro'; carta: InstId }
  | { tipo: 'comprometer' }
  | { tipo: 'revelarDestino'; carta: InstId }
  | { tipo: 'superarPrueba' }
  | { tipo: 'fallarPrueba' }
  /** Una carta en juego acaba de descartarse (para los efectos «después de que descartes esta carta»). */
  | { tipo: 'descartada'; carta: InstId }

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
  | { tipo: 'reclutar'; carta: InstId; paso: 'pagar' | 'entrar'; gratis?: boolean }
  | { tipo: 'adquirir'; carta: InstId; destino: InstId | 'barco'; paso: 'pagar' | 'vincular' }
  | { tipo: 'despedir'; carta: InstId }
  | { tipo: 'jugarEvento'; carta: InstId; clave: string; evento: number | null; paso: 'pagar' | 'efecto' | 'descartar' }
  /** `descartarAlFinal`: una Mejora que se descarta como coste lo hace tras calcular su efecto (para saber su portador). */
  | { tipo: 'usar'; uso: Uso; evento: number | null; paso: 'coste' | 'efecto'; descartarAlFinal?: boolean }
  | { tipo: 'pagar'; cantidad: number; motivo: CartaId }
  | { tipo: 'robar'; n: number }
  | { tipo: 'perderDia' }
  | { tipo: 'reponerMuelle' }
  | { tipo: 'revelarMuelle'; n: number }
  | { tipo: 'buscarMuelle'; filtro: 'tripulante' | 'mejoraBarco' | 'mejora' }
  | { tipo: 'perderMejora' }
  /** «repartir»: como quieras; «cadaUno»: N a cada Tripulante; «uno»: N a un Tripulante (el indicado o el que elijas). */
  | { tipo: 'curar'; n: number; modo: 'repartir' | 'cadaUno' | 'uno'; objetivo?: InstId }
  | { tipo: 'reparar'; n: number }
  | { tipo: 'desercion' }
  | { tipo: 'sacarTripulante'; carta: InstId; destino: 'descartesMuelle' | 'fueraDeJuego' | 'muelle'; motivo: string }
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
  | { tipo: 'alZarparOpcional'; coste: { tipo: 'agotarRasgo'; rasgo: string } | { tipo: 'descartar'; n: number }; n: number }
  | { tipo: 'mezclarMazoPropio'; n: number }
  | { tipo: 'encuentro'; carta: InstId | null; paso: 'revelar' | 'leer' | 'avance' | 'despues' }
  | { tipo: 'prueba'; paso: 'comprometer' | 'destino' | 'aplicarDestino' | 'ventana' | 'resolver' }
  | { tipo: 'aplicarEfectos'; efectos: Efecto[]; contexto: 'efecto' | 'exito' | 'fallo' | 'sinOposicion' }
  | { tipo: 'aplicarFallo' }
  | { tipo: 'herirUno'; n: number; entre: InstId[] }
  | { tipo: 'repartirHeridas'; n: number; entre: InstId[] }
  | { tipo: 'agotarTripulantes'; n: number | 'todos' }
  | { tipo: 'agotarMejora' }
  | { tipo: 'descartarMano'; n: number }
  | { tipo: 'perderAvance'; n: number | 'todo' }
  | { tipo: 'perderMunicion'; n: number }
  | { tipo: 'rehen'; entre: InstId[] }
  | { tipo: 'cambiarReputacion'; n: number }
  | { tipo: 'entrarEnMazo'; carta: CartaId }
  | { tipo: 'reclutaEncuentro' }
  | { tipo: 'prepararUno'; entre: InstId[] }
  | { tipo: 'superarMision' }
  | { tipo: 'fallarMision'; paso: 'rehenes' | 'conservar' }
  | { tipo: 'ponerTesoro'; carta: InstId }
  | { tipo: 'cerrarMision' }
  // Capacidades de las cartas del jugador (fase 4)
  /** Otear N: mira las N primeras del mazo de Peligros activo y deja cada una arriba o al fondo. */
  | { tipo: 'otear'; n: number; cartas: InstId[]; arriba: InstId[]; fondo: InstId[] }
  /** Quita la carta de Peligro revelada sin resolverla (no cuenta como resuelta, D5b). */
  | { tipo: 'quitarEncuentro'; modo: 'descartar' | 'fondo'; avance: boolean }
  /** Cancela el Destino revelado, o lo descarta y revela otro. */
  | { tipo: 'cambiarDestino'; modo: 'cancelar' | 'otro' }
  /** Las heridas de un participante las sufre otro participante («Ni un hombre atrás»). */
  | { tipo: 'desviarHeridas'; suceso: number; entre: InstId[] }
  /** Compromete a un Tripulante en la Prueba en curso, ya revelado el Destino (el Loro). */
  | { tipo: 'comprometerUno'; carta: InstId }
  | { tipo: 'prepararTripulantes' }
  | { tipo: 'anadirMunicion'; n: number }
  /** Recluta sin pagar un Tripulante del muelle de coste N o menos («Prisionero liberado»). */
  | { tipo: 'reclutarGratis'; maxCoste: number }
  /** «Náufrago en la playa»: mira las 3 primeras del mazo de muelle y recluta gratis a uno. */
  | { tipo: 'naufrago'; n: number; cartas: InstId[] }
  /** Ficha de Entrenamiento en uno de esos Tripulantes; si `hab` es null, eliges la habilidad. */
  | { tipo: 'ponerEntrenamiento'; entre: InstId[]; hab: Habilidad | null; carta: InstId | null }
  /** Volver al muelle: el Tripulante (no el Capitán) vuelve al muelle con sus Mejoras. */
  | { tipo: 'volverAlMuelle'; carta: InstId }
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
  /** Descartar una carta de la mano por sus iconos para sumar a la Prueba (solo con comprometidos). */
  | { tipo: 'reforzar'; carta: InstId }
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
  | { tipo: 'comprometer'; opciones: OpcionPruebaDecision[]; tripulantes: InstId[]; cartas: InstId[] }
)

export interface OpcionPruebaDecision {
  hab: Habilidad
  dificultad: number
  alternativa?: { rasgo: string; dificultad: number }
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
  /** Dificultad de una Prueba: `base` más modificadores (reglas de misión, Escenario…). */
  | { tipo: 'dificultad'; base: number; hab: Habilidad; claves: readonly string[] }
  /** Bonificación constante al total de una Prueba (La Sombra del Alba: +1 NAV en el Mar). */
  | { tipo: 'totalPrueba'; hab: Habilidad }
  /** Heridas que añade cada efecto de fallo (D2b). */
  | { tipo: 'heridaExtraFallo' }
  /** Avance extra al superar una Prueba de esa habilidad. */
  | { tipo: 'avanceExtraPrueba'; hab: Habilidad }
  /** Mayor que 0: los Cañones no suman. */
  | { tipo: 'sinCanones' }
  /** Mayor que 0: este Tripulante se compromete en esta Prueba sin agotarse (Rodrigo). */
  | { tipo: 'sinAgotarAlComprometer'; carta: InstId; hab: Habilidad }

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
  | { tipo: 'municion'; n: number }
  | { tipo: 'herida'; n: number }
  | { tipo: 'agotarCapitan' }

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
  desde: 'juego' | 'mano' | 'temporal' | 'barco' | 'escenario' | 'mision' | 'descartada'
  /** Condición extra para poder usarla ahora (p. ej., «solo en Pruebas de COM en el Mar»). */
  requisito?: (s: Estado, yo: InstId | null) => boolean
  limite?: { veces: number; por: 'turno' | 'mision' }
  coste?: Coste[]
  /** Modificador constante a un valor. */
  modifica?: (ctx: Contexto, yo: InstId | null, c: Consulta) => number
  /** Para Respuestas, Interrupciones y Obligadas: ¿se dispara con este suceso? */
  disparo?: (s: Estado, yo: InstId | null, ev: Evento, fase: 'antes' | 'despues') => boolean
  /** Lo que hace: tareas a encolar. Recibe la tarea del suceso para poder cambiarlo o cancelarlo. */
  efecto?: (s: Estado, yo: InstId | null, suceso: TareaDe<'evento'> | null) => NuevaTarea[]
}
