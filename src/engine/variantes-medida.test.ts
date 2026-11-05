// Variantes de medida del informe de dificultad (5 de noviembre de 2026): cambian números de Peligros concretos solo en
// memoria, para medir; nunca en la partida real.

import { afterEach, describe, expect, it } from 'vitest'
import { porId } from './catalogo.ts'
import { copia } from './estado.ts'
import { DATOS } from './datos.ts'
import './motor.ts'
import { reglasMision } from './misiones2/registro.ts'
import { nuevaPartida } from './preparacion.ts'
import { aplicarVariante, leerVariante, MANERAS } from './pruebas/variantesMedida.ts'

const respaldo = JSON.stringify({ peligros: DATOS.peligros, mazo: DATOS.mazosPredefinidos.mazoDePeligros })
afterEach(() => {
  const r = JSON.parse(respaldo) as { peligros: typeof DATOS.peligros; mazo: string[] }
  for (const [i, p] of r.peligros.entries()) Object.assign(DATOS.peligros[i]!, p)
  DATOS.mazosPredefinidos.mazoDePeligros = r.mazo
})

/** Un encuentro de Peligro del mazo, con Prueba en sus tres Entornos. */
function peligroDelMazo() {
  const id = DATOS.mazosPredefinidos.mazoDePeligros.find((x) => {
    const e = porId(x)
    return e.tipo === 'peligro' && Object.values(e.carta.encuentros).every((enc) => enc.prueba.length > 0)
  })
  const e = porId(id ?? '')
  if (e.tipo !== 'peligro') throw new Error('sin Peligro')
  return e
}

describe('variantes de medida del informe de dificultad', () => {
  it('lee DIF, AVP y FUERA', () => {
    const v = leerVariante('DIF:a=1,DIF:b.mar=2,AVP:c.nat=2/1,AVP:e.mar=1,FUERA:d')
    expect(v.dificultadPeligro).toEqual({ a: 1, 'b.mar': 2 })
    expect(v.avancePeligro).toEqual({ 'c.nat': [2, 1], 'e.mar': [1] })
    expect(v.fueraDelMazo).toEqual(['d'])
  })

  it('DIF sube la dificultad de un encuentro o de los tres', () => {
    const e = peligroDelMazo()
    const antes = { mar: e.carta.encuentros.mar.prueba[0]!.dificultad, nat: e.carta.encuentros.nat.prueba[0]!.dificultad }
    aplicarVariante(leerVariante(`DIF:${e.id}.mar=1`))
    expect(e.carta.encuentros.mar.prueba[0]!.dificultad).toBe(antes.mar + 1)
    expect(e.carta.encuentros.nat.prueba[0]!.dificultad).toBe(antes.nat)
    aplicarVariante(leerVariante(`DIF:${e.id}=1`))
    expect(e.carta.encuentros.mar.prueba[0]!.dificultad).toBe(antes.mar + 2)
    expect(e.carta.encuentros.nat.prueba[0]!.dificultad).toBe(antes.nat + 1)
  })

  it('AVP cambia el Avance de un encuentro y FUERA saca la carta del mazo de Peligros', () => {
    const e = peligroDelMazo()
    aplicarVariante(leerVariante(`AVP:${e.id}.ciu=1/1,FUERA:${e.id}`))
    expect(e.carta.encuentros.ciu.avance).toBe(1)
    expect(e.carta.encuentros.ciu.avanceSinSuperar).toBe(1)
    const s = nuevaPartida({ semilla: 1 })
    expect(s.zonas.mazoPeligros.map((c) => copia(s, c).id)).not.toContain(e.id)
  })

  it('SINGESTA quita la Gesta de un capítulo', () => {
    const reglas = reglasMision('prueba-I')
    const gesta = reglas?.gesta
    expect(gesta).toBeDefined()
    aplicarVariante(leerVariante('SINGESTA:prueba-I'))
    expect(reglasMision('prueba-I')?.gesta).toBeUndefined()
    if (reglas && gesta) reglas.gesta = gesta
    expect(() => aplicarVariante(leerVariante('SINGESTA:deuda-I'))).toThrow()
  })

  it('las maneras del informe de dificultad se leen y se aplican', () => {
    const dos = leerVariante(MANERAS[2]?.variante)
    expect(Object.keys(dos.dificultadPeligro)).toHaveLength(22)
    expect(Object.keys(dos.avancePeligro)).toHaveLength(15)
    expect(Object.keys(leerVariante(MANERAS.antes?.variante).reputacionCapitulo)).toHaveLength(7)
    expect(leerVariante(MANERAS[1]?.variante).escenario).toBe(10)
    // La 2: solo Pruebas de COM y solo encuentros sin Prueba.
    for (const clave of Object.keys(dos.dificultadPeligro)) {
      const [id, entorno] = clave.split('.') as [string, 'mar' | 'nat' | 'ciu']
      const e = porId(id)
      expect(e.tipo === 'peligro' && e.carta.encuentros[entorno].prueba.every((o) => o.hab === 'COM'), clave).toBe(true)
    }
    for (const clave of Object.keys(dos.avancePeligro)) {
      const [id, entorno] = clave.split('.') as [string, 'mar' | 'nat' | 'ciu']
      const e = porId(id)
      expect(e.tipo === 'peligro' && e.carta.encuentros[entorno].prueba.length === 0, clave).toBe(true)
    }
    aplicarVariante(dos)
  })

  it('P134: ANTES_P134 devuelve el punto a las siete recompensas que siguen bajadas (en un final con elección, a cada opción)', () => {
    const goleta = porId('espia-II')
    const bitacora = porId('bitacora_capitan')
    if (goleta.tipo !== 'capitulo' || bitacora.tipo !== 'recompensa') throw new Error('sin cartas')
    expect(goleta.carta.recompensa.rep).toBe(2)
    expect(bitacora.carta.elige?.map((o) => o.rep)).toEqual([2, 3])
    const v = leerVariante('ANTES_P134')
    expect(Object.values(v.reputacionCapitulo)).toEqual(Array.from({ length: 7 }, () => 1))
    aplicarVariante(v)
    expect(goleta.carta.recompensa.rep).toBe(3)
    expect(bitacora.carta.elige?.map((o) => o.rep)).toEqual([3, 4])
    aplicarVariante({ ...v, reputacionCapitulo: Object.fromEntries(Object.keys(v.reputacionCapitulo).map((id) => [id, -1])) })
    expect(goleta.carta.recompensa.rep).toBe(2)
    expect(bitacora.carta.elige?.map((o) => o.rep)).toEqual([2, 3])
  })

  it('P135: ANTES_P135 quita el punto que devolvió P135 y JUGADOR_ANTES lee la variante del jugador de antes', () => {
    const fugitivo = porId('fugitivo-II')
    const cueva = porId('cueva_abajo')
    if (fugitivo.tipo !== 'capitulo' || cueva.tipo !== 'recompensa') throw new Error('sin cartas')
    const v = leerVariante('ANTES_P135')
    expect(v.reputacionCapitulo).toEqual({ 'isla-II-ingleses': -1, 'isla-II-temblor': -1, 'fugitivo-II': -1 })
    aplicarVariante(v)
    expect(fugitivo.carta.recompensa.rep).toBe(2)
    expect(cueva.carta.elige?.map((o) => o.rep)).toEqual([2, 1])
    aplicarVariante({ ...v, reputacionCapitulo: { 'isla-II-ingleses': 1, 'isla-II-temblor': 1, 'fugitivo-II': 1 } })
    expect(fugitivo.carta.recompensa.rep).toBe(3)
    expect(cueva.carta.elige?.map((o) => o.rep)).toEqual([3, 2])
    expect(leerVariante('JUGADOR_ANTES').claves.has('JUGADOR_ANTES')).toBe(true)
    aplicarVariante(leerVariante(''))
  })

  it('una carta que no es de Peligro o que no está en el mazo da error', () => {
    expect(() => aplicarVariante(leerVariante('DIF:bucanero=1'))).toThrow()
    expect(() => aplicarVariante(leerVariante('FUERA:armada'))).toThrow()
  })
})
