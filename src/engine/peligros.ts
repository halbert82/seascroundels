// Mazo de Peligros activo (el normal o el mezclado de una misión), encuentros y descartes.

import { porId, tipoDe } from './catalogo.ts'
import type { EncuentroDatos, Entorno } from './datos.ts'
import { anotar, copia } from './estado.ts'
import type { Estado, InstId, Zona } from './tipos.ts'
import { arriba, mover, rebarajar } from './zonas.ts'

export function mazoActivo(s: Estado): { mazo: Zona; descartes: Zona } {
  return s.mision?.mazoMezclado ? { mazo: 'mazoMision', descartes: 'descartesMision' } : { mazo: 'mazoPeligros', descartes: 'descartesPeligros' }
}

/** Entorno de la misión en curso. */
export function entornoActual(s: Estado): Entorno | null {
  if (!s.mision) return null
  const e = porId(copia(s, s.mision.carta).id)
  return e.tipo === 'capitulo' ? e.carta.entorno : null
}

/**
 * Carta de arriba del mazo activo, para revelarla. Si se acaba, se baraja su pila de descartes
 * (en una misión con mazo mezclado, solo los descartes de esa misión: D10).
 */
export function cartaDeArriba(s: Estado): InstId | null {
  const { mazo, descartes } = mazoActivo(s)
  if (s.zonas[mazo].length === 0 && s.zonas[descartes].length > 0) {
    rebarajar(s, descartes, mazo)
    anotar(
      s,
      'aviso',
      mazo === 'mazoMision' ? 'Se acaba el mazo de la misión: se barajan sus descartes.' : 'Se acaba el mazo de Peligros: se baraja su pila de descartes.',
      mazo === 'mazoMision' ? { tipo: 'mazoMisionBarajado' } : undefined,
    )
  }
  return arriba(s, mazo) ?? null
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

/** Al terminar una misión: el mazo propio vuelve al mazo de historia y el resto de Peligros a su pila de descartes. */
export function devolverPeligros(s: Estado): void {
  const zonas: Zona[] = ['encuentro', 'destino', 'mazoMision', 'descartesMision']
  for (const zona of zonas) {
    for (const carta of [...s.zonas[zona]]) {
      if (s.mision?.retirar.includes(carta)) mover(s, carta, 'fueraDeJuego')
      else if (tipoDe(copia(s, carta).id) === 'mazoPropio') mover(s, carta, 'mazoHistoria', 'abajo')
      else mover(s, carta, 'descartesPeligros')
    }
  }
}
