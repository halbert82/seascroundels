// Fase 15 · medida informativa de la partida normal (sin informe): `MEDIR_F15=1 npx vitest run src/engine/medir-fase15.informe.test.ts`.
// Juega las mismas partidas que el informe (semillas 1–N, mazos de inicio, el jugador con criterio) y cuenta lo que pidió
// Albert de las misiones nuevas: cuántas veces sale y se supera cada una, cómo se reparten los tres capítulos II de la
// isla, cuántas cartas se sacan del mazo del pecio (y cuántas veces el doblón) y cuántas regatas se pierden. Escribe un JSON en MEDIR_SALIDA (o la consola).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { jugarPartida, ultimoCapitulo } from './pruebas/equilibrio.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
import { DATOS } from './datos.ts'

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
  // Para ver de dónde sale la diferencia: MEDIR_F15_SIN=misiones (el mazo de Misiones de antes) o =peligros (el mazo de
  // Peligros de antes). Cambia los datos solo en este proceso.
  const sin = process.env.MEDIR_F15_SIN
  if (sin === 'misiones') {
    DATOS.ordenMisiones.travesias = DATOS.ordenMisiones.travesias.filter((t) => !['isla', 'vanhoorn', 'fugitivo'].includes(t))
    DATOS.ordenMisiones.aventuras = DATOS.ordenMisiones.aventuras.filter((t) => !['pecio', 'escolta', 'asedio', 'regata'].includes(t))
  }
  if (sin === 'peligros') {
    const nuevos = ['p2_fuerza', 'p2_hombro', 'p2_ronda', 'p2_escapatoria', 'p2_respiro', 'p2_provisiones', 'p2_lenguas', 'p2_fondo']
    DATOS.mazosPredefinidos.mazoDePeligros = DATOS.mazosPredefinidos.mazoDePeligros.filter((id) => !nuevos.includes(id))
  }
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

  // El pecio (rehecho): cartas robadas del mazo del pecio en cada misión superada, cuáles salen y cuántas veces el doblón.
  const robadasPorPecio: number[] = []
  const salen: Record<string, number> = {}
  let sinAire = 0
  let buzosDerrotados = 0
  for (const p of partidas) {
    const t = textos(p)
    let enCurso: number | null = null
    for (const x of t) {
      if (x.startsWith('Barajas el mazo del pecio')) enCurso = 0
      if (enCurso === null) continue
      const m = /^Robas del mazo del pecio: «([^»]+)»/.exec(x)
      if (m?.[1]) {
        enCurso++
        salen[m[1]] = (salen[m[1]] ?? 0) + 1
      }
      if (x.startsWith('Sin aire:')) sinAire++
      if (x.endsWith('queda derrotado.')) buzosDerrotados++
      if (x.startsWith('El mazo del pecio vuelve al mazo de historia') || x.startsWith('No buceas en el pecio')) {
        robadasPorPecio.push(enCurso)
        enCurso = null
      }
    }
  }
  const mediaRobadas = robadasPorPecio.length ? robadasPorPecio.reduce((a, b) => a + b, 0) / robadasPorPecio.length : 0
  const repartoRobadas = robadasPorPecio.reduce<Record<number, number>>((r, n) => ({ ...r, [n]: (r[n] ?? 0) + 1 }), {})

  const contar = (frase: string) => cuenta((p) => textos(p).filter((x) => x.includes(frase)).length)
  const resumen = {
    sin: sin ?? '',
    partidas: PARTIDAS,
    victorias: (100 * partidas.filter((p) => p.gana).length) / PARTIDAS,
    panama: (100 * partidas.filter((p) => p.resultados.some((r) => r.mision === ultimoCapitulo('panama') && r.resultado === 'superada')).length) / PARTIDAS,
    misiones,
    isla,
    pecio: {
      superada: misiones['pecio-I']?.superada ?? 0,
      buceos: robadasPorPecio.length,
      mediaRobadas,
      repartoRobadas,
      salen,
      doblon: salen['El doblón de la calavera'] ?? 0,
      sinAire,
      derrotasDuranteElBuceo: buzosDerrotados,
      capitanSalvadoPorElDoblon: contar('El doblón de la calavera: '),
    },
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
