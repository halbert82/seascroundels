// Zarpar, empezar la misión, recorrer sus cartas de Peligro y cerrarla (superada, retirada o hundida).

import { candidatas, sePuedeUsar } from '../usos.ts'
import { reputacionMinima } from '../capacidades/misiones.ts'
import { CATALOGO, iconosDe, porId, rasgosDe } from '../catalogo.ts'
import { reglasMision } from '../misiones2/registro.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { devolverPeligros, persigueVigente } from '../peligros.ts'
import { agotar } from '../estados.ts'
import { rescatarRehen } from './peligros2.ts'
import { numeroConIcono, textoDe } from '../textos.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { navParaDistancia, valor } from '../valores.ts'
import { barajar, mover, rebarajar } from '../zonas.ts'
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

/**
 * ¿Se puede zarpar a esta misión ahora? (reputación mínima y Distancia que se pueda cubrir). Fase 10: para cubrir una
 * Distancia hay que agotar al menos a un Tripulante preparado, aunque tenga NAV 0; las cartas con NAV solo completan.
 */
export function puedeZarpar(s: Estado, mision: InstId): boolean {
  if (s.reputacion < reputacionMinima(copia(s, mision).id)) return false
  const distancia = valor(s, { tipo: 'distancia', mision })
  // P3 (fase 10b): si lo que reduce la Distancia (el Barco, Vientos alisios) la deja en 0, no hay que agotar a nadie.
  return distancia === 0 || (preparados(s).length > 0 && navMaximo(s) >= distancia)
}

function empezar(s: Estado, mision: InstId): void {
  s.mision = { carta: mision, cartasResueltas: 0, mazoMezclado: false, fin: null, retirar: [], automatica: null }
  s.paso = 'mision'
  anotar(s, 'jugada', `Zarpas a «${nombre(s, mision)}».`, { tipo: 'zarpar', mision: copia(s, mision).id })
  encolar(s, { tipo: 'mision', paso: 'inicio' })
}

/**
 * Zarpar: si la misión es lejana, cubre su Distancia agotando a la vez a uno o más Tripulantes (al menos uno) y,
 * si hace falta, descartando cartas con NAV.
 */
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
    for (const c of tripulantes) agotar(s, c)
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

/** «Si zarpas este turno, empiezas la misión con…»: Rumores del tesoro (1, o 2 en un capítulo II o III) y San Juan (1). */
export function avanceInicialDelEscenario(s: Estado, mision: InstId): { n: number; motivo: string }[] {
  const lista: { n: number; motivo: string }[] = []
  const hay = (clave: string) => s.temporales.some((x) => x.clave === clave)
  if (hay('rumores.turno')) {
    const [uno = 1, dos = 2] = [...textoDe('rumores').matchAll(/\{(\d+) avance\}/g)].map((x) => Number(x[1]))
    lista.push({ n: /-(II|III)(-[ab])?$/.test(copia(s, mision).id) ? dos : uno, motivo: 'Rumores del tesoro' })
  }
  if (hay('sanjuan.turno')) lista.push({ n: numeroConIcono(textoDe('sanjuan'), 'avance'), motivo: 'Fiesta de San Juan' })
  return lista
}

export const mision: Manejador<'mision'> = (s, t) => {
  const m = s.mision
  if (!m) return 'hecha'
  switch (t.paso) {
    case 'inicio': {
      // Avance inicial: las fichas que ya tuviera (se quedan) y las de otras cartas.
      for (const extra of avanceInicialDelEscenario(s, m.carta)) ganar(s, extra.n, extra.motivo)
      const tareas: NuevaTarea[] = []
      // Las reglas de la misión: «Al zarpar» y «no puedes retirarte de esta misión».
      const reglas = reglasMision(copia(s, m.carta).id)
      if (reglas?.sinRetirada) m.sinRetirada = true
      tareas.push(...(reglas?.alZarpar?.(s) ?? []))
      // Las capacidades «Al zarpar» de tus cartas (Vela mayor, Chalupa) se aplican en el mismo momento.
      for (const [cap, fuente] of candidatas(s)) {
        if (cap.ventana === 'alZarpar' && cap.desde !== 'mision' && sePuedeUsar(s, cap, fuente)) tareas.push({ tipo: 'usar', uso: { fuente, clave: cap.clave }, evento: null, paso: 'coste' })
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

/** «Puedes agotar a un Oficial para ganar 2», «puedes descartar 2 cartas para mirar…»: opcionales, al zarpar. */
export const alZarparOpcional: Manejador<'alZarparOpcional'> = (s, t, e) => {
  const m = s.mision
  if (!m) return 'hecha'
  const misionId = copia(s, m.carta).id
  const efectos: NuevaTarea = { tipo: 'aplicarEfectos', efectos: t.efectos, contexto: 'efecto', fuente: m.carta }
  const coste = t.coste
  if (coste.tipo === 'agotarRasgo') {
    const candidatos = preparados(s).filter((c) => rasgosDe(copia(s, c).id).some((r) => coste.rasgos.includes(r)))
    if (candidatos.length === 0) return 'hecha'
    if (!e) {
      return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'alZarparAgotar', carta: misionId, texto: t.texto }, candidatas: candidatos, min: 0, max: 1 })
    }
    const [c] = eleccionDe(e, 'cartas').ids
    if (c) {
      agotar(s, c)
      anotar(s, 'pagar', `Agotas a ${nombre(s, c)} al zarpar.`)
      encolar(s, efectos)
    }
    return 'hecha'
  }
  if (s.zonas.mano.length < coste.n) return 'hecha'
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'alZarparDescartar', carta: misionId, n: coste.n, texto: t.texto },
      opciones: [
        { clave: 'si', texto: t.texto },
        { clave: 'no', texto: 'No' },
      ],
    })
  }
  if (eleccionDe(e, 'opcion').clave === 'si') encolar(s, { tipo: 'pagar', cantidad: coste.n, motivo: misionId }, efectos)
  return 'hecha'
}

/** «Baraja el mazo propio con N cartas del mazo de Peligros. Durante esta misión, revela de ese mazo.» */
// Las cartas del mazo propio de la travesía están en el mazo de historia (las que se retiraron, no vuelven).
export const mezclarMazoPropio: Manejador<'mezclarMazoPropio'> = (s, t) => {
  if (!s.mision) return 'hecha'
  const misionId = porId(copia(s, s.mision.carta).id)
  if (misionId.tipo !== 'capitulo') return 'hecha'
  const propias = new Set(CATALOGO.filter((e) => e.tipo === 'mazoPropio' && e.mision.id === misionId.mision.id).map((e) => e.id))
  for (const c of s.zonas.mazoHistoria.filter((x) => propias.has(copia(s, x).id))) mover(s, c, 'mazoMision')
  // La carta que persigue se queda en el mazo de Peligros: será el primer encuentro de todos modos.
  const persigue = persigueVigente(s)
  for (let i = 0; i < t.n; i++) {
    const libres = () => s.zonas.mazoPeligros.filter((c) => c !== persigue)
    if (libres().length === 0 && s.zonas.descartesPeligros.length > 0) rebarajar(s, 'descartesPeligros', 'mazoPeligros')
    const c = libres()[0]
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

/**
 * Superar la misión: rehenes rescatados, lo incautado vuelve, reputación y recompensa (o el final con elección),
 * Gesta, Pasajero, capítulo siguiente (con salida doble, el que toque) y Tesoro.
 */
export const superarMision: Manejador<'superarMision'> = (s) => {
  const m = s.mision
  if (!m) return 'hecha'
  const e = porId(copia(s, m.carta).id)
  if (e.tipo !== 'capitulo') return 'hecha'
  const reglas = reglasMision(e.id)
  anotar(s, 'fin', `¡Superas «${e.carta.nombre}»!`, {
    tipo: 'finMision',
    mision: e.id,
    resultado: 'superada',
    resueltas: m.cartasResueltas,
    avance: copia(s, m.carta).avance,
    necesario: valor(s, { tipo: 'avanceNecesario', mision: m.carta }),
  })
  // Lo que se mira de la misión antes de que cambie nada (Gesta, Tesoro, salida doble).
  const gesta = reglas?.gesta?.(s) ?? false
  const conTesoro = reglas?.conTesoro?.(s) ?? true
  const elegido = reglas?.siguiente?.(s)
  for (const h of [...s.zonas.rehenes]) rescatarRehen(s, h)
  const habiaIncautadas = s.zonas.incautadas.length > 0
  recuperarIncautadas(s)
  const r = e.carta.recompensa
  const tareas: NuevaTarea[] = []
  // «Si superas la misión, las recuperas y robas 2».
  if (habiaIncautadas && m.alRecuperar && m.alRecuperar.length > 0) tareas.push({ tipo: 'aplicarEfectos', efectos: m.alRecuperar, contexto: 'efecto' })
  if (r.elige && r.elige.length > 0) tareas.push({ tipo: 'elegirFinal', mision: m.carta })
  else if (r.rep) tareas.push({ tipo: 'cambiarReputacion', n: r.rep })
  if (gesta) {
    anotar(s, 'efecto', '¡Gesta cumplida!: +1 de reputación.', { tipo: 'gesta', mision: e.id })
    tareas.push({ tipo: 'cambiarReputacion', n: 1 })
  }
  if (r.search) tareas.push({ tipo: 'buscarMuelle', filtro: r.search === 'crew' ? 'tripulante' : r.search === 'ship' ? 'mejoraBarco' : 'mejora' })
  if (r.draw) tareas.push({ tipo: 'robar', n: r.draw })
  if (r.pasajero) tareas.push({ tipo: 'ponerPasajero', carta: r.pasajero })
  // Capítulo siguiente o Tesoro. Con salida doble se añade el que corresponda y el otro sale de la partida.
  const posibles = e.carta.siguiente
  const num = elegido ?? posibles[0]
  for (const otro of posibles.filter((n) => n !== num)) {
    const carta = s.zonas.mazoHistoria.find((c) => porId(copia(s, c).id).num === otro)
    if (carta) {
      mover(s, carta, 'fueraDeJuego')
      anotar(s, 'efecto', `«${nombre(s, carta)}» sale de la partida.`)
    }
  }
  if (num !== undefined && !(r.elige && r.elige.length > 0)) {
    const carta = s.zonas.mazoHistoria.find((c) => porId(copia(s, c).id).num === num)
    if (carta) {
      const tipo = porId(copia(s, carta).id).tipo
      if (tipo === 'tesoro') {
        if (conTesoro) tareas.push({ tipo: 'ponerTesoro', carta })
        else anotar(s, 'aviso', `No ganas el Tesoro «${nombre(s, carta)}».`)
      } else {
        mover(s, carta, 'mazoMisiones')
        barajar(s, 'mazoMisiones')
        anotar(s, 'efecto', `«${nombre(s, carta)}» se baraja en el mazo de Misiones.`)
      }
    }
  }
  tareas.push(...(reglas?.alSuperar?.(s) ?? []))
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
    // «Al entrar en juego, pon 3 fichas sobre esta carta» (Pólvora del Rey, fase 10b).
    const fichas = /Al entrar en juego, pon (\d+) fichas/.exec(e2.carta.texto)?.[1]
    if (fichas) copia(s, t.carta).fichas = Number(fichas)
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
    const reglas = reglasMision(id)
    const textos = { retirada: 'Te retiras de', hundida: 'El Barco se hunde: no superas', superada: '' }
    const texto = m.motivoFallo ? `La misión falla (${m.motivoFallo}): no superas` : textos[m.fin ?? 'retirada']
    const avance = copia(s, m.carta).avance
    anotar(s, 'fin', `${texto} «${nombre(s, m.carta)}».`, {
      tipo: 'finMision',
      mision: id,
      resultado: m.fin ?? 'retirada',
      resueltas: m.cartasResueltas,
      avance,
      necesario: valor(s, { tipo: 'avanceNecesario', mision: m.carta }),
      ...(m.motivoFallo ? { motivo: m.motivoFallo } : {}),
    })
    const tareas: NuevaTarea[] = []
    // Saqueo (La casa del gobernador): si te retiras por tu cuenta entre dos Peligros, cobras según tu Avance.
    if (m.fin === 'retirada' && m.retiradaVoluntaria && reglas?.alRetirarte) tareas.push(...reglas.alRetirarte(s, avance))
    copia(s, m.carta).avance = 0
    for (const h of [...s.zonas.rehenes]) {
      anotar(s, 'aviso', `Pierdes a ${nombre(s, h)}, que era rehén.`, { tipo: 'rehenPerdido', carta: copia(s, h).id })
      tareas.push({ tipo: 'sacarTripulante', carta: h, destino: 'fueraDeJuego', motivo: 'rehen' }, { tipo: 'cambiarReputacion', n: -1 })
    }
    tareas.push(...perderIncautadas(s))
    // Lo que pasa al no superarla («Don Anselmo se baja asustado»).
    tareas.push(...(reglas?.alNoSuperar?.(s) ?? []))
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

// Lo incautado (P9): las cartas de la mano las eliges tú; si superas la misión vuelven (una Mejora,
// a su portador; si ya no está, se descarta); si no, van fuera del juego. Un Tripulante incautado va con sus Mejoras.

/** Superaste la misión (o lo dice una carta): lo incautado vuelve a su sitio. */
export function recuperarIncautadas(s: Estado): void {
  for (const c of [...s.zonas.incautadas]) {
    const origen = s.incautadas?.[c]
    if (origen?.zona === 'tripulacion') mover(s, c, 'tripulacion', 'abajo')
    else if (origen?.zona === 'mejoras') {
      const portador = copia(s, c).vinculadaA
      if (portador === 'barco' || (portador !== null && s.zonas.tripulacion.includes(portador))) mover(s, c, 'mejoras', 'abajo')
      else {
        mover(s, c, 'descartesMuelle')
        anotar(s, 'efecto', `«${nombre(s, c)}» ya no tiene portador: se descarta.`)
        continue
      }
    } else mover(s, c, 'mano', 'abajo')
    anotar(s, 'efecto', `Recuperas ${porId(copia(s, c).id).tipo === 'tripulante' ? 'a ' + nombre(s, c) : `«${nombre(s, c)}»`}.`)
  }
}

/** No superaste la misión: lo incautado se pierde (fuera del juego, o a los descartes si la carta lo dice). */
function perderIncautadas(s: Estado): NuevaTarea[] {
  const tareas: NuevaTarea[] = []
  for (const c of [...s.zonas.incautadas]) {
    if (s.incautadas?.[c]?.siPierdes === 'descartar' && s.incautadas[c]?.zona === 'mano') {
      mover(s, c, 'descartesCapitan')
      anotar(s, 'aviso', `«${nombre(s, c)}», que estaba incautada, se descarta.`)
      continue
    }
    if (s.incautadas?.[c]?.zona === 'tripulacion') {
      anotar(s, 'aviso', `Pierdes a ${nombre(s, c)}, que estaba incautado.`)
      tareas.push({ tipo: 'sacarTripulante', carta: c, destino: 'fueraDeJuego', motivo: 'incautado' })
    } else {
      mover(s, c, 'fueraDeJuego')
      anotar(s, 'aviso', `Pierdes «${nombre(s, c)}», que estaba incautada.`)
    }
  }
  return tareas
}

/** Cierra la misión: aparta la superada, devuelve los Peligros y vuelve a puerto. */
export const cerrarMision: Manejador<'cerrarMision'> = (s) => {
  const m = s.mision
  if (!m) return 'hecha'
  if (m.fin === 'superada' && s.zonas.misionesDisponibles.includes(m.carta)) mover(s, m.carta, 'misionesSuperadas', 'abajo')
  // «La Armada te persigue» de la Flota III vuelve a apartarse aunque no haya llegado a salir.
  const apartar = m.alApartar
  if (apartar && (s.zonas.mazoPeligros.includes(apartar) || s.zonas.mazoMision.includes(apartar))) {
    if (s.persigue === apartar) s.persigue = null
    mover(s, apartar, 'mazoHistoria')
    anotar(s, 'efecto', `«${nombre(s, apartar)}» vuelve a apartarse.`)
  }
  // Las cartas de misión que estaban junto a ella («¡La guardia!») vuelven a apartarse.
  for (const c of [...s.zonas.cartasMision]) {
    mover(s, c, 'mazoHistoria', 'abajo')
    anotar(s, 'efecto', `«${nombre(s, c)}» vuelve a apartarse.`)
  }
  devolverPeligros(s)
  delete s.incautadas
  s.mision = null
  s.prueba = null
  // Lo que dura «hasta el final de la misión», «hasta que superes otra Prueba» o «mientras esta carta siga en juego».
  s.temporales = s.temporales.filter((x) => !['finMision', 'finPrueba', 'superarPrueba', 'carta'].includes(x.hasta))
  for (const clave of Object.keys(s.usos)) if (clave.startsWith('mision:')) delete s.usos[clave]
  s.paso = 'quedarseOZarpar'
  anotar(s, 'efecto', 'Vuelves a puerto.')
  encolar(s, { tipo: 'reponerMisiones' })
  return 'hecha'
}
