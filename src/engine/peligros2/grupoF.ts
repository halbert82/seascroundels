// Peligros 2.0 · Grupo F (fase 15): ocho cartas nuevas (247–254), con las palabras clave Descomunal y Alerta, «Un
// respiro» (descansar o seguir), descartar del mazo del capitán, la permanente «Mala fama» y fallos según por cuánto.

import { tipoDe } from '../catalogo.ts'
import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import type { Efecto } from '../efectos.ts'
import { copia } from '../estado.ts'
import { agotar, avance, comprometidoCon, dano, descartar, enElMar, heridas, mas, pierdesAvance, preparar, reputacion, robar } from './comun.ts'

// Ayudas ----------------------------------------------------------------------

/** «Descarta la carta superior (las N cartas superiores) de tu mazo del capitán.» */
const descartarMazo = (n: number): Efecto => ({ tipo: 'descartarMazoCapitan', n })
/** «Si fallas por 1, …; si fallas por 2 o más, ….» */
const segunLoQueFalte = (porUno: Efecto[], porDos: Efecto[]): Efecto => ({ tipo: 'si', condicion: { tipo: 'falladaPor', minimo: 2 }, entonces: porDos, sino: porUno })
/** «Descansar: pierde 2 de Avance de esta misión: …» o «Seguir: +1 de Avance». Si no puedes perder 2, no se ofrece. */
function descansarOSeguir(descansar: string, efectos: Efecto[]): Efecto {
  return {
    tipo: 'elegir',
    opciones: [
      { texto: `Descansar: pierdes 2 de Avance de esta misión y ${descansar}`, efectos: [pierdesAvance(2), ...efectos] },
      { texto: 'Seguir: +1 de Avance', efectos: [avance(1)] },
    ],
  }
}

// 247. Fuerza bruta · Descomunal 2 ---------------------------------------------------

registrarPeligro('p2_fuerza', {
  encuentros: {
    mar: { descomunal: 2, fallo: [dano(2)] },
    nat: { descomunal: 2, fallo: [heridas(2)] },
    ciu: { descomunal: 2, fallo: [descartar(1)] },
  },
  // −1. Sin oposición: agota a 1 Tripulante.
  destino: { sinOposicion: [agotar(1)] },
})

// 248. Arrimar el hombro · Descomunal 2 ----------------------------------------------

registrarPeligro('p2_hombro', {
  encuentros: {
    mar: { descomunal: 2, fallo: [agotar(1)] },
    nat: { descomunal: 2, fallo: [pierdesAvance(1)] },
    ciu: { descomunal: 2, exito: [robar(2)], fallo: [{ tipo: 'descartarAzar', n: 2 }] },
  },
  // 0. Sin oposición: descarta 1 carta.
  destino: { sinOposicion: [descartar(1)] },
})

// 249. La ronda de noche · Alerta ----------------------------------------------------

registrarPeligro('p2_ronda', {
  encuentros: {
    mar: { alerta: true, fallo: [{ tipo: 'estadoBarco', estado: 'perseguido' }] },
    // «El Tripulante asignado con más EXP queda Buscado» (sin nadie asignado, el de más EXP de la tripulación: P72).
    nat: { alerta: true, fallo: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'buscado' })] },
    ciu: { alerta: true, fallo: [heridas(2)] },
  },
  // −1. Sin oposición: agota a 1 Tripulante.
  destino: { sinOposicion: [agotar(1)] },
})

// 250. Sin escapatoria · Alerta ------------------------------------------------------

registrarPeligro('p2_escapatoria', {
  encuentros: {
    mar: { alerta: true, fallo: [dano(1)] },
    nat: { alerta: true, fallo: [heridas(2)] },
    ciu: { alerta: true, fallo: [descartar(2)] },
  },
  // −2. Sin oposición: inflige 1 herida.
  destino: { sinOposicion: [heridas(1)] },
})

// 251. Un respiro · sin Prueba, Avance 0, «Elige» -------------------------------------
// Perder el Avance es el precio de Descansar: si no puedes perder 2, esa opción no se ofrece (y solo queda Seguir).

registrarPeligro('p2_respiro', {
  encuentros: {
    mar: { efecto: [descansarOSeguir('preparas a todos tus Tripulantes y curas 1 herida a cada uno', [preparar('todos'), { tipo: 'curar', n: 1, modo: 'cadaUno' }])] },
    nat: { efecto: [descansarOSeguir('preparas a todos tus Tripulantes', [preparar('todos')])] },
    ciu: { efecto: [descansarOSeguir('quitas todos los Estados de tus Tripulantes', [{ tipo: 'quitarTodosLosEstados' }])] },
  },
  // +1. Sin oposición: −1 de Avance (mín. 0) en el encuentro de esta Prueba.
  destino: { sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})

// 252. Provisiones perdidas ----------------------------------------------------------

registrarPeligro('p2_provisiones', {
  encuentros: {
    mar: { fallo: [descartarMazo(2)] },
    nat: { fallo: [descartarMazo(1)] },
    ciu: { fallo: [descartarMazo(2)] },
  },
  // −1. Sin oposición: descarta la carta superior de tu mazo del capitán.
  destino: { sinOposicion: [descartarMazo(1)] },
})

// 253. Malas lenguas -----------------------------------------------------------------
// «Pon en juego la carta 136 del mazo de historia; si ya está en juego, descarta 1 carta.»

const malaFama: Efecto = { tipo: 'ponerEnJuego', carta: 'pm_malafama', siYa: [descartar(1)] }

registrarPeligro('p2_lenguas', {
  encuentros: {
    mar: { fallo: [malaFama] },
    nat: { fallo: [descartar(2)] },
    ciu: { fallo: [malaFama] },
  },
  // 0. Sin oposición: descarta 1 carta.
  destino: { sinOposicion: [descartar(1)] },
})

// Permanente 136 «Mala fama» (Civil): los Tripulantes te cuestan 1 carta más. Acción: descarta 2 cartas de tu mano para
// devolverla al mazo de historia.
// P95 (Albert): se queda en juego al terminar la misión (si volviera al mazo de historia con las demás permanentes, nunca
// encarecería nada, porque se recluta en puerto). La carta lo dice en su primera línea.
registrarPermanente('pm_malafama', {
  seQueda: true,
  quitar: [{ tipo: 'pagar', n: 2 }],
  capacidades: [
    {
      clave: 'cara',
      ventana: 'constante',
      modifica: (ctx, _yo, c) => (c.tipo === 'coste' && tipoDe(copia(ctx.s, c.carta).id) === 'tripulante' ? 1 : 0),
    },
  ],
})

// 254. Mar de fondo · fallos según por cuánto falles ---------------------------------

registrarPeligro('p2_fondo', {
  encuentros: {
    mar: { fallo: [segunLoQueFalte([dano(1)], [dano(2), { tipo: 'estadoBarco', estado: 'viaDeAgua' }])] },
    nat: { fallo: [segunLoQueFalte([heridas(1)], [heridas(3)])] },
    ciu: { fallo: [segunLoQueFalte([descartar(1)], [reputacion(-1)])] },
  },
  // −1. Sin oposición: en el Mar, daña 1; en Naturaleza o Ciudad, inflige 1 herida.
  destino: { sinOposicion: [enElMar([dano(1)], [heridas(1)])] },
})
