// Simulación de muchas partidas con un jugador automático y su informe de equilibrio.

import { nombreDe, porId } from '../catalogo.ts'
import { copia } from '../estado.ts'
import { responder } from '../motor.ts'
import { nuevaPartida } from '../preparacion.ts'
import type { CartaId, Estado, InstId } from '../tipos.ts'
import { comprobarInvariantes } from './situacion.ts'
import type { JugadorAutomatico } from './jugadores.ts'

const MAXIMO_RESPUESTAS = 5000

export interface Partida {
  semilla: number
  final: Estado
  gana: boolean
  turnoFinal: number
  reputacion: number
  motivo: string
  hundimientos: number
  muertes: number
  /** Pruebas: nombre del encuentro (y su carta) → intentos y fallos. */
  pruebas: { encuentro: string; superada: boolean }[]
  /** Misiones (por carta): ofrecidas para zarpar, elegidas y su resultado. */
  ofrecidas: CartaId[]
  zarpes: CartaId[]
  resultados: { mision: CartaId; resultado: 'superada' | 'retirada' | 'hundida' }[]
  rehenesPerdidos: number
  entradasEnMazo: number
  retiradasDelJuego: number
  mazoMisionBarajado: number
}

/** Juega una partida entera con un jugador automático y recoge sus sucesos. */
export function jugarPartida(semilla: number, jugador: JugadorAutomatico, { invariantes = false } = {}): Partida {
  let s = nuevaPartida({ semilla })
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
      if (dato.tipo === 'prueba') p.pruebas.push({ encuentro: `${dato.encuentro} (${nombreDe(dato.peligro)})`, superada: dato.superada })
      else if (dato.tipo === 'zarpar') p.zarpes.push(dato.mision)
      else if (dato.tipo === 'finMision') p.resultados.push({ mision: dato.mision, resultado: dato.resultado })
      else if (dato.tipo === 'hundimiento') p.hundimientos++
      else if (dato.tipo === 'derrota' && dato.carta !== capitan) p.muertes++
      else if (dato.tipo === 'rehenPerdido') p.rehenesPerdidos++
      else if (dato.tipo === 'entraEnMazo') p.entradasEnMazo++
      else if (dato.tipo === 'seRetira') p.retiradasDelJuego++
      else if (dato.tipo === 'mazoMisionBarajado') p.mazoMisionBarajado++
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

function porcentaje(n: number, total: number): string {
  return total === 0 ? '—' : `${((100 * n) / total).toFixed(1)} %`
}

function media(valores: readonly number[], decimales = 1): string {
  return valores.length === 0 ? '—' : (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(decimales)
}

function causa(motivo: string): string {
  if (motivo.startsWith('Se ha acabado el tiempo')) return 'Se acaba el tiempo'
  if (motivo.startsWith('Tu Capitán')) return 'Capitán derrotado'
  if (motivo.startsWith('No queda ninguna misión')) return 'Sin misiones'
  return motivo
}

/** Informe de equilibrio en Markdown. */
export function informe(partidas: readonly Partida[], titulo: string): string {
  const total = partidas.length
  const ganadas = partidas.filter((p) => p.gana)
  const perdidas = partidas.filter((p) => !p.gana)
  const lineas: string[] = []
  lineas.push(`# Informe de equilibrio`, '', titulo, '')
  lineas.push('> Lo juega un jugador automático sencillo y prudente, no un jugador experto: sirve para comparar versiones de las cartas, no como dificultad real.', '')

  lineas.push('## Resumen', '', '| Dato | Valor |', '| --- | --- |')
  lineas.push(`| Partidas | ${total} |`)
  lineas.push(`| Victorias | ${ganadas.length} (${porcentaje(ganadas.length, total)}) |`)
  const panama = ganadas.filter((p) => p.motivo.includes('Panamá')).length
  lineas.push(`| … por reputación / por Panamá | ${ganadas.length - panama} / ${panama} |`)
  lineas.push(`| Reputación media al final | ${media(partidas.map((p) => p.reputacion))} |`)
  lineas.push(`| Turno medio de victoria | ${media(ganadas.map((p) => p.turnoFinal))} |`)
  lineas.push(`| Hundimientos por partida | ${media(partidas.map((p) => p.hundimientos), 2)} |`)
  lineas.push(`| Tripulantes muertos por partida | ${media(partidas.map((p) => p.muertes), 2)} |`)
  lineas.push(`| Rehenes perdidos por partida | ${media(partidas.map((p) => p.rehenesPerdidos), 2)} |`, '')

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
  lineas.push('', '---', '', 'Se genera con `npm run equilibrio` (por defecto 1000 partidas; `INFORME_PARTIDAS=200 npm run equilibrio` para menos). Las semillas son siempre las mismas, así que si no cambian las cartas ni el jugador automático, el informe sale idéntico.')
  return lineas.join('\n')
}
