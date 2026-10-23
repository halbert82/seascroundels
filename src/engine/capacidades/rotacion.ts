// Fase 14 · Rotación de la tripulación: seis Tripulantes nuevos (241–246).
// «Enrolado N» es una palabra clave: su regla está en el motor (al reclutar, tareas/jugar.ts, y al final de cada turno,
// tareas/tripulacion.ts). Aquí cada carta registra la suya, para que el registro de capacidades sepa que la carta tiene
// texto con regla. La Carne de cañón y el Galeote fugado pagan una herida para sumar, como el Filibustero borracho.

import { copia } from '../estado.ts'
import { numeroConIcono, textoDe } from '../textos.ts'
import type { Habilidad } from '../datos.ts'
import type { Capacidad, CartaId } from '../tipos.ts'
import { participa, participantes } from './comun.ts'

/** La palabra clave de la carta: su regla la aplica el motor (no modifica nada por sí misma). */
function enrolado(carta: CartaId): Capacidad {
  return { clave: `${carta}.enrolado`, carta, ventana: 'constante', desde: 'juego' }
}

/**
 * «Sufre 1 herida: … para esta Prueba. (Límite de una vez por turno.)» Como el Filibustero borracho: se ofrece durante
 * una Prueba de su habilidad si participa, o antes de elegir la opción si aún puede comprometerse (no está agotado).
 * El efecto dura hasta el final de la Prueba; si la herida del coste lo derrota, el efecto se queda (N13: el coste se
 * da por pagado).
 */
function sufreHerida(carta: CartaId, hab: Habilidad, temporal: string): Capacidad {
  return {
    clave: `${carta}.esfuerzo`,
    carta,
    ventana: 'libre',
    desde: 'juego',
    limite: { veces: 1, por: 'turno' },
    coste: [{ tipo: 'herida', n: numeroConIcono(textoDe(carta), 'herida') }],
    requisito: (s, yo) => {
      const p = s.prueba
      if (!p || p.automatica || !yo || s.temporales.some((x) => x.clave === temporal && x.inst === yo)) return false
      if (p.hab === null) return !copia(s, yo).agotada
      return p.hab === hab && participa(s, yo)
    },
    efecto: (_s, yo) => (yo ? [{ tipo: 'anadirTemporal', temporal: { clave: temporal, fuente: carta, hasta: 'finPrueba', inst: yo } }] : []),
  }
}

export const CAPACIDADES_ROTACION: Capacidad[] = [
  // «Enrolado 2.»: entra con 2 fichas; al final de cada turno pierde 1 y, sin ninguna, se va.
  enrolado('soldado_fortuna'),
  enrolado('piloto_sueldo'),
  enrolado('guia_alquiler'),

  // Carne de cañón: «Sufre 1 herida: los demás Tripulantes asignados a esta Prueba reciben +1 COM.»
  sufreHerida('carne_canon', 'COM', 'carne_canon.com'),
  {
    clave: 'carne_canon.com',
    carta: 'carne_canon',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, yo, c) =>
      c.tipo === 'habilidad' && c.hab === 'COM' && yo !== null && c.carta !== yo && (ctx.participantes ?? participantes(ctx.s)).includes(c.carta)
        ? numeroConIcono(textoDe('carne_canon'), 'COM')
        : 0,
  },

  // Galeote fugado: «Sufre 1 herida: Galeote fugado recibe +2 NAV para esta Prueba.»
  sufreHerida('galeote', 'NAV', 'galeote.nav'),
  {
    clave: 'galeote.nav',
    carta: 'galeote',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, yo, c) => (c.tipo === 'habilidad' && c.hab === 'NAV' && c.carta === yo ? numeroConIcono(textoDe('galeote'), 'NAV') : 0),
  },

  // El Tuerto: «El Tuerto recibe +1 COM por cada herida que tenga.» (sube con cada herida y baja al curarse).
  {
    clave: 'tuerto.com',
    carta: 'tuerto',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) =>
      c.tipo === 'habilidad' && c.hab === 'COM' && c.carta === yo && yo ? copia(ctx.s, yo).heridas * numeroConIcono(textoDe('tuerto'), 'COM') : 0,
  },
]
