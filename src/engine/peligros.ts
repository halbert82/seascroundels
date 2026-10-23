// Mazo de Peligros activo (el normal o el mezclado de una misión), encuentros y descartes.

import { costeImpreso, porId, tipoDe } from './catalogo.ts'
import type { EncuentroDatos, Entorno } from './datos.ts'
import { quedaDe } from './definiciones.ts'
import { anotar, copia, encolar } from './estado.ts'
import type { Estado, InstId, Zona } from './tipos.ts'
import { mover, moverA, rebarajar } from './zonas.ts'

export function mazoActivo(s: Estado): { mazo: Zona; descartes: Zona } {
  return s.mision?.mazoMezclado ? { mazo: 'mazoMision', descartes: 'descartesMision' } : { mazo: 'mazoPeligros', descartes: 'descartesPeligros' }
}

/** Entorno de la misión en curso. */
export function entornoActual(s: Estado): Entorno | null {
  if (!s.mision) return null
  const e = porId(copia(s, s.mision.carta).id)
  return e.tipo === 'capitulo' ? e.carta.entorno : null
}

/** La carta que «persigue», si sigue esperando en un mazo de Peligros para ser el siguiente encuentro. */
export function persigueVigente(s: Estado): InstId | null {
  const p = s.persigue
  if (!p) return null
  if (s.zonas.mazoPeligros.includes(p) || s.zonas.mazoMision.includes(p)) return p
  s.persigue = null
  return null
}

/**
 * Carta de arriba del mazo activo, para revelarla. Si se acaba, se baraja su pila de descartes
 * (en una misión con mazo mezclado, solo los descartes de esa misión: D10).
 * Una carta que «persigue» es siempre el siguiente encuentro, y nunca sale como Destino.
 */
export function cartaDeArriba(s: Estado, para: 'encuentro' | 'destino' = 'encuentro'): InstId | null {
  const persigue = persigueVigente(s)
  if (para === 'encuentro' && persigue) return persigue
  const { mazo, descartes } = mazoActivo(s)
  const disponibles = () => s.zonas[mazo].filter((c) => c !== persigue)
  if (disponibles().length === 0 && s.zonas[descartes].length > 0) {
    rebarajar(s, descartes, mazo)
    anotar(
      s,
      'aviso',
      mazo === 'mazoMision' ? 'Se acaba el mazo de la misión: se barajan sus descartes.' : 'Se acaba el mazo de Peligros: se baraja su pila de descartes.',
      mazo === 'mazoMision' ? { tipo: 'mazoMisionBarajado' } : undefined,
    )
  }
  return disponibles()[0] ?? null
}

/** El encuentro que se lee: el del Entorno de la misión, o el único de una carta de mazo propio. */
export function encuentroDe(s: Estado, carta: InstId): EncuentroDatos {
  const e = porId(copia(s, carta).id)
  if (e.tipo === 'mazoPropio') return e.carta.encuentro
  if (e.tipo !== 'peligro') throw new Error(`${e.id} no es una carta de Peligro`)
  const entorno = entornoActual(s)
  if (!entorno) throw new Error('No hay ninguna misión en curso')
  return e.carta.encuentros[entorno]
}

/** Descarta una carta de Peligro revelada en la misión: a sus descartes, o fuera del juego si «se retira». */
export function descartarPeligro(s: Estado, carta: InstId): void {
  if (s.mision?.retirar.includes(carta)) {
    mover(s, carta, 'fueraDeJuego')
    anotar(s, 'efecto', `«${porId(copia(s, carta).id).carta.nombre}» se retira del juego.`, { tipo: 'seRetira', carta: copia(s, carta).id })
    return
  }
  mover(s, carta, mazoActivo(s).descartes)
}

/** La carta que persigue se pone encima del mazo de Peligros (el activo): será el siguiente encuentro. */
export function ponerAPerseguir(s: Estado, carta: InstId): void {
  mover(s, carta, mazoActivo(s).mazo, 'arriba')
  s.persigue = carta
  anotar(s, 'aviso', `«${porId(copia(s, carta).id).carta.nombre}» te persigue: será el siguiente encuentro.`)
}

/**
 * Termina la Prueba en curso: los Destinos revelados se descartan (salvo el que persigue, que vuelve encima del
 * mazo) y caducan los efectos «para esta Prueba».
 */
export function cerrarPrueba(s: Estado, conservar: readonly InstId[] = []): void {
  const p = s.prueba
  // `conservar` (fase 14): los Destinos de una Prueba apartada mientras se hace otra («¡A por ellos!») se quedan.
  for (const d of s.zonas.destino.filter((c) => !conservar.includes(c))) {
    // «Persigue»: pasa por su suceso (una Interrupción puede mandarla al fondo del mazo).
    // Fase 13: con dos Destinos, el segundo también puede perseguir. P84 (Albert): si persiguen los dos, vuelven los dos
    // encima del mazo y el segundo queda arriba (solo el último cuenta como «el que persigue»).
    const persigue = p?.persigue && p.destino === d && !p.destinoCancelado
    const persigueSegundo = p?.segundoPersigue && p.segundoDestino === d && !p.segundoCancelado
    if (persigue || persigueSegundo) {
      encolar(s, { tipo: 'evento', ev: { tipo: 'persigue', carta: d }, fase: 'antes', cancelado: false, usadas: [] })
    } else descartarPeligro(s, d)
  }
  s.temporales = s.temporales.filter((x) => x.hasta !== 'finPrueba')
  s.prueba = null
}

/**
 * La carta de Peligro ocupa el muelle: sustituye a la carta de coste más alto (si empatan, la de más a la
 * izquierda), que se descarta. Se quita pagando `coste` cartas en Jugar cartas.
 */
export function ponerEnMuelle(s: Estado, carta: InstId, coste: number): void {
  const muelle = s.zonas.muelle
  let indice = -1
  let maximo = -1
  muelle.forEach((c, i) => {
    if (s.peligrosEnMuelle?.[c] !== undefined) return
    const n = costeImpreso(copia(s, c).id)
    if (n > maximo) {
      maximo = n
      indice = i
    }
  })
  const sustituida = indice >= 0 ? muelle[indice] : undefined
  if (sustituida) mover(s, sustituida, 'descartesMuelle')
  moverA(s, carta, 'muelle', indice >= 0 ? indice : muelle.length)
  s.peligrosEnMuelle = { ...(s.peligrosEnMuelle ?? {}), [carta]: coste }
  const nombreCarta = porId(copia(s, carta).id).carta.nombre
  anotar(s, 'aviso', `«${nombreCarta}» ocupa el muelle${sustituida ? ` en lugar de «${porId(copia(s, sustituida).id).carta.nombre}», que se descarta` : ''}.`)
}

/** Peligros que ocupan el muelle. */
export function peligrosDelMuelle(s: Estado): InstId[] {
  return s.zonas.muelle.filter((c) => s.peligrosEnMuelle?.[c] !== undefined)
}

/**
 * Al terminar una misión: el mazo propio vuelve al mazo de historia y el resto de Peligros a su pila de descartes. Las
 * permanentes vuelven al mazo de historia (fase 11). La carta que persigue se queda encima del mazo de Peligros normal.
 */
export function devolverPeligros(s: Estado): void {
  const p = s.prueba
  if (p?.persigue && p.destino && !p.destinoCancelado && s.zonas.destino.includes(p.destino)) {
    // Si la misión termina, la carta que persigue se queda encima del mazo de Peligros (normal) y sale en la siguiente.
    mover(s, p.destino, 'mazoPeligros', 'arriba')
    s.persigue = p.destino
  }
  if (p?.segundoPersigue && p.segundoDestino && !p.segundoCancelado && s.zonas.destino.includes(p.segundoDestino)) {
    mover(s, p.segundoDestino, 'mazoPeligros', 'arriba')
    s.persigue = p.segundoDestino
  }
  const persigue = persigueVigente(s)
  if (persigue && s.zonas.mazoMision.includes(persigue)) mover(s, persigue, 'mazoPeligros', 'arriba')
  // Fase 15: las que dicen que se quedan («Mala fama», las Murallas de Port Royal) siguen en juego.
  for (const carta of [...s.zonas.permanentes]) if (!quedaDe(s, carta)?.seQueda) mover(s, carta, 'mazoHistoria', 'abajo')
  const zonas: Zona[] = ['encuentro', 'destino', 'mazoMision', 'descartesMision']
  for (const zona of zonas) {
    for (const carta of [...s.zonas[zona]]) {
      if (s.mision?.retirar.includes(carta)) mover(s, carta, 'fueraDeJuego')
      else if (tipoDe(copia(s, carta).id) === 'mazoPropio') mover(s, carta, 'mazoHistoria', 'abajo')
      else mover(s, carta, 'descartesPeligros')
    }
  }
}
