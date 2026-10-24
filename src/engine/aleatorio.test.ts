// Pruebas masivas: partidas enteras con jugadores automáticos. Comprueban los invariantes en cada paso,
// que toda partida termina como muy tarde en el turno 12, que la misma semilla da la misma partida,
// que el jugador con criterio gana partidas y que en la simulación ocurre de todo.

import { describe, expect, it } from 'vitest'
import { capacidadesDelJugador, jugarPartida, mazoDeMuelleAlAzar } from './pruebas/equilibrio.ts'
import { jugadorAlAzar, jugadorConCriterio } from './pruebas/jugadores.ts'

describe('Prueba masiva: jugador al azar', () => {
  it('200 partidas: cumplen los invariantes y terminan como muy tarde en el turno 12', { timeout: 180_000 }, () => {
    let descartados = 0
    for (let semilla = 1; semilla <= 200; semilla++) {
      const p = jugarPartida(semilla, jugadorAlAzar(semilla), { invariantes: true })
      expect(p.final.resultado, `semilla ${semilla}`).not.toBeNull()
      expect(p.turnoFinal, `semilla ${semilla}`).toBeLessThanOrEqual(12)
      descartados += p.descartados
    }
    // Fase 14 (fuera el rehén): alguna carta de Peligro llega a descartar a un Tripulante.
    expect(descartados).toBeGreaterThan(0)
  })

  it('la misma semilla da exactamente la misma partida', { timeout: 60_000 }, () => {
    for (const semilla of [3, 77, 401]) {
      expect(jugarPartida(semilla, jugadorAlAzar(semilla)).final).toEqual(jugarPartida(semilla, jugadorAlAzar(semilla)).final)
    }
  })
})

describe('Prueba masiva: jugador con criterio', () => {
  const partidas = Array.from({ length: 120 }, (_, i) => i + 1)

  it('gana partidas de principio a fin en modo normal (12 de reputación)', { timeout: 180_000 }, () => {
    const jugador = jugadorConCriterio()
    const ganadas = partidas.map((semilla) => jugarPartida(semilla, jugador, { invariantes: true })).filter((p) => p.gana)
    expect(ganadas.length).toBeGreaterThanOrEqual(5)
    for (const p of ganadas) {
      expect(p.final.resultado?.gana).toBe(true)
      expect(p.turnoFinal).toBeLessThanOrEqual(12)
      // Gana por reputación (12) o por «Las puertas de Panamá».
      expect(p.reputacion >= 12 || p.motivo.includes('Panamá')).toBe(true)
    }
    expect(ganadas.some((p) => p.reputacion >= 12)).toBe(true)
    // Con las misiones 2.0 el jugador automático llega antes a 12 de reputación que a «Las puertas de Panamá»
    // (la victoria por Panamá tiene su propia prueba en mision.test.ts).
  })

  it('en la simulación ocurre de todo: superar, retirarse, hundirse, morir, la Armada y «Se retira»', { timeout: 180_000 }, () => {
    const jugador = jugadorConCriterio()
    // Con criterio y, para que haya de todo (también Capitanes que caen), algunas al azar.
    const todas = [...partidas.map((semilla) => jugarPartida(semilla, jugador)), ...partidas.map((semilla) => jugarPartida(semilla, jugadorAlAzar(semilla)))]
    const resultados = todas.flatMap((p) => p.resultados.map((r) => r.resultado))
    expect(resultados).toContain('superada')
    expect(resultados).toContain('retirada')
    expect(resultados).toContain('hundida')
    expect(todas.some((p) => p.muertes > 0)).toBe(true)
    expect(todas.some((p) => p.entradasEnMazo > 0)).toBe(true)
    expect(todas.some((p) => p.retiradasDelJuego > 0)).toBe(true)
    expect(todas.some((p) => !p.gana && p.motivo.startsWith('Tu Capitán'))).toBe(true)
  })
})

describe('Prueba masiva: mazos de muelle variados', () => {
  it('con mazos al azar (las cartas del muelle de la caja), cada capacidad del jugador se usa al menos una vez', { timeout: 600_000 }, () => {
    const criterio = jugadorConCriterio()
    const usadas = new Set<string>()
    // Algunas capacidades son muy raras (el Mascarón, «Ni un hombre atrás»: ~1 de cada 200 partidas): hacen falta muchas.
    for (let i = 0; i < 900; i++) {
      const semilla = 5000 + i
      // Fase 14: con la caja de antes. Las seis cartas nuevas solo van en el muelle de inicio de prueba y tienen sus propias
      // pruebas; con ellas en la caja, el Cañonero y los Cañones coinciden tan poco que su capacidad no llega a salir.
      const mazoDeMuelle = mazoDeMuelleAlAzar(semilla, { sinFase14: true })
      const jugador = i % 2 === 0 ? jugadorAlAzar(semilla) : criterio
      const p = jugarPartida(semilla, jugador, { invariantes: i < 40, mazoDeMuelle })
      for (const [clave, n] of Object.entries(p.capacidades)) if (n > 0) usadas.add(clave)
    }
    // Las seis cartas de la fase 14, con el muelle de inicio (que las lleva todas) y el jugador con criterio. Fase 16: 200
    // (la Carne de cañón se usa en ~3 de cada 100, y en 100 a veces no salía).
    for (let i = 0; i < 200; i++) {
      const p = jugarPartida(9000 + i, criterio)
      for (const [clave, n] of Object.entries(p.capacidades)) if (n > 0) usadas.add(clave)
    }
    // El Mascarón del galeón solo llega como Tesoro de «La huida con la plata» (Flota IV): desde la fase 8 se usa en
    // ~1 de cada 2400 partidas. La Espada del sacerdote, Tesoro de «El templo» (Templo IV), desde el Avance 1 / 1 y
    // 3 / 2 (19 de octubre de 2026) se usa en ~1 de cada 900. Las dos tienen su propia prueba (cartas-mejoras).
    // La Pólvora del Rey (fase 10b) es el Tesoro del final de San Felipe y solo dispara con un Cañón en una Prueba de COM
    // en el Mar: también tiene su propia prueba.
    // «Ni un hombre atrás» (fase 12): con las travesías nuevas no sale en estas 900; en las 1800 siguientes, en 3. Tiene
    // sus pruebas propias (cartas-eventos y decisiones).
    // «Arenga del capitán» (fase 13) está en la colección pero no en el mazo de inicio de Diego: aquí no sale nunca. Tiene
    // su prueba propia (cartas-eventos) y su medida con un mazo de prueba (medir.informe).
    // Fase 15: la campana, la culebrina y el doblón del San José solo llegan buceando en «El naufragio del San José» (y el
    // doblón salva al Capitán solo si iba a quedar derrotado). Tienen su prueba propia (fase15-misiones.test).
    // Fase 15, quinta ronda: sin el Práctico del puerto en el muelle, el sorteo de partidas cambia. La Cruz de Santa Bárbara
    // (más de 2 daños de golpe con la Cruz en juego) sale en ~1 de cada 250 partidas y «¡A por ellos!» (un Peligro descarta a
    // un Tripulante que vale la pena con la carta en la mano), en ~1 de cada 500: en estas 1000 pueden no salir. Las dos
    // tienen su prueba propia (cartas-mejoras, cartas-jugador2 y peligros2-grupoC), y el jugador automático las usa.
    const rarisimas = new Set([
      'cruz.tope',
      'a_por_ellos.jugar',
      'mascaron.evitar',
      'espada.cancelar',
      'polvora_rey.disparo',
      'ni_hombre.jugar',
      'arenga.jugar',
      'campana_sanjose.otear',
      'culebrina_sanjose.disparar',
      'doblon.entrar',
      'doblon.salvar',
    ])
    expect(capacidadesDelJugador().filter((c) => !usadas.has(c) && !rarisimas.has(c))).toEqual([])
  })
})

