// Dónde se pone una carta ampliada: pegada a la carta original y siempre dentro de la mesa visible.
//
// - Al lado de la carta: a la derecha si cabe; si no, a la izquierda; si no, encima o debajo (donde haya más sitio).
// - De lado, su borde superior va a la altura del de la carta; si así no cabe, centrada; si tampoco, desplazada lo justo.
//   Encima o debajo, alineada con el borde izquierdo de la carta, o centrada, o desplazada lo justo.
// - Las explicaciones de sus palabras de regla van pegadas a la ampliación, por el lado libre (el contrario a la carta
//   original). Si a dos columnas no caben, se prueba a una; si de lado tampoco, encima o debajo de la ampliación; y si
//   tampoco, al otro lado de la carta original.
// - Se evita tapar la carta original. Si no hay forma de no taparla, se prueba con la ampliación algo más pequeña (hasta
//   el 80 %); y si tampoco, se elige la colocación que menos la tapa, siempre dentro de lo visible.
//
// Todo en unidades del lienzo. Función pura, sin DOM, para poder probarla.

export interface Caja {
  x: number
  y: number
  ancho: number
  alto: number
}

export interface Tamano {
  ancho: number
  alto: number
}

export type Lado = 'derecha' | 'izquierda' | 'arriba' | 'abajo'

export interface PeticionColocacion {
  /** La carta original, sobre la mesa. */
  original: Caja
  /** La carta ampliada. */
  carta: Tamano
  /** Las explicaciones medidas a una columna y, si van a dos, también a dos (se prueba primero la de dos). */
  ayudas?: { una: Tamano; dos?: Tamano | undefined } | null
  /** Lo que se ve de la mesa. */
  limites: Caja
  /** Distancia mínima a los bordes de lo visible. */
  margen?: number
  /** Distancia entre la carta original, la ampliada y sus explicaciones. */
  separacion?: number
}

export interface Colocacion {
  lado: Lado
  carta: { x: number; y: number }
  ayudas: { x: number; y: number; columnas: 1 | 2 } | null
  /** No había sitio libre: la ampliación (o sus explicaciones) tapa algo de la carta original. */
  tapa: boolean
  /** Si para no tapar la carta la ampliación sale más pequeña: la fracción de su tamaño (sin esto, entera). */
  reduccion?: number
}

/** Tamaños de la ampliación que se prueban si a tamaño entero tapa la carta original. */
const REDUCCIONES = [0.95, 0.9, 0.85, 0.8]

export function colocarAmpliacion(p: PeticionColocacion): Colocacion {
  const entera = colocarConTamano(p)
  if (!entera.tapa) return entera
  for (const f of REDUCCIONES) {
    const k = colocarConTamano({ ...p, carta: { ancho: p.carta.ancho * f, alto: p.carta.alto * f } })
    if (!k.tapa) return { ...k, reduccion: f }
  }
  return entera
}

export const MARGEN_AMPLIACION = 8
export const SEPARACION_AMPLIACION = 12

interface Bordes {
  izq: number
  arr: number
  der: number
  aba: number
}

/** Coloca `tam` en [min, max] por un eje: en `preferida` si cabe, si no en `alternativa`, si no lo justo para caber. */
function alinear(preferida: number, alternativa: number, tam: number, min: number, max: number): number {
  const cabe = (v: number) => v >= min && v + tam <= max
  if (cabe(preferida)) return preferida
  if (cabe(alternativa)) return alternativa
  return encajar(preferida, tam, min, max)
}

/** Desplaza lo justo para que quede dentro; si es más grande que el hueco, pegado al principio. */
function encajar(v: number, tam: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max - tam))
}

function cruza(a: Caja, b: Caja): boolean {
  return a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto
}

function dentro(c: Caja, b: Bordes): boolean {
  const e = 0.5
  return c.x >= b.izq - e && c.y >= b.arr - e && c.x + c.ancho <= b.der + e && c.y + c.alto <= b.aba + e
}

interface Candidata extends Colocacion {
  cajas: Caja[]
}

function colocarConTamano(p: PeticionColocacion): Colocacion {
  const margen = p.margen ?? MARGEN_AMPLIACION
  const sep = p.separacion ?? SEPARACION_AMPLIACION
  const o = p.original
  const c = p.carta
  const b: Bordes = { izq: p.limites.x + margen, arr: p.limites.y + margen, der: p.limites.x + p.limites.ancho - margen, aba: p.limites.y + p.limites.alto - margen }
  // Formas de las explicaciones a probar, de la preferida (dos columnas) a la de una.
  const formas: { tam: Tamano; columnas: 1 | 2 }[] = p.ayudas
    ? [...(p.ayudas.dos ? [{ tam: p.ayudas.dos, columnas: 2 as const }] : []), { tam: p.ayudas.una, columnas: 1 as const }]
    : []
  const una = formas[formas.length - 1]

  const terminar = (lado: Lado, carta: Caja, ayudas: (Caja & { columnas: 1 | 2 }) | null): Candidata => {
    const cajas = ayudas ? [carta, ayudas] : [carta]
    return {
      lado,
      carta: { x: carta.x, y: carta.y },
      ayudas: ayudas ? { x: ayudas.x, y: ayudas.y, columnas: ayudas.columnas } : null,
      tapa: cajas.some((k) => cruza(k, o)),
      cajas,
    }
  }
  const valida = (k: Candidata) => !k.tapa && k.cajas.every((x) => dentro(x, b)) && !(k.cajas[1] && cruza(k.cajas[0] as Caja, k.cajas[1]))

  /** La carta ampliada de lado, con su altura alineada con la original. */
  const cartaDeLado = (lado: 'derecha' | 'izquierda'): Caja => {
    const x = lado === 'derecha' ? o.x + o.ancho + sep : o.x - sep - c.ancho
    const y = alinear(o.y, o.y + o.alto / 2 - c.alto / 2, c.alto, b.arr, b.aba)
    return { x, y, ancho: c.ancho, alto: c.alto }
  }
  /** La carta ampliada encima o debajo, alineada con el borde izquierdo de la original (o centrada). */
  const cartaEncima = (lado: 'arriba' | 'abajo'): Caja => {
    const y = lado === 'arriba' ? o.y - sep - c.alto : o.y + o.alto + sep
    const x = alinear(o.x, o.x + o.ancho / 2 - c.ancho / 2, c.ancho, b.izq, b.der)
    return { x, y, ancho: c.ancho, alto: c.alto }
  }
  /** Las explicaciones al lado de la ampliación, a su altura (desplazadas lo justo para caber). */
  const ayudasAlLado = (carta: Caja, hacia: 'derecha' | 'izquierda', f: { tam: Tamano; columnas: 1 | 2 }) => {
    const x = hacia === 'derecha' ? carta.x + carta.ancho + sep : carta.x - sep - f.tam.ancho
    return { x, y: encajar(carta.y, f.tam.alto, b.arr, b.aba), ancho: f.tam.ancho, alto: f.tam.alto, columnas: f.columnas }
  }
  /** Las explicaciones encima o debajo de la ampliación, por su lado libre. */
  const ayudasEncima = (carta: Caja, hacia: 'arriba' | 'abajo', lado: 'derecha' | 'izquierda', f: { tam: Tamano; columnas: 1 | 2 }) => {
    const y = hacia === 'arriba' ? carta.y - sep - f.tam.alto : carta.y + carta.alto + sep
    // Pegadas al borde de la ampliación más lejano a la original.
    const x0 = lado === 'derecha' ? carta.x : carta.x + carta.ancho - f.tam.ancho
    return { x: encajar(x0, f.tam.ancho, b.izq, b.der), y, ancho: f.tam.ancho, alto: f.tam.alto, columnas: f.columnas }
  }

  // 1. De lado, con las explicaciones pegadas por el lado libre: derecha y luego izquierda, a dos columnas y luego a una.
  if (formas.length === 0) {
    for (const lado of ['derecha', 'izquierda'] as const) {
      const k = terminar(lado, cartaDeLado(lado), null)
      if (valida(k)) return sinCajas(k)
    }
  } else {
    for (const f of formas) {
      for (const lado of ['derecha', 'izquierda'] as const) {
        const carta = cartaDeLado(lado)
        const k = terminar(lado, carta, ayudasAlLado(carta, lado, f))
        if (valida(k)) return sinCajas(k)
      }
    }
    // 2. De lado cabe la carta, pero no las explicaciones a su lado: encima o debajo de la ampliación.
    if (una) {
      for (const lado of ['derecha', 'izquierda'] as const) {
        const carta = cartaDeLado(lado)
        const arriba = carta.y - b.arr
        const abajo = b.aba - (carta.y + carta.alto)
        for (const hacia of arriba >= abajo ? (['arriba', 'abajo'] as const) : (['abajo', 'arriba'] as const)) {
          const k = terminar(lado, carta, ayudasEncima(carta, hacia, lado, una))
          if (valida(k)) return sinCajas(k)
        }
      }
    }
  }

  // 3. Encima o debajo, donde haya más sitio; las explicaciones al lado de la ampliación con más hueco.
  const sitioArriba = o.y - b.arr
  const sitioAbajo = b.aba - (o.y + o.alto)
  const vertical = sitioArriba >= sitioAbajo ? (['arriba', 'abajo'] as const) : (['abajo', 'arriba'] as const)
  for (const lado of vertical) {
    const carta = cartaEncima(lado)
    if (formas.length === 0) {
      const k = terminar(lado, carta, null)
      if (valida(k)) return sinCajas(k)
      continue
    }
    const hacia = b.der - (carta.x + carta.ancho) >= carta.x - b.izq ? 'derecha' : 'izquierda'
    for (const f of formas) {
      for (const h of hacia === 'derecha' ? (['derecha', 'izquierda'] as const) : (['izquierda', 'derecha'] as const)) {
        const k = terminar(lado, carta, ayudasAlLado(carta, h, f))
        if (valida(k)) return sinCajas(k)
      }
    }
  }

  // 4. Las explicaciones no caben junto a la ampliación: la ampliación a un lado de la carta y ellas al otro.
  const alOtroLado = (carta: Caja, lado: 'derecha' | 'izquierda', f: { tam: Tamano; columnas: 1 | 2 }) => {
    const x = lado === 'derecha' ? o.x - sep - f.tam.ancho : o.x + o.ancho + sep
    return { x: encajar(x, f.tam.ancho, b.izq, b.der), y: encajar(carta.y, f.tam.alto, b.arr, b.aba), ancho: f.tam.ancho, alto: f.tam.alto, columnas: f.columnas }
  }
  for (const f of formas) {
    for (const lado of ['derecha', 'izquierda'] as const) {
      const carta = cartaDeLado(lado)
      const k = terminar(lado, carta, alOtroLado(carta, lado, f))
      if (valida(k)) return sinCajas(k)
    }
  }

  // 5. No cabe en ningún sitio sin tapar la carta: de las colocaciones posibles (siempre dentro y sin que las
  //    explicaciones pisen la ampliación), la que menos la tapa.
  const candidatas: Candidata[] = []
  for (const lado of ['derecha', 'izquierda', 'arriba', 'abajo'] as const) {
    const de = lado === 'derecha' || lado === 'izquierda' ? cartaDeLado(lado) : cartaEncima(lado)
    const carta = { ...de, x: encajar(de.x, c.ancho, b.izq, b.der), y: encajar(de.y, c.alto, b.arr, b.aba) }
    if (!una) {
      candidatas.push(terminar(lado, carta, null))
      continue
    }
    for (const f of formas) {
      for (const hacia of ['derecha', 'izquierda'] as const) {
        // La ampliación y sus explicaciones juntas, como un bloque que se desplaza lo justo para caber.
        const bloque = c.ancho + sep + f.tam.ancho
        const inicio = encajar(hacia === 'derecha' ? de.x : de.x - sep - f.tam.ancho, bloque, b.izq, b.der)
        const enBloque = { ...carta, x: hacia === 'derecha' ? inicio : inicio + f.tam.ancho + sep }
        const ayudas = { x: hacia === 'derecha' ? inicio + c.ancho + sep : inicio, y: encajar(carta.y, f.tam.alto, b.arr, b.aba), ancho: f.tam.ancho, alto: f.tam.alto, columnas: f.columnas }
        candidatas.push(terminar(lado, enBloque, ayudas))
        if (lado === 'derecha' || lado === 'izquierda') candidatas.push(terminar(lado, carta, alOtroLado(carta, lado, f)))
      }
    }
  }
  const tapado = (k: Candidata) => k.cajas.reduce((n, x) => n + solape(x, o), 0)
  const posibles = candidatas.filter((k) => k.cajas.every((x) => dentro(x, b)) && !(k.cajas[1] && cruza(k.cajas[0] as Caja, k.cajas[1])))
  const mejor = (posibles.length > 0 ? posibles : candidatas).reduce((m, k) => (tapado(k) < tapado(m) - 0.5 ? k : m))
  return sinCajas(mejor)
}

function solape(a: Caja, b: Caja): number {
  const ancho = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x)
  const alto = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y)
  return ancho > 0 && alto > 0 ? ancho * alto : 0
}

function sinCajas({ lado, carta, ayudas, tapa }: Candidata): Colocacion {
  return { lado, carta, ayudas, tapa }
}
