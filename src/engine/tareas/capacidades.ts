// Tareas que comparten varias capacidades de las cartas del jugador: otear, quitar el encuentro revelado,
// cambiar el Destino, desviar heridas, comprometer tras el Destino, preparar, munición, reclutar gratis,
// «Náufrago en la playa», fichas de Entrenamiento y volver al muelle.

import { canonesAgotados, reclutable, reclutablesGratis } from '../capacidades/comun.ts'
import { costeImpreso } from '../catalogo.ts'
import { alertaAlOtear, esAlerta } from '../definiciones.ts'
import type { Habilidad } from '../datos.ts'
import { destinoDe } from '../destinos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { cartaDeArriba, descartarPeligro, encuentroDe, mazoActivo } from '../peligros.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { huecosLibres } from '../valores.ts'
import { arriba, mover, rebarajar } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'
import { ganarAvanceMision } from './mision.ts'
import { alComprometerse } from './encuentro.ts'
import { puedePrepararse } from './peligros2.ts'
import { definicionActual, destinosDeLaPrueba, problemaCompromiso } from '../prueba.ts'

function evento(ev: Extract<NuevaTarea, { tipo: 'evento' }>['ev']): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

/**
 * Otear N: mira las N cartas superiores del mazo de Peligros y deja cada una arriba o al fondo. Fase 13: Otear es siempre
 * del mazo de Peligros («Otea N»). P73 (Albert): si la misión revela de un mazo propio mezclado (El templo, El galeón
 * rezagado), Otear mira ese mazo, el del que revelas (`mazoActivo`). El de Misiones (`mazo: 'misiones'`) solo lo usa la
 * recompensa de «Cobrar la deuda», que ya no dice Otear («Mira las 3 cartas superiores del mazo de Misiones…»).
 */
export const otear: Manejador<'otear'> = (s, t, e) => {
  // El de Misiones no tiene descartes (las misiones van a su fondo).
  const { mazo, descartes } = t.mazo === 'misiones' ? { mazo: 'mazoMisiones' as const, descartes: null } : mazoActivo(s)
  if (t.cartas.length + t.arriba.length + t.fondo.length === 0) {
    if (descartes && s.zonas[mazo].length === 0 && s.zonas[descartes].length > 0) rebarajar(s, descartes, mazo)
    t.cartas = s.zonas[mazo].slice(0, t.n)
    if (t.cartas.length === 0) return 'hecha'
    s.infoRevelada++
    const deDonde = t.mazo === 'misiones' ? 'Miras las cartas superiores del mazo de Misiones' : mazo === 'mazoMision' ? 'Oteas del mazo de la misión' : 'Oteas del mazo de Peligros'
    anotar(s, 'revelar', `${deDonde}: ${nombres(s, t.cartas)}.`)
    return 'sigue'
  }
  // P98 (Albert), «Alerta»: si ves esta carta al otear, debe quedarse encima del mazo (no se ofrece ponerla al fondo).
  const conAlerta = (c: InstId) => t.mazo !== 'misiones' && alertaAlOtear(s, c)
  // «Ordénalas como quieras» (ninguna al fondo) o «pon N al fondo»: se decide de una vez.
  if (t.cartas.length > 0 && t.fondoMax !== undefined && (t.fondoMax === 0 || t.fondoMax === t.fondoMin)) {
    const posibles = t.cartas.filter((c) => !conAlerta(c))
    const n = Math.min(t.fondoMax, posibles.length)
    if (n > 0) {
      if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'alFondo', n }, candidatas: posibles, min: n, max: n })
      const fondo = eleccionDe(e, 'cartas').ids
      t.fondo.push(...fondo)
      t.arriba.push(...t.cartas.filter((c) => !fondo.includes(c)))
    } else t.arriba.push(...t.cartas)
    t.cartas = []
    return 'sigue'
  }
  const siguiente = t.cartas[0]
  if (siguiente && conAlerta(siguiente)) {
    t.cartas.shift()
    t.arriba.push(siguiente)
    anotar(s, 'efecto', `«${nombre(s, siguiente)}» tiene Alerta: se queda encima del mazo.`)
    return 'sigue'
  }
  if (siguiente) {
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'otear', carta: copia(s, siguiente).id },
        opciones: [
          { clave: 'arriba', texto: 'Dejarla arriba' },
          { clave: 'fondo', texto: 'Ponerla al fondo' },
        ],
      })
    }
    t.cartas.shift()
    ;(eleccionDe(e, 'opcion').clave === 'fondo' ? t.fondo : t.arriba).push(siguiente)
    return 'sigue'
  }
  let orden = t.arriba
  if (t.arriba.length > 1) {
    // La primera elegida queda encima.
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'ordenarOteo' }, candidatas: [...t.arriba], min: t.arriba.length, max: t.arriba.length })
    orden = eleccionDe(e, 'cartas').ids
  }
  const mias = new Set([...orden, ...t.fondo])
  s.zonas[mazo] = [...orden, ...s.zonas[mazo].filter((c) => !mias.has(c)), ...t.fondo]
  const partes = [orden.length > 0 ? `${nombres(s, orden)} arriba` : '', t.fondo.length > 0 ? `${nombres(s, t.fondo)} al fondo` : '']
  anotar(s, 'efecto', `Dejas ${partes.filter(Boolean).join(' y ')}.`)
  return 'hecha'
}

/** Quita la carta de Peligro revelada sin resolverla: no cuenta como resuelta (D5b) y se revela otra. */
export const quitarEncuentro: Manejador<'quitarEncuentro'> = (s, t) => {
  const carta = s.zonas.encuentro[0]
  if (!carta || !s.mision) return 'hecha'
  // Fase 15, «Alerta»: este encuentro se resuelve siempre (las cartas que lo quitarían ya no se ofrecen).
  if (esAlerta(s, carta)) {
    anotar(s, 'aviso', `«${nombre(s, carta)}» tiene Alerta: se resuelve igual.`)
    return 'hecha'
  }
  if (t.avance) ganarAvanceMision(s, encuentroDe(s, carta).avance, `«${encuentroDe(s, carta).nombre}»`)
  if (t.modo === 'fondo') {
    mover(s, carta, mazoActivo(s).mazo, 'abajo')
    anotar(s, 'efecto', `«${nombre(s, carta)}» va al fondo del mazo sin resolverse.`)
  } else {
    anotar(s, 'efecto', `Descartas «${nombre(s, carta)}» sin resolverla.`)
    descartarPeligro(s, carta)
  }
  return 'hecha'
}

/**
 * Cancela el Destino revelado, o lo descarta y revela otro (que pasa por su propia ventana). Fase 13: si la Prueba
 * resuelve dos Destinos («Bruma en la selva»), el jugador elige a cuál de los dos afecta. P71 (Albert): cancela o
 * cambia solo uno, el que elija el jugador; vale para «Reflejos de gato», el Escapulario, la Espada, el Viejo lobo de mar
 * y el Farol de los ahogados.
 */
export const cambiarDestino: Manejador<'cambiarDestino'> = (s, t, e) => {
  const p = s.prueba
  if (!p?.destino) return 'hecha'
  const vigentes = destinosDeLaPrueba(p).filter((d) => !d.cancelado)
  if (vigentes.length === 0) return 'hecha'
  if (!t.cual) {
    if (vigentes.length > 1) {
      if (!e) {
        return preguntar({
          tipo: 'elegirOpcion',
          motivo: { clave: t.modo === 'cancelar' ? 'cancelarCualDestino' : 'cambiarCualDestino' },
          opciones: vigentes.map((d) => ({ clave: d.carta, texto: `El Destino de la carta «${nombre(s, d.carta)}» (${destinoDe(copia(s, d.carta).id).impreso})` })),
        })
      }
      t.cual = eleccionDe(e, 'opcion').clave as InstId
    } else t.cual = vigentes[0]?.carta
  }
  const elegido = vigentes.find((d) => d.carta === t.cual)
  if (!elegido) return 'hecha'
  const viejo = nombre(s, elegido.carta)
  if (t.modo === 'cancelar') {
    if (elegido.segundo) p.segundoCancelado = true
    else p.destinoCancelado = true
    anotar(s, 'efecto', `Cancelas el Destino de la carta «${viejo}»: no se aplica nada de él.`)
    return 'hecha'
  }
  descartarPeligro(s, elegido.carta)
  if (elegido.segundo) {
    p.segundoDestino = null
    p.segundoCancelado = false
  } else {
    p.destino = null
    p.destinoCancelado = false
  }
  const carta = cartaDeArriba(s, 'destino')
  if (!carta) {
    anotar(s, 'aviso', `Descartas el Destino de la carta «${viejo}» y no quedan cartas para revelar otro.`)
    // El otro Destino (si lo había) pasa a ser el de la Prueba.
    if (!p.destino && p.segundoDestino) {
      p.destino = p.segundoDestino
      p.destinoCancelado = p.segundoCancelado ?? false
      p.segundoDestino = null
      p.segundoCancelado = false
    }
    return 'hecha'
  }
  mover(s, carta, 'destino')
  s.infoRevelada++
  if (elegido.segundo) p.segundoDestino = carta
  else p.destino = carta
  const d = destinoDe(copia(s, carta).id)
  anotar(s, 'revelar', `Descartas el Destino de la carta «${viejo}». Nuevo Destino, de la carta «${nombre(s, carta)}»: ${d.impreso}.`, { tipo: 'revelado', inst: carta, como: 'destino' })
  encolar(s, evento({ tipo: 'revelarDestino', carta }))
  return 'hecha'
}

/** «Ni un hombre atrás»: las heridas que iba a sufrir un participante las sufre otro participante. */
export const desviarHeridas: Manejador<'desviarHeridas'> = (s, t, e) => {
  const suceso = s.pila.find((x) => x.id === t.suceso)
  if (suceso?.tipo !== 'evento') return 'hecha'
  const ev = suceso.ev
  if (ev.tipo !== 'heridas') return 'hecha'
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c) && c !== ev.objetivo)
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'desviarHeridas', n: ev.cantidad }, candidatas: candidatos, min: 1, max: 1 })
  }
  const destino = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!destino) return 'hecha'
  anotar(s, 'efecto', `Las heridas de ${nombre(s, ev.objetivo)} las sufre ${nombre(s, destino)}.`)
  ev.objetivo = destino
  return 'hecha'
}

/**
 * Compromete a un Tripulante en la Prueba en curso, ya revelado el Destino (el Loro). Fase 15, quinta ronda: el Loro se
 * agota como coste de su Respuesta (`yaAgotado`): llega agotado y no se agota otra vez.
 */
export const comprometerUno: Manejador<'comprometerUno'> = (s, t) => {
  const p = s.prueba
  if (!p || !s.zonas.tripulacion.includes(t.carta) || (copia(s, t.carta).agotada && !t.yaAgotado) || p.comprometidos.includes(t.carta)) return 'hecha'
  if (p.hab) {
    const problema = problemaCompromiso(s, definicionActual(s), p.hab, [...p.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)), t.carta], [])
    if (problema) {
      anotar(s, 'aviso', `${problema}.`)
      return 'hecha'
    }
  }
  p.comprometidos.push(t.carta)
  anotar(s, 'jugada', `${nombre(s, t.carta)} es asignado a la Prueba.`)
  alComprometerse(s, p, t.carta, !t.yaAgotado)
  return 'hecha'
}

/** Prepara a todos tus Tripulantes («Víveres de reserva»). */
export const prepararTripulantes: Manejador<'prepararTripulantes'> = (s) => {
  const agotados = s.zonas.tripulacion.filter((c) => copia(s, c).agotada && puedePrepararse(s, c))
  for (const c of agotados) copia(s, c).agotada = false
  if (agotados.length > 0) anotar(s, 'efecto', `Preparas a ${nombres(s, agotados)}.`)
  return 'hecha'
}

/** Prepara un Cañón agotado (lo eliges tú), o todos si la carta lo dice. Fase 10b: sin munición. */
export const prepararCanon: Manejador<'prepararCanon'> = (s, t, e) => {
  const candidatos = canonesAgotados(s).filter((c) => puedePrepararse(s, c))
  if (candidatos.length === 0) return 'hecha'
  let elegidos: InstId[]
  if (t.todos || candidatos.length === 1) elegidos = candidatos
  else if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'prepararCanon' }, candidatas: candidatos, min: 1, max: 1 })
  else elegidos = eleccionDe(e, 'cartas').ids
  for (const c of elegidos) copia(s, c).agotada = false
  anotar(s, 'efecto', `Preparas ${elegidos.map((c) => `«${nombre(s, c)}»`).join(' y ')}.`)
  return 'hecha'
}

export const reclutarGratis: Manejador<'reclutarGratis'> = (s, t, e) => {
  const candidatos = reclutablesGratis(s, t.maxCoste)
  if (candidatos.length === 0) return 'hecha'
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'reclutarGratis', n: t.maxCoste }, candidatas: candidatos, min: 0, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) encolar(s, { tipo: 'reclutar', carta: c, paso: 'pagar', gratis: true })
  return 'hecha'
}

/**
 * «Náufrago en la playa»: mira las N primeras cartas del mazo de muelle (se apartan mientras eliges),
 * puedes reclutar gratis a un Tripulante de entre ellas y descartas las demás. Al final del turno,
 * ese Tripulante se descarta (lo hace el turno con el efecto temporal «naufrago.turno»).
 */
export const naufrago: Manejador<'naufrago'> = (s, t, e) => {
  if (t.cartas.length === 0) {
    for (let i = 0; i < t.n; i++) {
      if (s.zonas.mazoMuelle.length === 0 && s.zonas.descartesMuelle.length > 0) rebarajar(s, 'descartesMuelle', 'mazoMuelle')
      const c = arriba(s, 'mazoMuelle')
      if (!c) break
      mover(s, c, 'resolviendo', 'abajo')
      t.cartas.push(c)
    }
    if (t.cartas.length === 0) return 'hecha'
    s.infoRevelada++
    anotar(s, 'revelar', `Miras el mazo de muelle: ${nombres(s, t.cartas)}.`)
    return 'sigue'
  }
  const candidatos = t.cartas.filter((c) => reclutable(s, c))
  let elegido: InstId | undefined
  if (candidatos.length > 0) {
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'naufrago' }, candidatas: candidatos, min: 0, max: 1 })
    elegido = eleccionDe(e, 'cartas').ids[0]
  }
  const resto = t.cartas.filter((c) => c !== elegido)
  for (const c of resto) mover(s, c, 'descartesMuelle')
  if (resto.length > 0) anotar(s, 'efecto', `Descartas ${nombres(s, resto)}.`)
  if (elegido) {
    encolar(
      s,
      { tipo: 'reclutar', carta: elegido, paso: 'pagar', gratis: true },
      { tipo: 'anadirTemporal', temporal: { clave: 'naufrago.turno', fuente: 'naufrago', hasta: 'finTurno', inst: elegido } },
    )
  }
  return 'hecha'
}

/**
 * Fase 14 («Prisionero liberado», «Galera de forzados»): «Mira las 3 cartas superiores del mazo de muelle. Puedes
 * reclutar sin coste un Tripulante de coste 2 o menos de entre ellas. Pon las demás al fondo del mazo de muelle.» Las
 * cartas se apartan mientras eliges; el coste que se mira es el impreso. Sin Capacidad no puedes reclutar a ninguno, y
 * las 3 van al fondo, en el orden en que estaban. Revisión de Albert: en «Prisionero liberado», las demás se descartan
 * (`resto: 'descartar'`).
 */
export const reclutarDelMazoMuelle: Manejador<'reclutarDelMazoMuelle'> = (s, t, e) => {
  if (t.cartas.length === 0) {
    for (let i = 0; i < t.n; i++) {
      if (s.zonas.mazoMuelle.length === 0 && s.zonas.descartesMuelle.length > 0) rebarajar(s, 'descartesMuelle', 'mazoMuelle')
      const c = arriba(s, 'mazoMuelle')
      if (!c) break
      mover(s, c, 'resolviendo', 'abajo')
      t.cartas.push(c)
    }
    if (t.cartas.length === 0) return 'hecha'
    s.infoRevelada++
    anotar(s, 'revelar', `Miras el mazo de muelle: ${nombres(s, t.cartas)}.`)
    return 'sigue'
  }
  const candidatos = t.cartas.filter((c) => reclutable(s, c) && costeImpreso(copia(s, c).id) <= t.maxCoste)
  let elegido: InstId | undefined
  if (candidatos.length > 0) {
    if (!e) {
      const motivo = { clave: 'reclutarDelMazoMuelle', n: t.maxCoste, ...(t.resto === 'descartar' ? { texto: 'descartar' } : {}) }
      return preguntar({ tipo: 'elegirCartas', motivo, candidatas: candidatos, min: 0, max: 1 })
    }
    elegido = eleccionDe(e, 'cartas').ids[0]
  }
  const resto = t.cartas.filter((c) => c !== elegido)
  if (t.resto === 'descartar') {
    for (const c of resto) mover(s, c, 'descartesMuelle')
    if (resto.length > 0) anotar(s, 'efecto', `Descartas ${nombres(s, resto)}.`)
  } else {
    for (const c of resto) mover(s, c, 'mazoMuelle', 'abajo')
    if (resto.length > 0) anotar(s, 'efecto', `${nombres(s, resto)} ${resto.length === 1 ? 'va' : 'van'} al fondo del mazo de muelle.`)
  }
  if (elegido) encolar(s, { tipo: 'reclutar', carta: elegido, paso: 'pagar', gratis: true })
  return 'hecha'
}

const HABILIDADES: readonly Habilidad[] = ['NAV', 'COM', 'EXP']

/** Ficha de Entrenamiento en uno de esos Tripulantes con hueco libre (D11); si `hab` es null, eliges la habilidad. */
export const ponerEntrenamiento: Manejador<'ponerEntrenamiento'> = (s, t, e) => {
  if (!t.carta) {
    const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c) && huecosLibres(s, c) > 0)
    if (candidatos.length === 0) return 'hecha'
    if (candidatos.length > 1) {
      if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'entrenamiento' }, candidatas: candidatos, min: 1, max: 1 })
      t.carta = eleccionDe(e, 'cartas').ids[0] ?? null
      return 'sigue'
    }
    t.carta = candidatos[0] ?? null
  }
  if (!t.carta) return 'hecha'
  let hab = t.hab
  if (!hab) {
    if (!e) {
      return preguntar({
        tipo: 'elegirOpcion',
        motivo: { clave: 'habilidadEntrenamiento' },
        opciones: HABILIDADES.map((h) => ({ clave: h, texto: `+1 ${h}` })),
      })
    }
    const clave = eleccionDe(e, 'opcion').clave
    hab = HABILIDADES.find((h) => h === clave) ?? null
    if (!hab) throw new Error(`Habilidad desconocida: ${clave}`)
  }
  copia(s, t.carta).entrenamiento.push(hab)
  anotar(s, 'efecto', `${nombre(s, t.carta)} gana un Entrenamiento: +1 ${hab}.`)
  return 'hecha'
}

/** Volver al muelle: el Tripulante (nunca el Capitán) vuelve al muelle con sus Mejoras; sus Tesoros pasan a otro (N1). */
export const volverAlMuelle: Manejador<'volverAlMuelle'> = (s, t) => {
  if (t.carta === s.capitan || !s.zonas.tripulacion.includes(t.carta)) return 'hecha'
  encolar(s, { tipo: 'sacarTripulante', carta: t.carta, destino: 'muelle', motivo: 'muelle' })
  return 'hecha'
}
