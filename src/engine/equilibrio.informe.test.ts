// Genera docs/informe-equilibrio.md. Solo se ejecuta con `npm run equilibrio` (variable INFORME).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { informe, jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.INFORME)(`informe de equilibrio (${PARTIDAS} partidas)`, { timeout: 1_800_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador))
  const fecha = new Date().toISOString().slice(0, 10)
  const titulo = `Partida normal (18 de reputación, 11 cartas de Escenario), Diego en Tortuga con los mazos de inicio. ${PARTIDAS} partidas con semillas 1–${PARTIDAS}. Generado el ${fecha}.`
  writeFileSync(new URL('../../docs/informe-equilibrio.md', import.meta.url), `${informe(partidas, titulo)}\n`)
})
