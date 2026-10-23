// Medida de la rotación de la tripulación (para Albert): cuánto se recluta, cuándo se llena el barco, por qué no se
// recluta en un turno, por qué salen los Tripulantes, cuánto duran y cuántas heridas se reciben y se curan.
// No cambia nada del juego: juega como jugarPartida (equilibrio.ts) y mira el estado entre respuesta y respuesta.

import { esUnica, porId } from '../catalogo.ts'
import { copia } from '../estado.ts'
import { responder } from '../motor.ts'
import { nuevaPartida } from '../preparacion.ts'
import type { Accion, Decision, Eleccion, Estado, InstId, Modo } from '../tipos.ts'
import { plazasLibres, valor } from '../valores.ts'
import type { JugadorAutomatico } from './jugadores.ts'

const MAXIMO_RESPUESTAS = 8000

/** Por qué sale un Tripulante de la tripulación. */
export type CausaSalida =
  /** Queda derrotado por las heridas. */
  | 'heridas'
  /** Lo descarta una carta («Bruma en la selva», una capacidad que lo descarta…). */
  | 'carta'
  /** Vuelve al muelle (un caimán, una deserción…). */
  | 'muelle'
  /** Queda rehén (lo rescate después o no). */
  | 'rehen'
  /** Queda incautado bajo la carta de misión. */
  | 'incautado'
  /** Lo despide el jugador. */
  | 'despedido'
  /** Sobra al bajar la Capacidad: se despide a la fuerza. */
  | 'exceso'
  /** Lo reclutó «Náufrago en la playa»: se va al final del turno. */
  | 'naufrago'

export const CAUSAS: readonly CausaSalida[] = ['heridas', 'carta', 'muelle', 'rehen', 'incautado', 'despedido', 'exceso', 'naufrago']

/** Por qué no se recluta a nadie en la Fase de Reclutamiento de un turno. */
export type SinReclutar =
  /** El barco está lleno (no queda Capacidad). */
  | 'lleno'
  /** En el muelle no hay ningún Tripulante que pueda entrar (ninguno, o solo cartas únicas que ya tiene). */
  | 'sinTripulantes'
  /** Hay Tripulantes, pero todos cuestan más cartas de las que tiene en la mano. */
  | 'noPuedePagar'
  /** Podría pagar alguno, pero se quedaría con menos de 2 cartas en la mano (criterio del jugador automático). */
  | 'guardaCartas'
  /** Podía y quería, pero gastó la mano en Mejoras antes. */
  | 'prefiereMejoras'
  /** Podía y su criterio lo permitía, pero no le interesó ninguno. */
  | 'noLeInteresa'

export const MOTIVOS_SIN_RECLUTAR: readonly SinReclutar[] = ['lleno', 'sinTripulantes', 'noPuedePagar', 'guardaCartas', 'prefiereMejoras', 'noLeInteresa']

/** Lo que pasa en la Fase de Reclutamiento de un turno, y en el resto del turno. */
export interface TurnoRotacion {
  turno: number
  capacidad: number
  /** Tripulantes (sin el Capitán) al empezar la Fase de Reclutamiento. */
  tripulantes: number
  /** Plazas libres al empezar la Fase de Reclutamiento (los rehenes, los incautados y los Pasajeros ocupan plaza). */
  libresAlEmpezar: number
  /** Plazas libres al terminarla (con lo que zarpa). */
  libresAlZarpar: number
  reclutadosEnPuerto: number
  /** Reclutados en el resto del turno, por efectos de cartas («recluta sin coste…»). */
  reclutadosFuera: number
  sinReclutar: SinReclutar | null
  salidas: number
}

export interface Estancia {
  carta: string
  entrada: number
  /** Turno en que sale para siempre (null: sigue al final de la partida). */
  salida: number | null
  causa: CausaSalida | null
}

export interface RotacionPartida {
  semilla: number
  gana: boolean
  turnoFinal: number
  turnos: TurnoRotacion[]
  salidas: Record<CausaSalida, number>
  rehenesRescatados: number
  rehenesPerdidos: number
  estancias: Estancia[]
  /** Tripulantes en la tripulación al terminar la Fase de Reclutamiento del turno 1, y cuántos siguen al final. */
  primerTurno: number
  primerTurnoSiguen: number
  heridasTripulantes: number
  heridasCapitan: number
  curadasTaberna: number
  curadasOtras: number
  /** Veces que el jugador despide a un Tripulante (con la acción Despedir). */
  despidos: number
}

function tripulantesSinCapitan(s: Estado): InstId[] {
  return s.zonas.tripulacion.filter((c) => c !== s.capitan)
}

/** ¿Hay en el muelle algún Tripulante que podría entrar (sin contar el coste)? */
function hayTripulanteEnMuelle(s: Estado): boolean {
  const enJuego = new Set([...s.zonas.tripulacion, ...s.zonas.rehenes].map((c) => copia(s, c).id))
  return s.zonas.muelle.some((c) => {
    const id = copia(s, c).id
    return porId(id).tipo === 'tripulante' && !(esUnica(id) && enJuego.has(id))
  })
}

/** Lo que ve el jugador al empezar la Fase de Reclutamiento, para saber después por qué no recluta. */
interface Arranque {
  libres: number
  hayTripulantes: boolean
  pagables: number
  /** Pagables dejando 2 o más cartas en la mano (su criterio para reclutar). */
  conCriterio: number
}

function arranque(s: Estado, acciones: readonly Accion[]): Arranque {
  const mano = s.zonas.mano.length
  const reclutables = acciones.filter((a): a is Extract<Accion, { tipo: 'reclutar' }> => a.tipo === 'reclutar')
  return {
    libres: plazasLibres(s),
    hayTripulantes: hayTripulanteEnMuelle(s),
    pagables: reclutables.length,
    conCriterio: reclutables.filter((a) => mano - valor(s, { tipo: 'coste', carta: a.carta }) >= 2).length,
  }
}

function motivoSinReclutar(a: Arranque, adquirio: boolean): SinReclutar {
  if (a.libres <= 0) return 'lleno'
  if (!a.hayTripulantes) return 'sinTripulantes'
  if (a.pagables === 0) return 'noPuedePagar'
  if (a.conCriterio === 0) return 'guardaCartas'
  return adquirio ? 'prefiereMejoras' : 'noLeInteresa'
}

const CAUSA_DE_MOTIVO: Record<string, CausaSalida> = {
  derrotado: 'heridas',
  descartado: 'carta',
  muelle: 'muelle',
  desercion: 'muelle',
  despedido: 'despedido',
  exceso: 'exceso',
  naufrago: 'naufrago',
  incautado: 'incautado',
}

/** Juega una partida con un jugador automático y mide la rotación de su tripulación. */
export function medirRotacion(semilla: number, jugador: JugadorAutomatico, { modo }: { modo?: Modo } = {}): RotacionPartida {
  let s = nuevaPartida({ semilla, ...(modo ? { modo } : {}) })
  const r: RotacionPartida = {
    semilla,
    gana: false,
    turnoFinal: 0,
    turnos: [],
    salidas: Object.fromEntries(CAUSAS.map((c) => [c, 0])) as Record<CausaSalida, number>,
    rehenesRescatados: 0,
    rehenesPerdidos: 0,
    estancias: [],
    primerTurno: 0,
    primerTurnoSiguen: 0,
    heridasTripulantes: 0,
    heridasCapitan: 0,
    curadasTaberna: 0,
    curadasOtras: 0,
    despidos: 0,
  }
  const estancias = new Map<InstId, Estancia>()
  for (const c of tripulantesSinCapitan(s)) {
    const e: Estancia = { carta: copia(s, c).id, entrada: s.turno, salida: null, causa: null }
    estancias.set(c, e)
    r.estancias.push(e)
  }
  // La Fase de Reclutamiento en curso: lo que vio al empezar y si ha adquirido Mejoras.
  let fase: { turno: TurnoRotacion; arranque: Arranque; adquirio: boolean } | null = null
  const primerTurno: { tripulantes: InstId[] | null } = { tripulantes: null }
  let taberna: { paso: Estado['paso'] } | null = null

  const cerrarFase = (est: Estado) => {
    if (!fase) return
    fase.turno.libresAlZarpar = plazasLibres(est)
    if (fase.turno.reclutadosEnPuerto === 0) fase.turno.sinReclutar = motivoSinReclutar(fase.arranque, fase.adquirio)
    if (fase.turno.turno === 1 && !primerTurno.tripulantes) primerTurno.tripulantes = tripulantesSinCapitan(est)
    fase = null
  }
  const turnoEnCurso = (n: number): TurnoRotacion | undefined => {
    for (let i = r.turnos.length - 1; i >= 0; i--) if (r.turnos[i]?.turno === n) return r.turnos[i]
    return undefined
  }

  for (let n = 0; !s.resultado && n < MAXIMO_RESPUESTAS; n++) {
    const d: Decision | null = s.pendiente
    if (!d) throw new Error(`Partida ${semilla} parada sin decisión`)
    const enReclutamiento = d.tipo === 'ventanaAccion' && d.motivo.clave === 'jugarCartas'
    // La fase dura mientras el turno siga en el paso de Jugar cartas (pagar un coste pide otra decisión en medio).
    if (fase && (s.paso !== 'jugarCartas' || fase.turno.turno !== s.turno)) cerrarFase(s)
    if (enReclutamiento && !fase && turnoEnCurso(s.turno) === undefined) {
      const t: TurnoRotacion = {
        turno: s.turno,
        capacidad: valor(s, { tipo: 'capacidad' }),
        tripulantes: tripulantesSinCapitan(s).length,
        libresAlEmpezar: plazasLibres(s),
        libresAlZarpar: plazasLibres(s),
        reclutadosEnPuerto: 0,
        reclutadosFuera: 0,
        sinReclutar: null,
        salidas: 0,
      }
      r.turnos.push(t)
      fase = { turno: t, arranque: arranque(s, d.acciones), adquirio: false }
    }
    if (taberna && (s.paso !== taberna.paso || (d.tipo === 'elegirOpcion' && d.motivo.clave === 'opcionPuerto'))) taberna = null

    const eleccion: Eleccion = jugador(s, d)
    if (enReclutamiento && eleccion.tipo === 'accion' && eleccion.accion.tipo === 'despedir') r.despidos++
    if (d.tipo === 'elegirOpcion' && d.motivo.clave === 'opcionPuerto' && eleccion.tipo === 'opcion' && eleccion.clave === 'taberna') {
      taberna = { paso: s.paso }
    }

    const antes = { tripulacion: new Set(s.zonas.tripulacion), rehenes: new Set(s.zonas.rehenes), incautadas: new Set(s.zonas.incautadas) }
    const heridasAntes = new Map(s.zonas.tripulacion.map((c) => [c, copia(s, c).heridas]))
    const capitan = s.capitan
    s = responder(s, eleccion)

    // Heridas recibidas (del registro) y curadas (lo que baja la cuenta de heridas de quien sigue en juego).
    const motivosSalida = new Map<InstId, string>()
    for (const e of s.registro) {
      const dato = e.dato
      if (!dato) continue
      if (dato.tipo === 'heridas') {
        if (dato.inst === capitan) r.heridasCapitan += dato.n
        else r.heridasTripulantes += dato.n
      } else if (dato.tipo === 'reclutar' && porId(dato.carta).tipo === 'tripulante') {
        const t = turnoEnCurso(e.turno)
        if (t && e.paso === 'jugarCartas') t.reclutadosEnPuerto++
        else if (t) t.reclutadosFuera++
      } else if (dato.tipo === 'adquirir' && fase && e.paso === 'jugarCartas') {
        fase.adquirio = true
      } else if (dato.tipo === 'sale') {
        motivosSalida.set(dato.inst, dato.motivo)
      }
    }
    s.registro = []
    for (const [c, h] of heridasAntes) {
      if (!s.zonas.tripulacion.includes(c)) continue
      const curadas = h - copia(s, c).heridas
      if (curadas > 0) {
        if (taberna) r.curadasTaberna += curadas
        else r.curadasOtras += curadas
      }
    }

    // Entradas y salidas de la tripulación.
    const ahora = new Set(s.zonas.tripulacion)
    for (const c of ahora) {
      if (c === s.capitan || antes.tripulacion.has(c)) continue
      if (antes.rehenes.has(c)) {
        r.rehenesRescatados++
        continue
      }
      if (antes.incautadas.has(c)) continue
      const e: Estancia = { carta: copia(s, c).id, entrada: s.turno, salida: null, causa: null }
      estancias.set(c, e)
      r.estancias.push(e)
    }
    const salir = (c: InstId, causa: CausaSalida, definitiva: boolean) => {
      r.salidas[causa]++
      const t = turnoEnCurso(s.turno)
      if (t) t.salidas++
      const e = estancias.get(c)
      if (e && definitiva) {
        e.salida = s.turno
        e.causa = causa
      }
    }
    for (const c of antes.tripulacion) {
      if (c === capitan || ahora.has(c)) continue
      if (s.zonas.rehenes.includes(c)) salir(c, 'rehen', false)
      else if (s.zonas.incautadas.includes(c)) salir(c, 'incautado', false)
      else salir(c, CAUSA_DE_MOTIVO[motivosSalida.get(c) ?? ''] ?? 'carta', true)
    }
    // Rehenes perdidos (y los incautados que no vuelven): se cierra su estancia.
    for (const c of [...antes.rehenes, ...antes.incautadas]) {
      if (ahora.has(c) || s.zonas.rehenes.includes(c) || s.zonas.incautadas.includes(c)) continue
      const e = estancias.get(c)
      if (antes.rehenes.has(c)) r.rehenesPerdidos++
      if (e && e.salida === null) {
        e.salida = s.turno
        e.causa = antes.rehenes.has(c) ? 'rehen' : 'incautado'
      }
    }
  }
  cerrarFase(s)
  r.gana = s.resultado?.gana ?? false
  r.turnoFinal = s.turno
  // Los rehenes que siguen cautivos al final no están en la tripulación.
  for (const c of [...s.zonas.rehenes, ...s.zonas.incautadas]) {
    const e = estancias.get(c)
    if (e && e.salida === null) {
      e.salida = s.turno
      e.causa = s.zonas.rehenes.includes(c) ? 'rehen' : 'incautado'
    }
  }
  const primeros: InstId[] = primerTurno.tripulantes ?? []
  r.primerTurno = primeros.length
  r.primerTurnoSiguen = primeros.filter((c) => s.zonas.tripulacion.includes(c)).length
  return r
}

// ---------------------------------------------------------------------------
// Resumen de muchas partidas

const mediaDe = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)

function percentil(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0
  const orden = [...xs].sort((a, b) => a - b)
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))] ?? 0
}

function reparto(xs: readonly number[], tope: number): Record<string, number> {
  const r: Record<string, number> = {}
  for (let i = 0; i <= tope; i++) r[i === tope ? `${tope}+` : String(i)] = 0
  for (const x of xs) {
    const k = x >= tope ? `${tope}+` : String(x)
    r[k] = (r[k] ?? 0) + 100 / Math.max(1, xs.length)
  }
  return r
}

/** Las medidas que pide Albert (1 a 7), más el perfil turno a turno. */
export function resumenRotacion(partidas: readonly RotacionPartida[]) {
  const turnos = partidas.flatMap((p) => p.turnos)
  const reclutadosPartida = partidas.map((p) => p.turnos.reduce((n, t) => n + t.reclutadosEnPuerto + t.reclutadosFuera, 0))
  const enPuertoPartida = partidas.map((p) => p.turnos.reduce((n, t) => n + t.reclutadosEnPuerto, 0))
  const primerLleno = partidas.map((p) => p.turnos.find((t) => t.libresAlZarpar <= 0)?.turno ?? null)
  const llenos = primerLleno.filter((t): t is number => t !== null)
  const sinReclutar = turnos.filter((t) => t.sinReclutar !== null)
  const estancias = partidas.flatMap((p) => p.estancias.map((e) => ({ ...e, fin: p.turnoFinal })))
  const duracion = (e: (typeof estancias)[number]) => (e.salida ?? e.fin) - e.entrada + 1
  const terminadas = estancias.filter((e) => e.salida !== null)
  const maxTurno = Math.max(...turnos.map((t) => t.turno))
  const porPartida = (f: (p: RotacionPartida) => number) => mediaDe(partidas.map(f))
  return {
    partidas: partidas.length,
    turnosPorPartida: porPartida((p) => p.turnos.length),
    victorias: (100 * partidas.filter((p) => p.gana).length) / Math.max(1, partidas.length),
    // 1. Reclutados
    reclutados: {
      porPartida: mediaDe(reclutadosPartida),
      enPuertoPorPartida: mediaDe(enPuertoPartida),
      fueraPorPartida: mediaDe(reclutadosPartida.map((n, i) => n - (enPuertoPartida[i] ?? 0))),
      p10: percentil(reclutadosPartida, 10),
      p50: percentil(reclutadosPartida, 50),
      p90: percentil(reclutadosPartida, 90),
      repartoPorPartida: reparto(reclutadosPartida, 10),
      porTurno: mediaDe(turnos.map((t) => t.reclutadosEnPuerto + t.reclutadosFuera)),
      repartoPorTurno: reparto(
        turnos.map((t) => t.reclutadosEnPuerto),
        3,
      ),
    },
    // 2. Barco lleno
    lleno: {
      partidasQueSeLlenan: (100 * llenos.length) / Math.max(1, partidas.length),
      primerTurnoMedia: mediaDe(llenos),
      primerTurnoMediana: percentil(llenos, 50),
      turnosLlenoAlEmpezar: (100 * turnos.filter((t) => t.libresAlEmpezar <= 0).length) / Math.max(1, turnos.length),
      turnosLlenoAlZarpar: (100 * turnos.filter((t) => t.libresAlZarpar <= 0).length) / Math.max(1, turnos.length),
      capacidadMedia: mediaDe(turnos.map((t) => t.capacidad)),
    },
    // 3. Turnos sin reclutar en puerto, y por qué
    sinReclutar: {
      turnos: (100 * sinReclutar.length) / Math.max(1, turnos.length),
      motivos: Object.fromEntries(
        MOTIVOS_SIN_RECLUTAR.map((m) => [m, (100 * sinReclutar.filter((t) => t.sinReclutar === m).length) / Math.max(1, turnos.length)]),
      ),
    },
    // 4. Salidas por partida, por causa
    salidas: {
      porPartida: porPartida((p) => CAUSAS.reduce((n, c) => n + p.salidas[c], 0)),
      causas: Object.fromEntries(CAUSAS.map((c) => [c, porPartida((p) => p.salidas[c])])),
      rehenesRescatados: porPartida((p) => p.rehenesRescatados),
      rehenesPerdidos: porPartida((p) => p.rehenesPerdidos),
    },
    // 5. Cuánto dura un Tripulante
    duracion: {
      estanciasPorPartida: estancias.length / Math.max(1, partidas.length),
      media: mediaDe(estancias.map(duracion)),
      mediaDeLosQueSalen: mediaDe(terminadas.map(duracion)),
      siguenAlFinal: (100 * estancias.filter((e) => e.salida === null).length) / Math.max(1, estancias.length),
      primerTurnoSiguen: (100 * partidas.reduce((n, p) => n + p.primerTurnoSiguen, 0)) / Math.max(1, partidas.reduce((n, p) => n + p.primerTurno, 0)),
      primerTurnoPorPartida: porPartida((p) => p.primerTurno),
    },
    // 6. Heridas recibidas y curadas, por partida
    heridas: {
      tripulantes: porPartida((p) => p.heridasTripulantes),
      capitan: porPartida((p) => p.heridasCapitan),
      curadasTaberna: porPartida((p) => p.curadasTaberna),
      curadasOtras: porPartida((p) => p.curadasOtras),
    },
    // 7. Despidos
    despidosPorPartida: porPartida((p) => p.despidos),
    // Turno a turno (solo las partidas que llegan a ese turno)
    perfil: Array.from({ length: maxTurno }, (_, i) => {
      const n = i + 1
      const ts = turnos.filter((t) => t.turno === n)
      return {
        turno: n,
        partidas: ts.length,
        tripulantes: mediaDe(ts.map((t) => t.tripulantes)),
        capacidad: mediaDe(ts.map((t) => t.capacidad)),
        llenoAlEmpezar: (100 * ts.filter((t) => t.libresAlEmpezar <= 0).length) / Math.max(1, ts.length),
        llenoAlZarpar: (100 * ts.filter((t) => t.libresAlZarpar <= 0).length) / Math.max(1, ts.length),
        reclutados: mediaDe(ts.map((t) => t.reclutadosEnPuerto + t.reclutadosFuera)),
        salidas: mediaDe(ts.map((t) => t.salidas)),
      }
    }),
  }
}
