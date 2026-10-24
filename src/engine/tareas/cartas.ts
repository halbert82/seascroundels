// Primitivas con cartas: robar, perder un día, muelle, pagar, curar, reparar, perder Mejoras.

import { costeImpreso, esIndestructible, nombreDe, tipoDe } from '../catalogo.ts'
import { anotar, copia, encolar, nombre, nombres, sucesoDescartada } from '../estado.ts'
import { curable, curarTripulante, quitarEstadoBarco } from '../estados.ts'
import type { Estado, InstId } from '../tipos.ts'
import { valor } from '../valores.ts'
import { arriba, mover, moverA, rebarajar } from '../zonas.ts'
import { DATOS } from '../datos.ts'
import { eleccionDe, preguntar, type Manejador, type Resultado } from './comun.ts'

/** Descarta la carta de arriba del mazo de Escenario sin aplicarla. */
export function perderUnDia(s: Estado): void {
  if (s.sinEscenario) {
    if (s.sinEscenario.dias <= 0) {
      anotar(s, 'aviso', 'Pierdes un día, pero ya no quedan días.')
      return
    }
    s.sinEscenario.dias -= 1
    anotar(s, 'aviso', `Pierdes un día: ${s.sinEscenario.dias === 1 ? 'queda 1 día' : `quedan ${s.sinEscenario.dias} días`}.`)
    return
  }
  const carta = arriba(s, 'mazoEscenario')
  if (!carta) {
    anotar(s, 'aviso', 'Pierdes un día, pero ya no quedan cartas de Escenario.')
    return
  }
  mover(s, carta, 'descartesEscenario')
  s.infoRevelada++
  anotar(s, 'aviso', `Pierdes un día: se descarta «${nombre(s, carta)}» sin aplicarla.`)
}

/** Roba N cartas del mazo del capitán. Si se acaba, baraja sus descartes y pierdes un día. */
export function robarCartas(s: Estado, n: number): InstId[] {
  const robadas: InstId[] = []
  for (let i = 0; i < n; i++) {
    if (s.zonas.mazoCapitan.length === 0) {
      if (s.zonas.descartesCapitan.length === 0) {
        anotar(s, 'aviso', 'No quedan cartas que robar.')
        break
      }
      rebarajar(s, 'descartesCapitan', 'mazoCapitan')
      anotar(s, 'aviso', 'Se acaba el mazo del capitán: barajas su pila de descartes.')
      perderUnDia(s)
    }
    const carta = arriba(s, 'mazoCapitan')
    if (!carta) break
    mover(s, carta, 'mano', 'abajo')
    robadas.push(carta)
  }
  if (robadas.length > 0) {
    s.infoRevelada++
    anotar(s, 'robar', `Robas ${robadas.length}: ${nombres(s, robadas)}.`)
  }
  return robadas
}

/** Revela cartas del mazo de muelle al muelle. Si se acaba, se barajan sus descartes, sin penalización. */
export function revelarAlMuelle(s: Estado, n: number): void {
  const reveladas: InstId[] = []
  for (let i = 0; i < n; i++) {
    if (s.zonas.mazoMuelle.length === 0) {
      if (s.zonas.descartesMuelle.length === 0) break
      rebarajar(s, 'descartesMuelle', 'mazoMuelle')
      anotar(s, 'aviso', 'Se acaba el mazo de muelle: se baraja su pila de descartes.')
    }
    const carta = arriba(s, 'mazoMuelle')
    if (!carta) break
    mover(s, carta, 'muelle', 'abajo')
    reveladas.push(carta)
  }
  if (reveladas.length > 0) {
    s.infoRevelada++
    anotar(s, 'revelar', `Muelle: ${nombres(s, reveladas)}.`)
  }
}

export function tamanoMuelle(s: Estado): number {
  const puerto = DATOS.puertos.find((p) => p.id === s.puerto)
  if (!puerto) throw new Error(`Puerto desconocido: ${s.puerto}`)
  return puerto.muelle
}

export const robar: Manejador<'robar'> = (s, t) => {
  robarCartas(s, t.n)
  return 'hecha'
}

export const perderDia: Manejador<'perderDia'> = (s) => {
  perderUnDia(s)
  return 'hecha'
}

/**
 * Al terminar el paso de Jugar cartas: se descarta el muelle entero y se repone. Una carta de Peligro que
 * ocupa el muelle se queda (ocupando su hueco) hasta que pagues para descartarla.
 */
// La carta de Peligro del muelle no se descarta al reponerlo: sigue ocupando un hueco hasta que pagas (P18).
export const reponerMuelle: Manejador<'reponerMuelle'> = (s) => {
  const peligros = s.zonas.muelle.filter((c) => s.peligrosEnMuelle?.[c] !== undefined)
  const restos = s.zonas.muelle.filter((c) => !peligros.includes(c))
  for (const c of restos) mover(s, c, 'descartesMuelle')
  if (restos.length > 0) anotar(s, 'efecto', `Se descartan del muelle: ${nombres(s, restos)}.`)
  revelarAlMuelle(s, tamanoMuelle(s) - peligros.length)
  return 'hecha'
}

export const revelarMuelle: Manejador<'revelarMuelle'> = (s, t) => {
  revelarAlMuelle(s, t.n)
  return 'hecha'
}

/**
 * «Mira las 3 cartas superiores del mazo de muelle: pon 1 en el muelle en lugar de la carta de más a la izquierda (que se
 * descarta) y las otras al fondo» («Lenguas sueltas», en «Barril de ron»). Revisión de Albert: «Marineros sin barco» hace
 * lo mismo, pero solo con un Tripulante (`soloTripulantes`) y «Este turno, reclutarlo cuesta 1 menos» (`marca`). Si no sale
 * ningún Tripulante, las 3 van al fondo, no se descarta nada y no hay descuento.
 * P42 (confirmada): una carta de Peligro que ocupa el muelle no cuenta como «la de más a la izquierda»: se salta (si no, la
 * quitarías gratis); las otras van al fondo en el orden en que estaban.
 */
export function mirarYPonerEnMuelle(
  s: Estado,
  e: Parameters<Manejador<'especial'>>[2],
  como: { motivo: 'lenguasSueltas' | 'marinerosSinBarco'; soloTripulantes?: boolean; marca?: { clave: string; fuente: string } },
): Resultado {
  if (s.zonas.mazoMuelle.length === 0 && s.zonas.descartesMuelle.length > 0) {
    rebarajar(s, 'descartesMuelle', 'mazoMuelle')
    anotar(s, 'aviso', 'Se acaba el mazo de muelle: se baraja su pila de descartes.')
  }
  const vistas = s.zonas.mazoMuelle.slice(0, 3)
  if (vistas.length === 0) return 'hecha'
  const candidatas = como.soloTripulantes ? vistas.filter((c) => tipoDe(copia(s, c).id) === 'tripulante') : vistas
  if (!e) {
    s.infoRevelada++
    anotar(s, 'revelar', `Miras las cartas de arriba del mazo de muelle: ${nombres(s, vistas)}.`)
    if (candidatas.length > 1) return preguntar({ tipo: 'elegirCartas', motivo: { clave: como.motivo }, candidatas, min: 1, max: 1 })
  }
  const elegida = candidatas.length === 1 ? candidatas[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
  if (elegida && candidatas.includes(elegida)) {
    const izquierda = s.zonas.muelle.find((c) => s.peligrosEnMuelle?.[c] === undefined)
    const indice = izquierda ? s.zonas.muelle.indexOf(izquierda) : s.zonas.muelle.length
    if (izquierda) {
      mover(s, izquierda, 'descartesMuelle')
      anotar(s, 'efecto', `Se descarta del muelle «${nombre(s, izquierda)}».`)
    }
    moverA(s, elegida, 'muelle', indice)
    anotar(s, 'efecto', `«${nombre(s, elegida)}» entra en el muelle.`)
    if (como.marca) {
      s.temporales.push({ clave: como.marca.clave, fuente: como.marca.fuente, hasta: 'finTurno', inst: elegida })
      anotar(s, 'efecto', `Este turno, reclutar a «${nombre(s, elegida)}» cuesta 1 menos.`)
    }
  } else if (como.soloTripulantes) anotar(s, 'efecto', 'No sale ningún Tripulante: no entra nadie en el muelle.')
  const resto = vistas.filter((c) => c !== elegida)
  for (const c of resto) mover(s, c, 'mazoMuelle', 'abajo')
  if (resto.length > 0) anotar(s, 'efecto', `Pones al fondo del mazo de muelle: ${nombres(s, resto)}.`)
  return 'hecha'
}

/** Pagar un coste: descarta de la mano tantas cartas como indique. */
export const pagar: Manejador<'pagar'> = (s, t, e) => {
  if (t.cantidad <= 0) return 'hecha'
  if (!e) {
    if (s.zonas.mano.length < t.cantidad) throw new Error(`No hay cartas suficientes para pagar ${t.cantidad}`)
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'pagar', carta: t.motivo, n: t.cantidad },
      candidatas: [...s.zonas.mano],
      min: t.cantidad,
      max: t.cantidad,
    })
  }
  const ids = eleccionDe(e, 'cartas').ids
  for (const c of ids) mover(s, c, 'descartesCapitan')
  anotar(s, 'pagar', `Pagas ${ids.length} por «${nombreDe(t.motivo)}»: ${nombres(s, ids)}.`, { tipo: 'pago', n: ids.length })
  return 'hecha'
}

/** Reparar N daños (fase 10b: reparar ya no quita la Vía de agua). */
export const reparar: Manejador<'reparar'> = (s, t) => {
  const n = t.n
  const antes = s.danoBarco
  s.danoBarco = Math.max(0, s.danoBarco - n)
  if (antes > s.danoBarco) anotar(s, 'efecto', `Reparas ${antes - s.danoBarco}: el Barco queda con ${s.danoBarco} de daño.`)
  return 'hecha'
}

/**
 * Curar N: «cadaUno» cura N a cada Tripulante; «repartir» reparte N como quiera el jugador; «uno», N a un Tripulante.
 * Fase 10b: curar solo quita heridas (los Estados se quitan aparte).
 */
export const curar: Manejador<'curar'> = (s, t, e) => {
  const heridos = s.zonas.tripulacion.filter((c) => curable(s, c) > 0)
  if (t.modo === 'uno') {
    const candidatos = t.objetivo ? heridos.filter((c) => c === t.objetivo) : heridos
    if (candidatos.length === 0) return 'hecha'
    if (candidatos.length > 1 && !e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'curarUno', n: t.n }, candidatas: candidatos, min: 1, max: 1 })
    const objetivo = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
    if (!objetivo) return 'hecha'
    const texto = curarTripulante(s, objetivo, t.n)
    if (texto) anotar(s, 'efecto', `Curas a ${texto}.`)
    return 'hecha'
  }
  if (t.modo === 'cadaUno') {
    const textos = heridos.map((c) => curarTripulante(s, c, t.n)).filter(Boolean)
    if (textos.length > 0) anotar(s, 'efecto', `Curas ${t.n} a cada Tripulante: ${textos.join('; ')}.`)
    return 'hecha'
  }
  const total = heridos.reduce((n, c) => n + curable(s, c), 0)
  if (total === 0) return 'hecha'
  if (total <= t.n) {
    const textos = heridos.map((c) => curarTripulante(s, c, curable(s, c))).filter(Boolean)
    anotar(s, 'efecto', `Curas todo (${total}): ${textos.join('; ')}.`)
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const c of heridos) maximos[c] = curable(s, c)
    return preguntar({ tipo: 'repartir', motivo: { clave: 'curar', n: t.n }, cantidad: t.n, maximos })
  }
  const reparto = eleccionDe(e, 'reparto').n
  const partes: string[] = []
  for (const [inst, n] of Object.entries(reparto) as [InstId, number][]) {
    if (!n) continue
    const texto = curarTripulante(s, inst, n)
    if (texto) partes.push(texto)
  }
  anotar(s, 'efecto', `Curas ${t.n}: ${partes.join('; ')}.`)
  return 'hecha'
}

/**
 * Pierdes una Mejora: eliges una del Barco o de un Tripulante (ni Tesoros ni indestructibles). `soloBarco`: de barco.
 * `mayorCoste`: la de mayor coste impreso; si empatan, eliges entre ellas («Impuestos del gobernador»).
 */
export const perderMejora: Manejador<'perderMejora'> = (s, t, e) => {
  const posibles = s.zonas.mejoras.filter((m) => {
    const v = copia(s, m).vinculadaA
    if (esIndestructible(copia(s, m).id)) return false
    if (t.soloBarco && v !== 'barco') return false
    // «Pierdes 1 Mejora de un Tripulante comprometido».
    return !t.portadores || (v !== null && v !== 'barco' && t.portadores.includes(v))
  })
  const maximo = Math.max(0, ...posibles.map((m) => costeImpreso(copia(s, m).id)))
  const candidatas = t.mayorCoste ? posibles.filter((m) => costeImpreso(copia(s, m).id) === maximo) : posibles
  const perder = (m: InstId) => {
    mover(s, m, 'descartesMuelle')
    anotar(s, 'efecto', `Pierdes «${nombre(s, m)}».`)
    encolar(s, sucesoDescartada(m))
  }
  if (candidatas.length === 0) {
    anotar(s, 'efecto', 'No tienes ninguna Mejora que se pueda perder.')
    return 'hecha'
  }
  if (candidatas.length === 1 && candidatas[0]) {
    perder(candidatas[0])
    return 'hecha'
  }
  if (!e) {
    const motivo = t.mayorCoste ? { clave: 'perderMejora', texto: `Empatan en coste (${maximo}): eliges cuál pierdes.` } : { clave: 'perderMejora' }
    return preguntar({ tipo: 'elegirCartas', motivo, candidatas, min: 1, max: 1 })
  }
  const [m] = eleccionDe(e, 'cartas').ids
  if (m) perder(m)
  return 'hecha'
}

export const anadirTemporal: Manejador<'anadirTemporal'> = (s, t) => {
  s.temporales.push(t.temporal)
  return 'hecha'
}

/** Robar hasta el Mando al final del turno (con «−1 Mando» y «Escasez de pertrechos»). */
export const robarHastaMando: Manejador<'robarHastaMando'> = (s) => {
  const objetivo = valor(s, { tipo: 'objetivoRobo' })
  const n = objetivo - s.zonas.mano.length
  if (n > 0) encolar(s, { tipo: 'robar', n })
  return 'hecha'
}

/**
 * Fase 16, Desánimo: «Cuando vayas a robar al final del turno, roba 1 carta menos y descarta esta carta.» El −1 al robar lo
 * da su capacidad constante (capacidades/estados.ts); después de robar, la carta vuelve a la reserva.
 */
export const descartarDesanimo: Manejador<'descartarDesanimo'> = (s) => {
  if (quitarEstadoBarco(s, 'desanimo')) anotar(s, 'efecto', 'Desánimo: robas 1 carta menos y descartas su carta.')
  return 'hecha'
}
