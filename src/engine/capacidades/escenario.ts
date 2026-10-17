// Las 14 cartas de Escenario: se aplican al revelarse, al empezar el turno.
// Las que dicen «Este turno…» dejan un efecto temporal con su propia regla.

import { numeroConIcono, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, CartaId, NuevaTarea } from '../tipos.ts'
import { entornoDeMision } from './comun.ts'

function alRevelar(carta: CartaId, efecto: () => NuevaTarea[]): Capacidad {
  return { clave: carta, carta, ventana: 'alRevelar', desde: 'escenario', efecto: () => efecto() }
}

function esteTurno(clave: string, fuente: CartaId): NuevaTarea {
  return { tipo: 'anadirTemporal', temporal: { clave, fuente, hasta: 'finTurno' } }
}

const n = (carta: CartaId) => primerNumero(textoDe(carta))

export const CAPACIDADES_ESCENARIO: Capacidad[] = [
  alRevelar('mercado', () => [{ tipo: 'revelarMuelle', n: n('mercado') }]),
  alRevelar('astillero', () => [{ tipo: 'reparar', n: n('astillero') }]),
  alRevelar('impuestos', () => [{ tipo: 'perderMejora' }]),
  alRevelar('reclutas', () => [{ tipo: 'buscarMuelle', filtro: 'tripulante' }]),
  alRevelar('noticias', () => [{ tipo: 'robar', n: n('noticias') }]),
  alRevelar('bando', () => [esteTurno('bando.turno', 'bando')]),
  alRevelar('desercion', () => [{ tipo: 'desercion' }]),
  alRevelar('rumores', () => [esteTurno('rumores.turno', 'rumores')]),
  alRevelar('escasez', () => [esteTurno('escasez.turno', 'escasez')]),
  alRevelar('ribera', () => [{ tipo: 'buscarMuelle', filtro: 'mejoraBarco' }]),
  alRevelar('huracanes', () => [esteTurno('huracanes.turno', 'huracanes')]),
  alRevelar('alisios', () => [esteTurno('alisios.turno', 'alisios')]),
  alRevelar('feria', () => [
    { tipo: 'robar', n: n('feria') },
    { tipo: 'curar', n: numeroConIcono(textoDe('feria'), 'herida'), modo: 'cadaUno' },
  ]),
  alRevelar('calma_ev', () => [{ tipo: 'curar', n: n('calma_ev'), modo: 'cadaUno' }]),

  // Efectos temporales («Este turno…»)
  {
    // TODO fase 3: +1 de dificultad a los encuentros Militar y Guardia.
    clave: 'bando.turno',
    carta: 'bando',
    ventana: 'constante',
    desde: 'temporal',
  },
  {
    // TODO fase 3: si zarpas este turno, empiezas la misión con 1 de Avance.
    clave: 'rumores.turno',
    carta: 'rumores',
    ventana: 'constante',
    desde: 'temporal',
  },
  {
    clave: 'escasez.turno',
    carta: 'escasez',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) => (c.tipo === 'objetivoRobo' ? -n('escasez') : 0),
  },
  {
    // D7: la Distancia solo cambia en las misiones lejanas (lo garantiza valor()).
    clave: 'huracanes.turno',
    carta: 'huracanes',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo === 'distancia') return 1
      if (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar') return 1
      return 0
    },
  },
  {
    clave: 'alisios.turno',
    carta: 'alisios',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo === 'distancia') return -1
      if (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar') return -1
      return 0
    },
  },
  {
    // «−1 Mando» (Chubasco repentino, Huracán): este turno robas hasta una carta menos.
    clave: 'menosMando',
    carta: 'regla',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) => (c.tipo === 'mando' ? -1 : 0),
  },
]
