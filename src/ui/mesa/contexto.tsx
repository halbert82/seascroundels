// Contexto de la mesa: el estado, lo que se puede hacer con cada carta y cómo se pulsa.

import { createContext, useContext } from 'react'
import { porId } from '../../engine/catalogo.ts'
import { copia } from '../../engine/estado.ts'
import type { Estado, InstId } from '../../engine/tipos.ts'
import { valor } from '../../engine/valores.ts'
import { CartaMesa, type FichasCarta } from './CartaMesa.tsx'
import type { TipoDorso } from './Dorso.tsx'
import type { Interaccion, Objetivo } from './interaccion.ts'
import { entornoActual } from '../../engine/peligros.ts'

export interface ContextoMesa {
  s: Estado
  inter: Interaccion
  pulsar: (o: Objetivo, elemento: HTMLElement) => void
}

export const Contexto = createContext<ContextoMesa | null>(null)

export function useMesa(): ContextoMesa {
  const c = useContext(Contexto)
  if (!c) throw new Error('useMesa fuera de la mesa')
  return c
}

/** Fichas de una copia según su tipo: heridas en Tripulantes, munición en Cañones, Avance en misiones. */
export function fichasDe(s: Estado, inst: InstId): FichasCarta {
  const c = copia(s, inst)
  const tipo = porId(c.id).tipo
  if (tipo === 'capitan' || tipo === 'tripulante') {
    const f: FichasCarta = { heridas: c.heridas, vida: valor(s, { tipo: 'vida', carta: inst }) }
    if (c.entrenamiento.length > 0) f.entrenamiento = c.entrenamiento
    return f
  }
  if (tipo === 'mejoraBarco' && valor(s, { tipo: 'municionMaxima', carta: inst }) > 0) return { municion: c.municion }
  if (tipo === 'capitulo') return { avance: c.avance }
  if (s.zonas.peligrosEnJuego.includes(inst) && c.fichas !== undefined) return { contador: c.fichas }
  return {}
}

/** Una carta de la mesa enlazada al estado: fichas, agotada, marca y qué pasa al pulsarla. */
export function CartaDe({ inst, escala, revelar, girar = true }: { inst: InstId; escala: number; revelar?: TipoDorso; girar?: boolean }) {
  const { s, inter, pulsar } = useMesa()
  const c = copia(s, inst)
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
      participa={participa}
      marca={inter.marcas.get(inst) ?? null}
      {...(numero !== undefined && numero > 0 ? { numero } : {})}
      fichas={fichasDe(s, inst)}
      {...(revelar ? { revelar } : {})}
      entorno={esPeligro ? entornoActual(s) : null}
      {...(opciones.length > 0 ? { onClick: (el: HTMLElement) => pulsar(inst, el), ayuda: opciones.map((o) => o.etiqueta).join(' · ') } : {})}
    />
  )
}
