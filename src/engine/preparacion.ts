// Preparación de la partida (reglamento, «Preparación de la partida»).

import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { anotar, encolar, estadoVacio } from './estado.ts'
import { ejecutar } from './motor.ts'
import { robarCartas, revelarAlMuelle, tamanoMuelle } from './tareas/cartas.ts'
import { sembrar } from './azar.ts'
import type { Estado, Modo } from './tipos.ts'
import { valor } from './valores.ts'
import { barajar, crearCopia, mover } from './zonas.ts'

/** Reputación para ganar y cartas de Escenario según el modo de partida. */
export const MODOS: Record<Modo, { reputacion: number; escenario: number }> = {
  corta: { reputacion: 12, escenario: 8 },
  normal: { reputacion: 18, escenario: 11 },
  larga: { reputacion: 24, escenario: 14 },
}

export interface OpcionesPartida {
  semilla: number | string
  modo?: Modo
}

/** Prepara una partida con los mazos predefinidos y la deja esperando el cambio de mano inicial. */
export function nuevaPartida({ semilla, modo }: OpcionesPartida): Estado {
  const m = DATOS.mazosPredefinidos
  const s = estadoVacio(sembrar(semilla))
  s.modo = modo ?? m.modo
  s.reputacionObjetivo = MODOS[s.modo].reputacion

  // 1. Mazo de Escenario: se baraja y se queda con las cartas del modo; las demás vuelven a la caja sin mirarlas.
  for (const e of DATOS.escenario) crearCopia(s, e.id, 'mazoEscenario')
  barajar(s, 'mazoEscenario')
  for (const sobra of s.zonas.mazoEscenario.slice(MODOS[s.modo].escenario)) mover(s, sobra, 'fueraDeJuego')

  // 2. Capitán preparado y Barco sin daño.
  s.capitan = crearCopia(s, m.capitanInicial, 'tripulacion')

  // 3. Puerto.
  s.puerto = m.puertoInicial

  // 4. Mazo de Peligros, con las cartas que solo entran si una carta lo indica, aparte.
  for (const id of m.mazoDePeligros) crearCopia(s, id, 'mazoPeligros')
  barajar(s, 'mazoPeligros')
  for (const id of m.apartadosDePeligros) crearCopia(s, id, 'apartados')

  // 5. Misiones: las tres iniciales disponibles; capítulos I y aventuras en el mazo de Misiones;
  //    capítulos II y III, Tesoros y mazos propios en el mazo de historia.
  for (const id of DATOS.ordenMisiones.iniciales) crearCopia(s, `${id}-I`, 'misionesDisponibles')
  for (const id of [...DATOS.ordenMisiones.travesias, ...DATOS.ordenMisiones.aventuras]) crearCopia(s, `${id}-I`, 'mazoMisiones')
  barajar(s, 'mazoMisiones')
  for (const e of CATALOGO) {
    if (e.tipo === 'capitulo' && e.carta.capitulo !== 'I') crearCopia(s, e.id, 'mazoHistoria')
    if (e.tipo === 'tesoro') crearCopia(s, e.id, 'mazoHistoria')
    if (e.tipo === 'mazoPropio') for (let i = 0; i < e.copias; i++) crearCopia(s, e.id, 'mazoHistoria')
  }

  // 6. Muelle.
  for (const id of m.mazoDeMuelle) crearCopia(s, id, 'mazoMuelle')
  barajar(s, 'mazoMuelle')
  anotar(s, 'turno', 'Preparación de la partida')
  revelarAlMuelle(s, tamanoMuelle(s))

  // 7. Mano inicial: tantas cartas como el Mando del Capitán, con un cambio de mano opcional.
  for (const id of m.mazoDelCapitan) crearCopia(s, id, 'mazoCapitan')
  barajar(s, 'mazoCapitan')
  robarCartas(s, valor(s, { tipo: 'mando' }))

  encolar(s, { tipo: 'cambioMano' }, { tipo: 'turno', paso: 'inicio' })
  ejecutar(s)
  return s
}
