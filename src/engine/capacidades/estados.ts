// Lo que hacen las fichas de Estado mientras están puestas, como capacidades del registro: modificadores
// (Borracho, Velas rotas, Perseguido), la Obligada de Vía de agua y la Acción que quita Buscado. Lo que pasa al final
// del turno, al asignar (Asustado, Buscado, Aguerrido) o al superar una Prueba (Maldito, Perseguido) lo resuelven las
// tareas correspondientes; Inspirado y Maldito suman al total en prueba.ts (fase 10b).
// También está aquí la carta de Peligro que ocupa el muelle: pagar para descartarla.

import { copia } from '../estado.ts'
import { cartaDeEstado, type EstadoBarco, type FichaTripulante } from '../infoEstados.ts'
import type { Capacidad } from '../tipos.ts'
import { enEntorno } from './comun.ts'

function deTripulante(e: FichaTripulante, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estado' }
}

function deBarco(e: EstadoBarco, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estadoBarco' }
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
