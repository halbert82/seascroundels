// Fase 15 · medida informativa de la partida normal (sin informe): `MEDIR_F15=1 npx vitest run src/engine/medir-fase15.informe.test.ts`.
// Juega las mismas partidas que el informe (semillas 1–N, mazos de inicio, el jugador con criterio) y cuenta lo que pidió
// Albert de las misiones nuevas: cuántas veces sale y se supera cada una, cómo se reparten los tres capítulos II de la
// isla, a qué Profundidad se llega en el pecio y cuántas regatas se pierden. Escribe un JSON en MEDIR_SALIDA (o la consola).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida, ultimoCapitulo } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

const NUEVAS = [
  'isla-I',
  'isla-II-ingleses',
  'isla-II-temblor',
  'isla-II-falso',
  'vanhoorn-I',
  'vanhoorn-II-a',
  'vanhoorn-II-b',
  'fugitivo-I',
  'fugitivo-II',
  'pecio-I',
  'escolta-I',
  'asedio-I',
  'regata-I',
]

it.runIf(process.env.MEDIR_F15)(`fase 15: medida de las misiones nuevas (${PARTIDAS} partidas normales)`, { timeout: 3_600_000 }, () => {
  const jugador = jugadorConCriterio()
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => jugarPartida(i + 1, jugador, { textos: true }))
  const textos = (p: (typeof partidas)[number]) => p.textos ?? []
  const cuenta = (f: (p: (typeof partidas)[number]) => number) => partidas.reduce((n, p) => n + f(p), 0)

  const misiones = Object.fromEntries(
    NUEVAS.map((id) => [
      id,
      {
        // % de partidas en que llega a estar disponible, zarpes y veces superada (en 1000 partidas).
        sale: (100 * partidas.filter((p) => p.primerTurnoDisponible[id] !== undefined).length) / PARTIDAS,
        zarpes: cuenta((p) => p.zarpes.filter((m) => m === id).length),
        superada: cuenta((p) => p.resultados.filter((r) => r.mision === id && r.resultado === 'superada').length),
      },
    ]),
  )

  // Los capítulos II de la isla: cuál sale después de «El mapa del ahorcado» (y después de «El mapa era falso»).
  const isla = { ingleses: 0, temblor: 0, falso: 0, trasFalso: { ingleses: 0, temblor: 0 } }
  for (const p of partidas) {
    const t = textos(p)
    for (let i = 0; i < t.length; i++) {
      if (!t[i]?.startsWith('Barajas boca abajo las cartas')) continue
      const tras = t[i]?.includes('256 y 257')
      const sale = t.slice(i, i + 12).find((x) => x.startsWith('Nueva misión disponible: «…tomada') || x.startsWith('Nueva misión disponible: «…sacudida') || x.startsWith('Nueva misión disponible: «El mapa era falso'))
      if (!sale) continue
      const cual = sale.includes('tomada') ? 'ingleses' : sale.includes('sacudida') ? 'temblor' : 'falso'
      if (tras && cual !== 'falso') isla.trasFalso[cual]++
      else if (!tras) isla[cual]++
    }
  }

  // El pecio: a qué Profundidad se sube (veces que se supera la misión con 0, 1, 2, 3 o 4 fichas).
  const profundidad = [0, 0, 0, 0, 0]
  let inmersiones = 0
  let inmersionesFalladas = 0
  for (const p of partidas) {
    for (const x of textos(p)) {
      if (x.startsWith('Bucear en el pecio')) inmersiones++
      if (x.startsWith('La inmersión sale mal')) inmersionesFalladas++
      if (!x.startsWith('Miras la carta 269')) continue
      const n = /con Profundidad (\d)/.exec(x)?.[1]
      profundidad[n ? Number(n) : 0]!++
    }
  }

  const contar = (frase: string) => cuenta((p) => textos(p).filter((x) => x.includes(frase)).length)
  const resumen = {
    partidas: PARTIDAS,
    victorias: (100 * partidas.filter((p) => p.gana).length) / PARTIDAS,
    panama: (100 * partidas.filter((p) => p.resultados.some((r) => r.mision === ultimoCapitulo('panama') && r.resultado === 'superada')).length) / PARTIDAS,
    misiones,
    isla,
    pecio: { profundidad, inmersiones, inmersionesFalladas },
    regata: { superadas: misiones['regata-I']?.superada ?? 0, perdidaContraElRival: contar('El rival gana la regata') },
    vanHoorn: { llegaAntes: contar('Van Hoorn llega antes'), destina: contar('Destinas ') },
    escolta: { galeonHundido: contar('el galeón San Telmo se hunde'), conBonificacion: contar('El galeón llega con') },
    asedio: { murallasCaen: contar('Caen las murallas de Port Royal'), conBonificacion: contar('Las murallas aguantan con') },
    fugitivo: { escapa: contar('el fugitivo escapa'), prisioneroMuere: contar('el prisionero muere'), prisionero: contar('«El prisionero» (carta 267') },
    malaFama: contar('«Mala fama» (carta 136'),
    respiro: { descansar: contar('Eliges: Descansar'), seguir: contar('Eliges: Seguir') },
    alerta: contar('tiene Alerta: se resuelve igual'),
    descomunalFallada: contar('Descomunal 2: no llegas a 2 asignados'),
  }
  const json = JSON.stringify(resumen, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
  else console.log(json)
})
