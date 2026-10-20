// Genera docs/informe-equilibrio.md. Solo se ejecuta con `npm run equilibrio` (variable INFORME).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { informe, jugarPartida, mazoDeMuelleAlAzar } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import type { Estado } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.INFORME)(`informe de equilibrio (${PARTIDAS} partidas, ${PARTIDAS * 2} con mazos variados y ${PARTIDAS * 2} con las reglas de Avance anteriores)`, { timeout: 3_600_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador))
  const variadas = Array.from({ length: PARTIDAS * 2 }, (_, i) => jugarPartida(100_000 + i, jugador, { mazoDeMuelle: mazoDeMuelleAlAzar(100_000 + i) }))
  // Avance X / Y: la regla del juego frente a las anteriores, solo simuladas (las mismas semillas).
  const conVariante = (variante: NonNullable<Estado['variante']>) =>
    Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador, { variante }))
  const variantes = [
    { nombre: 'Regla del juego (fase 11): dificultad 3 o menos, 1 / 1; dura, 3 / 1 o 3 / 2', partidas },
    { nombre: 'Y = mitad de X, redondeando abajo (los 3 / 2 pasan a 3 / 1)', partidas: conVariante({ avanceSinSuperar: 'mitadAbajo' }) },
    { nombre: 'Antes del Avance doble: Avance entero siempre', partidas: conVariante({ avanceSinSuperar: 'entero' }) },
  ]
  const fecha = new Date().toISOString().slice(0, 10)
  const titulo = `Partida normal (12 de reputación, 11 cartas de Escenario), Diego en Tortuga con los mazos de inicio. ${PARTIDAS} partidas con semillas 1–${PARTIDAS}. Generado el ${fecha}.`
  writeFileSync(new URL('../../docs/informe-equilibrio.md', import.meta.url), `${informe(partidas, titulo, variadas, variantes)}\n`)
})
