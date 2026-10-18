// Genera docs/informe-equilibrio.md. Solo se ejecuta con `npm run equilibrio` (variable INFORME).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { informe, jugarPartida, mazoDeMuelleAlAzar } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import type { Estado } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

it.runIf(process.env.INFORME)(`informe de equilibrio (${PARTIDAS} partidas, ${PARTIDAS * 2} con mazos variados y ${PARTIDAS * 4} con otras reglas de Avance)`, { timeout: 3_600_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador))
  const variadas = Array.from({ length: PARTIDAS * 2 }, (_, i) => jugarPartida(100_000 + i, jugador, { mazoDeMuelle: mazoDeMuelleAlAzar(100_000 + i) }))
  // Avance X / Y: la regla del juego frente a otras, solo simuladas (las mismas semillas).
  const conVariante = (variante: NonNullable<Estado['variante']>) =>
    Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador, { variante }))
  const variantes = [
    { nombre: 'a) Regla del juego: Y = mitad de X, redondeando abajo (1/0, 2/1, 3/1, 4/2)', partidas },
    { nombre: 'b) Y = X − 1, mínimo 1 (1/1, 2/1, 3/2, 4/3)', partidas: conVariante({ avanceSinSuperar: 'menosUno' }) },
    { nombre: 'c) Y = mitad de X, redondeando arriba (1/1, 2/1, 3/2, 4/2)', partidas: conVariante({ avanceSinSuperar: 'mitadArriba' }) },
    { nombre: 'd) Como a), y cada misión pide 1 de Avance menos (mínimo 2)', partidas: conVariante({ misionesMenosUno: true }) },
    { nombre: 'Referencia: como estaba antes, Avance entero siempre', partidas: conVariante({ avanceSinSuperar: 'entero' }) },
  ]
  const fecha = new Date().toISOString().slice(0, 10)
  const titulo = `Partida normal (18 de reputación, 11 cartas de Escenario), Diego en Tortuga con los mazos de inicio. ${PARTIDAS} partidas con semillas 1–${PARTIDAS}. Generado el ${fecha}.`
  writeFileSync(new URL('../../docs/informe-equilibrio.md', import.meta.url), `${informe(partidas, titulo, variadas, variantes)}\n`)
})
