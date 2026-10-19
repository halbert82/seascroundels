// Piezas comunes de la maqueta: cartas en pequeño, dorsos, ornamentos náuticos e iconos.

import type { CSSProperties, ReactNode } from 'react'
import { porId } from '../engine/catalogo.ts'
import { CartaEscalada, dimensiones } from '../ui/cartas/Carta.tsx'

/** Píxeles CSS por milímetro (96 ppp). */
export const MM = 96 / 25.4

/** Una carta dibujada por la app, de `ancho` milímetros (de su lado corto si es apaisada, salvo `anchoReal`). */
export function Miniatura({ id, ancho, anchoReal = false, girada = 0, className = '', style }: { id: string; ancho: number; anchoReal?: boolean; girada?: number; className?: string; style?: CSSProperties }) {
  const entrada = porId(id)
  const d = dimensiones(entrada)
  const lado = anchoReal ? d.ancho : Math.min(d.ancho, d.alto)
  const escala = (ancho * MM) / lado
  return (
    <div className={`miniatura ${d.ancho > d.alto ? 'apaisada' : ''} ${className}`} style={{ ...(girada ? { transform: `rotate(${girada}deg)` } : {}), ...style }} data-carta={id}>
      <CartaEscalada entrada={entrada} escala={escala} />
    </div>
  )
}

export type TipoDorso = 'peligros' | 'capitan' | 'muelle' | 'escenario' | 'misiones' | 'historia'

const DORSOS: Record<TipoDorso, { nombre: string; color: string; icono: string }> = {
  peligros: { nombre: 'Peligros', color: '#6E1F17', icono: 'rep' },
  capitan: { nombre: 'Capitán', color: '#1E3550', icono: 'man' },
  muelle: { nombre: 'Muelle', color: '#24452F', icono: 'espacio' },
  escenario: { nombre: 'Escenario', color: '#7A5418', icono: 'acampar' },
  misiones: { nombre: 'Misiones', color: '#3a2a1e', icono: 'avance' },
  historia: { nombre: 'Historia', color: '#4a3a5a', icono: 'doblon' },
}

/** Dorso de un mazo, de `ancho` milímetros, con `grosor` cartas debajo (un mazo, no una carta). */
export function Dorso({ tipo, ancho, grosor = 3, apaisado = false }: { tipo: TipoDorso; ancho: number; grosor?: number; apaisado?: boolean }) {
  const d = DORSOS[tipo]
  const w = apaisado ? ancho * (528 / 378) : ancho
  const h = apaisado ? ancho : ancho * (528 / 378)
  return (
    <div className="dorso-libro" style={{ width: `${w}mm`, height: `${h}mm`, '--dorso': d.color, '--grosor': grosor } as CSSProperties}>
      <div className="dorso-libro-marco">
        <span className={`ic i-${d.icono} dorso-libro-icono`} />
        <span className="dorso-libro-nombre">{d.nombre}</span>
      </div>
    </div>
  )
}

/** Icono del juego (máscara SVG) en línea con el texto. */
export function Icono({ id, className = '', style }: { id: string; className?: string; style?: CSSProperties }) {
  return <i className={`ic i-${id} ${className}`} style={style} />
}

/** Rosa de los vientos pequeña (ornamento de los títulos y de las cabeceras). */
export function Rosa({ tam = 14, className = '' }: { tam?: number; className?: string }) {
  return (
    <svg className={`rosa ${className}`} width={tam} height={tam} viewBox="-10 -10 20 20" aria-hidden="true">
      <path d="M0-10L2-2 10 0 2 2 0 10-2 2-10 0-2-2Z" fill="currentColor" />
      <path d="M0-6L1.2-1.2 6 0 1.2 1.2 0 6-1.2 1.2-6 0-1.2-1.2Z" transform="rotate(45)" fill="currentColor" opacity=".55" />
      <circle r="1.3" fill="var(--papel, #faf5e9)" />
    </svg>
  )
}

/** Filete con una rosa de los vientos en medio. */
export function Filete({ className = '' }: { className?: string }) {
  return (
    <div className={`filete ${className}`} aria-hidden="true">
      <span className="filete-linea" />
      <Rosa tam={13} />
      <span className="filete-linea" />
    </div>
  )
}

/** Marcador numerado (o con letra) de los gráficos: el círculo rojo de las láminas. */
export function Marcador({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <span className={`marcador ${className}`} style={style}>
      {children}
    </span>
  )
}
