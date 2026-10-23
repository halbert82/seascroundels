// Medida de la rotación de la tripulación (sin informe): `MEDIR_ROTACION=1 npx vitest run src/engine/medir-rotacion.informe.test.ts`.
// Juega las partidas de las semillas 1–N con los mazos de inicio y el jugador automático, y escribe el resumen en JSON en
// MEDIR_SALIDA (o en la consola). MEDIR_MODO: corta, normal o larga. Ver pruebas/rotacion.ts.

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { medirRotacion, resumenRotacion } from './pruebas/rotacion.ts'
import type { Modo } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.MEDIR_ROTACION)(`rotación de la tripulación (${PARTIDAS} partidas)`, { timeout: 3_600_000 }, () => {
  const modo = (process.env.MEDIR_MODO ?? 'normal') as Modo
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => medirRotacion(i + 1, jugador, modo !== 'normal' ? { modo } : {}))
  const resumen = { modo, ...resumenRotacion(partidas) }
  const json = JSON.stringify(resumen, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
  else console.log(json)
})
