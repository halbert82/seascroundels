// Peligros 2.0 · Grupo A: Mar y clima (cartas 1–11).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { participantes as comprometidosDe } from '../capacidades/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { habilidadImpresa, registrarEspecial } from '../tareas/peligros2.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { agotar as agotarCarta } from '../estados.ts'
import {
  agotar,
  avance,
  cadaComprometido,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  encuentroEs,
  enElMar,
  habilidadDe,
  heridas,
  heridasAsignados,
  mas,
  mejorasDeBarco,
  menos,
  preparaCanon,
  canonesListos,
  noSuman,
  participantesCon,
  participantesCtx,
  pierdesAvance,
  agotaCanones,
  preparar,
  reparar,
  reputacion,
  robar,
  siTienes,
  tieneRasgo,
} from './comun.ts'

// 1. La corriente del Golfo · Favorable
registrarPeligro('p2_corriente', {
  encuentros: {
    // Éxito: +1 Avance por cada punto que superes (máx. +2). Fallo: 1 daño al Barco.
    mar: { exito: [{ tipo: 'porCada', medida: 'margen', efectos: [avance(1)], maximo: 2 }], fallo: [dano(1)] },
    // Éxito: prepara 1 Tripulante. Fallo: un Tripulante comprometido sufre 1 herida.
    nat: { exito: [preparar(1)], fallo: [heridasAsignados(1)] },
    // Puedes agotar a 1 Tripulante para reclutar o adquirir gratis 1 carta del muelle de coste 2 o menos.
    ciu: {
      efecto: [
        {
          tipo: 'elegir',
          opciones: [
            {
              texto: 'Agotar a 1 Tripulante: reclutar o adquirir gratis una carta del muelle de coste 2 o menos',
              efectos: [{ tipo: 'agotarPago', n: 1 }, { tipo: 'gratisDelMuelle', maxCoste: 2, que: 'cualquiera' }],
            },
            { texto: 'No', efectos: [] },
          ],
        },
      ],
    },
  },
  // −1; −2 en su lugar si la Prueba es de NAV. Sin oposición: pierdes 1 Avance.
  destino: { modificador: (_s, p) => (p.hab === 'NAV' ? -2 : -1), sinOposicion: [pierdesAvance(1)] },
})

// 2. Cielo estrellado · Favorable
registrarPeligro('p2_cielo', {
  encuentros: {
    // Mira las 3 de arriba del mazo de Peligros y ordénalas. Si tienes un Piloto en la tripulación, +1 Avance.
    mar: { efecto: [{ tipo: 'mirarOrdenar', n: 3, fondo: 'no' }, siTienes('Piloto', [avance(1)])] },
    nat: { exito: [avance(1)], fallo: [pierdesAvance(1)] },
    // Éxito: el comprometido con más EXP queda Inspirado y robas 1. Fallo: descarta 1 carta.
    ciu: { exito: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'inspirado' }), robar(1)], fallo: [descartar(1)] },
  },
  // −1. Las cartas de tu mano no suman en esta Prueba (las que se comprometieron no cuentan). Sin oposición: +1 en su lugar.
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 1 : -1), prueba: { sinCartas: true } },
})

// 3. Calma chicha · Leve
registrarPeligro('p2_calma', {
  encuentros: {
    mar: {
      elige: [
        { texto: 'A remar: agota 2 Tripulantes preparados (o 1 Marinero)', efectos: [{ tipo: 'agotarPago', n: 2, oRasgo: 'Marinero' }] },
        { texto: 'Esperar el viento: Prueba de NAV 3', prueba: true },
      ],
      exito: [avance(1)],
      fallo: [cadaComprometido({ tipo: 'heridas', n: 1 })],
    },
    // Cada Tripulante comprometido que tenga alguna herida suma 1 menos.
    nat: {
      capacidades: [habilidadDe('heridos', (ctx, c) => (copia(ctx.s, c).heridas > 0 ? -1 : 0))],
      exito: [{ tipo: 'curar', n: 2 }],
      fallo: [agotar(1)],
    },
    ciu: { exito: [preparar(1), { tipo: 'curar', n: 1 }], fallo: [descartar(2)] },
  },
  // +1. Si la Prueba es de NAV, el Barco no da su +1. Sin oposición: agota 1 Tripulante.
  destino: {
    capacidades: [{ clave: 'sinNav', ventana: 'constante', modifica: (ctx, _yo, c) => (c.tipo === 'sinNavBarco' && ctx.s.prueba?.hab === 'NAV' ? 1 : 0) }],
    sinOposicion: [agotar(1)],
  },
})

// 4. Niebla · Leve
registrarPeligro('p2_niebla', {
  encuentros: {
    // COM 3 (2 si tienes un Vigía). Éxito: +1 munición. Fallo: Abordaje.
    mar: { abordaje: true, exito: [preparaCanon()] },
    // Los Vigías no suman. Fallo: el comprometido con menos EXP se pierde hasta que superes otra Prueba o acabe la misión.
    nat: {
      capacidades: [noSuman('vigias', (s, c) => tieneRasgo(s, c, 'Vigía'))],
      exito: [avance(1)],
      fallo: [comprometidoCon(menos('EXP'), { tipo: 'noPrepara', hasta: 'superarPrueba' })],
    },
    ciu: {
      exito: [siTienes('Contrabandista', [robar(3)], [robar(2)])],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'buscado' })],
    },
  },
  // +1; −1 en su lugar si el encuentro es Barco, Pirata o Guardia. Sin oposición: pierdes 1 Avance.
  destino: { modificador: (s) => (encuentroEs(s, 'Barco', 'Pirata', 'Guardia') ? -1 : 1), sinOposicion: [pierdesAvance(1)] },
})

// 5. Bajamar · Leve
// Permanente 226 «Varados en el banco»: no puedes superar la misión ni retirarte. Cada Peligro revelado, 1 ficha de
// Marea; con 2, el Barco flota: se descarta. Acción: agota 2 Tripulantes (o 1 Marinero) para poner 1 ficha.
registrarPermanente('pm_varados', {
  quitar: [],
  acciones: [
    {
      texto: 'Agota 2 Tripulantes (o 1 Marinero) para poner 1 ficha de Marea',
      coste: [{ tipo: 'agotarVarios', n: 2, oRasgo: 'Marinero' }],
      efectos: [{ tipo: 'ficha', n: 1 }],
    },
  ],
  contador: { cuando: 'revelarPeligro', umbral: 2, efectos: [], despues: 'descartar' },
  bloqueaSuperar: true,
  bloqueaRetirada: true,
})
registrarPeligro('p2_bajamar', {
  encuentros: {
    // Pon en juego la carta 226 del mazo de historia.
    mar: { pone: { carta: 'pm_varados' } },
    nat: {
      exito: [{ tipo: 'siguiente', mod: { de: 'encuentro', claves: ['Militar', 'Guardia', 'Bestia'], n: -1 } }],
      fallo: [comprometidoCon(menos('NAV'), { tipo: 'heridas', n: 1 }), pierdesAvance(1)],
    },
    ciu: {
      exito: [siTienes('Carpintero', [reparar(3)], [reparar(2)])],
      fallo: [{ tipo: 'porCada', medida: 'dano', efectos: [descartar(1)], minimo: 1, maximo: 3 }],
    },
  },
  // +0. Si superas, +1 Avance; si fallas, pierdes 1 Avance. Sin oposición: pierdes 1 Avance.
  destino: { siSuperas: [avance(1)], siFallas: [pierdesAvance(1)], sinOposicion: [pierdesAvance(1)] },
})

// 6. Arrecife · Duro
registrarPeligro('p2_arrecife', {
  encuentros: {
    mar: { exito: [{ tipo: 'descartarArriba', n: 1 }], fallo: [dano(2), agotaCanones(1)] },
    nat: { exito: [preparaCanon(), robar(1)], fallo: [heridasAsignados(2)] },
    // NAV 4 (2 si comprometes a un Marinero).
    ciu: {
      exito: [{ tipo: 'siguiente', mod: { de: 'encuentro', claves: ['Guardia'], n: -2 } }],
      fallo: [{ tipo: 'siguiente', mod: { de: 'encuentro', claves: ['Guardia', 'Militar'], n: 2 } }],
    },
  },
  // +1; +0 en su lugar si comprometiste a un Vigía. Sin oposición: en el Mar, 1 daño al Barco; en Naturaleza o Ciudad,
  // 1 herida a un Tripulante.
  destino: {
    modificador: (s) => (comprometidosDe(s).some((c) => tieneRasgo(s, c, 'Vigía')) ? 0 : 1),
    sinOposicion: [enElMar([dano(1)], [heridas(1)])],
  },
})

// 7. Fuego a bordo · Duro
registrarPeligro('p2_fuego', {
  encuentros: {
    mar: {
      elige: [
        {
          texto: 'Anegar la santabárbara: agota todos tus Cañones y el Barco queda con Pólvora mojada',
          efectos: [agotaCanones('todos'), { tipo: 'estadoBarco', estado: 'polvoraMojada' }],
        },
        { texto: 'Atacar el fuego: Prueba de NAV 4 (+1 si tienes algún Cañón preparado)', prueba: true, modSi: { condicion: { tipo: 'canonesPreparados', minimo: 1 }, n: 1 } },
      ],
      exito: [preparaCanon()],
      // Fase 10b: fuera Incendio a bordo: 1 daño y Pólvora mojada.
      fallo: [dano(1), { tipo: 'estadoBarco', estado: 'polvoraMojada' }],
    },
    // Pon en juego la carta 227 del mazo de historia («La manigua arde»).
    nat: { pone: { carta: 'pm_manigua' } },
    ciu: {
      exito: [
        {
          tipo: 'elegir',
          opciones: [
            { texto: 'Saqueáis los almacenes: robas 2', efectos: [robar(2)] },
            { texto: 'Ayudáis con los cubos: preparas a todos los Tripulantes asignados', efectos: [preparar('comprometidos')] },
          ],
        },
      ],
      fallo: [reputacion(-1)],
    },
  },
  // +1; +2 en su lugar si tienes 3 o más munición. Sin oposición: pierdes 1 munición.
  destino: { modificador: (s) => (canonesListos(s) >= 2 ? 2 : 1), sinOposicion: [agotaCanones(1)] },
})

// Permanente 227 «La manigua arde» (de «Fuego a bordo»): cada otro Peligro revelado, 1 ficha de Fuego; con 3, cada
// agotado sufre 1 herida (máx. 3) y se descarta. Acción: agota a un Explorador, o a 2 Tripulantes, para descartarla.
registrarPermanente('pm_manigua', {
  quitar: [],
  acciones: [
    { texto: 'Agota a un Explorador, o a 2 Tripulantes, para descartarla', coste: [{ tipo: 'agotarVarios', n: 2, oRasgo: 'Explorador' }], efectos: [{ tipo: 'descartarEsta' }] },
  ],
  contador: {
    cuando: 'revelarPeligro',
    umbral: 3,
    efectos: [{ tipo: 'aQuien', quien: { de: 'agotados', cada: true, maximo: 3 }, hacer: { tipo: 'heridas', n: 1 } }],
    despues: 'descartar',
  },
})

// 8. La broma · Duro
registrarPeligro('p2_broma', {
  encuentros: {
    // EXP X: X = 2 + tus Mejoras de barco (mín. 3, máx. 5); −2 si comprometes a un Carpintero.
    mar: {
      capacidades: [
        dificultad('x', (ctx) => Math.min(5, Math.max(3, 2 + mejorasDeBarco(ctx.s))) - 3 - (participantesCon(ctx, 'Carpintero') > 0 ? 2 : 0)),
      ],
      exito: [reparar(1)],
      fallo: [{ tipo: 'si', condicion: { tipo: 'estadoBarco', estado: 'viaDeAgua' }, entonces: [dano(2)], sino: [{ tipo: 'estadoBarco', estado: 'viaDeAgua' }] }],
    },
    // EXP 3, +1 por cada Tripulante comprometido después del primero.
    nat: {
      capacidades: [dificultad('peso', (ctx) => Math.max(0, participantesCtx(ctx).length - 1))],
      exito: [{ tipo: 'si', condicion: { tipo: 'comprometidos', minimo: 1, maximo: 1 }, entonces: [avance(1)] }],
      fallo: [cadaComprometido({ tipo: 'heridas', n: 1 })],
    },
    ciu: { exito: [robar(2)], fallo: [{ tipo: 'descartarMayorCoste' }] },
  },
  // +0. Las Mejoras no suman ni se pueden usar en esta Prueba. Sin oposición: en el Mar, 1 daño al Barco; en
  // Naturaleza o Ciudad, descarta 1 carta.
  destino: { prueba: { sinMejoras: true }, sinOposicion: [enElMar([dano(1)], [descartar(1)])] },
})

// 9. Turbonada · Duro
registrarCodigo('p2_turbonada.agotados', (s, fuente) => {
  if (!s.mision || !fuente) return []
  const n = Math.min(2, s.zonas.tripulacion.filter((c) => copia(s, c).agotada).length)
  s.mision.marcas = { ...(s.mision.marcas ?? {}), [`${fuente}.agotados`]: n }
  return []
})
registrarPeligro('p2_turbonada', {
  encuentros: {
    mar: { exito: [avance(1), { tipo: 'alFondo' }], fallo: [dano(1), { tipo: 'estadoBarco', estado: 'velasRotas' }] },
    // Esta Prueba recibe +1 por cada Tripulante que ya estuviera agotado al revelarla (máx. +2).
    nat: {
      alRevelarse: [codigo('p2_turbonada.agotados')],
      capacidades: [
        { clave: 'rezagados', ventana: 'constante', modifica: (ctx, yo, c) => (c.tipo === 'dificultad' && yo ? (ctx.s.mision?.marcas?.[`${yo}.agotados`] ?? 0) : 0) },
      ],
      exito: [preparar(1)],
      fallo: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 2 } }],
    },
    ciu: { exito: [robar(2)], fallo: [{ tipo: 'descartarAzar', n: 2 }] },
  },
  // +1. Persigue. Sin oposición: agota 1 Tripulante.
  destino: { persigue: true, sinOposicion: [agotar(1)] },
})

// 10. Huracán · Terrible
registrarEspecial('p2_huracan.vendaval', (s, t, e) => {
  const p = s.prueba
  if (!p || p.comprometidos.length === 0) return 'hecha'
  const otros = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada && !p.comprometidos.includes(c) && habilidadImpresa(s, c, 'NAV') >= 2)
  if (t.paso === 0) {
    const opciones = [
      ...(s.zonas.mano.length >= 2 ? [{ clave: 'descartar', texto: 'Descartar 2 cartas: el Destino es +2' }] : []),
      ...(otros.length > 0 ? [{ clave: 'agotar', texto: 'Agotar a otro Tripulante con NAV 2 o más: el Destino es +2' }] : []),
      { clave: 'fallar', texto: 'Fallar la Prueba' },
    ]
    if (opciones.length === 1) return 'hecha'
    if (!e) return preguntar({ tipo: 'elegirOpcion', motivo: { clave: 'vendaval' }, opciones })
    const clave = eleccionDe(e, 'opcion').clave
    if (clave === 'fallar') return 'hecha'
    p.falla = false
    p.modDestino = 2
    anotar(s, 'jugada', 'Sujetáis lo que se suelta: el Destino es +2 en vez de hacerte fallar.')
    if (clave === 'descartar') {
      encolar(s, { tipo: 'pagar', cantidad: 2, motivo: 'p2_huracan' })
      return 'hecha'
    }
    t.paso = 1
    return 'sigue'
  }
  // Agotar a otro Tripulante preparado con NAV 2 o más.
  const elegido = otros.length === 1 ? otros[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegido) {
    if (otros.length === 0) return 'hecha'
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarParaPagar' }, candidatas: otros, min: 1, max: 1 })
  }
  anotar(s, 'pagar', `Agotas a ${nombre(s, elegido)}.`)
  agotarCarta(s, elegido)
  return 'hecha'
})
registrarCodigo('p2_huracan.vendaval', () => [{ tipo: 'especial', clave: 'p2_huracan.vendaval', datos: {}, paso: 0 }])
registrarCodigo('p2_huracan.dosHeridas', (s) => [{ tipo: 'repartirHeridas', n: 2, entre: [...s.zonas.tripulacion] }])
registrarPeligro('p2_huracan', {
  encuentros: {
    // NAV 6, −1 por cada Marinero comprometido.
    mar: {
      capacidades: [dificultad('marineros', (ctx) => -participantesCon(ctx, 'Marinero'))],
      exito: [{ tipo: 'curar', n: 1, modo: 'cadaComprometido' }],
      fallo: [dano(3), { tipo: 'retirarse' }],
    },
    nat: {
      exito: [preparar('comprometidos')],
      fallo: [
        {
          tipo: 'porCada',
          medida: 'faltan',
          maximo: 3,
          efectos: [
            {
              tipo: 'elegir',
              opciones: [
                { texto: '1 herida a un Tripulante asignado', efectos: [comprometidoCon('eleccion', { tipo: 'heridas', n: 1 })] },
                { texto: 'Pierdes 1 Avance', efectos: [pierdesAvance(1)] },
              ],
            },
          ],
        },
      ],
    },
    ciu: { exito: [{ tipo: 'gratisDelMuelle', maxCoste: 2, que: 'tripulante' }], fallo: [{ tipo: 'ocuparMuelle', coste: 3 }] },
  },
  // Fallas la Prueba, salvo que descartes 2 cartas o agotes a otro Tripulante preparado con NAV 2 o más: entonces +2.
  // Sin oposición: en el Mar, 2 daños al Barco; en Naturaleza o Ciudad, 2 heridas repartidas.
  destino: {
    efectos: [codigo('p2_huracan.vendaval')],
    sinOposicion: [enElMar([dano(2)], [codigo('p2_huracan.dosHeridas')])],
  },
})

// 11. Maremoto · Terrible
// Si el único Tripulante preparado sin comprometer es el Capitán (que no puede volver al muelle), cuenta como «no había
// ninguno»: 1 daño más (P22).
registrarCodigo('p2_maremoto.ola', (s) => {
  const comprometidos = s.prueba?.comprometidos ?? []
  const fuera = s.zonas.tripulacion.filter((c) => c !== s.capitan && !copia(s, c).agotada && !comprometidos.includes(c))
  if (fuera.length === 0) return [{ tipo: 'evento', ev: { tipo: 'danoBarco', cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] }]
  return [{ tipo: 'aQuien', quien: { de: 'noComprometidosPreparados', por: 'eleccion', sinCapitan: true }, hacer: { tipo: 'alMuelle' } }]
})
registrarPeligro('p2_maremoto', {
  encuentros: {
    mar: { exito: [avance(2)], fallo: [dano(2), codigo('p2_maremoto.ola')] },
    nat: { exito: [robar(2), avance(1)], fallo: [pierdesAvance(2), comprometidoCon(mas('COM'), { tipo: 'heridas', n: 1 })] },
    ciu: { exito: [reputacion(1)], fallo: [{ tipo: 'rehen' }] },
  },
  // +2. Si fallas, la siguiente Prueba de esta misión recibe +1. Sin oposición: el Capitán sufre 1 herida.
  destino: { siFallas: [{ tipo: 'siguiente', mod: { de: 'prueba', n: 1 } }], sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
})
