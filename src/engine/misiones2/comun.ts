// Ayudas para escribir las reglas de las misiones 2.0 de forma corta y legible.

import { registrarCapacidades } from '../capacidades/index.ts'
import { porId } from '../catalogo.ts'
import type { Habilidad } from '../datos.ts'
import type { CapacidadDeCarta } from '../definiciones.ts'
import { definicionEncuentro } from '../definiciones.ts'
import { anotar, copia } from '../estado.ts'
import type { Capacidad, CartaId, Consulta, Estado, Evento, FichaMision, InstId, NuevaTarea, PruebaHecha } from '../tipos.ts'
import { guardarReglasMision, reglasMision, type ReglasMision } from './registro.ts'

/** Identificador del capítulo en curso (null fuera de una misión). */
export function capituloEnCurso(s: Estado): CartaId | null {
  return s.mision ? copia(s, s.mision.carta).id : null
}

/** Reglas del capítulo en curso. */
export function reglasEnCurso(s: Estado): ReglasMision | undefined {
  const id = capituloEnCurso(s)
  return id ? reglasMision(id) : undefined
}

/**
 * Registra las reglas de un capítulo y sus capacidades (solo funcionan mientras ese capítulo es la misión en curso).
 */
export function registrarMision(id: CartaId, reglas: ReglasMision): void {
  if (porId(id).tipo !== 'capitulo') throw new Error(`${id} no es un capítulo de misión`)
  guardarReglasMision(id, reglas)
  const activa = (s: Estado, yo: InstId | null) => s.mision !== null && yo === s.mision.carta && copia(s, s.mision.carta).id === id
  registrarCapacidades(
    ...(reglas.capacidades ?? []).map((c): Capacidad => {
      const cap: Capacidad = { ...c, clave: `${id}.${c.clave}`, carta: id, desde: 'mision' }
      const { modifica, disparo, requisito } = c
      if (modifica) cap.modifica = (ctx, yo, q) => (activa(ctx.s, yo) ? modifica(ctx, yo, q) : 0)
      if (disparo) cap.disparo = (s, yo, ev, fase) => activa(s, yo) && disparo(s, yo, ev, fase)
      cap.requisito = (s, yo) => activa(s, yo) && (!requisito || requisito(s, yo))
      return cap
    }),
  )
}

// ---------------------------------------------------------------------------
// Fichas sobre la misión

export function fichas(s: Estado, f: FichaMision): number {
  return s.mision?.fichas?.[f] ?? 0
}

/** Tarea: pon (o quita, en negativo) fichas sobre la misión. */
export function ponerFichas(f: FichaMision, n: number): NuevaTarea {
  return { tipo: 'fichasMision', ficha: f, n }
}

// ---------------------------------------------------------------------------
// Las Pruebas de la misión

export function pruebasHechas(s: Estado): PruebaHecha[] {
  return s.mision?.pruebas ?? []
}

/** La Prueba que se acaba de resolver (la última de la misión). */
export function ultimaPrueba(s: Estado): PruebaHecha | undefined {
  const lista = pruebasHechas(s)
  return lista[lista.length - 1]
}

/** ¿Has superado en esta misión alguna Prueba de alguna de estas habilidades? */
export function hasSuperado(s: Estado, ...habs: Habilidad[]): boolean {
  return pruebasHechas(s).some((p) => p.superada && habs.includes(p.hab))
}

/** ¿Has fallado en esta misión alguna Prueba de esta habilidad? */
export function hasFallado(s: Estado, hab: Habilidad): boolean {
  return pruebasHechas(s).some((p) => !p.superada && p.hab === hab)
}

/** ¿Has fallado en esta misión algún encuentro con alguna de estas palabras clave? */
export function hasFalladoEncuentro(s: Estado, ...claves: string[]): boolean {
  return pruebasHechas(s).some((p) => p.encuentro && !p.superada && p.claves.some((k) => claves.includes(k)))
}

// ---------------------------------------------------------------------------
// Momentos en que la misión hace algo (Obligadas: se aplican solas)

/** Después de superar una Prueba (con la Prueba ya apuntada en la misión). */
export function alSuperarPrueba(clave: string, efecto: (s: Estado, p: PruebaHecha) => NuevaTarea[]): CapacidadDeCarta {
  return {
    clave,
    ventana: 'obligada',
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'superarPrueba',
    efecto: (s) => {
      const p = ultimaPrueba(s)
      return p ? efecto(s, p) : []
    },
  }
}

/** Después de fallar una Prueba. */
export function alFallarPrueba(clave: string, efecto: (s: Estado, p: PruebaHecha) => NuevaTarea[]): CapacidadDeCarta {
  return {
    clave,
    ventana: 'obligada',
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba',
    efecto: (s) => {
      const p = ultimaPrueba(s)
      return p ? efecto(s, p) : []
    },
  }
}

/**
 * «Cada Peligro sin Prueba»: el encuentro resuelto no tenía Prueba impresa (en la carta pone «Sin Prueba»).
 * TODO(regla): P49 · un «Elige» en el que pagas en vez de hacer la Prueba no cuenta como Peligro sin Prueba.
 */
export function alResolverSinPrueba(clave: string, efecto: (s: Estado) => NuevaTarea[]): CapacidadDeCarta {
  return {
    clave,
    ventana: 'obligada',
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'cartaResuelta' && sinPruebaImpresa(s, ev.carta),
    efecto: (s) => efecto(s),
  }
}

function sinPruebaImpresa(s: Estado, carta: InstId): boolean {
  const tipo = porId(copia(s, carta).id).tipo
  if (tipo !== 'peligro' && tipo !== 'mazoPropio') return false
  return definicionEncuentro(s, carta).opciones.length === 0
}

/** Cada vez que se revela una carta de Peligro como encuentro. */
export function alRevelarPeligro(clave: string, efecto: (s: Estado) => NuevaTarea[]): CapacidadDeCarta {
  return {
    clave,
    ventana: 'obligada',
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarPeligro',
    efecto: (s) => efecto(s),
  }
}

/** Cada vez que un Tripulante queda con este Estado (que no tenía). */
export function alQuedar(clave: string, estado: Extract<Evento, { tipo: 'estadoPuesto' }>['estado'], efecto: (s: Estado) => NuevaTarea[]): CapacidadDeCarta {
  return {
    clave,
    ventana: 'obligada',
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'estadoPuesto' && ev.estado === estado,
    efecto: (s) => efecto(s),
  }
}

// ---------------------------------------------------------------------------
// Modificadores constantes

/** «Los encuentros #X# reciben ±N de dificultad.» */
export function dificultadClaves(clave: string, claves: string[], n: number): CapacidadDeCarta {
  return {
    clave,
    ventana: 'constante',
    modifica: (_ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' && c.claves.some((k) => claves.includes(k)) ? n : 0),
  }
}

/** «Las Pruebas de [HAB] reciben ±N de dificultad.» */
export function dificultadHabilidad(clave: string, hab: Habilidad, n: number, si?: (s: Estado) => boolean): CapacidadDeCarta {
  return {
    clave,
    ventana: 'constante',
    modifica: (ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' && c.hab === hab && (!si || si(ctx.s)) ? n : 0),
  }
}

/** «Los encuentros #X# dan 1 de Avance más.» */
export function avanceClaves(clave: string, claves: string[], n: number): CapacidadDeCarta {
  return {
    clave,
    ventana: 'constante',
    modifica: (_ctx, _yo, c: Consulta) => (c.tipo === 'avanceExtraEncuentro' && c.claves.some((k) => claves.includes(k)) ? n : 0),
  }
}

/** «Cada Prueba de [HAB] que superes (por M o más) da N de Avance más.» */
export function avancePrueba(clave: string, hab: Habilidad, n: number, porAlMenos = 0): CapacidadDeCarta {
  return {
    clave,
    ventana: 'constante',
    modifica: (_ctx, _yo, c: Consulta) => (c.tipo === 'avanceExtraEncuentro' && c.hab === hab && c.margen >= porAlMenos ? n : 0),
  }
}

// ---------------------------------------------------------------------------
// Cómo termina la misión por sus reglas

/** «La misión falla»: como retirarte (no la superas, pierdes su Avance y eliges dejarla o ponerla al fondo). */
export function fallaLaMision(s: Estado, motivo: string): void {
  const m = s.mision
  if (!m || m.fin) return
  m.fin = 'retirada'
  m.motivoFallo = motivo
  anotar(s, 'aviso', `La misión falla: ${motivo}.`)
}

/** «Superas la misión ahora, aunque no tengas todo el Avance.» */
export function superarAhora(s: Estado, motivo: string): void {
  const m = s.mision
  if (!m || m.fin) return
  m.fin = 'superada'
  anotar(s, 'efecto', `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}: superas la misión.`)
}

/** Tarea: un Pasajero entra en juego. */
export function ponerPasajero(carta: CartaId): NuevaTarea {
  return { tipo: 'ponerPasajero', carta }
}

/** Tarea: un Pasajero se va. */
export function bajarPasajero(carta: CartaId, motivo: string): NuevaTarea {
  return { tipo: 'bajarPasajero', carta, motivo }
}

/** ¿Viaja contigo este Pasajero? */
export function viajaContigo(s: Estado, carta: CartaId): boolean {
  return s.zonas.pasajeros.some((c) => copia(s, c).id === carta)
}

/** Las fichas de la misión en curso, para enseñarlas sobre ella («Alarma 2 de 3»). */
export function fichasVisibles(s: Estado): { ficha: FichaMision; nombre: string; n: number; umbral: number; nota: string }[] {
  const r = reglasEnCurso(s)
  return (r?.fichas ?? []).map((f) => ({ ficha: f.ficha, nombre: f.nombre, umbral: f.umbral, nota: f.nota, n: s.mision?.fichas?.[f.ficha] ?? 0 }))
}

/** Por qué no se puede superar aún la misión en curso según sus reglas (o null). */
export function motivoSinSuperar(s: Estado): string | null {
  return reglasEnCurso(s)?.impideSuperar?.(s) ?? null
}
