// El motor entiende todos los textos de la caja, y lo que entiende coincide con las ayudas del prototipo
// (si chocaran, manda el texto: esta prueba avisa para revisarlo).

import { describe, expect, it } from 'vitest'
import { reputacionMinima } from './capacidades/misiones.ts'
import { CATALOGO } from './catalogo.ts'
import { misionesConReglas } from './misiones2/registro.ts'
import './motor.ts'
import { DATOS, type DestinoDatos, type EncuentroDatos, type OperacionPrototipo } from './datos.ts'
import { interpretarDestino } from './destinos.ts'
import { interpretarEfectos, type Efecto } from './efectos.ts'

function encuentros(): [string, EncuentroDatos][] {
  const lista: [string, EncuentroDatos][] = []
  // Los Peligros 2.0 no se leen de los iconos: tienen sus reglas registradas (peligros2/).
  for (const p of DATOS.peligros.filter((x) => x.version !== 2)) for (const [ent, e] of Object.entries(p.encuentros)) lista.push([`${p.id}.${ent}`, e])
  for (const c of DATOS.cartasDeMazoPropio.filter((x) => x.version !== 2)) lista.push([c.id, c.encuentro])
  return lista
}

function destinos(): [string, DestinoDatos][] {
  return [
    ...DATOS.peligros.filter((x) => x.version !== 2).map((p): [string, DestinoDatos] => [p.id, p.destino]),
    ...DATOS.cartasDeMazoPropio.filter((x) => x.version !== 2).map((c): [string, DestinoDatos] => [c.id, c.destino]),
  ]
}

/** Traduce una operación del prototipo a lo que debería entender el motor del texto. */
function delPrototipo(op: OperacionPrototipo): string {
  const [tipo, n] = op
  switch (tipo) {
    case 'wound':
      return `heridas:${n}`
    case 'ship':
      return `dano:${n}`
    case 'repair':
      return `reparar:${n}`
    case 'exhaust':
      return `agotar:${n}`
    case 'exhaustAll':
      return 'agotar:todos'
    case 'discard':
      return `descartar:${n}`
    case 'draw':
      return `robar:${n}`
    case 'heal':
      return `curar:${n}`
    case 'avLoss':
    case 'progLoss':
      return `perderAvance:${n}`
    case 'progAll':
      return 'perderAvance:todo'
    case 'ammoLoss':
      return `agotarCanones:${n}`
    case 'loseUp':
      return `perderMejora:${n}`
    case 'breakUp':
      return 'agotarMejora'
    case 'rep':
      return `reputacion:${n}`
    case 'flood':
      return 'menosMando'
    case 'clock':
      return 'perderDia'
    case 'addHz':
      return `entraEnMazo:${n}`
    case 'retira':
      return 'seRetira'
    case 'recruit':
      return 'recluta'
    default:
      return `?${tipo}`
  }
}

function resumen(e: Efecto): string {
  switch (e.tipo) {
    case 'heridas':
    case 'dano':
    case 'reparar':
    case 'descartar':
    case 'robar':
    case 'curar':
    case 'agotarCanones':
    case 'perderMejora':
    case 'reputacion':
      return `${e.tipo}:${e.n}`
    case 'agotar':
    case 'perderAvance':
      return `${e.tipo}:${e.n}`
    case 'entraEnMazo':
      return `entraEnMazo:${e.carta}`
    default:
      return e.tipo
  }
}

describe('Textos de las cartas que lee el motor', () => {
  it('entiende todos los recuadros de los encuentros', () => {
    for (const [clave, e] of encuentros()) {
      for (const texto of [e.textoFallo, e.textoExito, e.textoEfecto]) {
        expect(() => interpretarEfectos(texto ?? ''), `${clave}: ${texto}`).not.toThrow()
      }
    }
  })

  it('los recuadros coinciden con las ayudas del prototipo', () => {
    const distintos: string[] = []
    for (const [clave, e] of encuentros()) {
      const conPrueba = e.prueba.length > 0
      const pares: [string | undefined, OperacionPrototipo[]][] = conPrueba
        ? [
            [e.textoFallo, e.fallo],
            [e.textoExito, e.exito],
          ]
        : [[e.textoEfecto, [...e.siempre, ...e.fallo, ...e.exito]]]
      for (const [texto, ops] of pares) {
        const delTexto = interpretarEfectos(texto ?? '').map(resumen).sort()
        const delProto = ops.map(delPrototipo).sort()
        if (JSON.stringify(delTexto) !== JSON.stringify(delProto)) distintos.push(`${clave}: texto ${delTexto.join(', ')} · prototipo ${delProto.join(', ')}`)
      }
    }
    expect(distintos).toEqual([])
  })

  it('entiende todos los Destinos y coinciden con las ayudas del prototipo', () => {
    for (const [id, d] of destinos()) {
      const x = interpretarDestino(d)
      // Fase 10: el impreso se suma al total; el motor lo lleva en sentido de la dificultad (con el signo cambiado).
      if (d.mod === '✕') expect(x.modificador, id).toBe('fallo')
      else expect(x.modificador, id).toBe(d.modificador === 0 ? 0 : -(d.modificador as number))
      expect(x.siClave ? { kw: x.siClave.claves, n: x.siClave.n } : undefined, id).toEqual(d.modKw)
      expect(x.siHabilidad ? { hab: x.siHabilidad.hab, n: x.siHabilidad.n } : undefined, id).toEqual(d.modHab)
      expect(x.heridaComprometido, id).toBe(d.sentWound)
      expect(x.heridaMasFuerte, id).toBe(d.strongWound)
      expect(x.heridaSiFallas, id).toBe(d.failWound)
      expect(x.avanceSiSuperas, id).toBe(d.winAv)
      expect(x.preparaSiSuperas ? 1 : undefined, id).toBe(d.spare)
      expect(x.sinCanones ? 1 : undefined, id).toBe(d.noGuns)
      expect(x.sinCartas ? 1 : undefined, id).toBe(d.noCards)
    }
  })

  it('las 28 cartas de misión (misiones 2.0) tienen sus reglas escritas', () => {
    const misiones = CATALOGO.filter((e) => e.tipo === 'capitulo').map((e) => e.id)
    expect(misiones).toHaveLength(28)
    expect([...misionesConReglas()].sort()).toEqual([...misiones].sort())
    expect(reputacionMinima('panama-III')).toBe(6) // fase 11 (P66)
    expect(reputacionMinima('deuda-I')).toBe(0)
  })
})
