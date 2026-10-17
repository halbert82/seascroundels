// Manejador de cada tipo de tarea. El tipo obliga a que no falte ninguno.

import type { TipoTarea } from '../tipos.ts'
import {
  anadirTemporal,
  buscarMuelle,
  curar,
  pagar,
  perderDia,
  perderMejora,
  reparar,
  reponerMuelle,
  revelarMuelle,
  robar,
  robarHastaMando,
} from './cartas.ts'
import type { Manejador } from './comun.ts'
import { adquirir, despedir, reclutar, ventanaJugar } from './jugar.ts'
import { quedarseEnPuerto, reponerMisiones, soplos, tablon } from './puerto.ts'
import { evento, jugarEvento, usar, ventanaLibre } from './sucesos.ts'
import { desercion, exceso, hundirse, reasignarTesoro, sacarTripulante } from './tripulacion.ts'
import { aplicarEscenario, cambioMano, descartarFinal, prepararTodo, recargar, turno } from './turno.ts'

export const MANEJADORES: { [K in TipoTarea]: Manejador<K> } = {
  cambioMano,
  turno,
  aplicarEscenario,
  prepararTodo,
  recargar,
  ventanaJugar,
  ventanaLibre,
  reclutar,
  adquirir,
  despedir,
  jugarEvento,
  usar,
  pagar,
  robar,
  perderDia,
  reponerMuelle,
  revelarMuelle,
  buscarMuelle,
  perderMejora,
  curar,
  reparar,
  desercion,
  sacarTripulante,
  reasignarTesoro,
  exceso,
  hundirse,
  quedarseEnPuerto,
  tablon,
  soplos,
  reponerMisiones,
  descartarFinal,
  robarHastaMando,
  anadirTemporal,
  evento,
}

/**
 * Tareas que forman la estructura del turno. Si en la pila solo hay de estas, el jugador está en una
 * pausa y puede usar capacidades sin etiqueta (decisión N2). Por eso la estructura no deja tareas de
 * efecto esperando debajo de una pausa: las encola cuando la pausa ha terminado.
 */
export const TAREAS_DE_ESTRUCTURA: ReadonlySet<TipoTarea> = new Set<TipoTarea>([
  'turno',
  'ventanaJugar',
  'ventanaLibre',
  'descartarFinal',
])
