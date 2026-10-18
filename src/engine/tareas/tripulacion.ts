// Tripulantes que salen del juego, Tesoros que cambian de portador, Deserción, exceso de Capacidad
// y hundimiento del Barco.

import { costeImpreso, esIndestructible, tipoDe } from '../catalogo.ts'
import { anotar, copia, encolar, nombre, nombres, sucesoDescartada } from '../estado.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { plazasOcupadas, valor } from '../valores.ts'
import { estaEn, mover, vinculadas } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

const MOTIVOS: Record<string, string> = {
  despedido: 'despides a',
  derrotado: 'se descarta a',
  descartado: 'se descarta a',
  desercion: 'deserta',
  rehen: 'pierdes a',
  exceso: 'despides a',
  muelle: 'vuelve al muelle',
  naufrago: 'se descarta a',
  incautado: 'pierdes a',
}

/** Saca a un Tripulante del juego con sus Mejoras. Sus Tesoros pasan a otro Tripulante (N1). */
export const sacarTripulante: Manejador<'sacarTripulante'> = (s, t) => {
  if (!estaEn(s, t.carta, 'tripulacion') && !estaEn(s, t.carta, 'rehenes') && !estaEn(s, t.carta, 'incautadas')) return 'hecha'
  if (t.carta === s.capitan) throw new Error('El Capitán no puede salir del juego así')
  const suyas = vinculadas(s, t.carta)
  const tesoros = suyas.filter((m) => tipoDe(copia(s, m).id) === 'tesoro')
  const mejoras = suyas.filter((m) => !tesoros.includes(m))
  for (const m of mejoras) mover(s, m, t.destino)
  mover(s, t.carta, t.destino)
  if (t.destino === 'descartesMuelle') encolar(s, ...mejoras.map(sucesoDescartada))
  const accion = MOTIVOS[t.motivo] ?? 'sale'
  const conMejoras = mejoras.length > 0 ? ` junto con ${nombres(s, mejoras)}` : ''
  anotar(s, 'efecto', `${accion.charAt(0).toUpperCase()}${accion.slice(1)} ${nombre(s, t.carta)}${conMejoras}.`)
  encolar(s, ...tesoros.map((tesoro): NuevaTarea => ({ tipo: 'reasignarTesoro', tesoro })))
  return 'hecha'
}

/** N1: el Tesoro pasa al Tripulante que elija el jugador (el Capitán también vale). */
export const reasignarTesoro: Manejador<'reasignarTesoro'> = (s, t, e) => {
  const candidatos = [...s.zonas.tripulacion]
  const vincular = (destino: InstId) => {
    copia(s, t.tesoro).vinculadaA = destino
    anotar(s, 'efecto', `«${nombre(s, t.tesoro)}» pasa a ${nombre(s, destino)}.`)
  }
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length === 1 && candidatos[0]) {
    vincular(candidatos[0])
    return 'hecha'
  }
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'reasignarTesoro', carta: copia(s, t.tesoro).id },
      candidatas: candidatos,
      min: 1,
      max: 1,
    })
  }
  const [destino] = eleccionDe(e, 'cartas').ids
  if (destino) vincular(destino)
  return 'hecha'
}

/** «Deserción»: descarta a tu Tripulante de menor coste (no el Capitán). Si hay empate, eliges tú. */
export const desercion: Manejador<'desercion'> = (s, _t, e) => {
  const candidatos = s.zonas.tripulacion.filter((c) => c !== s.capitan)
  if (candidatos.length === 0) {
    anotar(s, 'efecto', 'Nadie deserta: no tienes más Tripulantes que el Capitán.')
    return 'hecha'
  }
  const minimo = Math.min(...candidatos.map((c) => costeImpreso(copia(s, c).id)))
  const empatados = candidatos.filter((c) => costeImpreso(copia(s, c).id) === minimo)
  const sacar = (c: InstId) => encolar(s, { tipo: 'sacarTripulante', carta: c, destino: 'descartesMuelle', motivo: 'desercion' })
  if (empatados.length === 1 && empatados[0]) {
    sacar(empatados[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'desercion' }, candidatas: empatados, min: 1, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) sacar(c)
  return 'hecha'
}

/** Más Tripulantes que Capacidad (p. ej., al perder las Hamacas, D8): despides a los que sobren. */
export const exceso: Manejador<'exceso'> = (s, _t, e) => {
  const sobran = plazasOcupadas(s) - valor(s, { tipo: 'capacidad' })
  if (sobran <= 0) return 'hecha'
  const candidatos = s.zonas.tripulacion.filter((c) => c !== s.capitan)
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'exceso', n: sobran },
      candidatas: candidatos,
      min: Math.min(sobran, candidatos.length),
      max: Math.min(sobran, candidatos.length),
    })
  }
  for (const c of eleccionDe(e, 'cartas').ids) {
    encolar(s, { tipo: 'sacarTripulante', carta: c, destino: 'descartesMuelle', motivo: 'exceso' })
  }
  return 'hecha'
}

/**
 * El Barco se hunde: pierdes las Mejoras de barco (salvo las indestructibles), se reflota sin daño
 * y cada Tripulante sufre 1 herida. En puerto (al perder el Casco, D8) se aplica igual, sin la parte de la misión.
 */
export const hundirse: Manejador<'hundirse'> = (s) => {
  anotar(s, 'aviso', '¡El Barco se hunde!', { tipo: 'hundimiento' })
  // En una misión, no la superas y vuelves a puerto; lo que quede del recuadro se aplica igual (N8).
  if (s.mision && !s.mision.fin) s.mision.fin = 'hundida'
  const perdidas = vinculadas(s, 'barco').filter((m) => !esIndestructible(copia(s, m).id))
  for (const m of perdidas) mover(s, m, 'descartesMuelle')
  if (perdidas.length > 0) anotar(s, 'efecto', `Pierdes tus Mejoras de barco: ${nombres(s, perdidas)}.`)
  s.danoBarco = 0
  anotar(s, 'efecto', 'El Barco se reflota sin daño.')
  // Don Anselmo se baja asustado si el Barco se hunde.
  if (s.zonas.pasajeros.some((c) => copia(s, c).id === 'anselmo')) encolar(s, { tipo: 'bajarPasajero', carta: 'anselmo', motivo: 'se baja asustado' })
  // Las Mejoras perdidas al hundirse sí activan sus efectos «después de que descartes esta carta» (decisión de Albert).
  encolar(
    s,
    ...perdidas.map(sucesoDescartada),
    ...s.zonas.tripulacion.map(
      (c): NuevaTarea => ({ tipo: 'evento', ev: { tipo: 'heridas', objetivo: c, cantidad: 1 }, fase: 'antes', cancelado: false, usadas: [] }),
    ),
  )
  return 'hecha'
}
