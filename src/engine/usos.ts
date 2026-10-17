// Qué capacidades se pueden usar ahora mismo, y cómo se empiezan a usar.

import { capacidadPorClave, capacidadesDe } from './capacidades/index.ts'
import { tipoDe } from './catalogo.ts'
import { claveUso, copia, encolar } from './estado.ts'
import type { Capacidad, Coste, Estado, Evento, InstId, Uso, Ventana } from './tipos.ts'
import { mejoraActiva, valor } from './valores.ts'
import { estaEn } from './zonas.ts'

/** Cada capacidad con la carta que la da, según desde dónde funciona. */
export function* candidatas(s: Estado): Generator<[Capacidad, InstId | null]> {
  for (const inst of s.zonas.tripulacion) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'juego') yield [cap, inst]
  for (const inst of s.zonas.mejoras) {
    if (!mejoraActiva(s, inst)) continue // Agotada o de un rehén: no aplica su texto.
    for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'juego') yield [cap, inst]
  }
  for (const inst of s.zonas.mano) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'mano') yield [cap, inst]
  for (const cap of capacidadesDe('barco')) if (cap.desde === 'barco') yield [cap, null]
}

function puedePagar(s: Estado, coste: Coste, fuente: InstId | null): boolean {
  switch (coste.tipo) {
    case 'agotarse':
      return fuente !== null && !copia(s, fuente).agotada
    case 'descartarse':
      return fuente !== null
    case 'pagar':
      return s.zonas.mano.filter((c) => c !== fuente).length >= coste.n
    case 'municion':
      return fuente !== null && copia(s, fuente).municion >= coste.n
    case 'herida':
      return fuente !== null && estaEn(s, fuente, 'tripulacion')
    case 'agotarCapitan':
      return estaEn(s, s.capitan, 'tripulacion') && !copia(s, s.capitan).agotada
  }
}

/** ¿Se puede usar ahora esta capacidad de esta carta? (límite y coste; la ventana la decide quien pregunta) */
export function sePuedeUsar(s: Estado, cap: Capacidad, fuente: InstId | null): boolean {
  if (cap.requisito && !cap.requisito(s, fuente)) return false
  if (cap.limite) {
    const usadas = s.usos[claveUso(cap.limite.por, fuente, cap.clave)] ?? 0
    if (usadas >= cap.limite.veces) return false
  }
  for (const coste of cap.coste ?? []) if (!puedePagar(s, coste, fuente)) return false
  // Un Evento de la mano necesita además poder pagar su coste impreso con las demás cartas.
  if (cap.desde === 'mano' && fuente !== null && tipoDe(copia(s, fuente).id) === 'evento') {
    const coste = valor(s, { tipo: 'coste', carta: fuente })
    if (s.zonas.mano.filter((c) => c !== fuente).length < coste) return false
  }
  return true
}

/** Usos disponibles en una ventana sin suceso (Acción, sin etiqueta). */
export function usosDisponibles(s: Estado, ventanas: readonly Ventana[]): Uso[] {
  const usos: Uso[] = []
  for (const [cap, fuente] of candidatas(s)) {
    if (!ventanas.includes(cap.ventana)) continue
    if (sePuedeUsar(s, cap, fuente)) usos.push({ fuente, clave: cap.clave })
  }
  return usos
}

/** Usos que dispara un suceso (Interrupción antes, Respuesta después, u Obligada). */
export function usosDisparados(s: Estado, ventana: Ventana, ev: Evento, fase: 'antes' | 'despues'): Uso[] {
  const usos: Uso[] = []
  for (const [cap, fuente] of candidatas(s)) {
    if (cap.ventana !== ventana || !cap.disparo) continue
    if (!cap.disparo(s, fuente, ev, fase)) continue
    if (sePuedeUsar(s, cap, fuente)) usos.push({ fuente, clave: cap.clave })
  }
  return usos
}

export function claveDe(uso: Uso): string {
  return `${uso.fuente ?? '-'}/${uso.clave}`
}

export function mismoUso(a: Uso, b: Uso): boolean {
  return a.fuente === b.fuente && a.clave === b.clave
}

export function capacidadDe(uso: Uso): Capacidad {
  const cap = capacidadPorClave(uso.clave)
  if (!cap) throw new Error(`Capacidad desconocida: ${uso.clave}`)
  return cap
}

/** Empieza a usar una capacidad: un Evento de la mano se juega; lo demás paga su coste y se aplica. */
export function encolarUso(s: Estado, uso: Uso, suceso: number | null): void {
  const cap = capacidadDe(uso)
  if (cap.desde === 'mano' && uso.fuente !== null && tipoDe(copia(s, uso.fuente).id) === 'evento') {
    encolar(s, { tipo: 'jugarEvento', carta: uso.fuente, clave: uso.clave, evento: suceso, paso: 'pagar' })
  } else {
    encolar(s, { tipo: 'usar', uso, evento: suceso, paso: 'coste' })
  }
}
