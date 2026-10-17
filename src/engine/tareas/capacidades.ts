// Tareas que comparten varias capacidades de las cartas del jugador: otear, quitar el encuentro revelado,
// cambiar el Destino, desviar heridas, comprometer tras el Destino, preparar, munición, reclutar gratis,
// «Náufrago en la playa», fichas de Entrenamiento y volver al muelle.

import { canonesSinCargar, reclutable, reclutablesGratis } from '../capacidades/comun.ts'
import type { Habilidad } from '../datos.ts'
import { destinoDe } from '../destinos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { cartaDeArriba, descartarPeligro, encuentroDe, mazoActivo } from '../peligros.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { huecosLibres, valor } from '../valores.ts'
import { arriba, mover, rebarajar } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'
import { ganarAvanceMision } from './mision.ts'

function evento(ev: Extract<NuevaTarea, { tipo: 'evento' }>['ev']): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

/** Otear N: mira las N primeras cartas del mazo de Peligros activo y deja cada una arriba o al fondo. */
export const otear: Manejador<'otear'> = (s, t, e) => {
  const { mazo, descartes } = mazoActivo(s)
  if (t.cartas.length + t.arriba.length + t.fondo.length === 0) {
    if (s.zonas[mazo].length === 0 && s.zonas[descartes].length > 0) rebarajar(s, descartes, mazo)
    t.cartas = s.zonas[mazo].slice(0, t.n)
    if (t.cartas.length === 0) return 'hecha'
    s.infoRevelada++
    anotar(s, 'revelar', `Oteas: ${nombres(s, t.cartas)}.`)
    return 'sigue'
  }
  const siguiente = t.cartas[0]
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

/** Cancela el Destino revelado, o lo descarta y revela otro (que pasa por su propia ventana). */
export const cambiarDestino: Manejador<'cambiarDestino'> = (s, t) => {
  const p = s.prueba
  if (!p?.destino) return 'hecha'
  const viejo = destinoDe(copia(s, p.destino).id)
  if (t.modo === 'cancelar') {
    p.destinoCancelado = true
    anotar(s, 'efecto', `Cancelas el Destino «${viejo.nombre}»: no se aplica nada de él.`)
    return 'hecha'
  }
  descartarPeligro(s, p.destino)
  p.destino = null
  p.destinoCancelado = false
  const carta = cartaDeArriba(s)
  if (!carta) {
    anotar(s, 'aviso', `Descartas el Destino «${viejo.nombre}» y no quedan cartas para revelar otro.`)
    return 'hecha'
  }
  mover(s, carta, 'destino')
  s.infoRevelada++
  p.destino = carta
  const d = destinoDe(copia(s, carta).id)
  anotar(s, 'revelar', `Descartas «${viejo.nombre}». Nuevo Destino: «${d.nombre}» (${d.impreso}).`, { tipo: 'revelado', inst: carta, como: 'destino' })
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

/** Compromete a un Tripulante preparado en la Prueba en curso, ya revelado el Destino (el Loro). */
export const comprometerUno: Manejador<'comprometerUno'> = (s, t) => {
  const p = s.prueba
  if (!p || !s.zonas.tripulacion.includes(t.carta) || copia(s, t.carta).agotada || p.comprometidos.includes(t.carta)) return 'hecha'
  copia(s, t.carta).agotada = true
  p.comprometidos.push(t.carta)
  anotar(s, 'jugada', `${nombre(s, t.carta)} se compromete en la Prueba.`)
  return 'hecha'
}

/** Prepara a todos tus Tripulantes («Víveres de reserva»). */
export const prepararTripulantes: Manejador<'prepararTripulantes'> = (s) => {
  const agotados = s.zonas.tripulacion.filter((c) => copia(s, c).agotada)
  for (const c of agotados) copia(s, c).agotada = false
  if (agotados.length > 0) anotar(s, 'efecto', `Preparas a ${nombres(s, agotados)}.`)
  return 'hecha'
}

/** Añade N de munición a un Cañón, sin pasar de su máximo. */
export const anadirMunicion: Manejador<'anadirMunicion'> = (s, t, e) => {
  const candidatos = canonesSinCargar(s)
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length > 1 && !e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'municion', n: t.n }, candidatas: candidatos, min: 1, max: 1 })
  const canon = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (!canon) return 'hecha'
  const c = copia(s, canon)
  c.municion = Math.min(valor(s, { tipo: 'municionMaxima', carta: canon }), c.municion + t.n)
  anotar(s, 'efecto', `«${nombre(s, canon)}» queda con ${c.municion} de munición.`)
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
  anotar(s, 'efecto', `${nombre(s, t.carta)} gana una ficha de Entrenamiento de ${hab}.`)
  return 'hecha'
}

/** Volver al muelle: el Tripulante (nunca el Capitán) vuelve al muelle con sus Mejoras; sus Tesoros pasan a otro (N1). */
export const volverAlMuelle: Manejador<'volverAlMuelle'> = (s, t) => {
  if (t.carta === s.capitan || !s.zonas.tripulacion.includes(t.carta)) return 'hecha'
  encolar(s, { tipo: 'sacarTripulante', carta: t.carta, destino: 'muelle', motivo: 'muelle' })
  return 'hecha'
}
