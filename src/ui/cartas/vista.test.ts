import { describe, expect, it } from 'vitest'
import { CATALOGO, type EntradaCatalogo } from '../../engine/catalogo.ts'
import { COLOR_CLASE, COLOR_MOD, COLOR_TIPO, vistaDeCarta, type VistaCapitulo, type VistaJugador, type VistaPeligro, type VistaPuerto } from './vista.ts'

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

  it('Tripulante neutral con coste y Mejora de barco con Espacio y Rasgo «Cañón»', () => {
    const carpintero = vistaDeCarta(carta(14)) as VistaJugador
    // Fase 10c: la cinta dice el tipo; la Clase va en el color del marco y en el pie.
    expect(carpintero.tipoTexto).toBe('Tripulante')
    expect(carpintero.clase).toBe('Neutral')
    expect(carpintero.diseno).toBe('tripulante')
    expect(carpintero.color).toBe(COLOR_TIPO.tripulanteNeutral)
    expect(carpintero.coste).toBe(2)

    const canones = vistaDeCarta(carta(29)) as VistaJugador
    expect(canones.espacio).toBe(2)
    expect(canones.rasgos).toEqual(['Cañón'])
    expect(canones.pestanasDer).toEqual([]) // la munición ya no existe: sin pestaña a la derecha
    // Fase 11: los Cañones de bronce son de Piratería: su marco es del color de su Clase, no del de su tipo.
    expect(canones.clase).toBe('Piratería')
    expect(canones.diseno).toBe('mejoraBarco')
    expect(canones.color).toBe(COLOR_CLASE['Piratería'])
    // El Casco reforzado es Neutral (explícito en los datos).
    const casco = vistaDeCarta(carta(21)) as VistaJugador
    expect([casco.clase, casco.color]).toEqual(['Neutral', COLOR_TIPO.tripulanteNeutral])
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
    expect(v.destino.mod).toBe('0') // el «−0» se dibuja «0», sin signo y en pardo
    expect(v.destino.colorMod).toBe(COLOR_MOD['0'])

    const fiebres = vistaDeCarta(carta(87)) as VistaPeligro
    expect(fiebres.encuentros[0]?.opciones[0]?.alternativa).toEqual({ texto: '1 con', rasgo: 'Cirujano' })

    // «La Armada te persigue» ya tiene el formato de los Peligros 2.0 (Navío de línea de la Armada).
    const armada = vistaDeCarta(carta(95)) as VistaPeligro
    expect(armada.entraDuranteLaPartida).toBe(true)
    expect(armada.v2).toBe(true)
    expect(armada.encuentros[0]?.nombre).toBe('Navío de línea de la Armada')
    expect(armada.encuentros[0]?.opciones.map((o) => `${o.hab} ${o.dificultad}`)).toEqual(['NAV 5'])
  })

  it('fase 11 · permanente: cinta «Permanente», los tipos de su encuentro, hueco de ilustración y su número del mazo de historia', () => {
    const v = vistaDeCarta(carta(228)) as VistaJugador & { historia?: { num: number; dorso: string } }
    expect(v.nombre).toBe('Arenas movedizas')
    expect(v.tipoTexto).toBe('Permanente')
    expect(v.rasgos).toEqual(['Terreno'])
    expect(v.permanente).toBe(true)
    expect(v.arte).toBeUndefined() // «Ilustración pendiente»
    expect(v.historia).toEqual({ num: 228, dorso: 'misiones' })
    expect((vistaDeCarta(carta(234)) as VistaJugador).rasgos).toEqual([]) // «Viento a favor» no tiene tipo
  })

  it('capítulos: sello, travesía, Distancia, recompensa y pie', () => {
    const selva = vistaDeCarta(carta(119)) as VistaCapitulo
    expect([selva.sello, selva.de, selva.travesia]).toEqual(['II', 'IV', 'El templo perdido'])
    expect(selva.distancia).toBe(2)
    expect(selva.siguiente).toBe('Añade la carta 239 al mazo de Misiones')
    expect(selva.pie).toBe('Mazo de historia')

    const deuda = vistaDeCarta(carta(113)) as VistaCapitulo
    expect([deuda.sello, deuda.de, deuda.travesia]).toEqual(['I', 'I', 'Misión inicial'])
    expect(deuda.recompensaTexto).toBe('Otea 3 del mazo de Misiones') // fase 10b
    const aguada = vistaDeCarta(carta(115)) as VistaCapitulo
    expect(aguada.recompensa).toEqual([{ texto: '0', icono: 'rep' }])
    expect(aguada.recompensaTexto).toBe('Recluta sin coste un Tripulante del muelle de coste 2 o menos. El Barco sufre 1 daño, aunque estés en tierra.')
    expect((vistaDeCarta(carta(114)) as VistaCapitulo).recompensaTexto).toBe('Adquiere sin coste una Mejora del muelle de coste 1 o menos. Un Tripulante sufre 1 herida.')
    expect(deuda.pie).toBe('Misión inicial · a la vista al empezar')

    expect((vistaDeCarta(carta(153)) as VistaCapitulo).recompensaTexto).toBe('¡Victoria!')
    expect((vistaDeCarta(carta(116)) as VistaCapitulo).travesia).toBe('Aventura')

    // Salida doble: los capítulos II-a y II-b llevan su rama en el sello; la travesía sigue teniendo III capítulos.
    const barra = vistaDeCarta(carta(218)) as VistaCapitulo
    expect([barra.sello, barra.rama, barra.de, barra.nombre]).toEqual(['II', 'a', 'III', 'La barra de noche'])
    expect((vistaDeCarta(carta(140)) as VistaCapitulo).rama).toBe('b')
    // Final con elección: la recompensa se imprime como texto.
    const templo = vistaDeCarta(carta(120)) as VistaCapitulo
    expect(templo.recompensa).toEqual([])
    expect(templo.recompensaMarcada?.length).toBeGreaterThan(0)
  })

  it('puerto: muelle, tres opciones comunes y la propia', () => {
    const tortuga = vistaDeCarta(carta(111)) as VistaPuerto
    expect(tortuga.muelle).toBe(4)
    expect(tortuga.comunes).toHaveLength(3)
    expect(tortuga.propia.nombre).toBe('Soplos de la Hermandad')
  })
})
