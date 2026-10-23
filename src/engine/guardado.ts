// Guardar y recuperar una partida como texto (para el navegador).

import { CATALOGO, esCarta, porId } from './catalogo.ts'
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
  // Fase 13: fuera «no se prepara hasta que superes otra Prueba» (lo usaba solo «Bruma en la selva»): se acaba ya.
  s.temporales = (s.temporales ?? []).filter((t) => (t.hasta as string) !== 'superarPrueba')
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
  // Fase 11 (P63): «¡La guardia!» ya no está en la zona de las cartas de misión: es una permanente.
  const zonas = s.zonas as Record<string, InstId[] | undefined>
  if (Array.isArray(zonas.cartasMision)) {
    s.zonas.permanentes = [...(s.zonas.permanentes ?? []), ...zonas.cartasMision]
    delete zonas.cartasMision
  }
  // Fase 14 (fuera el rehén): los rehenes y los Tripulantes incautados vuelven a la tripulación. Una partida guardada justo
  // cuando se capturaba o se rescataba a alguien no se puede continuar.
  if (!migrarRehenes(s)) throw anterior()
  migrarPecio(s)
  if (ZONAS.some((z) => !Array.isArray(s.zonas[z]))) throw anterior()
  migrar(s)
  if (!migrarCapitulos(s)) throw new Error('La partida guardada estaba a mitad de un capítulo que ya no existe («Seguirle por los muelles» o el antiguo «A bordo del fantasma»): no se puede continuar')
  if (Object.values(s.cartas ?? {}).some((c) => !esCarta(c.id))) throw anterior()
  return s
}

/** Fase 14: fuera el rehén y el Tripulante incautado. Devuelve false si la partida estaba a mitad de una captura. */
function migrarRehenes(s: Estado): boolean {
  const zonas = s.zonas as Record<string, InstId[] | undefined>
  const rehenes = zonas.rehenes
  if (Array.isArray(rehenes)) {
    s.zonas.tripulacion = [...(s.zonas.tripulacion ?? []), ...rehenes]
    delete zonas.rehenes
  }
  const incautados = (s.zonas.incautadas ?? []).filter((c) => (s.incautadas?.[c]?.zona as string | undefined) === 'tripulacion')
  for (const c of incautados) {
    s.zonas.incautadas = s.zonas.incautadas.filter((x) => x !== c)
    s.zonas.tripulacion.push(c)
    if (s.incautadas) delete s.incautadas[c]
  }
  s.temporales = (s.temporales ?? []).filter((t) => t.clave !== 'p2_fiebre.lazareto')
  for (const t of s.pila ?? []) {
    const tarea = t as { tipo: string; paso?: string; ev?: { tipo: string } }
    if (tarea.tipo === 'rehen' || (tarea.tipo === 'evento' && (tarea.ev?.tipo === 'rehen' || tarea.ev?.tipo === 'rescatado'))) return false
    if (tarea.tipo === 'fallarMision' && tarea.paso === 'rehenes') tarea.paso = 'anotar'
  }
  return true
}

/**
 * Fase 15 (el pecio rehecho): las zonas del mazo del pecio son nuevas; la carta de consulta 269 pasa a ser «Doblones
 * sueltos», el Tesoro 271 pasa a ser «El doblón de la calavera» y las demás cartas del mazo del pecio esperan en el mazo de
 * historia. Fuera las fichas de Profundidad.
 */
function migrarPecio(s: Estado): void {
  const zonas = s.zonas as Record<string, InstId[] | undefined>
  for (const z of ['mazoPecio', 'pecioSacadas']) if (!Array.isArray(zonas[z])) zonas[z] = []
  const cartas = Object.values(s.cartas ?? {})
  if (cartas.length === 0) return
  for (const c of cartas) {
    if (c.id === 'fondo_sanjose') c.id = 'pecio_doblones'
    if (c.id === 'custodia') c.id = 'doblon'
  }
  const ids = new Set(cartas.map((c) => c.id))
  for (const e of CATALOGO) if (e.tipo === 'pecio' && !ids.has(e.id)) crearCopia(s, e.id, 'mazoHistoria')
  const fichas = s.mision?.fichas as Record<string, number> | undefined
  if (fichas && 'profundidad' in fichas) delete fichas.profundidad
}

/** Quita una copia de la partida (de su zona y de las cartas). */
function quitarCopia(s: Estado, inst: InstId): void {
  const zonas = s.zonas as Record<string, InstId[]>
  for (const z of Object.keys(zonas)) zonas[z] = (zonas[z] ?? []).filter((x) => x !== inst)
  delete s.cartas[inst]
}

/**
 * Fase 12: travesías de 2 y 4 capítulos. Una partida de antes se reconoce porque tiene «espia-III». El espía y el barco
 * fantasma pierden un capítulo II (se une al I): su III pasa a ser el II. La Flota y el templo ganan un capítulo III
 * nuevo: su III pasa a ser el IV y el nuevo espera en el mazo de historia. Devuelve false si no se puede convertir: la
 * misión en curso es uno de los dos capítulos que desaparecen.
 */
function migrarCapitulos(s: Estado): boolean {
  const ids = (id: string) => Object.entries(s.cartas).filter(([, c]) => c.id === id).map(([i]) => i as InstId)
  if (ids('espia-III').length === 0) return true
  const enCurso = s.mision ? s.cartas[s.mision.carta]?.id : undefined
  if (enCurso === 'espia-II' || enCurso === 'fantasma-II') return false
  for (const t of ['espia', 'fantasma']) {
    const iiViejo = ids(`${t}-II`)
    const iiiViejo = ids(`${t}-III`)
    // El II de antes, aún por jugar (en el mazo de Misiones o disponible): pasa a ser el capítulo II nuevo (el III de
    // antes), y el III de antes, que esperaba en el mazo de historia, sobra. Si ya se jugó o no había salido, sobra él.
    const pendiente = iiViejo.filter((i) => s.zonas.mazoMisiones.includes(i) || s.zonas.misionesDisponibles.includes(i))
    for (const i of iiViejo) if (!pendiente.includes(i)) quitarCopia(s, i)
    if (pendiente.length > 0) for (const i of iiiViejo) quitarCopia(s, i)
    else for (const i of iiiViejo) if (s.cartas[i]) s.cartas[i].id = `${t}-II`
  }
  for (const t of ['flota', 'templo']) {
    for (const i of ids(`${t}-III`)) if (s.cartas[i]) s.cartas[i].id = `${t}-IV`
    crearCopia(s, `${t}-III`, 'mazoHistoria')
  }
  return true
}
