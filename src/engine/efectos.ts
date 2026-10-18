// Interpreta los recuadros de efecto de los Peligros y las líneas Sin oposición tal y como se
// imprimen (iconos separados por « · »): «2 [herida] · 1 [agotar]», «1 [dano] · / 1 [herida]»…

import { DATOS, type Entorno, type Habilidad } from './datos.ts'
import type { EstadoBarco, EstadoTripulante } from './infoEstados.ts'
import type { CartaId, InstId } from './tipos.ts'

export type Efecto =
  /** Heridas a un Tripulante. `capitan`: al Capitán. `soloEnTierra`: alternativa al daño fuera del Mar. */
  | { tipo: 'heridas'; n: number; capitan?: boolean; soloEnTierra?: boolean }
  /**
   * Daño al Barco (solo en el Mar). `soloEnMar`: tiene alternativa en tierra. `enTierra`: la carta dice expresamente que
   * daña el Barco fuera del Mar («Te roban el barco», en Ciudad): la carta manda sobre la regla (P19).
   */
  | { tipo: 'dano'; n: number; soloEnMar?: boolean; enTierra?: boolean }
  | { tipo: 'reparar'; n: number }
  | { tipo: 'agotar'; n: number | 'todos' }
  | { tipo: 'descartar'; n: number }
  | { tipo: 'robar'; n: number }
  /** Curar N: repartidas (por defecto), N a cada comprometido, a cada Tripulante, a cada herido, o a uno. */
  | { tipo: 'curar'; n: number; modo?: 'repartir' | 'cadaComprometido' | 'cadaUno' | 'cadaHerido' | 'uno' }
  | { tipo: 'perderAvance'; n: number | 'todo' }
  | { tipo: 'perderMunicion'; n: number }
  /** Pierdes N Mejoras (`deComprometidos`: de un Tripulante comprometido). */
  | { tipo: 'perderMejora'; n: number; deComprometidos?: boolean }
  | { tipo: 'agotarMejora' }
  | { tipo: 'rehen' }
  | { tipo: 'reputacion'; n: number }
  /** −1 Mando: este turno, o en tu próximo turno (`proximo`). */
  | { tipo: 'menosMando'; proximo?: boolean }
  | { tipo: 'perderDia' }
  | { tipo: 'entraEnMazo'; carta: CartaId }
  | { tipo: 'seRetira' }
  | { tipo: 'recluta' }
  | { tipo: 'sinFallo' }
  // Efectos de los Peligros nuevos (fase 6). No salen de los iconos impresos: los da el registro de reglas de cada carta.
  /** Ficha de Estado a un Tripulante: el que elijas, uno de los comprometidos, todos o el Capitán. */
  | { tipo: 'estado'; estado: EstadoTripulante; a: 'uno' | 'comprometido' | 'todos' | 'capitan' }
  | { tipo: 'estadoBarco'; estado: EstadoBarco }
  /** Quita un Estado: al Tripulante de la carta que lo dice, a uno que elijas o a todos. */
  | { tipo: 'quitarEstado'; estado: EstadoTripulante; a: 'fuente' | 'uno' | 'todos' }
  | { tipo: 'quitarEstadoBarco'; estado: EstadoBarco }
  /** Cartas de la mano, una Mejora o un Tripulante van debajo de la carta de misión. */
  | ({ tipo: 'incautar' } & Incautar)
  /** La carta del encuentro ocupa el muelle; en Jugar cartas se descarta pagando `coste` cartas. */
  | { tipo: 'ocuparMuelle'; coste: number }
  /** «La siguiente Prueba de esta misión recibe ±X» (a su dificultad). */
  | { tipo: 'modSiguientePrueba'; n: number }
  | { tipo: 'mirarPeligros'; n: number }
  | { tipo: 'descartarArriba'; n: number }
  | { tipo: 'noRetirarse' }
  | { tipo: 'retirarse' }
  /** La carta de Peligro en juego que lo dice se descarta. */
  | { tipo: 'descartarEsta' }
  /** Lee la mesa: Rasgos, Mejoras, heridas, munición, Estados… */
  | { tipo: 'si'; condicion: Condicion; entonces: Efecto[]; sino?: Efecto[] }
  /** «1 herida por cada Mejora» (con un mínimo y un máximo, si lo dice). */
  | { tipo: 'porCada'; medida: Medida; efectos: Efecto[]; maximo?: number; minimo?: number }
  // Peligros 2.0
  | { tipo: 'ganarAvance'; n: number }
  | { tipo: 'ganarMunicion'; n: number }
  /** Prepara a N Tripulantes (a tu elección), a todos o a los comprometidos. */
  | { tipo: 'preparar'; n: number | 'todos' | 'comprometidos' }
  /** A quién le pasa algo: «el comprometido con más EXP queda Buscado», «cada Tripulante agotado sufre 1 herida»… */
  | { tipo: 'aQuien'; quien: Selector; hacer: AccionSobre }
  | { tipo: 'descartarAzar'; n: number }
  /** Descarta la carta de mayor coste de tu mano (si empatan, eliges). */
  | { tipo: 'descartarMayorCoste' }
  /** Pago de «Elige»: agota N Tripulantes preparados, o 1 con ese Rasgo. */
  | { tipo: 'agotarPago'; n: number; oRasgo?: string }
  /** Mira las N de arriba del mazo de Peligros: «ordénalas» (fondo: no), «pon 1 al fondo» (una) o como quieras (libre). */
  | { tipo: 'mirarOrdenar'; n: number; fondo: 'no' | 'una' | 'libre' }
  /** «El siguiente encuentro #Guardia# de esta misión recibe −2», «la siguiente Prueba recibe +1», «no da Avance»… */
  | { tipo: 'siguiente'; mod: ModSiguiente }
  /** Esta carta va al fondo del mazo de Peligros (en vez de a los descartes) al terminar. */
  | { tipo: 'alFondo' }
  /** El jugador elige una de las opciones (las que se pueden pagar enteras). */
  | { tipo: 'elegir'; opciones: OpcionEfectos[] }
  /** Recluta o adquiere gratis una carta del muelle de coste N o menos (si no hay ninguna, `siNo`). */
  | { tipo: 'gratisDelMuelle'; maxCoste: number; que: 'tripulante' | 'mejora' | 'cualquiera'; rasgo?: string; siNo?: Efecto[] }
  /** Rescata a todos los rehenes de esta misión (si no hay ninguno, `siNo`). `preparados`: vuelven preparados. */
  | { tipo: 'rescatarRehenes'; siNo?: Efecto[]; preparados?: boolean }
  /** Lo incautado vuelve ya. */
  | { tipo: 'recuperarIncautadas' }
  /** Recupera N cartas de tu pila de descartes a la mano (eliges). */
  | { tipo: 'recuperarDescarte'; n: number }
  /** Pon N fichas en esta carta (la que está en juego). */
  | { tipo: 'ficha'; n: number }
  /** La Prueba se supera sin hacerla. */
  | { tipo: 'superarSinPrueba' }
  /** Quita uno de estos Estados a un Tripulante (eliges a quién y cuál) y, si lo dice, cúrale N. */
  | { tipo: 'quitarUnEstado'; estados: EstadoTripulante[]; curar?: number }
  /** Descarta una carta del muelle: la de más a la izquierda o la Mejora más cara (y, si lo dice, repón el hueco). */
  | { tipo: 'descartarMuelle'; cual: 'izquierda' | 'mejoraMasCara'; reponer?: boolean }
  /** Le pasa algo a este Tripulante concreto. */
  | { tipo: 'sobre'; carta: InstId; hacer: AccionSobre }
  /** «Uno de los comprometidos sufre N heridas» desde un Destino: si hay un Maldito comprometido, tiene que ser él. */
  | { tipo: 'herirComprometido'; n: number }
  /** Lo que no cabe en lo anterior: una función registrada por carta. */
  | { tipo: 'codigo'; clave: string }

/** Cómo se incauta: qué, cuántas, cómo se eligen y qué pasa al recuperarlo o perderlo. */
export interface Incautar {
  que: 'mano' | 'mejora' | 'tripulante'
  n: number
  /** Cómo se eligen: tú (por defecto), al azar, o las de mayor coste (si empatan, eliges). */
  criterio?: 'azar' | 'mayorCoste'
  /** Solo Mejoras de un Tripulante (no del Barco). */
  deTripulantes?: boolean
  /** Si tienes alguna de estas cartas, tiene que ser ella («si llevas el Amuleto, tiene que ser él»). */
  obligadas?: CartaId[]
  /** Si superas la misión y lo recuperas, además… («y robas 2»). */
  alRecuperar?: Efecto[]
  /** Si no superas la misión: fuera del juego (por defecto) o a los descartes. */
  siPierdes?: 'descartar'
  /** Cómo se cuenta en el registro (por defecto, «Te incautan…»): «Dejas como pagaré». */
  anotacion?: string
}

/** Una opción de «Elige» de un recuadro (o de un Destino). `si`: solo se ofrece si se cumple. */
export interface OpcionEfectos {
  texto: string
  efectos: Efecto[]
  si?: Condicion
}

/** «La siguiente Prueba / el siguiente encuentro (con estas claves o de esta habilidad) de esta misión…» */
export interface ModSiguiente {
  de: 'prueba' | 'encuentro'
  /** Cambio a la dificultad de esa Prueba. */
  n?: number
  /** Ese encuentro no da Avance. */
  sinAvance?: boolean
  /** En esa Prueba se revelan 2 Destinos y se aplica el peor. */
  dosDestinos?: boolean
  claves?: string[]
  hab?: Habilidad
}

/** A quién se aplica algo. Si hay empate en el criterio, elige el jugador. */
export interface Selector {
  de: 'comprometidos' | 'tripulacion' | 'preparados' | 'agotados' | 'noComprometidos' | 'noComprometidosPreparados' | 'heridos' | 'capitan'
  /** Criterio: el número impreso de esa habilidad («prueba»: la de la Prueba en curso), la Vida, las heridas, el coste… */
  por?: 'eleccion' | 'azar' | { mas: Habilidad | 'prueba' } | { menos: Habilidad | 'prueba' } | 'menosVida' | 'masHeridas' | 'menorCoste'
  /** A todos los que cumplan (hasta `maximo`, eligiendo tú si hay más). */
  cada?: boolean
  maximo?: number
  sinCapitan?: boolean
  rasgo?: string
  /** Solo los que no tengan este Rasgo («los que no sean Oficiales»). */
  sinRasgo?: string
  conEstado?: EstadoTripulante
  /** Solo los que tengan alguna herida. */
  herido?: boolean
  /** Solo este Tripulante concreto. */
  inst?: InstId
}

/** Lo que le pasa al elegido. */
export type AccionSobre =
  | { tipo: 'heridas'; n: number }
  | { tipo: 'estado'; estado: EstadoTripulante }
  | { tipo: 'quitarEstado'; estado: EstadoTripulante }
  | { tipo: 'rehen' }
  | { tipo: 'preparar' }
  | { tipo: 'agotar' }
  | { tipo: 'curar'; n: number }
  /** Vuelve al muelle con sus Mejoras (nunca el Capitán). */
  | { tipo: 'alMuelle' }
  /** No se prepara: en tu próximo Inicio, hasta el final de la misión, hasta que superes otra Prueba o mientras esta carta siga en juego. */
  | { tipo: 'noPrepara'; hasta: 'inicio' | 'finMision' | 'superarPrueba' | 'carta' }
  /** Queda señalado por esta carta (para lo que diga después: «ese Tripulante…»), hasta el final de la misión. */
  | { tipo: 'marcar'; clave: string }
  /** El jugador elige qué le pasa («sufre 2 heridas o queda rehén»). */
  | { tipo: 'elegir'; opciones: { texto: string; accion: AccionSobre }[] }
  /** No puede comprometerse: en esta Prueba o mientras esta carta siga en juego. */
  | { tipo: 'noCompromete'; hasta: 'finPrueba' | 'carta' }
  /** No suma en esta Prueba. */
  | { tipo: 'noSuma' }
  /** Varias cosas al mismo Tripulante («queda Borracho y Aguerrido»). */
  | { tipo: 'varios'; acciones: AccionSobre[] }

/** Lo que una carta puede preguntar a la mesa. */
export type Condicion =
  | { tipo: 'rasgoPreparado'; rasgo: string }
  | { tipo: 'rasgoEnJuego'; rasgo: string }
  | { tipo: 'mejoras'; minimo: number }
  | { tipo: 'heridas'; minimo: number }
  | { tipo: 'municion'; minimo: number }
  | { tipo: 'estado'; estado: EstadoTripulante }
  | { tipo: 'estadoBarco'; estado: EstadoBarco }
  | { tipo: 'no'; condicion: Condicion }
  // Peligros 2.0
  /** Número de Tripulantes comprometidos en la Prueba en curso. */
  | { tipo: 'comprometidos'; minimo?: number; maximo?: number }
  | { tipo: 'comprometidoRasgo'; rasgo: string }
  | { tipo: 'comprometidoEstado'; estado: EstadoTripulante }
  | { tipo: 'comprometidoCapitan' }
  /** Una carta concreta en juego (la Bandera negra, el Amuleto…). */
  | { tipo: 'cartaEnJuego'; id: CartaId }
  | { tipo: 'reputacion'; minimo: number }
  | { tipo: 'danoBarco'; minimo: number }
  | { tipo: 'mano'; minimo: number }
  /** Te quedan al menos N plazas libres de Capacidad. */
  | { tipo: 'plazasLibres'; minimo: number }
  /** Tienes al menos N Tripulantes preparados. */
  | { tipo: 'preparados'; minimo: number }
  /** La Prueba en curso es de esta habilidad. */
  | { tipo: 'hab'; hab: Habilidad }
  | { tipo: 'claves'; claves: string[] }
  | { tipo: 'entorno'; entorno: Entorno }
  | { tipo: 'superadaPor'; minimo: number }
  | { tipo: 'falladaPor'; minimo: number }
  | { tipo: 'todas'; condiciones: Condicion[] }
  | { tipo: 'alguna'; condiciones: Condicion[] }

/** Lo que se cuenta en «por cada». `margen`: puntos por los que superas; `faltan`: los que te faltan. */
export type Medida =
  | 'mejoras'
  | 'mejorasBarco'
  | 'heridas'
  | 'municion'
  | 'tripulantes'
  | 'peligrosEnJuego'
  | 'margen'
  | 'faltan'
  | 'dano'
  | 'mano'
  | 'heridos'
  | 'comprometidos'
  | { rasgo: string }
  | { estado: EstadoTripulante }

function numero(texto: string): number {
  return Number(texto.replace('−', '-').replace('+', ''))
}

/** «La Armada» → «armada»: las cartas de Peligro que entran en el mazo durante la partida. */
function cartaQueEntra(nombre: string): CartaId {
  const carta = DATOS.peligros.find((p) => p.entraDuranteLaPartida && p.nombre.includes(nombre))
  if (!carta) throw new Error(`No hay ninguna carta de Peligro «${nombre}» que entre en el mazo`)
  return carta.id
}

export function interpretarEfectos(texto: string): Efecto[] {
  if (!texto.trim()) return []
  const efectos: Efecto[] = []
  for (const parte of texto.split(' · ').map((p) => p.trim())) {
    const conIcono = /^(\/\s*)?([+−-]?\d+|Todos|−Todo)\s*\[(\w+)\]$/.exec(parte)
    if (conIcono) {
      const [, barra, cantidad = '', icono] = conIcono
      if (barra) {
        // «1 [dano] · / 1 [herida]»: en tierra, la herida sustituye al daño.
        const anterior = efectos[efectos.length - 1]
        if (anterior?.tipo !== 'dano') throw new Error(`Alternativa «/» sin daño delante: ${texto}`)
        anterior.soloEnMar = true
        efectos.push({ tipo: 'heridas', n: numero(cantidad), soloEnTierra: true })
        continue
      }
      const n = cantidad === 'Todos' || cantidad === '−Todo' ? null : numero(cantidad)
      switch (icono) {
        case 'herida':
          efectos.push({ tipo: 'heridas', n: n ?? 0 })
          continue
        case 'dano':
          efectos.push(n !== null && n < 0 ? { tipo: 'reparar', n: -n } : { tipo: 'dano', n: n ?? 0 })
          continue
        case 'agotar':
          efectos.push({ tipo: 'agotar', n: n ?? 'todos' })
          continue
        case 'descartar':
          efectos.push({ tipo: 'descartar', n: n ?? 0 })
          continue
        case 'robar':
          efectos.push({ tipo: 'robar', n: n ?? 0 })
          continue
        case 'curar':
          efectos.push({ tipo: 'curar', n: n ?? 0 })
          continue
        case 'avance':
          efectos.push({ tipo: 'perderAvance', n: n === null ? 'todo' : -n })
          continue
        case 'municion':
          efectos.push({ tipo: 'perderMunicion', n: -(n ?? 0) })
          continue
        case 'mejora':
          // «−1 [mejora]»: pierdes una Mejora. «1 [mejora]» (tachada): agota una Mejora.
          efectos.push(n !== null && n < 0 ? { tipo: 'perderMejora', n: -n } : { tipo: 'agotarMejora' })
          continue
        case 'rehen':
          for (let i = 0; i < (n ?? 1); i++) efectos.push({ tipo: 'rehen' })
          continue
        case 'rep':
          efectos.push({ tipo: 'reputacion', n: n ?? 0 })
          continue
      }
      throw new Error(`Icono de efecto desconocido «${icono}» en: ${texto}`)
    }
    if (parte === 'Capitán') {
      const anterior = efectos[efectos.length - 1]
      if (anterior?.tipo !== 'heridas') throw new Error(`«Capitán» sin heridas delante: ${texto}`)
      anterior.capitan = true
      continue
    }
    if (parte === '−1 Mando') efectos.push({ tipo: 'menosMando' })
    else if (parte === '−1 día') efectos.push({ tipo: 'perderDia' })
    else if (parte === 'Se retira') efectos.push({ tipo: 'seRetira' })
    else if (parte === 'Recluta') efectos.push({ tipo: 'recluta' })
    else if (parte === 'Sin fallo') efectos.push({ tipo: 'sinFallo' })
    else {
      const entra = /^\+ «(.+)»$/.exec(parte)
      if (!entra?.[1]) throw new Error(`Efecto no reconocido «${parte}» en: ${texto}`)
      efectos.push({ tipo: 'entraEnMazo', carta: cartaQueEntra(entra[1]) })
    }
  }
  return efectos
}
