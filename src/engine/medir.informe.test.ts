// Medida rápida de equilibrio (sin informe): `npm run medir`. Juega las mismas partidas que el informe (semillas 1–N,
// mazos de inicio) y escribe un resumen en JSON en MEDIR_SALIDA (o en la consola). Sirve para comparar dos versiones de
// las reglas en procesos separados.

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.MEDIR)(`medida de equilibrio (${PARTIDAS} partidas)`, { timeout: 3_600_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador))
  const suma = (f: (p: (typeof partidas)[number]) => number) => partidas.reduce((n, p) => n + f(p), 0)
  const zarpes = suma((p) => p.zarpes.length)
  const resumen = {
    partidas: PARTIDAS,
    victorias: (100 * partidas.filter((p) => p.gana).length) / PARTIDAS,
    heridasPorMision: suma((p) => p.heridasEnMision) / Math.max(1, zarpes),
    misionesPorPartida: zarpes / PARTIDAS,
    superadasPorPartida: suma((p) => p.resultados.filter((r) => r.resultado === 'superada').length) / PARTIDAS,
    falladasPorPartida: suma((p) => p.resultados.filter((r) => r.resultado !== 'superada').length) / PARTIDAS,
    hundimientosPorPartida: suma((p) => p.hundimientos) / PARTIDAS,
    muertesPorPartida: suma((p) => p.muertes) / PARTIDAS,
    reputacionMedia: suma((p) => p.reputacion) / PARTIDAS,
    turnoFinalMedio: suma((p) => p.turnoFinal) / PARTIDAS,
    motivos: Object.fromEntries(
      [...new Set(partidas.map((p) => p.motivo.split(':')[0].split('.')[0]))].map((m) => [m, partidas.filter((p) => p.motivo.startsWith(m)).length]),
    ),
  }
  const texto = JSON.stringify(resumen, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, `${texto}\n`)
  else console.log(texto)
})
