// Paso de Jugar cartas: reclutar, adquirir, jugar Eventos, usar capacidades de Acción y sin etiqueta, despedir.

import { enroladoDe, esUnica, porId } from '../catalogo.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import type { Accion, Estado, InstId } from '../tipos.ts'
import { encolarUso, usosDisponibles } from '../usos.ts'
import { espacioLibre, huecosLibres, plazasLibres, valor } from '../valores.ts'
import { mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/** ¿Hay ya en juego una copia de esta carta? (para las cartas únicas ★) */
function unicaEnJuego(s: Estado, inst: InstId): boolean {
  const id = copia(s, inst).id
  if (!esUnica(id)) return false
  return [...s.zonas.tripulacion, ...s.zonas.mejoras, ...s.zonas.rehenes].some((c) => copia(s, c).id === id)
}

function puedePagarCoste(s: Estado, inst: InstId): boolean {
  return s.zonas.mano.length >= valor(s, { tipo: 'coste', carta: inst })
}

/** Acciones legales en el paso de Jugar cartas, en el orden en que se ofrecen. */
export function accionesJugar(s: Estado): Accion[] {
  const acciones: Accion[] = []
  for (const carta of s.zonas.muelle) {
    const e = porId(copia(s, carta).id)
    if (!puedePagarCoste(s, carta) || unicaEnJuego(s, carta)) continue
    if (e.tipo === 'tripulante') {
      if (plazasLibres(s) >= 1) acciones.push({ tipo: 'reclutar', carta })
    } else if (e.tipo === 'mejoraBarco') {
      if (espacioLibre(s) >= e.carta.espacio) acciones.push({ tipo: 'adquirir', carta, destino: 'barco' })
    } else if (e.tipo === 'mejoraTripulante') {
      for (const portador of s.zonas.tripulacion) {
        if (e.carta.soloCapitan && portador !== s.capitan) continue
        if (huecosLibres(s, portador) >= 1) acciones.push({ tipo: 'adquirir', carta, destino: portador })
      }
    }
  }
  for (const uso of usosDisponibles(s, ['accion', 'libre'])) acciones.push({ tipo: 'usar', uso })
  for (const carta of s.zonas.tripulacion) if (carta !== s.capitan) acciones.push({ tipo: 'despedir', carta })
  acciones.push({ tipo: 'terminarPaso' })
  return acciones
}

export const ventanaJugar: Manejador<'ventanaJugar'> = (s, _t, e) => {
  if (!e) return preguntar({ tipo: 'ventanaAccion', motivo: { clave: 'jugarCartas' }, acciones: accionesJugar(s) })
  const accion = eleccionDe(e, 'accion').accion
  switch (accion.tipo) {
    case 'terminarPaso':
      return 'hecha'
    case 'reclutar':
      encolar(s, { tipo: 'reclutar', carta: accion.carta, paso: 'pagar' })
      return 'sigue'
    case 'adquirir':
      encolar(s, { tipo: 'adquirir', carta: accion.carta, destino: accion.destino, paso: 'pagar' })
      return 'sigue'
    case 'despedir':
      encolar(s, { tipo: 'despedir', carta: accion.carta })
      return 'sigue'
    case 'usar':
      encolarUso(s, accion.uso, null)
      return 'sigue'
    default:
      throw new Error(`Acción no válida en Jugar cartas: ${accion.tipo}`)
  }
}

/** Reclutar: paga su coste (salvo si es gratis) y el Tripulante entra en juego preparado. */
export const reclutar: Manejador<'reclutar'> = (s, t) => {
  if (t.paso === 'pagar') {
    t.paso = 'entrar'
    const coste = t.gratis ? 0 : valor(s, { tipo: 'coste', carta: t.carta })
    if (coste > 0) encolar(s, { tipo: 'pagar', cantidad: coste, motivo: copia(s, t.carta).id })
    return 'sigue'
  }
  mover(s, t.carta, 'tripulacion', 'abajo')
  const recluta = copia(s, t.carta)
  recluta.agotada = false
  // Catalina: el descuento se gasta con el siguiente Tripulante que reclutes, aunque sea gratis (N19).
  s.temporales = s.temporales.filter((x) => x.clave !== 'capitan2.descuento')
  anotar(s, 'jugada', `Reclutas a ${nombre(s, t.carta)}${t.gratis ? ' sin pagar su coste' : ''}.`, { tipo: 'reclutar', carta: recluta.id })
  // Fase 14, «Enrolado N»: entra con N fichas de Enrolado (no se renuevan ni se añaden más).
  const fichas = enroladoDe(recluta.id)
  if (fichas !== null) {
    recluta.enrolado = fichas
    anotar(s, 'efecto', `${nombre(s, t.carta)} se enrola por ${fichas} ${fichas === 1 ? 'turno' : 'turnos'}: ${fichas} ${fichas === 1 ? 'ficha' : 'fichas'} de Enrolado.`)
  }
  encolar(s, { tipo: 'evento', ev: { tipo: 'reclutar', carta: t.carta }, fase: 'antes', cancelado: false, usadas: [] })
  return 'hecha'
}

/** Adquirir: paga su coste y vincula la Mejora al Barco o a un Tripulante. */
export const adquirir: Manejador<'adquirir'> = (s, t) => {
  if (t.paso === 'pagar') {
    t.paso = 'vincular'
    const coste = valor(s, { tipo: 'coste', carta: t.carta })
    if (coste > 0) encolar(s, { tipo: 'pagar', cantidad: coste, motivo: copia(s, t.carta).id })
    return 'sigue'
  }
  mover(s, t.carta, 'mejoras', 'abajo')
  const c = copia(s, t.carta)
  c.vinculadaA = t.destino
  const destino = t.destino === 'barco' ? 'el Barco' : nombre(s, t.destino)
  anotar(s, 'jugada', `Adquieres «${nombre(s, t.carta)}» para ${destino}.`, { tipo: 'adquirir', carta: c.id })
  return 'hecha'
}

/** Despedir: el Tripulante va a los descartes del muelle con sus Mejoras. Nunca el Capitán. */
export const despedir: Manejador<'despedir'> = (s, t) => {
  if (t.carta === s.capitan) throw new Error('No puedes despedir al Capitán')
  encolar(s, { tipo: 'sacarTripulante', carta: t.carta, destino: 'descartesMuelle', motivo: 'despedido' })
  return 'hecha'
}
