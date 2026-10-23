// Fase 14 · Rotación de la tripulación: seis Tripulantes nuevos (241–246).
// «Enrolado N» y «Desgaste» son palabras clave: sus reglas están en el motor (al reclutar y al terminar la misión,
// tareas/jugar.ts y tareas/tripulacion.ts; al cerrar la Prueba, peligros.ts). Aquí cada carta registra la suya, para que
// el registro de capacidades sepa que la carta tiene texto con regla.

import { copia } from '../estado.ts'
import { numeroConIcono, textoDe } from '../textos.ts'
import type { Capacidad, CartaId } from '../tipos.ts'

/** La palabra clave de la carta: su regla la aplica el motor (no modifica nada por sí misma). */
function palabraClave(carta: CartaId, clave: 'enrolado' | 'desgaste'): Capacidad {
  return { clave: `${carta}.${clave}`, carta, ventana: 'constante', desde: 'juego' }
}

export const CAPACIDADES_ROTACION: Capacidad[] = [
  // «Enrolado 2.»: entra con 2 fichas; al terminar cada misión pierde 1 y, sin ninguna, se va.
  palabraClave('soldado_fortuna', 'enrolado'),
  palabraClave('piloto_sueldo', 'enrolado'),
  palabraClave('guia_alquiler', 'enrolado'),
  // «Desgaste.»: después de resolver una Prueba a la que esté asignado, sufre 1 herida.
  palabraClave('carne_canon', 'desgaste'),
  palabraClave('galeote', 'desgaste'),
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
