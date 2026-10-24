// Lo que hacen las cartas de Estado mientras están puestas (fase 16; antes, fichas), como capacidades del registro:
// modificadores (Borracho, Velas rotas, Perseguido, Desánimo), la Obligada de Vía de agua y las Acciones que las quitan
// (Buscado, Envenenado, Sangrando, Asustado, Vía de agua y Velas rotas). Extenuado lo aplica la Fase de Inicio. Lo que pasa al final
// del turno, al asignar (Asustado, Buscado, Aguerrido) o al superar una Prueba (Maldito, Perseguido) lo resuelven las
// tareas correspondientes; Inspirado y Maldito suman al total en prueba.ts (fase 10b).
// También está aquí la carta de Peligro que ocupa el muelle: pagar para descartarla.

import { copia } from '../estado.ts'
import { cartaDeEstado, type EstadoBarco, type FichaTripulante } from '../infoEstados.ts'
import type { Capacidad, InstId, NuevaTarea } from '../tipos.ts'
import { enEntorno } from './comun.ts'

function deTripulante(e: FichaTripulante, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estado' }
}

function deBarco(e: EstadoBarco, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estadoBarco' }
}

/** «Descarta esta carta»: quita ese Estado al Tripulante que lo lleva (vuelve a la reserva). */
function quitarDe(yo: InstId, estado: FichaTripulante): NuevaTarea {
  return { tipo: 'aplicarEfectos', efectos: [{ tipo: 'quitarEstado', estado, a: 'fuente' }], contexto: 'efecto', fuente: yo }
}

export const CAPACIDADES_ESTADOS: Capacidad[] = [
  // Borracho: +1 COM (no poder ser asignado a NAV ni EXP lo comprueba la asignación).
  deTripulante('borracho', {
    clave: 'com',
    ventana: 'constante',
    modifica: (_ctx, yo, c) => (c.tipo === 'habilidad' && c.hab === 'COM' && c.carta === yo ? 1 : 0),
  }),
  // Buscado (fase 10b): «Se quita descartando 1 carta en la Fase de Reclutamiento». No poder ser asignado en Ciudad lo
  // comprueba la asignación.
  deTripulante('buscado', {
    clave: 'quitar',
    ventana: 'accion',
    requisito: (s, yo) => yo !== null && s.paso === 'jugarCartas' && s.mision === null && s.zonas.mano.length >= 1,
    efecto: (_s, yo) =>
      yo
        ? [
            { tipo: 'pagar', cantidad: 1, motivo: 'estado:buscado' },
            { tipo: 'aplicarEfectos', efectos: [{ tipo: 'quitarEstado', estado: 'buscado', a: 'fuente' }], contexto: 'efecto', fuente: yo },
          ]
        : [],
  }),

  // Velas rotas (fase 10b): −1 al total de las Pruebas de NAV en el Mar, y las Distancias aumentan en 1.
  deBarco('velasRotas', {
    clave: 'distancia',
    ventana: 'constante',
    modifica: (_ctx, _yo, c) => (c.tipo === 'distancia' ? 1 : 0),
  }),
  deBarco('velasRotas', {
    clave: 'nav',
    ventana: 'constante',
    modifica: (ctx, _yo, c) => (c.tipo === 'totalPrueba' && c.hab === 'NAV' && enEntorno(ctx.s, 'mar') ? -1 : 0),
  }),
  // Perseguido (fase 10b): los encuentros de tipo Armada reciben +1 de dificultad.
  deBarco('perseguido', {
    clave: 'armada',
    ventana: 'constante',
    modifica: (_ctx, _yo, c) => (c.tipo === 'dificultad' && c.claves.includes('Armada') ? 1 : 0),
  }),
  // Vía de agua (fase 10b): en el Mar, al final de cada carta de Peligro, 1 daño, salvo que agotes a un Tripulante para
  // achicar. Si no tienes a nadie preparado, solo queda el daño.
  deBarco('viaDeAgua', {
    clave: 'dano',
    ventana: 'obligada',
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'cartaResuelta' && enEntorno(s, 'mar'),
    efecto: () => [
      {
        tipo: 'elegirEfectos',
        opciones: [
          { texto: 'Achicar: agota a un Tripulante', efectos: [{ tipo: 'agotarPago', n: 1 }] },
          { texto: 'El Barco sufre 1 daño', efectos: [{ tipo: 'dano', n: 1 }] },
        ],
      },
    ],
  }),

  // ---------------------------------------------------------------------------
  // Fase 16 (Albert): las cartas de Estado dicen cómo se quitan. «Descarta esta carta» la devuelve a la reserva.

  // Envenenado: «Acción: Agota a un Cirujano: descarta esta carta.» (Puede ser él mismo, si es Cirujano.)
  deTripulante('envenenado', {
    clave: 'quitar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: 'Cirujano' }],
    efecto: (_s, yo) => (yo ? [quitarDe(yo, 'envenenado')] : []),
  }),
  // Sangrando: «Acción: Agota a otro Tripulante preparado: descarta esta carta.» (Cualquiera puede vendarlo.)
  deTripulante('sangrando', {
    clave: 'quitar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: null, otro: true }],
    efecto: (_s, yo) => (yo ? [quitarDe(yo, 'sangrando')] : []),
  }),
  // Asustado: «Acción: Agota a un Oficial: descarta esta carta.» (El Capitán es Oficial; también él mismo, si lo es.)
  deTripulante('asustado', {
    clave: 'quitar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: 'Oficial' }],
    efecto: (_s, yo) => (yo ? [quitarDe(yo, 'asustado')] : []),
  }),
  // Vía de agua y Velas rotas: «Acción: Agota a un Carpintero: descarta esta carta.»
  deBarco('viaDeAgua', {
    clave: 'quitar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: 'Carpintero' }],
    efecto: () => [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'quitarEstadoBarco', estado: 'viaDeAgua' }], contexto: 'efecto' }],
  }),
  deBarco('velasRotas', {
    clave: 'quitar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: 'Carpintero' }],
    efecto: () => [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'quitarEstadoBarco', estado: 'velasRotas' }], contexto: 'efecto' }],
  }),
  // Desánimo (junto al Barco): «Obligado: Cuando vayas a robar al final del turno, roba 1 carta menos y descarta esta
  // carta.» El −1 es constante mientras esté puesto (solo cuenta al robar al final del turno); la carta se descarta justo
  // después de robar (tarea `descartarDesanimo`).
  deBarco('desanimo', {
    clave: 'robo',
    ventana: 'constante',
    modifica: (_ctx, _yo, c) => (c.tipo === 'objetivoRobo' ? -1 : 0),
  }),

  // Carta de Peligro en el muelle: «En Jugar cartas puedes pagar N cartas para descartarla».
  {
    clave: 'peligroEnMuelle.descartar',
    carta: 'peligroEnMuelle',
    ventana: 'accion',
    desde: 'peligroEnMuelle',
    requisito: (s, yo) => yo !== null && s.paso === 'jugarCartas' && s.mision === null && s.zonas.mano.length >= (s.peligrosEnMuelle?.[yo] ?? 0),
    efecto: (s, yo) =>
      yo
        ? [
            { tipo: 'pagar', cantidad: s.peligrosEnMuelle?.[yo] ?? 0, motivo: copia(s, yo).id },
            { tipo: 'descartarDelMuelle', carta: yo },
          ]
        : [],
  },
]
