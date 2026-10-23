// Cartas de jugador 2.0 (fase 6): responden a las reglas nuevas de Peligro (Estados, cartas que se quedan en
// juego, Persigue y, desde la fase 14, los descartes de Tripulantes). 4 Tripulantes y 5 Eventos.

import { anotar, nombre } from '../estado.ts'
import { numeroConIcono, primerNumero, textoDe } from '../textos.ts'
import { tieneEstado, tieneEstadoBarco } from '../estados.ts'
import type { FichaTripulante } from '../infoEstados.ts'
import type { Capacidad, CartaId, Estado, NuevaTarea, Ventana } from '../tipos.ts'
import { participa, participantes } from './comun.ts'

function evento(carta: CartaId, ventana: Ventana, resto: Omit<Capacidad, 'clave' | 'carta' | 'ventana' | 'desde'>): Capacidad {
  return { clave: `${carta}.jugar`, carta, ventana, desde: 'mano', ...resto }
}

function alguienCon(s: Estado, estados: readonly FichaTripulante[]): boolean {
  return s.zonas.tripulacion.some((c) => estados.some((e) => tieneEstado(s, c, e)))
}

const MALES: FichaTripulante[] = ['envenenado', 'sangrando', 'asustado']

export const CAPACIDADES_JUGADOR2: Capacidad[] = [
  // Herbolaria: «Agotar: Quita 1 Estado a un Tripulante: Envenenado, Sangrando o Asustado.»
  {
    clave: 'herbolaria.quitar',
    carta: 'herbolaria',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => alguienCon(s, MALES),
    efecto: () => [{ tipo: 'quitarUnEstado', estados: [...MALES] }],
  },

  // Práctico del puerto: «Respuesta: Después de que superes una Prueba de NAV en la que participe, quita Vía de
  // agua o Velas rotas del Barco.»
  {
    clave: 'practico.barco',
    carta: 'practico',
    ventana: 'respuesta',
    desde: 'juego',
    disparo: (s, yo, ev, fase) =>
      fase === 'despues' &&
      ev.tipo === 'superarPrueba' &&
      s.prueba?.hab === 'NAV' &&
      participa(s, yo) &&
      (tieneEstadoBarco(s, 'viaDeAgua') || tieneEstadoBarco(s, 'velasRotas')),
    efecto: (s): NuevaTarea[] => {
      const via = tieneEstadoBarco(s, 'viaDeAgua')
      const velas = tieneEstadoBarco(s, 'velasRotas')
      if (via && velas) {
        return [
          {
            tipo: 'elegirEfectos',
            opciones: [
              { texto: 'Quitar Vía de agua', efectos: [{ tipo: 'quitarEstadoBarco', estado: 'viaDeAgua' }] },
              { texto: 'Quitar Velas rotas', efectos: [{ tipo: 'quitarEstadoBarco', estado: 'velasRotas' }] },
            ],
          },
        ]
      }
      return [{ tipo: 'quitarEstadoBarco', estado: via ? 'viaDeAgua' : 'velasRotas' }]
    },
  },

  // La Lengua: «Los encuentros #Civil# en los que participe La Lengua reciben −1 de dificultad.»
  {
    clave: 'lengua.civil',
    carta: 'lengua',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) =>
      c.tipo === 'dificultad' && yo !== null && c.claves.includes('Civil') && (ctx.participantes ?? participantes(ctx.s)).includes(yo) ? -1 : 0,
  },

  // Fiador de la Hermandad (fase 14, fuera el rehén): «Interrupción: Cuando otro Tripulante vaya a ser descartado por una
  // carta de Peligro o una permanente, descarta a Fiador de la Hermandad en su lugar y roba 2.» No vale para los que caen
  // por heridas. Las permanentes, desde la tercera ronda (P90).
  {
    clave: 'fiador.descarte',
    carta: 'fiador',
    ventana: 'interrupcion',
    desde: 'juego',
    disparo: (s, yo, ev, fase) =>
      fase === 'antes' && ev.tipo === 'descartarTripulante' && ev.dePeligro && yo !== null && ev.carta !== yo && s.zonas.tripulacion.includes(yo),
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

  // Cortar por lo sano: «Acción: Descarta 2 cartas de tu mano: Devuelve al mazo de historia una carta de la zona de
  // permanentes.» (Fase 11; antes, «Descarta una carta de Peligro que se quede en juego».) Coste 0: solo cuesta las 2
  // cartas de su capacidad. La carta que no deba poder quitarse así lo dirá en su texto (fase 10b).
  evento('cortar', 'accion', {
    coste: [{ tipo: 'pagar', n: 2 }],
    requisito: (s) => cortables(s).length > 0,
    efecto: (s) => [{ tipo: 'quitarPermanente', candidatas: cortables(s) }],
  }),

  // ¡A por ellos! (fase 14, fuera el rehén): «Interrupción: Cuando un Tripulante vaya a ser descartado por una carta de
  // Peligro o una permanente, haz una Prueba de COM 3. Si la superas, no se descarta.» No vale para los que caen por
  // heridas. Las permanentes, desde la tercera ronda (P90). La Prueba
  // es normal (se asigna, Destino, Sin oposición) y se hace en el momento, aunque haya otra a medio resolver (la del
  // encuentro que lo descarta): esa se aparta mientras tanto y después se sigue con ella.
  evento('a_por_ellos', 'interrupcion', {
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'descartarTripulante' && ev.dePeligro,
    efecto: (_s, yo, suceso) =>
      yo && suceso
        ? [
            {
              tipo: 'pruebaSuelta',
              fuente: yo,
              paso: 'empezar',
              anidada: true,
              cancelaSuceso: suceso.id,
              definicion: {
                nombre: '¡A por ellos!',
                palabrasClave: [],
                opciones: [{ hab: 'COM', dificultad: primerNumero(textoDe('a_por_ellos')) }],
                exito: [],
                fallo: [],
              },
            },
          ]
        : [],
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

  // Virar y dar la cara: «Interrupción: Agota un Cañón: Cuando un Destino vaya a poner su carta encima del mazo de
  // Peligros, ponla al fondo del mazo en su lugar.» P89 (Albert): también en un Abordaje; agotar el Cañón es el precio de
  // esta carta, no una capacidad del Cañón.
  evento('virar', 'interrupcion', {
    coste: [{ tipo: 'agotarCanon' }],
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'persigue' && !ev.alFondo,
    efecto: (_s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'persigue') suceso.ev.alFondo = true
      return []
    },
  }),
]

/** Permanentes que «Cortar por lo sano» puede devolver al mazo de historia (todas las de la zona de permanentes). */
// Fase 11 (P63): «¡La guardia!» también es una permanente: Cortar puede devolverla.
function cortables(s: Estado) {
  return [...s.zonas.permanentes]
}
