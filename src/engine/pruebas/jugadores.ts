// Jugadores automáticos para las pruebas masivas y el informe de equilibrio:
// - al azar: cualquier jugada legal;
// - con criterio: reglas sencillas de un jugador prudente (no es un jugador experto).

import { aleatorio, barajarLista, entero, sembrar } from '../azar.ts'
import { costeImpreso, destinoNaufragio, enroladoDe, esIndestructible, esUnica, iconosDe, porId, rasgosDe, tipoDe } from '../catalogo.ts'
import { DATOS, type CapituloDatos } from '../datos.ts'
import { destinoDe } from '../destinos.ts'
import type { Efecto } from '../efectos.ts'
import { copia, diasRestantes } from '../estado.ts'
import { entornoActual } from '../peligros.ts'
import { avanceSinSuperar, definicionEncuentro, quedaDe } from '../definiciones.ts'
import { buscadoEnCiudad, definicionActual, dificultadPrueba, modificadorDeDestino, prevision, problemaCompromiso, totalPrueba } from '../prueba.ts'
import { esVentaja } from '../infoEstados.ts'
import { estadosDe } from '../estados.ts'
import { numeroConIcono, primerNumero, textoDe } from '../textos.ts'
import { capacidadDe } from '../usos.ts'
import type { Accion, CartaId, Decision, Eleccion, Estado, InstId, Uso } from '../tipos.ts'
import { navParaDistancia, plazasLibres, valor, valorSinMinimo } from '../valores.ts'
import { cumple } from '../tareas/efectos.ts'
import { puedePrepararse } from '../tareas/peligros2.ts'
import { motivoSinSuperar } from '../misiones2/comun.ts'
import { tienesDelNaufragio } from '../misiones2/fase15.ts'

export type JugadorAutomatico = (s: Estado, d: Decision) => Eleccion

// ---------------------------------------------------------------------------
// Al azar

export function jugadorAlAzar(semilla: number | string): JugadorAutomatico {
  const azar = { azar: sembrar(`azar-${semilla}`) }
  return (_s, d) => {
    if (d.libres && d.libres.length > 0 && aleatorio(azar) < 0.2) return { tipo: 'usar', uso: d.libres[entero(azar, d.libres.length)]! }
    switch (d.tipo) {
      case 'ventanaAccion': {
        const terminar = d.acciones.find((a) => a.tipo === 'terminarPaso')
        if (terminar && aleatorio(azar) < 0.35) return { tipo: 'accion', accion: terminar }
        return { tipo: 'accion', accion: d.acciones[entero(azar, d.acciones.length)]! }
      }
      case 'elegirCartas': {
        const n = d.min + entero(azar, d.max - d.min + 1)
        const ids = [...d.candidatas]
        barajarLista(azar, ids)
        return { tipo: 'cartas', ids: ids.slice(0, n) }
      }
      case 'elegirOpcion':
        return { tipo: 'opcion', clave: d.opciones[entero(azar, d.opciones.length)]!.clave }
      case 'ofrecer':
        return aleatorio(azar) < 0.5 || d.usos.length === 0 ? { tipo: 'pasar' } : { tipo: 'usar', uso: d.usos[entero(azar, d.usos.length)]! }
      case 'repartir':
        return { tipo: 'reparto', n: repartoAlAzar(azar, d.cantidad, d.maximos) }
      case 'cubrirDistancia': {
        // Todos los preparados y todas las cartas. Casi siempre llega (el motor solo ofrece misiones alcanzables), pero no
        // siempre: agotar a uno puede bajar la NAV de los demás (semilla 7378, Diego). Entonces, el primer grupo que llegue.
        const cartas = d.cartas.reduce((n, c) => n + iconosDe(copia(_s, c).id, 'NAV'), 0)
        if (navParaDistancia(_s, d.tripulantes) + cartas >= d.distancia) return { tipo: 'cartas', ids: [...d.tripulantes, ...d.cartas] }
        for (let m = (1 << d.tripulantes.length) - 1; m > 0; m--) {
          const grupo = d.tripulantes.filter((_, i) => m & (1 << i))
          if (navParaDistancia(_s, grupo) + cartas >= d.distancia) return { tipo: 'cartas', ids: [...grupo, ...d.cartas] }
        }
        return { tipo: 'cartas', ids: [...d.tripulantes, ...d.cartas] }
      }
      case 'comprometer': {
        const opcion = entero(azar, d.opciones.length)
        const hab = d.opciones[opcion]!.hab
        const tripulantes = d.tripulantes.filter(() => aleatorio(azar) < 0.6)
        const cartas = tripulantes.length > 0 ? d.cartas.filter((c) => iconos(_s, c, hab) > 0 && aleatorio(azar) < 0.3) : []
        // Si el compromiso no vale (Asustado solo, Borracho, Sin ayuda…), prueba con uno solo o con nadie.
        if (problemaCompromiso(_s, definicionActual(_s), hab, tripulantes, cartas) === null) return { tipo: 'compromiso', opcion, tripulantes, cartas }
        const uno = d.tripulantes.find((c) => problemaCompromiso(_s, definicionActual(_s), hab, [c], []) === null)
        return { tipo: 'compromiso', opcion, tripulantes: uno && aleatorio(azar) < 0.7 ? [uno] : [], cartas: [] }
      }
    }
  }
}

function repartoAlAzar(azar: { azar: [number, number, number, number] }, cantidad: number, maximos: Partial<Record<InstId, number>>) {
  const n: Partial<Record<InstId, number>> = {}
  let resto = cantidad
  const destinos = Object.keys(maximos) as InstId[]
  barajarLista(azar, destinos)
  for (const inst of destinos) {
    const poner = Math.min(resto, maximos[inst] ?? 0)
    n[inst] = poner
    resto -= poner
  }
  return n
}

// ---------------------------------------------------------------------------
// Con criterio

function iconos(s: Estado, carta: InstId, hab: 'NAV' | 'COM' | 'EXP'): number {
  return iconosDe(copia(s, carta).id, hab)
}

function iconosTotales(s: Estado, carta: InstId): number {
  return iconos(s, carta, 'NAV') + iconos(s, carta, 'COM') + iconos(s, carta, 'EXP')
}

function vidaRestante(s: Estado, c: InstId): number {
  return valor(s, { tipo: 'vida', carta: c }) - copia(s, c).heridas
}

/**
 * Fase 14: lo que vale de menos un Enrolado, que se va pronto: 0,6 puntos menos por cada turno que le falte para llegar
 * a 3. Sus fichas cuentan turnos (se quita una al final de cada turno, también si se queda en puerto): con 1 ficha está
 * en su último turno.
 */
function ajustePalabrasClave(id: string, enrolado?: number): number {
  const fichas = enrolado ?? enroladoDe(id)
  return fichas === null ? 0 : -Math.max(0, 3 - fichas) * 0.6
}

/** Valor de un Tripulante en juego: sus habilidades (el Capitán vale mucho más: si cae, se pierde). */
function valorTripulante(s: Estado, c: InstId): number {
  if (c === s.capitan) return 100
  const t = copia(s, c)
  const e = porId(t.id)
  return e.tipo === 'tripulante' ? e.carta.NAV + e.carta.COM + e.carta.EXP + e.carta.vida * 0.5 + ajustePalabrasClave(t.id, t.enrolado) : 0
}

/** Lo que vale un Tripulante por sí mismo (sin contar lo que cuesta reclutarlo). */
function valorDeTripulante(id: string): number {
  const e = porId(id)
  if (e.tipo !== 'tripulante') return -99
  return e.carta.NAV + e.carta.COM + e.carta.EXP + e.carta.vida * 0.4 + (CAPACIDAD_TRIPULANTE[id] ?? 0) + ajustePalabrasClave(id)
}

function puntuacionTripulanteEnMuelle(id: string): number {
  const e = porId(id)
  if (e.tipo !== 'tripulante') return -99
  return valorDeTripulante(id) - e.carta.coste * 0.6
}

/**
 * Fase 14 · Despedir para hacer sitio. Con el barco lleno, despide al Tripulante que menos vale si en el muelle hay
 * uno claramente mejor (2 puntos más o más, con la misma valoración: habilidades, Vida y su capacidad) que puede pagar
 * dejándose 2 cartas en la mano. El que se queda vale también por la Vida que le queda y por sus Mejoras, que se irían
 * con él. Nunca despide al Capitán ni a un Enrolado (se va solo).
 */
function despidoQueConviene(s: Estado): InstId | null {
  if (plazasLibres(s) > 0) return null
  const mano = s.zonas.mano.length
  const enJuego = new Set(s.zonas.tripulacion.map((c) => copia(s, c).id))
  const nuevos = s.zonas.muelle
    .filter((c) => {
      const id = copia(s, c).id
      return porId(id).tipo === 'tripulante' && !(esUnica(id) && enJuego.has(id)) && mano - valor(s, { tipo: 'coste', carta: c }) >= 2
    })
    .map((c) => valorDeTripulante(copia(s, c).id))
  if (nuevos.length === 0) return null
  const quedarse = (c: InstId): number => {
    const t = copia(s, c)
    const e = porId(t.id)
    const vida = e.tipo === 'tripulante' ? e.carta.vida : 0
    const mejoras = s.zonas.mejoras.filter((m) => copia(s, m).vinculadaA === c && tipoDe(copia(s, m).id) !== 'tesoro').length
    return valorDeTripulante(t.id) - vida * 0.4 + vidaRestante(s, c) * 0.4 + mejoras * 1.5
  }
  const despedibles = s.zonas.tripulacion.filter((c) => c !== s.capitan && copia(s, c).enrolado === undefined && porId(copia(s, c).id).tipo === 'tripulante')
  if (despedibles.length === 0) return null
  const peor = despedibles.reduce((a, b) => (quedarse(b) < quedarse(a) ? b : a))
  return Math.max(...nuevos) - quedarse(peor) >= 2 ? peor : null
}

const MEJORAS_PREFERIDAS: Record<string, number> = {
  vela: 5,
  chalupa: 4,
  hamacas: 3,
  casco: 3,
  sable: 3,
  brujula: 3,
  catalejo: 3,
  bandera: 3,
  cruz: 3,
  carronadas: 3,
  velas_tormenta: 3,
  pistola: 3,
  escapulario: 3,
  bronce: 2,
  culebrina: 2,
  pedrero: 2,
  viveres: 2,
  amuleto: 2,
  patente: 2,
  coleto: 2,
  botica: 1,
  ron_reserva: 1,
}

/** Lo que vale de más un Tripulante por su capacidad, para reclutarlo. */
const CAPACIDAD_TRIPULANTE: Record<string, number> = {
  isabela: 2.5,
  herbolaria: 1,
  practico: 1,
  lengua: 0.5,
  fiador: 1,
  bartolome: 2,
  viejo_lobo: 1.5,
  matasanos: 1.5,
  reinaldo: 1.5,
  espadachin: 1,
  contrabandista: 1,
  baqueano: 1,
  carpintero: 1,
  grumete: 1,
  saqueador: 0.5,
  filibustero: 0.5,
  carne_canon: 0.5,
  galeote: 0.5,
  canonero: 0.5,
  vigia: 0.5,
  loro: 0.5,
}

/** Lo que vale para el jugador la victoria de «Las puertas de Panamá», en puntos de reputación. */
const VALOR_VICTORIA = 12
/** Cuánto pesa lo que queda de una cadena (ajustado jugando: más peso le hace jugar San Felipe y pierde más). */
const PESO_CADENA = 0.2

/** Reputación que da una misión al superarla (en un final con elección, la mejor opción). */
function reputacionDe(c: CapituloDatos): number {
  const r = c.recompensa
  // Fase 15: «El naufragio del San José» no da reputación, pero lo que se saca del mazo del naufragio (el cofre y la llave,
  // la culebrina, la campana, el diario, el doblón) vale para el jugador automático como 1.
  if (c.mazoNaufragio) return VALOR_NAUFRAGIO
  return Math.max(r.rep ?? 0, ...(r.elige ?? []).map((o) => o.rep ?? 0))
}

/** Lo que el jugador automático cree que vale el naufragio, en reputación (para elegir a qué misión zarpar). */
const VALOR_NAUFRAGIO = 1

/** Puntuación de una misión disponible para zarpar o para poner Avance. */
function puntuacionMision(s: Estado, m: InstId): number {
  const e = porId(copia(s, m).id)
  if (e.tipo !== 'capitulo') return -99
  const falta = Math.max(0, valor(s, { tipo: 'avanceNecesario', mision: m }) - copia(s, m).avance)
  const rep = reputacionDe(e.carta)
  const victoria = e.carta.recompensa.victoria ? 30 : 0
  // Lo que vale el resto de la cadena, si quedan turnos para terminarla (cada capítulo hay que sacarlo del mazo de Misiones y jugarlo).
  // Con salida doble, de los dos capítulos II solo se juega uno: cuenta el mejor.
  const orden = ['I', 'II', 'III', 'IV']
  const posteriores = orden
    .slice(orden.indexOf(e.carta.capitulo) + 1)
    .map((n) => e.mision.capitulos.filter((c) => c.capitulo === n))
    .filter((grupo) => grupo.length > 0)
  const futuro = posteriores.reduce((n, grupo) => n + Math.max(...grupo.map((c) => (c.recompensa.victoria ? VALOR_VICTORIA : reputacionDe(c)))), 0)
  const holgura = diasRestantes(s) - 2 * posteriores.length
  const cadena = futuro * Math.min(PESO_CADENA, Math.max(0, holgura / 10)) * 2.2
  const distancia = valor(s, { tipo: 'distancia', mision: m })
  const enMar = e.carta.entorno === 'mar' ? 0.5 : 0
  return rep * 2.2 + victoria + cadena - falta * 0.9 - distancia * 0.6 + enMar
}

/** Avance que se deja de ganar si no se supera la Prueba de este encuentro (Avance X / Y: X − Y). */
function avanceEnJuego(s: Estado, carta: InstId): number {
  // Una Prueba de una Acción (de un Tripulante, de «¡La guardia!»…) no da Avance de encuentro.
  if (s.prueba?.encuentro === carta && s.prueba.origen === 'accion') return 0
  const tipo = porId(copia(s, carta).id).tipo
  if (tipo !== 'peligro' && tipo !== 'mazoPropio') return 0
  const def = definicionEncuentro(s, carta)
  if (def.opciones.length === 0 || def.pone) return 0
  return Math.max(0, def.avance - avanceSinSuperar(s, def))
}

/** Lo que cuesta fallar: el recuadro rojo y el Avance que se deja de ganar. */
function peligroDeFallo(s: Estado, carta: InstId): number {
  const fallo = peligroDe(s.prueba?.encuentro === carta ? definicionActual(s).fallo : definicionEncuentro(s, carta).fallo)
  return fallo + PESO_AVANCE * avanceEnJuego(s, carta)
}

/**
 * Margen que conviene sumar sobre la dificultad para cubrir el Destino: 1 si fallar es suave y 2 si duele.
 * Las cartas de la mano solo se añaden al comprometer, antes de revelar el Destino.
 */
function margenDestino(s: Estado, encuentro: InstId): number {
  return peligroDeFallo(s, encuentro) >= 2 ? 2 : 1
}

/** Mejor compromiso: el grupo más barato que llega a la dificultad con margen, o nadie si no compensa. */
function elegirCompromiso(s: Estado, d: Extract<Decision, { tipo: 'comprometer' }>): Eleccion {
  const p = s.prueba
  const encuentro = p?.encuentro
  if (!encuentro) return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  const tripulantes = d.tripulantes
  // «Seguirle por Port Royal» (fase 12; antes «Seguirle por los muelles»): superar una Prueba de COM pone Sospecha; con
  // 2, mejor no comprometer a nadie.
  const m = s.mision
  if (m && copia(s, m.carta).id === 'espia-I' && (m.fichas?.sospecha ?? 0) >= 2 && d.opciones.every((o) => o.hab === 'COM')) {
    return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  }
  const margen = margenDestino(s, encuentro)
  let mejor: { coste: number; eleccion: Eleccion } | null = null
  for (let opcion = 0; opcion < d.opciones.length; opcion++) {
    const hab = d.opciones[opcion]!.hab
    const cartas = d.cartas.filter((c) => iconos(s, c, hab) > 0).sort((a, b) => iconos(s, b, hab) - iconos(s, a, hab))
    for (let mascara = 1; mascara < 1 << tripulantes.length; mascara++) {
      const grupo = tripulantes.filter((_, i) => mascara & (1 << i))
      if (problemaCompromiso(s, definicionActual(s), hab, grupo, []) !== null) continue
      const sinCartas = prevision(s, encuentro, opcion, grupo, [])
      // Margen para el Destino, que aún no se ha revelado (y ya no se puede reforzar después).
      const objetivo = sinCartas.dificultad + margen
      let total = sinCartas.total
      const usadas: InstId[] = []
      for (const c of cartas) {
        if (total >= objetivo) break
        usadas.push(c)
        total += iconos(s, c, hab)
      }
      if (total < sinCartas.dificultad) continue
      const coste =
        grupo.reduce((n, c) => n + (c === s.capitan ? 2.5 : 1 + valorTripulante(s, c) / 8), 0) + usadas.length * 0.8 - (total >= objetivo ? 0.5 : 0)
      if (!mejor || coste < mejor.coste) mejor = { coste, eleccion: { tipo: 'compromiso', opcion, tripulantes: grupo, cartas: usadas } }
    }
  }
  if (mejor) return mejor.eleccion
  // No llega: si el fallo es suave, no compromete a nadie; si duele, lo intenta con todo.
  if (peligroDeFallo(s, encuentro) < 2) return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  const hab = d.opciones[0]!.hab
  const def = definicionActual(s)
  let todos = [...tripulantes]
  // Con todo lo que valga: si no se puede con todos (Sin ayuda, «como mucho 2»…), con el mejor que se pueda.
  if (problemaCompromiso(s, def, hab, todos, []) !== null) {
    const mejores = [...tripulantes].sort((a, b) => valor(s, { tipo: 'habilidad', carta: b, hab }) - valor(s, { tipo: 'habilidad', carta: a, hab }))
    todos = []
    // Fase 15, «Descomunal N»: con menos de N no vale, pero se sigue sumando gente hasta llegar.
    for (const c of mejores) {
      const problema = problemaCompromiso(s, def, hab, [...todos, c], [])
      if (problema === null || problema.startsWith('Descomunal')) todos.push(c)
    }
    if (problemaCompromiso(s, def, hab, todos, []) !== null) todos = []
  }
  if (todos.length === 0) return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  return { tipo: 'compromiso', opcion: 0, tripulantes: todos, cartas: d.cartas.filter((c) => iconos(s, c, hab) > 0) }
}

function elegirCartas(s: Estado, d: Extract<Decision, { tipo: 'elegirCartas' }>): Eleccion {
  const n = d.min
  const por = (f: (c: InstId) => number) => [...d.candidatas].sort((a, b) => f(a) - f(b))
  switch (d.motivo.clave) {
    case 'cambiarMano':
    case 'descartarFinal':
      return { tipo: 'cartas', ids: [] }
    case 'pagar':
    case 'descartar':
      return { tipo: 'cartas', ids: por((c) => iconosTotales(s, c)).slice(0, n) }
    case 'herir':
      // Al que más vida le queda, sin el Capitán si se puede.
      return { tipo: 'cartas', ids: por((c) => (c === s.capitan ? 50 : 0) - vidaRestante(s, c)).slice(0, 1) }
    case 'agotar':
    case 'exceso':
    case 'desercion':
      return { tipo: 'cartas', ids: por((c) => valorTripulante(s, c)).slice(0, n) }
    case 'perderMejora':
    case 'agotarMejora':
      return { tipo: 'cartas', ids: por((c) => costeImpreso(copia(s, c).id)).slice(0, n) }
    case 'buscar':
      return { tipo: 'cartas', ids: por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id) - (MEJORAS_PREFERIDAS[copia(s, c).id] ?? 0)).slice(0, 1) }
    // Fase 15, el naufragio: baja el que más Vida conserva (sin dejar a nadie a tiro); al pulpo lo saca el que menos vale;
    // el diario trae el capítulo I que más le interesa y aparta la misión disponible que menos.
    case 'buzo': {
      const buzo = elegirBuzo(s, d.candidatas)
      return { tipo: 'cartas', ids: buzo ? [buzo] : d.candidatas.slice(0, 1) }
    }
    case 'pulpoAyuda':
      return { tipo: 'cartas', ids: por((c) => (vidaAlAgotarse(s, c) <= 0 ? 100 : 0) + valorTripulante(s, c)).slice(0, 1) }
    case 'diarioCapitulo':
      return { tipo: 'cartas', ids: por((c) => -puntuacionMision(s, c)).slice(0, 1) }
    case 'diarioCambiar':
      return { tipo: 'cartas', ids: por((c) => puntuacionMision(s, c)).slice(0, 1) }
    case 'soplos':
      return { tipo: 'cartas', ids: por((c) => -puntuacionMision(s, c)).slice(0, 1) }
    case 'tablon': {
      const malas = d.candidatas.filter((m) => puntuacionMision(s, m) < 0)
      return { tipo: 'cartas', ids: malas.slice(0, d.max) }
    }
    case 'alZarparAgotar': {
      const otros = d.candidatas.filter((c) => c !== s.capitan)
      return { tipo: 'cartas', ids: otros.slice(0, 1) }
    }
    case 'reclutaEncuentro': {
      const mejor = por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id))[0]
      return { tipo: 'cartas', ids: mejor && s.zonas.mano.length > costeImpreso(copia(s, mejor).id) ? [mejor] : [] }
    }
    case 'reasignarTesoro':
    case 'portadorTesoro':
    case 'preparar':
      return { tipo: 'cartas', ids: por((c) => -valorTripulante(s, c)).slice(0, 1) }
    case 'ordenarOteo':
      // Fase 10b: del mazo de Misiones, la mejor misión arriba; del de Peligros, el menos peligroso.
      if (d.candidatas.some((c) => porId(copia(s, c).id).tipo === 'capitulo')) return { tipo: 'cartas', ids: por((c) => -puntuacionMision(s, c)) }
      return { tipo: 'cartas', ids: por((c) => riesgoDelEncuentro(s, c)) }
    case 'alFondo':
      return { tipo: 'cartas', ids: por((c) => -riesgoDelEncuentro(s, c)).slice(0, n) }
    case 'naufrago':
    case 'reclutarGratis':
    case 'reclutarDelMazoMuelle':
      return { tipo: 'cartas', ids: por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id)).slice(0, 1) }
    case 'desviarHeridas':
      return { tipo: 'cartas', ids: por((c) => (c === s.capitan ? 50 : 0) - vidaRestante(s, c)).slice(0, 1) }
    case 'curarUno':
      return { tipo: 'cartas', ids: por((c) => (c === s.capitan && vidaRestante(s, c) <= 2 ? -50 : 0) - copia(s, c).heridas).slice(0, 1) }
    case 'entrenamiento':
    case 'prepararN':
      return { tipo: 'cartas', ids: por((c) => -valorTripulante(s, c)).slice(0, Math.max(n, 1)) }
    // Peligros 2.0
    case 'aQuien':
      // Lo malo, a quien más vida le quede (sin el Capitán); lo bueno, al mejor.
      if (d.motivo.texto?.startsWith('sufre')) return { tipo: 'cartas', ids: por((c) => (c === s.capitan ? 50 : 0) - vidaRestante(s, c)).slice(0, n) }
      if (/prepara|cura/.test(d.motivo.texto ?? '')) return { tipo: 'cartas', ids: por((c) => -valorTripulante(s, c)).slice(0, n) }
      // Fase 14: si el Capitán está entre los empatados para «se descarta», sufre 1 herida en su lugar (si la aguanta).
      if (d.motivo.texto === 'se descarta' && d.candidatas.includes(s.capitan) && vidaRestante(s, s.capitan) >= 2) return { tipo: 'cartas', ids: [s.capitan] }
      if (d.motivo.texto === 'se descarta') return { tipo: 'cartas', ids: por((c) => (c === s.capitan ? 200 : valorTripulante(s, c))).slice(0, n) }
      return { tipo: 'cartas', ids: por((c) => valorTripulante(s, c)).slice(0, n) }
    case 'ponerEstado':
    case 'agotarParaPagar':
    case 'agotarPago':
      return { tipo: 'cartas', ids: por((c) => valorTripulante(s, c)).slice(0, n) }
    case 'incautar':
    case 'descartarMayorCoste':
      return { tipo: 'cartas', ids: por((c) => (porId(copia(s, c).id).tipo === 'tripulante' ? valorTripulante(s, c) : iconosTotales(s, c))).slice(0, n) }
    case 'gratisDelMuelle':
    case 'mitadDelMuelle':
      return { tipo: 'cartas', ids: por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id) - (MEJORAS_PREFERIDAS[copia(s, c).id] ?? 0)).slice(0, 1) }
    case 'recuperarDescarte':
      return { tipo: 'cartas', ids: por((c) => -iconosTotales(s, c)).slice(0, n) }
    case 'portadorGratis':
      return { tipo: 'cartas', ids: por((c) => -valorTripulante(s, c)).slice(0, 1) }
    default:
      return { tipo: 'cartas', ids: d.candidatas.slice(0, n) }
  }
}

function elegirEnJugarCartas(s: Estado, acciones: readonly Accion[], opciones: OpcionesJugador): Eleccion {
  // Fase 14: con el barco lleno, despide al peor si en el muelle hay uno claramente mejor (después lo recluta).
  const despedir = opciones.despide ? despidoQueConviene(s) : null
  if (despedir && acciones.some((a) => a.tipo === 'despedir' && a.carta === despedir)) return { tipo: 'accion', accion: { tipo: 'despedir', carta: despedir } }
  const mano = s.zonas.mano.length
  let mejor: { puntos: number; accion: Accion } | null = null
  for (const a of acciones) {
    let puntos = -1
    if (a.tipo === 'reclutar') {
      const id = copia(s, a.carta).id
      if (mano - valor(s, { tipo: 'coste', carta: a.carta }) >= 2) puntos = 3 + puntuacionTripulanteEnMuelle(id)
    } else if (a.tipo === 'adquirir') {
      const id = copia(s, a.carta).id
      const base = MEJORAS_PREFERIDAS[id] ?? -1
      const portadorBueno = a.destino === 'barco' || a.destino === s.capitan || valorTripulante(s, a.destino) >= 4
      if (base > 0 && portadorBueno && mano - valor(s, { tipo: 'coste', carta: a.carta }) >= 2) puntos = base
    }
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { puntos, accion: a }
  }
  return { tipo: 'accion', accion: mejor?.accion ?? { tipo: 'terminarPaso' } }
}

/** La misión a la que zarparía entre estas (o null si se queda en puerto). */
function mejorZarpe(s: Estado, misiones: readonly InstId[]): InstId | null {
  const capitan = copia(s, s.capitan)
  const enPeligro = vidaRestante(s, s.capitan) <= 1 || s.danoBarco >= valor(s, { tipo: 'danoMaximo' }) - 1
  const tarde = s.ultimoTurno || diasRestantes(s) <= 1
  let mejor: { puntos: number; mision: InstId } | null = null
  for (const m of misiones) {
    const puntos = puntuacionMision(s, m)
    if (!mejor || puntos > mejor.puntos) mejor = { puntos, mision: m }
  }
  if (mejor && (tarde || (!enPeligro && mejor.puntos > -1.5) || (capitan.heridas === 0 && mejor.puntos > -3))) return mejor.mision
  return null
}

/**
 * Fase 13 (P76), «Arenga del capitán» («Respuesta: Después de zarpar, agota a tu Capitán…»): la juega si el Capitán sigue
 * preparado y le quedan 2 o más Tripulantes preparados además de él.
 */
function convieneArenga(s: Estado): boolean {
  if (copia(s, s.capitan).agotada) return false
  return s.zonas.tripulacion.filter((c) => c !== s.capitan && !copia(s, c).agotada).length >= 2
}

function elegirOpcion(s: Estado, d: Extract<Decision, { tipo: 'elegirOpcion' }>): Eleccion {
  const claves = d.opciones.map((o) => o.clave)
  const elegir = (clave: string) => ({ tipo: 'opcion' as const, clave })
  switch (d.motivo.clave) {
    case 'quedarseOZarpar': {
      const mision = mejorZarpe(
        s,
        claves.filter((c) => c.startsWith('zarpar:')).map((c) => c.slice(7) as InstId),
      )
      return elegir(mision ? `zarpar:${mision}` : 'quedarse')
    }
    case 'opcionPuerto': {
      const heridas = s.zonas.tripulacion.reduce((n, c) => n + copia(s, c).heridas, 0)
      // Fase 10b: curar ya no quita Estados; la Taberna y el Astillero, sí.
      const males = s.zonas.tripulacion.some((c) => (copia(s, c).estados ?? []).some((e) => !esVentaja(e)))
      const barco = (s.estadosBarco ?? []).length > 0
      const preferidas = [heridas > 0 || males ? 'taberna' : '', s.danoBarco > 0 || barco ? 'astillero' : '', 'propia', 'tablon', 'taberna', 'astillero']
      return elegir(preferidas.find((p) => p && claves.includes(p)) ?? claves[0]!)
    }
    case 'alZarparDescartar':
      return elegir(s.zonas.mano.length >= 4 ? 'si' : 'no')
    case 'otear': {
      const tarea = tareaDe(s, d)
      const carta = tarea?.tipo === 'otear' ? tarea.cartas[0] : undefined
      // Fase 10b: del mazo de Misiones, deja arriba las que le convienen.
      if (tarea?.tipo === 'otear' && tarea.mazo === 'misiones') return elegir(carta && puntuacionMision(s, carta) > 0 ? 'arriba' : 'fondo')
      return elegir(carta && riesgoDelEncuentro(s, carta) >= 1.5 ? 'fondo' : 'arriba')
    }
    case 'opcionAutomatica': {
      const def = s.prueba ? definicionActual(s) : null
      const com = def ? def.opciones.findIndex((o) => o.hab === 'COM') : -1
      return elegir(String(Math.max(0, com)))
    }
    // Peligros 2.0
    case 'elige': {
      // Cada opción vale lo que cuesta pagarla más el riesgo de su Prueba (si la tiene): elige la más barata.
      const carta = s.zonas.encuentro[0]
      const def = carta ? definicionEncuentro(s, carta) : null
      if (!carta || !def?.elige) return elegir(claves[0]!)
      const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
      const iconosMano = (hab: 'NAV' | 'COM' | 'EXP') => s.zonas.mano.reduce((n, c) => n + iconos(s, c, hab), 0)
      const coste = (clave: string) => {
        const o = def.elige?.[Number(clave)]
        if (!o) return 99
        const pago = peligroDe(o.efectos ?? [])
        if (!o.prueba) return pago
        const extra = (o.modDificultad ?? 0) + (o.modSi && cumple(s, o.modSi.condicion) ? o.modSi.n : 0)
        const margen =
          def.opciones.length > 0
            ? Math.max(...def.opciones.map((op) => preparados.reduce((n, c) => n + valor(s, { tipo: 'habilidad', carta: c, hab: op.hab }), 0) + iconosMano(op.hab) / 2 - op.dificultad - extra))
            : -9
        // Pagar cuenta como superarla (Avance entero); con la Prueba, si fallas, ganas menos.
        const perdida = PESO_AVANCE * avanceEnJuego(s, carta)
        const riesgo =
          margen >= 2 ? 0.3 + perdida * 0.1 : margen >= 0 ? 1.2 + perdida * 0.4 : 2 + Math.min(4, -margen) + peligroDe(def.fallo) / 2 + perdida * 0.9
        return pago + riesgo
      }
      return elegir([...claves].sort((a, b) => coste(a) - coste(b))[0]!)
    }
    case 'vendaval':
      return elegir(claves.find((c) => c === 'descartar' && s.zonas.mano.length >= 3) ?? claves.find((c) => c === 'agotar') ?? claves[0]!)
    case 'agotarPago':
      return elegir(claves.includes('rasgo') ? 'rasgo' : claves[0]!)
    case 'habilidadEntrenamiento': {
      const tarea = tareaDe(s, d)
      const quien = tarea?.tipo === 'ponerEntrenamiento' ? tarea.carta : null
      if (!quien) return elegir(claves[0]!)
      const habs = ['NAV', 'COM', 'EXP'] as const
      const mejor = [...habs].sort((a, b) => valor(s, { tipo: 'habilidad', carta: quien, hab: b }) - valor(s, { tipo: 'habilidad', carta: quien, hab: a }))[0]!
      return elegir(mejor)
    }
    case 'conservarMision':
      return elegir('dejar')
    // Fase 15
    case 'bucear':
      return elegir(convieneBucear(s) ? 'bucear' : 'subir')
    // El pulpo: lo sacan entre dos si hay alguien preparado a quien agotarse no le derrote; si no, que se suelte solo.
    case 'pulpo':
      return elegir(ayudaContraElPulpo(s) ? 'dos' : 'solo')
    case 'desviarAProtegido':
      return elegir(String(cuantoDesviar(s, d) ?? 1))
    case 'elegirEfectos': {
      // Fase 8: los «Elige» de las cartas de Escenario. Las opciones se numeran como en la carta («0», «1»); si solo
      // queda una, el motor no pregunta.
      const mano = s.zonas.mano.length
      const coste = (c: InstId) => costeImpreso(copia(s, c).id)
      switch (d.motivo.carta) {
        case 'impuestos': {
          // Se pierde la Mejora de mayor coste: solo compensa si vale menos que 2 cartas (coste 1 o menos).
          const perdibles = s.zonas.mejoras.filter((m) => !esIndestructible(copia(s, m).id))
          const masCara = Math.max(0, ...perdibles.map(coste))
          return elegir(masCara <= 1 ? '1' : '0')
        }
        case 'desercion': {
          // Pagar la soldada si cuesta menos que volver a reclutar al desertor y reponer sus Mejoras.
          const soldada = Math.min(3, s.zonas.tripulacion.length)
          const candidatos = s.zonas.tripulacion.filter((c) => c !== s.capitan)
          const menor = Math.min(...candidatos.map(coste))
          const desertor = candidatos.find((c) => coste(c) === menor)
          const valorDesertor = desertor ? menor + s.zonas.mejoras.filter((m) => copia(s, m).vinculadaA === desertor).reduce((n, m) => n + coste(m), 0) : 0
          return elegir(soldada <= valorDesertor && mano > soldada ? '0' : '1')
        }
        case 'armada_patrulla':
          // Albert (fase 8): soborna (1 carta) si no tiene preparado ningún Tripulante con NAV 3 o más; si lo tiene,
          // pone La Armada encima del mazo.
          return elegir(tieneNavegante(s, 3) ? '1' : '0')
        case 'ribera':
          return elegir(s.danoBarco >= 2 ? '0' : '1')
        case 'p2_respiro':
          // Fase 15, «Un respiro»: descansa (pierde 2 de Avance) si la tripulación está agotada o tocada y aún le queda
          // camino; si no, sigue (+1 de Avance). La opción «0» es Descansar, la «1», Seguir.
          return elegir(claves.includes('0') && convieneDescansar(s) ? '0' : (claves.find((c) => c !== '0') ?? claves[0]!))
        default:
          // Vía de agua (fase 10b): achica (agota a uno) si el Barco está cerca de hundirse o sobra gente preparada.
          // Carpintero (fase 10b): tapa la Vía de agua salvo que el Barco esté a punto de hundirse.
          const tapar = d.opciones.find((o) => o.texto.startsWith('Quita Vía de agua'))
          if (tapar) {
            const reparar = d.opciones.find((o) => o !== tapar)!.clave
            return elegir(valor(s, { tipo: 'danoMaximo' }) - s.danoBarco <= 1 ? reparar : tapar.clave)
          }
          if (d.opciones.some((o) => o.texto.startsWith('Achicar'))) {
            const margen = valor(s, { tipo: 'danoMaximo' }) - s.danoBarco
            const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length
            const achicar = d.opciones.find((o) => o.texto.startsWith('Achicar'))!.clave
            const dano = d.opciones.find((o) => !o.texto.startsWith('Achicar'))!.clave
            return elegir(margen <= 2 || preparados >= 3 ? achicar : dano)
          }
          return elegir(claves[0]!)
      }
    }
    case 'finalMision': {
      // Final con elección: la reputación cuenta lo que da; un Tesoro vale más cuanto antes llegue; Maldito o
      // Perseguido restan un poco.
      const e = d.motivo.carta ? porId(d.motivo.carta) : null
      const opciones = e?.tipo === 'capitulo' ? (e.carta.recompensa.elige ?? []) : []
      const quedan = diasRestantes(s)
      // Con días por delante, un Tesoro vale como 3 de reputación (si empatan, la primera opción, que es la del Tesoro).
      const tesoro = quedan >= 3 ? 3 : quedan >= 1 ? 1.5 : 0
      const valorDe = (clave: string) => {
        const o = opciones.find((x) => x.clave === clave)
        if (!o) return -99
        const malo = /Maldito|Perseguido/.test(o.efecto ?? '') && !/quita/i.test(o.efecto ?? '') ? 1 : 0
        const objetivo = s.reputacionObjetivo - s.reputacion
        // Si la reputación de una opción da la victoria, esa.
        if ((o.rep ?? 0) >= objetivo) return 100 + (o.rep ?? 0)
        return (o.rep ?? 0) + (o.tesoro ? tesoro : 0) - malo
      }
      return elegir([...claves].sort((a, b) => valorDe(b) - valorDe(a))[0]!)
    }
    // Fase 13: con dos Destinos («Bruma en la selva»), cancela (o cambia) el peor.
    case 'cancelarCualDestino':
    case 'cambiarCualDestino': {
      const p = s.prueba
      if (!p?.hab) return elegir(claves[0]!)
      const hab = p.hab
      const peor = (c: string) => {
        const m = modificadorDeDestino(s, c as InstId, p.encuentro, hab)
        return m === 'fallo' ? 99 : m
      }
      return elegir([...claves].sort((a, b) => peor(b) - peor(a))[0]!)
    }
    default:
      return elegir(claves[0]!)
  }
}

function repartir(s: Estado, d: Extract<Decision, { tipo: 'repartir' }>): Eleccion {
  const n: Partial<Record<InstId, number>> = {}
  let resto = d.cantidad
  const destinos = Object.keys(d.maximos) as InstId[]
  if (d.motivo.clave === 'heridas') {
    // Una a una, a quien más vida le quede (el Capitán, el último). Fase 10: con las heridas libres puede elegir entre
    // todos; antes que a un Tripulante preparado, a uno ya agotado (el preparado aún puede servir este turno).
    const recibidas: Partial<Record<InstId, number>> = {}
    const prioridad = (c: InstId) => vidaRestante(s, c) - (recibidas[c] ?? 0) + (copia(s, c).agotada ? 100 : 0) - (c === s.capitan ? 500 : 0)
    while (resto > 0) {
      const objetivo = [...destinos].sort((a, b) => prioridad(b) - prioridad(a))[0]
      if (!objetivo) break
      recibidas[objetivo] = (recibidas[objetivo] ?? 0) + 1
      resto--
    }
    return { tipo: 'reparto', n: recibidas }
  }
  // Curar: primero al Capitán. Munición: en orden.
  destinos.sort((a, b) => (a === s.capitan ? -1 : b === s.capitan ? 1 : 0))
  for (const inst of destinos) {
    const poner = Math.min(resto, d.maximos[inst] ?? 0)
    n[inst] = poner
    resto -= poner
  }
  return { tipo: 'reparto', n }
}

function cubrirDistancia(s: Estado, d: Extract<Decision, { tipo: 'cubrirDistancia' }>): Eleccion {
  let mejor: { coste: number; ids: InstId[] } | null = null
  const cartas = [...d.cartas].sort((a, b) => iconos(s, b, 'NAV') - iconos(s, a, 'NAV'))
  // Fase 10: al menos un Tripulante (la máscara vacía no vale).
  for (let mascara = 1; mascara < 1 << d.tripulantes.length; mascara++) {
    const grupo = d.tripulantes.filter((_, i) => mascara & (1 << i))
    let nav = navParaDistancia(s, grupo)
    const usadas: InstId[] = []
    for (const c of cartas) {
      if (nav >= d.distancia) break
      usadas.push(c)
      nav += iconos(s, c, 'NAV')
    }
    if (nav < d.distancia) continue
    const coste = grupo.reduce((n, c) => n + (c === s.capitan ? 4 : 1 + valorTripulante(s, c) / 6), 0) + usadas.length
    if (!mejor || coste < mejor.coste) mejor = { coste, ids: [...grupo, ...usadas] }
  }
  return { tipo: 'cartas', ids: mejor?.ids ?? [...d.tripulantes, ...d.cartas] }
}

function ventana(s: Estado, d: Extract<Decision, { tipo: 'ventanaAccion' }>, opciones: OpcionesJugador): Eleccion {
  const terminar: Eleccion = { tipo: 'accion', accion: { tipo: 'terminarPaso' } }
  switch (d.motivo.clave) {
    case 'jugarCartas':
      return elegirEnJugarCartas(s, d.acciones, opciones)
    case 'ventanaPrueba': {
      // Sin refuerzo: las cartas de la mano ya se añadieron al comprometer.
      return terminar
    }
    case 'trasEncuentro': {
      const m = s.mision
      if (!m) return terminar
      // Si la misión aún no se puede superar (falta una Prueba de NAV o EXP, quedan fichas de Defensa…), aunque tenga
      // el Avance le queda trabajo: cuenta como si le faltaran 2.
      const avanceQueFalta = valor(s, { tipo: 'avanceNecesario', mision: m.carta }) - copia(s, m.carta).avance
      const falta = motivoSinSuperar(s) ? Math.max(2, avanceQueFalta) : avanceQueFalta
      const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length
      const iconosMano = s.zonas.mano.reduce((n, c) => n + iconosTotales(s, c), 0)
      const enMar = porId(copia(s, m.carta).id).tipo === 'capitulo' && encuentroEnMar(s)
      const barcoMal = enMar && s.danoBarco >= valor(s, { tipo: 'danoMaximo' }) - 2 && falta > 1
      const capitanMal = vidaRestante(s, s.capitan) <= 1 && falta > 1
      const sinFuerzas = preparados === 0 && iconosMano < 3 && falta >= 2
      // «El polvorín»: con 3 de Mecha, si el siguiente Peligro no basta para superarla, estalla (2 heridas y retirada).
      const mecha = copia(s, m.carta).id === 'sanfelipe-III' && (m.fichas?.mecha ?? 0) >= 3 && falta >= 3
      const retirada = d.acciones.find((a) => a.tipo === 'retirarse')
      if (retirada && (barcoMal || capitanMal || sinFuerzas || mecha)) return { tipo: 'accion', accion: retirada }
      return terminar
    }
    default:
      return terminar
  }
}

function encuentroEnMar(s: Estado): boolean {
  const m = s.mision
  if (!m) return false
  const e = porId(copia(s, m.carta).id)
  return e.tipo === 'capitulo' && e.carta.entorno === 'mar'
}


// ---------------------------------------------------------------------------
// Capacidades: cuándo le sale a cuenta usar cada una

/** Cuánto pesa cada punto de Avance que se deja de ganar al fallar, frente a una herida (1,5). */
const PESO_AVANCE = 0.75

function peligroDe(efectos: readonly Efecto[]): number {
  let peligro = 0
  for (const e of efectos) {
    if (e.tipo === 'heridas') peligro += e.n * 1.5
    else if (e.tipo === 'dano') peligro += e.n * 1.2
    else if (e.tipo === 'perderAvance') peligro += e.n === 'todo' ? 3 : e.n
    else if (e.tipo === 'aQuien') peligro += e.hacer.tipo === 'heridas' ? e.hacer.n * 1.5 : e.hacer.tipo === 'descartar' || e.hacer.tipo === 'alMuelle' ? 3 : e.hacer.tipo === 'estado' ? 1 : 0.5
    else if (e.tipo === 'estado' || e.tipo === 'estadoBarco' || e.tipo === 'incautar' || e.tipo === 'ocuparMuelle' || e.tipo === 'retirarse') peligro += 1.5
    else if (e.tipo === 'si' || e.tipo === 'porCada') peligro += peligroDe(e.tipo === 'si' ? e.entonces : e.efectos) * (e.tipo === 'porCada' ? 1.5 : 1)
    else if (e.tipo === 'elegir') peligro += Math.min(...e.opciones.map((o) => peligroDe(o.efectos)), 3)
    else if (
      ['robar', 'curar', 'reparar', 'recluta', 'sinFallo', 'seRetira', 'ganarAvance', 'prepararCanones', 'preparar', 'gratisDelMuelle', 'reclutarDelMazoMuelle', 'recuperarIncautadas', 'recuperarDescarte', 'mirarOrdenar', 'quitarEstado', 'quitarEstadoBarco', 'alFondo'].includes(e.tipo)
    )
      peligro += 0
    else peligro += 0.5
  }
  return peligro
}

/** Lo que puede costar una carta de Peligro revelada: 0 si es fácil o inofensiva. */
function riesgoDelEncuentro(s: Estado, carta: InstId): number {
  if (!s.mision) return 0
  const enc = definicionEncuentro(s, carta)
  if (enc.pone) return 2
  if (enc.opciones.length === 0) return peligroDe(enc.efecto)
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  let margen = -99
  for (let i = 0; i < enc.opciones.length; i++) {
    const o = enc.opciones[i]!
    const cartas = s.zonas.mano.filter((c) => iconos(s, c, o.hab) > 0)
    const { total, dificultad } = prevision(s, carta, i, preparados, cartas)
    margen = Math.max(margen, total - dificultad)
  }
  // Superarla comprometiendo a todos también cuesta: deja a la tripulación agotada para lo que venga.
  const peligro = peligroDe(enc.fallo) + (enc.abordaje ? 3 : 0) + PESO_AVANCE * avanceEnJuego(s, carta)
  if (preparados.length === 0 || margen < 1) return peligro
  if (margen < 3) return peligro * 0.6
  return 0
}

/** ¿El Destino revelado (aún sin aplicar) estropea la Prueba o hiere a alguien? */
function destinoMalo(s: Estado): boolean {
  const p = s.prueba
  if (!p?.destino || !p.hab || p.destinoCancelado) return false
  const mod = modificadorDeDestino(s, p.destino, p.encuentro, p.hab)
  if (mod === 'fallo') return true
  const d = destinoDe(copia(s, p.destino).id)
  const comprometidos = participantesDe(s)
  if ((d.heridaComprometido || d.heridaMasFuerte) && comprometidos.length > 0) return true
  if (comprometidos.length === 0 && d.sinOposicion.length > 0 && peligroDe(d.sinOposicion) > 0) return true
  const total = totalPrueba(s)
  const sinDestino = dificultadPrueba(s)
  return mod >= 2 || (total >= sinDestino && total < sinDestino + mod)
}

function participantesDe(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

function sucesoPendiente(s: Estado, d: Decision) {
  const tarea = s.pila.find((x) => x.id === d.tarea)
  return tarea?.tipo === 'evento' ? tarea.ev : null
}

function heridosTotales(s: Estado): number {
  return s.zonas.tripulacion.reduce((n, c) => n + copia(s, c).heridas, 0)
}

function faltaAvance(s: Estado): number {
  if (!s.mision) return 0
  return valor(s, { tipo: 'avanceNecesario', mision: s.mision.carta }) - copia(s, s.mision.carta).avance
}

/** Puntos de usar ahora esta capacidad (0 o menos: no la usa). */
/** Capacidades que empiezan una Prueba (la de una Acción). */
const PRUEBAS_DE_ACCION = new Set(['guardia.quitar0', 'pm_ojos.accion0', 'a_por_ellos.jugar'])

function empiezaUnaPrueba(s: Estado, uso: Uso): boolean {
  if (PRUEBAS_DE_ACCION.has(uso.clave)) return true
  const i = /\.quitar(\d+)$/.exec(uso.clave)?.[1]
  return i !== undefined && uso.fuente !== null && quedaDe(s, uso.fuente)?.quitar[Number(i)]?.tipo === 'prueba'
}

/** La última Prueba de la misión fue la de una Acción y se falló: no se repite hasta resolver otro encuentro. */
function acabaDeFallarUnaAccion(s: Estado): boolean {
  const ultima = s.mision?.pruebas?.at(-1)
  return ultima !== undefined && !ultima.encuentro && !ultima.superada
}

function puntuarUso(s: Estado, uso: Uso, d: Decision): number {
  const p = s.prueba
  const ev = sucesoPendiente(s, d)
  const mano = s.zonas.mano.length
  const fuente = uso.fuente
  const enMision = s.mision !== null && !s.mision.fin
  const trasEncuentro = d.motivo.clave === 'trasEncuentro'
  if (trasEncuentro && acabaDeFallarUnaAccion(s) && empiezaUnaPrueba(s, uso)) return 0
  const enPruebaAbierta = p !== null && p.hab !== null && !p.automatica
  const carta = s.zonas.encuentro[0]
  switch (uso.clave) {
    // Curar y reparar
    case 'carpintero.reparar':
      return s.danoBarco > 0 || (s.estadosBarco ?? []).includes('viaDeAgua') ? 2 : 0
    case 'reparacion.jugar':
      return s.danoBarco >= 2 ? 2 : 0
    case 'matasanos.curar':
      return heridosTotales(s) > 0 ? 2 : 0
    case 'vendas.jugar':
      return heridosTotales(s) >= 2 || vidaRestante(s, s.capitan) <= 2 ? 2 : 0
    case 'botica.curar':
      return heridosTotales(s) > 0 && (vidaRestante(s, s.capitan) <= 2 || mano >= 4) ? 1 : 0
    case 'ron_descanso.jugar':
      return d.motivo.clave === 'jugarCartas' && heridosTotales(s) >= 3 ? 1 : 0
    case 'ron_reserva.beber': {
      const portador = fuente ? copia(s, fuente).vinculadaA : null
      if (!portador || portador === 'barco') return 0
      return (trasEncuentro && copia(s, portador).agotada && faltaAvance(s) > 0) || vidaRestante(s, portador) <= 1 ? 1 : 0
    }
    // Cañones (fase 10b: se preparan en vez de recargar)
    case 'canonero.preparar':
    case 'polvora_c.jugar':
      return 1
    case 'polvora_rey.disparo':
      return 3
    // Otear y preparar
    case 'vigia.otear':
    case 'taberna.jugar':
      return enMision && trasEncuentro ? 1 : 0
    case 'despachos.otear':
      return 1
    case 'viveres.preparar':
      return trasEncuentro && faltaAvance(s) > 0 && s.zonas.tripulacion.filter((c) => copia(s, c).agotada).length >= 2 ? 2 : 0
    case 'arriba.jugar':
      return trasEncuentro && faltaAvance(s) > 0 ? 2 : 0
    case 'trampa.jugar':
      return enMision && entornoActual(s) === 'nat' ? 1 : 0
    // En puerto
    case 'botin.jugar':
      return d.motivo.clave === 'jugarCartas' && mano >= 3 ? 1 : 0
    case 'naufrago.jugar':
      return d.motivo.clave === 'jugarCartas' && plazasLibres(s) >= 1 && mano >= 3 ? 1 : 0
    case 'capitan2.agotar':
      return d.motivo.clave === 'jugarCartas' && plazasLibres(s) >= 1 && s.zonas.muelle.some((c) => porId(copia(s, c).id).tipo === 'tripulante') ? 1 : 0
    // Sumar en la Prueba (solo si hace falta)
    case 'filibustero.furia':
    case 'galeote.esfuerzo':
    case 'carne_canon.esfuerzo': {
      // Fase 14: solo si le falta poco para superarla y la herida no lo derrota. La Carne de cañón da +1 a cada uno de
      // los demás asignados; el Filibustero (COM) y el Galeote (NAV), +2 a sí mismos.
      const hab = uso.clave === 'galeote.esfuerzo' ? 'NAV' : 'COM'
      if (!enPruebaAbierta || p?.hab !== hab || !fuente || !participantesDe(s).includes(fuente) || p.falla) return 0
      const suma = uso.clave === 'carne_canon.esfuerzo' ? participantesDe(s).filter((c) => c !== fuente).length : 2
      const total = totalPrueba(s)
      const dificultad = dificultadPrueba(s)
      return suma > 0 && total < dificultad && total + suma >= dificultad && vidaRestante(s, fuente) >= 2 ? 3 : 0
    }
    case 'bronce.disparar':
    case 'culebrina.disparar':
    case 'culebrina_sanjose.disparar':
    case 'pistola.disparar': {
      if (!enPruebaAbierta || !p || p.falla) return 0
      if (uso.clave !== 'pistola.disparar' && (p.sinCanones || valor(s, { tipo: 'sinCanones' }) > 0)) return 0
      const total = totalPrueba(s)
      const dificultad = dificultadPrueba(s)
      return total < dificultad ? (total + 2 >= dificultad ? 3 : 1) : 0
    }
    case 'carronadas.disparar':
      return 3
    case 'todos.jugar':
      return p && participantesDe(s).length >= 2 && totalPrueba(s) < dificultadPrueba(s) + 1 ? 2 : 0
    // Heridas, daño y derrotas
    case 'grumete.salvar':
    case 'ni_hombre.jugar': {
      if (ev?.tipo !== 'heridas') return 0
      const muere = vidaRestante(s, ev.objetivo) <= ev.cantidad
      const capitan = ev.objetivo === s.capitan
      if (uso.clave === 'grumete.salvar') {
        const grumete = fuente ? valorTripulante(s, fuente) : 0
        return (muere && valorTripulante(s, ev.objetivo) > grumete) || (capitan && vidaRestante(s, s.capitan) <= ev.cantidad + 1) ? 5 : 0
      }
      const otro = participantesDe(s).some((c) => c !== ev.objetivo && c !== s.capitan && vidaRestante(s, c) > ev.cantidad)
      return (muere || capitan) && otro ? 4 : 0
    }
    case 'isabela.salvar':
    case 'amuleto.salvar':
      return 10
    case 'mascaron.evitar':
      // Una vez por misión: mejor gastarlo que guardarlo.
      return ev?.tipo === 'danoBarco' ? 4 : 0
    // Respuestas que solo dan ventaja
    case 'saqueador.superar':
    case 'contrabandista.superar':
    case 'baqueano.superar':
    case 'animo.jugar':
      return 3
    case 'mapa.jugar':
    case 'senda.jugar':
    case 'leccion.jugar':
      return mano >= 2 ? 2 : 0
    case 'viento.jugar':
      return mano >= 2 && faltaAvance(s) > 0 ? 2 : 0
    case 'prisionero.jugar':
      return mano >= 2 ? 2 : 0
    // Destinos
    case 'loro.unirse': {
      if (!p?.hab || !fuente) return 0
      if (participantesDe(s).length === 0) return 2
      return totalPrueba(s) < dificultadPrueba(s) + 1 && valor(s, { tipo: 'habilidad', carta: fuente, hab: p.hab }) > 0 ? 2 : 0
    }
    case 'viejo_lobo.destino':
    case 'farol.destino':
    case 'escapulario.cancelar':
    case 'espada.cancelar':
      return destinoMalo(s) ? 3 : 0
    case 'reflejos.jugar':
      return mano >= 2 && destinoMalo(s) ? 3 : 0
    case 'retirada.jugar': {
      if (!p?.destino || !p.hab || mano < 2) return 0
      const mod = modificadorDeDestino(s, p.destino, p.encuentro, p.hab)
      const hab = p.hab
      const posibles = participantesDe(s).length > 0 ? s.zonas.mano.reduce((n, c) => n + iconos(s, c, hab), 0) : 0
      const perdida = mod === 'fallo' || participantesDe(s).length === 0 || totalPrueba(s) + posibles < dificultadPrueba(s) + mod
      return perdida && peligroDeFallo(s, p.encuentro) >= 2 ? 3 : 0
    }
    // Encuentros que conviene quitar
    case 'bartolome.descartar':
    case 'velas_tormenta.esquivar':
    case 'pedrero.disparar':
      return carta && riesgoDelEncuentro(s, carta) >= 2 ? 3 : 0
    case 'cambio_rumbo.jugar':
      return carta && mano >= 2 && riesgoDelEncuentro(s, carta) >= 2 ? 3 : 0
    case 'sangre_fria.jugar':
      return carta && mano >= 3 && riesgoDelEncuentro(s, carta) >= 2 ? 3 : 0
    case 'soborno.jugar':
      return carta && mano >= 3 && riesgoDelEncuentro(s, carta) >= 1 ? 3 : 0
    case 'espesura.jugar':
      return p && mano >= 2 && peligroDeFallo(s, p.encuentro) >= 1.5 ? 3 : 0
    // Fase 10b: quitar Buscado pagando 1 carta, si sobra mano.
    case 'estado:buscado.quitar':
      return d.motivo.clave === 'jugarCartas' && mano >= 3 ? 1 : 0
    // Cartas de jugador 2.0
    case 'herbolaria.quitar':
    case 'practico.barco':
    case 'virar.jugar':
      return 3
    case 'fiador.descarte': {
      // Fase 14: se descarta él (y robas 2) en lugar de otro que valga más.
      if (ev?.tipo !== 'descartarTripulante' || !fuente) return 0
      return valorTripulante(s, ev.carta) > valorTripulante(s, fuente) ? 3 : 0
    }
    case 'cataplasma.jugar':
      return 2
    case 'cortar.jugar':
      return trasEncuentro && mano >= 4 ? 2 : 0
    case 'a_por_ellos.jugar':
      // Fase 14: Prueba de COM 3 para que no se descarte: si vale la pena y los preparados llegan.
      if (ev?.tipo !== 'descartarTripulante' || mano < 2) return 0
      return valorTripulante(s, ev.carta) >= 3 && alcanza(s, [{ hab: 'COM', dificultad: primerNumero(textoDe('a_por_ellos')) }]) ? 3 : 0
    case 'arenga.jugar':
      return convieneArenga(s) ? 2 : 0
    case 'ron_valientes.jugar':
      return trasEncuentro && faltaAvance(s) > 0 ? 1 : 0
    case 'pm_ojos.accion0':
      // Cazar al jaguar: uno solo, COM 5 (EXP 3 si es un Explorador).
      return trasEncuentro && s.zonas.tripulacion.some((c) => !copia(s, c).agotada && cazaElJaguar(s, c)) ? 2 : 0
    case 'peligroEnMuelle.descartar':
      return fuente && mano >= (s.peligrosEnMuelle?.[fuente] ?? 0) + 2 ? 1 : 0
    // Fase 15. «La ruta de los alisios»: Destina 3 NAV para quitar 2 fichas de Rival justo antes de que el siguiente
    // Peligro las lleve a 8 (con 6), si aún le falta Avance.
    case 'vanhoorn-I.alisio':
      return trasEncuentro && (s.mision?.fichas?.rival ?? 0) >= 6 && faltaAvance(s) > 0 ? 2 : 0
    // Proteger: desviar daño del Barco al Galeón o a las Murallas, o heridas al prisionero, sin dejarlos nunca a 0.
    case 'pm_galeon.cap.cubrir':
    case 'pm_murallas.cap.cubrir':
    case 'pm_prisionero.cap.heridas':
      return cuantoDesviar(s, d, uso) !== null ? 3 : 0
    // «Mala fama»: la quita (2 cartas) en la Fase de Reclutamiento si le sobra mano y quiere reclutar.
    case 'pm_malafama.quitar0':
      return d.motivo.clave === 'jugarCartas' && mano >= 4 && plazasLibres(s) >= 1 && s.zonas.muelle.some((c) => tipoDe(copia(s, c).id) === 'tripulante') ? 2 : 0
    // Misiones 2.0: «Rumbo a la isla»: si ya tiene el Avance y solo falta avistar la isla, agota al Vigía o al Piloto.
    case 'templo-I.isla':
      return trasEncuentro && faltaAvance(s) <= 0 ? 3 : 0
    // «¡La guardia!» (todas las Pruebas +1): echarlos si se llega, o escabullirse si sobra gente.
    case 'guardia.quitar0':
      return trasEncuentro && faltaAvance(s) > 0 && alcanza(s, [{ hab: 'COM', dificultad: 6 }]) ? 2 : 0
    case 'guardia.accion0':
      return trasEncuentro && faltaAvance(s) > 0 && s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length >= 3 ? 1 : 0
    default: {
      // Quitar una carta de Peligro en juego (o sus Acciones): si estorba y se puede pagar sin quedarse sin nadie.
      const cap = capacidadDe(uso)
      if (cap.desde === 'permanente' && cap.ventana === 'accion') {
        if (!trasEncuentro || !fuente) return 0
        // La Prueba de una Acción: solo si se llega con margen (cada intento revela un Destino y, sin nadie, Sin oposición).
        const i = /\.quitar(\d+)$/.exec(uso.clave)?.[1]
        const forma = i !== undefined ? quedaDe(s, fuente)?.quitar[Number(i)] : undefined
        if (forma?.tipo === 'prueba') return alcanza(s, forma.opciones) ? 2 : 0
        const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length
        return preparados >= 2 || mano >= 4 ? 2 : 0
      }
      return 0
    }
  }
}

/**
 * ¿Llegan los preparados (con las cartas de la mano) a alguna de estas Pruebas con 1 de margen? La dificultad es la
 * real: con lo que le sumen la misión, «¡La guardia!» o «la siguiente Prueba recibe +1».
 */
function alcanza(s: Estado, opciones: readonly { hab: 'NAV' | 'COM' | 'EXP'; dificultad: number }[]): boolean {
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada && !buscadoEnCiudad(s, c))
  if (preparados.length === 0) return false
  return opciones.some((o) => {
    const total = preparados.reduce((n, c) => n + valor(s, { tipo: 'habilidad', carta: c, hab: o.hab }), 0) + s.zonas.mano.reduce((n, c) => n + iconos(s, c, o.hab), 0)
    const pendientes = (s.mision?.modsSiguientes ?? []).filter((m) => m.de === 'prueba' && !m.claves && (!m.hab || m.hab === o.hab)).reduce((n, m) => n + (m.n ?? 0), 0)
    const dificultad = Math.max(0, valorSinMinimo(s, { tipo: 'dificultad', base: o.dificultad, hab: o.hab, claves: [] }) + pendientes)
    return total >= dificultad + 1
  })
}

/** ¿Puede este Tripulante cazar al jaguar él solo (con las cartas de la mano)? */
function cazaElJaguar(s: Estado, c: InstId): boolean {
  const explorador = rasgosDe(copia(s, c).id).includes('Explorador')
  const hab = explorador ? 'EXP' : 'COM'
  return valor(s, { tipo: 'habilidad', carta: c, hab }) + s.zonas.mano.reduce((n, x) => n + iconos(s, x, hab), 0) >= (explorador ? 3 : 5) + 1
}

// ---------------------------------------------------------------------------
// Fase 15

/** Las cartas del mazo del naufragio que vuelven barajadas: las que hacen daño (Tiburón, Coral, ahogados, raqueros, pulpo). */
const haceDano = (id: CartaId) => destinoNaufragio(id) === 'barajar'

/**
 * «El naufragio del San José» (Albert): no baja nadie si la siguiente herida (el Tiburón) o el pulpo podrían derrotarle.
 * Se planta cuando en el mazo quedan tantas cartas que hacen daño como de las otras, salvo que ya tenga una mitad del cofre
 * y la otra siga en el mazo: entonces baja a buscarla.
 */
function convieneBucear(s: Estado): boolean {
  const buzo = elegirBuzo(s)
  if (buzo === undefined || !buzoASalvo(s, buzo)) return false
  if (mitadDelCofrePendiente(s)) return true
  const mazo = s.zonas.mazoNaufragio.map((c) => copia(s, c).id)
  const malas = mazo.filter(haceDano).length
  return mazo.length - malas > malas
}

/** Tiene una mitad del cofre (el cofre o la llave) y la otra sigue en el mazo del naufragio. */
function mitadDelCofrePendiente(s: Estado): boolean {
  const enMazo = (id: CartaId) => s.zonas.mazoNaufragio.some((c) => copia(s, c).id === id)
  return (tienesDelNaufragio(s, 'naufragio_cofre') && enMazo('naufragio_llave')) || (tienesDelNaufragio(s, 'naufragio_llave') && enMazo('naufragio_cofre'))
}

/** Vida que le queda al agotarse (si está Sangrando, agotarse le hiere). */
function vidaAlAgotarse(s: Estado, c: InstId): number {
  return vidaRestante(s, c) - (estadosDe(s, c).includes('sangrando') ? 1 : 0)
}

/** Alguien preparado (que no sea el que bucea) a quien agotarse no le derrota: puede sacar al buzo del pulpo. */
function ayudaContraElPulpo(s: Estado, buzo: InstId | undefined = s.mision?.naufragio?.buzo): boolean {
  return s.zonas.tripulacion.some((c) => c !== buzo && !copia(s, c).agotada && vidaAlAgotarse(s, c) > 0)
}

/** La siguiente herida (el Tiburón) no le derrota, ni el pulpo (si no hay nadie más preparado que lo saque). */
function buzoASalvo(s: Estado, c: InstId): boolean {
  if (capitanInmortal(s, c)) return true
  const vida = vidaAlAgotarse(s, c)
  const tiburon = numeroConIcono(textoDe('naufragio_tiburon'), 'herida')
  const pulpo = numeroConIcono(textoDe('naufragio_pulpo'), 'herida')
  return vida > tiburon && (vida > pulpo || ayudaContraElPulpo(s, c))
}

/** El que baja: uno que esté a salvo, el que más Vida conserve y el Capitán solo si no hay otro. */
function elegirBuzo(s: Estado, candidatas: readonly InstId[] = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)): InstId | undefined {
  const orden = [...candidatas].sort((a, b) => (a === s.capitan ? 50 : 0) - vidaRestante(s, a) - ((b === s.capitan ? 50 : 0) - vidaRestante(s, b)))
  return orden.find((c) => buzoASalvo(s, c)) ?? orden[0]
}

/** Con «El doblón de la calavera» en juego, el Capitán no puede quedar derrotado. */
function capitanInmortal(s: Estado, c: InstId): boolean {
  return c === s.capitan && s.zonas.mejoras.some((m) => copia(s, m).id === 'doblon')
}

/** «Un respiro»: descansa si casi todos están agotados, o hay muchas heridas o Estados, y aún le queda camino. */
function convieneDescansar(s: Estado): boolean {
  const tripulacion = s.zonas.tripulacion
  const agotados = tripulacion.filter((c) => copia(s, c).agotada).length
  const conEstados = tripulacion.filter((c) => (copia(s, c).estados ?? []).some((e) => !esVentaja(e))).length
  const entorno = entornoActual(s)
  const tocados = entorno === 'ciu' ? conEstados >= 2 : entorno === 'mar' ? agotados >= 2 || heridosTotales(s) >= 3 : agotados >= 2
  return tocados && agotados >= tripulacion.length - 1 && faltaAvance(s) >= 2
}

/** Lo que una permanente con Vida tiene que conservar: el umbral de la recompensa de más de su misión (o 1). */
const UMBRAL_PROTEGIDO: Record<string, number> = { pm_galeon: 3, pm_murallas: 4, pm_prisionero: 1 }

/**
 * Cuánto daño (o cuántas heridas) desvía a la permanente que protege: nunca la deja a 0. Si el Barco se hundiría (o el
 * Tripulante quedaría derrotado), todo lo que pueda; si no, solo lo que le sobre por encima del umbral de su recompensa.
 * Null si no le conviene.
 */
function cuantoDesviar(s: Estado, d: Decision, uso?: Uso): number | null {
  let carta: InstId | null = uso?.fuente ?? null
  let ev = sucesoPendiente(s, d)
  if (!uso) {
    const t = tareaDe(s, d)
    if (t?.tipo !== 'especial') return null
    carta = t.datos.carta as InstId
    const suceso = s.pila.find((x) => x.id === t.datos.suceso)
    ev = suceso?.tipo === 'evento' ? suceso.ev : null
  }
  if (!carta || !ev || (ev.tipo !== 'danoBarco' && ev.tipo !== 'heridas')) return null
  const e = porId(copia(s, carta).id)
  const restante = (e.tipo === 'permanente' ? (e.carta.vida ?? 0) : 0) - copia(s, carta).heridas
  const umbral = UMBRAL_PROTEGIDO[copia(s, carta).id] ?? 1
  const peligro =
    ev.tipo === 'danoBarco' ? s.danoBarco + ev.cantidad >= valor(s, { tipo: 'danoMaximo' }) : copia(s, ev.objetivo).heridas + ev.cantidad >= valor(s, { tipo: 'vida', carta: ev.objetivo })
  const necesario = ev.tipo === 'danoBarco' ? s.danoBarco + ev.cantidad - valor(s, { tipo: 'danoMaximo' }) + 1 : copia(s, ev.objetivo).heridas + ev.cantidad - valor(s, { tipo: 'vida', carta: ev.objetivo }) + 1
  const k = peligro ? Math.min(ev.cantidad, restante - 1, Math.max(necesario, restante - umbral)) : Math.min(ev.cantidad, restante - umbral)
  return k >= 1 ? k : null
}

/** La capacidad que más le conviene usar ahora, si alguna le conviene. */
function mejorUso(s: Estado, usos: readonly Uso[], d: Decision): Uso | null {
  let mejor: { puntos: number; uso: Uso } | null = null
  for (const uso of usos) {
    const puntos = puntuarUso(s, uso, d)
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { puntos, uso }
  }
  return mejor?.uso ?? null
}

function tareaDe(s: Estado, d: Decision) {
  return s.pila.find((x) => x.id === d.tarea)
}

/**
 * ¿Tienes un Tripulante (el Capitán cuenta) preparado con al menos esa NAV? Las cartas de Escenario se revelan en el
 * paso 1 del Inicio, antes de preparar, así que cuenta como preparado el que se prepara en este mismo Inicio. La NAV
 * es la que tendrá ya preparado: con el +1 de Diego, Entrenamiento, Ventajas…
 */
export function tieneNavegante(s: Estado, minimo: number): boolean {
  const t = JSON.parse(JSON.stringify(s)) as Estado
  for (const c of t.zonas.tripulacion) if (puedePrepararse(t, c)) copia(t, c).agotada = false
  return t.zonas.tripulacion.some((c) => !copia(t, c).agotada && valor(t, { tipo: 'habilidad', carta: c, hab: 'NAV' }) >= minimo)
}

/** Opciones del jugador con criterio. `despide` (fase 14, por defecto sí): despide para hacer sitio a uno mejor. */
export interface OpcionesJugador {
  despide?: boolean
}

export function jugadorConCriterio(opciones: OpcionesJugador = {}): JugadorAutomatico {
  const conOpciones: OpcionesJugador = { despide: true, ...opciones }
  return (s, d) => {
    // En las pausas, las capacidades sin etiqueta que le convengan.
    const libre = d.libres ? mejorUso(s, d.libres, d) : null
    if (libre) return { tipo: 'usar', uso: libre }
    switch (d.tipo) {
      case 'ventanaAccion': {
        const usos = d.acciones.filter((a): a is Extract<Accion, { tipo: 'usar' }> => a.tipo === 'usar').map((a) => a.uso)
        const uso = mejorUso(s, usos, d)
        if (uso) return { tipo: 'accion', accion: { tipo: 'usar', uso } }
        return ventana(s, d, conOpciones)
      }
      case 'elegirCartas':
        return elegirCartas(s, d)
      case 'elegirOpcion':
        return elegirOpcion(s, d)
      case 'ofrecer': {
        const uso = mejorUso(s, d.usos, d)
        return uso ? { tipo: 'usar', uso } : { tipo: 'pasar' }
      }
      case 'repartir':
        return repartir(s, d)
      case 'cubrirDistancia':
        return cubrirDistancia(s, d)
      case 'comprometer':
        return elegirCompromiso(s, d)
    }
  }
}

/** Número de Peligros del mazo predefinido, para normalizar estadísticas. */
export const PELIGROS_EN_MAZO = DATOS.mazosPredefinidos.mazoDePeligros.length
