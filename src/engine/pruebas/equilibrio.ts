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
  /** Descartada por sus iconos (comprometer, reforzar o cubrir la Distancia). */
  iconos: number
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
  pruebas: { encuentro: string; superada: boolean }[]
  /** Misiones (por carta): ofrecidas para zarpar, elegidas y su resultado. */
  ofrecidas: CartaId[]
  zarpes: CartaId[]
  resultados: { mision: CartaId; resultado: 'superada' | 'retirada' | 'hundida' }[]
  rehenesPerdidos: number
  entradasEnMazo: number
  retiradasDelJuego: number
  mazoMisionBarajado: number
  mazoDeMuelle: CartaId[]
  cartas: Record<CartaId, UsoDeCarta>
  /** Veces que se usó cada capacidad, por su clave. */
  capacidades: Record<string, number>
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
  { invariantes = false, mazoDeMuelle }: { invariantes?: boolean; mazoDeMuelle?: CartaId[] } = {},
): Partida {
  let s = nuevaPartida(mazoDeMuelle ? { semilla, mazoDeMuelle } : { semilla })
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
    pruebas: [],
    ofrecidas: [],
    zarpes: [],
    resultados: [],
    rehenesPerdidos: 0,
    entradasEnMazo: 0,
    retiradasDelJuego: 0,
    mazoMisionBarajado: 0,
    mazoDeMuelle: mazoDeMuelle ?? [...DATOS.mazosPredefinidos.mazoDeMuelle],
    cartas: {},
    capacidades: {},
  }
  for (let n = 0; !s.resultado && n < MAXIMO_RESPUESTAS; n++) {
    const d = s.pendiente
    if (!d) throw new Error(`Partida ${semilla} parada sin decisión`)
    if (d.tipo === 'elegirOpcion' && d.motivo.clave === 'quedarseOZarpar') {
      for (const o of d.opciones) if (o.clave.startsWith('zarpar:')) p.ofrecidas.push(copia(s, o.clave.slice(7) as InstId).id)
    }
    s = responder(s, jugador(s, d))
    if (invariantes) comprobarInvariantes(s, { json: false })
    for (const r of s.registro) {
      const dato = r.dato
      if (!dato) continue
      switch (dato.tipo) {
        case 'prueba':
          p.pruebas.push({ encuentro: `${dato.encuentro} (${nombreDe(dato.peligro)})`, superada: dato.superada })
          break
        case 'zarpar':
          p.zarpes.push(dato.mision)
          break
        case 'finMision':
          p.resultados.push({ mision: dato.mision, resultado: dato.resultado })
          break
        case 'hundimiento':
          p.hundimientos++
          break
        case 'derrota':
          if (dato.carta !== capitan) p.muertes++
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

/** Informe de equilibrio en Markdown. `variadas`: partidas con mazos de muelle al azar, para los datos por carta. */
export function informe(partidas: readonly Partida[], titulo: string, variadas: readonly Partida[] = []): string {
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
  lineas.push(`| Turno medio de victoria | ${media(ganadas.map((p) => p.turnoFinal))} |`)
  lineas.push(`| Hundimientos por partida | ${media(partidas.map((p) => p.hundimientos), 2)} |`)
  lineas.push(`| Tripulantes muertos por partida | ${media(partidas.map((p) => p.muertes), 2)} |`)
  lineas.push(`| Rehenes perdidos por partida | ${media(partidas.map((p) => p.rehenesPerdidos), 2)} |`)
  if (variadas.length > 0) lineas.push(`| Victorias con mazos de muelle variados (${variadas.length} partidas) | ${pct(victorias(variadas))} |`)
  lineas.push('')

  lineas.push('## Causas de derrota', '', '| Causa | Partidas | % de las derrotas |', '| --- | --- | --- |')
  const causas = new Map<string, number>()
  for (const p of perdidas) causas.set(causa(p.motivo), (causas.get(causa(p.motivo)) ?? 0) + 1)
  for (const [c, n] of [...causas].sort((a, b) => b[1] - a[1])) lineas.push(`| ${c} | ${n} | ${porcentaje(n, perdidas.length)} |`)
  lineas.push('')

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

  lineas.push(
    '## Misiones',
    '',
    'Por orden de la caja: cada cadena con sus capítulos I, II y III. «Ofrecida» cuenta cada turno en que se podía zarpar a ella; «evitada», las veces que se ofreció y no se eligió. «A medias»: la partida terminó durante la misión (Capitán derrotado o victoria).',
    '',
    '| Misión | Cap. | Ofrecida | Zarpes | Superada | Retirada | Hundida | A medias | % evitada | % éxito al zarpar |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
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
  for (const [m, f] of [...misiones].sort((a, b) => porId(a[0]).num - porId(b[0]).num)) {
    const e = porId(m)
    const capitulo = e.tipo === 'capitulo' ? e.carta.capitulo : ''
    const medias = f.zarpes - f.superada - f.retirada - f.hundida
    lineas.push(
      `| ${nombreDe(m)} | ${capitulo} | ${f.ofrecida} | ${f.zarpes} | ${f.superada} | ${f.retirada} | ${f.hundida} | ${medias} | ${porcentaje(f.ofrecida - f.zarpes, f.ofrecida)} | ${porcentaje(f.superada, f.zarpes)} |`,
    )
  }
  lineas.push('')

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
    'Se genera con `npm run equilibrio` (por defecto 1000 partidas predefinidas y 2000 con mazos variados; `INFORME_PARTIDAS=200 npm run equilibrio` para menos). Las semillas son siempre las mismas, así que si no cambian las cartas ni el jugador automático, el informe sale idéntico.',
  )
  return lineas.join('\n')
}
