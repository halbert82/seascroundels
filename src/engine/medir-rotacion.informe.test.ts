// Medida de la rotación de la tripulación (sin informe): `MEDIR_ROTACION=1 npx vitest run src/engine/medir-rotacion.informe.test.ts`.
// Juega las partidas de las semillas 1–N con los mazos de inicio y el jugador automático, y escribe el resumen en JSON en
// MEDIR_SALIDA (o en la consola). MEDIR_MODO: corta, normal o larga. Fase 14: MEDIR_MUELLE=viejo, el muelle de inicio sin
// los seis Tripulantes nuevos (20 cartas); MEDIR_SIN=galeote,carne_canon, el muelle de inicio sin esas cartas;
// MEDIR_DESPIDE=0, el jugador que no despide. Ver pruebas/rotacion.ts.

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { DATOS } from './datos.ts'
import { TRIPULANTES_FASE14 } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { medirRotacion, resumenRotacion } from './pruebas/rotacion.ts'
import type { Modo } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.MEDIR_ROTACION)(`rotación de la tripulación (${PARTIDAS} partidas)`, { timeout: 3_600_000 }, () => {
  const modo = (process.env.MEDIR_MODO ?? 'normal') as Modo
  const jugador = jugadorConCriterio({ despide: process.env.MEDIR_DESPIDE !== '0' })
  const viejo = process.env.MEDIR_MUELLE === 'viejo'
  const sin = (process.env.MEDIR_SIN ?? '').split(',').filter((id) => id.length > 0)
  const quitar = viejo ? TRIPULANTES_FASE14 : sin
  const mazoDeMuelle = quitar.length > 0 ? DATOS.mazosPredefinidos.mazoDeMuelle.filter((id) => !quitar.includes(id)) : undefined
  const partidas = Array.from({ length: PARTIDAS }, (_, i) =>
    medirRotacion(i + 1, jugador, { ...(modo !== 'normal' ? { modo } : {}), ...(mazoDeMuelle ? { mazoDeMuelle } : {}) }),
  )
  const resumen = { modo, muelle: viejo ? 'viejo' : sin.length > 0 ? `sin ${sin.join(', ')}` : 'nuevo', despide: process.env.MEDIR_DESPIDE !== '0', ...resumenRotacion(partidas) }
  const json = JSON.stringify(resumen, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
  else console.log(json)
})
