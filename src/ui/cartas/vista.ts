// Traduce una carta del catálogo a lo que hay que dibujar: colores, pestañas,
// textos ya interpretados… Los componentes de carta solo pintan esta «vista».

import arteJson from '../../../data/arte.json'
import { codigoColeccion, type EntradaCatalogo } from '../../engine/catalogo.ts'
import { dorsoDeHistoria, type DorsoHistoria } from './historia.ts'
import type { DestinoDatos, EncuentroDatos, Entorno, Habilidad, MisionDatos } from '../../engine/datos.ts'
import { LETRA_JUGADOR, arteCorto } from './ajustes.ts'
import { parsearFichas, parsearTexto, type Ficha, type IconoId, type Segmento } from './marcado.ts'

// ---------------------------------------------------------------------------
// Paleta (tomada de la maquetación original y de las imágenes de referencia)

export const COLOR_TIPO = {
  capitan: '#2B2A33',
  barco: '#24405A',
  tripulantePirateria: '#7A2E22',
  tripulanteNeutral: '#4E5A3A',
  mejoraBarco: '#1D4E66',
  mejoraTripulante: '#6B4A2B',
  evento: '#2E5E63',
  habilidad: '#3B302A',
  escenario: '#7A5418',
  tesoro: '#7A5A14',
  pasajero: '#4A4F6B',
  /** Fase 11: las permanentes (cartas del mazo de historia que pone en juego un encuentro). */
  permanente: '#3F4B45',
  /** Fase 15: las cartas del mazo del naufragio, todas del mismo color (no se distingue cuáles ayudan y cuáles hacen daño). */
  naufragio: '#34505A',
  /** Fase 15 (tercera ronda): las cartas de recompensa del mazo de historia («Coge la carta 286 del mazo de historia»). */
  recompensa: '#5A4A2E',
  /** Fase 16: las cartas mini de Estado (rojo) y de Ventaja (verde). */
  estado: '#8E2B23',
  ventaja: '#3D6631',
} as const

/** El color de cada Clase (fase 10c): enmarca todas sus cartas, de cualquier tipo. */
export const COLOR_CLASE: Record<string, string> = { Piratería: '#7A2E22', Neutral: '#4E5A3A' }

/** La Clase de una carta de jugador (fase 11: todas la llevan en los datos, Neutral incluida). */
function claseDe(c: { senda: string }): string {
  return c.senda
}

export const COLOR_HABILIDAD: Record<Habilidad, string> = { NAV: '#24609A', COM: '#8E2B23', EXP: '#8A5E0F' }
export const COLOR_ENTORNO: Record<Entorno, string> = { mar: '#1D5872', nat: '#3D6631', ciu: '#8A4F2E' }

/** Color del modificador del Destino (fase 10: se suma al total del jugador; «+N» es bueno, en verde, y «−N», malo). El
 * «0» va sin signo y en pardo, neutro. */
export const COLOR_MOD: Record<string, string> = {
  '0': '#6A5640',
  '−1': '#8E2B23',
  '−2': '#8E2B23',
  '+1': '#3D6631',
  '+2': '#37622B',
  '✕': '#5E120B',
}

const ORDEN_ENTORNOS: Entorno[] = ['mar', 'nat', 'ciu']

// ---------------------------------------------------------------------------
// Ilustraciones

interface ArteDatos {
  archivo: string
  encuadre: string
}

const ARTE = arteJson as Record<string, ArteDatos>

const URLS_ARTE = import.meta.glob<string>('../../../assets/arte/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** Copias pequeñas para la mesa y la galería (npm run arte:mesa): las grandes son para el reglamento impreso. */
const URLS_ARTE_MESA = import.meta.glob<string>('../../../assets/arte/mesa/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

let arteGrande = false

/** El reglamento dibuja las cartas con las ilustraciones grandes (en papel, las pequeñas se verían blandas). */
export function usarIlustracionesGrandes(): void {
  arteGrande = true
}

export interface Arte {
  url: string
  encuadre: string
}

export function arteDe(id: string): Arte | undefined {
  const arte = ARTE[id]
  if (!arte) return undefined
  const grande = URLS_ARTE[`../../../${arte.archivo}`]
  if (!grande) throw new Error(`No encuentro la ilustración ${arte.archivo} de «${id}»`)
  const pequena = URLS_ARTE_MESA[`../../../${arte.archivo.replace('assets/arte/', 'assets/arte/mesa/')}`]
  return { url: arteGrande || !pequena ? grande : pequena, encuadre: arte.encuadre }
}

// ---------------------------------------------------------------------------
// Vistas

export interface Pestana {
  icono: IconoId
  valor?: number
  color: string
}

export interface VistaJugador {
  forma: 'jugador'
  num: number
  codigo: string
  nombre: string
  unica: boolean
  color: string
  tipoTexto: string
  /** Habilidades: ilustración más alta y caja de texto más baja. */
  alta: boolean
  /** Fase 11: permanente (mucho texto): ilustración más baja, caja de texto más alta y letra que se ajusta. */
  permanente?: boolean
  coste?: number
  /** Cuadros de Espacio de una Mejora de barco (0 = sin placa). */
  espacio: number
  pestanasIzq: Pestana[]
  pestanasIzqTop: number
  pestanasDer: Pestana[]
  pestanasDerTop: number
  /** Huecos de Mejora (el saco), si la carta los tiene. */
  huecos?: number
  huecosTop: number
  vida?: number
  rasgos: string[]
  /** Fase 14: el tipo de una permanente («Guardia», «Terreno»), con la letra del tipo de un encuentro. */
  tipos?: string
  texto: Segmento[]
  /** «big»: una sola cifra grande y centrada; «center»: centrado. */
  textoClase: '' | 'big' | 'center'
  /** Fase 16: letra de las reglas de una carta de jugador, en px (18; ver ajustes.ts). Sin ella, la de su tipo de carta. */
  letra?: number
  /** P125: px que se acorta la ilustración para que quepa el texto (la caja de texto sube lo mismo). */
  arteCorto?: number
  ambientacion: string
  arte?: Arte
  /**
   * Diseño por tipo (fase 10c, opción 1 de Albert): el Tripulante con la ilustración a sangre; la Mejora de barco en un
   * cuadro con esquinas de latón; la de tripulante, en un óvalo; el Evento con la ilustración en arco y el nombre en
   * medio; la Habilidad, sin coste, con la ilustración larga. Sin él, la carta de siempre.
   */
  diseno?: 'tripulante' | 'mejoraBarco' | 'mejoraTripulante' | 'evento' | 'habilidad'
  /** Clase de la carta (Piratería, Neutral…): su color enmarca la carta y su nombre va en el pie. */
  clase?: string
}

export interface Opcion {
  hab: Habilidad
  dificultad: number
  /**
   * Fase 13 (regla A6): la dificultad por Rasgo se lee «Vigía −2» (o «Marinero asignado −2» si el Tripulante tiene que
   * estar asignado): con ese Rasgo, la dificultad baja `rebaja`.
   */
  alternativa?: { rasgo: string; asignado: boolean; rebaja: number }
  /** La dificultad es «X». */
  variable?: boolean
}

/** Textos completos de un encuentro de los Peligros 2.0. */
export interface TextosEncuentro {
  etiquetas: string[]
  nota: Segmento[]
  texto: Segmento[]
  exito: Segmento[]
  fallo: Segmento[]
  /** Cuánto texto lleva (para repartir el alto de la carta). */
  peso: number
}

export interface VistaEncuentro {
  entorno?: Entorno
  nombre: string
  claves: string
  avance: number
  /** Avance si no superas la Prueba («3 / 2»): solo en los encuentros con Prueba. */
  avanceSinSuperar?: number
  opciones: Opcion[]
  conPrueba: boolean
  exito: Ficha[]
  fallo: Ficha[]
  efecto: Ficha[]
  /** Peligros 2.0: textos completos en vez de fichas. */
  textos?: TextosEncuentro
}

export interface VistaDestino {
  nombre: string
  mod: string
  colorMod: string
  ambientacion: string
  texto: Segmento[]
  sinOposicion: Ficha[]
  /** Peligros 2.0: la línea Sin oposición en texto. */
  sinOposicionTexto?: Segmento[]
}

export interface VistaPeligro {
  forma: 'peligro'
  num: number
  codigo: string
  encuentros: VistaEncuentro[]
  destino: VistaDestino
  entraDuranteLaPartida: boolean
  /** Peligros 2.0: maquetación con los textos completos. */
  v2?: boolean
}

export interface VistaMazoPropio {
  forma: 'mazoPropio'
  num: number
  codigo: string
  mazo: string
  encuentro: VistaEncuentro
  destino: VistaDestino
  /** Formato de los Peligros 2.0: textos completos. */
  v2?: boolean
}

export interface VistaCapitulo {
  forma: 'capitulo'
  num: number
  codigo: string
  sello: string
  /** Capítulo con salida doble: «a» o «b». */
  rama?: string
  de: string
  travesia: string
  nombre: string
  entorno: Entorno
  distancia: number
  avance: number
  reglas: Segmento[][]
  ambientacion: string
  recompensa: Ficha[]
  recompensaTexto?: string
  /** La recompensa tal y como se imprime, cuando no basta con las fichas (finales con elección…). */
  recompensaMarcada?: Segmento[]
  siguiente?: string
  pie: string
  arte?: Arte
}

export interface VistaPuerto {
  forma: 'puerto'
  num: number
  codigo: string
  nombre: string
  muelle: number
  /** Cuántas misiones disponibles hay (fase 10). */
  misiones: number
  comunes: Segmento[][]
  propia: { nombre: string; texto: Segmento[] }
  ambientacion: string
  arte?: Arte
}

/** Las cartas del mazo de historia llevan su número bien visible y el dorso del mazo al que van (fase 10). */
export interface HistoriaDeCarta {
  num: number
  dorso: DorsoHistoria
}

/**
 * Fase 16: carta mini de Estado o de Ventaja (como los estados de Marvel Champions): el nombre, la línea de tipo
 * («Estado · Tripulante») y el texto, con el marco rojo (Estados) o verde (Ventajas).
 */
export interface VistaMini {
  forma: 'mini'
  num: number
  codigo: string
  nombre: string
  tipoTexto: string
  color: string
  ventaja: boolean
  texto: Segmento[]
  /** Cuántas copias hay en la caja («×6»). */
  copias: number
}

export type VistaCarta = (VistaJugador | VistaPeligro | VistaMazoPropio | VistaCapitulo | VistaPuerto | VistaMini) & { historia?: HistoriaDeCarta }

// ---------------------------------------------------------------------------

function pestanasHabilidad(c: { NAV: number; COM: number; EXP: number }): Pestana[] {
  return (['NAV', 'COM', 'EXP'] as const).map((hab) => ({ icono: hab, valor: c[hab], color: COLOR_HABILIDAD[hab] }))
}

function pestanasIconos(iconos: Habilidad[]): Pestana[] {
  return iconos.map((hab) => ({ icono: hab, color: COLOR_HABILIDAD[hab] }))
}

/** El texto es una sola cifra con icono («{+1 dano}»): se dibuja grande y centrado. */
function esCifraSola(texto: string): boolean {
  return /^\{[^}]*\}$/.test(texto.trim())
}

function base(entrada: EntradaCatalogo): Omit<VistaJugador, 'nombre' | 'color' | 'tipoTexto' | 'texto' | 'ambientacion'> {
  const corto = arteCorto(entrada.num)
  return {
    ...(corto > 0 ? { arteCorto: corto } : {}),
    forma: 'jugador',
    num: entrada.num,
    codigo: codigoColeccion(entrada.num),
    unica: false,
    alta: false,
    espacio: 0,
    pestanasIzq: [],
    pestanasIzqTop: 92,
    pestanasDer: [],
    pestanasDerTop: 254,
    huecosTop: 150,
    rasgos: [],
    textoClase: '',
  }
}

/** Base de una carta de jugador (Capitán, Barco, Tripulante, Mejoras, Evento y Habilidad): la de todas, con su letra. */
function baseJugador(entrada: EntradaCatalogo): ReturnType<typeof base> {
  return { ...base(entrada), letra: LETRA_JUGADOR }
}

/** Fase 13: en las cartas de Peligro, «Daña 2» no se parte entre dos líneas. */
const UNIR = { unirNumero: true } as const

function vistaEncuentro(e: EncuentroDatos, entorno?: Entorno, v2 = false): VistaEncuentro {
  const opciones = e.prueba.map((p) => {
    const opcion: Opcion = { hab: p.hab, dificultad: p.dificultad }
    if (p.alternativa) opcion.alternativa = { rasgo: p.alternativa.rasgo, asignado: p.alternativa.comprometido === true, rebaja: p.dificultad - p.alternativa.dificultad }
    if (p.variable) opcion.variable = true
    return opcion
  })
  const vista: VistaEncuentro = v2
    ? {
        nombre: e.nombre,
        claves: e.palabrasClave.join(' · '),
        avance: e.avance,
        ...(e.avanceSinSuperar !== undefined && e.prueba.length > 0 ? { avanceSinSuperar: e.avanceSinSuperar } : {}),
        opciones,
        conPrueba: e.prueba.length > 0,
        exito: [],
        fallo: [],
        efecto: [],
        textos: {
          etiquetas: e.etiquetas ?? [],
          nota: parsearTexto(e.notaPrueba ?? '', UNIR),
          texto: parsearTexto(e.textoEfecto ?? '', UNIR),
          exito: parsearTexto(e.textoExito ?? '', UNIR),
          fallo: parsearTexto(e.textoFallo ?? '', UNIR),
          peso: 130 + (e.notaPrueba ?? '').length + (e.textoEfecto ?? '').length + (e.textoExito ?? '').length + (e.textoFallo ?? '').length,
        },
      }
    : {
        nombre: e.nombre,
        claves: e.palabrasClave.join(' · '),
        avance: e.avance,
        ...(e.avanceSinSuperar !== undefined && e.prueba.length > 0 ? { avanceSinSuperar: e.avanceSinSuperar } : {}),
        opciones,
        conPrueba: e.prueba.length > 0,
        exito: parsearFichas(e.textoExito ?? ''),
        fallo: parsearFichas(e.textoFallo ?? ''),
        efecto: parsearFichas(e.textoEfecto ?? ''),
      }
  if (entorno) vista.entorno = entorno
  return vista
}

/** «Vigía −2», «Marinero asignado −2» (fase 13, regla A6). */
export function textoAlternativa(a: NonNullable<Opcion['alternativa']>): string {
  return `${a.rasgo}${a.asignado ? ' asignado' : ''} −${a.rebaja}`
}

/** «−0», «+0» o «0» se dibujan igual: un «0» sin signo (decisión de Albert, 19 de octubre de 2026). */
export function modificadorDestino(mod: string): string {
  return /^[−+-]?0$/.test(mod.trim()) ? '0' : mod
}

function vistaDestino(d: DestinoDatos, v2 = false): VistaDestino {
  const mod = modificadorDestino(d.mod)
  const colorMod = COLOR_MOD[mod]
  if (!colorMod) throw new Error(`Modificador de Destino desconocido: ${d.mod}`)
  return {
    nombre: d.nombre,
    mod,
    colorMod,
    ambientacion: d.ambientacion,
    // Fase 10: en el Destino, «+N» suma al total del jugador (verde) y «−N» le resta (rojo), como en el resto del texto.
    texto: parsearTexto(d.texto, v2 ? UNIR : {}),
    sinOposicion: v2 ? [] : parsearFichas(d.textoSinOposicion),
    ...(v2 ? { sinOposicionTexto: parsearTexto(d.textoSinOposicion, UNIR) } : {}),
  }
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV']

/** Construye la vista de cualquier carta del catálogo. */
export function vistaDeCarta(entrada: EntradaCatalogo): VistaCarta {
  const vista = vistaSinHistoria(entrada)
  const dorso = dorsoDeHistoria(entrada)
  return dorso ? { ...vista, historia: { num: entrada.num, dorso } } : vista
}

function vistaSinHistoria(entrada: EntradaCatalogo): VistaCarta {
  switch (entrada.tipo) {
    case 'estado': {
      const c = entrada.carta
      const ventaja = c.clase === 'Ventaja'
      return {
        forma: 'mini',
        num: entrada.num,
        codigo: codigoColeccion(entrada.num),
        nombre: c.nombre,
        tipoTexto: c.de ? `${c.clase} · ${c.de}` : c.clase,
        color: ventaja ? COLOR_TIPO.ventaja : COLOR_TIPO.estado,
        ventaja,
        texto: parsearTexto(c.texto, UNIR),
        copias: c.copias,
      }
    }
    case 'capitan': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        unica: true,
        color: COLOR_TIPO.capitan,
        tipoTexto: `Capitán · ${claseDe(c)}`,
        pestanasIzq: pestanasHabilidad(c),
        pestanasIzqTop: 74,
        pestanasDer: [{ icono: 'robar', valor: c.mando, color: '#2E5E63' }],
        pestanasDerTop: 106,
        huecos: c.mejoras,
        huecosTop: 170,
        vida: c.vida,
        rasgos: c.rasgos,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'barco': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        color: COLOR_TIPO.barco,
        tipoTexto: 'Barco',
        pestanasIzqTop: 74,
        pestanasDer: [
          { icono: 'dano', valor: c.danoMaximo, color: '#5A4532' },
          { icono: 'capacidad', valor: c.capacidad, color: '#2E5E63' },
          { icono: 'espacio', valor: c.espacio, color: '#6B4A2B' },
        ],
        pestanasDerTop: 96,
        // P125 (Albert): «Distancia −1» no se parte (el «−1» nunca solo en la última línea), como «Daña 2» en los Peligros.
        texto: parsearTexto(c.texto, { unirNumero: true, unirCifras: true }),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'tripulante': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        unica: c.unico,
        color: COLOR_CLASE[claseDe(c)] ?? COLOR_TIPO.tripulanteNeutral,
        tipoTexto: 'Tripulante',
        diseno: 'tripulante',
        clase: claseDe(c),
        coste: c.coste,
        pestanasIzq: pestanasHabilidad(c),
        huecos: c.mejoras,
        vida: c.vida,
        rasgos: c.rasgos,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'mejoraBarco': {
      const c = entrada.carta
      // Fase 15: la culebrina del naufragio no es del jugador: sin Clase ni coste (no se compra).
      const deMision = c.mision !== undefined
      return {
        ...(deMision ? base(entrada) : baseJugador(entrada)),
        nombre: c.nombre,
        unica: c.unico,
        color: deMision ? COLOR_TIPO.mejoraBarco : (COLOR_CLASE[claseDe(c)] ?? COLOR_TIPO.mejoraBarco),
        tipoTexto: 'Mejora de barco',
        diseno: 'mejoraBarco',
        ...(deMision ? {} : { clase: claseDe(c), coste: c.coste }),
        espacio: c.espacio,
        rasgos: c.canon ? ['Cañón'] : [],
        texto: parsearTexto(c.texto),
        textoClase: esCifraSola(c.texto) ? 'big' : '',
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'mejoraTripulante': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        unica: c.unico,
        color: COLOR_CLASE[claseDe(c)] ?? COLOR_TIPO.mejoraTripulante,
        tipoTexto: 'Mejora de tripulante',
        diseno: 'mejoraTripulante',
        clase: claseDe(c),
        coste: c.coste,
        texto: parsearTexto(c.texto),
        textoClase: esCifraSola(c.texto) ? 'big' : '',
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'evento': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        color: COLOR_CLASE[claseDe(c)] ?? COLOR_TIPO.evento,
        tipoTexto: 'Evento',
        diseno: 'evento',
        clase: claseDe(c),
        coste: c.coste,
        pestanasIzq: pestanasIconos(c.iconos),
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'habilidad': {
      const c = entrada.carta
      return {
        ...baseJugador(entrada),
        nombre: c.nombre,
        color: COLOR_CLASE[claseDe(c)] ?? COLOR_TIPO.habilidad,
        tipoTexto: 'Habilidad',
        diseno: 'habilidad',
        clase: claseDe(c),
        alta: true,
        pestanasIzq: pestanasIconos(c.iconos),
        pestanasIzqTop: 74,
        texto: [],
        textoClase: 'center',
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'escenario': {
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        color: COLOR_TIPO.escenario,
        tipoTexto: 'Escenario · El Caribe',
        pestanasIzqTop: 74,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'tesoro': {
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        unica: true,
        color: COLOR_TIPO.tesoro,
        tipoTexto: `Tesoro · ${c.tipo}`,
        // Un Tesoro que es Mejora se enmarca como las Mejoras (cuadro en el barco, óvalo en un Tripulante).
        ...(c.tipo === 'Mejora de barco' ? { diseno: 'mejoraBarco' as const } : c.tipo === 'Mejora de tripulante' ? { diseno: 'mejoraTripulante' as const } : {}),
        pestanasIzqTop: 74,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'peligro': {
      const c = entrada.carta
      return {
        forma: 'peligro',
        num: entrada.num,
        codigo: codigoColeccion(entrada.num),
        encuentros: ORDEN_ENTORNOS.map((ent) => vistaEncuentro(c.encuentros[ent], ent, c.version === 2)),
        destino: vistaDestino(c.destino, c.version === 2),
        entraDuranteLaPartida: c.entraDuranteLaPartida,
        ...(c.version === 2 ? { v2: true } : {}),
      }
    }
    case 'mazoPropio': {
      const c = entrada.carta
      const v2 = c.version === 2
      return {
        forma: 'mazoPropio',
        num: entrada.num,
        codigo: codigoColeccion(entrada.num),
        mazo: entrada.mazo.charAt(0).toUpperCase() + entrada.mazo.slice(1),
        encuentro: vistaEncuentro(c.encuentro, undefined, v2),
        destino: vistaDestino(c.destino, v2),
        ...(v2 ? { v2: true } : {}),
      }
    }
    case 'pasajero': {
      // Fase 15: un Pasajero ya no ocupa Capacidad (fuera la pestaña de Capacidad); su carta dice todo lo necesario.
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        unica: true,
        color: COLOR_TIPO.pasajero,
        tipoTexto: `Pasajero · ${entrada.mision.nombre}`,
        pestanasIzqTop: 74,
        permanente: true,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'naufragio': {
      // Fase 15: carta del mazo del naufragio («El naufragio del San José»). Todas iguales por fuera: lo que pasa con ella lo
      // dice su texto.
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        color: COLOR_TIPO.naufragio,
        tipoTexto: 'Mazo del naufragio',
        permanente: true,
        pestanasIzqTop: 74,
        texto: parsearTexto(c.texto),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'recompensa': {
      // Fase 15 (tercera ronda): carta de recompensa del mazo de historia. La misión dice «Coge la carta 286 del mazo de
      // historia» y esta carta explica lo que se gana; después vuelve al mazo de historia. Misma maqueta que las del naufragio.
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        color: COLOR_TIPO.recompensa,
        tipoTexto: `Recompensa · ${nombreImpresoDeLaMision(entrada.mision)}`,
        permanente: true,
        pestanasIzqTop: 74,
        // Como en las permanentes, el número no se separa de su verbo («gana 1 [rep]»).
        texto: parsearTexto(c.texto, UNIR),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'permanente': {
      // Fase 11: maqueta de las cartas normales del mazo de historia (como los Pasajeros), con «Permanente» en la cinta.
      // Fase 14 (Albert): su tipo (el del encuentro que la pone en juego) se dibuja como el de un encuentro, no como un
      // Rasgo: «GUARDIA» en versalitas, no «Guardia.» en cursiva.
      const c = entrada.carta
      return {
        ...base(entrada),
        nombre: c.nombre,
        color: COLOR_TIPO.permanente,
        tipoTexto: 'Permanente',
        permanente: true,
        pestanasIzqTop: 74,
        rasgos: [],
        ...(c.palabrasClave.length > 0 ? { tipos: c.palabrasClave.join(' · ') } : {}),
        // Fase 15: las permanentes que se pueden dañar (Galeón San Telmo, Murallas, El prisionero) llevan su Vida. Como en
        // las cartas de Peligro, el número no se separa de su verbo ni la puntuación de su icono.
        ...(c.vida !== undefined ? { vida: c.vida } : {}),
        texto: parsearTexto(c.texto, UNIR),
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
    case 'capitulo': {
      const c = entrada.carta
      const m = entrada.mision
      const r = c.recompensa
      // La reputación con su icono, si el recuadro no lleva texto propio («Coge la carta 287 del mazo de historia.»).
      const recompensa: Ficha[] = r.rep !== undefined && !r.texto ? [{ texto: r.rep > 0 ? `+${r.rep}` : `${r.rep}`, icono: 'rep' }] : []
      let recompensaTexto: string | undefined
      if (r.texto) recompensaTexto = undefined
      else if (r.victoria) recompensaTexto = '¡Victoria!'
      // Norma de estilo (Albert): el icono de robar ya dice «roba», sin verbo delante: «{+1 rep} · {2 robar}».
      else if (r.draw) recompensa.push(...(recompensa.length > 0 ? [{ texto: '·' }] : []), { texto: String(r.draw), icono: 'robar' })
      const vista: VistaCapitulo = {
        forma: 'capitulo',
        num: entrada.num,
        codigo: codigoColeccion(entrada.num),
        sello: c.capitulo,
        de: ROMANOS[new Set(m.capitulos.map((x) => x.capitulo)).size] ?? String(m.capitulos.length),
        travesia: m.inicial ? 'Misión inicial' : m.aventura ? 'Aventura' : m.nombre,
        nombre: c.nombre,
        entorno: c.entorno,
        distancia: c.distancia,
        avance: c.avanceNecesario,
        reglas: c.reglas.map((t) => parsearTexto(t)),
        ambientacion: c.ambientacion,
        recompensa,
        pie: m.inicial ? 'Misión inicial · a la vista al empezar' : c.capitulo === 'I' ? 'Mazo de Misiones' : 'Mazo de historia',
      }
      if (recompensaTexto) vista.recompensaTexto = recompensaTexto
      if (r.texto) vista.recompensaMarcada = parsearTexto(r.texto)
      if (c.rama) vista.rama = c.rama
      if (c.textoSiguiente) vista.siguiente = c.textoSiguiente
      const arte = arteDe(entrada.id)
      if (arte) vista.arte = arte
      return vista
    }
    case 'puerto': {
      const c = entrada.carta
      return {
        forma: 'puerto',
        num: entrada.num,
        codigo: codigoColeccion(entrada.num),
        nombre: c.nombre,
        muelle: c.muelle,
        misiones: c.misiones,
        comunes: c.opcionesComunes.map((t) => parsearTexto(t)),
        propia: { nombre: c.habilidadPropia.nombre, texto: parsearTexto(c.habilidadPropia.texto) },
        ambientacion: c.ambientacion,
        ...conArte(entrada.id),
      }
    }
  }
}

/**
 * El nombre de una misión tal y como se lee en sus cartas: el de la travesía o la aventura y, en una misión inicial (cuyo
 * nombre de misión no se imprime: su carta dice «Misión inicial»), el de su capítulo («Cobrar la deuda»).
 */
export function nombreImpresoDeLaMision(m: MisionDatos): string {
  return m.inicial ? (m.capitulos[0]?.nombre ?? m.nombre) : m.nombre
}

function conArte(id: string): { arte?: Arte } {
  const arte = arteDe(id)
  return arte ? { arte } : {}
}

/** Todos los textos con marcado de una carta (para comprobar que se interpretan bien). */
export function textosDeLaCarta(entrada: EntradaCatalogo): string[] {
  switch (entrada.tipo) {
    case 'capitan':
    case 'barco':
    case 'tripulante':
    case 'mejoraBarco':
    case 'mejoraTripulante':
    case 'evento':
    case 'escenario':
    case 'tesoro':
    case 'pasajero':
    case 'permanente':
    case 'naufragio':
    case 'recompensa':
    case 'estado':
      return [entrada.carta.texto]
    case 'habilidad':
      return []
    case 'peligro':
      return [entrada.carta.destino.texto]
    case 'mazoPropio':
      return [entrada.carta.destino.texto]
    case 'capitulo':
      return [...entrada.carta.reglas, ...(entrada.carta.recompensa.texto ? [entrada.carta.recompensa.texto] : [])]
    case 'puerto':
      return [...entrada.carta.opcionesComunes, entrada.carta.habilidadPropia.texto]
  }
}
