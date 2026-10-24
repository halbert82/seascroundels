// Fase 16 (decisión de Albert: la reputación se lleva con fichas de reputación) · cuántas fichas de reputación lleva la caja:
// `MEDIR_REPUTACION=1 npx vitest run src/engine/medir-reputacion.informe.test.ts` (con MEDIR_SALIDA=fichero.json, lo escribe ahí).
// Juega las mismas partidas que el informe (semillas 1–N, mazos de inicio, el jugador con criterio), en la partida normal y
// en la larga, y mira la reputación después de cada paso. Por partida guarda la más alta que llega a tener (contando lo que
// se pasa de la meta con la última recompensa: «Has llegado a 14 de reputación» con una meta de 12 son 14 fichas) y lo que
// se pasa de la meta al ganar. Al final da, por dificultad, el máximo de todas las partidas y el que basta en el 99 %, el 95 %
// y el 50 %.

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import type { Modo } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

/** El valor que no pasan el `p` por ciento de las partidas. */
function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)] ?? 0
}

function medir(modo: Modo) {
  const jugador = jugadorConCriterio()
  const maximos: number[] = []
  const excesos: number[] = []
  let objetivo = 0
  let ejemplo = { semilla: 0, maximo: -1 }
  let perdidaTrasMaximo = 0
  for (let semilla = 1; semilla <= PARTIDAS; semilla++) {
    let max = 0
    const p = jugarPartida(semilla, jugador, {
      ...(modo !== 'normal' ? { modo } : {}),
      alPaso: (s) => {
        max = Math.max(max, s.reputacion)
        objetivo = s.reputacionObjetivo
      },
    })
    max = Math.max(max, p.final.reputacion)
    maximos.push(max)
    if (max > p.final.reputacion) perdidaTrasMaximo++
    if (max > ejemplo.maximo) ejemplo = { semilla, maximo: max }
    if (p.gana && p.final.reputacion >= objetivo) excesos.push(p.final.reputacion - objetivo)
  }
  const reparto = (v: number[]) => Object.fromEntries([...new Set(v)].sort((a, b) => a - b).map((x) => [x, v.filter((y) => y === x).length]))
  return {
    modo,
    objetivo,
    partidas: PARTIDAS,
    maximo: Math.max(...maximos),
    p99: percentil(maximos, 99),
    p95: percentil(maximos, 95),
    p50: percentil(maximos, 50),
    ejemplo,
    // Partidas en que la reputación baja después de su máximo (cartas que la hacen perder).
    perdidaTrasMaximo,
    victoriasPorReputacion: excesos.length,
    // Lo que se pasa de la meta al ganar (0 = llega justo), en cuántas victorias.
    excesoAlGanar: reparto(excesos),
    repartoDelMaximo: reparto(maximos),
  }
}

it.runIf(process.env.MEDIR_REPUTACION)(`fase 16: fichas de reputación que hacen falta (${PARTIDAS} partidas normales y ${PARTIDAS} largas)`, { timeout: 3_600_000 }, () => {
  const modos = (process.env.MEDIR_REPUTACION_MODOS ?? 'normal,larga').split(',') as Modo[]
  const salida = JSON.stringify(modos.map(medir), null, 2)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, salida)
  else console.log(salida)
})
