// Preparación de la partida (reglamento, «Preparación de la partida»).

import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { anotar, encolar, estadoVacio } from './estado.ts'
import { ejecutar } from './motor.ts'
import { robarCartas, revelarAlMuelle, tamanoMuelle } from './tareas/cartas.ts'
import { sembrar } from './azar.ts'
import { erroresDeMazos, MUELLE_TEMPORAL_FASE14 } from './mazos.ts'
import type { CartaId, Estado, Modo } from './tipos.ts'
import { valor } from './valores.ts'
import { barajar, crearCopia, mover } from './zonas.ts'

/** Reputación para ganar y cartas de Escenario según el modo de partida. */
export const MODOS: Record<Modo, { reputacion: number; escenario: number }> = {
  corta: { reputacion: 9, escenario: 8 },
  normal: { reputacion: 12, escenario: 11 },
  larga: { reputacion: 16, escenario: 14 },
}

export interface OpcionesPartida {
  semilla: number | string
  modo?: Modo
  /** Otro mazo de muelle (por defecto, el predefinido). Tiene que cumplir las reglas de construcción. */
  mazoDeMuelle?: CartaId[]
  /** Cartas de Peligro de más en el mazo de Peligros (las de prueba de la fase 6, ya registradas). */
  peligrosExtra?: CartaId[]
  /** Solo para simular otra regla (ver `Estado.variante`). */
  variante?: Estado['variante']
  /** Partida de aprendizaje: sin mazo de Escenario, con un contador de turnos (fase 10c). */
  sinEscenario?: boolean
}

/** Prepara una partida con los mazos predefinidos y la deja esperando el cambio de mano inicial. */
export function nuevaPartida({ semilla, modo, mazoDeMuelle, peligrosExtra, variante, sinEscenario }: OpcionesPartida): Estado {
  const m = DATOS.mazosPredefinidos
  const muelle = mazoDeMuelle ?? m.mazoDeMuelle
  // TODO(regla): excepción temporal de la fase 14 (muelle de inicio de 26 cartas); quitar cuando se rehagan los mazos de inicio.
  // Vale también para el muelle de inicio sin alguna de sus cartas (las medidas que quitan una para ver lo que pesa).
  const delInicio = muelle.every((id) => m.mazoDeMuelle.includes(id))
  const errores = erroresDeMazos(
    { capitan: m.capitanInicial, mazoDelCapitan: m.mazoDelCapitan, mazoDeMuelle: muelle },
    delInicio ? { muelleMaximo: MUELLE_TEMPORAL_FASE14 } : {},
  )
  if (errores.length > 0) throw new Error(`Mazos no válidos: ${errores.join(' ')}`)
  const s = estadoVacio(sembrar(semilla))
  s.modo = modo ?? m.modo
  s.reputacionObjetivo = MODOS[s.modo].reputacion
  if (variante) s.variante = variante

  // 1. Mazo de Escenario: se baraja y se queda con las cartas del modo; las demás vuelven a la caja sin mirarlas.
  //    Partida de aprendizaje: sin mazo de Escenario; un contador con tantos días como cartas tendría.
  if (sinEscenario) {
    const dias = MODOS[s.modo].escenario
    s.sinEscenario = { dias, total: dias }
  } else {
    for (const e of DATOS.escenario) crearCopia(s, e.id, 'mazoEscenario')
    barajar(s, 'mazoEscenario')
    for (const sobra of s.zonas.mazoEscenario.slice(MODOS[s.modo].escenario)) mover(s, sobra, 'fueraDeJuego')
  }

  // 2. Capitán preparado y Barco sin daño.
  s.capitan = crearCopia(s, m.capitanInicial, 'tripulacion')

  // 3. Puerto.
  s.puerto = m.puertoInicial

  // 4. Mazo de Peligros: todas las cartas de Peligro. Las que solo entran si una carta lo indica («La Armada te
  //    persigue») están en el mazo de historia (fase 10), y se buscan por su número.
  for (const id of [...m.mazoDePeligros, ...(peligrosExtra ?? [])]) crearCopia(s, id, 'mazoPeligros')
  barajar(s, 'mazoPeligros')
  for (const id of m.apartadosDePeligros) crearCopia(s, id, 'mazoHistoria')

  // 5. Misiones: las tres iniciales disponibles; capítulos I y aventuras en el mazo de Misiones;
  //    capítulos II y III, Tesoros, mazos propios, Pasajeros y permanentes en el mazo de historia.
  for (const id of DATOS.ordenMisiones.iniciales) crearCopia(s, `${id}-I`, 'misionesDisponibles')
  for (const id of [...DATOS.ordenMisiones.travesias, ...DATOS.ordenMisiones.aventuras]) crearCopia(s, `${id}-I`, 'mazoMisiones')
  barajar(s, 'mazoMisiones')
  // Tantas misiones disponibles como indique la carta de puerto (fase 10): si pide más de tres, se reponen del mazo.
  const disponibles = DATOS.puertos.find((p) => p.id === s.puerto)?.misiones ?? 3
  while (s.zonas.misionesDisponibles.length < disponibles && s.zonas.mazoMisiones.length > 0) {
    const siguiente = s.zonas.mazoMisiones[0]
    if (siguiente) mover(s, siguiente, 'misionesDisponibles', 'abajo')
  }
  for (const e of CATALOGO) {
    if (e.tipo === 'capitulo' && e.carta.capitulo !== 'I') crearCopia(s, e.id, 'mazoHistoria')
    if (e.tipo === 'tesoro') crearCopia(s, e.id, 'mazoHistoria')
    if (e.tipo === 'mazoPropio') for (let i = 0; i < e.copias; i++) crearCopia(s, e.id, 'mazoHistoria')
    // Misiones 2.0: los Pasajeros esperan apartados en el mazo de historia.
    if (e.tipo === 'pasajero') crearCopia(s, e.id, 'mazoHistoria')
    // Fase 11: las permanentes (también «¡La guardia!») esperan apartadas en el mazo de historia hasta que un encuentro o
    // una misión las pone en juego.
    if (e.tipo === 'permanente') crearCopia(s, e.id, 'mazoHistoria')
    // Fase 15: las cartas de consulta («El fondo del San José») también esperan en el mazo de historia.
    if (e.tipo === 'consulta') crearCopia(s, e.id, 'mazoHistoria')
  }

  // 6. Muelle.
  for (const id of muelle) crearCopia(s, id, 'mazoMuelle')
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
