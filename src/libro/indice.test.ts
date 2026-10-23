// El índice de términos de la Referencia de reglas: que un jugador encuentre en él todo lo que lee en las cartas.
// Si mañana una carta usa un término en negrita, un tipo de encuentro o un Rasgo que el reglamento no explica, falla.

import { describe, expect, it } from 'vitest'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import datosJson from '../../data/cartas.json'
import { CATALOGO } from '../engine/catalogo.ts'
import { INFO_ESTADO } from '../engine/infoEstados.ts'
// El motor entero: al cargarse registra las reglas de cada misión (con sus fichas).
import '../engine/preparacion.ts'
import { reglasMision } from '../engine/misiones2/registro.ts'
import { leerReglamento } from './fuente.ts'

const r = leerReglamento(fuente)
const indice = r.referencia.indice

const normal = (t: string) => t.normalize('NFC').replace(/\s*[:.]\s*$/, '').trim().toLowerCase()

/** Formas distintas del mismo término en una carta y en el reglamento. */
const MISMO_TERMINO: Record<string, string> = { 'ocupa el muelle': 'ocupar el muelle' }

/** ¿Tiene el índice una línea para este término (o su singular, o el término con el que empieza)? */
function enElIndice(termino: string): boolean {
  const t = MISMO_TERMINO[normal(termino)] ?? normal(termino)
  return indice.some((l) => {
    const i = normal(l.termino)
    return t === i || t === `${i}s` || t === `${i}es` || t.startsWith(`${i} `) || t.startsWith(`${i}. `)
  })
}

// ---------------------------------------------------------------------------
// Lo que dicen las cartas (todas las que están en la caja: sin las retiradas)

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** Campos de ayuda del prototipo antiguo: no son el texto de la carta. */
const AYUDAS = new Set(['fallo', 'exito', 'siempre', 'ops', 'ayudaPrototipo', 'textoPrototipo'])

const cartas: { id: string; carta: { [k: string]: Json } }[] = []
for (const [seccion, lista] of Object.entries(datosJson as unknown as Record<string, Json>)) {
  if (seccion.startsWith('_')) continue
  const elementos = Array.isArray(lista) ? lista : lista && typeof lista === 'object' && 'nombre' in lista ? [lista] : []
  for (const c of elementos) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || c.retirada === true) continue
    cartas.push({ id: String(c.id ?? seccion), carta: c })
  }
}

function textos(x: Json, salida: string[] = []): string[] {
  if (typeof x === 'string') salida.push(x)
  else if (Array.isArray(x)) for (const y of x) textos(y, salida)
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!AYUDAS.has(k)) textos(v, salida)
  return salida
}

function nombres(x: Json, salida = new Set<string>()): Set<string> {
  if (Array.isArray(x)) for (const y of x) nombres(y, salida)
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      if (k === 'nombre' && typeof v === 'string') salida.add(normal(v))
      else nombres(v, salida)
    }
  return salida
}

/** Nombres de cartas, encuentros y Destinos: en negrita en una carta, no son términos de juego. */
const NOMBRES_DE_CARTAS = nombres(cartas.map((c) => c.carta))

/** El texto de los encuentros con la etiqueta «Elige» (fase 13: sin la palabra «Elige» en el texto). */
function textosDeElige(x: Json, salida = new Set<string>()): Set<string> {
  if (Array.isArray(x)) for (const y of x) textosDeElige(y, salida)
  else if (x && typeof x === 'object') {
    const etiquetas = x.etiquetas
    if (Array.isArray(etiquetas) && etiquetas.includes('Elige') && typeof x.textoEfecto === 'string') salida.add(x.textoEfecto)
    for (const v of Object.values(x)) textosDeElige(v, salida)
  }
  return salida
}

/**
 * Las negritas de las cartas que son términos de juego («**Acción:**», «**Envenenado**»…). No cuentan los nombres de
 * cartas («**Don Anselmo, el comerciante**») ni los nombres de las opciones de un «Elige» («**A remar:** …
 * **Esperar el viento:** …»).
 */
function negritasDeCartas(): Map<string, string> {
  const encontradas = new Map<string, string>()
  for (const { id, carta } of cartas) {
    const deElige = textosDeElige(carta)
    for (const texto of textos(carta)) {
      // Fase 13 (regla A4): un encuentro «Elige» ya no lleva la palabra en su texto (sale junto a las palabras clave):
      // sus negritas «**Nombre de la opción:**» son nombres de opciones desde el principio.
      if (deElige.has(texto)) encontradas.set('Elige', id)
      let trasElige = deElige.has(texto)
      for (const m of texto.matchAll(/\*\*(.+?)\*\*/g)) {
        const crudo = (m[1] ?? '').trim()
        const termino = crudo.replace(/\s*[:.]\s*$/, '')
        if (/^Elige\b/.test(crudo)) {
          trasElige = true
          encontradas.set('Elige', id)
          continue
        }
        if (NOMBRES_DE_CARTAS.has(normal(termino))) continue
        if (trasElige && crudo.endsWith(':') && !enElIndice(termino)) continue
        if (!encontradas.has(termino)) encontradas.set(termino, id)
      }
    }
  }
  return encontradas
}

const PALABRAS_CLAVE = new Set<string>()
for (const { carta } of cartas) {
  for (const texto of textos(carta)) for (const m of texto.matchAll(/#([^#\s][^#]*?)#/g)) PALABRAS_CLAVE.add(m[1] ?? '')
  const buscar = (x: Json): void => {
    if (Array.isArray(x)) x.forEach(buscar)
    else if (x && typeof x === 'object')
      for (const [k, v] of Object.entries(x)) {
        if (k === 'palabrasClave' && Array.isArray(v)) v.forEach((p) => PALABRAS_CLAVE.add(String(p)))
        else buscar(v)
      }
  }
  buscar(carta)
}

// Fase 11: lo que llevan las permanentes son los tipos de su encuentro (Terreno, Bestia…), no Rasgos de Tripulante.
const RASGOS = new Set(cartas.filter((e) => !e.id.startsWith('pm_')).flatMap(({ carta }) => (Array.isArray(carta.rasgos) ? carta.rasgos.map(String) : [])))

// ---------------------------------------------------------------------------

describe('Índice de términos de la Referencia de reglas', () => {
  it('tiene todas las entradas de la Referencia, cada una con su página', () => {
    for (const e of r.referencia.entradas) expect(indice).toContainEqual({ termino: e.titulo, id: e.id, en: null })
  })

  it('cada término en negrita del texto de las cartas tiene su línea («Acción», «Al revelarse», «Elige», «Incautado», cada Estado…)', () => {
    const negritas = negritasDeCartas()
    expect([...negritas.keys()]).toEqual(expect.arrayContaining(['Acción', 'Respuesta', 'Al revelarse', 'Elige', 'Incautado', 'Envenenado']))
    const faltan = [...negritas].filter(([t]) => !enElIndice(t)).map(([t, id]) => `${t} (${id})`)
    expect(faltan).toEqual([])
  })

  // Fase 10: lo que antes se llamaba «Palabras clave» (Guardia, Militar…) son ahora los «Tipos de encuentro».
  it('cada tipo de encuentro de las cartas (también de los mazos propios) tiene su línea, y la lista de la Referencia es la de las cartas', () => {
    expect(PALABRAS_CLAVE.size).toBeGreaterThan(8)
    for (const p of PALABRAS_CLAVE) expect(indice).toContainEqual(expect.objectContaining({ termino: p, en: 'Tipos de encuentro' }))
    const lista = indice.filter((l) => l.en === 'Tipos de encuentro').map((l) => l.termino)
    expect(new Set(lista)).toEqual(PALABRAS_CLAVE)
  })

  it('fase 10b · «Destina» tiene su entrada y su línea aunque todavía no la use ninguna carta', () => {
    expect(r.referencia.entradas.map((e) => e.titulo)).toContain('Destina')
    expect(enElIndice('Destina')).toBe(true)
    // Ninguna carta la usa aún: la prueba de los términos de las cartas no la exige, pero tampoco la rechaza.
    expect(cartas.some((c) => textos(c.carta).some((t) => /Destina\b/.test(t)))).toBe(false)
  })

  it('cada Rasgo de las cartas tiene su línea', () => {
    expect(RASGOS.size).toBeGreaterThan(8)
    for (const rasgo of RASGOS) expect(indice).toContainEqual(expect.objectContaining({ termino: rasgo, en: 'Rasgo' }))
  })

  it('cada Estado y cada Ventaja, por su nombre, remite a su entrada y a su sitio en ella', () => {
    for (const [clave, info] of Object.entries(INFO_ESTADO)) {
      const linea = indice.find((l) => l.termino === info.nombre)
      expect(linea, info.nombre).toMatchObject({ en: info.ventaja ? 'Ventaja' : 'Estado' })
      expect(linea?.id, clave).toMatch(/^r-(estado|ventaja)--/)
    }
  })

  it('cada ficha de misión que usan las misiones tiene su línea', () => {
    const fichas = new Set(CATALOGO.filter((e) => e.tipo === 'capitulo').flatMap((e) => (reglasMision(e.id)?.fichas ?? []).map((f) => f.nombre)))
    expect(fichas.size).toBe(7) // fase 12: Derrumbe
    for (const f of fichas) expect(indice).toContainEqual(expect.objectContaining({ termino: f, en: 'Fichas de misión' }))
  })

  it('las opciones de los puertos y los términos que un jugador buscaría sin entrada propia remiten a la entrada que los explica', () => {
    const esperado: Record<string, string | null> = {
      Astillero: 'Puerto',
      Taberna: 'Puerto',
      'Tablón de encargos': 'Puerto',
      'Soplos de la Hermandad': 'Puerto',
      Entrenamiento: null,
      'Sin fallo': 'Sin oposición',
      'Misión lejana': 'Distancia',
      'Misiones disponibles': 'Misión',
      Muelle: null,
      Reputación: null,
      'Fallas la Prueba': 'Destino',
    }
    for (const [termino, en] of Object.entries(esperado)) expect(indice, termino).toContainEqual(expect.objectContaining({ termino, en }))
  })

  it('cada línea remite a un sitio que existe: su entrada o la negrita de la entrada que lo explica', () => {
    const html = r.referencia.entradas.flatMap((e) => e.bloques.map((b) => ('html' in b ? b.html : ''))).join('\n')
    for (const l of indice) {
      if (r.referencia.entradas.some((e) => e.id === l.id)) continue
      expect(html, l.termino).toContain(`<strong id="${l.id}">`)
    }
  })

  it('va en orden alfabético, sin tener en cuenta tildes ni signos («−1 Mando» va con la M)', () => {
    const terminos = indice.map((l) => l.termino)
    expect(terminos.indexOf('Abordaje')).toBe(0)
    expect(terminos.indexOf('−1 Mando')).toBe(terminos.indexOf('Mando') + 1)
    expect(terminos.indexOf('Única (★)')).toBeGreaterThan(terminos.indexOf('Tripulante'))
  })
})
