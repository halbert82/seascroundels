import { describe, expect, it } from 'vitest'
import { CATALOGO, type EntradaCatalogo } from '../../engine/catalogo.ts'
import { COLOR_TIPO, vistaDeCarta, type VistaCapitulo, type VistaJugador, type VistaPeligro, type VistaPuerto } from './vista.ts'

function carta(num: number): EntradaCatalogo {
  const entrada = CATALOGO.find((c) => c.num === num)
  if (!entrada) throw new Error(`No existe la carta ${num}`)
  return entrada
}

describe('vista de las cartas', () => {
  it('construye la vista de las 153 cartas sin errores', () => {
    for (const entrada of CATALOGO) expect(() => vistaDeCarta(entrada), `carta ${entrada.num}`).not.toThrow()
  })

  it('Diego: habilidades, Mando, huecos, Vida, ilustración y sin coste', () => {
    const v = vistaDeCarta(carta(1)) as VistaJugador
    expect(v.unica).toBe(true)
    expect(v.color).toBe(COLOR_TIPO.capitan)
    expect(v.tipoTexto).toBe('Capitán · Piratería')
    expect(v.pestanasIzq.map((p) => [p.icono, p.valor])).toEqual([
      ['NAV', 2],
      ['COM', 3],
      ['EXP', 1],
    ])
    expect(v.pestanasDer).toEqual([{ icono: 'robar', valor: 5, color: '#2E5E63' }])
    expect(v.huecos).toBe(2)
    expect(v.vida).toBe(4)
    expect(v.coste).toBeUndefined()
    expect(v.arte?.encuadre).toBe('center top')
  })

  it('Tripulante neutral con coste y Mejora de barco con Espacio, munición y Rasgo «Cañón»', () => {
    const carpintero = vistaDeCarta(carta(14)) as VistaJugador
    expect(carpintero.tipoTexto).toBe('Tripulante · Neutral')
    expect(carpintero.color).toBe(COLOR_TIPO.tripulanteNeutral)
    expect(carpintero.coste).toBe(2)

    const canones = vistaDeCarta(carta(29)) as VistaJugador
    expect(canones.espacio).toBe(2)
    expect(canones.rasgos).toEqual(['Cañón'])
    expect(canones.pestanasDer).toEqual([{ icono: 'municion', valor: 2, color: '#5A4532' }])
  })

  it('las Mejoras con una sola cifra se dibujan grandes y las Habilidades no tienen texto', () => {
    expect((vistaDeCarta(carta(21)) as VistaJugador).textoClase).toBe('big')
    const habilidad = vistaDeCarta(carta(66)) as VistaJugador
    expect(habilidad.alta).toBe(true)
    expect(habilidad.pestanasIzq.map((p) => p.icono)).toEqual(['COM', 'COM'])
  })

  it('Peligro: encuentros por Entorno, opciones, recuadros y Destino', () => {
    const v = vistaDeCarta(carta(79)) as VistaPeligro
    expect(v.encuentros.map((e) => e.entorno)).toEqual(['mar', 'nat', 'ciu'])
    const bajios = v.encuentros[0]
    expect(bajios?.opciones.map((o) => `${o.hab} ${o.dificultad}`)).toEqual(['NAV 2', 'EXP 3'])
    expect(bajios?.fallo).toEqual([
      { texto: '1', icono: 'dano' },
      { texto: '1', icono: 'mejora', rota: true },
    ])
    expect(v.destino.mod).toBe('+0')

    const fiebres = vistaDeCarta(carta(87)) as VistaPeligro
    expect(fiebres.encuentros[0]?.opciones[0]?.alternativa).toEqual({ texto: '1 con', rasgo: 'Cirujano' })

    const armada = vistaDeCarta(carta(95)) as VistaPeligro
    expect(armada.entraDuranteLaPartida).toBe(true)
    expect(armada.destino.sinOposicion).toEqual([{ texto: '1', icono: 'agotar' }])
  })

  it('capítulos: sello, travesía, Distancia, recompensa y pie', () => {
    const selva = vistaDeCarta(carta(119)) as VistaCapitulo
    expect([selva.sello, selva.de, selva.travesia]).toEqual(['II', 'III', 'El templo perdido'])
    expect(selva.distancia).toBe(3)
    expect(selva.siguiente).toBe('Añade la carta 120 a Misiones')
    expect(selva.pie).toBe('Mazo de historia')

    const deuda = vistaDeCarta(carta(113)) as VistaCapitulo
    expect([deuda.sello, deuda.de, deuda.travesia]).toEqual(['I', 'I', 'Misión inicial'])
    expect(deuda.recompensaTexto).toBe('y busca un Tripulante')
    expect(deuda.pie).toBe('Misión inicial · a la vista al empezar')

    expect((vistaDeCarta(carta(153)) as VistaCapitulo).recompensaTexto).toBe('¡Victoria!')
    expect((vistaDeCarta(carta(116)) as VistaCapitulo).travesia).toBe('Aventura')
  })

  it('puerto: muelle, tres opciones comunes y la propia', () => {
    const tortuga = vistaDeCarta(carta(111)) as VistaPuerto
    expect(tortuga.muelle).toBe(4)
    expect(tortuga.comunes).toHaveLength(3)
    expect(tortuga.propia.nombre).toBe('Soplos de la Hermandad')
  })
})
