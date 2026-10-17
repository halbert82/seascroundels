// Registro de capacidades por carta. Cada carta tiene sus entradas con su ventana
// (constante, al revelarse, Acción, sin etiqueta, Respuesta, Interrupción, Obligada, Al zarpar).

import type { Capacidad, CartaId } from '../tipos.ts'
import { CAPACIDADES_CONSTANTES } from './constantes.ts'
import { CAPACIDADES_ESCENARIO } from './escenario.ts'
import { CAPACIDADES_ESTADOS } from './estados.ts'
import { CAPACIDADES_EVENTOS } from './eventos.ts'
import { CAPACIDADES_JUGADOR2 } from './jugador2.ts'
import { CAPACIDADES_MEJORAS } from './mejoras.ts'
import { CAPACIDADES_MISIONES } from './misiones.ts'
import { CAPACIDADES_TRIPULANTES } from './tripulantes.ts'

const POR_CARTA = new Map<CartaId, Capacidad[]>()
const POR_CLAVE = new Map<string, Capacidad>()

function registrar(cap: Capacidad): void {
  if (POR_CLAVE.has(cap.clave)) throw new Error(`Capacidad repetida: ${cap.clave}`)
  POR_CLAVE.set(cap.clave, cap)
  POR_CARTA.set(cap.carta, [...(POR_CARTA.get(cap.carta) ?? []), cap])
}

for (const cap of [
  ...CAPACIDADES_CONSTANTES,
  ...CAPACIDADES_ESCENARIO,
  ...CAPACIDADES_MISIONES,
  ...CAPACIDADES_TRIPULANTES,
  ...CAPACIDADES_MEJORAS,
  ...CAPACIDADES_EVENTOS,
  ...CAPACIDADES_ESTADOS,
  ...CAPACIDADES_JUGADOR2,
]) {
  registrar(cap)
}

/** Capacidades de una carta del catálogo. */
export function capacidadesDe(id: CartaId): readonly Capacidad[] {
  return POR_CARTA.get(id) ?? []
}

export function capacidadPorClave(clave: string): Capacidad | undefined {
  return POR_CLAVE.get(clave)
}

/** Registra capacidades nuevas (las que salen de las reglas de las cartas de Peligro nuevas). */
export function registrarCapacidades(...caps: Capacidad[]): void {
  for (const cap of caps) registrar(cap)
}

/** Quita todas las capacidades de una carta (para volver a registrarla). */
export function quitarCapacidadesDe(id: CartaId): void {
  for (const cap of POR_CARTA.get(id) ?? []) POR_CLAVE.delete(cap.clave)
  POR_CARTA.delete(id)
}

/** Solo para pruebas: registra capacidades de mentira y devuelve cómo quitarlas. */
export function registrarParaPruebas(...caps: Capacidad[]): () => void {
  for (const cap of caps) registrar(cap)
  return () => {
    for (const cap of caps) {
      POR_CLAVE.delete(cap.clave)
      POR_CARTA.set(
        cap.carta,
        (POR_CARTA.get(cap.carta) ?? []).filter((c) => c.clave !== cap.clave),
      )
    }
  }
}
