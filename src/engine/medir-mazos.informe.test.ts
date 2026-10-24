// Mazos de inicio de antes frente a «Pólvora y abordaje» (sin informe): `MEDIR_MAZOS=1 npx vitest run src/engine/medir-mazos.informe.test.ts`.
// Juega las partidas de las semillas 1–N (INFORME_PARTIDAS, 1000 por defecto) con cada pareja de mazos, el mismo jugador
// automático y las mismas reglas, y escribe el resumen en JSON en MEDIR_SALIDA (o en la consola). MEDIR_MAZOS_SOLO=antes
// o =nuevos juega solo una de las dos; MEDIR_MAZOS_VARIADOS=1, las de muelle variado con cada mazo del capitán.
// MEDIR_MAZOS_VARIANTE=A, B, C o D juega una sola variante del mazo del capitán «Pólvora y abordaje» (VARIANTES), con el
// muelle de inicio o, con MEDIR_MAZOS_VARIADOS=1, con muelles variados (semillas 100000…).

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { jugarPartida, MAZOS_ANTERIORES, mazoDeMuelleAlAzar, type Partida } from './pruebas/equilibrio.ts'
import { jugadorConCriterio, type JugadorAutomatico } from './pruebas/jugadores.ts'
import { prevision } from './prueba.ts'
import type { CartaId, Estado } from './tipos.ts'

const PARTIDAS = Number(process.env.INFORME_PARTIDAS ?? 1000)

/** Lo que el jugador hace con Diego y con «Virar y dar la cara» (para ver si juega el mazo con cabeza). */
interface Vigilancia {
  pruebas: number
  conDiego: number
  diegoSolo: number
  /** Diego asignado con otros cuando los otros, con su +1 (Diego preparado) y las mismas cartas, ya llegaban. */
  diegoSobraba: number
  /** Diego asignado con otros y no llegaban sin él. */
  diegoHaciaFalta: number
  /** Pruebas de NAV en el Mar con un Cañón preparado y «Virar» en la mano: cuántas se viran. */
  virarPosible: number
  virar: number
}

function vigilar(jugador: JugadorAutomatico, v: Vigilancia): JugadorAutomatico {
  return (s: Estado, d) => {
    const e = jugador(s, d)
    if (d.tipo === 'comprometer' && e.tipo === 'compromiso' && s.prueba) {
      v.pruebas++
      const grupo = e.tripulantes
      if (grupo.includes(s.capitan)) {
        v.conDiego++
        const otros = grupo.filter((c) => c !== s.capitan)
        if (otros.length === 0) v.diegoSolo++
        else {
          const con = prevision(s, s.prueba.encuentro, e.opcion, grupo, e.cartas)
          const sin = prevision(s, s.prueba.encuentro, e.opcion, otros, e.cartas)
          if (sin.total >= Math.max(con.dificultad + 1, Math.min(con.total, con.dificultad + 2))) v.diegoSobraba++
          else v.diegoHaciaFalta++
        }
      }
    }
    if (d.tipo === 'ofrecer') {
      const virar = d.usos.find((u) => u.clave === 'virar.jugar')
      if (virar) {
        v.virarPosible++
        if (e.tipo === 'usar' && e.uso.clave === 'virar.jugar') v.virar++
      }
    }
    return e
  }
}

function resumen(partidas: Partida[], v: Vigilancia, rebarajes: number[]) {
  const n = partidas.length
  const ganadas = partidas.filter((p) => p.gana)
  const pct = (x: number, total = n) => Math.round((1000 * x) / total) / 10
  const media = (xs: number[]) => Math.round((100 * xs.reduce((a, b) => a + b, 0)) / Math.max(1, xs.length)) / 100
  const porEntorno = (resultado: 'superada' | 'zarpe') => {
    const cuenta: Record<string, number> = { mar: 0, nat: 0, ciu: 0 }
    for (const p of partidas) {
      const lista = resultado === 'zarpe' ? p.zarpes : p.resultados.filter((r) => r.resultado === 'superada').map((r) => r.mision)
      for (const m of lista) {
        const e = porId(m)
        const entorno = e.tipo === 'capitulo' ? e.carta.entorno : '?'
        cuenta[entorno] = (cuenta[entorno] ?? 0) + 1
      }
    }
    return cuenta
  }
  const superadas = porEntorno('superada')
  const zarpes = porEntorno('zarpe')
  const usos = (id: string) => partidas.reduce((a, p) => a + (p.cartas[id]?.jugada ?? 0) + (p.cartas[id]?.capacidad ?? 0), 0)
  return {
    partidas: n,
    victorias: pct(ganadas.length),
    porPanama: ganadas.filter((p) => p.motivo.includes('Panamá')).length,
    derrotaTiempo: pct(partidas.filter((p) => !p.gana && p.motivo.includes('tiempo')).length),
    derrotaCapitan: pct(partidas.filter((p) => !p.gana && !p.motivo.includes('tiempo')).length),
    reputacionMedia: media(partidas.map((p) => p.reputacion)),
    turnosMedios: media(partidas.map((p) => p.turnoFinal)),
    superadasPorPartida: Object.fromEntries(Object.entries(superadas).map(([k, x]) => [k, Math.round((100 * x) / n) / 100])),
    zarpesPorPartida: Object.fromEntries(Object.entries(zarpes).map(([k, x]) => [k, Math.round((100 * x) / n) / 100])),
    exitoPorZarpe: Object.fromEntries(Object.entries(zarpes).map(([k, x]) => [k, pct(superadas[k] ?? 0, x)])),
    diasPerdidosPorRebarajar: media(rebarajes),
    partidasConRebarajes: pct(rebarajes.filter((x) => x > 0).length),
    heridasPorMision: media(partidas.map((p) => p.heridasEnMision / Math.max(1, p.zarpes.length))),
    muertesPorPartida: media(partidas.map((p) => p.muertes)),
    hundimientosPorPartida: media(partidas.map((p) => p.hundimientos)),
    retiradasPorPartida: media(partidas.map((p) => p.resultados.filter((r) => r.resultado === 'retirada').length)),
    jugador: {
      ...v,
      porcentajeConDiego: pct(v.conDiego, v.pruebas),
      virarUsado: pct(v.virar, v.virarPosible),
    },
    entran: Object.fromEntries(
      ['bandera', 'bronce', 'carronadas', 'hamacas', 'sable', 'isabela', 'reinaldo', 'viejo_lobo', 'bucanero', 'filibustero', 'tuerto', 'carne_canon', 'canonero', 'carpintero', 'vigia', 'bartolome', 'loro'].map((id) => [
        id,
        Math.round((100 * partidas.reduce((a, p) => a + (p.cartas[id]?.adquirida ?? 0) + (p.cartas[id]?.reclutada ?? 0), 0)) / n) / 100,
      ]),
    ),
    usos: Object.fromEntries(
      ['virar', 'polvora_c', 'canonero', 'bronce', 'carronadas', 'todos', 'carne_canon', 'filibustero', 'arriba', 'ron_valientes', 'loro', 'bartolome', 'vigia', 'isabela', 'viejo_lobo'].map((id) => [
        id,
        Math.round((100 * usos(id)) / n) / 100,
      ]),
    ),
  }
}

/**
 * MEDIR_MAZOS_VARIADOS=1: las partidas del informe con mazos de muelle variados (semillas 100000…, muelle de 20 al azar de
 * la caja), con el mazo del capitán de antes o con el nuevo.
 */
function medirVariados(capitan: CartaId[] | null) {
  const v: Vigilancia = { pruebas: 0, conDiego: 0, diegoSolo: 0, diegoSobraba: 0, diegoHaciaFalta: 0, virarPosible: 0, virar: 0 }
  const jugador = vigilar(jugadorConCriterio(), v)
  const rebarajes: number[] = []
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => {
    let dias = 0
    const p = jugarPartida(100_000 + i, jugador, {
      mazoDeMuelle: mazoDeMuelleAlAzar(100_000 + i),
      ...(capitan ? { mazoDelCapitan: capitan, sinComprobarMazos: true } : {}),
      alPaso: (s) => {
        for (const r of s.registro) if (r.texto.startsWith('Se acaba el mazo del capitán')) dias++
      },
    })
    rebarajes.push(dias)
    p.final = undefined as unknown as Estado
    return p
  })
  return resumen(partidas, v, rebarajes)
}

function medir(mazos: { muelle: CartaId[]; capitan: CartaId[] } | null) {
  const v: Vigilancia = { pruebas: 0, conDiego: 0, diegoSolo: 0, diegoSobraba: 0, diegoHaciaFalta: 0, virarPosible: 0, virar: 0 }
  const jugador = vigilar(jugadorConCriterio(), v)
  const rebarajes: number[] = []
  const partidas = Array.from({ length: PARTIDAS }, (_, i) => {
    let dias = 0
    const p = jugarPartida(i + 1, jugador, {
      ...(mazos ? { mazoDeMuelle: mazos.muelle, mazoDelCapitan: mazos.capitan, sinComprobarMazos: true } : {}),
      alPaso: (s) => {
        for (const r of s.registro) if (r.texto.startsWith('Se acaba el mazo del capitán')) dias++
      },
    })
    rebarajes.push(dias)
    p.final = undefined as unknown as Estado // no guardar el estado entero de cada partida
    return p
  })
  return resumen(partidas, v, rebarajes)
}

/**
 * Variantes del mazo del capitán «Pólvora y abordaje» que pidió medir Albert (25 de octubre de 2026): una copia menos de
 * «¡Arriba, perros!», de «Ron para los valientes» o de las dos. Solo para medir: el mazo de inicio no cambia.
 */
export const VARIANTES: Record<string, { nombre: string; quitar: CartaId[] }> = {
  A: { nombre: 'El mazo actual (36)', quitar: [] },
  B: { nombre: '1 sola copia de ¡Arriba, perros! (35)', quitar: ['arriba'] },
  C: { nombre: '1 sola copia de Ron para los valientes (35)', quitar: ['ron_valientes'] },
  D: { nombre: '1 sola copia de las dos (34)', quitar: ['arriba', 'ron_valientes'] },
}

/** El mazo del capitán de inicio con una copia menos de cada carta de la lista. */
export function mazoDelCapitanSin(quitar: readonly CartaId[]): CartaId[] {
  const mazo = [...DATOS.mazosPredefinidos.mazoDelCapitan]
  for (const id of quitar) {
    const i = mazo.indexOf(id)
    if (i < 0) throw new Error(`El mazo del capitán no lleva «${id}»`)
    mazo.splice(i, 1)
  }
  return mazo
}

it.runIf(process.env.MEDIR_MAZOS)(`mazos de inicio de antes frente a «Pólvora y abordaje» (${PARTIDAS} partidas cada uno)`, { timeout: 7_200_000 }, () => {
  const solo = process.env.MEDIR_MAZOS_SOLO
  const letra = process.env.MEDIR_MAZOS_VARIANTE
  if (letra) {
    const variante = VARIANTES[letra]
    if (!variante) throw new Error(`No hay variante «${letra}»`)
    const capitan = mazoDelCapitanSin(variante.quitar)
    const datos = process.env.MEDIR_MAZOS_VARIADOS ? medirVariados(capitan) : medir({ muelle: [...DATOS.mazosPredefinidos.mazoDeMuelle], capitan })
    const json = JSON.stringify({ variante: letra, nombre: variante.nombre, cartas: capitan.length, muelle: process.env.MEDIR_MAZOS_VARIADOS ? 'variados' : 'inicio', ...datos }, null, 1)
    if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
    else console.log(json)
    return
  }
  if (process.env.MEDIR_MAZOS_VARIADOS) {
    const json = JSON.stringify({ capitanDeAntes: medirVariados(MAZOS_ANTERIORES.capitan), capitanNuevo: medirVariados(null) }, null, 1)
    if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
    else console.log(json)
    return
  }
  const salida = {
    ...(solo !== 'nuevos' ? { antes: medir(MAZOS_ANTERIORES) } : {}),
    ...(solo !== 'antes' ? { nuevos: medir(null) } : {}),
    nombre: DATOS.mazosPredefinidos.nombre,
  }
  const json = JSON.stringify(salida, null, 1)
  if (process.env.MEDIR_SALIDA) writeFileSync(process.env.MEDIR_SALIDA, json)
  else console.log(json)
})
