// Lo que hacen las fichas de Estado mientras están puestas, como capacidades del registro: modificadores
// (Borracho, Buscado, Velas rotas), Obligadas (Incendio a bordo, Vía de agua) y Acciones para quitarlas
// (Encadenado, Incendio a bordo). Lo que pasa al final del turno, al curar, al reparar o al comprometerse lo
// resuelven las tareas correspondientes.
// También está aquí la carta de Peligro que ocupa el muelle: pagar para descartarla.

import { copia, nombre } from '../estado.ts'
import { cartaDeEstado, type EstadoBarco, type FichaTripulante } from '../infoEstados.ts'
import type { Capacidad, NuevaTarea } from '../tipos.ts'
import { enEntorno, participantes } from './comun.ts'

function deTripulante(e: FichaTripulante, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estado' }
}

function deBarco(e: EstadoBarco, resto: Omit<Capacidad, 'carta' | 'desde' | 'clave'> & { clave: string }): Capacidad {
  return { ...resto, clave: `${cartaDeEstado(e)}.${resto.clave}`, carta: cartaDeEstado(e), desde: 'estadoBarco' }
}

const unDano: NuevaTarea = { tipo: 'evento', ev: { tipo: 'danoBarco', cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] }

export const CAPACIDADES_ESTADOS: Capacidad[] = [
  // Borracho: +1 COM (no poder comprometerse a NAV ni EXP lo comprueba el compromiso).
  deTripulante('borracho', {
    clave: 'com',
    ventana: 'constante',
    modifica: (_ctx, yo, c) => (c.tipo === 'habilidad' && c.hab === 'COM' && c.carta === yo ? 1 : 0),
  }),
  // Buscado: en Ciudad, los encuentros Guardia y Militar reciben +1 si participa.
  deTripulante('buscado', {
    clave: 'dificultad',
    ventana: 'constante',
    modifica: (ctx, yo, c) =>
      c.tipo === 'dificultad' &&
      yo !== null &&
      enEntorno(ctx.s, 'ciu') &&
      c.claves.some((k) => k === 'Guardia' || k === 'Militar') &&
      (ctx.participantes ?? participantes(ctx.s)).includes(yo)
        ? 1
        : 0,
  }),
  // Encadenado: «Prueba de COM o EXP 3 en una ventana de acción para quitarlo». No durante otra Prueba (P2).
  deTripulante('encadenado', {
    clave: 'liberar',
    ventana: 'accion',
    requisito: (s, yo) => yo !== null && s.prueba === null,
    efecto: (s, yo) =>
      yo
        ? [
            {
              tipo: 'pruebaSuelta',
              fuente: yo,
              paso: 'empezar',
              definicion: {
                nombre: `Liberar a ${nombre(s, yo)}`,
                palabrasClave: [],
                opciones: [
                  { hab: 'COM', dificultad: 3 },
                  { hab: 'EXP', dificultad: 3 },
                ],
                exito: [{ tipo: 'quitarEstado', estado: 'encadenado', a: 'fuente' }],
                fallo: [],
              },
            },
          ]
        : [],
  }),

  // Velas rotas: las Distancias son 1 mayores (el +1 de NAV del Barco lo anula la propia capacidad del Barco).
  deBarco('velasRotas', {
    clave: 'distancia',
    ventana: 'constante',
    modifica: (_ctx, _yo, c) => (c.tipo === 'distancia' ? 1 : 0),
  }),
  // Incendio a bordo: al revelar cada carta de Peligro, 1 daño, solo en misiones de Mar como Vía de agua (P4).
  deBarco('incendio', {
    clave: 'dano',
    ventana: 'obligada',
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarPeligro' && enEntorno(s, 'mar'),
    efecto: () => [unDano],
  }),
  // Incendio a bordo: se apaga agotando a un Tripulante en una ventana de acción.
  deBarco('incendio', {
    clave: 'apagar',
    ventana: 'accion',
    coste: [{ tipo: 'agotarTripulante', rasgo: null }],
    efecto: () => [{ tipo: 'quitarEstadoBarco', estado: 'incendio' }],
  }),
  // Vía de agua: al final de cada carta de Peligro en el Mar, 1 daño.
  deBarco('viaDeAgua', {
    clave: 'dano',
    ventana: 'obligada',
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'cartaResuelta' && enEntorno(s, 'mar'),
    efecto: () => [unDano],
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
