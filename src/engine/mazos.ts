// Reglas para construir los mazos del jugador (reglamento, «Construir tu mazo»).

import { esUnica, nombreDe, porId } from './catalogo.ts'
import type { CartaId } from './tipos.ts'

export interface MazosJugador {
  capitan: CartaId
  mazoDelCapitan: CartaId[]
  mazoDeMuelle: CartaId[]
}

export const LIMITES = {
  muelle: { min: 15, max: 20 },
  capitan: { min: 30, max: 40 },
  copias: 3,
  copiasUnica: 1,
} as const

/** Clase de una carta del jugador: la de su Capitán o «Neutral». Las cartas sin Clase impresa cuentan como Neutrales. */
function claseDe(id: CartaId): string {
  const e = porId(id)
  if (e.tipo === 'tripulante') return e.carta.senda
  if (e.tipo === 'capitan') return 'Piratería' // Los dos Capitanes de la Caja básica son de Piratería.
  return 'Neutral'
}

/** Lista de incumplimientos de las reglas de construcción (vacía si los mazos son legales). */
export function erroresDeMazos(m: MazosJugador): string[] {
  const errores: string[] = []
  const { muelle, capitan } = LIMITES
  if (m.mazoDeMuelle.length < muelle.min || m.mazoDeMuelle.length > muelle.max) {
    errores.push(`El mazo de muelle tiene ${m.mazoDeMuelle.length} cartas; debe tener de ${muelle.min} a ${muelle.max}.`)
  }
  if (m.mazoDelCapitan.length < capitan.min || m.mazoDelCapitan.length > capitan.max) {
    errores.push(`El mazo del capitán tiene ${m.mazoDelCapitan.length} cartas; debe tener de ${capitan.min} a ${capitan.max}.`)
  }
  for (const id of m.mazoDeMuelle) {
    const tipo = porId(id).tipo
    if (tipo !== 'tripulante' && tipo !== 'mejoraBarco' && tipo !== 'mejoraTripulante') {
      errores.push(`«${nombreDe(id)}» no puede ir en el mazo de muelle (solo Tripulantes y Mejoras).`)
    }
  }
  for (const id of m.mazoDelCapitan) {
    const tipo = porId(id).tipo
    if (tipo !== 'evento' && tipo !== 'habilidad') {
      errores.push(`«${nombreDe(id)}» no puede ir en el mazo del capitán (solo Eventos y Habilidades).`)
    }
  }
  const claseCapitan = claseDe(m.capitan)
  const cuenta = new Map<string, number>()
  for (const id of [...m.mazoDeMuelle, ...m.mazoDelCapitan]) {
    const clase = claseDe(id)
    if (clase !== 'Neutral' && clase !== claseCapitan) {
      errores.push(`«${nombreDe(id)}» es de la Clase ${clase} y tu Capitán es de ${claseCapitan}.`)
    }
    const nombre = nombreDe(id)
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1)
  }
  for (const [nombre, n] of cuenta) {
    const id = [...m.mazoDeMuelle, ...m.mazoDelCapitan].find((x) => nombreDe(x) === nombre) ?? ''
    const maximo = esUnica(id) ? LIMITES.copiasUnica : LIMITES.copias
    if (n > maximo) errores.push(`Hay ${n} copias de «${nombre}»; el máximo es ${maximo}.`)
  }
  return errores
}
