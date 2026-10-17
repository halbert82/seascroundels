// Zarpar, empezar la misión, recorrer sus cartas de Peligro y cerrarla (superada, retirada o hundida).

import { capacidadesDe } from '../capacidades/index.ts'
import { candidatas, sePuedeUsar } from '../usos.ts'
import { reputacionMinima } from '../capacidades/misiones.ts'
import { CATALOGO, iconosDe, porId, rasgosDe } from '../catalogo.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { devolverPeligros } from '../peligros.ts'
import { primerNumero, textoDe } from '../textos.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { navParaDistancia, valor } from '../valores.ts'
import { arriba, barajar, mover, rebarajar } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

// ---------------------------------------------------------------------------
// Zarpar

function preparados(s: Estado): InstId[] {
  return s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
}

function cartasConNav(s: Estado): InstId[] {
  return s.zonas.mano.filter((c) => iconosDe(copia(s, c).id, 'NAV') > 0)
}

/** Lo máximo que se puede poner para cubrir una Distancia: el mejor grupo de Tripulantes (D1a) y todas las cartas con NAV. */
export function navMaximo(s: Estado): number {
  const lista = preparados(s)
  let mejor = 0
  for (let mascara = 0; mascara < 1 << lista.length; mascara++) {
    const grupo = lista.filter((_, i) => mascara & (1 << i))
    mejor = Math.max(mejor, navParaDistancia(s, grupo))
  }
  return mejor + cartasConNav(s).reduce((n, c) => n + iconosDe(copia(s, c).id, 'NAV'), 0)
}

/** ¿Se puede zarpar a esta misión ahora? (reputación mínima y Distancia que se pueda cubrir) */
export function puedeZarpar(s: Estado, mision: InstId): boolean {
  if (s.reputacion < reputacionMinima(copia(s, mision).id)) return false
  const distancia = valor(s, { tipo: 'distancia', mision })
  return distancia === 0 || navMaximo(s) >= distancia
}

function empezar(s: Estado, mision: InstId): void {
  s.mision = { carta: mision, cartasResueltas: 0, mazoMezclado: false, fin: null, retirar: [], automatica: null }
  s.paso = 'mision'
  anotar(s, 'jugada', `Zarpas a «${nombre(s, mision)}».`, { tipo: 'zarpar', mision: copia(s, mision).id })
  encolar(s, { tipo: 'mision', paso: 'inicio' })
}

/** Zarpar: si la misión es lejana, cubre su Distancia agotando Tripulantes a la vez y descartando cartas con NAV. */
export const zarpar: Manejador<'zarpar'> = (s, t, e) => {
  const distancia = valor(s, { tipo: 'distancia', mision: t.mision })
  if (distancia > 0 && !e) {
    return preguntar({
      tipo: 'cubrirDistancia',
      motivo: { clave: 'distancia', carta: copia(s, t.mision).id, n: distancia },
      distancia,
      tripulantes: preparados(s),
      cartas: cartasConNav(s),
    })
  }
  if (e) {
    const ids = eleccionDe(e, 'cartas').ids
    const tripulantes = ids.filter((c) => s.zonas.tripulacion.includes(c))
    const cartas = ids.filter((c) => s.zonas.mano.includes(c))
    for (const c of tripulantes) copia(s, c).agotada = true
    for (const c of cartas) mover(s, c, 'descartesCapitan')
    const partes = [tripulantes.length > 0 ? `agotas a ${nombres(s, tripulantes)}` : '', cartas.length > 0 ? `descartas ${nombres(s, cartas)}` : '']
    anotar(s, 'jugada', `Cubres la Distancia ${distancia}: ${partes.filter(Boolean).join(' y ')}.`)
    if (cartas.length > 0) anotar(s, 'jugada', `Descartas por sus iconos: ${nombres(s, cartas)}.`, { tipo: 'iconos', cartas: cartas.map((c) => copia(s, c).id) })
  }
  empezar(s, t.mision)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// La misión

/** Gana N de Avance en la misión en curso. */
export function ganarAvanceMision(s: Estado, n: number, motivo: string): void {
  ganar(s, n, motivo)
}

function ganar(s: Estado, n: number, motivo: string): void {
  if (!s.mision || n <= 0) return
  const m = copia(s, s.mision.carta)
  m.avance += n
  anotar(s, 'efecto', `${motivo}: +${n} de Avance (${m.avance}/${valor(s, { tipo: 'avanceNecesario', mision: s.mision.carta })}).`, { tipo: 'avance', n, total: m.avance })
}

export const mision: Manejador<'mision'> = (s, t) => {
  const m = s.mision
  if (!m) return 'hecha'
  switch (t.paso) {
    case 'inicio': {
      // Avance inicial: las fichas que ya tuviera (se quedan) y las de otras cartas.
      if (s.temporales.some((x) => x.clave === 'rumores.turno')) ganar(s, primerNumero(textoDe('rumores')), 'Rumores del tesoro')
      const tareas: NuevaTarea[] = []
      for (const cap of capacidadesDe(copia(s, m.carta).id)) {
        if (cap.ventana === 'alZarpar' && cap.desde === 'mision') tareas.push(...(cap.efecto?.(s, m.carta, null) ?? []))
      }
      // Las capacidades «Al zarpar» de tus cartas (Vela mayor, Chalupa) se aplican en el mismo momento.
      for (const [cap, fuente] of candidatas(s)) {
        if (cap.ventana === 'alZarpar' && sePuedeUsar(s, cap, fuente)) tareas.push({ tipo: 'usar', uso: { fuente, clave: cap.clave }, evento: null, paso: 'coste' })
      }
      // «Después de zarpar…»: Respuestas de las cartas del jugador.
      tareas.push({ tipo: 'evento', ev: { tipo: 'zarpar', mision: m.carta }, fase: 'antes', cancelado: false, usadas: [] })
      encolar(s, ...tareas)
      t.paso = 'encuentros'
      return 'sigue'
    }
    case 'alZarpar':
    case 'encuentros':
      if (m.fin) {
        t.paso = 'terminar'
        return 'sigue'
      }
      encolar(s, { tipo: 'encuentro', carta: null, paso: 'revelar' })
      return 'sigue'
    case 'terminar':
      encolar(s, m.fin === 'superada' ? { tipo: 'superarMision' } : { tipo: 'fallarMision', paso: 'rehenes' }, { tipo: 'cerrarMision' })
      return 'hecha'
  }
}

/** «Si tienes un Vigía preparado, gana 1» / «Si tienes 3 o más Tripulantes preparados, gana 2» / Avance sin condición. */
export const ganarAvance: Manejador<'ganarAvance'> = (s, t) => {
  if (!s.mision) return 'hecha'
  const si = t.si
  if (si && 'rasgo' in si) {
    if (!preparados(s).some((c) => rasgosDe(copia(s, c).id).includes(si.rasgo))) return 'hecha'
    ganar(s, t.n, `Tienes un ${si.rasgo} preparado`)
  } else if (si && 'preparados' in si) {
    if (preparados(s).length < si.preparados) return 'hecha'
    ganar(s, t.n, `Tienes ${si.preparados} o más Tripulantes preparados`)
  } else {
    ganar(s, t.n, t.motivo ?? 'Al zarpar')
  }
  return 'hecha'
}

/** «Agota a un Oficial para ganar 2» / «Descarta 2 cartas para ganar 2»: opcionales. */
export const alZarparOpcional: Manejador<'alZarparOpcional'> = (s, t, e) => {
  if (!s.mision) return 'hecha'
  const coste = t.coste
  if (coste.tipo === 'agotarRasgo') {
    const candidatos = preparados(s).filter((c) => rasgosDe(copia(s, c).id).includes(coste.rasgo))
    if (candidatos.length === 0) return 'hecha'
    if (!e) {
      return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'alZarparAgotar', n: t.n }, candidatas: candidatos, min: 0, max: 1 })
    }
    const [c] = eleccionDe(e, 'cartas').ids
    if (c) {
      copia(s, c).agotada = true
      ganar(s, t.n, `Agotas a ${nombre(s, c)}`)
    }
    return 'hecha'
  }
  if (s.zonas.mano.length < coste.n) return 'hecha'
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'alZarparDescartar', n: t.n },
      opciones: [
        { clave: 'si', texto: `Descartar ${coste.n} cartas para ganar ${t.n} de Avance` },
        { clave: 'no', texto: 'No' },
      ],
    })
  }
  if (eleccionDe(e, 'opcion').clave === 'si') {
    encolar(s, { tipo: 'pagar', cantidad: coste.n, motivo: copia(s, s.mision.carta).id }, { tipo: 'ganarAvance', n: t.n })
  }
  return 'hecha'
}

/** «Baraja el mazo propio con N cartas del mazo de Peligros. Durante esta misión, revela de ese mazo.» */
export const mezclarMazoPropio: Manejador<'mezclarMazoPropio'> = (s, t) => {
  if (!s.mision) return 'hecha'
  const misionId = porId(copia(s, s.mision.carta).id)
  if (misionId.tipo !== 'capitulo') return 'hecha'
  const propias = new Set(CATALOGO.filter((e) => e.tipo === 'mazoPropio' && e.mision.id === misionId.mision.id).map((e) => e.id))
  for (const c of s.zonas.mazoHistoria.filter((x) => propias.has(copia(s, x).id))) mover(s, c, 'mazoMision')
  for (let i = 0; i < t.n; i++) {
    if (s.zonas.mazoPeligros.length === 0 && s.zonas.descartesPeligros.length > 0) rebarajar(s, 'descartesPeligros', 'mazoPeligros')
    const c = arriba(s, 'mazoPeligros')
    if (!c) break
    mover(s, c, 'mazoMision')
  }
  barajar(s, 'mazoMision')
  s.mision.mazoMezclado = true
  anotar(s, 'efecto', `Barajas el mazo de la misión: ${s.zonas.mazoMision.length} cartas.`)
  return 'hecha'
}

// ---------------------------------------------------------------------------
// Fin de la misión

/** Superar la misión: rehenes rescatados, reputación, recompensa, capítulo siguiente y Tesoro. */
export const superarMision: Manejador<'superarMision'> = (s) => {
  const m = s.mision
  if (!m) return 'hecha'
  const e = porId(copia(s, m.carta).id)
  if (e.tipo !== 'capitulo') return 'hecha'
  anotar(s, 'fin', `¡Superas «${e.carta.nombre}»!`, { tipo: 'finMision', mision: e.id, resultado: 'superada' })
  for (const h of [...s.zonas.rehenes]) {
    mover(s, h, 'tripulacion', 'abajo')
    anotar(s, 'efecto', `Rescatas a ${nombre(s, h)}.`)
  }
  const r = e.carta.recompensa
  const tareas: NuevaTarea[] = []
  if (r.rep) tareas.push({ tipo: 'cambiarReputacion', n: r.rep })
  if (r.search) tareas.push({ tipo: 'buscarMuelle', filtro: r.search === 'crew' ? 'tripulante' : r.search === 'ship' ? 'mejoraBarco' : 'mejora' })
  if (r.draw) tareas.push({ tipo: 'robar', n: r.draw })
  const siguiente = /carta (\d+)/.exec(e.carta.textoSiguiente)?.[1]
  if (siguiente) {
    const num = Number(siguiente)
    const carta = s.zonas.mazoHistoria.find((c) => porId(copia(s, c).id).num === num)
    if (carta) {
      const tipo = porId(copia(s, carta).id).tipo
      if (tipo === 'tesoro') tareas.push({ tipo: 'ponerTesoro', carta })
      else {
        mover(s, carta, 'mazoMisiones')
        barajar(s, 'mazoMisiones')
        anotar(s, 'efecto', `«${nombre(s, carta)}» se baraja en el mazo de Misiones.`)
      }
    }
  }
  if (r.victoria) {
    s.resultado = { gana: true, motivo: `Has superado «${e.carta.nombre}».` }
    anotar(s, 'fin', '¡Has ganado la partida!')
  }
  encolar(s, ...tareas)
  return 'hecha'
}

/** Un Tesoro entra en juego sin coste: los de barco, en el Barco; los de tripulante, en quien elijas. */
export const ponerTesoro: Manejador<'ponerTesoro'> = (s, t, e) => {
  const e2 = porId(copia(s, t.carta).id)
  if (e2.tipo !== 'tesoro') return 'hecha'
  const vincular = (destino: InstId | 'barco') => {
    mover(s, t.carta, 'mejoras', 'abajo')
    copia(s, t.carta).vinculadaA = destino
    anotar(s, 'efecto', `Ganas el Tesoro «${e2.carta.nombre}» (${destino === 'barco' ? 'en el Barco' : `lo lleva ${nombre(s, destino)}`}).`)
  }
  if (e2.carta.tipo === 'Mejora de barco') {
    vincular('barco')
    return 'hecha'
  }
  const candidatos = [...s.zonas.tripulacion]
  if (candidatos.length === 1 && candidatos[0]) {
    vincular(candidatos[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'portadorTesoro', carta: e2.id }, candidatas: candidatos, min: 1, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) vincular(c)
  return 'hecha'
}

/** No superar la misión: se pierden los rehenes (−1 de reputación cada uno) y eliges si la dejas disponible. */
export const fallarMision: Manejador<'fallarMision'> = (s, t, e) => {
  const m = s.mision
  if (!m) return 'hecha'
  if (t.paso === 'rehenes') {
    const id = copia(s, m.carta).id
    const textos = { retirada: 'Te retiras de', hundida: 'El Barco se hunde: no superas', superada: '' }
    anotar(s, 'fin', `${textos[m.fin ?? 'retirada']} «${nombre(s, m.carta)}».`, { tipo: 'finMision', mision: id, resultado: m.fin ?? 'retirada' })
    copia(s, m.carta).avance = 0
    const tareas: NuevaTarea[] = []
    for (const h of [...s.zonas.rehenes]) {
      anotar(s, 'aviso', `Pierdes a ${nombre(s, h)}, que era rehén.`, { tipo: 'rehenPerdido', carta: copia(s, h).id })
      tareas.push({ tipo: 'sacarTripulante', carta: h, destino: 'fueraDeJuego', motivo: 'rehen' }, { tipo: 'cambiarReputacion', n: -1 })
    }
    encolar(s, ...tareas)
    t.paso = 'conservar'
    return 'sigue'
  }
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'conservarMision', carta: copia(s, m.carta).id },
      opciones: [
        { clave: 'dejar', texto: 'Dejarla disponible para otro turno' },
        { clave: 'fondo', texto: 'Ponerla al fondo del mazo de Misiones' },
      ],
    })
  }
  if (eleccionDe(e, 'opcion').clave === 'fondo') {
    mover(s, m.carta, 'mazoMisiones', 'abajo')
    anotar(s, 'efecto', `«${nombre(s, m.carta)}» va al fondo del mazo de Misiones.`)
  }
  return 'hecha'
}

/** Cierra la misión: aparta la superada, devuelve los Peligros y vuelve a puerto. */
export const cerrarMision: Manejador<'cerrarMision'> = (s) => {
  const m = s.mision
  if (!m) return 'hecha'
  if (m.fin === 'superada' && s.zonas.misionesDisponibles.includes(m.carta)) mover(s, m.carta, 'misionesSuperadas', 'abajo')
  devolverPeligros(s)
  s.mision = null
  s.prueba = null
  s.temporales = s.temporales.filter((x) => x.hasta !== 'finMision' && x.hasta !== 'finPrueba')
  for (const clave of Object.keys(s.usos)) if (clave.startsWith('mision:')) delete s.usos[clave]
  s.paso = 'quedarseOZarpar'
  anotar(s, 'efecto', 'Vuelves a puerto.')
  encolar(s, { tipo: 'reponerMisiones' })
  return 'hecha'
}
