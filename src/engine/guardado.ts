// Guardar y recuperar una partida como texto (para el navegador).

import { esCarta, porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { entornoActual } from './peligros.ts'
import { ZONAS, type Estado, type InstId } from './tipos.ts'
import { crearCopia } from './zonas.ts'

export const CLAVE_GUARDADO = 'sea-scoundrels/partida'

export function serializar(s: Estado): string {
  return JSON.stringify(s)
}

/**
 * Fase 8: las cartas de Escenario que salen dejan su número de colección a las nuevas, así que una partida guardada
 * antes del cambio las recibe en su lugar. Las fichas de Ventaja del ladrón pasan a llamarse de Ladrón.
 */
const ESCENARIO_RENOMBRADO: Record<string, string> = { calma_ev: 'sanjuan', noticias: 'cuarentena', astillero: 'armada_patrulla' }

function migrar(s: Estado): void {
  for (const c of Object.values(s.cartas ?? {})) {
    const nuevo = ESCENARIO_RENOMBRADO[c.id]
    if (nuevo) c.id = nuevo
  }
  // Fase 10b: fuera Aturdido, Encadenado e Incendio a bordo.
  const fuera = new Set(['aturdido', 'encadenado', 'incendio'])
  for (const c of Object.values(s.cartas ?? {})) {
    if (!c.estados) continue
    c.estados = c.estados.filter((e) => !fuera.has(e))
    if (c.estados.length === 0) delete c.estados
  }
  if (s.estadosBarco) {
    s.estadosBarco = s.estadosBarco.filter((e) => !fuera.has(e))
    if (s.estadosBarco.length === 0) delete s.estadosBarco
  }
  const fichas = s.mision?.fichas as Record<string, number> | undefined
  if (fichas && 'ventaja' in fichas) {
    fichas.ladron = fichas.ventaja ?? 0
    delete fichas.ventaja
  }
}

/** Marcas con las que una carta que «se quedaba en juego» recordaba a quién afectaba (antes de la fase 11). */
const MARCA_JUNTO: Record<string, string> = { p2_arenas: 'p2_arenas.atrapado', p2_presagio: 'p2_presagio.lechuza' }

/**
 * Fase 11: las cartas que «se quedaban en juego» pasan a ser permanentes. Las 12 permanentes entran en el mazo de
 * historia; si había alguna carta en juego, su permanente ocupa su lugar (con sus fichas y lo que dependía de ella) y la
 * carta del encuentro va a sus descartes.
 */
function migrarPermanentes(s: Estado): void {
  const zonas = s.zonas as Record<string, InstId[] | undefined>
  if (Array.isArray(zonas.permanentes)) return
  const antiguas = zonas.peligrosEnJuego ?? []
  delete zonas.peligrosEnJuego
  s.zonas.permanentes = []
  const ids = new Set(Object.values(s.cartas).map((c) => c.id))
  for (const p of DATOS.permanentes) if (!ids.has(p.id)) crearCopia(s, p.id, 'mazoHistoria')
  const entorno = entornoActual(s)
  for (const inst of antiguas) {
    const c = s.cartas[inst]
    if (!c) continue
    const propio = porId(c.id).tipo === 'mazoPropio'
    s.zonas[propio ? 'descartesMision' : 'descartesPeligros'].push(inst)
    const fichas = c.fichas
    delete c.fichas
    const datos = DATOS.permanentes.find((p) => p.origen === c.id && (p.entorno === 'unico' || p.entorno === entorno))
    const perm = datos ? s.zonas.mazoHistoria.find((x) => s.cartas[x]?.id === datos.id) : undefined
    if (!datos || !perm) continue
    s.zonas.mazoHistoria = s.zonas.mazoHistoria.filter((x) => x !== perm)
    s.zonas.permanentes.push(perm)
    const pc = s.cartas[perm]
    if (!pc) continue
    pc.origen = inst
    if (fichas !== undefined) pc.fichas = fichas
    for (const t of s.temporales) {
      if (t.carta !== inst) continue
      if (t.hasta === 'carta') {
        t.carta = perm
        if (t.fuente === 'p2_motin') t.fuente = 'pm_taberna'
        if (datos.junto && t.inst) pc.junto = t.inst
      } else if (t.clave === MARCA_JUNTO[c.id] && t.inst) pc.junto = t.inst
    }
  }
}

/**
 * Recupera una partida guardada. Si es de una versión anterior del juego (le falta alguna zona o tiene cartas que ya no
 * existen, como los capítulos antiguos de las misiones), no se puede continuar.
 */
export function deserializar(texto: string): Estado {
  const datos: unknown = JSON.parse(texto)
  const anterior = () => new Error('La partida guardada no es de esta versión del juego')
  if (typeof datos !== 'object' || datos === null || (datos as { version?: unknown }).version !== 1) throw anterior()
  const s = datos as Estado
  if (!s.zonas || typeof s.zonas !== 'object') throw anterior()
  // Fase 11: la zona de permanentes es nueva (antes, la de las cartas que se quedaban en juego).
  if (!Array.isArray(s.zonas.permanentes) && Array.isArray((s.zonas as Record<string, unknown>).peligrosEnJuego)) migrarPermanentes(s)
  if (ZONAS.some((z) => !Array.isArray(s.zonas[z]))) throw anterior()
  migrar(s)
  if (Object.values(s.cartas ?? {}).some((c) => !esCarta(c.id))) throw anterior()
  return s
}
