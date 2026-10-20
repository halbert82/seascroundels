// Peligros 2.0 · Grupo D: Rivales y tu propia tripulación (cartas 34–44).

import { registrarPeligro, registrarPermanente } from '../capacidades/peligros.ts'
import { iconosDe } from '../catalogo.ts'
import type { Efecto } from '../efectos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { ponerEstado, tieneEstado } from '../estados.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { eleccionDe, preguntar } from '../tareas/comun.ts'
import { margen, registrarCodigo } from '../tareas/efectos.ts'
import { habilidadImpresa, preparar as prepararCopia, registrarEspecial } from '../tareas/peligros2.ts'
import { mover, moverA, rebarajar } from '../zonas.ts'
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
  habilidadDe,
  heridas,
  heridasAsignados,
  mas,
  preparaCanon,
  participantesCtx,
  pierdesAvance,
  agotaCanones,
  preparar,
  reparar,
  robar,
  siTienes,
  tieneRasgo,
} from './comun.ts'

/** Tripulantes comprometidos que siguen en juego. */
function comprometidos(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

function herida(objetivo: InstId, cantidad = 1): NuevaTarea {
  return { tipo: 'evento', ev: { tipo: 'heridas', objetivo, cantidad }, fase: 'antes', cancelado: false, usadas: [] }
}

/** «2 heridas repartidas» fuera del recuadro rojo: entre toda la tripulación. */
registrarCodigo('p2_motin.dosHeridas', (s) => [{ tipo: 'repartirHeridas', n: 2, entre: [...s.zonas.tripulacion] }])

// 34. Hermanos de la Costa · Favorable
registrarPeligro('p2_hermanos', {
  encuentros: {
    // Gana 1 munición y repara 1 daño. Si tienes un Bucanero, gana 1 munición más.
    mar: { efecto: [preparaCanon(), reparar(1), siTienes('Bucanero', [preparaCanon()])] },
    // Cura 2 heridas, repartidas como quieras. Si no tenías heridas, prepara 1 Tripulante (se mira antes de curar).
    nat: { efecto: [{ tipo: 'si', condicion: { tipo: 'no', condicion: { tipo: 'heridas', minimo: 1 } }, entonces: [preparar(1)] }, { tipo: 'curar', n: 2 }] },
    // Éxito: recluta gratis un Tripulante de coste 2 o menos del muelle (si tienes Capacidad). Fallo: descarta 1.
    ciu: { exito: [{ tipo: 'gratisDelMuelle', maxCoste: 2, que: 'tripulante' }], fallo: [descartar(1)] },
  },
  // −1; −2 en su lugar si el encuentro es Pirata y comprometiste a un Bucanero. Sin oposición: pierdes 1 munición.
  destino: {
    modificador: (s, p) => (encuentroEs(s, 'Pirata') && p.comprometidos.some((c) => s.zonas.tripulacion.includes(c) && tieneRasgo(s, c, 'Bucanero')) ? -2 : -1),
    sinOposicion: [agotaCanones(1)],
  },
})

// 35. Barril de ron · Favorable
// «Lenguas sueltas»: mira las 3 de arriba del mazo de muelle; pon 1 en el muelle en lugar de la carta de más a la
// izquierda (que se descarta) y las otras al fondo.
// P42 (confirmada): una carta de Peligro que ocupa el muelle no cuenta como «la de más a la izquierda»: se salta (si
// no, la quitarías gratis); las otras van al fondo en el orden en que estaban.
registrarEspecial('p2_barril.lenguas', (s, _t, e) => {
  if (s.zonas.mazoMuelle.length === 0 && s.zonas.descartesMuelle.length > 0) {
    rebarajar(s, 'descartesMuelle', 'mazoMuelle')
    anotar(s, 'aviso', 'Se acaba el mazo de muelle: se baraja su pila de descartes.')
  }
  const vistas = s.zonas.mazoMuelle.slice(0, 3)
  if (vistas.length === 0) return 'hecha'
  if (!e) {
    s.infoRevelada++
    anotar(s, 'revelar', `Miras las cartas de arriba del mazo de muelle: ${nombres(s, vistas)}.`)
    if (vistas.length > 1) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'lenguasSueltas' }, candidatas: vistas, min: 1, max: 1 })
  }
  const elegida = vistas.length === 1 ? vistas[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegida) return 'hecha'
  const izquierda = s.zonas.muelle.find((c) => s.peligrosEnMuelle?.[c] === undefined)
  const indice = izquierda ? s.zonas.muelle.indexOf(izquierda) : s.zonas.muelle.length
  if (izquierda) {
    mover(s, izquierda, 'descartesMuelle')
    anotar(s, 'efecto', `Se descarta del muelle «${nombre(s, izquierda)}».`)
  }
  moverA(s, elegida, 'muelle', indice)
  anotar(s, 'efecto', `«${nombre(s, elegida)}» entra en el muelle.`)
  const resto = vistas.filter((c) => c !== elegida)
  for (const c of resto) mover(s, c, 'mazoMuelle', 'abajo')
  if (resto.length > 0) anotar(s, 'efecto', `Pones al fondo del mazo de muelle: ${nombres(s, resto)}.`)
  return 'hecha'
})
registrarCodigo('p2_barril.lenguas', () => [{ tipo: 'especial', clave: 'p2_barril.lenguas', datos: {}, paso: 0 }])
registrarPeligro('p2_barril', {
  encuentros: {
    // Prepara a todos tus Tripulantes. El Tripulante con más COM queda Borracho.
    mar: { efecto: [preparar('todos'), { tipo: 'aQuien', quien: { de: 'tripulacion', por: mas('COM') }, hacer: { tipo: 'estado', estado: 'borracho' } }] },
    nat: { exito: [preparaCanon(), preparar(1)], fallo: [comprometidoCon(mas('EXP'), { tipo: 'heridas', n: 1 })] },
    ciu: { efecto: [codigo('p2_barril.lenguas')] },
  },
  // −1; −2 en su lugar si comprometiste a un Tripulante Borracho. Sin oposición: el preparado con más NAV queda Borracho.
  destino: {
    modificador: (s, p) => (p.comprometidos.some((c) => s.zonas.tripulacion.includes(c) && tieneEstado(s, c, 'borracho')) ? -2 : -1),
    sinOposicion: [{ tipo: 'aQuien', quien: { de: 'preparados', por: mas('NAV') }, hacer: { tipo: 'estado', estado: 'borracho' } }],
  },
})

// 36. Sangre caliente · Leve
const PELEA = 'p2_sangre.pelea'
// «Tus dos Tripulantes con más COM (sin contar al Capitán) se están pegando: no pueden comprometerse.» Se mira al
// revelarla (COM impresa); si hay empate en el corte, eliges. Quedan señalados para el fallo («cada uno sufre 1 herida»).
registrarEspecial('p2_sangre.bronca', (s, t, e) => {
  const carta = t.fuente
  const candidatos = s.zonas.tripulacion.filter((c) => c !== s.capitan)
  const com = (c: InstId) => habilidadImpresa(s, c, 'COM')
  let elegidos: InstId[]
  if (candidatos.length <= 2) elegidos = candidatos
  else {
    const orden = [...candidatos].sort((a, b) => com(b) - com(a))
    const corte = com(orden[1] as InstId)
    const seguros = orden.filter((c) => com(c) > corte)
    const empatados = orden.filter((c) => com(c) === corte)
    const faltan = 2 - seguros.length
    if (empatados.length > faltan) {
      if (!e) {
        return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'se pelea (no puede ser asignado)', n: faltan }, candidatas: empatados, min: faltan, max: faltan })
      }
      elegidos = [...seguros, ...eleccionDe(e, 'cartas').ids]
    } else elegidos = [...seguros, ...empatados]
  }
  for (const c of elegidos) {
    s.temporales.push({ clave: 'noCompromete', fuente: 'p2_sangre', hasta: 'finPrueba', inst: c, ...(carta ? { carta } : {}) })
    s.temporales.push({ clave: PELEA, fuente: 'p2_sangre', hasta: 'finMision', inst: c, ...(carta ? { carta } : {}) })
  }
  if (elegidos.length > 0) anotar(s, 'aviso', `${nombres(s, elegidos)} se están pegando: no pueden ser asignados.`)
  return 'hecha'
})
registrarCodigo('p2_sangre.bronca', (_s, fuente) => [{ tipo: 'especial', clave: 'p2_sangre.bronca', ...(fuente ? { fuente } : {}), datos: {}, paso: 0 }])
// Fallo: «Los dos se rompen la cara. Cada uno sufre 1 herida.»
registrarCodigo('p2_sangre.golpes', (s, fuente) =>
  s.temporales.filter((x) => x.clave === PELEA && x.inst && (!fuente || x.carta === fuente) && s.zonas.tripulacion.includes(x.inst)).map((x) => herida(x.inst as InstId)),
)
// Destino «Echarse la culpa»: si fallas y comprometiste a dos o más, el de la habilidad más alta y el de la más baja
// sufren 1 herida cada uno (si empatan, eliges).
// P43 (confirmada): son siempre dos Tripulantes distintos: si todos empatan, eliges uno como «el más alto» y otro como
// «el más bajo» (nadie sufre 2 heridas).
registrarEspecial('p2_sangre.culpa', (s, t, e) => {
  const comp = comprometidos(s)
  const hab = s.prueba?.hab
  if (comp.length < 2 || !hab) return 'hecha'
  const valorDe = (c: InstId) => habilidadImpresa(s, c, hab)
  if (t.paso === 0) {
    const maximo = Math.max(...comp.map(valorDe))
    const altos = comp.filter((c) => valorDe(c) === maximo)
    const alto = altos.length === 1 ? altos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
    if (!alto) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'sufre 1 herida (la habilidad más alta)', n: 1 }, candidatas: altos, min: 1, max: 1 })
    t.datos.alto = alto
    t.paso = 1
    return 'sigue'
  }
  const alto = t.datos.alto as InstId
  const resto = comp.filter((c) => c !== alto)
  const minimo = Math.min(...resto.map(valorDe))
  const bajos = resto.filter((c) => valorDe(c) === minimo)
  const bajo = bajos.length === 1 ? bajos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!bajo) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'sufre 1 herida (la habilidad más baja)', n: 1 }, candidatas: bajos, min: 1, max: 1 })
  anotar(s, 'efecto', `Se echan la culpa: ${nombre(s, alto)} y ${nombre(s, bajo)}.`)
  encolar(s, herida(alto), herida(bajo))
  return 'hecha'
})
registrarCodigo('p2_sangre.culpa', () => [{ tipo: 'especial', clave: 'p2_sangre.culpa', datos: {}, paso: 0 }])
registrarPeligro('p2_sangre', {
  encuentros: {
    // Los dos con más COM no pueden comprometerse. Cada Oficial comprometido suma +1.
    mar: {
      alRevelarse: [codigo('p2_sangre.bronca')],
      capacidades: [habilidadDe('oficiales', (ctx, c) => (tieneRasgo(ctx.s, c, 'Oficial') ? 1 : 0))],
      exito: [reparar(1)],
      fallo: [codigo('p2_sangre.golpes')],
    },
    // Éxito: cura 1 herida a dos Tripulantes distintos. Fallo: el de más COM cura 1; el de menos Vida sufre 1.
    nat: {
      exito: [{ tipo: 'aQuien', quien: { de: 'heridos', cada: true, maximo: 2 }, hacer: { tipo: 'curar', n: 1 } }],
      fallo: [
        { tipo: 'aQuien', quien: { de: 'tripulacion', por: mas('COM') }, hacer: { tipo: 'curar', n: 1 } },
        { tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'heridas', n: 1 } },
      ],
    },
    ciu: { exito: [avance(1), robar(1)], fallo: [comprometidoCon(mas('COM'), { tipo: 'heridas', n: 1 }), descartar(1)] },
  },
  // +1. Si fallas con dos o más comprometidos, el más alto y el más bajo sufren 1 herida. Sin oposición: agota 1.
  destino: { siFallas: [codigo('p2_sangre.culpa')], sinOposicion: [agotar(1)] },
})

// 37. El tahúr · Leve
const doblo = (s: Estado, carta: InstId | undefined) => (carta ? (s.mision?.marcas?.[`${carta}.doblo`] ?? 0) > 0 : false)
function marcar(s: Estado, carta: InstId | undefined, clave: string, n: number): void {
  if (s.mision && carta) s.mision.marcas = { ...(s.mision.marcas ?? {}), [`${carta}.${clave}`]: n }
}
registrarCodigo('p2_tahur.apuesta', (s, fuente) => {
  marcar(s, fuente, 'doblo', 0)
  return []
})
registrarCodigo('p2_tahur.doblar', (s, fuente) => {
  marcar(s, fuente, 'doblo', 1)
  return []
})
registrarCodigo('p2_tahur.bolsa', (s, fuente) => [{ tipo: 'robar', n: doblo(s, fuente) ? 4 : 2 }])
registrarCodigo('p2_tahur.aparejo', (s, fuente) => (doblo(s, fuente) ? [{ tipo: 'aplicarEfectos', efectos: [dano(1)], contexto: 'efecto' }] : []))
/** Descarta N cartas de arriba de tu mazo del capitán (si no queda ninguna, no pasa nada). */
function descartarDeArriba(s: Estado, n: number): InstId[] {
  const cartas = s.zonas.mazoCapitan.slice(0, n)
  for (const c of cartas) mover(s, c, 'descartesCapitan')
  if (cartas.length > 0) {
    s.infoRevelada++
    anotar(s, 'revelar', `Descartas de arriba de tu mazo: ${nombres(s, cartas)}.`)
  }
  return cartas
}
// Destino «Dados cargados»: descarta la de arriba de tu mazo; con icono COM, +2 en su lugar; si no, con EXP, −1.
// P40 (confirmada): si tu mazo del capitán está vacío, no se descarta nada ni se baraja la pila de descartes: el
// Destino se queda en +0 (y Sin oposición no descarta nada).
registrarCodigo('p2_tahur.dados', (s) => {
  const [c] = descartarDeArriba(s, 1)
  const p = s.prueba
  if (!c || !p) return []
  const id = copia(s, c).id
  if (iconosDe(id, 'COM') > 0) {
    p.modDestino = 2
    anotar(s, 'efecto', '«Dados cargados»: tiene icono de COM, te pillan la trampa: +2.')
  } else if (iconosDe(id, 'EXP') > 0) {
    p.modDestino = -1
    anotar(s, 'efecto', '«Dados cargados»: tiene icono de EXP: −1.')
  }
  return []
})
registrarCodigo('p2_tahur.dados2', (s) => {
  descartarDeArriba(s, 2)
  return []
})
registrarPeligro('p2_tahur', {
  encuentros: {
    // Antes de comprometer, puedes doblar la apuesta: la Prueba recibe +2.
    mar: {
      alRevelarse: [codigo('p2_tahur.apuesta')],
      elige: [
        { texto: 'No doblar la apuesta: Prueba de NAV 3', prueba: true },
        { texto: 'Doblar la apuesta: la Prueba recibe +2 (robas 4 si ganas)', prueba: true, modDificultad: 2, efectos: [codigo('p2_tahur.doblar')] },
      ],
      exito: [codigo('p2_tahur.bolsa')],
      fallo: [descartar(2), codigo('p2_tahur.aparejo')],
    },
    nat: { exito: [preparaCanon()], fallo: [agotar(1)] },
    // Sin ayuda. Cada carta de tu mano que comprometas suma +1 más.
    ciu: {
      sinAyuda: true,
      capacidades: [
        { clave: 'naipes', ventana: 'constante', modifica: (ctx, _yo, q) => (q.tipo === 'totalPrueba' && ctx.s.prueba && !ctx.s.prueba.sinCartas ? ctx.s.prueba.cartas.length : 0) },
      ],
      exito: [robar(3)],
      fallo: [heridasAsignados(2)],
    },
  },
  destino: { efectos: [codigo('p2_tahur.dados')], sinOposicion: [codigo('p2_tahur.dados2')] },
})

// 38. Paga atrasada · Leve
// Permanente 232 «Murmullos en el sollado»: cada otro Peligro revelado, 1 ficha de Descontento; con 3, 2 daños al Barco
// y se descarta. Respuesta: después de superar una Prueba por 2 o más, quita 1 ficha. Acción: descarta 2 cartas para
// descartarla.
registrarPermanente('pm_murmullos', {
  quitar: [{ tipo: 'pagar', n: 2 }],
  contador: { cuando: 'revelarPeligro', umbral: 3, efectos: [dano(2)], despues: 'descartar' },
  capacidades: [
    {
      clave: 'calma',
      ventana: 'respuesta',
      disparo: (s, yo, ev, fase) => fase === 'despues' && ev.tipo === 'superarPrueba' && yo !== null && (copia(s, yo).fichas ?? 0) > 0 && margen(s) >= 2,
      efecto: (s, yo) => {
        if (yo && (copia(s, yo).fichas ?? 0) > 0) {
          copia(s, yo).fichas = (copia(s, yo).fichas ?? 0) - 1
          anotar(s, 'efecto', `Ganar calma los ánimos: «${nombre(s, yo)}» pierde 1 ficha (${copia(s, yo).fichas}).`)
        }
        return []
      },
    },
  ],
})
registrarPeligro('p2_paga', {
  encuentros: {
    // Pon en juego la carta 232 del mazo de historia («Murmullos en el sollado»).
    mar: { pone: { carta: 'pm_murmullos' } },
    // Fallo: tu Tripulante de menor coste deserta: vuelve al muelle (fase 10b, antes Encadenado).
    // P41 (confirmada): el Capitán no tiene coste impreso: no cuenta como «el de menor coste» (si no, siempre sería él).
    nat: { exito: [avance(1)], fallo: [{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menorCoste', sinCapitan: true }, hacer: { tipo: 'alMuelle' } }] },
    // Elige: pagas (1 carta por cada Tripulante que tengas, máx. 3; el Capitán es un Tripulante) o Prueba de COM 3,
    // +1 por cada Bucanero que tengas (máx. +2).
    ciu: {
      elige: [
        { texto: 'Pagar: descarta 1 carta por cada Tripulante que tengas (máx. 3)', efectos: [{ tipo: 'porCada', medida: 'tripulantes', efectos: [descartar(1)], maximo: 3 }] },
        { texto: 'Plantarte: Prueba de COM 3, +1 por cada Bucanero (máx. +2)', prueba: true },
      ],
      capacidades: [dificultad('bucaneros', (ctx) => Math.min(2, ctx.s.zonas.tripulacion.filter((c) => tieneRasgo(ctx.s, c, 'Bucanero')).length))],
      exito: [robar(2)],
      fallo: [descartar(2), { tipo: 'heridas', n: 1, capitan: true }],
    },
  },
  // +1; +2 en su lugar si comprometiste a 3 o más. Sin oposición: −1 Mando en tu próximo turno.
  destino: { modificador: (_s, p) => (p.comprometidos.length >= 3 ? 2 : 1), sinOposicion: [{ tipo: 'menosMando', proximo: true }] },
})

// 39. A sueldo · Leve
registrarPeligro('p2_sueldo', {
  encuentros: {
    // Elige antes de comprometer: le das 2 munición (si no las tienes, no puedes), o la Prueba recibe +2.
    mar: {
      elige: [
        { texto: 'Agotas 2 Cañones: Prueba de EXP 3', efectos: [agotaCanones(2)], prueba: true },
        { texto: 'No le das nada: la Prueba recibe +2', prueba: true, modDificultad: 2 },
      ],
      exito: [avance(1)],
      fallo: [dano(1), agotaCanones(1)],
    },
    nat: {
      exito: [{ tipo: 'siguiente', mod: { de: 'prueba', n: -1 } }],
      fallo: [pierdesAvance(1), comprometidoCon(mas('NAV'), { tipo: 'heridas', n: 1 })],
    },
    // Fallo: Incautado: las 2 de más coste de tu mano; si superas la misión, las recuperas y robas 1; si no, se descartan.
    ciu: {
      exito: [preparaCanon()],
      fallo: [{ tipo: 'incautar', que: 'mano', n: 2, criterio: 'mayorCoste', alRecuperar: [robar(1)], siPierdes: 'descartar' }],
    },
  },
  // +0. Si comprometiste a dos o más, el de menor coste no suma. Sin oposición: descarta 2 cartas.
  // P41 (confirmada): el Capitán no tiene coste impreso: no cuenta como «el de menor coste».
  destino: {
    efectos: [
      {
        tipo: 'si',
        condicion: { tipo: 'comprometidos', minimo: 2 },
        entonces: [{ tipo: 'aQuien', quien: { de: 'comprometidos', por: 'menorCoste', sinCapitan: true }, hacer: { tipo: 'noSuma' } }],
      },
    ],
    sinOposicion: [descartar(2)],
  },
})

// 40. La sombra de Bastián · Duro
registrarPeligro('p2_bastian', {
  encuentros: {
    // NAV 4, +1 si el Barco tiene 2 o más daños. Éxito: +1 Avance; si superas por 2 o más, esta carta Se retira.
    mar: {
      capacidades: [dificultad('cojea', (ctx) => (ctx.s.danoBarco >= 2 ? 1 : 0))],
      exito: [avance(1), { tipo: 'si', condicion: { tipo: 'superadaPor', minimo: 2 }, entonces: [{ tipo: 'seRetira' }] }],
      fallo: [dano(1), { tipo: 'estadoBarco', estado: 'perseguido' }],
    },
    nat: { exito: [avance(1), preparar(1)], fallo: [pierdesAvance(2)] },
    ciu: { exito: [avance(1)], fallo: [{ tipo: 'siguiente', mod: { de: 'prueba', n: 2 } }] },
  },
  // +1. Persigue. Sin oposición: pierdes 1 Avance.
  destino: { persigue: true, sinOposicion: [pierdesAvance(1)] },
})

// 41. Los holandeses de Curazao · Duro
const METRALLA = 'metralla'
registrarCodigo('p2_curazao.reset', (s, fuente) => {
  marcar(s, fuente, METRALLA, 0)
  return []
})
registrarCodigo('p2_curazao.metralla', (s, fuente) => {
  marcar(s, fuente, METRALLA, 1)
  return []
})
registrarPeligro('p2_curazao', {
  encuentros: {
    // Antes de asignar, puedes agotar un Cañón: −1, o −2 si asignas a un Artillero. Abordaje. (Fase 10b.)
    mar: {
      alRevelarse: [codigo('p2_curazao.reset')],
      elige: [
        { texto: 'Sin agotar ningún Cañón: Prueba de COM 5', prueba: true },
        { texto: 'Agotar un Cañón: −1, o −2 si asignas a un Artillero', prueba: true, efectos: [agotaCanones(1), codigo('p2_curazao.metralla')] },
      ],
      capacidades: [
        {
          clave: METRALLA,
          ventana: 'constante',
          modifica: (ctx, yo, q) => {
            if (q.tipo !== 'dificultad' || !yo || !ctx.s.mision?.marcas?.[`${yo}.${METRALLA}`]) return 0
            return participantesCtx(ctx).some((c) => tieneRasgo(ctx.s, c, 'Artillero')) ? -2 : -1
          },
        },
      ],
      abordaje: true,
      exito: [preparaCanon(), robar(2)],
    },
    nat: {
      exito: [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true, maximo: 3 }, hacer: { tipo: 'curar', n: 1 } }],
      fallo: [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true, maximo: 3 }, hacer: { tipo: 'heridas', n: 1 } }],
    },
    // «Te roban el barco»: la carta dice expresamente que daña el Barco en tierra (P19).
    ciu: { exito: [reparar(1), preparaCanon()], fallo: [{ tipo: 'dano', n: 2, enTierra: true }, descartar(1)] },
  },
  // −1. Prueba de COM: el Tripulante asignado con la COM más alta sufre 1 herida.
  // Sin oposición: inflige 1 herida a un Tripulante (fase 10: ya no tiene que estar preparado).
  destino: {
    efectos: [
      {
        tipo: 'si',
        condicion: { tipo: 'todas', condiciones: [{ tipo: 'hab', hab: 'COM' }, { tipo: 'comprometidos', minimo: 1 }] },
        entonces: [comprometidoCon(mas('prueba'), { tipo: 'heridas', n: 1 })],
      },
    ],
    sinOposicion: [heridas(1)],
  },
})

// 42. Viejas cuentas · Duro
registrarPeligro('p2_cuentas', {
  encuentros: {
    // Sin ayuda. Si mandas a otro Tripulante en lugar del Capitán, la Prueba recibe +1.
    mar: {
      sinAyuda: true,
      capacidades: [dificultad('vizcaino', (ctx) => (participantesCtx(ctx).some((c) => c !== ctx.s.capitan) ? 1 : 0))],
      exito: [preparaCanon(), cadaComprometido({ tipo: 'estado', estado: 'inspirado' })],
      fallo: [heridasAsignados(2), comprometidoCon(undefined, { tipo: 'estado', estado: 'sangrando' })],
    },
    // Si comprometes al Capitán, −2.
    nat: {
      capacidades: [dificultad('capitan', (ctx) => (participantesCtx(ctx).includes(ctx.s.capitan) ? -2 : 0))],
      exito: [robar(2)],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'heridas', n: 2 })],
    },
    ciu: { exito: [{ tipo: 'recuperarDescarte', n: 1 }], fallo: [{ tipo: 'ocuparMuelle', coste: 3 }] },
  },
  // +1; +2 en su lugar si el Capitán está comprometido. Sin oposición: el Capitán sufre 1 herida.
  destino: { modificador: (s, p) => (p.comprometidos.includes(s.capitan) ? 2 : 1), sinOposicion: [{ tipo: 'heridas', n: 1, capitan: true }] },
})

// 43. Motín · Terrible
// Permanente 233 «No vuelven de la taberna»: los Tripulantes de la taberna (los que agotó el «Al revelarse» del Motín)
// no se preparan. Acción: agota a un Oficial: prepara a uno, que queda Borracho. Acción: descarta 3 cartas: descártala.
const TABERNA = 'p2_motin.taberna'
function enLaTaberna(s: Estado, carta: InstId): InstId[] {
  return s.temporales
    .filter((x) => x.clave === 'noPrepara' && x.fuente === 'pm_taberna' && x.carta === carta && x.inst && s.zonas.tripulacion.includes(x.inst))
    .map((x) => x.inst as InstId)
}
// Al entrar en juego: los que agotó el Motín al revelarse no se preparan mientras la permanente siga en juego.
registrarCodigo('pm_taberna.entrar', (s, fuente) => {
  if (!fuente) return []
  const origen = copia(s, fuente).origen
  for (const t of s.temporales.filter((x) => x.clave === TABERNA && x.carta === origen && x.inst && s.zonas.tripulacion.includes(x.inst))) {
    s.temporales.push({ clave: 'noPrepara', fuente: 'pm_taberna', hasta: 'carta', inst: t.inst, carta: fuente })
  }
  return []
})
registrarEspecial('p2_motin.rastras', (s, t, e) => {
  const carta = t.fuente
  if (!carta) return 'hecha'
  const candidatos = enLaTaberna(s, carta)
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'aQuien', texto: 'sale de la taberna (se prepara y queda Borracho)', n: 1 }, candidatas: candidatos, min: 1, max: 1 })
  }
  const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!elegido) return 'hecha'
  s.temporales = s.temporales.filter((x) => !(x.clave === 'noPrepara' && x.fuente === 'pm_taberna' && x.carta === carta && x.inst === elegido))
  prepararCopia(s, elegido)
  ponerEstado(s, elegido, 'borracho')
  anotar(s, 'efecto', `Sacas a rastras a ${nombre(s, elegido)} de la taberna: se prepara y queda Borracho.`)
  return 'hecha'
})
registrarCodigo('p2_motin.rastras', (_s, fuente) => [{ tipo: 'especial', clave: 'p2_motin.rastras', ...(fuente ? { fuente } : {}), datos: {}, paso: 0 }])
// «Al revelarse: agota a todos tus Tripulantes que no sean Oficiales» (quedan señalados: son los de la taberna).
const NO_OFICIALES: Efecto = {
  tipo: 'aQuien',
  quien: { de: 'tripulacion', cada: true, sinRasgo: 'Oficial' },
  hacer: { tipo: 'varios', acciones: [{ tipo: 'agotar' }, { tipo: 'marcar', clave: TABERNA }] },
}
registrarPermanente('pm_taberna', {
  quitar: [{ tipo: 'pagar', n: 3 }],
  alEntrar: [codigo('pm_taberna.entrar')],
  acciones: [
    {
      texto: 'Agota a un Oficial: prepara a uno de los que están en la taberna, que queda Borracho',
      coste: [{ tipo: 'agotarTripulante', rasgo: 'Oficial' }],
      requisito: (s, yo) => enLaTaberna(s, yo).length > 0,
      efectos: [codigo('p2_motin.rastras')],
    },
  ],
})
registrarPeligro('p2_motin', {
  encuentros: {
    // Solo pueden comprometerse el Capitán y los Oficiales. +1 por cada Tripulante preparado que no sea Oficial (máx. +3).
    mar: {
      restriccion: { veto: (s, c) => (c === s.capitan || tieneRasgo(s, c, 'Oficial') ? null : 'Solo pueden ser asignados el Capitán y los Oficiales') },
      capacidades: [
        dificultad('amotinados', (ctx) =>
          Math.min(3, ctx.s.zonas.tripulacion.filter((c) => c !== ctx.s.capitan && !ctx.agotada(c) && !tieneRasgo(ctx.s, c, 'Oficial')).length),
        ),
      ],
      exito: [preparar('todos')],
      fallo: [{ tipo: 'retirarse' }, { tipo: 'heridas', n: 1, capitan: true }],
    },
    nat: { exito: [{ tipo: 'curar', n: 2 }, avance(1)], fallo: [pierdesAvance(2), heridas(2)] },
    // Al revelarse, agota a todos los que no sean Oficiales. Pon en juego la carta 233 («No vuelven de la taberna»).
    ciu: { alRevelarse: [NO_OFICIALES], pone: { carta: 'pm_taberna' } },
  },
  // +2; +4 en su lugar si no has comprometido a ningún Oficial. Sin oposición: 2 heridas repartidas.
  destino: {
    modificador: (s, p) => (p.comprometidos.some((c) => s.zonas.tripulacion.includes(c) && tieneRasgo(s, c, 'Oficial')) ? 2 : 4),
    sinOposicion: [codigo('p2_motin.dosHeridas')],
  },
})

// 44. El cazador de piratas · Terrible
registrarPeligro('p2_cazador', {
  encuentros: {
    // EXP 5 (4 si comprometes a un Vigía: está en los datos). Abordaje.
    mar: { abordaje: true, exito: [preparaCanon()] },
    // Éxito: recluta gratis un Tripulante de coste 2 o menos (si tienes Capacidad); si no, robas 2.
    nat: {
      exito: [{ tipo: 'si', condicion: { tipo: 'plazasLibres', minimo: 1 }, entonces: [{ tipo: 'gratisDelMuelle', maxCoste: 2, que: 'tripulante' }], sino: [robar(2)] }],
      fallo: [comprometidoCon(mas('COM'), { tipo: 'rehen' })],
    },
    ciu: { exito: [robar(2)], fallo: [comprometidoCon(mas('EXP'), { tipo: 'rehen' }), { tipo: 'entraEnMazo', carta: 'armada' }] },
  },
  // +2. Si fallas por 3 o más, el comprometido con la habilidad más alta queda rehén. Sin oposición: + La Armada.
  destino: {
    siFallas: [{ tipo: 'si', condicion: { tipo: 'falladaPor', minimo: 3 }, entonces: [comprometidoCon(mas('prueba'), { tipo: 'rehen' })] }],
    sinOposicion: [{ tipo: 'entraEnMazo', carta: 'armada' }],
  },
})
