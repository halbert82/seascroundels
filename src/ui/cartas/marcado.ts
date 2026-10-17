// Intérprete del marcado de los textos de las cartas (ver «_leyenda» en data/cartas.json):
//   **negrita**      etiqueta de capacidad (Acción:, Respuesta:…)
//   [ICONO]          icono suelto
//   {N icono f}      número con icono opcional; f = g/r/k (verde/rojo/tinta)
//   _Rasgo_          Rasgo en negrita cursiva
//   #Clave#          palabra clave de encuentro
//   \n               salto de párrafo

export const ICONOS = [
  'NAV',
  'COM',
  'EXP',
  'mar',
  'nat',
  'ciu',
  'herida',
  'dano',
  'avance',
  'municion',
  'robar',
  'curar',
  'agotar',
  'descartar',
  'rep',
  'vida',
  'mejora',
  'capacidad',
  'MAN',
  'rehen',
  'sinop',
  'espacio',
  'saco',
  'doblon',
  'acampar',
] as const

export type IconoId = (typeof ICONOS)[number]

export function esIcono(nombre: string): nombre is IconoId {
  return (ICONOS as readonly string[]).includes(nombre)
}

export type ColorNumero = 'verde' | 'rojo' | 'tinta'

export type Segmento =
  | { tipo: 'texto'; texto: string; negrita: boolean }
  | { tipo: 'rasgo'; texto: string }
  | { tipo: 'clave'; texto: string }
  /** `pegado`: texto en negrita que va justo detrás del icono, sin espacio (p. ej. «:»). */
  | { tipo: 'icono'; icono: IconoId; negrita: boolean; pegado?: string }
  | { tipo: 'numero'; valor: string; icono?: IconoId; color: ColorNumero }
  | { tipo: 'parrafo' }

const PATRON = /\*\*|\[([A-Za-z]+)\]|\{([^}]*)\}|_([^_]+)_|#([^#]+)#|\n/g

/** Opciones de interpretación. En la franja de Destino, un «+N» sin marca sube la dificultad: va en rojo. */
export interface OpcionesTexto {
  masEsMalo?: boolean
}

function colorDeNumero(
  valor: string,
  bandera: string | undefined,
  icono: string | undefined,
  opciones: OpcionesTexto,
): ColorNumero {
  if (bandera === 'g') return 'verde'
  if (bandera === 'r') return 'rojo'
  if (bandera === 'k') return 'tinta'
  if (valor.startsWith('+')) return opciones.masEsMalo ? 'rojo' : 'verde'
  if (valor.startsWith('−') || valor.startsWith('-')) return 'rojo'
  // Las heridas, la Vida y el daño del Barco llevan el número en rojo.
  if (icono === 'herida' || icono === 'vida' || icono === 'dano') return 'rojo'
  return 'tinta'
}

/** Interpreta «{+1 NAV}», «{2 dano g}», «{−1 g}»… */
export function parsearNumero(contenido: string, opciones: OpcionesTexto = {}): Extract<Segmento, { tipo: 'numero' }> {
  const partes = contenido.trim().split(/\s+/)
  const valor = partes.shift() ?? ''
  let bandera: string | undefined
  const ultima = partes[partes.length - 1]
  if (ultima === 'g' || ultima === 'r' || ultima === 'k') {
    bandera = ultima
    partes.pop()
  }
  const nombreIcono = partes[0]
  if (partes.length > 1 || (nombreIcono !== undefined && !esIcono(nombreIcono))) {
    throw new Error(`Número con icono no reconocido: {${contenido}}`)
  }
  const segmento: Extract<Segmento, { tipo: 'numero' }> = {
    tipo: 'numero',
    valor,
    color: colorDeNumero(valor, bandera, nombreIcono, opciones),
  }
  if (nombreIcono !== undefined) segmento.icono = nombreIcono
  return segmento
}

/** Convierte un texto marcado en segmentos listos para dibujar. */
export function parsearTexto(texto: string, opciones: OpcionesTexto = {}): Segmento[] {
  const segmentos: Segmento[] = []
  let negrita = false
  let ultimo = 0

  const empujarTexto = (fragmento: string) => {
    if (fragmento) segmentos.push({ tipo: 'texto', texto: fragmento, negrita })
  }

  for (const m of texto.matchAll(PATRON)) {
    const inicio = m.index
    empujarTexto(texto.slice(ultimo, inicio))
    ultimo = inicio + m[0].length

    if (m[0] === '**') {
      negrita = !negrita
    } else if (m[0] === '\n') {
      segmentos.push({ tipo: 'parrafo' })
    } else if (m[1] !== undefined) {
      if (!esIcono(m[1])) throw new Error(`Icono desconocido: [${m[1]}]`)
      segmentos.push({ tipo: 'icono', icono: m[1], negrita })
    } else if (m[2] !== undefined) {
      segmentos.push(parsearNumero(m[2], opciones))
    } else if (m[3] !== undefined) {
      segmentos.push({ tipo: 'rasgo', texto: m[3] })
    } else if (m[4] !== undefined) {
      segmentos.push({ tipo: 'clave', texto: m[4] })
    }
  }
  empujarTexto(texto.slice(ultimo))
  if (negrita) throw new Error(`Negrita sin cerrar en: ${texto}`)

  // Un icono seguido sin espacio de «:» (o, dentro de una negrita, de cualquier texto en negrita)
  // va pegado a ese texto, en negrita: «[agotar]:», «[mar]:».
  for (let i = 0; i < segmentos.length - 1; i++) {
    const actual = segmentos[i]
    const siguiente = segmentos[i + 1]
    if (actual?.tipo !== 'icono' || siguiente?.tipo !== 'texto') continue
    const pegado = actual.negrita && siguiente.negrita ? /^\S+/.exec(siguiente.texto)?.[0] : /^:/.exec(siguiente.texto)?.[0]
    if (!pegado) continue
    actual.pegado = pegado
    const resto = siguiente.texto.slice(pegado.length)
    if (resto) siguiente.texto = resto
    else segmentos.splice(i + 1, 1)
  }

  return segmentos
}

// ---------------------------------------------------------------------------
// Fichas de los recuadros de efecto de los Peligros y de las recompensas:
// «1 [dano] · −1 [mejora]», «−1 Mando», «Todos [agotar]», «Sin fallo»…

export interface Ficha {
  /** Lo que va delante del icono («1», «−1», «Todos») o el texto completo si no hay icono. */
  texto: string
  icono?: IconoId
  /** Mejora tachada: «agota una Mejora». */
  rota?: boolean
}

export function parsearFichas(texto: string): Ficha[] {
  if (!texto.trim()) return []
  return texto.split(' · ').map((parte): Ficha => {
    const m = /^(.*?)\s*\[([A-Za-z]+)\]$/.exec(parte.trim())
    if (!m) return { texto: parte.trim() }
    const [, delante = '', nombre = ''] = m
    if (!esIcono(nombre)) throw new Error(`Icono desconocido en ficha: ${parte}`)
    const ficha: Ficha = { texto: delante, icono: nombre }
    if (nombre === 'mejora' && !delante.startsWith('−') && !delante.startsWith('-')) ficha.rota = true
    return ficha
  })
}
