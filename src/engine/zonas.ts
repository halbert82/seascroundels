// Zonas de la partida y movimientos de cartas entre ellas.

import { barajarLista } from './azar.ts'
import { copia } from './estado.ts'
import { ZONAS, type CartaId, type Estado, type InstId, type Zona } from './tipos.ts'

/** Zonas en las que una carta está «en juego»: al salir de ellas pierde fichas y estado. */
/** Lo incautado (debajo de la misión) conserva su estado por si se recupera. */
const EN_JUEGO: ReadonlySet<Zona> = new Set<Zona>(['tripulacion', 'mejoras', 'rehenes', 'incautadas'])

/** Crea una copia física de una carta en una zona. */
export function crearCopia(s: Estado, id: CartaId, zona: Zona, donde: 'arriba' | 'abajo' = 'abajo'): InstId {
  const inst: InstId = `i${s.sigInst++}`
  s.cartas[inst] = { id, agotada: false, heridas: 0, avance: 0, vinculadaA: null, entrenamiento: [] }
  if (donde === 'arriba') s.zonas[zona].unshift(inst)
  else s.zonas[zona].push(inst)
  return inst
}

export function zonaDe(s: Estado, inst: InstId): Zona {
  for (const z of ZONAS) if (s.zonas[z].includes(inst)) return z
  throw new Error(`La copia ${inst} no está en ninguna zona`)
}

export function estaEn(s: Estado, inst: InstId, zona: Zona): boolean {
  return s.zonas[zona].includes(inst)
}

/** Mueve una copia a otra zona. Si sale del juego, pierde heridas, fichas y vínculos. */
export function mover(s: Estado, inst: InstId, destino: Zona, donde: 'arriba' | 'abajo' = 'arriba'): void {
  const origen = zonaDe(s, inst)
  s.zonas[origen] = s.zonas[origen].filter((x) => x !== inst)
  const c = copia(s, inst)
  if (EN_JUEGO.has(origen) && !EN_JUEGO.has(destino)) {
    c.agotada = false
    c.heridas = 0
    c.vinculadaA = null
    c.entrenamiento = []
    delete c.estados
  }
  // Una carta de Peligro que deja de estar en juego pierde sus fichas.
  if (origen === 'peligrosEnJuego') delete c.fichas
  if (origen === 'misionesDisponibles' && destino !== 'misionesDisponibles') c.avance = 0
  if (donde === 'arriba') s.zonas[destino].unshift(inst)
  else s.zonas[destino].push(inst)
}

/** Baraja una zona. Cuenta como información nueva (no se puede deshacer). */
export function barajar(s: Estado, zona: Zona): void {
  barajarLista(s, s.zonas[zona])
  s.infoRevelada++
}

/** Pasa toda una pila de descartes a su mazo y lo baraja. */
export function rebarajar(s: Estado, descartes: Zona, mazo: Zona): void {
  for (const inst of [...s.zonas[descartes]]) mover(s, inst, mazo, 'abajo')
  barajar(s, mazo)
}

/** Mueve una copia a una posición concreta de otra zona (0 = arriba o a la izquierda). */
export function moverA(s: Estado, inst: InstId, destino: Zona, indice: number): void {
  mover(s, inst, destino, 'abajo')
  const lista = s.zonas[destino].filter((x) => x !== inst)
  lista.splice(Math.max(0, Math.min(indice, lista.length)), 0, inst)
  s.zonas[destino] = lista
}

export function arriba(s: Estado, zona: Zona): InstId | undefined {
  return s.zonas[zona][0]
}

/** Mejoras (y Tesoros) vinculados al Barco o a un Tripulante. */
export function vinculadas(s: Estado, portador: InstId | 'barco'): InstId[] {
  return s.zonas.mejoras.filter((m) => copia(s, m).vinculadaA === portador)
}
