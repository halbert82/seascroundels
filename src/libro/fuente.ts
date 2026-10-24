// Lee docs/reglamento-v1.0.md y lo convierte en los dos libros del reglamento: «Aprende a jugar» (su Parte 1) y
// «Referencia de reglas» (su Parte 2), más la referencia rápida de la contraportada.
//
// El Markdown es la única fuente. Las marcas nuevas son citas que empiezan por «[!tipo]» (ver el comentario al
// principio del reglamento): notas temáticas, ejemplos, recuadros, epígrafes y el sitio de cada gráfico.
// Aquí solo se decide la estructura y se escribe el HTML del texto; el dibujo lo hace la maqueta (Libro.tsx).

import MarkdownIt from 'markdown-it'
import type { Token } from 'markdown-it'
import { cartasYPartes, type CartaNombrada } from './cartasNombradas.ts'
import { CATALOGO } from '../engine/catalogo.ts'

export type LibroId = 'aprende' | 'referencia'

export type Bloque =
  /** Texto corrido (párrafo, lista, tabla). Puede llevar notas temáticas dentro, ya colocadas antes de lo que comentan. */
  | { tipo: 'html'; html: string; tema?: boolean }
  | { tipo: 'subtitulo'; id: string; texto: string }
  | { tipo: 'ejemplo'; titulo: string; html: string; cartas: CartaNombrada[]; pasos: boolean }
  | { tipo: 'importante' | 'consejo'; html: string }
  /** Sitio de un gráfico. `leyenda`: la lista numerada que lo acompaña (anatomías); `pasos`: la lista que sustituye (turno). */
  | { tipo: 'grafico'; nombre: string; arg: string; leyenda?: string[]; pasos?: string[] }
  /** Las tablas de «Componentes», dibujadas como fichas con sus cartas. */
  | { tipo: 'componentes'; grupo: string; filas: FilaComponente[] }

export interface FilaComponente {
  nombre: string
  cantidad: string
  html: string
}

export interface Epigrafe {
  html: string
  autor: string
}

export interface Capitulo {
  id: string
  titulo: string
  epigrafe: Epigrafe | null
  bloques: Bloque[]
  /** Tiene al menos una nota temática. */
  conTema: boolean
  /**
   * Capítulos que se dibujan aparte: el ejemplo de juego completo (a doble página) y «Mazos de inicio» (las listas
   * de cartas de la primera partida, sacadas de los datos; es un apéndice: sin ilustración, epígrafe ni nota).
   */
  especial: 'ejemplo-de-juego' | 'mazos-de-inicio' | null
}

export interface Remision {
  titulo: string
  /** Ancla en su libro (o null si no existe). */
  id: string | null
  libro: LibroId
}

export interface Entrada {
  id: string
  titulo: string
  letra: string
  bloques: Bloque[]
  vease: Remision[]
}

/** Una línea del índice de términos de la Referencia de reglas. */
export interface LineaIndice {
  termino: string
  /** Ancla adonde remite: su entrada o, dentro de una entrada, el sitio donde se explica. */
  id: string
  /** Entrada donde se explica, si no es la suya propia. */
  en: string | null
  /** Qué es, si sale en una lista de la Referencia («palabra clave», «Rasgo», «ficha de misión»). */
  clase?: string
}

export interface Reglamento {
  /** «Cómo usar este libro», con sus remisiones según el libro en que se lee. */
  comoUsar: Record<LibroId, Bloque[]>
  aprende: { intro: string; capitulos: Capitulo[] }
  referencia: { intro: Bloque[]; epigrafe: Epigrafe | null; entradas: Entrada[]; indice: LineaIndice[] }
  rapida: {
    turno: string[]
    prueba: string[]
    iconos: { icono: string; significa: string }[]
    estadosIntro: string
    estados: { ficha: string; clase: string; hace: string; quita: string }[]
    /** Cabecera de la columna «Cómo se quita…» de la tabla de Estados. */
    estadosQuita: string
  }
}

// ---------------------------------------------------------------------------
// Utilidades

export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Primera letra del título para el índice de la Referencia (sin tildes). */
function letraDe(titulo: string): string {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
}

/** Un título sin lo que va entre paréntesis: «Día (perder un día)» → «Día». */
function sinParentesis(t: string): string {
  return t.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Términos de juego: los títulos de la Referencia de reglas y sus formas (plurales, partes)

interface Termino {
  forma: string
  id: string
  titulo: string
}

/** Formas que se buscan en el texto para cada entrada de la Referencia (con mayúscula: así se escriben los términos). */
function formasDe(titulo: string): string[] {
  const base = sinParentesis(titulo)
  const formas = new Set<string>()
  const partes = base.includes(' y ') && !/^Entra en/.test(base) ? base.split(' y ') : [base]
  if (/^Entra en el mazo de Peligros y Se retira$/.test(base)) partes.push('Se retira', 'Entra en el mazo de Peligros')
  for (const p of partes) {
    if (!/^[A-ZÁÉÍÓÚÑ¡«]/.test(p)) continue
    formas.add(p)
    if (!p.includes(' ')) {
      if (/[aeiou]$/.test(p)) formas.add(`${p}s`)
      else if (/ón$/.test(p)) formas.add(`${p.slice(0, -2)}ones`)
      else if (/án$/.test(p)) formas.add(`${p.slice(0, -2)}anes`)
      else if (/[lnr]$/.test(p)) formas.add(`${p}es`)
    }
  }
  if (base === 'Habilidades') formas.add('Habilidad')
  return [...formas]
}

/** Términos tan generales que no se añaden solos a «Véase también» (sí se marcan en el texto). */
// «Véase también» añade hasta 4 términos que nombra la entrada, sin estos (aprobado por Albert, docs/decisiones.md, fase 9).
const GENERALES = new Set(['Tripulante', 'Capitán', 'Prueba', 'Barco', 'Misión', 'Encuentro'])

/** Entradas que no se marcan en el texto de otras (son demasiado generales o no son términos). */
const SIN_MARCAR = new Set(['revelar', 'descartar', 'coste', 'vida', 'nivel', 'escenario'])

function terminosDe(entradas: { id: string; titulo: string }[]): Termino[] {
  const lista: Termino[] = []
  for (const e of entradas) {
    if (SIN_MARCAR.has(slug(e.titulo))) continue
    for (const forma of formasDe(e.titulo)) lista.push({ forma, id: e.id, titulo: e.titulo })
  }
  // Las más largas primero: «Prueba de una Acción» antes que «Prueba».
  return lista.sort((a, b) => b.forma.length - a.forma.length)
}

// ---------------------------------------------------------------------------
// Transformaciones del texto corrido

interface Entorno {
  libro: LibroId
  /** Anclas de cada libro por título (para «ver «X»»). */
  anclas: Record<LibroId, Map<string, string>>
  terminos: Termino[]
  /** Aprende a jugar: términos ya puestos en negrita (la primera vez). Referencia: los de la entrada en curso. */
  vistos: Set<string>
  /** Entrada en curso de la Referencia (no se remite a sí misma). */
  entrada: string | null
  /** Remisiones que salen en el texto de la entrada en curso (para su «Véase también»). */
  mencionadas: string[]
  enNegrita: number
  textoNegrita: string
  /** Dentro de un enlace o de una tabla: sin remisiones ni negritas de términos. */
  enEnlace: number
}

type Trozo = { h: string } | { t: string }

function aplicar(trozos: Trozo[], re: RegExp, cambiar: (m: RegExpExecArray) => Trozo[] | null): Trozo[] {
  const salida: Trozo[] = []
  for (const tr of trozos) {
    if ('h' in tr) {
      salida.push(tr)
      continue
    }
    const texto = tr.t
    let desde = 0
    re.lastIndex = 0
    for (let m = re.exec(texto); m; m = re.exec(texto)) {
      const nuevo = cambiar(m)
      if (!nuevo) continue
      if (m.index > desde) salida.push({ t: texto.slice(desde, m.index) })
      salida.push(...nuevo)
      desde = m.index + m[0].length
    }
    if (desde < texto.length) salida.push({ t: texto.slice(desde) })
  }
  return salida
}

/** Cartas que se enseñan en un recuadro de ejemplo (las primeras que nombra): 4 caben en una fila a 27 mm. */
const MAX_CARTAS_EJEMPLO = 4

const NOMBRE_LIBRO: Record<LibroId, string> = { aprende: 'Aprende a jugar', referencia: 'Referencia de reglas' }

/**
 * «véase «Destino», pág. 14» (en el mismo libro) o «véase *Referencia de reglas*, «Destino»» (en el otro, sin página).
 * Un «…, al final de este libro» detrás solo se queda si la remisión es al mismo libro.
 */
function remision(v: string, titulo: string, e: Entorno, coletilla = ''): Trozo[] | null {
  const propio = e.anclas[e.libro].get(titulo)
  const otro: LibroId = e.libro === 'aprende' ? 'referencia' : 'aprende'
  const ajeno = e.anclas[otro].get(titulo)
  const palabra = `${v === 'V' ? 'V' : 'v'}éase`
  if (propio) {
    return [{ h: `${palabra} <a class="ref" href="#${propio}">«${escapar(titulo)}»</a>, <span class="pag">pág.&nbsp;<a class="num-pag" href="#${propio}"></a></span>${escapar(coletilla)}` }]
  }
  if (ajeno) return [{ h: `${palabra} <i>${NOMBRE_LIBRO[otro]}</i>, «${escapar(titulo)}»` }]
  return null
}

const EXPRESIONES_VER = new WeakMap<Entorno['anclas'], RegExp>()

function remisiones(trozos: Trozo[], e: Entorno): Trozo[] {
  let re = EXPRESIONES_VER.get(e.anclas)
  if (!re) {
    const titulos = [...new Set([...e.anclas.aprende.keys(), ...e.anclas.referencia.keys()])].sort((a, b) => b.length - a.length)
    const alternativas = titulos.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    re = new RegExp(`\\b(V|v)er (?:«([^»]+)»|(${alternativas})(?![\\p{L}]))(, al final de este libro)?`, 'gu')
    EXPRESIONES_VER.set(e.anclas, re)
  }
  return aplicar(trozos, re, (m) => remision(m[1] ?? 'v', m[2] ?? m[3] ?? '', e, m[4] ?? ''))
}

const HABILIDAD = /\b(NAV|COM|EXP)\b/g
const FICHA_NUM = /(\b\d+|\bN|−\d+)(\s)(heridas?|daños?)\b/g
const FICHA_DE = /(\b\d+|\bN)( de )(Avance|reputación)\b/g
const ICONO_FICHA: Record<string, string> = { herida: 'herida', heridas: 'herida', daño: 'dano', daños: 'dano', Avance: 'avance', reputación: 'rep' }
/** Fase 13: «Daña 1», «Repara 2»: el número va con el icono del casco del Barco, como en las cartas. */
const DANA_REPARA = /\b([Dd]aña|[Rr]epara) (\d+|N)\b(?!\s+daños?\b)/g

const habilidad = (h: string) => `<span class="hab hab-${h.toLowerCase()}"><i class="ic i-${h.toLowerCase()}"></i>${h}</span>`

function iconos(trozos: Trozo[]): Trozo[] {
  // «(NAV 2)»: el paréntesis va pegado a su icono, para que no se quede solo al final de la línea.
  let r = aplicar(trozos, /\((NAV|COM|EXP)\b/g, (m) => [{ h: `<span class="junto">(${habilidad(m[1] ?? '')}</span>` }])
  r = aplicar(r, HABILIDAD, (m) => [{ h: habilidad(m[1] ?? '') }])
  r = aplicar(r, FICHA_NUM, (m) => [{ t: `${m[1]} ` }, { h: `<i class="ic ic-ficha i-${ICONO_FICHA[m[3] ?? '']}"></i>` }, { t: `${m[3]}` }])
  r = aplicar(r, FICHA_DE, (m) => [{ t: `${m[1]} ` }, { h: `<i class="ic ic-ficha i-${ICONO_FICHA[m[3] ?? '']}"></i>` }, { t: `de ${m[3]}` }])
  r = aplicar(r, DANA_REPARA, (m) => [{ t: `${m[1]} ${m[2]}` }, { h: '<i class="ic ic-ficha ic-tras i-dano"></i>' }])
  return r
}

/** Marca con negrita la primera aparición de cada término (y, en la Referencia, remite a su página). */
const EXPRESIONES = new WeakMap<Termino[], RegExp>()

function expresionDe(lista: Termino[]): RegExp {
  let re = EXPRESIONES.get(lista)
  if (!re) {
    const formas = lista.map((t) => t.forma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    re = new RegExp(`(?<![\\p{L}])(${formas})(?![\\p{L}])`, 'gu')
    EXPRESIONES.set(lista, re)
  }
  return re
}

/**
 * Fase 15: nombres de cartas, encuentros y travesías. Entre comillas («La Isla del Tesoro») son nombres, no términos de
 * juego: no se marcan («Tesoro» no remite a su entrada).
 */
let NOMBRES: Set<string> | null = null
function nombresDeCartas(): Set<string> {
  if (NOMBRES) return NOMBRES
  NOMBRES = new Set<string>()
  for (const e of CATALOGO) {
    if ('nombre' in e.carta && typeof e.carta.nombre === 'string') NOMBRES.add(e.carta.nombre)
    if (e.tipo === 'capitulo') NOMBRES.add(e.mision.nombre)
    if (e.tipo === 'peligro') for (const x of Object.values(e.carta.encuentros)) NOMBRES.add(x.nombre)
    if (e.tipo === 'mazoPropio') NOMBRES.add(e.carta.encuentro.nombre)
  }
  return NOMBRES
}

/** Aparta los nombres de cartas entre comillas para que no se busquen términos dentro. */
function sinNombres(trozos: Trozo[]): Trozo[] {
  return trozos.flatMap((t): Trozo[] => {
    if (!('t' in t)) return [t]
    const partes = t.t.split(/(«[^»]+»)/)
    if (partes.length === 1) return [t]
    return partes.filter((x) => x !== '').map((x) => (/^«[^»]+»$/.test(x) && nombresDeCartas().has(x.slice(1, -1)) ? { h: escapar(x) } : { t: x }))
  })
}

function terminos(trozos: Trozo[], e: Entorno): Trozo[] {
  if (e.enNegrita > 0 || e.enEnlace > 0 || e.terminos.length === 0) return trozos
  const re = expresionDe(e.terminos)
  return aplicar(sinNombres(trozos), re, (m) => {
    const t = e.terminos.find((x) => x.forma === m[1])
    if (!t || e.vistos.has(t.id) || t.id === e.entrada) return null
    e.vistos.add(t.id)
    if (e.libro === 'aprende') return [{ h: `<strong class="termino">${escapar(m[1] ?? '')}</strong>` }]
    e.mencionadas.push(t.titulo)
    return [{ h: `<strong class="termino">${escapar(m[1] ?? '')}</strong><a class="pagref" href="#${t.id}"></a>` }]
  })
}

function transformarTexto(texto: string, e: Entorno): string {
  let trozos: Trozo[] = [{ t: texto }]
  if (e.enEnlace === 0) trozos = remisiones(trozos, e)
  trozos = iconos(trozos)
  trozos = terminos(trozos, e)
  return trozos.map((t) => ('h' in t ? t.h : escapar(t.t))).join('')
}

// ---------------------------------------------------------------------------
// Markdown

function crearMarkdown(): MarkdownIt {
  const md = new MarkdownIt({ html: true, typographer: false })
  const r = md.renderer.rules
  r.text = (tokens, i, _o, env: Entorno) => {
    const contenido = tokens[i]?.content ?? ''
    if (env.enNegrita > 0) env.textoNegrita += contenido
    return transformarTexto(contenido, env)
  }
  r.strong_open = (tokens, i, _o, env: Entorno) => {
    env.enNegrita++
    env.textoNegrita = ''
    const id = tokens[i]?.attrGet('id')
    return id ? `<strong id="${id}">` : '<strong>'
  }
  r.strong_close = (_t, _i, _o, env: Entorno) => {
    env.enNegrita--
    const termino = env.textoNegrita.replace(/\s*[—:.]\s*$/, '').trim()
    const t = env.terminos.find((x) => x.forma === termino)
    if (!t) return '</strong>'
    // Una definición en negrita también cuenta como «ya en negrita».
    const yaVisto = env.vistos.has(t.id)
    env.vistos.add(t.id)
    if (env.libro === 'referencia' && t.id !== env.entrada && !yaVisto) {
      env.mencionadas.push(t.titulo)
      return `</strong><a class="pagref" href="#${t.id}"></a>`
    }
    return '</strong>'
  }
  r.link_open = (tokens, i, o, env: Entorno, self) => {
    env.enEnlace++
    return self.renderToken(tokens, i, o)
  }
  r.link_close = (tokens, i, o, env: Entorno, self) => {
    env.enEnlace--
    return self.renderToken(tokens, i, o)
  }
  r.blockquote_open = (tokens, i) => {
    const meta = tokens[i]?.meta as { tipo?: string } | null
    if (meta?.tipo === 'tema') return '<aside class="nota-tema">'
    // Fase 10: aclaración de reglas, en la columna exterior como la nota temática, pero con otro estilo.
    if (meta?.tipo === 'nota') return '<aside class="nota-tema nota-regla">'
    return '<blockquote>'
  }
  r.blockquote_close = (tokens, i) => {
    const meta = tokens[i]?.meta as { tipo?: string } | null
    if (meta?.tipo === 'tema' || meta?.tipo === 'nota') return '</aside>\n'
    return '</blockquote>\n'
  }
  r.table_open = (_t, _i, _o, env: Entorno) => {
    env.enEnlace++
    return '<table class="tabla">\n'
  }
  r.table_close = (_t, _i, _o, env: Entorno) => {
    env.enEnlace--
    return '</table>\n'
  }
  return md
}

/** Busca la cita que cierra la que abre en `i`. */
function cierre(tokens: Token[], i: number): number {
  const nivel = tokens[i]?.level ?? 0
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j]
    if (t && t.type === 'blockquote_close' && t.level === nivel) return j
  }
  throw new Error('Cita sin cerrar en el reglamento')
}

/** Final del bloque que empieza en `i` (párrafo, lista, tabla, cita…). */
function finDeBloque(tokens: Token[], i: number): number {
  const t = tokens[i]
  if (!t) return i
  if (t.nesting !== 1) return i
  const cerrar = t.type.replace(/_open$/, '_close')
  for (let j = i + 1; j < tokens.length; j++) {
    const u = tokens[j]
    if (u && u.type === cerrar && u.level === t.level) return j
  }
  return i
}

/**
 * Reconoce las marcas «[!tipo] resto» al principio de una cita: las anota en `meta` del token de apertura y quita la
 * primera línea del texto. Las notas temáticas se mueven delante del bloque que comentan (para alinearse con él).
 */
function prepararMarcas(tokens: Token[]): Token[] {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t || t.type !== 'blockquote_open') continue
    const inline = tokens[i + 2]
    if (!inline || inline.type !== 'inline') continue
    const m = /^\[!(\w+)\][ \t]*([^\n]*)/.exec(inline.content)
    if (!m) continue
    t.meta = { tipo: m[1], resto: (m[2] ?? '').trim() }
    const fin = tokens[cierre(tokens, i)]
    if (fin) fin.meta = t.meta
    // Quita la primera línea del párrafo (la marca) de su contenido y de sus hijos.
    inline.content = inline.content.slice(m[0].length).replace(/^\n/, '')
    const hijos = inline.children ?? []
    const corte = hijos.findIndex((h) => h.type === 'softbreak' || h.type === 'hardbreak')
    inline.children = corte >= 0 ? hijos.slice(corte + 1) : []
  }
  // Notas temáticas y aclaraciones: delante del bloque anterior del mismo nivel.
  const salida = [...tokens]
  for (let i = 0; i < salida.length; i++) {
    const t = salida[i]
    const tipoNota = (t?.meta as { tipo?: string } | null)?.tipo
    if (!t || t.type !== 'blockquote_open' || (tipoNota !== 'tema' && tipoNota !== 'nota')) continue
    const fin = cierre(salida, i)
    // Bloque anterior: retrocede hasta el token de apertura del mismo nivel.
    let j = i - 1
    const nivel = t.level
    while (j >= 0) {
      const u = salida[j]
      if (u && u.level === nivel && u.nesting !== -1) break
      if (u && u.level === nivel && u.nesting === -1) {
        // Cierre de un bloque: busca su apertura.
        const tipoAbre = u.type.replace(/_close$/, '_open')
        let k = j - 1
        while (k >= 0 && !(salida[k]?.type === tipoAbre && salida[k]?.level === nivel)) k--
        j = k
        break
      }
      j--
    }
    if (j < 0) continue
    const nota = salida.splice(i, fin - i + 1)
    salida.splice(j, 0, ...nota)
    i = fin
  }
  return salida
}

/** Hijos de un token en línea sin los textos vacíos que markdown-it deja alrededor de las negritas. */
function hijosReales(t: Token | undefined): Token[] {
  return (t?.children ?? []).filter((h) => !(h.type === 'text' && h.content === ''))
}

/** Texto plano de unos tokens (para buscar cartas nombradas). */
function textoPlano(tokens: Token[]): string {
  return tokens
    .filter((t) => t.type === 'inline')
    .map((t) => t.content)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Construcción de los libros

interface Seccion {
  nivel: number
  titulo: string
  tokens: Token[]
}

/** Parte el documento por títulos de nivel `nivel` (los de nivel mayor quedan dentro). */
function partir(tokens: Token[], nivel: number): { antes: Token[]; secciones: Seccion[] } {
  const antes: Token[] = []
  const secciones: Seccion[] = []
  let actual: Seccion | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t) continue
    if (t.type === 'heading_open' && t.tag === `h${nivel}` && t.level === 0) {
      const titulo = tokens[i + 1]?.content ?? ''
      actual = { nivel, titulo, tokens: [] }
      secciones.push(actual)
      i += 2
      continue
    }
    if (actual) actual.tokens.push(t)
    else antes.push(t)
  }
  return { antes, secciones }
}

function nuevoEntorno(libro: LibroId, anclas: Entorno['anclas'], terminos: Termino[]): Entorno {
  return { libro, anclas, terminos, vistos: new Set(), entrada: null, mencionadas: [], enNegrita: 0, textoNegrita: '', enEnlace: 0 }
}

/**
 * «**Agotado:** texto» o «**Elige.** texto» al principio de un párrafo o de un punto de lista (no de una lista
 * numerada: son pasos) → «**Agotado —** texto».
 */
function definiciones(tokens: Token[]): void {
  const pila: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t) continue
    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') pila.push(t.type)
    if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') pila.pop()
    if (t.type !== 'inline' || pila.at(-1) === 'ordered_list_open') continue
    const [a, b, c] = hijosReales(t)
    if (a?.type === 'strong_open' && b?.type === 'text' && c?.type === 'strong_close' && /[^!?][:.]$/.test(b.content)) {
      b.content = `${b.content.slice(0, -1).trimEnd()} —`
    }
  }
}

function renderizar(md: MarkdownIt, tokens: Token[], e: Entorno): string {
  return md.renderer.render(tokens, md.options, e)
}

/** Bloques de un capítulo o de una entrada a partir de sus tokens. */
function bloquesDe(md: MarkdownIt, tokens: Token[], e: Entorno, opciones: { componentes?: boolean; idSub?: (t: string) => string } = {}): {
  bloques: Bloque[]
  epigrafe: Epigrafe | null
  conTema: boolean
  especial: Capitulo['especial']
  vease: string[] | null
} {
  const bloques: Bloque[] = []
  let epigrafe: Epigrafe | null = null
  let conTema = false
  let especial: Capitulo['especial'] = null
  let vease: string[] | null = null
  let temaPendiente = ''
  let grupo = ''

  const pushHtml = (html: string) => {
    bloques.push({ tipo: 'html', html: temaPendiente + html, ...(temaPendiente ? { tema: true } : {}) })
    temaPendiente = ''
    // Una nota dentro de un punto de lista (sangrada como él) también cuenta.
    if (html.includes('<aside class="nota-tema">')) conTema = true
  }
  const soltarTema = () => {
    if (temaPendiente) bloques.push({ tipo: 'html', html: temaPendiente, tema: true })
    temaPendiente = ''
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t) continue
    const fin = finDeBloque(tokens, i)
    const trozo = tokens.slice(i, fin + 1)
    i = fin

    // Un comentario («<!-- TODO(regla): … -->») es para quien edita el reglamento: no sale en el libro.
    if (t.type === 'html_block' && /^\s*<!--[\s\S]*-->\s*$/.test(t.content)) continue

    if (t.type === 'heading_open') {
      soltarTema()
      const texto = trozo[1]?.content ?? ''
      bloques.push({ tipo: 'subtitulo', id: opciones.idSub ? opciones.idSub(texto) : slug(texto), texto })
      continue
    }

    if (t.type === 'blockquote_open') {
      const meta = t.meta as { tipo?: string; resto?: string } | null
      const tipo = meta?.tipo ?? ''
      const resto = meta?.resto ?? ''
      // El cuerpo de la cita: sin las aperturas y cierres de la cita.
      const cuerpo = trozo.slice(1, -1)
      // Si la marca era todo el primer párrafo, ese párrafo queda vacío: fuera.
      const limpio = cuerpo[1]?.type === 'inline' && cuerpo[1].content === '' ? cuerpo.slice(3) : cuerpo
      // En las notas y los recuadros no se marcan términos: la negrita de la primera vez va en el texto de reglas.
      const sinTerminos: Entorno = { ...e, terminos: [] }
      if (tipo === 'tema' || tipo === 'nota') {
        // Solo las notas temáticas cuentan para el «[nota pendiente]» de un capítulo.
        if (tipo === 'tema') conTema = true
        temaPendiente += renderizar(md, trozo, sinTerminos)
        continue
      }
      soltarTema()
      if (tipo === 'ejemplo') {
        const pasos = limpio.some((x) => x.type === 'ordered_list_open')
        bloques.push({ tipo: 'ejemplo', titulo: resto, html: renderizar(md, limpio, sinTerminos), cartas: cartasYPartes(`${resto}\n${textoPlano(limpio)}`, MAX_CARTAS_EJEMPLO), pasos })
      } else if (tipo === 'importante' || tipo === 'consejo') {
        bloques.push({ tipo, html: renderizar(md, limpio, sinTerminos) })
      } else if (tipo === 'epigrafe') {
        epigrafe = { autor: resto, html: renderizar(md, limpio, sinTerminos) }
      } else if (tipo === 'grafico') {
        const [nombre = '', ...args] = resto.split(/\s+/)
        const arg = args.join(' ')
        if (nombre === 'ejemplo-de-juego' || nombre === 'mazos-de-inicio') {
          especial = nombre
          continue
        }
        const g: Bloque & { tipo: 'grafico' } = { tipo: 'grafico', nombre, arg }
        if (nombre === 'anatomia') {
          // La lista numerada que sigue es su leyenda.
          const sig = tokens[i + 1]
          if (sig?.type === 'ordered_list_open') {
            const finLista = finDeBloque(tokens, i + 1)
            g.leyenda = elementosDeLista(md, tokens.slice(i + 1, finLista + 1), e)
            i = finLista
          }
        }
        if (nombre === 'turno') {
          // Sustituye a la lista numerada que lo precede.
          const previo = bloques.at(-1)
          if (previo?.tipo === 'html' && previo.html.trimStart().startsWith('<ol')) {
            bloques.pop()
            g.pasos = [...previo.html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => (m[1] ?? '').trim())
          }
        }
        bloques.push(g)
      } else {
        pushHtml(renderizar(md, trozo, e))
      }
      continue
    }

    // «*Consulta también:* A, B.» → remisiones al final de la entrada.
    if (t.type === 'paragraph_open') {
      const inline = trozo[1]
      const hijos = hijosReales(inline)
      if (hijos[0]?.type === 'em_open' && /^(Consulta|Véase) también:?$/.test(hijos[1]?.content ?? '')) {
        const lista = hijos
          .slice(3)
          .map((h) => h.content)
          .join('')
          .replace(/\.\s*$/, '')
        vease = lista.split(',').map((x) => x.trim()).filter(Boolean)
        continue
      }
      // Párrafo que solo es una negrita: título de grupo (en Componentes).
      if (opciones.componentes && hijos.length === 3 && hijos[0]?.type === 'strong_open') {
        grupo = hijos[1]?.content ?? ''
        if (tokens[i + 1]?.type === 'table_open') continue
        soltarTema()
        bloques.push({ tipo: 'html', html: `<h4 class="componentes-grupo">${escapar(grupo)}</h4>` })
        grupo = ''
        continue
      }
    }

    if (t.type === 'table_open' && opciones.componentes) {
      soltarTema()
      bloques.push({ tipo: 'componentes', grupo, filas: filasDeTabla(md, trozo, e) })
      grupo = ''
      continue
    }

    pushHtml(renderizar(md, trozo, e))
  }
  soltarTema()
  return { bloques, epigrafe, conTema, especial, vease }
}

function elementosDeLista(md: MarkdownIt, tokens: Token[], e: Entorno): string[] {
  const html = renderizar(md, tokens, e)
  return [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => (m[1] ?? '').trim())
}

function filasDeTabla(md: MarkdownIt, tokens: Token[], e: Entorno): FilaComponente[] {
  const filas: FilaComponente[] = []
  let celdas: string[] = []
  let enCuerpo = false
  for (const t of tokens) {
    if (t.type === 'tbody_open') enCuerpo = true
    if (!enCuerpo) continue
    if (t.type === 'tr_open') celdas = []
    if (t.type === 'inline') celdas.push(md.renderer.renderInline(t.children ?? [], md.options, e))
    if (t.type === 'tr_close') filas.push({ nombre: celdas[0] ?? '', cantidad: celdas[1] ?? '', html: celdas[2] ?? '' })
  }
  return filas
}

function filasPlanas(md: MarkdownIt, tokens: Token[], e: Entorno): string[][] {
  const filas: string[][] = []
  let celdas: string[] = []
  let enCuerpo = false
  for (const t of tokens) {
    if (t.type === 'tbody_open') enCuerpo = true
    if (!enCuerpo) continue
    if (t.type === 'tr_open') celdas = []
    if (t.type === 'inline') celdas.push(md.renderer.renderInline(t.children ?? [], md.options, e))
    if (t.type === 'tr_close') filas.push(celdas)
  }
  return filas
}

function cabeceraDe(tokens: Token[]): string[] {
  const celdas: string[] = []
  let enCabecera = false
  for (const t of tokens) {
    if (t.type === 'thead_open') enCabecera = true
    if (t.type === 'thead_close') break
    if (enCabecera && t.type === 'inline') celdas.push(t.content)
  }
  return celdas
}

/** Ancla única dentro de un libro. */
function creadorDeAnclas(prefijo: string): (titulo: string) => string {
  const usadas = new Set<string>()
  return (titulo) => {
    const base = `${prefijo}-${slug(titulo)}`
    let id = base
    for (let n = 2; usadas.has(id); n++) id = `${base}-${n}`
    usadas.add(id)
    return id
  }
}

// ---------------------------------------------------------------------------
// Índice de términos de la Referencia de reglas

/** Entradas cuya primera frase es una lista («…: Barco, Bestia, … y Tripulación.»): cada palabra va al índice. */
const LISTAS_DEL_INDICE: Record<string, string> = { 'Tipos de encuentro': 'tipo de encuentro', Rasgo: 'Rasgo', Contadores: 'contador' }

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Clave para ordenar el índice: sin tildes ni signos delante («−1 Mando» va con la M). */
export function claveIndice(t: string): string {
  return sinParentesis(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^[^\p{L}]+/u, '')
    .toLowerCase()
}

/**
 * Las líneas del índice de términos, sacadas de las entradas de la Referencia:
 *   - cada entrada, y cada parte de las que juntan dos términos («Curar y reparar» → «Reparar»);
 *   - lo que cada entrada pone en negrita para explicarlo («**Envenenado:**», «**misión lejana**»), con su página exacta:
 *     a esa negrita se le pone un ancla (el atributo `id` de su token);
 *   - cada palabra de las listas de «Tipos de encuentro», «Rasgo» y «Contadores» (antes, «Fichas de misión»).
 * No cuentan las negritas de los ejemplos, los pasos numerados ni los rótulos que van solos en su párrafo.
 */
function indiceDeTerminos(secciones: Seccion[], ids: string[]): LineaIndice[] {
  const titulos = new Set(secciones.flatMap((s) => [s.titulo, sinParentesis(s.titulo)].map((t) => t.toLowerCase())))
  const lineas = new Map<string, LineaIndice & { prioridad: number }>()
  const anclas = new Set<string>()
  const poner = (l: LineaIndice, prioridad: number) => {
    const clave = `${l.termino.toLowerCase()}|${l.clase ?? ''}`
    const antes = lineas.get(clave)
    if (!antes || antes.prioridad < prioridad) lineas.set(clave, { ...l, prioridad })
  }
  secciones.forEach((s, n) => {
    const id = ids[n] ?? ''
    poner({ termino: s.titulo, id, en: null }, 9)
    const partes = sinParentesis(s.titulo).split(' y ')
    for (const p of partes.slice(1)) poner({ termino: mayuscula(p), id, en: s.titulo }, 1)
    const clase = LISTAS_DEL_INDICE[s.titulo]
    let enCita = 0
    let enPasos = 0
    for (const t of s.tokens) {
      if (t.type === 'blockquote_open') enCita++
      if (t.type === 'blockquote_close') enCita--
      if (t.type === 'ordered_list_open') enPasos++
      if (t.type === 'ordered_list_close') enPasos--
      if (t.type !== 'inline' || enCita > 0) continue
      // La línea «Véase también» no es la lista de la entrada.
      if (/^\*?(Véase|Consulta) también/.test(t.content)) continue
      if (clase && t.content.includes(':')) {
        const lista = /:\s*([^.]+)\./.exec(t.content)?.[1] ?? ''
        for (const palabra of lista.split(/,\s*|\s+y\s+|\s+o\s+/).map((x) => x.trim()).filter(Boolean)) poner({ termino: palabra, id, en: s.titulo, clase }, 5)
        continue
      }
      if (enPasos > 0) continue
      const hijos = hijosReales(t)
      // Un rótulo solo en su párrafo («**Estados del Barco**») no es un término.
      if (hijos.length === 3 && hijos[0]?.type === 'strong_open') continue
      hijos.forEach((h, k) => {
        if (h.type !== 'strong_open') return
        let texto = ''
        for (let j = k + 1; j < hijos.length && hijos[j]?.type !== 'strong_close'; j++) texto += hijos[j]?.content ?? ''
        let termino = texto.replace(/\s*[—:.]\s*$/, '').trim()
        if (!termino || termino.startsWith('(') || termino.startsWith('¡')) return
        termino = mayuscula(termino.replace(/^(La|El|Los|Las) /, '').replace(/ N$/, ''))
        // Lo que ya es el principio del título de su entrada («Entra en el mazo de Peligros») sale con ella.
        if (titulos.has(termino.toLowerCase()) || s.titulo.toLowerCase().startsWith(`${termino.toLowerCase()} `)) return
        // Una sola palabra de la familia de su entrada («Curar N» en «Curar y reparar», «Agotada» en «Agotar y
        // preparar») ya la encuentra el lector en esa entrada.
        const raiz = (x: string) => claveIndice(x).slice(0, 5)
        if (!termino.includes(' ') && s.titulo.split(/\s+/).some((w) => w.length >= 5 && raiz(w) === raiz(termino))) return
        let ancla = `${id}--${slug(termino)}`
        for (let m = 2; anclas.has(ancla); m++) ancla = `${id}--${slug(termino)}-${m}`
        anclas.add(ancla)
        h.attrSet('id', ancla)
        // Lo que se define al principio de un párrafo o de un punto pesa más que lo que sale a media frase.
        poner({ termino, id: ancla, en: s.titulo }, k === 0 ? 4 : 3)
      })
    }
  })
  const orden = new Intl.Collator('es', { sensitivity: 'base' })
  return [...lineas.values()]
    .map(({ prioridad: _p, ...l }) => l)
    .sort((a, b) => orden.compare(claveIndice(a.termino), claveIndice(b.termino)) || (a.clase ? 1 : 0) - (b.clase ? 1 : 0))
}

export function leerReglamento(fuente: string): Reglamento {
  const md = crearMarkdown()
  const tokens = prepararMarcas(md.parse(fuente, {}))
  definiciones(tokens)

  const { secciones: partes } = partir(tokens, 2)
  const parte = (prefijo: string): Seccion => {
    const p = partes.find((s) => s.titulo.startsWith(prefijo))
    if (!p) throw new Error(`Falta la sección «${prefijo}» en el reglamento`)
    return p
  }
  const comoUsar = parte('Cómo usar')
  const p1 = partir(parte('Parte 1').tokens, 3)
  const p2 = partir(parte('Parte 2').tokens, 3)
  const rapida = partir(parte('Referencia rápida').tokens, 3)

  // Anclas de los dos libros (capítulos y apartados de Aprende a jugar; entradas de la Referencia).
  const anclaA = creadorDeAnclas('a')
  const anclaR = creadorDeAnclas('r')
  const anclas: Entorno['anclas'] = { aprende: new Map(), referencia: new Map() }
  const idsCapitulo = p1.secciones.map((s) => {
    const id = anclaA(s.titulo)
    anclas.aprende.set(s.titulo, id)
    return id
  })
  const idsSub = new Map<Token, string>()
  for (const s of p1.secciones) {
    for (let i = 0; i < s.tokens.length; i++) {
      const t = s.tokens[i]
      if (t?.type === 'heading_open' && t.level === 0) {
        const titulo = s.tokens[i + 1]?.content ?? ''
        const id = anclaA(titulo)
        idsSub.set(t, id)
        if (!anclas.aprende.has(titulo)) anclas.aprende.set(titulo, id)
      }
    }
  }
  const idsEntrada = p2.secciones.map((s) => {
    const id = anclaR(s.titulo)
    anclas.referencia.set(s.titulo, id)
    return id
  })
  const terminos = terminosDe(p2.secciones.map((s, i) => ({ id: idsEntrada[i] ?? '', titulo: s.titulo })))

  // Cómo usar este libro: el mismo texto en los dos, con las remisiones del libro en que se lee.
  const como = (libro: LibroId) => bloquesDe(md, comoUsar.tokens, nuevoEntorno(libro, anclas, [])).bloques

  // El índice de términos pone sus anclas en los tokens de la Referencia: antes de escribirla.
  const indice = indiceDeTerminos(p2.secciones, idsEntrada)

  // Aprende a jugar.
  const eA = nuevoEntorno('aprende', anclas, terminos)
  const introA = renderizar(md, p1.antes, { ...eA, terminos: [] })
  const subtitulos = [...idsSub.values()]
  let sub = 0
  const capitulos: Capitulo[] = p1.secciones.map((s, n) => {
    const r = bloquesDe(md, s.tokens, eA, { componentes: s.titulo === 'Componentes', idSub: () => subtitulos[sub++] ?? '' })
    // Los subtítulos se recorren en el mismo orden en que se crearon sus anclas.
    return { id: idsCapitulo[n] ?? '', titulo: s.titulo, epigrafe: r.epigrafe, bloques: r.bloques, conTema: r.conTema, especial: r.especial }
  })

  // Referencia de reglas.
  const eR = nuevoEntorno('referencia', anclas, terminos)
  const introR = bloquesDe(md, p2.antes, { ...eR, terminos: [] })
  const entradas: Entrada[] = p2.secciones.map((s, n) => {
    const id = idsEntrada[n] ?? ''
    eR.entrada = id
    eR.vistos = new Set()
    eR.mencionadas = []
    const r = bloquesDe(md, s.tokens, eR)
    const explicitas = r.vease ?? []
    // Las remisiones escritas van primero; después, los términos que nombra la entrada (sin los más generales).
    const automaticas = eR.mencionadas.filter((m) => !explicitas.includes(m) && !GENERALES.has(m))
    const titulos = [...explicitas, ...automaticas].filter((t) => t !== s.titulo)
    const vease: Remision[] = titulos.slice(0, Math.max(4, explicitas.length)).map((titulo) => {
      const enAprende = /\(en Aprende a jugar\)/.test(titulo)
      const limpio = titulo.replace(/\s*\(en Aprende a jugar\)/, '')
      if (enAprende) return { titulo: limpio, id: anclas.aprende.get(limpio) ?? null, libro: 'aprende' }
      return { titulo: limpio, id: anclas.referencia.get(limpio) ?? null, libro: 'referencia' }
    })
    return { id, titulo: s.titulo, letra: letraDe(s.titulo), bloques: r.bloques, vease }
  })

  // Referencia rápida.
  const eQ = nuevoEntorno('referencia', anclas, [])
  const seccionRapida = (prefijo: string): Token[] => rapida.secciones.find((s) => s.titulo.startsWith(prefijo))?.tokens ?? []
  const lista = (prefijo: string) => elementosDeLista(md, seccionRapida(prefijo), eQ)
  const tabla = (prefijo: string) => filasPlanas(md, seccionRapida(prefijo), eQ)
  const estadosTokens = seccionRapida('Estados')
  const finIntro = estadosTokens.findIndex((t) => t.type === 'table_open')

  return {
    comoUsar: { aprende: como('aprende'), referencia: como('referencia') },
    aprende: { intro: introA, capitulos },
    referencia: { intro: introR.bloques, epigrafe: introR.epigrafe, entradas, indice },
    rapida: {
      turno: lista('Secuencia'),
      prueba: lista('Resolver'),
      iconos: tabla('Iconos').map(([icono = '', significa = '']) => ({ icono, significa })),
      estadosIntro: renderizar(md, estadosTokens.slice(0, Math.max(0, finIntro)), eQ),
      estados: tabla('Estados').map(([ficha = '', clase = '', hace = '', quita = '']) => ({ ficha, clase, hace, quita })),
      estadosQuita: cabeceraDe(seccionRapida('Estados'))[3] ?? '',
    },
  }
}
