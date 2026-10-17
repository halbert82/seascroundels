// Capacidades constantes que modifican valores: el +1 de Diego, las Mejoras que suben máximos o
// habilidades, el Barco y los Tesoros. Sus números se leen del texto de cada carta.

import { DATOS } from '../datos.ts'
import { copia } from '../estado.ts'
import { tieneEstadoBarco } from '../estados.ts'
import { numeroConIcono, textoDe } from '../textos.ts'
import type { Capacidad, Contexto, Consulta, InstId } from '../tipos.ts'
import { estaEn } from '../zonas.ts'
import { modificadores } from '../valores.ts'
import { entornoDeMision } from './comun.ts'

function portador(ctx: Contexto, yo: InstId | null): InstId | 'barco' | null {
  return yo ? copia(ctx.s, yo).vinculadaA : null
}

/** Mejora de tripulante que suma a una habilidad o a la Vida de su portador. */
function alPortador(carta: string, que: 'NAV' | 'COM' | 'EXP' | 'vida'): Capacidad {
  const n = numeroConIcono(textoDe(carta), que)
  return {
    clave: `${carta}.${que}`,
    carta,
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) => {
      const destino = portador(ctx, yo)
      if (que === 'vida') return c.tipo === 'vida' && c.carta === destino ? n : 0
      return c.tipo === 'habilidad' && c.hab === que && c.carta === destino ? n : 0
    },
  }
}

/** Mejora de barco que suma a un valor del Barco. */
function alBarco(carta: string, consulta: 'danoMaximo' | 'capacidad', icono: string): Capacidad {
  const n = numeroConIcono(textoDe(carta), icono)
  return {
    clave: `${carta}.${consulta}`,
    carta,
    ventana: 'constante',
    desde: 'juego',
    modifica: (_ctx, _yo, c) => (c.tipo === consulta ? n : 0),
  }
}

const BONIFICACION_DIEGO = numeroConIcono(textoDe('capitan'), 'NAV')
function distanciaDelBarco(): number {
  const m = /Distancia \{([+−-]?\d+)/.exec(DATOS.barco.texto)
  if (!m?.[1]) throw new Error('El texto del Barco no dice cuánto cambia la Distancia')
  return Number(m[1].replace('−', '-'))
}
const DISTANCIA_BARCO = distanciaDelBarco()
const NAV_BARCO = (() => {
  const m = /reciben \{([+−-]?\d+)\}/.exec(DATOS.barco.texto)
  if (!m?.[1]) throw new Error('El texto del Barco no dice cuánto suma a las Pruebas de NAV')
  return Number(m[1].replace('−', '-').replace('+', ''))
})()

export const CAPACIDADES_CONSTANTES: Capacidad[] = [
  {
    // D1a: el +1 solo existe mientras Diego está preparado. En cuanto se agota (también si se agota
    // a la vez que los demás, al comprometerse o al cubrir la Distancia), nadie lo recibe.
    clave: 'capitan.bonificacion',
    carta: 'capitan',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c: Consulta) =>
      c.tipo === 'habilidad' &&
      yo !== null &&
      c.carta !== yo &&
      !ctx.agotada(yo) &&
      estaEn(ctx.s, yo, 'tripulacion') &&
      estaEn(ctx.s, c.carta, 'tripulacion')
        ? BONIFICACION_DIEGO
        : 0,
  },
  {
    // «Tus Pruebas de NAV en el Mar reciben +1». Con «Velas rotas», no.
    clave: 'barco.nav',
    carta: 'barco',
    ventana: 'constante',
    desde: 'barco',
    modifica: (ctx, _yo, c) =>
      c.tipo === 'totalPrueba' &&
      c.hab === 'NAV' &&
      ctx.s.mision !== null &&
      entornoDeMision(ctx.s, ctx.s.mision.carta) === 'mar' &&
      !tieneEstadoBarco(ctx.s, 'velasRotas') &&
      modificadores(ctx.s, { tipo: 'sinNavBarco' }) <= 0
        ? NAV_BARCO
        : 0,
  },
  {
    // «Al zarpar hacia una misión lejana: Distancia −1». Solo afecta a misiones con Distancia (D7).
    clave: 'barco.distancia',
    carta: 'barco',
    ventana: 'constante',
    desde: 'barco',
    modifica: (_ctx, _yo, c) => (c.tipo === 'distancia' ? DISTANCIA_BARCO : 0),
  },
  alBarco('casco', 'danoMaximo', 'dano'),
  alBarco('hamacas', 'capacidad', 'capacidad'),
  alBarco('mascaron', 'danoMaximo', 'dano'),
  alPortador('sable', 'COM'),
  alPortador('brujula', 'NAV'),
  alPortador('catalejo', 'EXP'),
  alPortador('coleto', 'vida'),
  alPortador('espada', 'COM'),
  {
    clave: 'polvora_rey.municion',
    carta: 'polvora_rey',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, _yo, c) => {
      if (c.tipo !== 'municionMaxima') return 0
      const destino = DATOS.mejorasBarco.find((m) => m.id === copia(ctx.s, c.carta).id)
      return destino?.canon ? numeroConIcono(textoDe('polvora_rey'), 'municion') : 0
    },
  },
  {
    clave: 'mapa_calas.avance',
    carta: 'mapa_calas',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, _yo, c) =>
      c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'nat'
        ? numeroConIcono(textoDe('mapa_calas'), 'avance')
        : 0,
  },
]
