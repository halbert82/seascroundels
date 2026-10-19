// Utilidades sobre el estado: copias de carta, registro de partida y pila de tareas.

import { nombreDe } from './catalogo.ts'
import { ZONAS, type CartaId, type Copia, type Estado, type InstId, type NuevaTarea, type Suceso, type Tarea, type TipoRegistro, type Zona } from './tipos.ts'

export function estadoVacio(azar: [number, number, number, number]): Estado {
  const zonas = {} as Record<Zona, InstId[]>
  for (const z of ZONAS) zonas[z] = []
  return {
    version: 1,
    azar,
    sigInst: 1,
    sigTarea: 1,
    cartas: {},
    zonas,
    capitan: 'i0',
    puerto: 'tortuga',
    modo: 'normal',
    reputacionObjetivo: 18,
    reputacion: 0,
    danoBarco: 0,
    turno: 0,
    paso: 'preparacion',
    ultimoTurno: false,
    mision: null,
    prueba: null,
    temporales: [],
    usos: {},
    pila: [],
    pendiente: null,
    infoRevelada: 0,
    registro: [],
    resultado: null,
  }
}

/** Días que quedan en el reloj: las cartas del mazo de Escenario o, sin Escenario, el contador. */
export function diasRestantes(s: Estado): number {
  return s.sinEscenario ? s.sinEscenario.dias : s.zonas.mazoEscenario.length
}

/** La copia física de una carta. */
export function copia(s: Estado, inst: InstId): Copia {
  const c = s.cartas[inst]
  if (!c) throw new Error(`No existe la copia ${inst}`)
  return c
}

export function idDe(s: Estado, inst: InstId): CartaId {
  return copia(s, inst).id
}

export function nombre(s: Estado, inst: InstId): string {
  return nombreDe(idDe(s, inst))
}

export function nombres(s: Estado, insts: readonly InstId[]): string {
  return insts.map((i) => nombre(s, i)).join(', ')
}

export function anotar(s: Estado, tipo: TipoRegistro, texto: string, dato?: Suceso): void {
  s.registro.push(dato ? { turno: s.turno, paso: s.paso, tipo, texto, dato } : { turno: s.turno, paso: s.paso, tipo, texto })
}

/** Añade tareas a la pila. Se resuelven en el orden en que se pasan (la primera, antes). */
export function encolar(s: Estado, ...tareas: NuevaTarea[]): void {
  for (let i = tareas.length - 1; i >= 0; i--) {
    const t = tareas[i] as NuevaTarea
    s.pila.push({ ...t, id: s.sigTarea++ } as Tarea)
  }
}

export function quitarTarea(s: Estado, id: number): void {
  s.pila = s.pila.filter((t) => t.id !== id)
}

export function buscarTarea(s: Estado, id: number): Tarea {
  const t = s.pila.find((x) => x.id === id)
  if (!t) throw new Error(`No existe la tarea ${id}`)
  return t
}

export function pilaTiene(s: Estado, prueba: (t: Tarea) => boolean): boolean {
  return s.pila.some(prueba)
}

/** Suceso «se ha descartado esta carta» (para los efectos «después de que descartes esta carta»). */
export function sucesoDescartada(carta: InstId): NuevaTarea {
  return { tipo: 'evento', ev: { tipo: 'descartada', carta }, fase: 'despues', cancelado: false, usadas: [] }
}

/** Clave de un uso con límite: se reinicia por turno o por misión. */
export function claveUso(periodo: 'turno' | 'mision', fuente: InstId | null, clave: string): string {
  return `${periodo}:${fuente ?? '-'}/${clave}`
}
