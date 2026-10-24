// Qué capacidades se pueden usar ahora mismo, y cómo se empiezan a usar.

import { capacidadPorClave, capacidadesDe } from './capacidades/index.ts'
import { esCanon, rasgosDe, tipoDe } from './catalogo.ts'
import { claveUso, copia, encolar } from './estado.ts'
import { estadosDe } from './estados.ts'
import { cartaDeEstado } from './infoEstados.ts'
import type { Capacidad, Coste, Estado, Evento, InstId, Uso, Ventana } from './tipos.ts'
import { destinosVigentes, mejoraActiva, sePuedeDestinar, valor } from './valores.ts'
import { estaEn } from './zonas.ts'
import { canonesPreparados } from './capacidades/comun.ts'
import { esAbordaje } from './prueba.ts'

/** Cada capacidad con la carta que la da, según desde dónde funciona. */
/** Ventanas de las capacidades que «se usan»: un Tripulante Encadenado no puede usarlas. */
const SE_USAN: ReadonlySet<Ventana> = new Set<Ventana>(['accion', 'libre', 'respuesta', 'interrupcion', 'alZarpar'])

export function* candidatas(s: Estado): Generator<[Capacidad, InstId | null]> {
  // Destinos como «Grilletes en los tobillos» o «Carcoma»: en esta Prueba no se usan capacidades de Tripulantes o de Mejoras.
  const sinTripulantes = s.prueba?.sinCapTripulantes ?? false
  const sinMejoras = (s.prueba?.sinCapMejoras || s.prueba?.sinMejoras) ?? false
  // Fase 14, Abordaje: en esa Prueba no se pueden usar Cañones (ni suman ni se pueden agotar sus capacidades).
  const abordaje = esAbordaje(s)
  for (const inst of s.zonas.tripulacion) {
    const bloqueada = sinTripulantes
    for (const cap of capacidadesDe(copia(s, inst).id)) {
      if (cap.desde === 'juego' && !(bloqueada && SE_USAN.has(cap.ventana))) yield [cap, inst]
    }
  }
  for (const inst of s.zonas.mejoras) {
    if (!mejoraActiva(s, inst)) continue // Sin portador en juego, no aplica su texto. Agotada, sí (solo no puede volver a agotarse).
    const canonBloqueado = abordaje && esCanon(copia(s, inst).id)
    for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'juego' && !((sinMejoras || canonBloqueado) && SE_USAN.has(cap.ventana))) yield [cap, inst]
  }
  for (const inst of s.zonas.mano) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'mano') yield [cap, inst]
  for (const cap of capacidadesDe('barco')) if (cap.desde === 'barco') yield [cap, null]
  // Misiones 2.0: las reglas de la misión en curso (sus Obligadas), los Pasajeros y las cartas junto a la misión.
  if (s.mision) for (const cap of capacidadesDe(copia(s, s.mision.carta).id)) if (cap.desde === 'mision' && cap.ventana !== 'constante') yield [cap, s.mision.carta]
  for (const inst of s.zonas.pasajeros) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'pasajero') yield [cap, inst]
  // Fase 6: el encuentro que se resuelve, el Destino de la Prueba, las permanentes (fase 11), cartas de Peligro en el
  // muelle y Estados.
  for (const inst of s.zonas.encuentro) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'encuentro') yield [cap, inst]
  for (const destino of destinosVigentes(s)) for (const cap of capacidadesDe(copia(s, destino).id)) if (cap.desde === 'destino') yield [cap, destino]
  for (const inst of s.zonas.permanentes) for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.desde === 'permanente') yield [cap, inst]
  for (const inst of s.zonas.muelle) {
    if (s.peligrosEnMuelle?.[inst] === undefined) continue
    for (const cap of capacidadesDe('peligroEnMuelle')) if (cap.desde === 'peligroEnMuelle') yield [cap, inst]
  }
  for (const inst of s.zonas.tripulacion) {
    for (const e of estadosDe(s, inst)) for (const cap of capacidadesDe(cartaDeEstado(e))) if (cap.desde === 'estado') yield [cap, inst]
  }
  for (const e of s.estadosBarco ?? []) for (const cap of capacidadesDe(cartaDeEstado(e))) if (cap.desde === 'estadoBarco') yield [cap, null]
  // Un Tripulante marcado por una carta («se pierde»…): las capacidades de esa marca, con el Tripulante como fuente.
  const vistas = new Set<string>()
  for (const t of s.temporales) {
    if (!t.inst || !s.zonas.tripulacion.includes(t.inst) || vistas.has(`${t.fuente}/${t.inst}`)) continue
    vistas.add(`${t.fuente}/${t.inst}`)
    for (const cap of capacidadesDe(t.fuente)) if (cap.desde === 'marca') yield [cap, t.inst]
  }
}

function puedePagar(s: Estado, coste: Coste, fuente: InstId | null): boolean {
  switch (coste.tipo) {
    case 'agotarse':
      return fuente !== null && !copia(s, fuente).agotada
    case 'descartarse':
      return fuente !== null
    case 'pagar':
      return s.zonas.mano.filter((c) => c !== fuente).length >= coste.n
    case 'herida':
      return fuente !== null && estaEn(s, fuente, 'tripulacion')
    case 'agotarCapitan':
      return estaEn(s, s.capitan, 'tripulacion') && !copia(s, s.capitan).agotada
    case 'agotarTripulante': {
      const rasgos = coste.rasgos ?? (coste.rasgo === null ? null : [coste.rasgo])
      return s.zonas.tripulacion.some(
        (c) => !(coste.otro && c === fuente) && !copia(s, c).agotada && (rasgos === null || rasgos.some((r) => rasgosDe(copia(s, c).id).includes(r))),
      )
    }
    case 'agotarCanon':
      return canonesPreparados(s).length > 0
    case 'agotarVarios': {
      const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
      return preparados.length >= coste.n || (coste.oRasgo !== undefined && preparados.some((c) => rasgosDe(copia(s, c).id).includes(coste.oRasgo ?? '')))
    }
    case 'destina':
      return sePuedeDestinar(s, coste)
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
  // Un Evento de la mano necesita además poder pagar su coste impreso con las demás cartas (más lo que pida su
  // capacidad, «Descarta 2 cartas de tu mano:»).
  if (cap.desde === 'mano' && fuente !== null && tipoDe(copia(s, fuente).id) === 'evento') {
    // Sin ayuda (u «Oídos en la pared»): no se pueden jugar Eventos en esa Prueba.
    if (s.prueba?.sinAyuda || s.prueba?.sinEventos) return false
    const pagar = (cap.coste ?? []).reduce((n, c) => n + (c.tipo === 'pagar' ? c.n : 0), 0)
    const coste = valor(s, { tipo: 'coste', carta: fuente }) + pagar
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
  const fuentes: [Capacidad, InstId | null][] = [...candidatas(s)]
  // «Después de que descartes esta carta»: la capacidad de la carta recién descartada.
  if (ev.tipo === 'descartada') for (const cap of capacidadesDe(copia(s, ev.carta).id)) if (cap.desde === 'descartada') fuentes.push([cap, ev.carta])
  for (const [cap, fuente] of fuentes) {
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
