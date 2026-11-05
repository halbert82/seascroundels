// P134 (5 de noviembre de 2026): ¿siguen compensando las travesías? Reputación por turno de las misiones iniciales, las
// aventuras y cada travesía entera (todos sus capítulos y los turnos que cuestan), y cuántas veces el jugador automático
// empieza y termina cada travesía. Solo mide.
//
//   MEDIR_TRAVESIAS=1 npx vitest run src/engine/medir-travesias.informe.test.ts
//
// MEDIR_TRAVESIAS_MUELLE=inicio (por defecto: mazos de inicio, semillas 1–N) o =variados (muelle de 20 al azar de la caja,
// semillas 100000…, el doble de partidas, como el informe de equilibrio). INFORME_PARTIDAS: N (1000 por defecto).
// MEDIR_VARIANTE: una variante de medida (pruebas/variantesMedida.ts); la reputación de antes de P134 es la variante
// ANTES_P134, la de P134 sin P135, ANTES_P135, y el jugador automático de antes de P135 (que valoraba cada capítulo casi
// por sí solo), JUGADOR_ANTES. Escribe el resumen en JSON en MEDIR_SALIDA (o en la consola).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida, mazoDeMuelleAlAzar, reputacionPorTipo } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { aplicarVariante, leerVariante } from './pruebas/variantesMedida.ts'

const VARIADOS = process.env.MEDIR_TRAVESIAS_MUELLE === 'variados'
const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000) * (VARIADOS ? 2 : 1)

it.runIf(process.env.MEDIR_TRAVESIAS)(`reputación por turno de cada tipo de misión (${PARTIDAS} partidas)`, { timeout: 3_600_000 }, () => {
  const variante = process.env.MEDIR_VARIANTE ?? ''
  aplicarVariante(leerVariante(variante))
  const jugador = jugadorConCriterio()
  const base = VARIADOS ? 100_000 : 1
  const partidas = Array.from({ length: PARTIDAS }, (_, i) =>
    jugarPartida(base + i, jugador, VARIADOS ? { mazoDeMuelle: mazoDeMuelleAlAzar(base + i) } : {}),
  )
  const r = (n: number, d: number) => (d === 0 ? null : Math.round((1000 * n) / d) / 1000)
  const filas = reputacionPorTipo(partidas).map((f) => ({
    clave: f.clave,
    nombre: f.nombre,
    zarpes: f.zarpes,
    repPorTurno: r(f.rep, f.zarpes),
    ...(f.travesia
      ? {
          empieza: f.travesia.empieza,
          termina: f.travesia.termina,
          pctTerminadas: r(100 * f.travesia.termina, f.travesia.empieza),
          repPorTurnoTerminada: r(f.travesia.repTerminada, f.travesia.turnosTerminada),
          turnosParaTerminarla: r(f.travesia.turnosTerminada, f.travesia.termina),
          repDeLaTerminada: r(f.travesia.repTerminada, f.travesia.termina),
          ganaAlTerminarla: r(100 * f.travesia.gana, f.travesia.termina),
        }
      : {}),
  }))
  const ganadas = partidas.filter((p) => p.gana)
  const json = JSON.stringify(
    {
      variante,
      muelle: VARIADOS ? 'variados' : 'inicio',
      partidas: PARTIDAS,
      victorias: r(100 * ganadas.length, PARTIDAS),
      panama: ganadas.filter((p) => p.motivo.includes('Panamá')).length,
      filas,
    },
    null,
    1,
  )
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, `${json}\n`)
  else console.log(json)
})
