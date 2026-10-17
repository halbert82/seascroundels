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
import {
  agotarMejora,
  agotarTripulantes,
  aplicarEfectos,
  aplicarFallo,
  cambiarReputacion,
  descartarMano,
  entrarEnMazo,
  herirUno,
  perderAvance,
  perderMunicion,
  prepararUno,
  reclutaEncuentro,
  rehen,
  repartirHeridas,
} from './efectos.ts'
import { encuentro, prueba } from './encuentro.ts'
import {
  alZarparOpcional,
  cerrarMision,
  fallarMision,
  ganarAvance,
  mezclarMazoPropio,
  mision,
  ponerTesoro,
  superarMision,
  zarpar,
} from './mision.ts'
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
  zarpar,
  mision,
  ganarAvance,
  alZarparOpcional,
  mezclarMazoPropio,
  encuentro,
  prueba,
  aplicarEfectos,
  aplicarFallo,
  herirUno,
  repartirHeridas,
  agotarTripulantes,
  agotarMejora,
  descartarMano,
  perderAvance,
  perderMunicion,
  rehen,
  cambiarReputacion,
  entrarEnMazo,
  reclutaEncuentro,
  prepararUno,
  superarMision,
  fallarMision,
  ponerTesoro,
  cerrarMision,
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
  'mision',
  'encuentro',
  'prueba',
])
