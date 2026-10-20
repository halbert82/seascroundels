// Qué se puede hacer con cada carta de la mesa según la decisión pendiente: qué se resalta, qué está elegido
// y qué pasa al pulsarla. Lógica pura (sin React), para poder probarla.

import { iconosDe, porId } from '../../engine/catalogo.ts'
import { copia } from '../../engine/estado.ts'
import type { Accion, Decision, Eleccion, Estado, InstId, Uso, Zona } from '../../engine/tipos.ts'
import { valor } from '../../engine/valores.ts'
import { textoUso } from '../textos/decisiones.ts'
import type { Marca } from './CartaMesa.tsx'

/** Lo que se pulsa: una copia de carta o el Barco (que no es una copia). */
export type Objetivo = InstId | 'barco'

export interface Seleccion {
  /** Decisión a la que pertenece (al cambiar, se empieza de cero). */
  de: string
  cartas: InstId[]
  opcion: number
  reparto: Partial<Record<InstId, number>>
  /** Mejora elegida en Jugar cartas, esperando a que se pulse su portador. */
  mejora: InstId | null
}

export function claveDecision(d: Decision): string {
  return `${d.tarea}:${d.motivo.clave}:${d.tipo}`
}

export function seleccionVacia(d: Decision): Seleccion {
  return { de: claveDecision(d), cartas: [], opcion: 0, reparto: {}, mejora: null }
}

export interface OpcionCarta {
  etiqueta: string
  detalle?: string
  /** Responde al motor. */
  eleccion?: Eleccion
  /** Cambia solo la selección de la mesa. */
  seleccion?: Seleccion
}

export interface Interaccion {
  marcas: Map<Objetivo, Marca>
  opciones: Map<Objetivo, OpcionCarta[]>
  numeros: Map<InstId, number>
  /** Candidatas que no están a la vista en la mesa (en un mazo, apartadas): se enseñan en el panel. */
  apartadas: InstId[]
}

/** Zonas que la mesa dibuja (lo demás se enseña en el panel si hay que elegirlo). */
const ZONAS_A_LA_VISTA: ReadonlySet<Zona> = new Set<Zona>([
  'tripulacion',
  'mejoras',
  'rehenes',
  'muelle',
  'misionesDisponibles',
  'mano',
  'encuentro',
  'destino',
  'escenarioEnCurso',
  'permanentes',
  'incautadas',
])

function zonaDe(s: Estado, inst: InstId): Zona | null {
  for (const [z, lista] of Object.entries(s.zonas) as [Zona, InstId[]][]) if (lista.includes(inst)) return z
  return null
}

function aLaVista(s: Estado, inst: InstId): boolean {
  const z = zonaDe(s, inst)
  // Durante una misión, la mesa no enseña el muelle ni las misiones disponibles (la misión ocupa su sitio);
  // en puerto, no hay cartas en juego junto a la misión ni incautadas.
  if (s.mision && (z === 'muelle' || (z === 'misionesDisponibles' && inst !== s.mision.carta))) return false
  // Las Mejoras de un Tripulante incautado no se ven (van con él debajo de la misión).
  if (z === 'mejoras') {
    const v = s.cartas[inst]?.vinculadaA
    if (v && v !== 'barco' && !s.zonas.tripulacion.includes(v) && !s.zonas.rehenes.includes(v)) return false
  }
  return z !== null && ZONAS_A_LA_VISTA.has(z)
}

function anadir(m: Map<Objetivo, OpcionCarta[]>, objetivo: Objetivo, o: OpcionCarta): void {
  m.set(objetivo, [...(m.get(objetivo) ?? []), o])
}

function alternar(sel: Seleccion, inst: InstId): Seleccion {
  return { ...sel, cartas: sel.cartas.includes(inst) ? sel.cartas.filter((c) => c !== inst) : [...sel.cartas, inst] }
}

function objetivoDeUso(uso: Uso): Objetivo {
  return uso.fuente ?? 'barco'
}

function opcionUso(s: Estado, uso: Uso, accion: boolean): OpcionCarta {
  const t = textoUso(s, uso)
  return { etiqueta: t.carta, detalle: t.texto, eleccion: accion ? { tipo: 'accion', accion: { tipo: 'usar', uso } } : { tipo: 'usar', uso } }
}

/** Habilidad de la opción de Prueba elegida en la selección (para comprometer). */
export function habilidadElegida(d: Decision, sel: Seleccion): 'NAV' | 'COM' | 'EXP' | null {
  if (d.tipo !== 'comprometer') return null
  return d.opciones[sel.opcion]?.hab ?? d.opciones[0]?.hab ?? null
}

export function interaccion(s: Estado, d: Decision, sel: Seleccion): Interaccion {
  const marcas = new Map<Objetivo, Marca>()
  const opciones = new Map<Objetivo, OpcionCarta[]>()
  const numeros = new Map<InstId, number>()
  const apartadas: InstId[] = []
  const legal = (o: Objetivo) => {
    if (!marcas.has(o)) marcas.set(o, 'legal')
  }
  const elegir = (inst: InstId) => {
    marcas.set(inst, sel.cartas.includes(inst) ? 'elegida' : 'legal')
    if (!aLaVista(s, inst) && !apartadas.includes(inst)) apartadas.push(inst)
  }

  switch (d.tipo) {
    case 'ventanaAccion': {
      // Mejora elegida a la espera de portador: solo se resaltan los portadores posibles.
      if (sel.mejora) {
        const mejora = sel.mejora
        marcas.set(mejora, 'elegida')
        for (const a of d.acciones) {
          if (a.tipo !== 'adquirir' || a.carta !== mejora) continue
          legal(a.destino)
          anadir(opciones, a.destino, { etiqueta: a.destino === 'barco' ? 'Para el Barco' : `Para ${nombreDe(s, a.destino)}`, eleccion: { tipo: 'accion', accion: a } })
        }
        anadir(opciones, mejora, { etiqueta: 'No adquirirla', seleccion: { ...sel, mejora: null } })
        break
      }
      const destinos = new Map<InstId, Accion[]>()
      for (const a of d.acciones) {
        switch (a.tipo) {
          case 'reclutar':
            legal(a.carta)
            anadir(opciones, a.carta, { etiqueta: `Reclutar (cuesta ${valor(s, { tipo: 'coste', carta: a.carta })})`, eleccion: { tipo: 'accion', accion: a } })
            break
          case 'adquirir':
            destinos.set(a.carta, [...(destinos.get(a.carta) ?? []), a])
            break
          case 'despedir':
            anadir(opciones, a.carta, { etiqueta: 'Despedir', detalle: 'Va a los descartes del muelle con sus Mejoras.', eleccion: { tipo: 'accion', accion: a } })
            break
          case 'usar':
            legal(objetivoDeUso(a.uso))
            anadir(opciones, objetivoDeUso(a.uso), opcionUso(s, a.uso, true))
            break
          case 'retirarse':
          case 'terminarPaso':
            break
        }
      }
      for (const [mejora, acciones] of destinos) {
        legal(mejora)
        const coste = valor(s, { tipo: 'coste', carta: mejora })
        const unica = acciones.length === 1 ? acciones[0] : undefined
        if (unica?.tipo === 'adquirir') {
          anadir(opciones, mejora, { etiqueta: `Adquirir ${unica.destino === 'barco' ? 'para el Barco' : `para ${nombreDe(s, unica.destino)}`} (cuesta ${coste})`, eleccion: { tipo: 'accion', accion: unica } })
        } else {
          anadir(opciones, mejora, { etiqueta: `Adquirir (cuesta ${coste})`, detalle: 'Después pulsa quién la lleva.', seleccion: { ...sel, mejora } })
        }
      }
      break
    }
    case 'elegirCartas': {
      const unaSola = d.min === 1 && d.max === 1
      for (const c of d.candidatas) {
        elegir(c)
        if (unaSola) anadir(opciones, c, { etiqueta: 'Elegir', eleccion: { tipo: 'cartas', ids: [c] } })
        else if (sel.cartas.includes(c)) anadir(opciones, c, { etiqueta: 'Quitar', seleccion: alternar(sel, c) })
        else if (sel.cartas.length < d.max) anadir(opciones, c, { etiqueta: 'Elegir', seleccion: alternar(sel, c) })
      }
      if (d.motivo.clave === 'ordenarOteo') sel.cartas.forEach((c, i) => numeros.set(c, i + 1))
      break
    }
    case 'elegirOpcion': {
      if (d.motivo.clave === 'quedarseOZarpar') {
        for (const o of d.opciones) {
          if (!o.clave.startsWith('zarpar:')) continue
          const m = o.clave.slice('zarpar:'.length) as InstId
          legal(m)
          anadir(opciones, m, { etiqueta: 'Zarpar a esta misión', eleccion: { tipo: 'opcion', clave: o.clave } })
        }
      }
      break
    }
    case 'ofrecer':
      for (const u of d.usos) {
        legal(objetivoDeUso(u))
        anadir(opciones, objetivoDeUso(u), opcionUso(s, u, false))
      }
      break
    case 'repartir':
      for (const inst of Object.keys(d.maximos) as InstId[]) {
        const puesto = sel.reparto[inst] ?? 0
        marcas.set(inst, puesto > 0 ? 'elegida' : 'legal')
        numeros.set(inst, puesto)
      }
      break
    case 'cubrirDistancia':
      for (const c of [...d.tripulantes, ...d.cartas]) {
        elegir(c)
        anadir(opciones, c, { etiqueta: sel.cartas.includes(c) ? 'Quitar' : 'Usar para la Distancia', seleccion: alternar(sel, c) })
      }
      break
    case 'comprometer': {
      const hab = habilidadElegida(d, sel)
      for (const c of d.tripulantes) {
        elegir(c)
        anadir(opciones, c, { etiqueta: sel.cartas.includes(c) ? 'No asignarlo' : 'Asignar', seleccion: alternar(sel, c) })
      }
      for (const c of d.cartas) {
        if (!hab || iconosDe(copia(s, c).id, hab) === 0) continue
        elegir(c)
        anadir(opciones, c, { etiqueta: sel.cartas.includes(c) ? 'Quitarla' : `Añadir (+${iconosDe(copia(s, c).id, hab)})`, seleccion: alternar(sel, c) })
      }
      break
    }
  }

  // Capacidades sin etiqueta que se pueden usar en esta pausa.
  for (const u of d.libres ?? []) {
    legal(objetivoDeUso(u))
    anadir(opciones, objetivoDeUso(u), opcionUso(s, u, false))
  }
  return { marcas, opciones, numeros, apartadas }
}

function nombreDe(s: Estado, inst: InstId): string {
  const e = porId(copia(s, inst).id)
  return 'nombre' in e.carta ? e.carta.nombre : e.id
}

/** Elección de la decisión con la selección actual (para el botón «Confirmar»), o null si aún no vale. */
export function eleccionConfirmada(s: Estado, d: Decision, sel: Seleccion): Eleccion | null {
  switch (d.tipo) {
    case 'elegirCartas':
      return sel.cartas.length >= d.min && sel.cartas.length <= d.max ? { tipo: 'cartas', ids: sel.cartas } : null
    case 'repartir': {
      const total = Object.values(sel.reparto).reduce<number>((acc, b) => acc + (b ?? 0), 0)
      return total === d.cantidad ? { tipo: 'reparto', n: sel.reparto } : null
    }
    case 'cubrirDistancia':
      return { tipo: 'cartas', ids: sel.cartas }
    case 'comprometer': {
      const tripulantes = sel.cartas.filter((c) => d.tripulantes.includes(c))
      const hab = habilidadElegida(d, sel)
      const cartas = sel.cartas.filter((c) => d.cartas.includes(c) && hab !== null && iconosDe(copia(s, c).id, hab) > 0)
      return { tipo: 'compromiso', opcion: sel.opcion, tripulantes, cartas: tripulantes.length > 0 ? cartas : [] }
    }
    default:
      return null
  }
}
