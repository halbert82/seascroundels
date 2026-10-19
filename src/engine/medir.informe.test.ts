// Medida rápida de equilibrio (sin informe): `npm run medir`. Juega las mismas partidas que el informe (semillas 1–N,
// mazos de inicio) y escribe un resumen en JSON en MEDIR_SALIDA (o en la consola). Sirve para comparar dos versiones de
// las reglas en procesos separados. MEDIR_VARIANTE cambia los datos solo en este proceso (ver pruebas/variantesMedida.ts).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { aplicarVariante, leerVariante } from './pruebas/variantesMedida.ts'
import { nuevaPartida } from './preparacion.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.MEDIR)(`medida de equilibrio (${PARTIDAS} partidas)`, { timeout: 3_600_000 }, () => {
  const variante = leerVariante(process.env.MEDIR_VARIANTE)
  aplicarVariante(variante)
  const jugador = jugadorConCriterio()
  const modo = variante.modo
  const sinEscenario = variante.claves.has('SINESC')
  const partidas = Array.from({ length: PARTIDAS }, (_, i) =>
    jugarPartida(i + 1, jugador, { ...(modo !== 'normal' ? { modo } : {}), ...(sinEscenario ? { sinEscenario } : {}) }),
  )
  const suma = (f: (p: (typeof partidas)[number]) => number) => partidas.reduce((n, p) => n + f(p), 0)
  const zarpes = suma((p) => p.zarpes.length)
  const superadas = suma((p) => p.resultados.filter((r) => r.resultado === 'superada').length)
  const ganadas = partidas.filter((p) => p.gana)
  const muestra = nuevaPartida({ semilla: 1, ...(modo !== 'normal' ? { modo } : {}) })
  const resumen = {
    variante: process.env.MEDIR_VARIANTE ?? '',
    modo,
    reputacionObjetivo: muestra.reputacionObjetivo,
    partidas: PARTIDAS,
    victorias: (100 * ganadas.length) / PARTIDAS,
    turnoMedioVictoria: ganadas.length > 0 ? ganadas.reduce((n, p) => n + p.turnoFinal, 0) / ganadas.length : 0,
    repPorMisionSuperada: suma((p) => p.repPorZarpe.reduce((n, z) => n + Math.max(0, z.rep), 0)) / Math.max(1, superadas),
    heridasPorMision: suma((p) => p.heridasEnMision) / Math.max(1, zarpes),
    misionesPorPartida: zarpes / PARTIDAS,
    superadasPorPartida: superadas / PARTIDAS,
    falladasPorPartida: suma((p) => p.resultados.filter((r) => r.resultado !== 'superada').length) / PARTIDAS,
    capitanDerrotado: partidas.filter((p) => p.motivo.startsWith('Tu Capitán')).length,
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
