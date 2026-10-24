// Fase 16 (corrección de Albert: la caja trae fichas) · cuántas fichas hacen falta en la caja:
// `MEDIR_FICHAS=1 npx vitest run src/engine/medir-fichas.informe.test.ts` (con MEDIR_SALIDA=fichero.json, lo escribe ahí).
// Juega las mismas partidas que el informe (semillas 1–N, mazos de inicio, el jugador con criterio, partida normal) y,
// después de cada paso, cuenta las fichas que hay a la vez en la mesa de cada clase. Por partida guarda el máximo; al final
// da, por clase, el máximo de todas las partidas, el que basta en el 99 % y en el 50 %.
//   - herida: las de todos los Tripulantes (el Capitán incluido), sin pasar de la Vida de cada uno; aparte, las de los
//     Pasajeros y las de «El prisionero» (la única permanente que recibe heridas).
//   - daño: el del Barco, sin pasar de su Daño máximo; aparte, el de las permanentes con Vida que reciben daño (Galeón San
//     Telmo, Murallas de Port Royal).
//   - Avance: el de todas las misiones (la de curso y las disponibles), cada una hasta lo que pide.
//   - Entrenamiento: las de todos los Tripulantes.
//   - genéricas: los contadores de la misión en curso, los de las permanentes y los Tesoros, y las de Enrolado, juntos.
//   El Rival se cuenta hasta 8: «Con 8 o más fichas de Rival…» (la regata sigue poniendo 2 por Peligro, pero a partir de 8
//   ya no cambia nada); `rivalSinTope` lo cuenta entero. Con MEDIR_FICHAS_PUERTO=nassau se juega en Nassau (su opción
//   propia es el Entrenamiento; el jugador automático juega siempre en Tortuga).
// Para las preguntas P114 y P115: herida y daño a la vez (si fueran la misma ficha) y genéricas y Entrenamiento a la vez
// (si el Entrenamiento fuera una ficha genérica).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import type { Estado, InstId } from './tipos.ts'
import { valor } from './valores.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

const CLASES = [
  'herida',
  'heridaConOtros',
  'dano',
  'danoConPermanentes',
  'heridaYDano',
  'avance',
  'entrenamiento',
  'genericas',
  'contadores',
  'enrolado',
  'genericasYEntrenamiento',
  'total',
  'rivalSinTope',
] as const
type Clase = (typeof CLASES)[number]
type Cuenta = Record<Clase, number>

const cero = (): Cuenta => Object.fromEntries(CLASES.map((c) => [c, 0])) as Cuenta

/** Lo más alto que llega cada contador (por su ficha de misión o por la carta que lo lleva), en todas las partidas. */
const porClase: Record<string, number> = {}

/** Fichas de cada clase que hay ahora en la mesa. */
function contar(s: Estado): Cuenta {
  const n = cero()
  const c = (i: InstId) => s.cartas[i]
  for (const i of s.zonas.tripulacion) {
    const t = c(i)
    if (!t) continue
    n.herida += Math.min(t.heridas, Math.max(0, valor(s, { tipo: 'vida', carta: i })))
    n.entrenamiento += t.entrenamiento.length
    n.enrolado += t.enrolado ?? 0
  }
  let heridasOtros = 0
  for (const i of s.zonas.pasajeros) heridasOtros += c(i)?.heridas ?? 0
  let danoPermanentes = 0
  for (const i of s.zonas.permanentes) {
    const p = c(i)
    if (!p) continue
    const e = porId(p.id)
    if (e.tipo === 'permanente' && e.carta.vida !== undefined) {
      const h = Math.min(p.heridas, e.carta.vida)
      if (p.id === 'pm_prisionero') heridasOtros += h
      else danoPermanentes += h
    }
    n.contadores += p.fichas ?? 0
    if (p.fichas) porClase[p.id] = Math.max(porClase[p.id] ?? 0, p.fichas)
  }
  for (const i of s.zonas.mejoras) {
    const m = c(i)
    if (m && porId(m.id).tipo === 'tesoro' && m.fichas) {
      n.contadores += m.fichas
      porClase[m.id] = Math.max(porClase[m.id] ?? 0, m.fichas)
    }
  }
  for (const [f, v] of Object.entries(s.mision?.fichas ?? {})) {
    n.contadores += f === 'rival' ? Math.min(v ?? 0, 8) : (v ?? 0)
    if (f === 'rival') n.rivalSinTope = v ?? 0
    porClase[f] = Math.max(porClase[f] ?? 0, v ?? 0)
  }
  n.dano = Math.min(s.danoBarco, valor(s, { tipo: 'danoMaximo' }))
  for (const i of s.zonas.misionesDisponibles) {
    const m = c(i)
    if (!m || m.avance <= 0) continue
    n.avance += Math.min(m.avance, valor(s, { tipo: 'avanceNecesario', mision: i }))
  }
  n.heridaConOtros = n.herida + heridasOtros
  n.danoConPermanentes = n.dano + danoPermanentes
  n.genericas = n.contadores + n.enrolado
  n.heridaYDano = n.heridaConOtros + n.danoConPermanentes
  n.genericasYEntrenamiento = n.genericas + n.entrenamiento
  n.total = n.heridaConOtros + n.danoConPermanentes + n.avance + n.entrenamiento + n.genericas
  return n
}

/** El valor que no pasan el `p` por ciento de las partidas. */
function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)] ?? 0
}

it.runIf(process.env.MEDIR_FICHAS)(`fase 16: fichas que hacen falta en la caja (${PARTIDAS} partidas normales)`, { timeout: 3_600_000 }, () => {
  if (process.env.MEDIR_FICHAS_PUERTO) DATOS.mazosPredefinidos.puertoInicial = process.env.MEDIR_FICHAS_PUERTO
  const jugador = jugadorConCriterio()
  const maximos: Cuenta[] = []
  // Dónde se alcanza el máximo de cada clase (para saber de qué viene).
  const ejemplo: Partial<Record<Clase, { semilla: number; turno: number; n: number; mision: string | null }>> = {}
  for (let semilla = 1; semilla <= PARTIDAS; semilla++) {
    const max = cero()
    jugarPartida(semilla, jugador, {
      alPaso: (s) => {
        const n = contar(s)
        for (const k of CLASES) {
          if (n[k] <= max[k]) continue
          max[k] = n[k]
          if (n[k] > (ejemplo[k]?.n ?? -1)) ejemplo[k] = { semilla, turno: s.turno, n: n[k], mision: s.mision ? (s.cartas[s.mision.carta]?.id ?? null) : null }
        }
      },
    })
    maximos.push(max)
  }
  const resumen = Object.fromEntries(
    CLASES.map((k) => {
      const v = maximos.map((m) => m[k])
      return [k, { maximo: Math.max(...v), p99: percentil(v, 99), p95: percentil(v, 95), p50: percentil(v, 50), ejemplo: ejemplo[k] }]
    }),
  )
  const salida = JSON.stringify({ partidas: PARTIDAS, puerto: DATOS.mazosPredefinidos.puertoInicial, resumen, porClase }, null, 2)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, salida)
  else console.log(salida)
})
