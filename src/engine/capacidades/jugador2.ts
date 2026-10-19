// Cartas de jugador 2.0 (fase 6): responden a las reglas nuevas de Peligro (Estados, cartas que se quedan en
// juego, rehenes, Persigue). 4 Tripulantes y 5 Eventos.

import { anotar, nombre } from '../estado.ts'
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

  // Fiador de la Hermandad: «Interrupción: Cuando otro Tripulante vaya a quedar rehén, Fiador de la Hermandad queda
  // rehén en su lugar. Si lo rescatas, roba 2.»
  {
    clave: 'fiador.rehen',
    carta: 'fiador',
    ventana: 'interrupcion',
    desde: 'juego',
    disparo: (s, yo, ev, fase) => fase === 'antes' && ev.tipo === 'rehen' && yo !== null && ev.carta !== yo && s.zonas.tripulacion.includes(yo),
    efecto: (s, yo, suceso) => {
      if (yo && suceso?.ev.tipo === 'rehen') {
        anotar(s, 'efecto', `${nombre(s, yo)} queda rehén en lugar de ${nombre(s, suceso.ev.carta)}.`)
        suceso.ev.carta = yo
      }
      return []
    },
  },
  {
    clave: 'fiador.rescate',
    carta: 'fiador',
    ventana: 'obligada',
    desde: 'juego',
    disparo: (_s, yo, ev, fase) => fase === 'despues' && ev.tipo === 'rescatado' && ev.carta === yo,
    efecto: () => [{ tipo: 'robar', n: 2 }],
  },

  // Cataplasma: «Quita Envenenado o Sangrando a un Tripulante y cúrale 1 herida.»
  // Solo se juega si algún Tripulante tiene Envenenado o Sangrando (P23). Fase 10b: la curación solo quita heridas.
  evento('cataplasma', 'libre', {
    requisito: (s) => alguienCon(s, ['envenenado', 'sangrando']),
    efecto: () => [{ tipo: 'quitarUnEstado', estados: ['envenenado', 'sangrando'], curar: 1 }],
  }),

  // Cortar por lo sano: «Acción: Descarta 2 cartas de tu mano: Descarta una carta de Peligro que se quede en juego.»
  // Fase 10b: sin la excepción por nivel; la carta que no deba poder quitarse lo dirá en su texto.
  // Coste 0: solo cuesta las 2 cartas de su capacidad.
  evento('cortar', 'accion', {
    coste: [{ tipo: 'pagar', n: 2 }],
    requisito: (s) => cortables(s).length > 0,
    efecto: (s) => [{ tipo: 'quitarPeligroEnJuego', candidatas: cortables(s) }],
  }),

  // ¡A por ellos!: «Acción: Haz una Prueba de COM 3. Si la superas, rescata a todos los rehenes de esta misión:
  // vuelven preparados.» Es una Prueba normal y solo se juega durante una misión (y no durante otra Prueba, P2).
  evento('a_por_ellos', 'accion', {
    requisito: (s) => s.mision !== null && s.mision.fin === null && s.prueba === null,
    efecto: (_s, yo) =>
      yo
        ? [
            {
              tipo: 'pruebaSuelta',
              fuente: yo,
              paso: 'empezar',
              definicion: {
                nombre: '¡A por ellos!',
                palabrasClave: [],
                opciones: [{ hab: 'COM', dificultad: 3 }],
                exito: [{ tipo: 'rescatarRehenes', preparados: true }],
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
  // Peligros, ponla al fondo del mazo en su lugar.»
  evento('virar', 'interrupcion', {
    coste: [{ tipo: 'agotarCanon' }],
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'persigue' && !ev.alFondo,
    efecto: (_s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'persigue') suceso.ev.alFondo = true
      return []
    },
  }),
]

/** Cartas de Peligro en juego que «Cortar por lo sano» puede descartar (todas, fase 10b). */
function cortables(s: Estado) {
  return [...s.zonas.peligrosEnJuego]
}
