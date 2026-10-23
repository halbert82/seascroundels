// Resumen de una partida a partir de su registro, para la pantalla final.

import { esCartaDelJugador, nombreDe, tipoDe } from './catalogo.ts'
import { copia } from './estado.ts'
import type { CartaId, Estado } from './tipos.ts'

export interface ResumenPartida {
  gana: boolean
  motivo: string
  reputacion: number
  reputacionObjetivo: number
  turnos: number
  misiones: { superadas: CartaId[]; retiradas: CartaId[]; hundidas: CartaId[] }
  pruebas: { superadas: number; falladas: number }
  tripulantesPerdidos: number
  hundimientos: number
  reclutados: number
  adquiridas: number
  /** Eventos jugados por su efecto y capacidades usadas, de más a menos veces. */
  masUsadas: { carta: CartaId; nombre: string; veces: number }[]
}

export function resumenDePartida(s: Estado): ResumenPartida {
  const capitan = copia(s, s.capitan).id
  const r: ResumenPartida = {
    gana: s.resultado?.gana ?? false,
    motivo: s.resultado?.motivo ?? '',
    reputacion: s.reputacion,
    reputacionObjetivo: s.reputacionObjetivo,
    turnos: s.turno,
    misiones: { superadas: [], retiradas: [], hundidas: [] },
    pruebas: { superadas: 0, falladas: 0 },
    tripulantesPerdidos: 0,
    hundimientos: 0,
    reclutados: 0,
    adquiridas: 0,
    masUsadas: [],
  }
  const usos = new Map<CartaId, number>()
  for (const { dato } of s.registro) {
    if (!dato) continue
    switch (dato.tipo) {
      case 'finMision':
        if (dato.resultado === 'superada') r.misiones.superadas.push(dato.mision)
        else if (dato.resultado === 'retirada') r.misiones.retiradas.push(dato.mision)
        else r.misiones.hundidas.push(dato.mision)
        break
      case 'prueba':
        if (dato.superada) r.pruebas.superadas++
        else r.pruebas.falladas++
        break
      case 'derrota':
        if (dato.carta !== capitan) r.tripulantesPerdidos++
        break
      case 'hundimiento':
        r.hundimientos++
        break
      case 'reclutar':
        r.reclutados++
        break
      case 'adquirir':
        r.adquiridas++
        break
      case 'usar':
        if (esCartaDelJugador(dato.carta) && tipoDe(dato.carta) !== 'barco') usos.set(dato.carta, (usos.get(dato.carta) ?? 0) + 1)
        break
      default:
        break
    }
  }
  r.masUsadas = [...usos]
    .sort((a, b) => b[1] - a[1] || nombreDe(a[0]).localeCompare(nombreDe(b[0])))
    .slice(0, 5)
    .map(([carta, veces]) => ({ carta, nombre: nombreDe(carta), veces }))
  return r
}
