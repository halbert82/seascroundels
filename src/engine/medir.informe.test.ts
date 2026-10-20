// Medida rápida de equilibrio (sin informe): `npm run medir`. Juega las mismas partidas que el informe (semillas 1–N,
// mazos de inicio) y escribe un resumen en JSON en MEDIR_SALIDA (o en la consola). Sirve para comparar dos versiones de
// las reglas en procesos separados. MEDIR_VARIANTE cambia los datos solo en este proceso (ver pruebas/variantesMedida.ts).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida, ultimoCapitulo } from './pruebas/equilibrio.ts'
import { CATALOGO } from './catalogo.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { aplicarVariante, leerVariante } from './pruebas/variantesMedida.ts'
import { DATOS } from './datos.ts'
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
    // Fase 11: cada travesía, en cuántas partidas la completa (supera su último capítulo) y cuántas de esas gana.
    travesias: Object.fromEntries(
      DATOS.ordenMisiones.travesias.map((t) => {
        const completan = partidas.filter((p) => p.resultados.some((r) => r.mision === ultimoCapitulo(t) && r.resultado === 'superada'))
        return [t, { completada: (100 * completan.length) / PARTIDAS, ganaSiLaCompleta: completan.length > 0 ? (100 * completan.filter((p) => p.gana).length) / completan.length : 0 }]
      }),
    ),
    // Reputación media que da cada misión superada (con la Gesta y lo que se pierde por los rehenes de esa misión).
    repPorMision: Object.fromEntries(
      [...new Set(partidas.flatMap((p) => p.zarpes))].sort().map((m) => {
        const reps = partidas.flatMap((p) => p.repPorZarpe.filter((z, i) => z.mision === m && p.resultados[i]?.resultado === 'superada').map((z) => z.rep))
        return [m, { superadas: reps.length, rep: reps.length > 0 ? reps.reduce((n, x) => n + x, 0) / reps.length : 0 }]
      }),
    ),
    // Fase 12: turnos de espera entre superar un capítulo y poder zarpar al siguiente (el que salga, con salida doble).
    // «Sin oferta»: el siguiente no llega a ofrecerse antes de que acabe la partida (en % de los capítulos superados).
    espera: (() => {
      const esperas: number[] = []
      let sinOferta = 0
      const porTravesia: Record<string, number[]> = {}
      for (const p of partidas) {
        for (const [id, turno] of Object.entries(p.turnoSuperada)) {
          const e = CATALOGO.find((c) => c.id === id)
          if (!e || e.tipo !== 'capitulo') continue
          const siguientes = CATALOGO.filter((c) => c.tipo === 'capitulo' && e.carta.siguiente.includes(c.num)).map((c) => c.id)
          if (siguientes.length === 0) continue
          const ofrecida = siguientes.map((s) => p.primerTurnoOfrecida[s]).filter((t): t is number => t !== undefined && t >= turno)
          if (ofrecida.length === 0) {
            sinOferta++
            continue
          }
          const espera = Math.min(...ofrecida) - turno
          esperas.push(espera)
          ;(porTravesia[e.mision.id] ??= []).push(espera)
        }
      }
      const mediaDe = (v: number[]) => (v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0)
      return {
        media: mediaDe(esperas),
        capitulos: esperas.length + sinOferta,
        sinOferta: (100 * sinOferta) / Math.max(1, esperas.length + sinOferta),
        porTravesia: Object.fromEntries(Object.entries(porTravesia).map(([t, v]) => [t, { media: mediaDe(v), n: v.length }])),
      }
    })(),
    // Fase 12: en cuántas partidas (%) llega a estar disponible cada capítulo de Panamá.
    panamaSale: Object.fromEntries(['panama-I', 'panama-II', 'panama-III'].map((id) => [id, (100 * partidas.filter((p) => p.primerTurnoDisponible[id] !== undefined).length) / PARTIDAS])),
    motivos: Object.fromEntries(
      [...new Set(partidas.map((p) => p.motivo.split(':')[0].split('.')[0]))].map((m) => [m, partidas.filter((p) => p.motivo.startsWith(m)).length]),
    ),
  }
  const texto = JSON.stringify(resumen, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, `${texto}\n`)
  else console.log(texto)
})
