// Genera docs/informe-equilibrio.md. Solo se ejecuta con `npm run equilibrio` (variable INFORME).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { informe, jugarPartida, mazoDeMuelleAlAzar } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.INFORME)(`informe de equilibrio (${PARTIDAS} partidas, ${PARTIDAS * 2} con mazos variados y ${PARTIDAS * 2} con otras reglas de Avance)`, { timeout: 3_600_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador))
  const variadas = Array.from({ length: PARTIDAS * 2 }, (_, i) => jugarPartida(100_000 + i, jugador, { mazoDeMuelle: mazoDeMuelleAlAzar(100_000 + i) }))
  // Avance X / Y: la regla del juego frente a la de antes (Avance entero siempre) y a Y = X − 1, solo simuladas.
  const conVariante = (avanceSinSuperar: 'entero' | 'menosUno') =>
    Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador, { variante: { avanceSinSuperar } }))
  const variantes = [
    { nombre: 'Como estaba: Avance entero siempre', partidas: conVariante('entero') },
    { nombre: 'Regla del juego: Y = mitad de X, redondeando abajo', partidas },
    { nombre: 'Solo simulada: Y = X − 1 (mínimo 0)', partidas: conVariante('menosUno') },
  ]
  const fecha = new Date().toISOString().slice(0, 10)
  const titulo = `Partida normal (18 de reputación, 11 cartas de Escenario), Diego en Tortuga con los mazos de inicio. ${PARTIDAS} partidas con semillas 1–${PARTIDAS}. Generado el ${fecha}.`
  writeFileSync(new URL('../../docs/informe-equilibrio.md', import.meta.url), `${informe(partidas, titulo, variadas, variantes)}\n`)
})
