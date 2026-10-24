// Peligros 2.0 · Grupo A: Mar y clima (cartas 1–11).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { participantes as comprometidosDe } from '../capacidades/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { descartarTripulante, habilidadImpresa, registrarEspecial } from '../tareas/peligros2.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { agotar as agotarCarta } from '../estados.ts'
import {
  agotar,
  avance,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  enElMar,
  heridas,
  mas,
  mejorasDeBarco,
  menos,
  preparaCanon,
  participantesCon,
  participantesCtx,
  pierdesAvance,
  agotaCanones,
  preparar,
  reparar,
  reputacion,
  robar,
  siTienes,
  heridaPorAsignado,
  SIN_LIMITE_DE_COSTE,
} from './comun.ts'

// 1. La corriente del Golfo · Favorable
registrarPeligro('p2_corriente', {
  encuentros: {
    // Éxito: +1 [avance] por cada punto que superes (máx. +2). Fallo: Daña 1.
    mar: { exito: [{ tipo: 'porCada', medida: 'margen', efectos: [avance(1)], maximo: 2 }], fallo: [dano(1)] },
    // Éxito: prepara 1 Tripulante. Fallo: Inflige 1 herida (fase 13: heridas libres, también las que antes iban a un
    // Tripulante asignado).
    nat: { exito: [preparar(1)], fallo: [heridas(1)] },
    // Fase 14 (Albert): «Puedes agotar a 1 Tripulante para adquirir 1 Mejora del muelle de coste 2 o menos pagando la
    // mitad de su coste (redondeando hacia arriba).» Solo Mejoras (antes, también reclutar sin coste).
    ciu: {
      efecto: [
        {
          tipo: 'elegir',
          opciones: [
            {
              texto: 'Agotar a 1 Tripulante: adquirir una Mejora del muelle de coste 2 o menos pagando la mitad de su coste',
              efectos: [{ tipo: 'agotarPago', n: 1 }, { tipo: 'gratisDelMuelle', maxCoste: 2, que: 'mejora', mitad: true }],
            },
            { texto: 'No', efectos: [] },
          ],
        },
      ],
    },
  },
  // +1 (fase 13: fuera «Prueba de NAV: +2 en su lugar»). Sin oposición: −1 [avance] (mín. 0): este encuentro da 1 de
  // Avance menos; nunca quita el que la misión ya tenía.
  destino: { sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})

// 2. Cielo estrellado · Favorable
registrarPeligro('p2_cielo', {
  encuentros: {
    // Mira las 3 de arriba del mazo de Peligros y ordénalas. Si tienes un Piloto (aunque esté agotado), +1 Avance.
    // Fase 13 (I7): «Otea 3» (antes, «mira las 3 y ordénalas»: ahora puedes mandar cartas al fondo).
    mar: { efecto: [{ tipo: 'mirarOrdenar', n: 3, fondo: 'libre' }, siTienes('Piloto', [avance(1)])] },
    nat: { exito: [avance(1)], fallo: [pierdesAvance(1)] },
    // Éxito: prepara a 1 Tripulante asignado (fase 13: antes quedaba Inspirado, pero el asignado ya está agotado y la
    // ficha se quita al final del turno: nunca llegaba a usarla). Fallo: descarta 1 carta.
    ciu: { exito: [comprometidoCon('eleccion', { tipo: 'preparar' })], fallo: [descartar(1)] },
  },
  // +1. Sin oposición: −1 en su lugar. (Fase 13: fuera «las cartas de tu mano no suman», que no servía: la mano se
  // añade antes del Destino.)
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 1 : -1) },
})

// 3. Calma chicha · Leve
registrarPeligro('p2_calma', {
  encuentros: {
    mar: {
      elige: [
        { texto: 'A remar: agota a un Marinero o a 2 Tripulantes', efectos: [{ tipo: 'agotarPago', n: 2, oRasgo: 'Marinero' }] },
        { texto: 'Esperar el viento: NAV 3', prueba: true },
      ],
      exito: [avance(1)],
      // Fase 13: sufre toda la tripulación, Capitán incluido, 1 herida cada uno (no se reparten).
      fallo: [{ tipo: 'aQuien', quien: { de: 'tripulacion', cada: true }, hacer: { tipo: 'heridas', n: 1 } }],
    },
    // Fase 13: suma 1 a la dificultad por cada Tripulante asignado que esté herido (antes, cada uno sumaba 1 menos).
    nat: {
      capacidades: [dificultad('heridos', (ctx) => participantesCtx(ctx).filter((c) => copia(ctx.s, c).heridas > 0).length)],
      exito: [{ tipo: 'curar', n: 2 }],
      fallo: [agotar(1)],
    },
    ciu: { exito: [preparar(1), { tipo: 'curar', n: 1 }], fallo: [descartar(2)] },
  },
  // −1. Sin oposición: agota a 1 Tripulante. (Fase 13: fuera «Prueba de NAV: el Barco no da su +1».)
  destino: { sinOposicion: [agotar(1)] },
})

// 4. Niebla · Leve
registrarPeligro('p2_niebla', {
  encuentros: {
    // COM 3 (Vigía −1). Éxito: nada más (fase 13: fuera «Prepara un Cañón»). Fallo: Abordaje.
    mar: { abordaje: true, exito: [] },
    // Fase 13: «Resuelve 2 cartas de Destino en esta Prueba» (fuera «los Vigías no suman»). Fallo: descarta al asignado
    // con menos EXP; si es el Capitán, sufre 1 herida en su lugar.
    nat: {
      prueba: { dosDestinosSuman: true },
      exito: [avance(1)],
      fallo: [codigo('p2_niebla.separados')],
    },
    ciu: {
      exito: [siTienes('Contrabandista', [robar(3)], [robar(2)])],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'buscado' })],
    },
  },
  // −1 (fase 13: fuera «Encuentro de tipo Barco, Pirata o Guardia: +1 en su lugar»). Sin oposición: −1 [avance] (mín. 0).
  destino: { sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})
// «Bruma en la selva», fallo: «Descarta al Tripulante asignado con menos [EXP].» P72 (Albert): si hay empate, elige el
// jugador; el Tripulante se descarta con las reglas normales (sus Mejoras con él y sus Tesoros pasan a otro). Sin nadie
// asignado se aplica igual, al de menos EXP de toda la tripulación (regla general de la fase 13 para «el Tripulante
// asignado con más / menos X»). Fase 14: si es el Capitán, sufre 1 herida en su lugar por la regla general (la carta ya
// no lo repite, tercera ronda), y el Fiador y «¡A por ellos!» pueden responder (es una carta de Peligro la que lo descarta).
registrarEspecial('p2_niebla.separados', (s, t, e) => {
  const asignados = comprometidosDe(s).filter((c) => s.zonas.tripulacion.includes(c))
  const entre = asignados.length > 0 ? asignados : [...s.zonas.tripulacion]
  if (entre.length === 0) return 'hecha'
  const minimo = Math.min(...entre.map((c) => habilidadImpresa(s, c, 'EXP')))
  const empatados = entre.filter((c) => habilidadImpresa(s, c, 'EXP') === minimo)
  let c = empatados.length === 1 ? empatados[0] : undefined
  if (!c) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'separados' }, candidatas: empatados, min: 1, max: 1 })
    c = eleccionDe(e, 'cartas').ids[0]
  }
  if (!c) return 'hecha'
  if (c !== s.capitan) anotar(s, 'efecto', `${nombre(s, c)} se pierde en la bruma.`)
  descartarTripulante(s, c, t.fuente, `${nombre(s, c)} se pierde en la bruma`)
  return 'hecha'
})
registrarCodigo('p2_niebla.separados', (_s, fuente) => [{ tipo: 'especial', clave: 'p2_niebla.separados', datos: {}, paso: 0, ...(fuente ? { fuente } : {}) }])

// 5. Bajamar · Leve
// Permanente 226 «Varados en el banco»: no puedes superar la misión ni retirarte. Cada Peligro revelado, 1 ficha de
// Marea; con 2, el Barco flota: se descarta. Acción: agota a un Marinero o a 2 Tripulantes para poner 1 ficha.
registrarPermanente('pm_varados', {
  quitar: [],
  acciones: [
    {
      texto: 'Agota a un Marinero o a 2 Tripulantes para poner 1 ficha de Marea',
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
    // Fase 13: éxito, «la siguiente Prueba de esta misión recibe −1 de dificultad» (sin tipo de encuentro; si la misión
    // termina antes, no se aplica). Fallo: el asignado con menos NAV sufre 1 herida y −1 [avance] (señala a un Tripulante
    // concreto: aprobado así por Albert).
    nat: {
      exito: [{ tipo: 'siguiente', mod: { de: 'prueba', n: -1 } }],
      fallo: [comprometidoCon(menos('NAV'), { tipo: 'heridas', n: 1 }), pierdesAvance(1)],
    },
    // «Casco en seco» (fase 13): Repara 1 (2 si tienes un Carpintero).
    ciu: {
      exito: [siTienes('Carpintero', [reparar(2)], [reparar(1)])],
      fallo: [{ tipo: 'porCada', medida: 'dano', efectos: [descartar(1)], minimo: 1, maximo: 3 }],
    },
  },
  // 0. Si superas, +1 [avance]; si fallas, −1 [avance]. Sin oposición (fase 13): −1 [avance] (mín. 0), solo de este
  // encuentro.
  destino: { siSuperas: [avance(1)], siFallas: [pierdesAvance(1)], sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})

// 6. Arrecife · Duro
registrarPeligro('p2_arrecife', {
  encuentros: {
    // NAV 4 (Vigía −2). Fase 13: éxito, Otea 1 (antes descartaba la carta superior); fallo, Daña 2 (fuera «agota 1 Cañón»).
    mar: { exito: [{ tipo: 'mirarOrdenar', n: 1, fondo: 'libre' }], fallo: [dano(2)] },
    // Fase 13: éxito, adquiere sin coste una Mejora del muelle, sea cual sea su coste (si no cabe, la regla normal de
    // adquirir: no se puede). Fallo: Inflige 2 heridas (heridas libres).
    nat: { exito: [{ tipo: 'gratisDelMuelle', maxCoste: SIN_LIMITE_DE_COSTE, que: 'mejora' }], fallo: [heridas(2)] },
    // NAV 4 (Marinero asignado −2). Fase 13: éxito, roba 1; fallo, Daña 1 (P75: las cartas se leen al pie de la letra, el
    // Barco sufre el daño también en Ciudad).
    ciu: { exito: [robar(1)], fallo: [dano(1)] },
  },
  // −1 (fase 13: fuera «Con un Vigía asignado: 0 en su lugar»). Sin oposición: [mar]: Daña 1. [nat]/[ciu]: Inflige 1 herida.
  destino: { sinOposicion: [enElMar([dano(1)], [heridas(1)])] },
})

// 7. Fuego a bordo · Duro
registrarPeligro('p2_fuego', {
  encuentros: {
    mar: {
      elige: [
        // Fase 15, quinta ronda: fuera Pólvora mojada.
        { texto: 'Anegar la santabárbara: agota todos tus Cañones', efectos: [agotaCanones('todos')] },
        { texto: 'Atacar el fuego: NAV 4 (+1 de dificultad si tienes algún Cañón preparado)', prueba: true, modSi: { condicion: { tipo: 'canonesPreparados', minimo: 1 }, n: 1 } },
      ],
      exito: [preparaCanon()],
      // Fase 10b: fuera Incendio a bordo. Fase 15, quinta ronda: fuera Pólvora mojada: Daña 1 y agota todos tus Cañones.
      fallo: [dano(1), agotaCanones('todos')],
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
  // −1. Sin oposición: agota 1 Cañón. (Fase 13, I1: fuera «Con 2 o más Cañones preparados: −2 en su lugar».)
  destino: { sinOposicion: [agotaCanones(1)] },
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
      // Fase 13 (P79): «Inflige 1 herida por cada Tripulante asignado» (libres).
      fallo: [heridaPorAsignado()],
    },
    ciu: { exito: [robar(2)], fallo: [{ tipo: 'descartarMayorCoste' }] },
  },
  // 0. Sin oposición: [mar]: Daña 1; [nat]/[ciu]: descarta 1 carta. (Fase 13, I1: fuera «las Mejoras no suman ni se pueden
  // usar».)
  destino: { sinOposicion: [enElMar([dano(1)], [descartar(1)])] },
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
    // Se suma (fase 13: con dos Destinos, el otro también cuenta). Un ✕ no aportaba nada al modificador.
    p.modDestino += 2
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
                // Fase 13: heridas libres (antes, «1 herida a un Tripulante asignado»).
                { texto: 'Inflige 1 herida', efectos: [heridas(1)] },
                { texto: '−1 de Avance', efectos: [pierdesAvance(1)] },
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
    // Fase 14 (fuera el rehén): «Un Tripulante asignado queda sepultado: sufre 1 herida y no se prepara en tu próxima
    // Fase de Inicio.» Lo eliges tú; sin nadie asignado, a quien elijas (como las heridas).
    ciu: {
      exito: [reputacion(1)],
      fallo: [comprometidoCon('eleccion', { tipo: 'varios', acciones: [{ tipo: 'heridas', n: 1 }, { tipo: 'noPrepara', hasta: 'inicio' }] })],
    },
  },
  // −2. Sin oposición: el Capitán sufre 1 herida. (Fase 13, I1: fuera «si fallas, la siguiente Prueba recibe +1».)
  destino: { sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
})
