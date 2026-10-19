// Guardar y recuperar una partida como texto (para el navegador).

import { esCarta } from './catalogo.ts'
import { ZONAS, type Estado } from './tipos.ts'

export const CLAVE_GUARDADO = 'sea-scoundrels/partida'

export function serializar(s: Estado): string {
  return JSON.stringify(s)
}

/**
 * Fase 8: las cartas de Escenario que salen dejan su número de colección a las nuevas, así que una partida guardada
 * antes del cambio las recibe en su lugar. Las fichas de Ventaja del ladrón pasan a llamarse de Ladrón.
 */
const ESCENARIO_RENOMBRADO: Record<string, string> = { calma_ev: 'sanjuan', noticias: 'cuarentena', astillero: 'armada_patrulla' }

function migrar(s: Estado): void {
  for (const c of Object.values(s.cartas ?? {})) {
    const nuevo = ESCENARIO_RENOMBRADO[c.id]
    if (nuevo) c.id = nuevo
  }
  // Fase 10b: fuera Aturdido, Encadenado e Incendio a bordo.
  const fuera = new Set(['aturdido', 'encadenado', 'incendio'])
  for (const c of Object.values(s.cartas ?? {})) {
    if (!c.estados) continue
    c.estados = c.estados.filter((e) => !fuera.has(e))
    if (c.estados.length === 0) delete c.estados
  }
  if (s.estadosBarco) {
    s.estadosBarco = s.estadosBarco.filter((e) => !fuera.has(e))
    if (s.estadosBarco.length === 0) delete s.estadosBarco
  }
  const fichas = s.mision?.fichas as Record<string, number> | undefined
  if (fichas && 'ventaja' in fichas) {
    fichas.ladron = fichas.ventaja ?? 0
    delete fichas.ventaja
  }
}

/**
 * Recupera una partida guardada. Si es de una versión anterior del juego (le falta alguna zona o tiene cartas que ya no
 * existen, como los capítulos antiguos de las misiones), no se puede continuar.
 */
export function deserializar(texto: string): Estado {
  const datos: unknown = JSON.parse(texto)
  const anterior = () => new Error('La partida guardada no es de esta versión del juego')
  if (typeof datos !== 'object' || datos === null || (datos as { version?: unknown }).version !== 1) throw anterior()
  const s = datos as Estado
  if (!s.zonas || ZONAS.some((z) => !Array.isArray(s.zonas[z]))) throw anterior()
  migrar(s)
  if (Object.values(s.cartas ?? {}).some((c) => !esCarta(c.id))) throw anterior()
  return s
}
