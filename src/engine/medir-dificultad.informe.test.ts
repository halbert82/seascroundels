// Informe de dificultad (5 de noviembre de 2026; sin informe en Markdown): de dónde salen las victorias y cuánto las
// bajan las maneras de endurecer el juego que se proponen a Albert. Solo mide: no cambia datos, reglas ni cartas.
//
//   MEDIR_DIFICULTAD=1 npx vitest run src/engine/medir-dificultad.informe.test.ts
//
// MEDIR_DIFICULTAD_MUELLE=inicio (por defecto: mazos de inicio, semillas 1–N) o =variados (muelle de 20 al azar de la
// caja, semillas 100000…, como el informe de equilibrio). INFORME_PARTIDAS: N (1000 por defecto; con muelles variados,
// el doble). MEDIR_VARIANTE: la variante de medida (ver pruebas/variantesMedida.ts); MEDIR_DIFICULTAD_MANERA=1, 2, 3 o
// gesta: una de las maneras del informe (MANERAS, en pruebas/variantesMedida.ts). Escribe el resumen en JSON en
// MEDIR_SALIDA (o en la consola).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { esCartaDelJugador, nombreDe, porId, tipoDe } from './catalogo.ts'
import { copia } from './estado.ts'
import { entornoActual } from './peligros.ts'
import { jugarPartida, mazoDeMuelleAlAzar, type Partida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { aplicarVariante, leerVariante, MANERAS } from './pruebas/variantesMedida.ts'
import type { CartaId, Estado } from './tipos.ts'

const VARIADOS = process.env.MEDIR_DIFICULTAD_MUELLE === 'variados'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000) * (VARIADOS ? 2 : 1)

/** Lo que hace una carta de Peligro en un Entorno, desde que se revela como encuentro hasta el siguiente. */
interface PeligroEnEntorno {
  sale: number
  pruebas: number
  fallos: number
  heridas: number
  dano: number
  avanceGanado: number
  avancePerdido: number
  descartes: number
  muertes: number
  capitan: number
  retiradas: number
}

/** Lo que se guarda de cada partida (sin el estado entero). */
interface Ficha {
  gana: boolean
  panama: boolean
  causa: 'victoria' | 'tiempo' | 'capitan' | 'misiones'
  turnoFinal: number
  reputacion: number
  /** Al ganar: turnos que quedaban por jugar (0 si gana en el último). */
  sobran: number
  /** Reputación de cada zarpe superado, por capítulo y Entorno. */
  superadas: { mision: CartaId; entorno: string; rep: number }[]
  /** Reputación ganada o perdida en los zarpes (superados o no). */
  repEnZarpes: number
  /** Tesoros que han estado en juego, con el turno en que entraron. */
  tesoros: Record<CartaId, number>
  /** Usos de cada carta de jugador (Evento jugado, capacidad usada, reclutado o adquirido). */
  usos: Record<CartaId, number>
  muelle: CartaId[]
  muertes: number
}

function vacio(): PeligroEnEntorno {
  return { sale: 0, pruebas: 0, fallos: 0, heridas: 0, dano: 0, avanceGanado: 0, avancePerdido: 0, descartes: 0, muertes: 0, capitan: 0, retiradas: 0 }
}

function entornoDeMision(id: CartaId): string {
  const e = porId(id)
  return e.tipo === 'capitulo' ? e.carta.entorno : '?'
}

function jugar(semilla: number, peligros: Map<string, PeligroEnEntorno>): Ficha {
  const tesoros: Record<CartaId, number> = {}
  let enCurso: string | null = null
  let capitanInst: string | null = null
  const p: Partida = jugarPartida(semilla, jugadorConCriterio(), {
    ...(VARIADOS ? { mazoDeMuelle: mazoDeMuelleAlAzar(semilla) } : {}),
    alPaso: (s: Estado) => {
      capitanInst ??= copia(s, s.capitan).id
      for (const m of s.zonas.mejoras) {
        const id = copia(s, m).id
        if (tipoDe(id) === 'tesoro') tesoros[id] ??= s.turno
      }
      for (const r of s.registro) {
        const d = r.dato
        if (!d) continue
        const x = enCurso ? (peligros.get(enCurso) ?? peligros.set(enCurso, vacio()).get(enCurso)!) : null
        switch (d.tipo) {
          case 'revelado': {
            const id = s.cartas[d.inst]?.id
            if (d.como !== 'encuentro' || !id) break
            if (porId(id).tipo !== 'peligro') {
              enCurso = null
              break
            }
            enCurso = `${id}|${entornoActual(s) ?? '?'}`
            ;(peligros.get(enCurso) ?? peligros.set(enCurso, vacio()).get(enCurso)!).sale++
            break
          }
          case 'prueba':
            if (x) {
              x.pruebas++
              if (!d.superada) x.fallos++
            }
            break
          case 'heridas':
            if (x) x.heridas += d.n
            break
          case 'dano':
            if (x) x.dano += d.n
            break
          case 'avance':
            if (x && d.n > 0) x.avanceGanado += d.n
            break
          case 'avancePerdido':
            if (x) x.avancePerdido += d.n
            break
          case 'sale':
            if (x && d.motivo === 'carta') x.descartes++
            break
          case 'derrota':
            if (x && s.mision) {
              if (d.carta === capitanInst) x.capitan++
              else x.muertes++
            }
            break
          case 'finMision':
            if (x && d.resultado !== 'superada') x.retiradas++
            enCurso = null
            break
        }
      }
    },
  })
  const s = p.final
  const causa = p.gana ? 'victoria' : p.motivo.startsWith('Se ha acabado el tiempo') ? 'tiempo' : p.motivo.startsWith('Tu Capitán') ? 'capitan' : 'misiones'
  const usos: Record<CartaId, number> = {}
  for (const [id, u] of Object.entries(p.cartas)) {
    if (!esCartaDelJugador(id)) continue
    const n = u.jugada + u.capacidad + u.reclutada + u.adquirida
    if (n > 0) usos[id] = n
  }
  const superadas = p.repPorZarpe
    .map((z, i) => ({ z, r: p.resultados[i] }))
    .filter(({ r }) => r?.resultado === 'superada')
    .map(({ z }) => ({ mision: z.mision, entorno: entornoDeMision(z.mision), rep: z.rep }))
  return {
    gana: p.gana,
    panama: p.gana && p.motivo.includes('Panamá'),
    causa,
    turnoFinal: p.turnoFinal,
    reputacion: p.reputacion,
    sobran: p.gana ? (s.ultimoTurno ? 0 : s.zonas.mazoEscenario.length + 1) : 0,
    superadas,
    repEnZarpes: p.repPorZarpe.reduce((n, z) => n + z.rep, 0),
    tesoros,
    usos,
    muelle: p.mazoDeMuelle,
    muertes: p.muertes,
  }
}

const r1 = (x: number) => Math.round(10 * x) / 10
const r2 = (x: number) => Math.round(100 * x) / 100
const pct = (n: number, total: number) => (total === 0 ? 0 : r1((100 * n) / total))
const media = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)

function resumen(fichas: Ficha[], peligros: Map<string, PeligroEnEntorno>) {
  const n = fichas.length
  const ganadas = fichas.filter((f) => f.gana)
  const perdidas = fichas.filter((f) => !f.gana)
  const turnosG = ganadas.reduce((a, f) => a + f.turnoFinal, 0)
  const turnosP = perdidas.reduce((a, f) => a + f.turnoFinal, 0)
  const cuenta = (xs: number[]) => {
    const c: Record<string, number> = {}
    for (const x of xs) c[String(x)] = (c[String(x)] ?? 0) + 1
    return c
  }

  // Misiones: veces que se superan y reputación que dan, en las ganadas y en las perdidas.
  const misiones: Record<string, { superadasG: number; repG: number; superadasP: number; repP: number }> = {}
  for (const f of fichas) {
    for (const x of f.superadas) {
      const m = (misiones[x.mision] ??= { superadasG: 0, repG: 0, superadasP: 0, repP: 0 })
      if (f.gana) {
        m.superadasG++
        m.repG += x.rep
      } else {
        m.superadasP++
        m.repP += x.rep
      }
    }
  }
  const repGanadas = ganadas.reduce((a, f) => a + f.reputacion, 0)
  const porMision = Object.entries(misiones)
    .map(([id, m]) => ({
      id,
      nombre: nombreDe(id),
      entorno: entornoDeMision(id),
      superadaEnGanadas: pct(m.superadasG, ganadas.length),
      superadaEnPerdidas: pct(m.superadasP, perdidas.length),
      repMediaAlSuperar: r2((m.repG + m.repP) / Math.max(1, m.superadasG + m.superadasP)),
      parteDeLaRepDeLasGanadas: pct(m.repG, repGanadas),
    }))
    .sort((a, b) => b.parteDeLaRepDeLasGanadas - a.parteDeLaRepDeLasGanadas)

  const porEntorno = Object.fromEntries(
    ['mar', 'nat', 'ciu'].map((e) => {
      const repG = ganadas.reduce((a, f) => a + f.superadas.filter((x) => x.entorno === e).reduce((b, x) => b + x.rep, 0), 0)
      return [
        e,
        {
          superadasPorGanada: r2(media(ganadas.map((f) => f.superadas.filter((x) => x.entorno === e).length))),
          superadasPorPerdida: r2(media(perdidas.map((f) => f.superadas.filter((x) => x.entorno === e).length))),
          parteDeLaRepDeLasGanadas: pct(repG, repGanadas),
        },
      ]
    }),
  )

  // Cartas de jugador: usos por turno en las ganadas y en las perdidas.
  const ids = [...new Set(fichas.flatMap((f) => Object.keys(f.usos)))]
  const cartas = ids
    .map((id) => {
      const g = ganadas.reduce((a, f) => a + (f.usos[id] ?? 0), 0)
      const pd = perdidas.reduce((a, f) => a + (f.usos[id] ?? 0), 0)
      const porTurnoG = g / Math.max(1, turnosG)
      const porTurnoP = pd / Math.max(1, turnosP)
      const usada = fichas.filter((f) => (f.usos[id] ?? 0) > 0)
      return {
        id,
        nombre: nombreDe(id),
        tipo: tipoDe(id),
        porPartidaGanada: r2(g / Math.max(1, ganadas.length)),
        porPartidaPerdida: r2(pd / Math.max(1, perdidas.length)),
        porTurnoGanadas: r2(porTurnoG * 100),
        porTurnoPerdidas: r2(porTurnoP * 100),
        razon: r2(porTurnoP === 0 ? 0 : porTurnoG / porTurnoP),
        partidasUsada: usada.length,
        victoriasSiSeUsa: pct(usada.filter((f) => f.gana).length, usada.length),
      }
    })
    .sort((a, b) => b.porPartidaGanada - a.porPartidaGanada)

  // Con muelles variados: victorias con cada carta en el muelle y sin ella (la medida limpia).
  const enMuelle = VARIADOS
    ? [...new Set(fichas.flatMap((f) => f.muelle))]
        .map((id) => {
          const con = fichas.filter((f) => f.muelle.includes(id))
          const sin = fichas.filter((f) => !f.muelle.includes(id))
          const v = (xs: Ficha[]) => pct(xs.filter((f) => f.gana).length, xs.length)
          return { id, nombre: nombreDe(id), con: con.length, victoriasCon: v(con), victoriasSin: v(sin), diferencia: r1(v(con) - v(sin)) }
        })
        .sort((a, b) => b.diferencia - a.diferencia)
    : []

  // Tesoros: en cuántas ganadas y perdidas entran, y cuánto se gana cuando entran.
  const tesoros = [...new Set(fichas.flatMap((f) => Object.keys(f.tesoros)))]
    .map((id) => {
      const con = fichas.filter((f) => f.tesoros[id] !== undefined)
      return {
        id,
        nombre: nombreDe(id),
        partidas: con.length,
        enGanadas: pct(ganadas.filter((f) => f.tesoros[id] !== undefined).length, ganadas.length),
        enPerdidas: pct(perdidas.filter((f) => f.tesoros[id] !== undefined).length, perdidas.length),
        victoriasSiEntra: pct(con.filter((f) => f.gana).length, con.length),
        turnoMedioDeEntrada: r1(media(con.map((f) => f.tesoros[id] ?? 0))),
      }
    })
    .sort((a, b) => b.partidas - a.partidas)

  // Peligros por Entorno, del que menos daño hace al que más.
  const indice = (d: PeligroEnEntorno) =>
    (d.heridas + d.dano + d.avancePerdido + 3 * d.descartes + 4 * d.muertes + 6 * d.capitan + 3 * d.retiradas) / Math.max(1, d.sale)
  const tablaPeligros = [...peligros]
    .map(([clave, d]) => {
      const [id, entorno] = clave.split('|') as [CartaId, string]
      return {
        id,
        entorno,
        nombre: nombreDe(id),
        sale: d.sale,
        fallo: pct(d.fallos, d.pruebas),
        heridasPorVez: r2(d.heridas / Math.max(1, d.sale)),
        danoPorVez: r2(d.dano / Math.max(1, d.sale)),
        avanceGanadoPorVez: r2(d.avanceGanado / Math.max(1, d.sale)),
        avancePerdidoPorVez: r2(d.avancePerdido / Math.max(1, d.sale)),
        muertes: d.muertes,
        capitan: d.capitan,
        retiradas: d.retiradas,
        indice: r2(indice(d)),
      }
    })
    .sort((a, b) => a.indice - b.indice)

  return {
    partidas: n,
    victorias: pct(ganadas.length, n),
    panama: fichas.filter((f) => f.panama).length,
    panamaPct: pct(fichas.filter((f) => f.panama).length, n),
    derrotaTiempo: pct(fichas.filter((f) => f.causa === 'tiempo').length, n),
    derrotaCapitan: pct(fichas.filter((f) => f.causa === 'capitan').length, n),
    derrotaSinMisiones: pct(fichas.filter((f) => f.causa === 'misiones').length, n),
    turnoMedioVictoria: r2(media(ganadas.map((f) => f.turnoFinal))),
    sobranAlGanar: r2(media(ganadas.map((f) => f.sobran))),
    sobranDistribucion: cuenta(ganadas.map((f) => Math.min(f.sobran, 5))),
    repAlPerderPorTiempo: r2(media(fichas.filter((f) => f.causa === 'tiempo').map((f) => f.reputacion))),
    repAlPerderPorTiempoDistribucion: cuenta(fichas.filter((f) => f.causa === 'tiempo').map((f) => f.reputacion)),
    repMedia: r2(media(fichas.map((f) => f.reputacion))),
    repFueraDeZarpesEnGanadas: r2(media(ganadas.map((f) => f.reputacion - f.repEnZarpes))),
    superadasPorGanada: r2(media(ganadas.map((f) => f.superadas.length))),
    superadasPorPerdida: r2(media(perdidas.map((f) => f.superadas.length))),
    muertesPorPartida: r2(media(fichas.map((f) => f.muertes))),
    porEntorno,
    porMision,
    tesoros,
    cartas,
    enMuelle,
    peligros: tablaPeligros,
  }
}

it.runIf(process.env.MEDIR_DIFICULTAD)(`informe de dificultad (${PARTIDAS} partidas)`, { timeout: 7_200_000 }, () => {
  const manera = process.env.MEDIR_DIFICULTAD_MANERA
  if (manera && !MANERAS[manera]) throw new Error(`No hay manera «${manera}»`)
  const texto = manera ? MANERAS[manera]?.variante : process.env.MEDIR_VARIANTE
  aplicarVariante(leerVariante(texto))
  const peligros = new Map<string, PeligroEnEntorno>()
  const base = VARIADOS ? 100_000 : 1
  const fichas = Array.from({ length: PARTIDAS }, (_, i) => jugar(base + i, peligros))
  const json = JSON.stringify({ variante: texto ?? '', ...(manera ? { manera: MANERAS[manera]?.nombre } : {}), muelle: VARIADOS ? 'variados' : 'inicio', ...resumen(fichas, peligros) }, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, `${json}\n`)
  else console.log(json)
})
