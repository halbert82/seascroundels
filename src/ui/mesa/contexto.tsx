// Contexto de la mesa: el estado, lo que se puede hacer con cada carta y cómo se pulsa.

import { createContext, useContext } from 'react'
import { porId } from '../../engine/catalogo.ts'
import { copia } from '../../engine/estado.ts'
import type { Estado, InstId } from '../../engine/tipos.ts'
import { valor } from '../../engine/valores.ts'
import { esTarot, MEDIDAS } from '../cartas/Carta.tsx'
import { CartaMesa, type FichasCarta } from './CartaMesa.tsx'
import type { TipoDorso } from './Dorso.tsx'
import type { Interaccion, Objetivo } from './interaccion.ts'
import { entornoActual } from '../../engine/peligros.ts'

export interface ContextoMesa {
  s: Estado
  inter: Interaccion
  /** Pulsar una carta; `opcion`: una de sus opciones, elegida en la ampliación (con el dedo). */
  pulsar: (o: Objetivo, elemento: HTMLElement, opcion?: number) => void
}

export const Contexto = createContext<ContextoMesa | null>(null)

export function useMesa(): ContextoMesa {
  const c = useContext(Contexto)
  if (!c) throw new Error('useMesa fuera de la mesa')
  return c
}

/** Fichas de una copia según su tipo: heridas en Tripulantes, Avance en misiones, fichas en las cartas que las llevan. */
export function fichasDe(s: Estado, inst: InstId): FichasCarta {
  const c = copia(s, inst)
  const tipo = porId(c.id).tipo
  if (tipo === 'capitan' || tipo === 'tripulante') {
    const f: FichasCarta = { heridas: c.heridas, vida: valor(s, { tipo: 'vida', carta: inst }) }
    if (c.entrenamiento.length > 0) f.entrenamiento = c.entrenamiento
    return f
  }
  if (tipo === 'capitulo') return { avance: c.avance }
  if ((s.zonas.peligrosEnJuego.includes(inst) || tipo === 'tesoro') && c.fichas !== undefined) return { contador: c.fichas }
  return {}
}

/** Una carta de la mesa enlazada al estado: fichas, agotada, marca y qué pasa al pulsarla. */
/** `igualAlto`: una carta tarot (Peligro) se escala para ocupar el mismo alto que una normal a esa escala (fase 10c). */
export function CartaDe({ inst, escala: escalaPedida, revelar, girar = true, encogeAgotada, igualAlto = false }: { inst: InstId; escala: number; revelar?: TipoDorso; girar?: boolean; encogeAgotada?: number; igualAlto?: boolean }) {
  const { s, inter, pulsar } = useMesa()
  const c = copia(s, inst)
  const escala = igualAlto && esTarot(porId(c.id)) && porId(c.id).tipo !== 'puerto' ? (escalaPedida * MEDIDAS.normal.alto) / MEDIDAS.tarot.alto : escalaPedida
  const opciones = inter.opciones.get(inst) ?? []
  const numero = inter.numeros.get(inst)
  const esPeligro = porId(c.id).tipo === 'peligro' && (s.zonas.encuentro.includes(inst) || s.zonas.peligrosEnJuego.includes(inst))
  const participa = Boolean(s.prueba && (s.prueba.comprometidos.includes(inst) || s.prueba.agotadas.includes(inst)) && s.zonas.tripulacion.includes(inst))
  return (
    <CartaMesa
      inst={inst}
      id={c.id}
      escala={escala}
      agotada={girar && c.agotada}
      {...(encogeAgotada !== undefined && encogeAgotada < 1 ? { encogeAgotada } : {})}
      participa={participa}
      marca={inter.marcas.get(inst) ?? null}
      {...(numero !== undefined && numero > 0 ? { numero } : {})}
      fichas={fichasDe(s, inst)}
      {...(revelar ? { revelar } : {})}
      entorno={esPeligro ? entornoActual(s) : null}
      {...(opciones.length > 0 ? { onClick: (el: HTMLElement, i?: number) => pulsar(inst, el, i), ayuda: opciones.map((o) => o.etiqueta).join(' · '), acciones: opciones.map((o) => o.etiqueta) } : {})}
    />
  )
}
