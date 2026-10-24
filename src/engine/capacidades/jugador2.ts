// Cartas de jugador 2.0 (fase 6): responden a las reglas nuevas de Peligro (Estados, cartas que se quedan en
// juego y, desde la fase 14, los descartes de Tripulantes). 3 Tripulantes y 4 Eventos (fase 15, quinta ronda: fuera el
// Práctico del puerto; revisión de Albert: fuera «Cortar por lo sano»).

import { anotar, nombre } from '../estado.ts'
import { numeroConIcono, numeroTras, textoDe } from '../textos.ts'
import { tieneEstado } from '../estados.ts'
import type { FichaTripulante } from '../infoEstados.ts'
import type { Capacidad, CartaId, Estado, Ventana } from '../tipos.ts'
import { conPruebaDe, enEntorno, participantes, peligroRevelado } from './comun.ts'

function evento(carta: CartaId, ventana: Ventana, resto: Omit<Capacidad, 'clave' | 'carta' | 'ventana' | 'desde'>): Capacidad {
  return { clave: `${carta}.jugar`, carta, ventana, desde: 'mano', ...resto }
}

function alguienCon(s: Estado, estados: readonly FichaTripulante[]): boolean {
  return s.zonas.tripulacion.some((c) => estados.some((e) => tieneEstado(s, c, e)))
}

// Fase 15, quinta ronda: la Herbolaria ya no quita Asustado.
const MALES: FichaTripulante[] = ['envenenado', 'sangrando']

export const CAPACIDADES_JUGADOR2: Capacidad[] = [
  // Herbolaria: «Agotar: Quita el Estado Envenenado o Sangrando de un Tripulante.»
  {
    clave: 'herbolaria.quitar',
    carta: 'herbolaria',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => alguienCon(s, MALES),
    efecto: () => [{ tipo: 'quitarUnEstado', estados: [...MALES] }],
  },

  // Lenguaraz (antes La Lengua): «Los encuentros #Civil# en los que participe Lenguaraz reciben −1 de dificultad.»
  {
    clave: 'lengua.civil',
    carta: 'lengua',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) =>
      c.tipo === 'dificultad' && yo !== null && c.claves.includes('Civil') && (ctx.participantes ?? participantes(ctx.s)).includes(yo) ? -1 : 0,
  },

  // Fiador de la Hermandad (fase 14, fuera el rehén): «Interrupción: Cuando otro Tripulante vaya a ser descartado por un
  // efecto de juego, descarta a Fiador de la Hermandad en su lugar y [2 robar].» Fase 15, quinta ronda (Albert): vale
  // contra cualquier efecto, no solo Peligros y permanentes. No vale para los que caen por heridas, ni para despedir, ni
  // para el que se va al acabarse su Enrolado («se va», no se descarta), ni para el que se descarta él mismo para pagar
  // un coste (el Grumete leal).
  {
    clave: 'fiador.descarte',
    carta: 'fiador',
    ventana: 'interrupcion',
    desde: 'juego',
    disparo: (s, yo, ev, fase) =>
      fase === 'antes' && ev.tipo === 'descartarTripulante' && yo !== null && ev.carta !== yo && s.zonas.tripulacion.includes(yo),
    efecto: (s, yo, suceso) => {
      if (!yo || suceso?.ev.tipo !== 'descartarTripulante') return []
      anotar(s, 'efecto', `${nombre(s, yo)} se descarta en lugar de ${nombre(s, suceso.ev.carta)}.`)
      suceso.ev.carta = yo
      return [{ tipo: 'robar', n: numeroConIcono(textoDe('fiador'), 'robar') }]
    },
  },

  // Cataplasma: «Quita Envenenado o Sangrando a un Tripulante y cúrale 1 herida.»
  // Solo se juega si algún Tripulante tiene Envenenado o Sangrando (P23). Fase 10b: la curación solo quita heridas.
  evento('cataplasma', 'libre', {
    requisito: (s) => alguienCon(s, ['envenenado', 'sangrando']),
    efecto: () => [{ tipo: 'quitarUnEstado', estados: ['envenenado', 'sangrando'], curar: 1 }],
  }),

  // Revisión de Albert: fuera «Cortar por lo sano» (devolvía cualquier permanente al mazo de historia).

  // «¡Nadie se queda atrás!» (revisión de Albert; antes «¡A por ellos!», con una Prueba de COM 3): «Interrupción: Cuando un
  // Tripulante vaya a ser descartado por un efecto de juego, destina 3 [COM] para evitarlo.» Destina es un coste: agotas
  // Tripulantes preparados cuya COM sume 3, sin Destino ni cartas de la mano. Vale contra cualquier efecto (como el Fiador):
  // no para los que caen por heridas, ni para despedir, ni para el que se va al acabarse su Enrolado, ni para el que se
  // descarta él mismo para pagar un coste (ninguno de esos es «descartado por un efecto»).
  evento('a_por_ellos', 'interrupcion', {
    coste: [{ tipo: 'destina', n: numeroTras(textoDe('a_por_ellos'), 'destina'), hab: 'COM' }],
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'descartarTripulante',
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo !== 'descartarTripulante') return []
      suceso.cancelado = true
      anotar(s, 'efecto', `${nombre(s, suceso.ev.carta)} no se descarta.`)
      return []
    },
  }),

  // Ron para los valientes: «Acción: Un Tripulante queda Borracho y Aguerrido.»
  evento('ron_valientes', 'accion', {
    efecto: () => [
      {
        tipo: 'aQuien',
        quien: { de: 'tripulacion', por: 'eleccion' },
        hacer: {
          tipo: 'varios',
          acciones: [
            { tipo: 'estado', estado: 'borracho' },
            { tipo: 'estado', estado: 'aguerrido' },
          ],
        },
      },
    ],
  }),

  // Virar y dar la cara (revisión de Albert; antes mandaba al fondo la carta de Persigue): «Respuesta: [Mar]: Después de
  // que reveles una carta de Peligro cuyo encuentro tenga una Prueba de [NAV], agota un Cañón: esa Prueba es de [COM] en
  // lugar de [NAV].» Misma dificultad y los mismos modificadores del encuentro; la habilidad pasa a ser COM (así cuentan
  // las bonificaciones de COM y no las de NAV). Agotar el Cañón es el precio de esta carta (P89), también en un Abordaje.
  evento('virar', 'respuesta', {
    coste: [{ tipo: 'agotarCanon' }],
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' && enEntorno(s, 'mar') && peligroRevelado(s, ev) && s.mision?.navAcom !== ev.carta && conPruebaDe(s, ev.carta, 'NAV'),
    efecto: (s, _yo, suceso) => {
      if (s.mision && suceso?.ev.tipo === 'revelarPeligro') {
        s.mision.navAcom = suceso.ev.carta
        anotar(s, 'efecto', 'Viráis y dais la cara: la Prueba de NAV de este encuentro es de COM.')
      }
      return []
    },
  }),
]
