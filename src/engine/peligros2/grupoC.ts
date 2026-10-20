// Peligros 2.0 · Grupo C: La ley (cartas 23–33).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { registrarCapacidades } from '../capacidades/index.ts'
import { participantes as comprometidosDe } from '../capacidades/comun.ts'
import type { Condicion } from '../efectos.ts'
import { anotar, copia, encolar } from '../estado.ts'
import { tieneEstado, tieneEstadoBarco } from '../estados.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { marcado, registrarEspecial, sucesoRehen } from '../tareas/peligros2.ts'
import type { CartaId, Estado } from '../tipos.ts'
import { vinculadas } from '../zonas.ts'
import {
  agotar,
  avance,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  encuentroEs,
  enElMar,
  habilidadDe,
  heridasAsignados,
  mas,
  preparaCanon,
  canonesListos,
  participantesCtx,
  pierdesAvance,
  agotaCanones,
  preparar,
  reparar,
  reputacion,
  robar,
  tieneRasgo,
} from './comun.ts'

const tienesLa = (id: CartaId): Condicion => ({ tipo: 'cartaEnJuego', id })

/** ¿Algún comprometido lleva esta Mejora? */
function comprometidoLleva(s: Estado, id: CartaId): boolean {
  return comprometidosDe(s).some((c) => vinculadas(s, c).some((m) => copia(s, m).id === id))
}

// 23. Desertores del rey · Favorable
registrarPeligro('p2_desertores', {
  encuentros: {
    // Sin Prueba: gana 2 munición.
    mar: { efecto: [preparaCanon()] },
    nat: { exito: [avance(1)], fallo: [comprometidoCon(mas('EXP'), { tipo: 'heridas', n: 1 })] },
    // Sin Prueba: el siguiente encuentro #Guardia# o #Militar# de esta misión recibe −2.
    ciu: { efecto: [{ tipo: 'siguiente', mod: { de: 'encuentro', claves: ['Guardia', 'Militar'], n: -2 } }] },
  },
  // −1; −2 en su lugar si el encuentro es #Militar# o #Guardia#. Si aun así fallas, el Barco queda Perseguido.
  // Sin oposición: +1 en su lugar.
  destino: {
    modificador: (s, p) => (p.comprometidos.length === 0 ? 1 : encuentroEs(s, 'Armada', 'Militar', 'Guardia') ? -2 : -1),
    siFallas: [{ tipo: 'estadoBarco', estado: 'perseguido' }],
  },
})

// 24. Se busca · Leve
registrarPeligro('p2_sebusca', {
  encuentros: {
    // +1 si llevas la Bandera negra.
    mar: {
      capacidades: [dificultad('bandera', (ctx) => (ctx.s.zonas.mejoras.some((m) => copia(ctx.s, m).id === 'bandera' && copia(ctx.s, m).vinculadaA === 'barco') ? 1 : 0))],
      fallo: [{ tipo: 'estadoBarco', estado: 'perseguido' }],
    },
    // +1 si algún Tripulante comprometido tiene heridas.
    nat: {
      capacidades: [dificultad('sangre', (ctx) => (participantesCtx(ctx).some((c) => copia(ctx.s, c).heridas > 0) ? 1 : 0))],
      exito: [{ tipo: 'curar', n: 1 }],
      fallo: [
        {
          tipo: 'aQuien',
          quien: { de: 'comprometidos', por: 'menosVida' },
          hacer: {
            tipo: 'varios',
            acciones: [
              { tipo: 'heridas', n: 1 },
              { tipo: 'estado', estado: 'buscado' },
            ],
          },
        },
      ],
    },
    // EXP 2 (3 si tienes 6 o más de reputación). Fallo: ocupa el muelle (pagas 2 para descartarla).
    ciu: {
      // Fase 11 (P66): 6 o más de reputación (antes 9, cuando se ganaba con 18).
      capacidades: [dificultad('fama', (ctx) => (ctx.s.reputacion >= 6 ? 1 : 0))],
      fallo: [{ tipo: 'ocuparMuelle', coste: 2 }],
    },
  },
  // +1; +2 en su lugar si algún comprometido está Buscado o el Barco está Perseguido. Sin oposición: el Capitán, 1 herida.
  destino: {
    modificador: (s, p) =>
      p.comprometidos.some((c) => s.zonas.tripulacion.includes(c) && tieneEstado(s, c, 'buscado')) || tieneEstadoBarco(s, 'perseguido') ? 2 : 1,
    sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }],
  },
})

// 25. La aduana del rey · Leve
registrarPeligro('p2_aduana', {
  encuentros: {
    // Al revelarse: Incautado, 2 cartas de la mano (1 con la Patente de corso).
    mar: {
      alRevelarse: [{ tipo: 'si', condicion: tienesLa('patente'), entonces: [{ tipo: 'incautar', que: 'mano', n: 1 }], sino: [{ tipo: 'incautar', que: 'mano', n: 2 }] }],
      exito: [{ tipo: 'recuperarIncautadas' }, robar(1)],
      fallo: [agotaCanones(1)],
    },
    // No puedes comprometer más de 2 Tripulantes.
    nat: { restriccion: { maximo: 2 }, fallo: [agotaCanones(1), comprometidoCon(mas('NAV'), { tipo: 'heridas', n: 1 })] },
    ciu: {
      elige: [
        { texto: 'Le untas la mano: descarta 2 cartas y ganas el Avance sin Prueba', efectos: [descartar(2)] },
        { texto: 'Pasas el género por tu cuenta: Prueba de EXP 3', prueba: true },
      ],
      exito: [avance(1), robar(1)],
      fallo: [{ tipo: 'descartarAzar', n: 2 }],
    },
  },
  // +0; −1 en su lugar si comprometiste a un Contrabandista. Si fallas, descarta 1 carta. Sin oposición: 1 al azar.
  destino: {
    modificador: (s) => (comprometidosDe(s).some((c) => tieneRasgo(s, c, 'Contrabandista')) ? -1 : 0),
    siFallas: [descartar(1)],
    sinOposicion: [{ tipo: 'descartarAzar', n: 1 }],
  },
})

// 26. Ojos del gobernador · Leve
registrarPeligro('p2_ojos', {
  encuentros: {
    mar: {
      exito: [comprometidoCon(mas('NAV'), { tipo: 'estado', estado: 'inspirado' })],
      fallo: [{ tipo: 'siguiente', mod: { de: 'prueba', n: 1 } }],
    },
    nat: { exito: [avance(2)], fallo: [pierdesAvance(1), agotar(1)] },
    // Elige: le pagas por callar (descarta 2 cartas), o no le pagas y la Prueba sube +2.
    // P35 (confirmada): si le pagas, se hace igualmente la Prueba de COM 2 (sin el +2); no se gana el Avance sin Prueba.
    ciu: {
      elige: [
        { texto: 'Le pagas por callar: descarta 2 cartas y Prueba de COM 2', efectos: [descartar(2)], prueba: true },
        { texto: 'No le pagas: Prueba de COM 2 con +2 (vuelve con los alguaciles)', prueba: true, modDificultad: 2 },
      ],
      exito: [robar(2)],
      fallo: [{ tipo: 'estado', estado: 'buscado', a: 'capitan' }],
    },
  },
  // +1. No puedes jugar Eventos en esta Prueba. Sin oposición: robas 1 menos al final de este turno.
  destino: { prueba: { sinEventos: true }, sinOposicion: [{ tipo: 'menosMando' }] },
})

// 27. Los grilletes del rey · Duro
registrarPeligro('p2_grilletes', {
  encuentros: {
    // Éxito: si tienes Capacidad, recluta gratis un Marinero del muelle; si no, roba 1.
    mar: {
      exito: [
        {
          tipo: 'si',
          condicion: { tipo: 'plazasLibres', minimo: 1 },
          entonces: [{ tipo: 'gratisDelMuelle', maxCoste: 99, que: 'tripulante', rasgo: 'Marinero' }],
          sino: [robar(1)],
        },
      ],
      fallo: [dano(2)],
    },
    nat: { exito: [avance(1)], fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer: { tipo: 'noPrepara', hasta: 'inicio' } }] },
    ciu: { exito: [preparar(2)], fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: 'menosVida' }, hacer: { tipo: 'rehen' } }] },
  },
  // +1. En esta Prueba no se pueden usar capacidades de Tripulantes. Sin oposición: agota a 1 Tripulante (fase 10b).
  destino: {
    prueba: { sinCapTripulantes: true },
    sinOposicion: [{ tipo: 'agotar', n: 1 }],
  },
})

// 28. El Santo Oficio · Duro
const SIN_NAV = 'p2_santooficio.sinNav'
registrarCodigo(SIN_NAV, (s) => {
  if (!s.mision || s.temporales.some((t) => t.clave === SIN_NAV)) return []
  s.temporales.push({ clave: SIN_NAV, fuente: 'p2_santooficio', hasta: 'finMision' })
  anotar(s, 'aviso', 'Hasta el final de la misión, el Barco no da su +1 de NAV.')
  return []
})
registrarPeligro('p2_santooficio', {
  encuentros: {
    // Fallo: hasta el final de la misión, el Barco no da su +1 de NAV.
    mar: { exito: [reparar(1)], fallo: [codigo(SIN_NAV)] },
    // Fallo: 1 herida a cada Tripulante comprometido (máx. 3).
    nat: {
      exito: [{ tipo: 'curar', n: 2 }],
      fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true, maximo: 3 }, hacer: { tipo: 'heridas', n: 1 } }],
    },
    // Al revelarse: Incautado, una Mejora a tu elección; si llevas el Amuleto, tiene que ser él.
    ciu: {
      alRevelarse: [{ tipo: 'incautar', que: 'mejora', n: 1, obligadas: ['amuleto'] }],
      exito: [{ tipo: 'recuperarIncautadas' }, comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'aguerrido' })],
      fallo: [reputacion(-1)],
    },
  },
  // +1; +2 en su lugar si un comprometido lleva el Amuleto; +0 si lleva el Escapulario. Sin oposición: descarta 2.
  destino: {
    modificador: (s) => (comprometidoLleva(s, 'amuleto') ? 2 : comprometidoLleva(s, 'escapulario') ? 0 : 1),
    sinOposicion: [descartar(2)],
  },
})
// La marca del fallo en el Mar: mientras dure, el Barco no da su +1 de NAV (se lee como efecto temporal por su clave).
registrarCapacidades({
  clave: SIN_NAV,
  carta: 'p2_santooficio',
  ventana: 'constante',
  desde: 'temporal',
  modifica: (_ctx, _yo, c) => (c.tipo === 'sinNavBarco' ? 1 : 0),
})

// 29. Toque a rebato · Duro
// Permanente 230 «Campanas a rebato»: al terminar cada encuentro, 1 ficha; con 3, el agotado con menos Vida queda rehén
// y se descarta. Acción: agota a un Oficial, o supera una Prueba de COM 3, para descartarla.
registrarPermanente('pm_campanas', {
  quitar: [
    { tipo: 'agotarRasgo', rasgo: 'Oficial' },
    { tipo: 'prueba', opciones: [{ hab: 'COM', dificultad: 3 }] },
  ],
  contador: {
    cuando: 'cartaResuelta',
    umbral: 3,
    efectos: [{ tipo: 'aQuien', quien: { de: 'agotados', por: 'menosVida' }, hacer: { tipo: 'rehen' } }],
    despues: 'descartar',
  },
})
registrarPeligro('p2_rebato', {
  encuentros: {
    // +1 por cada encuentro #Militar# o #Guardia# que ya hayas resuelto en esta misión (máx. +2).
    mar: {
      capacidades: [
        dificultad('lanchas', (ctx) => Math.min(2, (ctx.s.mision?.resueltas ?? []).filter((k) => k.includes('Armada') || k.includes('Militar') || k.includes('Guardia')).length)),
      ],
      fallo: [dano(1), comprometidoCon(mas('COM'), { tipo: 'heridas', n: 1 })],
    },
    nat: { exito: [preparaCanon()], fallo: [{ tipo: 'estadoBarco', estado: 'perseguido' }] },
    // Pon en juego la carta 230 del mazo de historia («Campanas a rebato»).
    ciu: { pone: { carta: 'pm_campanas' } },
  },
  // −1. Agota 1 Tripulante no comprometido. Sin oposición: agota 2 en lugar de 1.
  destino: {
    efectos: [
      {
        tipo: 'si',
        condicion: { tipo: 'comprometidos', minimo: 1 },
        entonces: [{ tipo: 'aQuien', quien: { de: 'noComprometidosPreparados', por: 'eleccion' }, hacer: { tipo: 'agotar' } }],
      },
    ],
    sinOposicion: [{ tipo: 'aQuien', quien: { de: 'preparados', cada: true, maximo: 2 }, hacer: { tipo: 'agotar' } }],
  },
})

// 30. El quinto del rey · Duro
registrarCodigo('p2_quinto.carga', (s, fuente) => {
  if (!s.mision || !fuente) return []
  s.mision.marcas = { ...(s.mision.marcas ?? {}), [`${fuente}.carga`]: s.zonas.mano.length >= 5 ? 1 : 0 }
  return []
})
registrarPeligro('p2_quinto', {
  encuentros: {
    // +1 si tienes 3 o más munición.
    mar: {
      capacidades: [dificultad('bodega', (ctx) => (canonesListos(ctx.s) >= 2 ? 1 : 0))],
      exito: [preparaCanon(), robar(1)],
      fallo: [agotaCanones(2)],
    },
    // Al revelarse: si tienes 5 o más cartas en la mano, +1.
    nat: {
      alRevelarse: [codigo('p2_quinto.carga')],
      capacidades: [{ clave: 'carga', ventana: 'constante', modifica: (ctx, yo, c) => (c.tipo === 'dificultad' && yo ? (ctx.s.mision?.marcas?.[`${yo}.carga`] ?? 0) : 0) }],
      exito: [robar(2)],
      fallo: [comprometidoCon(mas('COM'), { tipo: 'heridas', n: 1 }), pierdesAvance(1)],
    },
    ciu: { exito: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'inspirado' })], fallo: [{ tipo: 'ocuparMuelle', coste: 3 }] },
  },
  // +0. Si superas, descarta 1 carta (con la Patente de corso, no pagas). Sin oposición: pierdes 1 munición.
  destino: {
    siSuperas: [{ tipo: 'si', condicion: { tipo: 'no', condicion: tienesLa('patente') }, entonces: [descartar(1)] }],
    sinOposicion: [agotaCanones(1)],
  },
})

// 31. Bajo los cañones del Morro · Terrible
registrarEspecial('p2_morro.baterias', (s, t, e) => {
  const p = s.prueba
  if (!p) return 'hecha'
  if (t.paso === 0) {
    // «+4 en su lugar salvo que descartes 2 cartas»: sin 2 cartas en la mano, +4.
    if (s.zonas.mano.length < 2) {
      p.modDestino = 4
      anotar(s, 'efecto', 'Las baterías del castillo: no puedes descartar 2 cartas, el Destino es +4.')
      return 'hecha'
    }
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'baterias' },
        opciones: [
          { clave: 'descartar', texto: 'Descartar 2 cartas: el Destino es +2' },
          { clave: 'no', texto: 'No descartar: el Destino es +4' },
        ],
      })
    }
    if (eleccionDe(e, 'opcion').clave === 'descartar') {
      anotar(s, 'jugada', 'Os ponéis a cubierto: el Destino se queda en +2.')
      encolar(s, { tipo: 'pagar', cantidad: 2, motivo: 'p2_morro' })
      return 'hecha'
    }
    p.modDestino = 4
    anotar(s, 'jugada', 'Las baterías del castillo: el Destino es +4.')
  }
  return 'hecha'
})
registrarCodigo('p2_morro.baterias', () => [{ tipo: 'especial', clave: 'p2_morro.baterias', datos: {}, paso: 0 }])
// Permanente 231 «La cadena de la bocana»: no puedes superar la misión. Acción: Prueba de COM 5 (4 con un Carpintero):
// si superas, descarta esta carta y gana 1 Avance; si fallas, el Barco sufre 2 daños.
registrarPermanente('pm_cadena', {
  quitar: [
    {
      tipo: 'prueba',
      opciones: [{ hab: 'COM', dificultad: 5, alternativa: { rasgo: 'Carpintero', dificultad: 4 } }],
      exito: [avance(1)],
      fallo: [dano(2)],
    },
  ],
  bloqueaSuperar: true,
})
registrarPeligro('p2_morro', {
  encuentros: {
    // Pon en juego la carta 231 del mazo de historia («La cadena de la bocana»).
    mar: { pone: { carta: 'pm_cadena' } },
    // COM 6 (4 con un Artillero). Fallo: 3 heridas repartidas entre los comprometidos.
    nat: { exito: [preparaCanon()], fallo: [heridasAsignados(3)] },
    ciu: {
      exito: [{ tipo: 'rescatarRehenes', siNo: [avance(1)] }],
      fallo: [
        comprometidoCon(mas('NAV'), {
          tipo: 'varios',
          // Fase 10b: fuera Encadenado: queda rehén y sufre 1 herida (la herida antes, mientras sigue en tu tripulación).
          acciones: [
            { tipo: 'heridas', n: 1 },
            { tipo: 'rehen' },
          ],
        }),
      ],
    },
  },
  // +2; +4 en su lugar salvo que descartes 2 cartas. Sin oposición: en el Mar, el Barco sufre 1 daño; en Naturaleza o
  // Ciudad, el Capitán sufre 1 herida.
  destino: { efectos: [codigo('p2_morro.baterias')], sinOposicion: [enElMar([dano(1)], [{ tipo: 'heridas', n: 1, capitan: true }])] },
})

// 32. La horca · Terrible
const PATIBULO = 'p2_horca.patibulo'
// Fallo: lo suben al patíbulo. Ese Tripulante queda rehén (regla normal: si superas la misión lo rescatas; si no, lo
// pierdes y −1 de reputación).
registrarCodigo('p2_horca.verdugo', (s, fuente) => {
  const c = marcado(s, PATIBULO, fuente)
  return c ? [sucesoRehen(c)] : []
})
registrarPeligro('p2_horca', {
  encuentros: {
    // Cada Marinero comprometido suma 1 menos.
    mar: {
      capacidades: [habilidadDe('supersticiosos', (ctx, c) => (tieneRasgo(ctx.s, c, 'Marinero') ? -1 : 0))],
      exito: [robar(2)],
      fallo: [dano(2), agotaCanones(1)],
    },
    // +2 si algún Tripulante está Buscado.
    nat: {
      capacidades: [dificultad('lista', (ctx) => (ctx.s.zonas.tripulacion.some((c) => tieneEstado(ctx.s, c, 'buscado')) ? 2 : 0))],
      exito: [avance(1)],
      fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: 'menosVida' }, hacer: { tipo: 'rehen' } }],
    },
    // Al revelarse: el Tripulante preparado de menor coste está en el patíbulo y no puede comprometerse.
    // −2 si tienes 8 o más de reputación. Fallo: ese Tripulante queda rehén.
    // P36: «el Tripulante preparado de menor coste» no incluye al Capitán (no tiene coste); si empatan, eliges tú; si no
    // hay ninguno preparado, nadie sube al patíbulo y el fallo no se lleva a nadie.
    ciu: {
      alRevelarse: [
        {
          tipo: 'aQuien',
          quien: { de: 'preparados', por: 'menorCoste', sinCapitan: true },
          hacer: {
            tipo: 'varios',
            acciones: [
              { tipo: 'noCompromete', hasta: 'finPrueba' },
              { tipo: 'marcar', clave: PATIBULO },
            ],
          },
        },
      ],
      // Fase 11 (P66): 8 o más de reputación (antes 12, cuando se ganaba con 18).
      capacidades: [dificultad('gentio', (ctx) => (ctx.s.reputacion >= 8 ? -2 : 0))],
      exito: [reputacion(1)],
      fallo: [codigo('p2_horca.verdugo')],
    },
  },
  // +2. Si fallas por 3 o más, el comprometido con la habilidad más alta queda rehén. Sin oposición: el Capitán, Buscado.
  destino: {
    siFallas: [{ tipo: 'si', condicion: { tipo: 'falladaPor', minimo: 3 }, entonces: [comprometidoCon(mas('prueba'), { tipo: 'rehen' })] }],
    sinOposicion: [{ tipo: 'estado', estado: 'buscado', a: 'capitan' }],
  },
})

// 33. La Armada de Barlovento · Terrible
registrarPeligro('p2_armada', {
  encuentros: {
    // +2 si el Barco tiene Velas rotas. Éxito: nada más (fase 10b: superar un encuentro de tipo Armada ya quita
    // Perseguido). Fallo: Abordaje.
    mar: {
      abordaje: true,
      capacidades: [dificultad('velas', (ctx) => (tieneEstadoBarco(ctx.s, 'velasRotas') ? 2 : 0))],
    },
    nat: { exito: [preparar('comprometidos')], fallo: [heridasAsignados(2), pierdesAvance(1)] },
    ciu: { fallo: [{ tipo: 'descartarAzar', n: 3 }] },
  },
  // +1. Persigue. Sin oposición: pierdes 1 Avance.
  destino: { persigue: true, sinOposicion: [pierdesAvance(1)] },
})
