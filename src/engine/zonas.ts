// Zonas de la partida y movimientos de cartas entre ellas.

import { barajarLista } from './azar.ts'
import { DATOS } from './datos.ts'
import { copia } from './estado.ts'
import { ZONAS, type CartaId, type Estado, type InstId, type Zona } from './tipos.ts'

/** Zonas en las que una carta está «en juego»: al salir de ellas pierde fichas y estado. */
/** Lo incautado (debajo de la misión) conserva su estado por si se recupera. */
const EN_JUEGO: ReadonlySet<Zona> = new Set<Zona>(['tripulacion', 'mejoras', 'incautadas'])

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

/**
 * Fase 15: las Mejoras que no son del jugador, sino del mazo de una misión (la culebrina del naufragio). Si se descartan,
 * no van a ningún mazo de descartes: vuelven al mazo de historia, como los Tesoros.
 * TODO(regla) P108: lo que pasa si se pierde la culebrina (por defecto, como un Tesoro).
 */
const MEJORAS_DE_MISION: ReadonlySet<CartaId> = new Set(DATOS.mejorasBarco.filter((m) => m.mision !== undefined).map((m) => m.id))

/** Mueve una copia a otra zona. Si sale del juego, pierde heridas, fichas y vínculos. */
export function mover(s: Estado, inst: InstId, destinoPedido: Zona, donde: 'arriba' | 'abajo' = 'arriba'): void {
  const origen = zonaDe(s, inst)
  const aDescartes = destinoPedido === 'descartesMuelle' || destinoPedido === 'descartesCapitan'
  const destino: Zona = aDescartes && MEJORAS_DE_MISION.has(copia(s, inst).id) ? 'mazoHistoria' : destinoPedido
  s.zonas[origen] = s.zonas[origen].filter((x) => x !== inst)
  const c = copia(s, inst)
  if (EN_JUEGO.has(origen) && !EN_JUEGO.has(destino)) {
    c.agotada = false
    c.heridas = 0
    c.vinculadaA = null
    c.entrenamiento = []
    delete c.estados
  }
  // Una permanente que deja la zona de permanentes pierde sus fichas y ya no va junto a nadie.
  if (origen === 'permanentes' && destino !== 'permanentes') {
    // Fase 15: el daño de una permanente con Vida (Galeón San Telmo, Murallas, El prisionero) también se quita.
    c.heridas = 0
    delete c.fichas
    delete c.junto
    delete c.origen
  }
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
