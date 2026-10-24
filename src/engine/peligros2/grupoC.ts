// Peligros 2.0 · Grupo C: La ley (cartas 23–33).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { registrarCapacidades } from '../capacidades/index.ts'
import type { Condicion } from '../efectos.ts'
import { anotar, copia } from '../estado.ts'
import { tieneEstado, tieneEstadoBarco } from '../estados.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import { marcado } from '../tareas/peligros2.ts'
import type { CartaId } from '../tipos.ts'
import {
  agotar,
  avance,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  enElMar,
  habilidadDe,
  heridas,
  heridaPorAsignado,
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

// 23. Desertores del rey · Favorable
registrarPeligro('p2_desertores', {
  encuentros: {
    // Sin Prueba: gana 2 munición.
    mar: { efecto: [preparaCanon()] },
    nat: { exito: [avance(1)], fallo: [comprometidoCon(mas('EXP'), { tipo: 'heridas', n: 1 })] },
    // Sin Prueba: el siguiente encuentro #Guardia# o #Militar# de esta misión recibe −2.
    // Fase 13 (I2): +1 [avance] (antes, «el siguiente encuentro #Guardia# o #Militar# −2»).
    ciu: { efecto: [avance(1)] },
  },
  // −1; −2 en su lugar si el encuentro es #Militar# o #Guardia#. Si aun así fallas, el Barco queda Perseguido.
  // Sin oposición: +1 en su lugar.
  // +1. Sin oposición: −1 en su lugar. (Fase 13, I1: fuera «Armada, Militar o Guardia: +2» y «si fallas, Perseguido».)
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 1 : -1) },
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
  // −1. Sin oposición: el Capitán sufre 1 herida. (Fase 13, I1: fuera «Buscado o Perseguido: −2».)
  destino: { sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
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
        { texto: 'Untarle la mano: descarta 2 cartas y ganas el Avance sin Prueba', efectos: [descartar(2)] },
        { texto: 'Pasar el género por tu cuenta: EXP 3', prueba: true },
      ],
      exito: [avance(1), robar(1)],
      fallo: [{ tipo: 'descartarAzar', n: 2 }],
    },
  },
  // +0; −1 en su lugar si comprometiste a un Contrabandista. Si fallas, descarta 1 carta. Sin oposición: 1 al azar.
  // 0. Sin oposición: descarta 1 carta al azar. (Fase 13, I1: fuera «con un Contrabandista, +1» y «si fallas, descarta 1».)
  destino: { sinOposicion: [{ tipo: 'descartarAzar', n: 1 }] },
})

// 26. Ojos del gobernador · Leve
registrarPeligro('p2_ojos', {
  encuentros: {
    mar: {
      // Fase 13 (I4): prepara a 1 Tripulante asignado (antes, el de más NAV quedaba Inspirado: nunca llegaba a usarlo).
      exito: [comprometidoCon('eleccion', { tipo: 'preparar' })],
      fallo: [{ tipo: 'siguiente', mod: { de: 'prueba', n: 1 } }],
    },
    nat: { exito: [avance(2)], fallo: [pierdesAvance(1), agotar(1)] },
    // Elige: le pagas por callar (descarta 2 cartas), o no le pagas y la Prueba sube +2.
    // P35 (confirmada): si le pagas, se hace igualmente la Prueba de COM 2 (sin el +2); no se gana el Avance sin Prueba.
    ciu: {
      elige: [
        { texto: 'Pagarle por callar: descarta 2 cartas y haces la Prueba de COM 2', efectos: [descartar(2)], prueba: true },
        { texto: 'No pagarle: la Prueba recibe +2 de dificultad (vuelve con los alguaciles)', prueba: true, modDificultad: 2 },
      ],
      exito: [robar(2)],
      fallo: [{ tipo: 'estado', estado: 'buscado', a: 'capitan' }],
    },
  },
  // +1. No puedes jugar Eventos en esta Prueba. Sin oposición: robas 1 menos al final de este turno.
  // −1. Sin oposición: «Tu tripulación queda Desmoralizada» (fase 16; antes, «Al final de este turno, roba 1 carta menos»).
  // (Fase 13, I1: fuera «no puedes jugar Eventos en esta Prueba».)
  destino: { sinOposicion: [{ tipo: 'estadoBarco', estado: 'desanimo' }] },
})

// 27. Los grilletes del rey · Duro
registrarPeligro('p2_grilletes', {
  encuentros: {
    // Fase 14 (Albert): éxito, «Mira las 3 cartas superiores del mazo de muelle. Puedes reclutar sin coste un Tripulante
    // de coste 2 o menos de entre ellas. Pon las demás al fondo del mazo de muelle.» (Ya no pide Marinero ni roba 1.)
    mar: {
      exito: [{ tipo: 'reclutarDelMazoMuelle', n: 3, maxCoste: 2 }],
      fallo: [dano(2)],
    },
    // Fase 16: «Los Tripulantes asignados quedan Extenuados».
    nat: { exito: [avance(1)], fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer: { tipo: 'estado', estado: 'extenuado' } }] },
    // Fallo (fase 14, fuera el rehén): descarta al asignado con menos Vida.
    ciu: { exito: [preparar(2)], fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: 'menosVida' }, hacer: { tipo: 'descartar' } }] },
  },
  // +1. En esta Prueba no se pueden usar capacidades de Tripulantes. Sin oposición: agota a 1 Tripulante (fase 10b).
  // −1. Sin oposición: agota a 1 Tripulante. (Fase 13, I1: fuera «no se pueden usar capacidades de Tripulantes».)
  destino: { sinOposicion: [{ tipo: 'agotar', n: 1 }] },
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
      // Fase 13 (P79): «Inflige 1 herida por cada Tripulante asignado (máx. 3)» (libres).
      fallo: [heridaPorAsignado({ maximo: 3 })],
    },
    // Al revelarse: Incautado, una Mejora que elijas (P128); si llevas el Amuleto, tiene que ser él.
    ciu: {
      alRevelarse: [{ tipo: 'incautar', que: 'mejora', n: 1, obligadas: ['amuleto'] }],
      exito: [{ tipo: 'recuperarIncautadas' }, comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'aguerrido' })],
      fallo: [reputacion(-1)],
    },
  },
  // +1; +2 en su lugar si un comprometido lleva el Amuleto; +0 si lleva el Escapulario. Sin oposición: descarta 2.
  // −1. Sin oposición: descarta 2 cartas. (Fase 13, I1: fuera el Amuleto y el Escapulario.)
  destino: { sinOposicion: [descartar(2)] },
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
// Permanente 230 «Campanas a rebato»: al terminar cada encuentro, 1 ficha; con 3, descarta al agotado con menos Vida
// (fase 14: antes, rehén) y se descarta. Acción: agota a un Oficial, o supera una Prueba de COM 3, para descartarla.
// TODO(regla): solo los encuentros piden Pruebas (regla general de Albert): esta Acción con Prueba pasará a Destina
// cuando Albert revise el mazo de historia. Mientras, se queda como está.
registrarPermanente('pm_campanas', {
  quitar: [
    { tipo: 'agotarRasgo', rasgo: 'Oficial' },
    { tipo: 'prueba', opciones: [{ hab: 'COM', dificultad: 3 }] },
  ],
  contador: {
    cuando: 'cartaResuelta',
    umbral: 3,
    efectos: [{ tipo: 'aQuien', quien: { de: 'agotados', por: 'menosVida' }, hacer: { tipo: 'descartar' } }],
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
  // +1. Sin oposición: agota a 2 Tripulantes. (Fase 13, I1: fuera «agota a 1 Tripulante no asignado».)
  destino: { sinOposicion: [{ tipo: 'aQuien', quien: { de: 'preparados', cada: true, maximo: 2 }, hacer: { tipo: 'agotar' } }] },
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
    // Fase 13 (I4): éxito, prepara a 1 Tripulante asignado (antes, Inspirado).
    ciu: { exito: [comprometidoCon('eleccion', { tipo: 'preparar' })], fallo: [{ tipo: 'ocuparMuelle', coste: 3 }] },
  },
  // +0. Si superas, descarta 1 carta (con la Patente de corso, no pagas). Sin oposición: pierdes 1 munición.
  // 0. Sin oposición: agota 1 Cañón. (Fase 13, I1: fuera «si superas, descarta 1 carta salvo con la Patente».)
  destino: { sinOposicion: [agotaCanones(1)] },
})

// 31. Bajo los cañones del Morro · Terrible
// Permanente 231 «La cadena de la bocana»: no puedes superar la misión. Acción: Prueba de COM 5 (4 si tienes un Carpintero preparado):
// si superas, descarta esta carta y gana 1 Avance; si fallas, el Barco sufre 2 daños.
// TODO(regla): solo los encuentros piden Pruebas (regla general de Albert): esta Acción con Prueba pasará a Destina
// cuando Albert revise el mazo de historia. Mientras, se queda como está.
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
    // Fase 13: heridas libres («Inflige 3 heridas»; antes, repartidas entre los asignados).
    nat: { exito: [preparaCanon()], fallo: [heridas(3)] },
    // Fase 14 (fuera el rehén): éxito, +1 [avance] (un preso agradecido os cuenta el camino); fallo, el asignado con más
    // NAV queda Buscado y sufre 1 herida.
    ciu: {
      exito: [avance(1)],
      fallo: [comprometidoCon(mas('NAV'), { tipo: 'varios', acciones: [{ tipo: 'estado', estado: 'buscado' }, { tipo: 'heridas', n: 1 }] })],
    },
  },
  // +2; +4 en su lugar salvo que descartes 2 cartas. Sin oposición: en el Mar, el Barco sufre 1 daño; en Naturaleza o
  // Ciudad, el Capitán sufre 1 herida.
  // −2. Sin oposición: [mar]: Daña 1; [nat]/[ciu]: el Capitán sufre 1 herida. (Fase 13, I1: fuera «−4 en su lugar, salvo
  // que descartes 2 cartas».)
  destino: { sinOposicion: [enElMar([dano(1)], [{ tipo: 'heridas', n: 1, capitan: true }])] },
})

// 32. La horca · Terrible
const PATIBULO = 'p2_horca.patibulo'
// Fallo (fase 14, fuera el rehén): lo suben al patíbulo y lo ahorcan: ese Tripulante se descarta.
registrarCodigo('p2_horca.verdugo', (s, fuente) => {
  const c = marcado(s, PATIBULO, fuente)
  return c ? [{ tipo: 'aQuien', quien: { de: 'tripulacion', inst: c }, hacer: { tipo: 'descartar' }, ...(fuente ? { fuente } : {}) }] : []
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
      // Fase 14 (fuera el rehén): el asignado con menos Vida queda Buscado y sufre 1 herida.
      fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: 'menosVida' }, hacer: { tipo: 'varios', acciones: [{ tipo: 'estado', estado: 'buscado' }, { tipo: 'heridas', n: 1 }] } }],
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
  // −2. Sin oposición: el Capitán queda Buscado. (Fase 13, I1: fuera «si fallas por 3 o más, rehén».)
  destino: { sinOposicion: [{ tipo: 'estado', estado: 'buscado', a: 'capitan' }] },
})

// 33. La Armada de Barlovento · Terrible
registrarPeligro('p2_armada', {
  encuentros: {
    // +2 si el Barco está Desarbolado (antes, Velas rotas). Éxito: nada más (fase 10b: superar un encuentro de tipo Armada ya quita
    // Perseguido). Fallo: Abordaje.
    mar: {
      abordaje: true,
      capacidades: [dificultad('velas', (ctx) => (tieneEstadoBarco(ctx.s, 'velasRotas') ? 2 : 0))],
    },
    // Fase 13: heridas libres («Inflige 2 heridas»; antes, repartidas entre los asignados).
    nat: { exito: [preparar('comprometidos')], fallo: [heridas(2), pierdesAvance(1)] },
    ciu: { fallo: [{ tipo: 'descartarAzar', n: 3 }] },
  },
  // +1. Persigue. Sin oposición: pierdes 1 Avance.
  // −1, Persigue. Sin oposición (fase 13, I6): −1 [avance] (mín. 0).
  destino: { persigue: true, sinOposicion: [{ tipo: 'menosAvanceEncuentro', n: 1 }] },
})
