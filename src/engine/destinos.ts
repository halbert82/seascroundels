// Interpreta la franja de Destino de una carta de Peligro: modificador, efecto añadido y Sin oposición.

import { porId } from './catalogo.ts'
import type { DestinoDatos, Habilidad } from './datos.ts'
import { interpretarEfectos, type Efecto } from './efectos.ts'
import type { CartaId } from './tipos.ts'
import { reglasDe, tieneReglas } from './definiciones.ts'

export interface Destino {
  nombre: string
  /** Modificador tal y como se imprime: «+1», «−1», «✕». Se suma al total del jugador: «+1» es bueno, «−1» malo. */
  impreso: string
  /**
   * El modificador en sentido de la dificultad (el impreso con el signo cambiado: «−1» impreso es 1 aquí), o «fallo»
   * (✕: fallas la Prueba). Las reglas de las cartas lo calculan así; la Prueba lo resta del total del jugador.
   */
  modificador: number | 'fallo'
  /** «Si el encuentro es Militar o Guardia, +2 en su lugar». */
  siClave?: { claves: string[]; n: number }
  /** «Si la Prueba es de NAV, +2 en su lugar». */
  siHabilidad?: { hab: Habilidad; n: number }
  heridaComprometido?: number
  heridaMasFuerte?: number
  heridaSiFallas?: number
  avanceSiSuperas?: number
  preparaSiSuperas?: boolean
  sinCanones?: boolean
  sinCartas?: boolean
  /** «Persigue»: después de aplicar el Destino, la carta vuelve encima del mazo de Peligros (siguiente encuentro). */
  persigue?: boolean
  sinOposicion: Efecto[]
}

function numero(texto: string): number {
  return Number(texto.replace('−', '-').replace('+', ''))
}

/** Del modificador impreso («+1» suma al total) al de la dificultad (−1). */
function haciaDificultad(impreso: string): number | 'fallo' {
  if (impreso === '✕') return 'fallo'
  const n = -numero(impreso)
  return n === 0 ? 0 : n
}

export function interpretarDestino(d: DestinoDatos): Destino {
  const destino: Destino = {
    nombre: d.nombre,
    impreso: d.mod,
    modificador: haciaDificultad(d.mod),
    sinOposicion: interpretarEfectos(d.textoSinOposicion),
  }
  let texto = d.texto.trim()
  // «Persigue.» va como frase aparte (sola o junto al resto del texto).
  if (/(^|\s)Persigue\.(\s|$)/.test(texto)) {
    destino.persigue = true
    texto = texto.replace(/(^|\s)Persigue\.(\s|$)/, ' ').trim()
  }
  if (!texto) return destino
  let m: RegExpExecArray | null
  if ((m = /^Si el encuentro es (.+), \{([+−-]?\d+)\} en su lugar\.$/.exec(texto))) {
    const claves = [...(m[1] ?? '').matchAll(/#([^#]+)#/g)].map((x) => x[1] ?? '')
    destino.siClave = { claves, n: numero(m[2] ?? '0') }
  } else if ((m = /^Si la Prueba es de \[(NAV|COM|EXP)\], \{([+−-]?\d+)\} en su lugar\.$/.exec(texto))) {
    destino.siHabilidad = { hab: m[1] as Habilidad, n: numero(m[2] ?? '0') }
  } else if ((m = /^Uno de los Tripulantes comprometidos sufre \{(\d+) herida\}\.$/.exec(texto))) {
    destino.heridaComprometido = Number(m[1])
  } else if ((m = /^El Tripulante comprometido que más sume sufre \{(\d+) herida\}\.$/.exec(texto))) {
    destino.heridaMasFuerte = Number(m[1])
  } else if ((m = /^Si fallas, sufre además \{(\d+) herida\}\.$/.exec(texto))) {
    destino.heridaSiFallas = Number(m[1])
  } else if ((m = /^Si superas la Prueba, gana \{(\d+) avance\} más\.$/.exec(texto))) {
    destino.avanceSiSuperas = Number(m[1])
  } else if (texto === 'Si superas la Prueba, prepara a uno de los Tripulantes comprometidos.') {
    destino.preparaSiSuperas = true
  } else if (texto === 'Los Cañones no suman.') {
    destino.sinCanones = true
  } else if (texto === 'Las cartas de tu mano no suman.') {
    destino.sinCartas = true
  } else if (texto === 'Fallas la Prueba.') {
    if (destino.modificador !== 'fallo') throw new Error(`«Fallas la Prueba» sin ✕: ${d.nombre}`)
  } else {
    throw new Error(`Texto de Destino no reconocido: ${texto}`)
  }
  return destino
}

/** Destino impreso en una carta de Peligro (normal o de mazo propio). */
export function destinoDe(id: CartaId): Destino {
  const e = porId(id)
  if (e.tipo !== 'peligro' && e.tipo !== 'mazoPropio') throw new Error(`${id} no es una carta de Peligro`)
  const d = e.carta.destino
  // Peligros 2.0: el texto es solo para leerlo; lo que hace está en sus reglas.
  if (tieneReglas(id)) {
    const r = reglasDe(id)?.destino
    const destino: Destino = {
      nombre: d.nombre,
      impreso: d.mod,
      modificador: haciaDificultad(d.mod),
      sinOposicion: r?.sinOposicion ?? [],
    }
    if (r?.persigue) destino.persigue = true
    return destino
  }
  return interpretarDestino(d)
}
