// Reglas de las misiones, interpretadas desde su texto impreso. Funcionan mientras la misión está en curso.

import { CATALOGO, porId } from '../catalogo.ts'
import type { Habilidad } from '../datos.ts'
import type { Capacidad, CartaId, NuevaTarea } from '../tipos.ts'
import { estaEn } from '../zonas.ts'

function numero(texto: string): number {
  return Number(texto.replace('−', '-').replace('+', ''))
}

function claves(texto: string): string[] {
  return [...texto.matchAll(/#([^#]+)#/g)].map((m) => m[1] ?? '')
}

/** Convierte una regla impresa de misión en una capacidad. Lanza un error si no la entiende. */
export function interpretarRegla(mision: CartaId, indice: number, texto: string): Capacidad | null {
  const clave = `${mision}.${indice}`
  const base = { clave, carta: mision, desde: 'mision' as const }
  const alZarpar = (efecto: () => NuevaTarea[]): Capacidad => ({ ...base, ventana: 'alZarpar', efecto: () => efecto() })
  const constante = (modifica: NonNullable<Capacidad['modifica']>): Capacidad => ({ ...base, ventana: 'constante', modifica })
  let m: RegExpExecArray | null

  if ((m = /^\*\*Al zarpar:\*\* Si tienes un _(.+)_ preparado, gana \{(\d+) avance\}\.$/.exec(texto))) {
    const [, rasgo = '', n = '0'] = m
    return alZarpar(() => [{ tipo: 'ganarAvance', n: Number(n), si: { rasgo } }])
  }
  if ((m = /^\*\*Al zarpar:\*\* Si tienes (\d+) o más Tripulantes preparados, gana \{(\d+) avance\}\.$/.exec(texto))) {
    const [, preparados = '0', n = '0'] = m
    return alZarpar(() => [{ tipo: 'ganarAvance', n: Number(n), si: { preparados: Number(preparados) } }])
  }
  if ((m = /^\*\*Al zarpar:\*\* Agota a un _(.+)_ para ganar \{(\d+) avance\}\.$/.exec(texto))) {
    const [, rasgo = '', n = '0'] = m
    return alZarpar(() => [{ tipo: 'alZarparOpcional', coste: { tipo: 'agotarRasgo', rasgo }, n: Number(n) }])
  }
  if ((m = /^\*\*Al zarpar:\*\* Descarta (\d+) cartas para ganar \{(\d+) avance\}\.$/.exec(texto))) {
    const [, cartas = '0', n = '0'] = m
    return alZarpar(() => [{ tipo: 'alZarparOpcional', coste: { tipo: 'descartar', n: Number(cartas) }, n: Number(n) }])
  }
  if ((m = /^\*\*Al zarpar:\*\* Baraja el mazo de(?:l| la) .+ con (\d+) cartas del mazo de Peligros\. Durante esta misión, revela de ese mazo\.$/.exec(texto))) {
    const n = Number(m[1])
    return alZarpar(() => [{ tipo: 'mezclarMazoPropio', n }])
  }
  if ((m = /^Tus Tripulantes reciben \{([+−-]\d+) (NAV|COM|EXP)\}\.$/.exec(texto))) {
    const n = numero(m[1] ?? '0')
    const hab = m[2] as Habilidad
    return constante((ctx, _yo, c) => (c.tipo === 'habilidad' && c.hab === hab && estaEn(ctx.s, c.carta, 'tripulacion') ? n : 0))
  }
  if ((m = /^Cada efecto de fallo inflige además \{(\d+) herida\}\.$/.exec(texto))) {
    const n = Number(m[1])
    return constante((_ctx, _yo, c) => (c.tipo === 'heridaExtraFallo' ? n : 0))
  }
  if ((m = /^Los encuentros (.+) reciben \{([+−-]\d+)(?: [gr])?\} de dificultad\.$/.exec(texto))) {
    const afectadas = claves(m[1] ?? '')
    const n = numero(m[2] ?? '0')
    return constante((_ctx, _yo, c) => (c.tipo === 'dificultad' && c.claves.some((k) => afectadas.includes(k)) ? n : 0))
  }
  if ((m = /^Las Pruebas de \[(NAV|COM|EXP)\] reciben \{([+−-]\d+)(?: [gr])?\} de dificultad\.$/.exec(texto))) {
    const hab = m[1] as Habilidad
    const n = numero(m[2] ?? '0')
    return constante((_ctx, _yo, c) => (c.tipo === 'dificultad' && c.hab === hab ? n : 0))
  }
  if ((m = /^Todas las Pruebas reciben \{([+−-]\d+)(?: [gr])?\} de dificultad\.$/.exec(texto))) {
    const n = numero(m[1] ?? '0')
    return constante((_ctx, _yo, c) => (c.tipo === 'dificultad' ? n : 0))
  }
  if ((m = /^Cada vez que superes una Prueba de \[(NAV|COM|EXP)\], gana \{(\d+) avance\} más\.$/.exec(texto))) {
    const hab = m[1] as Habilidad
    const n = Number(m[2])
    return constante((_ctx, _yo, c) => (c.tipo === 'avanceExtraPrueba' && c.hab === hab ? n : 0))
  }
  if (texto === 'Los Cañones no suman.') return constante((_ctx, _yo, c) => (c.tipo === 'sinCanones' ? 1 : 0))
  // «Solo puedes zarpar a esta misión si tienes {9 rep} o más.»: lo lee reputacionMinima().
  if (/^Solo puedes zarpar a esta misión si tienes \{\d+ rep\} o más\.$/.test(texto)) return null
  throw new Error(`Regla de misión no reconocida (${mision}): ${texto}`)
}

/** Reputación necesaria para zarpar a una misión (0 si no pide ninguna). */
export function reputacionMinima(mision: CartaId): number {
  const e = porId(mision)
  if (e.tipo !== 'capitulo') return 0
  for (const regla of e.carta.reglas) {
    const m = /^Solo puedes zarpar a esta misión si tienes \{(\d+) rep\} o más\.$/.exec(regla)
    if (m) return Number(m[1])
  }
  return 0
}

export const CAPACIDADES_MISIONES: Capacidad[] = CATALOGO.flatMap((e) =>
  e.tipo === 'capitulo' ? e.carta.reglas.map((r, i) => interpretarRegla(e.id, i, r)).filter((c): c is Capacidad => c !== null) : [],
)
