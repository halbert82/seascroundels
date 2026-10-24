// Peligros 2.0 · Grupo B: Bestias, naturaleza y enfermedades (cartas 12–22).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { marcado, porCriterio, registrarEspecial } from '../tareas/peligros2.ts'
import { registrarCapacidades } from '../capacidades/index.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { agotar as agotarCarta } from '../estados.ts'
import type { FichaTripulante } from '../infoEstados.ts'
import type { Selector } from '../efectos.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { vinculadas } from '../zonas.ts'
import {
  agotar,
  avance,
  cadaComprometido,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  heridasAsignados,
  heridaPorAsignado,
  mas,
  mejorasDeBarco,
  menos,
  preparaCanon,
  participantesCtx,
  pierdesAvance,
  preparar,
  reputacion,
  robar,
  tieneRasgo,
} from './comun.ts'

const tripulantesHeridos = (s: Estado) => s.zonas.tripulacion.filter((c) => copia(s, c).heridas > 0).length

// 12. Tortugas · Favorable
registrarPeligro('p2_tortugas', {
  encuentros: {
    // Éxito: prepara a los comprometidos. Fallo: agota 1 Tripulante preparado.
    mar: { exito: [preparar('comprometidos')], fallo: [agotar(1)] },
    // Sin Prueba: cura 2 heridas repartidas; si tienes un Animal o un Explorador, además prepara 1 Tripulante.
    nat: {
      efecto: [
        { tipo: 'curar', n: 2 },
        {
          tipo: 'si',
          condicion: { tipo: 'alguna', condiciones: [{ tipo: 'rasgoEnJuego', rasgo: 'Animal' }, { tipo: 'rasgoEnJuego', rasgo: 'Explorador' }] },
          entonces: [preparar(1)],
        },
      ],
    },
    ciu: { exito: [robar(2)], fallo: [descartar(1)] },
  },
  // −1. Si superas, el comprometido con la habilidad más alta queda Aguerrido. Sin oposición: pierdes 1 Avance.
  // +1. Sin oposición (fase 13, I1 e I6): −1 [avance] (mín. 0). Fuera «si superas, el de la habilidad más alta queda
  // Aguerrido».
  destino: { sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})

// 13. Sol de justicia · Leve
registrarPeligro('p2_sol', {
  encuentros: {
    // NAV 3 (Carpintero −2, en los datos). Éxito: prepara 1. Fallo: el Barco queda Anegado (antes, Vía de agua).
    mar: { exito: [preparar(1)], fallo: [{ tipo: 'estadoBarco', estado: 'viaDeAgua' }] },
    // Elige: volver al último arroyo (pierdes 1 Avance) o buscar agua por delante (Prueba de EXP 3).
    nat: {
      elige: [
        { texto: 'Volver al último arroyo: −1 de Avance', efectos: [pierdesAvance(1)] },
        { texto: 'Buscar agua por delante: EXP 3', prueba: true },
      ],
      exito: [{ tipo: 'curar', n: 1, modo: 'cadaComprometido' }],
      // Fase 10b: fuera Aturdido: 1 herida a cada asignado.
      // Fase 13 (P79): «Inflige 1 herida por cada Tripulante asignado» (libres).
      fallo: [heridaPorAsignado()],
    },
    // EXP 2, +1 por cada Tripulante comprometido después del primero.
    ciu: {
      capacidades: [dificultad('ruido', (ctx) => Math.max(0, participantesCtx(ctx).length - 1))],
      exito: [robar(2)],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'buscado' })],
    },
  },
  // +1; +2 en su lugar si la Prueba es de COM. Sin oposición: el Capitán sufre 1 herida.
  // −1. Sin oposición: el Capitán sufre 1 herida. (Fase 13, I1: fuera «Prueba de COM: −2 en su lugar».)
  destino: { sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
})

// 14. El hambre · Leve
registrarPeligro('p2_hambre', {
  encuentros: {
    // EXP 3 (1 con un Cirujano). Éxito: cura 1 a cada herido. Fallo: cada herido sufre 1 más (máximo 3 heridas en total).
    mar: {
      exito: [{ tipo: 'curar', n: 1, modo: 'cadaHerido' }],
      fallo: [{ tipo: 'aQuien', quien: { de: 'heridos', cada: true, maximo: 3 }, hacer: { tipo: 'heridas', n: 1 } }],
    },
    // EXP 3 (1 con un Explorador). Éxito: prepara 2. Fallo: el Tripulante con menos Vida sufre 2 heridas.
    nat: {
      exito: [preparar(2)],
      fallo: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 2 } }],
    },
    // Elige: pagas lo que piden (descarta 2 cartas) o regateas (Prueba de EXP 3).
    ciu: {
      elige: [
        { texto: 'Pagar lo que piden: descarta 2 cartas', efectos: [descartar(2)] },
        { texto: 'Regatear: EXP 3', prueba: true },
      ],
      exito: [robar(1), { tipo: 'curar', n: 1 }],
      // Fase 16 (Albert): «Tu tripulación queda Desmoralizada»: robas 1 carta menos al final de este mismo turno (antes, P29:
      // −1 Mando en tu próximo turno).
      fallo: [{ tipo: 'estadoBarco', estado: 'desanimo' }],
    },
  },
  // +0. El comprometido con la habilidad más alta no se prepara en tu próximo Inicio. Sin oposición: descarta 1 carta.
  // 0. Sin oposición: descarta 1 carta. (Fase 13, I1: fuera «el de la habilidad más alta no se prepara».)
  destino: { sinOposicion: [descartar(1)] },
})

// 15. Sin rumbo · Leve
const lleva = (s: Estado, c: InstId, id: string) => vinculadas(s, c).some((m) => copia(s, m).id === id)
registrarPeligro('p2_sinrumbo', {
  encuentros: {
    // NAV 3 (1 con un Vigía). Éxito: mira las 2 de arriba y pon 1 al fondo. Fallo: el siguiente encuentro no da Avance.
    // Fase 13: éxito, «Otea 2» (I7); fallo, «−1 [avance]» (I2: antes, «el siguiente encuentro no da Avance»).
    mar: { exito: [{ tipo: 'mirarOrdenar', n: 2, fondo: 'libre' }], fallo: [pierdesAvance(1)] },
    // NAV 3 (1 si un comprometido lleva una Brújula). Fallo: el comprometido con más NAV se pierde (no se prepara hasta
    // el final de la misión); Acción: agota un Vigía o un Explorador para encontrarlo y prepararlo.
    nat: {
      capacidades: [dificultad('brujula', (ctx) => (participantesCtx(ctx).some((c) => lleva(ctx.s, c, 'brujula')) ? -2 : 0))],
      exito: [avance(1)],
      fallo: [comprometidoCon(mas('NAV'), { tipo: 'noPrepara', hasta: 'finMision' })],
    },
    // NAV 2. Éxito: la siguiente Prueba −1. Fallo: descarta 1 carta al azar.
    ciu: { exito: [{ tipo: 'siguiente', mod: { de: 'prueba', n: -1 } }], fallo: [{ tipo: 'descartarAzar', n: 1 }] },
  },
  // −1; −2 en su lugar si comprometiste a un Vigía o un Explorador. Sin oposición: pierdes 1 Avance.
  // +1. Sin oposición (fase 13, I1 e I6): −1 [avance] (mín. 0). Fuera «con un Vigía o un Explorador asignado: +2».
  destino: { sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})

// Acción (del Tripulante perdido): agota a un Vigía o a un Explorador para encontrarlo y prepararlo.
const perdido = (s: Estado, yo: InstId | null) =>
  yo !== null && s.temporales.some((t) => t.fuente === 'p2_sinrumbo' && t.clave === 'noPrepara' && t.inst === yo)
registrarCapacidades({
  clave: 'p2_sinrumbo.encontrar',
  carta: 'p2_sinrumbo',
  ventana: 'accion',
  desde: 'marca',
  texto: 'Agota a un Vigía o a un Explorador para encontrarlo y prepararlo.',
  coste: [{ tipo: 'agotarTripulante', rasgo: null, rasgos: ['Vigía', 'Explorador'] }],
  requisito: perdido,
  efecto: (s, yo) => {
    if (!yo) return []
    s.temporales = s.temporales.filter((t) => !(t.fuente === 'p2_sinrumbo' && t.clave === 'noPrepara' && t.inst === yo))
    anotar(s, 'efecto', `Encontráis a ${nombre(s, yo)}.`)
    return [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: yo }, hacer: { tipo: 'preparar' } }]
  },
})

// 16. Serpientes · Leve
const MALES: FichaTripulante[] = ['envenenado', 'sangrando', 'asustado']
registrarCodigo('p2_serpientes.muerde', (s): NuevaTarea[] => {
  // El no comprometido con menos Vida; si no queda ninguno, el comprometido con menos EXP.
  const comp = s.prueba?.comprometidos ?? []
  if (s.zonas.tripulacion.some((c) => !comp.includes(c))) {
    return [{ tipo: 'aQuien', quien: { de: 'noComprometidos', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 2 } }]
  }
  return [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: { menos: 'EXP' } }, hacer: { tipo: 'heridas', n: 2 } }]
})
registrarPeligro('p2_serpientes', {
  encuentros: {
    // EXP 2. Si tienes un Animal, superas sin Prueba.
    mar: { superaSi: { tipo: 'rasgoEnJuego', rasgo: 'Animal' }, exito: [robar(1)], fallo: [codigo('p2_serpientes.muerde')] },
    nat: { exito: [avance(1)], fallo: [comprometidoCon(menos('COM'), { tipo: 'estado', estado: 'envenenado' })] },
    // Éxito: quita a un Tripulante un Estado (Envenenado, Sangrando, Aturdido o Asustado), o cura 2 heridas.
    ciu: {
      exito: [
        {
          tipo: 'elegir',
          opciones: [
            {
              texto: 'Quitar a un Tripulante Envenenado, Sangrando, Aturdido o Asustado',
              efectos: [{ tipo: 'quitarUnEstado', estados: MALES }],
              si: { tipo: 'alguna', condiciones: MALES.map((estado) => ({ tipo: 'estado' as const, estado })) },
            },
            { texto: 'Curar 2 heridas', efectos: [{ tipo: 'curar', n: 2 }] },
          ],
        },
      ],
      fallo: [descartar(2)],
    },
  },
  // +0. Si fallas, el comprometido con la habilidad más alta queda Envenenado. Sin oposición: el preparado con menos
  // Vida sufre 1 herida.
  // 0. Sin oposición: el preparado con menos Vida sufre 1 herida. (Fase 13, I1: fuera «si fallas, Envenenado».)
  destino: { sinOposicion: [{ tipo: 'aQuien', quien: { de: 'preparados', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 1 } }] },
})

// 17. Fiebre amarilla · Duro
registrarPeligro('p2_fiebre', {
  encuentros: {
    // NAV 4. Éxito: cura 1 herida a cada Tripulante. Fallo: no puedes retirarte de esta misión.
    mar: { exito: [{ tipo: 'curar', n: 1, modo: 'cadaUno' }], fallo: [{ tipo: 'noRetirarse' }] },
    // EXP 4 (2 con un Cirujano). Éxito: cura 2 heridas. Fallo: cada Tripulante asignado queda Envenenado (fase 10b).
    nat: { exito: [{ tipo: 'curar', n: 2 }], fallo: [cadaComprometido({ tipo: 'estado', estado: 'envenenado' })] },
    // EXP 3, +1 por cada Tripulante herido (máx. 5). Éxito: +1 Avance. Fallo (fase 14, fuera el rehén): descarta al
    // asignado con más EXP (antes, rehén en el lazareto, y volvía sin heridas).
    ciu: {
      capacidades: [dificultad('heridos', (ctx) => Math.min(5, 3 + tripulantesHeridos(ctx.s)) - 3)],
      exito: [avance(1)],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'descartar' })],
    },
  },
  // −1. Fase 13 (I1): «Inflige 1 herida a un Tripulante asignado» (antes, «si fallas, cada asignado herido sufre 1 más»).
  // Sin oposición: el Capitán queda Envenenado.
  destino: { efectos: [heridasAsignados(1)], sinOposicion: [{ tipo: 'estado', estado: 'envenenado', a: 'capitan' }] },
})

// 18. Tiburones · Duro
registrarCodigo('p2_tiburones.prendas', (s): NuevaTarea[] => {
  // 1 carta al azar de tu mano por cada Tripulante herido (mín. 1, máx. 3).
  const n = Math.max(1, Math.min(3, tripulantesHeridos(s)))
  return [{ tipo: 'incautar', que: 'mano', n, criterio: 'azar' }]
})
registrarPeligro('p2_tiburones', {
  encuentros: {
    // COM 3, +1 por cada Tripulante herido (máx. 5). Si nadie está herido, ganas el Avance sin Prueba.
    mar: {
      sinPruebaSi: { tipo: 'no', condicion: { tipo: 'heridas', minimo: 1 } },
      capacidades: [dificultad('sangre', (ctx) => Math.min(5, 3 + tripulantesHeridos(ctx.s)) - 3)],
      exito: [{ tipo: 'curar', n: 2 }],
      fallo: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'masHeridas' }, hacer: { tipo: 'heridas', n: 2 } }],
    },
    // Los Tripulantes heridos no pueden comprometerse.
    nat: {
      restriccion: { veto: (s, c) => (copia(s, c).heridas > 0 ? `${nombre(s, c)} está herido: no puede ser asignado` : null) },
      exito: [{ tipo: 'descartarArriba', n: 1 }],
      // Fase 13 (P79): «Inflige 1 herida por cada Tripulante asignado» (libres).
      fallo: [heridaPorAsignado()],
    },
    // Al revelarse, Incautado: 1 carta al azar por cada herido (mín. 1, máx. 3). Éxito: recupéralas ya y robas 1.
    ciu: { alRevelarse: [codigo('p2_tiburones.prendas')], exito: [{ tipo: 'recuperarIncautadas' }, robar(1)] },
  },
  // +1. Si algún Tripulante está herido, el que tenga más heridas sufre 1 más (comprometido o no). Sin oposición: el
  // Tripulante con menos Vida sufre 1 herida.
  // −1. Sin oposición: el Tripulante con menos Vida sufre 1 herida. (Fase 13, I1: fuera «el de más heridas sufre 1».)
  destino: { sinOposicion: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 1 } }] },
})

// 19. Murciélagos vampiro · Duro
registrarPeligro('p2_murcielagos', {
  encuentros: {
    // Fase 16: «Los Tripulantes asignados quedan Extenuados» (antes, «no se preparan en tu próxima Fase de Inicio»).
    mar: { exito: [avance(1)], fallo: [cadaComprometido({ tipo: 'estado', estado: 'extenuado' })] },
    // EXP 3, +1 si algún Tripulante está Sangrando.
    nat: {
      capacidades: [dificultad('sangre', (ctx) => (ctx.s.zonas.tripulacion.some((c) => copia(ctx.s, c).estados?.includes('sangrando')) ? 1 : 0))],
      exito: [preparaCanon()],
      fallo: [comprometidoCon('menosVida', { tipo: 'estado', estado: 'sangrando' })],
    },
    ciu: { exito: [{ tipo: 'curar', n: 1, modo: 'cadaComprometido' }], fallo: [{ tipo: 'heridas', n: 1, capitan: true }, descartar(1)] },
  },
  // +1. Persigue. Sin oposición: el agotado con menos Vida sufre 1 herida.
  // −1. Sin oposición: el agotado con menos Vida sufre 1 herida. (Fase 13, I1: fuera «Persigue».)
  destino: { sinOposicion: [{ tipo: 'aQuien', quien: { de: 'agotados', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 1 } }] },
})

// 20. Arenas movedizas · Duro
// P28 (confirmada): «el Tripulante preparado (o el Capitán) con más EXP»: el Capitán cuenta como uno más entre los
// preparados; si no hay nadie preparado, queda atrapado el Capitán. Fase 11: la permanente 228 va junto a él.
const atrapado = (s: Estado): Selector =>
  s.zonas.tripulacion.some((c) => !copia(s, c).agotada) ? { de: 'preparados', por: { mas: 'EXP' } } : { de: 'capitan' }
/** El Tripulante junto al que está la permanente (si sigue en tu tripulación). */
function junto(s: Estado, perm: InstId | undefined): InstId | undefined {
  const c = perm ? copia(s, perm).junto : undefined
  return c && s.zonas.tripulacion.includes(c) ? c : undefined
}
registrarCodigo('p2_arenas.ahogado', (s, fuente): NuevaTarea[] => {
  const c = junto(s, fuente)
  if (!c) return []
  anotar(s, 'aviso', `Sacáis a ${nombre(s, c)} medio ahogado.`)
  return [{ tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 2 }, fase: 'antes', cancelado: false, usadas: [] }]
})
registrarCodigo('p2_arenas.sacar', (s, fuente): NuevaTarea[] => {
  if (!fuente) return []
  const n = (copia(s, fuente).fichas ?? 0) + 1
  return [
    { tipo: 'agotarPago', n },
    { tipo: 'devolverPermanente', carta: fuente },
  ]
})
// Permanente 228 «Arenas movedizas»: el atrapado no puede ser asignado ni prepararse. Obligado: cada otro Peligro
// revelado, 1 ficha de Barro; con 3, sufre 2 heridas y se descarta. Acción: agota tantos preparados como fichas haya,
// más 1, para descartarla.
registrarPermanente('pm_arenas', {
  quitar: [],
  alEntrar: [{ tipo: 'alJunto', hacer: { tipo: 'varios', acciones: [{ tipo: 'noCompromete', hasta: 'carta' }, { tipo: 'noPrepara', hasta: 'carta' }] } }],
  acciones: [
    {
      texto: 'Agota tantos Tripulantes preparados como fichas tenga, más 1: lo sacáis a pulso',
      requisito: (s, yo) => s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length >= (copia(s, yo).fichas ?? 0) + 1,
      efectos: [codigo('p2_arenas.sacar')],
    },
  ],
  contador: { cuando: 'revelarPeligro', umbral: 3, efectos: [codigo('p2_arenas.ahogado')], despues: 'descartar' },
})
registrarPeligro('p2_arenas', {
  encuentros: {
    // NAV 4, +1 por cada 2 Mejoras de barco (máx. 5). Fallo: 1 daño por cada punto que te falte (máx. 3).
    mar: {
      capacidades: [dificultad('peso', (ctx) => Math.min(5, 4 + Math.floor(mejorasDeBarco(ctx.s) / 2)) - 4)],
      exito: [avance(1)],
      fallo: [{ tipo: 'porCada', medida: 'faltan', efectos: [dano(1)], maximo: 3 }],
    },
    // El preparado (o el Capitán) con más EXP queda atrapado: pon en juego la carta 228 junto a él.
    nat: { pone: { carta: 'pm_arenas', junto: atrapado } },
    // NAV 3 (1 con un Marinero). Éxito: añade gratis una Mejora del muelle. Fallo: pierdes 1 Mejora de un comprometido.
    ciu: { exito: [{ tipo: 'gratisDelMuelle', maxCoste: 99, que: 'mejora' }], fallo: [{ tipo: 'perderMejora', n: 1, deComprometidos: true }] },
  },
  // +1, +1 más por cada Tripulante comprometido después del segundo (máx. +3 en total). Sin oposición: agota 1.
  // −1. Sin oposición: agota a 1 Tripulante. (Fase 13, I1: fuera «−1 más por cada asignado después del segundo».)
  destino: { sinOposicion: [agotar(1)] },
})

// 21. El jaguar · Terrible
registrarEspecial('p2_jaguar.cazar', (s, t, e) => {
  const carta = t.fuente
  if (!carta || !s.zonas.permanentes.includes(carta) || s.prueba) return 'hecha'
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  if (preparados.length === 0) return 'hecha'
  const cazador = preparados.length === 1 ? preparados[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!cazador) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'cazador' }, candidatas: preparados, min: 1, max: 1 })
  anotar(s, 'pagar', `Agotas a ${nombre(s, cazador)} para cazar al jaguar.`)
  agotarCarta(s, cazador)
  const explorador = tieneRasgo(s, cazador, 'Explorador')
  encolar(s, {
    tipo: 'pruebaSuelta',
    fuente: carta,
    paso: 'empezar',
    definicion: {
      nombre: 'Cazar al jaguar',
      palabrasClave: ['Bestia'],
      opciones: [explorador ? { hab: 'EXP', dificultad: 3 } : { hab: 'COM', dificultad: 5 }],
      exito: [robar(2), { tipo: 'descartarEsta' }],
      fallo: [heridasAsignados(1)],
      soloCon: cazador,
    },
  })
  return 'hecha'
})
registrarCodigo('p2_jaguar.cazar', (_s, fuente): NuevaTarea[] => [{ tipo: 'especial', clave: 'p2_jaguar.cazar', datos: {}, paso: 0, ...(fuente ? { fuente } : {}) }])
// Permanente 229 «Ojos amarillos en la espesura»: Obligado: al final de cada encuentro siguiente, el agotado con menos
// Vida sufre 1 herida. Acción: agota a un preparado para cazarlo: Prueba de COM 5 solo con él (EXP 3 si es Explorador).
registrarPermanente('pm_ojos', {
  quitar: [],
  acciones: [
    {
      texto: 'Agota a un Tripulante preparado para cazarlo: Prueba de COM 5 solo con él (EXP 3 si es un Explorador)',
      requisito: (s) => s.prueba === null && s.zonas.tripulacion.some((c) => !copia(s, c).agotada),
      efectos: [codigo('p2_jaguar.cazar')],
    },
  ],
  disparos: [{ cuando: 'cartaResuelta', efectos: [{ tipo: 'aQuien', quien: { de: 'agotados', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 1 } }] }],
})
registrarPeligro('p2_jaguar', {
  encuentros: {
    // Sin ayuda. Fallo: el Tripulante sufre 2 heridas y queda Asustado.
    mar: { sinAyuda: true, exito: [robar(3)], fallo: [heridasAsignados(2), comprometidoCon(undefined, { tipo: 'estado', estado: 'asustado' })] },
    // Pon en juego la carta 229 del mazo de historia («Ojos amarillos en la espesura»).
    nat: { pone: { carta: 'pm_ojos' } },
    // COM 5, +1 si tienes un Animal. Fallo: el comprometido con más COM sufre 2 heridas y se descarta la carta de más a
    // la izquierda del muelle.
    ciu: {
      capacidades: [dificultad('animal', (ctx) => (ctx.s.zonas.tripulacion.some((c) => tieneRasgo(ctx.s, c, 'Animal')) ? 1 : 0))],
      exito: [reputacion(1)],
      fallo: [comprometidoCon(mas('COM'), { tipo: 'heridas', n: 2 }), { tipo: 'descartarMuelle', cual: 'izquierda' }],
    },
  },
  // +2. Si algún preparado no está comprometido, el de menos Vida sufre 1 herida. Sin oposición: el Tripulante con
  // menos Vida sufre 2 heridas.
  // −2. Sin oposición: el Tripulante con menos Vida sufre 2 heridas. (Fase 13, I1: fuera «el preparado no asignado con
  // menos Vida sufre 1 herida».)
  destino: { sinOposicion: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 2 } }] },
})

// 22. El caimán · Terrible
registrarCodigo('p2_caiman.rescatado', (s, fuente): NuevaTarea[] => {
  const c = marcado(s, 'p2_caiman.agua', fuente)
  return c ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: c }, hacer: { tipo: 'varios', acciones: [{ tipo: 'preparar' }, { tipo: 'estado', estado: 'aguerrido' }] } }] : []
})
registrarCodigo('p2_caiman.arrastrado', (s, fuente): NuevaTarea[] => {
  const c = marcado(s, 'p2_caiman.agua', fuente)
  return c ? [{ tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 2 }, fase: 'antes', cancelado: false, usadas: [] }] : []
})
registrarEspecial('p2_caiman.giro', (s, _t, e) => {
  const p = s.prueba
  if (!p?.hab) return 'hecha'
  const comprometidos = p.comprometidos.filter((c) => s.zonas.tripulacion.includes(c))
  if (comprometidos.length === 0) return 'hecha'
  const fuertes = porCriterio(s, comprometidos, { mas: 'prueba' })
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'giroDeLaMuerte' },
      opciones: [
        ...fuertes.map((c) => ({ clave: c, texto: `${nombre(s, c)} sufre 2 heridas: el Destino es +1` })),
        { clave: 'fallar', texto: 'Fallar la Prueba' },
      ],
    })
  }
  const clave = eleccionDe(e, 'opcion').clave
  if (clave === 'fallar') return 'hecha'
  const c = fuertes.find((x) => x === clave)
  if (!c) return 'hecha'
  p.falla = false
  // Se suma (fase 13: con dos Destinos, el otro también cuenta). Un ✕ no aportaba nada al modificador.
  p.modDestino += 1
  anotar(s, 'jugada', `${nombre(s, c)} se suelta de las fauces: el Destino es +1.`)
  encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 2 }, fase: 'antes', cancelado: false, usadas: [] })
  return 'hecha'
})
registrarCodigo('p2_caiman.giro', (): NuevaTarea[] => [{ tipo: 'especial', clave: 'p2_caiman.giro', datos: {}, paso: 0 }])
registrarPeligro('p2_caiman', {
  encuentros: {
    // Al revelarse, el preparado con menos Vida cae al agua y no puede comprometerse. Éxito: se prepara y queda
    // Aguerrido. Fallo: sufre 2 heridas y el Barco sufre 1 daño.
    mar: {
      alRevelarse: [
        {
          tipo: 'aQuien',
          quien: { de: 'preparados', por: 'menosVida' },
          hacer: { tipo: 'varios', acciones: [{ tipo: 'noCompromete', hasta: 'finPrueba' }, { tipo: 'marcar', clave: 'p2_caiman.agua' }] },
        },
      ],
      exito: [codigo('p2_caiman.rescatado')],
      fallo: [codigo('p2_caiman.arrastrado'), dano(1)],
    },
    // Las Mejoras no suman. Fallo: si tienes un Animal, vuelve al muelle; si no, el comprometido con más COM sufre 3.
    nat: {
      prueba: { mejorasNoSuman: true },
      exito: [robar(2), avance(1)],
      fallo: [
        {
          tipo: 'si',
          condicion: { tipo: 'rasgoEnJuego', rasgo: 'Animal' },
          entonces: [{ tipo: 'aQuien', quien: { de: 'tripulacion', rasgo: 'Animal' }, hacer: { tipo: 'alMuelle' } }],
          sino: [comprometidoCon(mas('COM'), { tipo: 'heridas', n: 3 })],
        },
      ],
    },
    // Éxito (fase 13, I2): +1 [avance] (antes, «la siguiente Prueba #Guardia# o #Militar# −2»). Fallo: el asignado con
    // más NAV sufre 2 heridas o se descarta (tú eliges; fase 14: antes, rehén).
    ciu: {
      exito: [avance(1)],
      fallo: [
        comprometidoCon(mas('NAV'), {
          tipo: 'elegir',
          opciones: [
            { texto: 'sufre 2 heridas (escapa mordido)', accion: { tipo: 'heridas', n: 2 } },
            { texto: 'se descarta (lo pescan los guardias)', accion: { tipo: 'descartar' } },
          ],
        }),
      ],
    },
  },
  // Fallas la Prueba, salvo que el comprometido con la habilidad más alta sufra 2 heridas: entonces es +1. Sin
  // oposición: el Tripulante con menos Vida sufre 2 heridas.
  destino: {
    efectos: [codigo('p2_caiman.giro')],
    sinOposicion: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 2 } }],
  },
})
