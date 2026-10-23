// Capacidades de los Tesoros de la fase 15: el Gallardete de San Juan, la Carta de marear de van Hoorn, la Cadena de oro
// del San José y La custodia de esmeraldas. Los números se leen de su texto.

import { porId, tipoDe } from '../catalogo.ts'
import { anotar, copia } from '../estado.ts'
import { numeroConIcono, numerosEntreLlaves, textoDe } from '../textos.ts'
import type { Capacidad } from '../tipos.ts'
import { mover } from '../zonas.ts'

export const CAPACIDADES_TESOROS15: Capacidad[] = [
  // Gallardete de San Juan (148): «Indestructible. +1 Mando.»
  {
    clave: 'gallardete.mando',
    carta: 'gallardete',
    ventana: 'constante',
    desde: 'juego',
    modifica: (_ctx, _yo, c) => (c.tipo === 'mando' ? numeroConIcono(textoDe('gallardete'), 'MAN') : 0),
  },
  // Carta de marear de van Hoorn (263): «Indestructible. Tus misiones [mar] necesitan {−1 avance}.»
  {
    clave: 'carta_marear.avance',
    carta: 'carta_marear',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, _yo, c) => {
      if (c.tipo !== 'avanceNecesario') return 0
      const e = porId(copia(ctx.s, c.mision).id)
      return e.tipo === 'capitulo' && e.carta.entorno === 'mar' ? numeroConIcono(textoDe('carta_marear'), 'avance') : 0
    },
  },
  // Cadena de oro del San José (270): «Acción: Descarta esta carta: este turno, el próximo Tripulante o Mejora que reclutes
  // o adquieras cuesta {3} menos.» Un Tesoro que se descarta vuelve al mazo de historia (sale de la partida).
  {
    clave: 'cadena_oro.gastar',
    carta: 'cadena_oro',
    ventana: 'accion',
    desde: 'juego',
    requisito: (s) => !s.temporales.some((x) => x.clave === 'cadena_oro.descuento'),
    efecto: (s, yo) => {
      if (yo) {
        mover(s, yo, 'mazoHistoria', 'abajo')
        anotar(s, 'efecto', `Descartas la Cadena de oro del San José: este turno, el próximo Tripulante o Mejora que consigas cuesta ${numerosEntreLlaves(textoDe('cadena_oro'))[0] ?? 0} menos.`)
      }
      return [{ tipo: 'anadirTemporal', temporal: { clave: 'cadena_oro.descuento', fuente: 'cadena_oro', hasta: 'finTurno' } }]
    },
  },
  {
    clave: 'cadena_oro.descuento',
    carta: 'cadena_oro',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo !== 'coste') return 0
      const tipo = tipoDe(copia(ctx.s, c.carta).id)
      return tipo === 'tripulante' || tipo === 'mejoraBarco' || tipo === 'mejoraTripulante' ? -(numerosEntreLlaves(textoDe('cadena_oro'))[0] ?? 0) : 0
    },
  },
  // La custodia de esmeraldas (271): «Indestructible. Al entrar en juego, gana {2 rep}.» Se aplica sola.
  {
    clave: 'custodia.entrar',
    carta: 'custodia',
    ventana: 'obligada',
    desde: 'juego',
    disparo: (_s, yo, ev, fase) => fase === 'despues' && ev.tipo === 'entraEnJuego' && ev.carta === yo,
    efecto: () => [{ tipo: 'cambiarReputacion', n: numeroConIcono(textoDe('custodia'), 'rep') }],
  },
]
