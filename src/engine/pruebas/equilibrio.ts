// Simulación de muchas partidas con un jugador automático y su informe de equilibrio.

import { barajarLista, sembrar } from '../azar.ts'
import { capacidadesDe } from '../capacidades/index.ts'
import { CATALOGO, esCartaDelJugador, nombreDe, porId, tipoDe } from '../catalogo.ts'
import { DATOS } from '../datos.ts'
import { copia } from '../estado.ts'
import { LIMITES } from '../mazos.ts'
import { responder } from '../motor.ts'
import { nuevaPartida } from '../preparacion.ts'
import type { CartaId, Estado, InstId } from '../tipos.ts'
import { comprobarInvariantes } from './situacion.ts'
import type { JugadorAutomatico } from './jugadores.ts'

const MAXIMO_RESPUESTAS = 8000

/** Lo que se hizo con una carta en una partida. */
export interface UsoDeCarta {
  reclutada: number
  adquirida: number
  /** Evento jugado por su efecto. */
  jugada: number
  /** Capacidad de la carta usada (Tripulantes, Mejoras, Tesoros). */
  capacidad: number
  /** Descartada por sus iconos (al comprometer o al cubrir la Distancia). */
  iconos: number
}

/** Lo que hizo una carta de Peligro en una partida (como encuentro, desde que se revela hasta el siguiente). */
export interface DanoDePeligro {
  reveladas: number
  pruebas: number
  fallos: number
  heridas: number
  dano: number
  avancePerdido: number
  rehenes: number
  muertes: number
  /** La misión terminó retirada o hundida mientras era la carta en curso. */
  retiradas: number
  hundidas: number
  /** Como Destino: veces y Pruebas falladas con él. */
  destinos: number
  destinosFallados: number
}

export interface Partida {
  semilla: number
  final: Estado
  gana: boolean
  turnoFinal: number
  reputacion: number
  motivo: string
  hundimientos: number
  muertes: number
  /** Heridas sufridas durante las misiones (de que zarpas a que vuelves a puerto). */
  heridasEnMision: number
  pruebas: { encuentro: string; superada: boolean }[]
  /** Misiones (por carta): ofrecidas para zarpar, elegidas y su resultado. */
  ofrecidas: CartaId[]
  zarpes: CartaId[]
  resultados: { mision: CartaId; resultado: 'superada' | 'retirada' | 'hundida' }[]
  /** Reputación ganada (o perdida) en cada zarpe: durante la misión y con su recompensa. */
  repPorZarpe: { mision: CartaId; rep: number }[]
  rehenesPerdidos: number
  /** Tripulantes que quedaron rehenes (los rescatara o no). */
  capturados: number
  entradasEnMazo: number
  retiradasDelJuego: number
  mazoMisionBarajado: number
  mazoDeMuelle: CartaId[]
  cartas: Record<CartaId, UsoDeCarta>
  /** Veces que se usó cada capacidad, por su clave. */
  capacidades: Record<string, number>
  /** Daño por carta de Peligro. */
  peligros: Record<CartaId, DanoDePeligro>
  /** Orden del mazo de Escenario al empezar (las cartas que se jugarán, de arriba abajo). */
  ordenEscenario: CartaId[]
  /** Lo que eligió el jugador en los «Elige» de las cartas de Escenario. */
  eleccionesEscenario: { carta: CartaId; texto: string }[]
}

function danoDe(p: Partida, carta: CartaId): DanoDePeligro {
  p.peligros[carta] ??= { reveladas: 0, pruebas: 0, fallos: 0, heridas: 0, dano: 0, avancePerdido: 0, rehenes: 0, muertes: 0, retiradas: 0, hundidas: 0, destinos: 0, destinosFallados: 0 }
  return p.peligros[carta]
}

function usoDe(p: Partida, carta: CartaId): UsoDeCarta {
  p.cartas[carta] ??= { reclutada: 0, adquirida: 0, jugada: 0, capacidad: 0, iconos: 0 }
  return p.cartas[carta]
}

/** Un mazo de muelle legal al azar: 20 cartas de las de la caja (con sus copias). */
export function mazoDeMuelleAlAzar(semilla: number): CartaId[] {
  const caja: CartaId[] = []
  for (const c of [...DATOS.tripulantes, ...DATOS.mejorasBarco, ...DATOS.mejorasTripulante]) {
    for (let i = 0; i < c.copias; i++) caja.push(c.id)
  }
  const azar = { azar: sembrar(`muelle-${semilla}`) }
  barajarLista(azar, caja)
  return caja.slice(0, LIMITES.muelle.max)
}

/** Juega una partida entera con un jugador automático y recoge sus sucesos. */
export function jugarPartida(
  semilla: number,
  jugador: JugadorAutomatico,
  { invariantes = false, mazoDeMuelle, variante }: { invariantes?: boolean; mazoDeMuelle?: CartaId[]; variante?: Estado['variante'] } = {},
): Partida {
  let s = nuevaPartida({ semilla, ...(mazoDeMuelle ? { mazoDeMuelle } : {}), ...(variante ? { variante } : {}) })
  const capitan = copia(s, s.capitan).id
  const p: Partida = {
    semilla,
    final: s,
    gana: false,
    turnoFinal: 0,
    reputacion: 0,
    motivo: '',
    hundimientos: 0,
    muertes: 0,
    heridasEnMision: 0,
    pruebas: [],
    ofrecidas: [],
    zarpes: [],
    resultados: [],
    repPorZarpe: [],
    rehenesPerdidos: 0,
    capturados: 0,
    entradasEnMazo: 0,
    retiradasDelJuego: 0,
    mazoMisionBarajado: 0,
    mazoDeMuelle: mazoDeMuelle ?? [...DATOS.mazosPredefinidos.mazoDeMuelle],
    cartas: {},
    capacidades: {},
    peligros: {},
    ordenEscenario: s.zonas.mazoEscenario.map((c) => copia(s, c).id),
    eleccionesEscenario: [],
  }
  // La carta de Peligro cuyo encuentro está en curso (el daño se le apunta a ella) y el Destino de la Prueba.
  let enCurso: CartaId | null = null
  let destinoEnCurso: CartaId | null = null
  // La reputación que cambia desde que zarpas hasta que empieza el turno siguiente se apunta a esa misión.
  let zarpeAbierto: { mision: CartaId; rep: number } | null = null
  for (let n = 0; !s.resultado && n < MAXIMO_RESPUESTAS; n++) {
    const d = s.pendiente
    if (!d) throw new Error(`Partida ${semilla} parada sin decisión`)
    if (d.tipo === 'elegirOpcion' && d.motivo.clave === 'quedarseOZarpar') {
      for (const o of d.opciones) if (o.clave.startsWith('zarpar:')) p.ofrecidas.push(copia(s, o.clave.slice(7) as InstId).id)
    }
    const eleccion = jugador(s, d)
    // Los «Elige» de las cartas de Escenario: qué opción toma el jugador.
    if (d.tipo === 'elegirOpcion' && d.motivo.clave === 'elegirEfectos' && d.motivo.carta && porId(d.motivo.carta).tipo === 'escenario' && eleccion.tipo === 'opcion') {
      const texto = d.opciones.find((o) => o.clave === eleccion.clave)?.texto ?? eleccion.clave
      p.eleccionesEscenario.push({ carta: d.motivo.carta, texto })
    }
    s = responder(s, eleccion)
    if (invariantes) comprobarInvariantes(s, { json: false })
    for (const r of s.registro) {
      if (r.tipo === 'turno') zarpeAbierto = null
      const dato = r.dato
      if (!dato) continue
      if (dato.tipo === 'reputacion' && zarpeAbierto) zarpeAbierto.rep += dato.n
      switch (dato.tipo) {
        case 'prueba':
          p.pruebas.push({ encuentro: `${dato.encuentro} (${nombreDe(dato.peligro)})`, superada: dato.superada })
          if (enCurso) {
            danoDe(p, enCurso).pruebas++
            if (!dato.superada) danoDe(p, enCurso).fallos++
          }
          if (destinoEnCurso && !dato.superada) danoDe(p, destinoEnCurso).destinosFallados++
          destinoEnCurso = null
          break
        case 'revelado': {
          const id = s.cartas[dato.inst]?.id
          if (!id || porId(id).tipo !== 'peligro') break
          if (dato.como === 'encuentro') {
            enCurso = id
            danoDe(p, id).reveladas++
          } else if (dato.como === 'destino') {
            destinoEnCurso = id
            danoDe(p, id).destinos++
          }
          break
        }
        case 'heridas':
          if (enCurso) danoDe(p, enCurso).heridas += dato.n
          if (s.mision || enCurso) p.heridasEnMision += dato.n
          break
        case 'dano':
          if (enCurso) danoDe(p, enCurso).dano += dato.n
          break
        case 'avancePerdido':
          if (enCurso) danoDe(p, enCurso).avancePerdido += dato.n
          break
        case 'capturado':
          p.capturados++
          if (enCurso) danoDe(p, enCurso).rehenes++
          break
        case 'zarpar':
          p.zarpes.push(dato.mision)
          zarpeAbierto = { mision: dato.mision, rep: 0 }
          p.repPorZarpe.push(zarpeAbierto)
          break
        case 'finMision':
          p.resultados.push({ mision: dato.mision, resultado: dato.resultado })
          if (enCurso && dato.resultado === 'retirada') danoDe(p, enCurso).retiradas++
          if (enCurso && dato.resultado === 'hundida') danoDe(p, enCurso).hundidas++
          enCurso = null
          break
        case 'hundimiento':
          p.hundimientos++
          break
        case 'derrota':
          if (dato.carta !== capitan) p.muertes++
          if (enCurso && s.mision) danoDe(p, enCurso).muertes++
          break
        case 'rehenPerdido':
          p.rehenesPerdidos++
          break
        case 'entraEnMazo':
          p.entradasEnMazo++
          break
        case 'seRetira':
          p.retiradasDelJuego++
          break
        case 'mazoMisionBarajado':
          p.mazoMisionBarajado++
          break
        case 'reclutar':
          usoDe(p, dato.carta).reclutada++
          break
        case 'adquirir':
          usoDe(p, dato.carta).adquirida++
          break
        case 'usar':
          p.capacidades[dato.clave] = (p.capacidades[dato.clave] ?? 0) + 1
          if (!esCartaDelJugador(dato.carta)) break
          if (tipoDe(dato.carta) === 'evento') usoDe(p, dato.carta).jugada++
          else usoDe(p, dato.carta).capacidad++
          break
        case 'iconos':
          for (const c of dato.cartas) usoDe(p, c).iconos++
          break
        case 'superadaAMitad':
          break
      }
    }
    s.registro = [] // Para simular basta con los sucesos; así no crece en cada paso.
  }
  if (invariantes) comprobarInvariantes(s)
  p.final = s
  p.gana = s.resultado?.gana ?? false
  p.turnoFinal = s.turno
  p.reputacion = s.reputacion
  p.motivo = s.resultado?.motivo ?? 'sin terminar'
  return p
}

/** Capacidades de las cartas del jugador que se usan (no las constantes de números) y deberían salir en la simulación. */
export function capacidadesDelJugador(): string[] {
  const tipos = new Set(['tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'tesoro'])
  const claves: string[] = []
  for (const e of CATALOGO) {
    if (!tipos.has(e.tipo)) continue
    for (const cap of capacidadesDe(e.id)) {
      if ((cap.ventana !== 'constante' && cap.desde !== 'temporal') || cap.clave.endsWith('.sinAgotar')) claves.push(cap.clave)
    }
  }
  return claves
}

// ---------------------------------------------------------------------------
// Informe

function porcentaje(n: number, total: number): string {
  return total === 0 ? '—' : `${((100 * n) / total).toFixed(1)} %`
}

function media(valores: readonly number[], decimales = 1): string {
  return valores.length === 0 ? '—' : (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(decimales)
}

function puntos(a: number, b: number): string {
  if (Number.isNaN(a) || Number.isNaN(b)) return '—'
  const d = a - b
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}`
}

function victorias(partidas: readonly Partida[]): number {
  return partidas.length === 0 ? Number.NaN : (100 * partidas.filter((p) => p.gana).length) / partidas.length
}

function pct(v: number): string {
  return Number.isNaN(v) ? '—' : `${v.toFixed(1)} %`
}

/** Turnos que cuentan como «pronto» para comparar cartas de Escenario (todas las partidas los juegan casi siempre). */
const PRONTO = 6

/**
 * Fase 8 · qué cartas de Escenario hacen más daño. Se compara, por el orden del mazo al empezar (que no depende de cómo
 * vaya la partida), las partidas en que la carta sale en los 6 primeros turnos con las demás (sale después o no sale).
 * Así una partida corta, que revela menos cartas, no ensucia la cuenta.
 */
function tablaDeEscenario(partidas: readonly Partida[]): string[] {
  const lineas = [
    '## Cartas de Escenario',
    '',
    `Partidas normales y con mazos variados juntas (${partidas.length}). «Pronto»: la carta está entre las ${PRONTO} primeras del mazo de Escenario al empezar la partida; «después o nunca»: el resto. La diferencia, en puntos de victoria, dice cuánto daña (negativa) o ayuda (positiva) tenerla pronto. Con estas partidas, una diferencia de menos de 3 puntos puede ser ruido.`,
    '',
    '| Carta | Partidas «pronto» | Victorias «pronto» | Victorias «después o nunca» | Diferencia | Lo que elige el jugador automático |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  const filas = DATOS.escenario.map((e) => {
    const pronto = partidas.filter((p) => p.ordenEscenario.slice(0, PRONTO).includes(e.id))
    const resto = partidas.filter((p) => !p.ordenEscenario.slice(0, PRONTO).includes(e.id))
    const elecciones = partidas.flatMap((p) => p.eleccionesEscenario.filter((x) => x.carta === e.id))
    const cuenta = new Map<string, number>()
    for (const x of elecciones) cuenta.set(x.texto, (cuenta.get(x.texto) ?? 0) + 1)
    const eligio = [...cuenta].sort((a, b) => b[1] - a[1]).map(([texto, n]) => `${texto}: ${porcentaje(n, elecciones.length)}`).join(' · ')
    return { e, pronto, resto, diferencia: victorias(pronto) - victorias(resto), eligio }
  })
  for (const f of filas.sort((a, b) => a.diferencia - b.diferencia)) {
    lineas.push(`| ${f.e.nombre} | ${f.pronto.length} | ${pct(victorias(f.pronto))} | ${pct(victorias(f.resto))} | ${puntos(victorias(f.pronto), victorias(f.resto))} | ${f.eligio || '—'} |`)
  }
  lineas.push('')
  return lineas
}

function causa(motivo: string): string {
  if (motivo.startsWith('Se ha acabado el tiempo')) return 'Se acaba el tiempo'
  if (motivo.startsWith('Tu Capitán')) return 'Capitán derrotado'
  if (motivo.startsWith('No queda ninguna misión')) return 'Sin misiones'
  return motivo
}

const NOMBRE_TIPO: Record<string, string> = {
  tripulante: 'Tripulante',
  mejoraBarco: 'Mejora de barco',
  mejoraTripulante: 'Mejora de tripulante',
  evento: 'Evento',
  habilidad: 'Habilidad',
}

/** ¿Se usó la carta en la partida? Tripulante reclutado, Mejora adquirida, Evento jugado o Habilidad descartada. */
function seUso(p: Partida, carta: CartaId): boolean {
  const u = p.cartas[carta]
  if (!u) return false
  switch (tipoDe(carta)) {
    case 'tripulante':
      return u.reclutada > 0
    case 'mejoraBarco':
    case 'mejoraTripulante':
      return u.adquirida > 0
    case 'evento':
      return u.jugada > 0
    default:
      return u.iconos > 0
  }
}

function veces(partidas: readonly Partida[], carta: CartaId, campo: keyof UsoDeCarta): number {
  return partidas.reduce((n, p) => n + (p.cartas[carta]?.[campo] ?? 0), 0)
}

function ordenDeCaja(a: CartaId, b: CartaId): number {
  return porId(a).num - porId(b).num
}

function tablaDeCartas(partidas: readonly Partida[], cartas: readonly CartaId[]): string[] {
  const lineas = [
    '| Carta | Tipo | Recluta / adquiere / juega | Usa su capacidad | Por iconos | Partidas en que se usó | % victorias si se usó | si no | Diferencia |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const c of [...cartas].sort(ordenDeCaja)) {
    const usada = partidas.filter((p) => seUso(p, c))
    const no = partidas.filter((p) => !seUso(p, c))
    const tipo = tipoDe(c)
    const principal =
      tipo === 'tripulante' ? veces(partidas, c, 'reclutada') : tipo === 'evento' ? veces(partidas, c, 'jugada') : tipo === 'habilidad' ? 0 : veces(partidas, c, 'adquirida')
    const capacidad = tipo === 'evento' || tipo === 'habilidad' ? '—' : String(veces(partidas, c, 'capacidad'))
    lineas.push(
      `| ${nombreDe(c)} | ${NOMBRE_TIPO[tipo] ?? tipo} | ${tipo === 'habilidad' ? '—' : principal} | ${capacidad} | ${veces(partidas, c, 'iconos')} | ${usada.length} | ${pct(victorias(usada))} | ${pct(victorias(no))} | ${puntos(victorias(usada), victorias(no))} |`,
    )
  }
  return lineas
}

/** Cuánto daño hace cada carta de Peligro del mazo, de más a menos. */
function tablaDePeligros(partidas: readonly Partida[]): string[] {
  const suma = new Map<CartaId, DanoDePeligro>()
  for (const p of partidas) {
    for (const [c, d] of Object.entries(p.peligros)) {
      const t = suma.get(c) ?? { reveladas: 0, pruebas: 0, fallos: 0, heridas: 0, dano: 0, avancePerdido: 0, rehenes: 0, muertes: 0, retiradas: 0, hundidas: 0, destinos: 0, destinosFallados: 0 }
      for (const k of Object.keys(t) as (keyof DanoDePeligro)[]) t[k] += d[k]
      suma.set(c, t)
    }
  }
  const enMazo = DATOS.mazosPredefinidos.mazoDePeligros
  // Índice de daño por vez que sale como encuentro: heridas 1, daño al Barco 1, Avance perdido 1, rehén 3,
  // Tripulante muerto 4, misión retirada o hundida 3.
  const indice = (d: DanoDePeligro) =>
    d.reveladas === 0 ? 0 : (d.heridas + d.dano + d.avancePerdido + 3 * d.rehenes + 4 * d.muertes + 3 * (d.retiradas + d.hundidas)) / d.reveladas
  const filas = enMazo.map((c) => ({ c, d: suma.get(c) ?? null })).sort((a, b) => (b.d ? indice(b.d) : 0) - (a.d ? indice(a.d) : 0))
  const f1 = (n: number, d: number) => (d === 0 ? '—' : (n / d).toFixed(2))
  const lineas = [
    '## Peligros: cuánto daño hace cada carta',
    '',
    'Cada carta del mazo de Peligros, de la que más daño hace a la que menos, contando lo que pasa desde que se revela como encuentro hasta que sale la siguiente (su Prueba, su Destino y lo que haga si se queda en juego mientras es la carta en curso). «Índice»: heridas + daño al Barco + Avance perdido + 3 por rehén + 4 por Tripulante muerto + 3 si la misión acaba retirada o hundida, por cada vez que sale. «Como Destino»: veces que salió como Destino y % de esas Pruebas que se fallaron.',
    '',
    '| Carta | Nivel | Sale | Pruebas | % fallo | Heridas / vez | Daño / vez | Avance perdido / vez | Rehenes | Muertes | Retiradas / hundidas | Índice | Como Destino | % fallo con su Destino |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const { c, d } of filas) {
    const e = porId(c)
    const nivel = e.tipo === 'peligro' ? e.carta.nivel : ''
    if (!d) {
      lineas.push(`| ${nombreDe(c)} | ${nivel} | 0 | — | — | — | — | — | — | — | — | — | — | — |`)
      continue
    }
    lineas.push(
      `| ${nombreDe(c)} | ${nivel} | ${d.reveladas} | ${d.pruebas} | ${porcentaje(d.fallos, d.pruebas)} | ${f1(d.heridas, d.reveladas)} | ${f1(d.dano, d.reveladas)} | ${f1(d.avancePerdido, d.reveladas)} | ${d.rehenes} | ${d.muertes} | ${d.retiradas} / ${d.hundidas} | ${indice(d).toFixed(2)} | ${d.destinos} | ${porcentaje(d.destinosFallados, d.destinos)} |`,
    )
  }
  lineas.push('')
  return lineas
}

/** Informe de equilibrio en Markdown. `variadas`: partidas con mazos de muelle al azar, para los datos por carta. */
/** Una variante de regla simulada, con sus partidas (las mismas semillas que las normales). */
export interface VarianteSimulada {
  nombre: string
  partidas: readonly Partida[]
}

/** Avance X / Y: la regla del juego frente a las anteriores, simuladas, con los datos que más cambian. */
function tablaDeVariantes(variantes: readonly VarianteSimulada[]): string[] {
  const lineas = [
    '## Avance con dos valores: la regla del juego y las anteriores',
    '',
    `Las mismas ${variantes[0]?.partidas.length ?? 0} partidas normales con cada regla para el Avance de un encuentro cuya Prueba no superas. Solo la regla del juego usa los valores de las cartas; las anteriores se simulan.`,
    '',
    '| Regla | Victorias | Derrotas por tiempo | Derrotas por Capitán | Retiradas por partida | Turnos por partida |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (const v of variantes) {
    const n = v.partidas.length
    const perdidas = v.partidas.filter((p) => !p.gana)
    const por = (c: string) => perdidas.filter((p) => causa(p.motivo) === c).length
    const retiradas = media(v.partidas.map((p) => p.resultados.filter((r) => r.resultado === 'retirada').length), 2)
    lineas.push(
      `| ${v.nombre} | ${porcentaje(n - perdidas.length, n)} | ${porcentaje(por('Se acaba el tiempo'), n)} | ${porcentaje(por('Capitán derrotado'), n)} | ${retiradas} | ${media(v.partidas.map((p) => p.turnoFinal))} |`,
    )
  }
  lineas.push('')
  return lineas
}

export function informe(partidas: readonly Partida[], titulo: string, variadas: readonly Partida[] = [], variantes: readonly VarianteSimulada[] = []): string {
  const total = partidas.length
  const ganadas = partidas.filter((p) => p.gana)
  const perdidas = partidas.filter((p) => !p.gana)
  const lineas: string[] = []
  lineas.push(`# Informe de equilibrio`, '', titulo, '')
  lineas.push(
    '> Lo juega un jugador automático sencillo y prudente, no un jugador experto: sirve para comparar versiones de las cartas, no como dificultad real. Una carta que el jugador automático usa mal parecerá floja.',
    '',
  )

  lineas.push('## Resumen', '', '| Dato | Valor |', '| --- | --- |')
  lineas.push(`| Partidas | ${total} |`)
  lineas.push(`| Victorias | ${ganadas.length} (${porcentaje(ganadas.length, total)}) |`)
  const panama = ganadas.filter((p) => p.motivo.includes('Panamá')).length
  lineas.push(`| … por reputación / por Panamá | ${ganadas.length - panama} / ${panama} |`)
  lineas.push(`| Reputación media al final | ${media(partidas.map((p) => p.reputacion))} |`)
  lineas.push(`| Turnos de media por partida | ${media(partidas.map((p) => p.turnoFinal))} |`)
  lineas.push(`| Turno medio de victoria | ${media(ganadas.map((p) => p.turnoFinal))} |`)
  lineas.push(`| Misiones superadas por partida | ${media(partidas.map((p) => p.resultados.filter((r) => r.resultado === 'superada').length), 2)} |`)
  const zarpes = partidas.flatMap((p) => p.repPorZarpe)
  lineas.push(`| Reputación media por zarpe | ${media(zarpes.map((z) => z.rep), 2)} |`)
  lineas.push(`| Hundimientos por partida | ${media(partidas.map((p) => p.hundimientos), 2)} |`)
  lineas.push(`| Tripulantes muertos por partida | ${media(partidas.map((p) => p.muertes), 2)} |`)
  lineas.push(`| Rehenes capturados / perdidos por partida | ${media(partidas.map((p) => p.capturados), 2)} / ${media(partidas.map((p) => p.rehenesPerdidos), 2)} |`)
  lineas.push(`| Misiones retiradas por partida | ${media(partidas.map((p) => p.resultados.filter((r) => r.resultado === 'retirada').length), 2)} |`)
  if (variadas.length > 0) lineas.push(`| Victorias con mazos de muelle variados (${variadas.length} partidas) | ${pct(victorias(variadas))} |`)
  lineas.push('')

  lineas.push('## Causas de derrota', '', '| Causa | Partidas | % de las derrotas |', '| --- | --- | --- |')
  const causas = new Map<string, number>()
  for (const p of perdidas) causas.set(causa(p.motivo), (causas.get(causa(p.motivo)) ?? 0) + 1)
  for (const [c, n] of [...causas].sort((a, b) => b[1] - a[1])) lineas.push(`| ${c} | ${n} | ${porcentaje(n, perdidas.length)} |`)
  lineas.push('')

  if (variantes.length > 0) lineas.push(...tablaDeVariantes(variantes))

  lineas.push(...tablaDeEscenario([...partidas, ...variadas]))

  lineas.push('## Los 10 encuentros que más se fallan', '', 'Solo encuentros con al menos 20 Pruebas.', '', '| Encuentro (carta) | Pruebas | Fallos | % de fallo |', '| --- | --- | --- | --- |')
  const pruebas = new Map<string, { n: number; fallos: number }>()
  for (const p of partidas) {
    for (const x of p.pruebas) {
      const actual = pruebas.get(x.encuentro) ?? { n: 0, fallos: 0 }
      actual.n++
      if (!x.superada) actual.fallos++
      pruebas.set(x.encuentro, actual)
    }
  }
  const peores = [...pruebas]
    .filter(([, v]) => v.n >= 20)
    .sort((a, b) => b[1].fallos / b[1].n - a[1].fallos / a[1].n)
    .slice(0, 10)
  for (const [e, v] of peores) lineas.push(`| ${e} | ${v.n} | ${v.fallos} | ${porcentaje(v.fallos, v.n)} |`)
  lineas.push('')

  lineas.push(...tablaDePeligros(partidas))

  lineas.push(
    '## Misiones',
    '',
    'Por orden de la caja: cada cadena con sus capítulos I, II y III (y los II-a y II-b de las salidas dobles). «Ofrecida» cuenta cada turno en que se podía zarpar a ella; «evitada», las veces que se ofreció y no se eligió. «A medias»: la partida terminó durante la misión (Capitán derrotado o victoria). «Rep. por zarpe»: la reputación media que da cada vez que se zarpa a ella (recompensa, Gesta y lo que ganes o pierdas durante la misión, como un rehén perdido).',
    '',
    '| Misión | Cap. | Ofrecida | Zarpes | Superada | Retirada | Hundida | A medias | % evitada | % éxito al zarpar | Rep. por zarpe |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  )
  const misiones = new Map<CartaId, { ofrecida: number; zarpes: number; superada: number; retirada: number; hundida: number }>()
  const fila = (m: CartaId) => {
    const f = misiones.get(m) ?? { ofrecida: 0, zarpes: 0, superada: 0, retirada: 0, hundida: 0 }
    misiones.set(m, f)
    return f
  }
  for (const p of partidas) {
    for (const m of p.ofrecidas) fila(m).ofrecida++
    for (const m of p.zarpes) fila(m).zarpes++
    for (const r of p.resultados) fila(r.mision)[r.resultado]++
  }
  // Orden de la caja: por travesía, y dentro de cada una por capítulo (II-a antes que II-b).
  const ordenCapitulo = (m: CartaId) => {
    const e = porId(m)
    if (e.tipo !== 'capitulo') return [999, 0]
    const travesia = Math.min(...e.mision.capitulos.map((c) => c.num))
    return [travesia, ['I', 'II', 'III'].indexOf(e.carta.capitulo) * 10 + (e.carta.rama === 'b' ? 1 : 0)]
  }
  const ordenadas = [...misiones].sort((a, b) => {
    const [ta, ca] = ordenCapitulo(a[0])
    const [tb, cb] = ordenCapitulo(b[0])
    return (ta ?? 0) - (tb ?? 0) || (ca ?? 0) - (cb ?? 0)
  })
  for (const [m, f] of ordenadas) {
    const e = porId(m)
    const capitulo = e.tipo === 'capitulo' ? `${e.carta.capitulo}${e.carta.rama ? `-${e.carta.rama}` : ''}` : ''
    const medias = f.zarpes - f.superada - f.retirada - f.hundida
    const rep = zarpes.filter((z) => z.mision === m).map((z) => z.rep)
    lineas.push(
      `| ${nombreDe(m)} | ${capitulo} | ${f.ofrecida} | ${f.zarpes} | ${f.superada} | ${f.retirada} | ${f.hundida} | ${medias} | ${porcentaje(f.ofrecida - f.zarpes, f.ofrecida)} | ${porcentaje(f.superada, f.zarpes)} | ${rep.length > 0 ? media(rep, 2) : '—'} |`,
    )
  }
  lineas.push('')
  // Qué elige y qué evita el jugador automático (entre las que se le ofrecieron al menos 100 veces).
  const ofrecidas = ordenadas.filter(([, f]) => f.ofrecida >= 100)
  const porEvitar = [...ofrecidas].sort((a, b) => (b[1].ofrecida - b[1].zarpes) / b[1].ofrecida - (a[1].ofrecida - a[1].zarpes) / a[1].ofrecida)
  const nombrar = (lista: typeof ofrecidas) => lista.map(([m, f]) => `«${nombreDe(m)}» (${porcentaje(f.ofrecida - f.zarpes, f.ofrecida)})`).join(', ')
  lineas.push(
    `**Las que más evita** (de las que se le ofrecieron al menos 100 veces): ${nombrar(porEvitar.slice(0, 5))}.`,
    '',
    `**Las que más elige:** ${nombrar([...porEvitar].reverse().slice(0, 5))}.`,
    '',
  )

  // Datos por carta en la partida predefinida.
  const predefinidas = [...new Set([...DATOS.mazosPredefinidos.mazoDeMuelle, ...DATOS.mazosPredefinidos.mazoDelCapitan])]
  lineas.push(
    '## Cartas en la partida predefinida',
    '',
    '«Se usó»: un Tripulante reclutado, una Mejora adquirida, un Evento jugado por su efecto o una Habilidad descartada por sus iconos. Ojo: las partidas largas o que van bien usan más cartas, así que «usada contra no usada» exagera las diferencias; la medida limpia de las cartas del muelle está en la sección siguiente.',
    '',
    ...tablaDeCartas(partidas, predefinidas),
    '',
  )

  if (variadas.length > 0) {
    const delMuelle = [...new Set(variadas.flatMap((p) => p.mazoDeMuelle))]
    lineas.push(
      `## Cartas del muelle con mazos variados (${variadas.length} partidas)`,
      '',
      'Cada partida usa un mazo de muelle legal de 20 cartas sacado al azar de las 42 de la caja; el mazo del capitán es el predefinido. «Con / sin ella en el mazo» compara partidas que solo se diferencian por el azar del mazo: es la medida limpia de lo que aporta cada carta. Las diferencias de menos de unos 5 puntos son ruido.',
      '',
      '| Carta | Tipo | En el mazo | % victorias con ella en el mazo | sin ella | Diferencia | Recluta / adquiere | Usa su capacidad | % victorias si se usó | si no |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    )
    const filas = delMuelle.map((c) => {
      const con = variadas.filter((p) => p.mazoDeMuelle.includes(c))
      const sin = variadas.filter((p) => !p.mazoDeMuelle.includes(c))
      return { c, con, sin, diferencia: victorias(con) - victorias(sin) }
    })
    for (const { c, con, sin } of filas.sort((a, b) => b.diferencia - a.diferencia)) {
      const usada = variadas.filter((p) => seUso(p, c))
      const noUsada = con.filter((p) => !seUso(p, c))
      const tipo = tipoDe(c)
      const principal = tipo === 'tripulante' ? veces(variadas, c, 'reclutada') : veces(variadas, c, 'adquirida')
      lineas.push(
        `| ${nombreDe(c)} | ${NOMBRE_TIPO[tipo] ?? tipo} | ${con.length} | ${pct(victorias(con))} | ${pct(victorias(sin))} | ${puntos(victorias(con), victorias(sin))} | ${principal} | ${veces(variadas, c, 'capacidad')} | ${pct(victorias(usada))} | ${pct(victorias(noUsada))} |`,
      )
    }
    lineas.push('', '«Si no» en esta tabla: partidas en que la carta estaba en el mazo pero no se usó.', '')
  }

  // Capacidades que nunca se usaron (en todas las partidas del informe).
  const todas = [...partidas, ...variadas]
  const nunca = capacidadesDelJugador().filter((clave) => !todas.some((p) => (p.capacidades[clave] ?? 0) > 0))
  lineas.push('## Capacidades que el jugador automático no llegó a usar', '')
  lineas.push(nunca.length === 0 ? 'Ninguna: todas se usaron alguna vez.' : nunca.map((c) => `- ${c}`).join('\n'), '')

  lineas.push(
    '---',
    '',
    'Se genera con `npm run equilibrio` (por defecto 1000 partidas predefinidas, 2000 con mazos variados y otras 2000 con las reglas de Avance anteriores; `INFORME_PARTIDAS=200 npm run equilibrio` para menos). Las semillas son siempre las mismas, así que si no cambian las cartas ni el jugador automático, el informe sale idéntico.',
  )
  return lineas.join('\n')
}
