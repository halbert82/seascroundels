// Ayudantes para las pruebas del motor (no forman parte del juego):
// - montar una situación concreta en una sola llamada;
// - jugarla paso a paso con los identificadores del catálogo;
// - comprobar los invariantes del estado tras cada paso.

import { sembrar } from '../azar.ts'
import { registrarCapacidades } from '../capacidades/index.ts'
import { CATALOGO, esUnica, registrarCartasExtra } from '../catalogo.ts'
import { DATOS, type CapituloDatos, type Entorno, type Habilidad, type MisionDatos } from '../datos.ts'
import { copia as copiaDe, encolar, estadoVacio } from '../estado.ts'
import { ejecutar, responder } from '../motor.ts'
import { nuevaPartida, type OpcionesPartida } from '../preparacion.ts'
import {
  ZONAS,
  type Accion,
  type CartaId,
  type Consulta,
  type Copia,
  type Decision,
  type Eleccion,
  type Estado,
  type InstId,
  type Temporal,
  type Zona,
} from '../tipos.ts'
import { valor, valorSinMinimo } from '../valores.ts'
import { clavesDelEncuentro, totalSinDestino } from '../prueba.ts'
import type { EstadoBarco, FichaTripulante } from '../infoEstados.ts'
import { crearCopia, zonaDe } from '../zonas.ts'

export interface CopiaInicial {
  id: CartaId
  heridas?: number
  agotada?: boolean
  /** Mejoras de tripulante (o Tesoros) que lleva. */
  mejoras?: CartaId[]
  entrenamiento?: Habilidad[]
  estados?: FichaTripulante[]
}

export interface MejoraInicial {
  id: CartaId
  agotada?: boolean
  /** Fichas sobre la carta (la Pólvora del Rey). */
  fichas?: number
}

export interface OpcionesSituacion {
  semilla?: number
  /** Paso del turno en el que empieza la situación (por defecto, Jugar cartas). */
  empezarEn?: 'inicio' | 'jugarCartas' | 'quedarseOZarpar' | 'final'
  turno?: number
  /** Zonas: la primera carta es la de arriba. Lo que no se indica, queda vacío. */
  mano?: CartaId[]
  mazoCapitan?: CartaId[]
  descartesCapitan?: CartaId[]
  muelle?: CartaId[]
  mazoMuelle?: CartaId[]
  descartesMuelle?: CartaId[]
  escenario?: CartaId[]
  descartesEscenario?: CartaId[]
  capitan?: Omit<CopiaInicial, 'id'>
  /** Otro Capitán (por defecto, Diego). */
  capitanId?: CartaId
  /** Otro puerto (por defecto, Tortuga). */
  puerto?: CartaId
  /** Tripulantes además del Capitán. */
  tripulacion?: (CartaId | CopiaInicial)[]
  barco?: { dano?: number; mejoras?: (CartaId | MejoraInicial)[]; estados?: EstadoBarco[] }
  /** Misiones disponibles (por defecto, las tres iniciales). */
  misiones?: CartaId[]
  /** Mazo de Misiones (por defecto, los capítulos I y las aventuras, sin barajar). */
  mazoMisiones?: CartaId[]
  reputacion?: number
  temporales?: Temporal[]
  /** Mazo de Peligros (arriba primero). Por defecto, vacío. */
  mazoPeligros?: CartaId[]
  descartesPeligros?: CartaId[]
  /** Por defecto, «La Armada te persigue» y «Amigos en la costa». */
  apartados?: CartaId[]
  /** Por defecto, como en una partida nueva: capítulos II y III, Tesoros y mazos propios. */
  mazoHistoria?: CartaId[]
  /** Avance ya puesto en misiones disponibles (por identificador de misión). */
  avance?: Record<CartaId, number>
  /** Pasajeros que ya viajan contigo (se quitan del mazo de historia). */
  pasajeros?: CartaId[]
}

// ---------------------------------------------------------------------------
// Misiones de prueba: sin reglas que estorben, para probar cartas y reglas generales. No son de la caja (no salen en
// el catálogo ni en la galería).

const MISION_DE_PRUEBA: MisionDatos = { id: 'pruebas', nombre: 'Misión de prueba', reto: 'Prueba', intro: '', inicial: true, aventura: false, capitulos: [] }

function capituloDePrueba(id: string, num: number, entorno: Entorno, avance: number, distancia: number): void {
  const carta: CapituloDatos = {
    capitulo: 'I',
    num,
    nombre: `Prueba (${entorno} ${avance}${distancia > 0 ? `, Distancia ${distancia}` : ''})`,
    entorno,
    avanceNecesario: avance,
    distancia,
    reglas: [],
    ambientacion: '',
    recompensa: { rep: 1 },
    siguiente: [],
    textoSiguiente: '',
  }
  registrarCartasExtra({ tipo: 'capitulo', num, id, copias: 1, carta, mision: MISION_DE_PRUEBA })
}

/** Misiones sin reglas: Mar 5, Mar 3, Naturaleza 3 (Distancia 1), Naturaleza 4 (en la isla), Ciudad 4 y Ciudad 3; y largas (9), para las cartas que tardan en hacer efecto. */
export const MISIONES_DE_PRUEBA = {
  mar5: 'pruebas-mar5',
  mar3: 'pruebas-mar3',
  nat3: 'pruebas-nat3',
  nat4: 'pruebas-nat4',
  ciu4: 'pruebas-ciu4',
  ciu3: 'pruebas-ciu3',
  nat9: 'pruebas-nat9',
  ciu9: 'pruebas-ciu9',
} as const
capituloDePrueba('pruebas-mar5', 9001, 'mar', 5, 0)
capituloDePrueba('pruebas-mar3', 9002, 'mar', 3, 0)
capituloDePrueba('pruebas-nat3', 9003, 'nat', 3, 1)
capituloDePrueba('pruebas-ciu4', 9004, 'ciu', 4, 0)
capituloDePrueba('pruebas-nat4', 9006, 'nat', 4, 0)
capituloDePrueba('pruebas-ciu3', 9005, 'ciu', 3, 0)
capituloDePrueba('pruebas-nat9', 9007, 'nat', 9, 0)
capituloDePrueba('pruebas-ciu9', 9008, 'ciu', 9, 0)

/** Carta de Escenario sin efecto, para las pruebas que solo necesitan que pase el tiempo. */
export const ESCENARIO_DE_PRUEBA = 'pruebas-calma'
registrarCartasExtra({
  tipo: 'escenario',
  num: 9101,
  id: ESCENARIO_DE_PRUEBA,
  copias: 1,
  carta: { id: ESCENARIO_DE_PRUEBA, num: 9101, nombre: 'Día sin noticias (prueba)', texto: 'Sin efecto.', ambientacion: '' },
})
registrarCapacidades({ clave: ESCENARIO_DE_PRUEBA, carta: ESCENARIO_DE_PRUEBA, ventana: 'alRevelar', desde: 'escenario', efecto: () => [] })

function historiaCompleta(): CartaId[] {
  const ids: CartaId[] = []
  for (const e of CATALOGO) {
    if (e.tipo === 'capitulo' && e.carta.capitulo !== 'I') ids.push(e.id)
    if (e.tipo === 'tesoro') ids.push(e.id)
    if (e.tipo === 'mazoPropio') for (let i = 0; i < e.copias; i++) ids.push(e.id)
    if (e.tipo === 'pasajero' || e.tipo === 'cartaMision') ids.push(e.id)
  }
  return ids
}

function ponerCopia(s: Estado, entrada: CartaId | CopiaInicial, zona: Zona): InstId {
  const datos = typeof entrada === 'string' ? { id: entrada } : entrada
  const inst = crearCopia(s, datos.id, zona)
  const c = copiaDe(s, inst)
  c.heridas = datos.heridas ?? 0
  c.agotada = datos.agotada ?? false
  c.entrenamiento = [...(datos.entrenamiento ?? [])]
  if (datos.estados && datos.estados.length > 0) c.estados = [...datos.estados]
  for (const m of datos.mejoras ?? []) copiaDe(s, crearCopia(s, m, 'mejoras')).vinculadaA = inst
  return inst
}

/** Monta una partida en una situación concreta y la deja esperando la primera decisión. */
/**
 * Para las pruebas escritas antes de la fase 10, cuando el Destino cambiaba la dificultad: la dificultad con el Destino
 * dentro (la cuenta de entonces, con el mínimo de 0 al final) y el total sin él. Así cada prueba sigue comprobando el
 * valor de cada Destino; las reglas nuevas (el Destino suma al total) tienen sus propias pruebas.
 */
export function dificultadConDestino(s: Estado): number {
  const p = s.prueba
  if (!p?.hab) return 0
  const d = valorSinMinimo(s, { tipo: 'dificultad', base: p.dificultadBase, hab: p.hab, claves: clavesDelEncuentro(s, p.encuentro) })
  return Math.max(0, d + p.modDestino + (p.modExtra ?? 0))
}

export function totalSinDestinoPrueba(s: Estado): number {
  const p = s.prueba
  return p?.hab ? totalSinDestino(s, p, p.hab) : 0
}

export function montar(op: OpcionesSituacion = {}): Estado {
  const s = estadoVacio(sembrar(op.semilla ?? 1))
  s.capitan = ponerCopia(s, { id: op.capitanId ?? DATOS.mazosPredefinidos.capitanInicial, ...op.capitan }, 'tripulacion')
  s.puerto = op.puerto ?? DATOS.mazosPredefinidos.puertoInicial
  for (const t of op.tripulacion ?? []) ponerCopia(s, t, 'tripulacion')
  for (const m of op.barco?.mejoras ?? []) {
    const datos = typeof m === 'string' ? { id: m } : m
    const c = copiaDe(s, crearCopia(s, datos.id, 'mejoras'))
    c.vinculadaA = 'barco'
    c.agotada = datos.agotada ?? false
    if (datos.fichas !== undefined) c.fichas = datos.fichas
  }
  s.danoBarco = op.barco?.dano ?? 0
  if (op.barco?.estados && op.barco.estados.length > 0) s.estadosBarco = [...op.barco.estados]
  const zonas: [Zona, CartaId[] | undefined][] = [
    ['mano', op.mano],
    ['mazoCapitan', op.mazoCapitan],
    ['descartesCapitan', op.descartesCapitan],
    ['muelle', op.muelle],
    ['mazoMuelle', op.mazoMuelle],
    ['descartesMuelle', op.descartesMuelle],
    ['mazoEscenario', op.escenario],
    ['descartesEscenario', op.descartesEscenario],
    ['misionesDisponibles', op.misiones ?? DATOS.ordenMisiones.iniciales.map((m) => `${m}-I`)],
    [
      'mazoMisiones',
      op.mazoMisiones ?? [...DATOS.ordenMisiones.travesias, ...DATOS.ordenMisiones.aventuras].map((m) => `${m}-I`),
    ],
    ['mazoPeligros', op.mazoPeligros],
    ['descartesPeligros', op.descartesPeligros],
    ['apartados', op.apartados ?? DATOS.mazosPredefinidos.apartadosDePeligros],
    ['mazoHistoria', op.mazoHistoria ?? historiaCompleta().filter((id) => !(op.pasajeros ?? []).includes(id))],
    ['pasajeros', op.pasajeros],
  ]
  for (const [zona, ids] of zonas) for (const id of ids ?? []) crearCopia(s, id, zona)
  for (const [id, n] of Object.entries(op.avance ?? {})) {
    const m = s.zonas.misionesDisponibles.find((i) => s.cartas[i]?.id === id)
    if (m) copiaDe(s, m).avance = n
  }
  s.reputacion = op.reputacion ?? 0
  s.temporales = [...(op.temporales ?? [])]

  const turno = op.turno ?? 1
  const empezar = op.empezarEn ?? 'jugarCartas'
  if (empezar === 'inicio') {
    s.turno = turno - 1
    encolar(s, { tipo: 'turno', paso: 'inicio' })
  } else {
    s.turno = turno
    encolar(s, { tipo: 'turno', paso: empezar === 'jugarCartas' ? 'jugar' : empezar })
  }
  ejecutar(s)
  comprobarInvariantes(s)
  return s
}

// ---------------------------------------------------------------------------
// Invariantes

function comprobarJson(valor: unknown, ruta: string): void {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new Error(`Número no válido en ${ruta}`)
    return
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => comprobarJson(v, `${ruta}[${i}]`))
    return
  }
  if (typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    for (const [k, v] of Object.entries(valor)) {
      if (v === undefined) throw new Error(`Valor indefinido en ${ruta}.${k}`)
      comprobarJson(v, `${ruta}.${k}`)
    }
    return
  }
  throw new Error(`El estado no es JSON simple en ${ruta}`)
}

/**
 * Lanza un error si el estado incumple alguna regla interna del motor.
 * `json: false` se salta la comprobación de que es JSON simple (la más cara), para las pruebas masivas.
 */
export function comprobarInvariantes(s: Estado, { json = true }: { json?: boolean } = {}): void {
  const vistas = new Map<InstId, Zona>()
  for (const z of ZONAS) {
    for (const inst of s.zonas[z]) {
      if (vistas.has(inst)) throw new Error(`La copia ${inst} está en ${vistas.get(inst)} y en ${z}`)
      vistas.set(inst, z)
    }
  }
  for (const inst of Object.keys(s.cartas) as InstId[]) {
    if (!vistas.has(inst)) throw new Error(`La copia ${inst} no está en ninguna zona`)
  }
  if (vistas.size !== Object.keys(s.cartas).length) throw new Error('Hay copias en zonas que no existen')

  if (json) comprobarJson(s, 'estado')

  for (const [inst, c] of Object.entries(s.cartas)) {
    if (c.heridas < 0 || (c.fichas ?? 0) < 0 || c.avance < 0) throw new Error(`Contador negativo en ${inst}`)
  }
  if (s.danoBarco < 0 || s.reputacion < 0) throw new Error('Contador negativo en la partida')

  if (s.resultado) {
    if (s.pila.length > 0 || s.pendiente) throw new Error('La partida ha terminado pero quedan tareas o decisiones')
  } else {
    if (!s.pendiente) throw new Error('La partida está parada sin ninguna decisión pendiente')
    const arriba = s.pila[s.pila.length - 1]
    if (arriba?.id !== s.pendiente.tarea) throw new Error('La decisión pendiente no es de la tarea de arriba')
  }

  const enJuego = [...s.zonas.tripulacion, ...s.zonas.mejoras, ...s.zonas.rehenes]
  for (const m of s.zonas.mejoras) {
    const v = s.cartas[m]?.vinculadaA
    const reasignando = s.pila.some((t) => t.tipo === 'reasignarTesoro' && t.tesoro === m)
    const portadorEnJuego = v && v !== 'barco' && (s.zonas.tripulacion.includes(v) || s.zonas.rehenes.includes(v) || s.zonas.incautadas.includes(v))
    if (v !== 'barco' && !portadorEnJuego && !reasignando) {
      throw new Error(`La Mejora ${m} no está vinculada a nada`)
    }
  }
  const unicas = enJuego.map((i) => s.cartas[i]?.id ?? '').filter((id) => id && esUnica(id))
  if (new Set(unicas).size !== unicas.length) throw new Error('Hay dos copias de una carta única en juego')
}

// ---------------------------------------------------------------------------
// Jugador de pruebas

export class Jugador {
  estado: Estado

  constructor(estado: Estado) {
    comprobarInvariantes(estado)
    this.estado = estado
  }

  static partida(op: OpcionesPartida): Jugador {
    return new Jugador(nuevaPartida(op))
  }

  static en(op: OpcionesSituacion = {}): Jugador {
    return new Jugador(montar(op))
  }

  /**
   * Zarpa a la primera misión de `misiones` (por defecto, «Cobrar la deuda»), cubriendo la Distancia con
   * `cubrir` si hace falta, y se para en la primera decisión de la misión.
   */
  static enMision(op: OpcionesSituacion & { cubrir?: CartaId[] }): Jugador {
    const { cubrir, ...resto } = op
    const misiones = resto.misiones ?? [MISIONES_DE_PRUEBA.ciu3]
    const j = Jugador.en({ empezarEn: 'quedarseOZarpar', escenario: ['calma_ev'], mazoCapitan: ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje'], ...resto, misiones })
    j.zarpar(misiones[0] ?? MISIONES_DE_PRUEBA.ciu3)
    if (cubrir) j.cubrir(...cubrir)
    return j
  }

  get decision(): Decision {
    const d = this.estado.pendiente
    if (!d) throw new Error(`No hay decisión pendiente (resultado: ${JSON.stringify(this.estado.resultado)})`)
    return d
  }

  responder(e: Eleccion): this {
    this.estado = responder(this.estado, e)
    comprobarInvariantes(this.estado)
    return this
  }

  /** Copia de una carta por su identificador, buscando en las zonas indicadas (o en todas). */
  inst(id: CartaId, zonas: readonly Zona[] = ZONAS): InstId {
    for (const z of zonas) {
      const inst = this.estado.zonas[z].find((i) => this.estado.cartas[i]?.id === id)
      if (inst) return inst
    }
    throw new Error(`No encuentro «${id}» en ${zonas.join(', ')}`)
  }

  private accion(prueba: (a: Accion) => boolean, descripcion: string): this {
    const d = this.decision
    if (d.tipo !== 'ventanaAccion') throw new Error(`Se esperaba una ventana de acción y la decisión es «${d.tipo}»`)
    const accion = d.acciones.find(prueba)
    if (!accion) throw new Error(`La acción «${descripcion}» no está disponible`)
    return this.responder({ tipo: 'accion', accion })
  }

  private idDe(inst: InstId): CartaId {
    return copiaDe(this.estado, inst).id
  }

  /** ¿Se ofrece esta acción ahora? */
  ofrece(tipo: Accion['tipo'], id?: CartaId, destino?: CartaId | 'barco'): boolean {
    const d = this.estado.pendiente
    if (d?.tipo !== 'ventanaAccion') return false
    return d.acciones.some((a) => this.coincide(a, tipo, id, destino))
  }

  private coincide(a: Accion, tipo: Accion['tipo'], id?: CartaId, destino?: CartaId | 'barco'): boolean {
    if (a.tipo !== tipo) return false
    if (a.tipo === 'reclutar' || a.tipo === 'despedir') return id === undefined || this.idDe(a.carta) === id
    if (a.tipo === 'adquirir') {
      if (id !== undefined && this.idDe(a.carta) !== id) return false
      if (destino === undefined) return true
      return destino === 'barco' ? a.destino === 'barco' : a.destino !== 'barco' && this.idDe(a.destino) === destino
    }
    if (a.tipo === 'usar') return id === undefined || a.uso.clave === id
    return true
  }

  reclutar(id: CartaId): this {
    return this.accion((a) => this.coincide(a, 'reclutar', id), `reclutar ${id}`)
  }

  adquirir(id: CartaId, destino: CartaId | 'barco' = 'barco'): this {
    return this.accion((a) => this.coincide(a, 'adquirir', id, destino), `adquirir ${id} para ${destino}`)
  }

  despedir(id: CartaId): this {
    return this.accion((a) => this.coincide(a, 'despedir', id), `despedir ${id}`)
  }

  /** Usa una capacidad por su clave: en una ventana de acción, o como capacidad libre u ofrecida. */
  usar(clave: string): this {
    const d = this.decision
    if (d.tipo === 'ventanaAccion') return this.accion((a) => this.coincide(a, 'usar', clave), `usar ${clave}`)
    const uso = [...(d.tipo === 'ofrecer' ? d.usos : []), ...(d.libres ?? [])].find((u) => u.clave === clave)
    if (!uso) throw new Error(`La capacidad «${clave}» no se ofrece ahora`)
    return this.responder({ tipo: 'usar', uso })
  }

  terminar(): this {
    return this.accion((a) => a.tipo === 'terminarPaso', 'terminar el paso')
  }

  /** Elige cartas por su identificador entre las candidatas (cada identificador, una copia distinta). */
  elegir(...ids: CartaId[]): this {
    const d = this.decision
    if (d.tipo !== 'elegirCartas') throw new Error(`Se esperaba elegir cartas y la decisión es «${d.tipo}»`)
    const usadas = new Set<InstId>()
    const elegidas = ids.map((id) => {
      const inst = d.candidatas.find((c) => !usadas.has(c) && this.idDe(c) === id)
      if (!inst) throw new Error(`«${id}» no está entre las cartas que se pueden elegir`)
      usadas.add(inst)
      return inst
    })
    return this.responder({ tipo: 'cartas', ids: elegidas })
  }

  ninguna(): this {
    return this.responder({ tipo: 'cartas', ids: [] })
  }

  opcion(clave: string): this {
    return this.responder({ tipo: 'opcion', clave })
  }

  pasar(): this {
    return this.responder({ tipo: 'pasar' })
  }

  /** Otear (fase 10b, también el mazo de Misiones): deja todas las cartas arriba, en el orden en que estaban. */
  resolverOteo(): this {
    while (this.estado.pendiente && ['otear', 'ordenarOteo'].includes(this.decision.motivo.clave)) {
      const d = this.decision
      if (d.tipo === 'elegirOpcion') this.responder({ tipo: 'opcion', clave: 'arriba' })
      else if (d.tipo === 'elegirCartas') this.responder({ tipo: 'cartas', ids: [...d.candidatas] })
      else break
    }
    return this
  }

  /** Pasa todas las Interrupciones y Respuestas que se ofrezcan ahora, hasta la siguiente decisión de otro tipo. */
  pasarOfertas(): this {
    while (this.estado.pendiente?.tipo === 'ofrecer') this.pasar()
    return this
  }

  /** ¿Se ofrece ahora esta capacidad (como Interrupción, Respuesta, capacidad libre o acción)? */
  ofreceCapacidad(clave: string): boolean {
    const d = this.estado.pendiente
    if (!d) return false
    const usos = [...(d.tipo === 'ofrecer' ? d.usos : []), ...(d.libres ?? [])]
    if (d.tipo === 'ventanaAccion') for (const a of d.acciones) if (a.tipo === 'usar') usos.push(a.uso)
    return usos.some((u) => u.clave === clave)
  }

  repartir(reparto: Record<CartaId, number>): this {
    const d = this.decision
    if (d.tipo !== 'repartir') throw new Error(`Se esperaba un reparto y la decisión es «${d.tipo}»`)
    const n: Partial<Record<InstId, number>> = {}
    for (const [id, cantidad] of Object.entries(reparto)) {
      const inst = (Object.keys(d.maximos) as InstId[]).find((i) => this.idDe(i) === id)
      if (!inst) throw new Error(`No se puede repartir a «${id}»`)
      n[inst] = cantidad
    }
    return this.responder({ tipo: 'reparto', n })
  }

  /** Zarpa a una misión disponible (por su identificador, p. ej. «prueba-I»). */
  zarpar(mision: CartaId): this {
    if (this.decision.motivo.clave === 'jugarCartas') this.terminar()
    return this.opcion(`zarpar:${this.inst(mision, ['misionesDisponibles'])}`)
  }

  /** Cubre la Distancia con estos Tripulantes y cartas (identificadores). */
  cubrir(...ids: CartaId[]): this {
    const d = this.decision
    if (d.tipo !== 'cubrirDistancia') throw new Error(`Se esperaba cubrir la Distancia y la decisión es «${d.tipo}»`)
    const usadas = new Set<InstId>()
    const elegidas = ids.map((id) => {
      const inst = [...d.tripulantes, ...d.cartas].find((c) => !usadas.has(c) && this.idDe(c) === id)
      if (!inst) throw new Error(`«${id}» no sirve para cubrir la Distancia`)
      usadas.add(inst)
      return inst
    })
    return this.responder({ tipo: 'cartas', ids: elegidas })
  }

  /** Elige la opción de la Prueba (por su habilidad) y compromete Tripulantes y cartas (identificadores). */
  comprometer(hab: 'NAV' | 'COM' | 'EXP', tripulantes: CartaId[] = [], cartas: CartaId[] = []): this {
    const d = this.decision
    if (d.tipo !== 'comprometer') throw new Error(`Se esperaba comprometer y la decisión es «${d.tipo}»`)
    const opcion = d.opciones.findIndex((o) => o.hab === hab)
    if (opcion < 0) throw new Error(`La Prueba no tiene opción de ${hab}`)
    const buscar = (lista: readonly InstId[], ids: CartaId[]) => {
      const usadas = new Set<InstId>()
      return ids.map((id) => {
        const inst = lista.find((c) => !usadas.has(c) && this.idDe(c) === id)
        if (!inst) throw new Error(`«${id}» no se puede comprometer`)
        usadas.add(inst)
        return inst
      })
    }
    return this.responder({ tipo: 'compromiso', opcion, tripulantes: buscar(d.tripulantes, tripulantes), cartas: buscar(d.cartas, cartas) })
  }

  retirarse(): this {
    return this.accion((a) => a.tipo === 'retirarse', 'retirarse')
  }

  /** En la ventana de la Prueba, resolverla; tras un encuentro, revelar la siguiente carta. */
  seguir(): this {
    return this.terminar()
  }

  /** Avance de una misión (disponible o en curso). */
  avance(mision: CartaId): number {
    return copiaDe(this.estado, this.inst(mision, ['misionesDisponibles', 'misionesSuperadas', 'mazoMisiones'])).avance
  }

  /** Atajo: termina Jugar cartas, se queda en puerto con dos opciones y no descarta nada al final. */
  pasarTurnoEnPuerto(opciones: [string, string] = ['astillero', 'taberna']): this {
    if (this.decision.motivo.clave === 'jugarCartas') this.terminar()
    if (this.decision.motivo.clave === 'quedarseOZarpar') this.opcion('quedarse')
    for (const o of opciones) {
      if (this.decision.motivo.clave !== 'opcionPuerto') break
      // Si la opción no se ofrece («Cuarentena» cierra la Taberna), la primera que quede.
      const d = this.decision
      const claves = d.tipo === 'elegirOpcion' ? d.opciones.map((x) => x.clave) : []
      this.opcion(claves.includes(o) ? o : (claves[0] ?? o))
      while (this.estado.pendiente && ['repartir', 'tablon', 'soplos'].includes(this.decision.motivo.clave)) {
        const d = this.decision
        if (d.tipo === 'repartir') {
          const n: Partial<Record<InstId, number>> = {}
          let resto = d.cantidad
          for (const [inst, max] of Object.entries(d.maximos) as [InstId, number][]) {
            n[inst] = Math.min(max, resto)
            resto -= n[inst] ?? 0
          }
          this.responder({ tipo: 'reparto', n })
        } else if (d.tipo === 'elegirCartas') {
          this.responder({ tipo: 'cartas', ids: d.candidatas.slice(0, d.min) })
        }
      }
    }
    if (this.estado.pendiente && this.decision.motivo.clave === 'descartarFinal') this.ninguna()
    // Al final del turno puede haber Interrupciones que ofrecer (Envenenado hiere, el Grumete puede evitarlo).
    return this.pasarOfertas()
  }

  /** Identificadores de las cartas de una zona, de arriba abajo. */
  zona(z: Zona): CartaId[] {
    return this.estado.zonas[z].map((i) => this.idDe(i))
  }

  /** La primera copia de una carta (en juego si la hay). */
  copia(id: CartaId): Copia {
    return copiaDe(this.estado, this.inst(id, ['tripulacion', 'mejoras', 'rehenes', ...ZONAS]))
  }

  zonaDe(id: CartaId): Zona {
    return zonaDe(this.estado, this.inst(id))
  }

  valor(c: Consulta): number {
    return valor(this.estado, c)
  }

  /** Fichas de Estado de un Tripulante. */
  estados(id: CartaId): string[] {
    return [...(this.copia(id).estados ?? [])]
  }

  get estadosBarco(): string[] {
    return [...(this.estado.estadosBarco ?? [])]
  }

  get registro(): string[] {
    return this.estado.registro.map((r) => r.texto)
  }
}
