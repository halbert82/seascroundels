// Cálculos de la Prueba en curso: total y dificultad, siempre en vivo (D1a), con la base congelada (D1b).

import { iconosDe, nombreDe, porId, rasgosDe, tipoDe } from './catalogo.ts'
import type { Habilidad } from './datos.ts'
import { definicionEncuentro, reglasDe, type DefinicionPrueba, type Restriccion } from './definiciones.ts'
import type { ModSiguiente } from './efectos.ts'
import { destinoDe } from './destinos.ts'
import { copia } from './estado.ts'
import { tieneEstado } from './estados.ts'
import { entornoActual } from './peligros.ts'
import type { Bono, Estado, InstId, PruebaEnCurso } from './tipos.ts'
import { aportaciones, modificadores, valor, valorSinMinimo } from './valores.ts'

export function pruebaEnCurso(s: Estado): PruebaEnCurso {
  if (!s.prueba) throw new Error('No hay ninguna Prueba en curso')
  return s.prueba
}

export function nuevaPrueba(encuentro: InstId): PruebaEnCurso {
  return {
    encuentro,
    opcion: null,
    hab: null,
    dificultadBase: 0,
    comprometidos: [],
    cartas: [],
    iconos: 0,
    bonos: [],
    destino: null,
    destinoCancelado: false,
    sinOposicion: false,
    modDestino: 0,
    falla: false,
    sinCartas: false,
    sinCanones: false,
    sinFallo: false,
    ignorarFallo: false,
    heridaSiFallas: 0,
    avanceSiSuperas: 0,
    preparaSiSuperas: false,
    automatica: false,
    agotadas: [],
    resultado: null,
  }
}

/**
 * Lo que se prueba con esta carta: la Prueba suelta en curso (Acción de una carta) si es suya, o el encuentro
 * de la carta de Peligro en la misión en curso (lo impreso más sus reglas especiales).
 */
export function definicionDe(s: Estado, carta: InstId): DefinicionPrueba & { restriccion?: Restriccion } {
  const p = s.prueba
  const def = p?.encuentro === carta && p.definicion ? p.definicion : definicionEncuentro(s, carta)
  // La Prueba en curso es Sin ayuda por otra regla («la primera Prueba de esta misión es Sin ayuda»).
  return p?.encuentro === carta && p.sinAyuda && !def.sinAyuda ? { ...def, sinAyuda: true } : def
}

/** Definición de la Prueba en curso. */
export function definicionActual(s: Estado): DefinicionPrueba & { restriccion?: Restriccion } {
  const p = pruebaEnCurso(s)
  return definicionDe(s, p.encuentro)
}

/** ¿Hay un Tripulante preparado con ese Rasgo? */
export function hayRasgoPreparado(s: Estado, rasgo: string): boolean {
  return s.zonas.tripulacion.some((c) => !copia(s, c).agotada && rasgosDe(copia(s, c).id).includes(rasgo))
}

/**
 * Dificultad de una opción antes de los modificadores (con la rebaja por Rasgo si se cumple ahora). Si la rebaja
 * pide comprometer a alguien con ese Rasgo, mira entre `tripulantes` (los que se comprometen).
 */
export function dificultadDeOpcion(s: Estado, encuentro: InstId, opcion: number, tripulantes: readonly InstId[] = []): number {
  const o = definicionDe(s, encuentro).opciones[opcion]
  if (!o) throw new Error(`Opción de Prueba inexistente: ${opcion}`)
  const alt = o.alternativa
  if (!alt) return o.dificultad
  const cumple = alt.comprometido
    ? tripulantes.some((c) => rasgosDe(copia(s, c).id).includes(alt.rasgo))
    : hayRasgoPreparado(s, alt.rasgo)
  return cumple ? alt.dificultad : o.dificultad
}

/** ¿Se aplica a esta Prueba un «la siguiente Prueba (#Guardia#, de EXP…) de esta misión»? */
function modAplica(m: ModSiguiente, def: DefinicionPrueba, hab: Habilidad): boolean {
  if (m.de !== 'prueba') return false
  if (m.claves && !def.palabrasClave.some((k) => m.claves?.includes(k))) return false
  return !m.hab || m.hab === hab
}

/** Dificultad que añadirían a esta Prueba los «la siguiente Prueba de esta misión recibe ±X» pendientes. */
export function modsPendientes(s: Estado, def: DefinicionPrueba, hab: Habilidad): number {
  return (s.mision?.modsSiguientes ?? []).filter((m) => modAplica(m, def, hab)).reduce((n, m) => n + (m.n ?? 0), 0)
}

/** Aplica a la Prueba en curso los «la siguiente Prueba…» que le tocan, y los gasta. */
export function gastarModsSiguientes(s: Estado, p: PruebaEnCurso, def: DefinicionPrueba, hab: Habilidad): void {
  const m = s.mision
  if (!m?.modsSiguientes) return
  const aplican = m.modsSiguientes.filter((x) => modAplica(x, def, hab))
  if (aplican.length === 0) return
  m.modsSiguientes = m.modsSiguientes.filter((x) => !aplican.includes(x))
  if (m.modsSiguientes.length === 0) delete m.modsSiguientes
  const n = aplican.reduce((t, x) => t + (x.n ?? 0), 0)
  if (n !== 0) p.modExtra = (p.modExtra ?? 0) + n
  if (aplican.some((x) => x.dosDestinos)) p.dosDestinos = true
}

/**
 * Los Destinos de la Prueba con si están cancelados: uno, o dos si el encuentro dice «Resuelve 2 cartas de Destino en
 * esta Prueba» (fase 13, «Bruma en la selva»).
 */
export function destinosDeLaPrueba(p: PruebaEnCurso): { carta: InstId; cancelado: boolean; segundo: boolean }[] {
  const lista: { carta: InstId; cancelado: boolean; segundo: boolean }[] = []
  if (p.destino) lista.push({ carta: p.destino, cancelado: p.destinoCancelado, segundo: false })
  if (p.segundoDestino) lista.push({ carta: p.segundoDestino, cancelado: p.segundoCancelado ?? false, segundo: true })
  return lista
}

/** ¿No suma este comprometido en la Prueba en curso? (Aturdido, «los Vigías no suman», Destinos…) */
export function noSuma(s: Estado, c: InstId): boolean {
  return (s.prueba?.sinSumar?.includes(c) ?? false) || modificadores(s, { tipo: 'noSuma', carta: c }) > 0
}

function sinCanones(s: Estado, p: PruebaEnCurso): boolean {
  return p.sinCanones || valor(s, { tipo: 'sinCanones' }) > 0
}

/** Un bono no cuenta si es de un Cañón y los Cañones no suman, o si es de una Mejora y las Mejoras no suman. */
function bonoAnulado(s: Estado, p: PruebaEnCurso, b: Bono): boolean {
  if (b.canon && sinCanones(s, p)) return true
  if (!p.sinMejoras && !p.mejorasNoSuman) return false
  const tipo = b.fuente.startsWith('estado:') ? null : tipoDe(b.fuente)
  return tipo === 'mejoraBarco' || tipo === 'mejoraTripulante' || tipo === 'tesoro'
}

/**
 * Fase 10b: Inspirado da +1 y Maldito −1 al total de cada Prueba a la que esté asignado el Tripulante (aunque él no
 * sume). Devuelve lo que aporta cada ficha, para el total y su desglose.
 */
export function fichasDelTotal(s: Estado, asignados: readonly InstId[]): { inst: InstId; estado: 'inspirado' | 'maldito'; n: number }[] {
  const partes: { inst: InstId; estado: 'inspirado' | 'maldito'; n: number }[] = []
  for (const c of asignados) {
    if (!s.zonas.tripulacion.includes(c)) continue
    if (tieneEstado(s, c, 'inspirado')) partes.push({ inst: c, estado: 'inspirado', n: 1 })
    if (tieneEstado(s, c, 'maldito')) partes.push({ inst: c, estado: 'maldito', n: -1 })
  }
  return partes
}

/** Total de la Prueba en curso sin el Destino. */
export function totalSinDestino(s: Estado, p: PruebaEnCurso, hab: Habilidad): number {
  let total = 0
  for (const c of p.comprometidos) {
    if (s.zonas.tripulacion.includes(c) && !noSuma(s, c)) total += valor(s, { tipo: 'habilidad', carta: c, hab })
  }
  for (const f of fichasDelTotal(s, p.comprometidos)) total += f.n
  if (!p.sinCartas) total += p.iconos
  for (const b of p.bonos) if (!bonoAnulado(s, p, b)) total += b.n
  return total + modificadores(s, { tipo: 'totalPrueba', hab })
}

/**
 * Total de la Prueba en curso. El modificador del Destino se suma al total del jugador («+1» suma, «−1» resta; aquí va
 * en sentido de la dificultad y se resta). Si con el Destino queda por debajo de 0, cuenta como 0 (fase 10).
 */
export function totalPrueba(s: Estado): number {
  const p = pruebaEnCurso(s)
  if (!p.hab) return 0
  return Math.max(0, totalSinDestino(s, p, p.hab) - p.modDestino)
}

/** Palabras clave del encuentro en curso. */
export function clavesDelEncuentro(s: Estado, encuentro: InstId): string[] {
  return definicionDe(s, encuentro).palabrasClave
}

/** Modificador de un Destino a esta Prueba («+2 en su lugar» si se cumple su condición). */
export function modificadorDeDestino(s: Estado, destino: InstId, encuentro: InstId, hab: Habilidad): number | 'fallo' {
  // Peligros 2.0: el modificador puede depender de la situación.
  const r = reglasDe(copia(s, destino).id)?.destino
  if (r?.modificador && s.prueba) return r.modificador(s, s.prueba)
  const d = destinoDe(copia(s, destino).id)
  if (d.modificador === 'fallo') return 'fallo'
  if (d.siClave && clavesDelEncuentro(s, encuentro).some((k) => d.siClave?.claves.includes(k))) return d.siClave.n
  if (d.siHabilidad && d.siHabilidad.hab === hab) return d.siHabilidad.n
  return d.modificador
}

/** Dificultad actual de la Prueba en curso. */
export function dificultadPrueba(s: Estado): number {
  const p = pruebaEnCurso(s)
  if (!p.hab) return 0
  // P61 y fase 10: la dificultad suma todos sus modificadores (los de las cartas, la misión, el Escenario y los Rasgos;
  // el Destino ya no, que va al total) y solo el resultado final, si es menor que 0, cuenta como 0.
  const d = valorSinMinimo(s, { tipo: 'dificultad', base: p.dificultadBase, hab: p.hab, claves: clavesDelEncuentro(s, p.encuentro) })
  return Math.max(0, d + (p.modExtra ?? 0))
}

/**
 * Previsión antes de comprometer (para la interfaz y los jugadores automáticos): total y dificultad
 * si se eligen esa opción, esos Tripulantes (se agotan a la vez, D1a) y esas cartas, sin Destino.
 */
export function prevision(s: Estado, encuentro: InstId, opcion: number, tripulantes: readonly InstId[], cartas: readonly InstId[]) {
  const def = definicionDe(s, encuentro)
  const o = def.opciones[opcion]
  if (!o) throw new Error(`Opción de Prueba inexistente: ${opcion}`)
  const supuestas = new Set(tripulantes)
  let total = 0
  for (const c of tripulantes) {
    // Lo que diga la carta («los Vigías no suman»): no suma.
    if (modificadores(s, { tipo: 'noSuma', carta: c }) <= 0) {
      total += valor(s, { tipo: 'habilidad', carta: c, hab: o.hab }, supuestas, tripulantes)
    }
  }
  // Inspirado +1 y Maldito −1 (fase 10b).
  for (const f of fichasDelTotal(s, tripulantes)) total += f.n
  for (const c of cartas) total += iconosDe(copia(s, c).id, o.hab)
  total += modificadores(s, { tipo: 'totalPrueba', hab: o.hab })
  const base = dificultadDeOpcion(s, encuentro, opcion, tripulantes)
  const extra = s.prueba?.encuentro === encuentro ? (s.prueba.modExtra ?? 0) + modsPendientes(s, def, o.hab) : 0
  // P61: solo el resultado final no baja de 0.
  const dificultad = Math.max(0, valorSinMinimo(s, { tipo: 'dificultad', base, hab: o.hab, claves: def.palabrasClave }, supuestas, tripulantes) + extra)
  return { total, dificultad }
}

/**
 * Por qué no vale este compromiso (o null si vale): Borracho, Buscado en Ciudad, Asustado y Sin ayuda.
 * Lo usan el motor al validar, la mesa para no dejar confirmar y los jugadores automáticos.
 */
export function problemaCompromiso(
  s: Estado,
  def: DefinicionPrueba & { restriccion?: Restriccion },
  hab: Habilidad,
  tripulantes: readonly InstId[],
  cartas: readonly InstId[],
): string | null {
  for (const c of tripulantes) {
    if (def.soloCon && c !== def.soloCon) return `Solo puede hacerla ${nombreDe(copia(s, def.soloCon).id)}`
    if (buscadoEnCiudad(s, c)) return `${nombreDe(copia(s, c).id)} está Buscado: no puede ser asignado en Ciudad`
    if (tieneEstado(s, c, 'borracho') && hab !== 'COM') return `${nombreDe(copia(s, c).id)} está Borracho: no puede ser asignado a ${hab}`
    if (s.temporales.some((t) => t.clave === 'noCompromete' && t.inst === c)) return `${nombreDe(copia(s, c).id)} no puede ser asignado ahora`
    const veto = def.restriccion?.veto?.(s, c)
    if (veto) return veto
  }
  const maximo = def.maximo ?? def.restriccion?.maximo
  if (maximo !== undefined && tripulantes.length > maximo) return `No puedes asignar a más de ${maximo}`
  const unico = tripulantes.length === 1 ? tripulantes[0] : undefined
  if (unico && tieneEstado(s, unico, 'asustado')) return `${nombreDe(copia(s, unico).id)} está Asustado: no puede ser asignado él solo`
  if (def.sinAyuda) {
    if (tripulantes.length > 1) return 'Sin ayuda: solo puede ser asignado un Tripulante'
    // Sin ayuda: los Eventos tampoco suman por sus iconos; solo las Habilidades (P7).
    if (cartas.some((c) => tipoDe(copia(s, c).id) !== 'habilidad')) return 'Sin ayuda: solo suman las Habilidades de tu mano'
  }
  return null
}

/** Buscado (fase 10b): no puede ser asignado en misiones de Ciudad. */
export function buscadoEnCiudad(s: Estado, c: InstId): boolean {
  return tieneEstado(s, c, 'buscado') && entornoActual(s) === 'ciu'
}

/** Nombre del encuentro de una carta en la misión en curso. */
export function nombreDelEncuentro(s: Estado, carta: InstId): string {
  const e = porId(copia(s, carta).id)
  if (s.prueba?.encuentro === carta && s.prueba.definicion) return s.prueba.definicion.nombre
  return e.tipo === 'peligro' || e.tipo === 'mazoPropio' ? definicionEncuentro(s, carta).nombre : e.id
}

/** Una parte de la suma del total o de la dificultad, para enseñarla en la mesa. */
export interface ParteDesglose {
  /** Lo que la produce: un Tripulante, una carta, una capacidad, la misión, el Destino… */
  etiqueta: string
  n: number
  /** De qué tipo es, para dibujarla. */
  tipo: 'tripulante' | 'carta' | 'bono' | 'modificador' | 'base' | 'destino'
  /** Copia o carta que la produce, si la hay. */
  inst?: InstId
  carta?: string
  /** No cuenta («Los Cañones no suman», «Las cartas de tu mano no suman», Destino cancelado). */
  anulada?: boolean
}

/** Desglose del total de la Prueba en curso, con el Destino. Las partes no anuladas suman exactamente `totalPrueba`. */
export function desgloseTotal(s: Estado): ParteDesglose[] {
  const p = pruebaEnCurso(s)
  if (!p.hab) return []
  const hab = p.hab
  const partes: ParteDesglose[] = []
  for (const c of p.comprometidos) {
    if (!s.zonas.tripulacion.includes(c)) continue
    const parte: ParteDesglose = { etiqueta: nombreDe(copia(s, c).id), n: valor(s, { tipo: 'habilidad', carta: c, hab }), tipo: 'tripulante', inst: c }
    if (p.sinSumar?.includes(c)) parte.anulada = true
    partes.push(parte)
  }
  for (const c of p.cartas) {
    const n = iconosDe(copia(s, c).id, hab)
    if (n > 0) partes.push({ etiqueta: nombreDe(copia(s, c).id), n, tipo: 'carta', inst: c, anulada: p.sinCartas })
  }
  for (const f of fichasDelTotal(s, p.comprometidos)) {
    partes.push({ etiqueta: `${nombreDe(copia(s, f.inst).id)}, ${f.estado === 'inspirado' ? 'Inspirado' : 'Maldito'}`, n: f.n, tipo: 'modificador', inst: f.inst, carta: `estado:${f.estado}` })
  }
  for (const b of p.bonos) partes.push({ etiqueta: nombreDe(b.fuente), n: b.n, tipo: 'bono', carta: b.fuente, anulada: bonoAnulado(s, p, b) })
  for (const a of aportaciones(s, { tipo: 'totalPrueba', hab })) {
    const parte: ParteDesglose = { etiqueta: nombreDe(a.carta), n: a.n, tipo: 'modificador', carta: a.carta }
    if (a.inst) parte.inst = a.inst
    partes.push(parte)
  }
  // El Destino se suma al total («el Destino de la carta X»). Fase 13: con dos Destinos, una línea por cada uno.
  const destinos = destinosDeLaPrueba(p)
  if (destinos.length === 1 && p.destino) {
    partes.push({ etiqueta: `Destino de «${nombreDe(copia(s, p.destino).id)}»`, n: -p.modDestino, tipo: 'destino', inst: p.destino, anulada: p.destinoCancelado })
  } else if (destinos.length > 1) {
    // Lo que aporta cada uno; si una carta ha cambiado el modificador sobre la marcha («Dados cargados»…), la diferencia
    // va en el primero que siga en pie, para que las líneas sumen el total.
    const mods = destinos.map((d) => {
      const m = d.cancelado ? 0 : modificadorDeDestino(s, d.carta, p.encuentro, hab)
      const n = m === 'fallo' ? 0 : p.invertirDestino ? -m : m
      return -n
    })
    const resto = -p.modDestino - mods.reduce((a, b) => a + b, 0)
    const primero = destinos.findIndex((d) => !d.cancelado)
    destinos.forEach((d, i) => {
      partes.push({
        etiqueta: `Destino de «${nombreDe(copia(s, d.carta).id)}»`,
        n: (mods[i] ?? 0) + (i === primero ? resto : 0),
        tipo: 'destino',
        inst: d.carta,
        anulada: d.cancelado,
      })
    })
  }
  // Con el Destino, si el total queda por debajo de 0, cuenta como 0 (una sola línea, al final).
  const suma = partes.filter((x) => !x.anulada).reduce((n, x) => n + x.n, 0)
  if (suma < 0) partes.push({ etiqueta: 'No baja de 0', n: -suma, tipo: 'modificador' })
  return partes
}

/** Desglose de la dificultad de la Prueba en curso. Suma `dificultadPrueba` (salvo si quedaría por debajo de 0). */
export function desgloseDificultad(s: Estado): ParteDesglose[] {
  const p = pruebaEnCurso(s)
  if (!p.hab) return []
  const def = definicionActual(s)
  const partes: ParteDesglose[] = [{ etiqueta: def.nombre, n: p.dificultadBase, tipo: 'base', inst: p.encuentro }]
  for (const a of aportaciones(s, { tipo: 'dificultad', base: p.dificultadBase, hab: p.hab, claves: clavesDelEncuentro(s, p.encuentro) })) {
    partes.push({ etiqueta: nombreDe(a.carta), n: a.n, tipo: 'modificador', carta: a.carta })
  }
  if (p.modExtra) partes.push({ etiqueta: 'Efecto del Peligro', n: p.modExtra, tipo: 'modificador' })
  // P61: si el total final queda por debajo de 0, cuenta como 0 (una sola línea, al final).
  const suma = partes.filter((x) => !x.anulada).reduce((n, x) => n + x.n, 0)
  if (suma < 0) partes.push({ etiqueta: 'No baja de 0', n: -suma, tipo: 'modificador' })
  return partes
}
