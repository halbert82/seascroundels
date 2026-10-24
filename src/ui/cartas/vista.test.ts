import { describe, expect, it } from 'vitest'
import { CATALOGO, type EntradaCatalogo } from '../../engine/catalogo.ts'
import type { Segmento } from './marcado.ts'
import { COLOR_CLASE, COLOR_MOD, COLOR_TIPO, vistaDeCarta, type VistaCapitulo, type VistaJugador, type VistaPeligro, type VistaPuerto } from './vista.ts'

/** Un texto con marcado, en palabras: «{+2 rep}. Coge…» → «+2. Coge…». */
function textoPlano(segmentos: readonly Segmento[] | undefined): string {
  return (segmentos ?? [])
    .map((x) => (x.tipo === 'numero' ? `${x.valor}${x.tras ?? ''}` : x.tipo === 'parrafo' ? ' ' : x.tipo === 'icono' ? (x.pegado ?? '') : x.texto))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

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

  it('fase 16: las cartas de jugador llevan todas la misma letra (18 px), sin texto grande; las demás, la suya', () => {
    const jugador = (n: number) => vistaDeCarta(carta(n)) as VistaJugador
    // Capitán, Barco, Tripulante, Mejoras, Evento y Habilidad.
    for (const n of [1, 3, 7, 24, 34, 44, 66]) expect(jugador(n).letra, `carta ${n}`).toBe(18)
    // 45 y 46 ya no van grandes.
    for (const n of [45, 46]) expect([jugador(n).textoClase, jugador(n).letra], `carta ${n}`).toEqual(['', 18])
    // P125: ya no hay letras provisionales; las que no cabían bajan un poco la ilustración.
    for (const n of [9, 11, 18, 168, 244, 245]) expect(jugador(n).letra, `carta ${n}`).toBe(18)
    // Un Tesoro, un Escenario y la culebrina del naufragio no son cartas de jugador: no cambian.
    for (const n of [148, 97, 278]) expect(jugador(n).letra, `carta ${n}`).toBeUndefined()
  })

  it('P125 y P132: Isabela, el Viejo lobo, el Fiador y Marineros sin barco bajan un poco la ilustración, sin tocar su texto', () => {
    const corta = (n: number) => (vistaDeCarta(carta(n)) as VistaJugador).arteCorto
    expect([11, 18, 168].map(corta)).toEqual([26, 26, 26])
    expect(corta(100)).toBe(16)
    // Las demás, nada (Rufián de cubierta, Carpinteros de ribera y, desde P132, el Filibustero borracho, la Carne de cañón
    // y el Galeote fugado: con los dos iconos en la misma línea, caben).
    for (const n of [4, 106, 9, 244, 245]) expect(corta(n), `carta ${n}`).toBeUndefined()
    // Los textos de 009, 244 y 245 dicen «en esta Prueba» (como la Pistola).
    for (const n of [9, 244, 245]) expect(textoPlano((vistaDeCarta(carta(n)) as VistaJugador).texto), `carta ${n}`).toMatch(/en esta Prueba\./)
  })

  it('P125: en el Barco, «Distancia −1» no se parte (el «−1» nunca solo en la última línea)', () => {
    const barco = vistaDeCarta(carta(3)) as VistaJugador
    const i = barco.texto.findIndex((s) => s.tipo === 'numero' && s.valor === '−1')
    const antes = barco.texto[i - 1]
    expect(antes?.tipo === 'texto' && antes.texto.endsWith('Distancia\u00a0')).toBe(true)
    expect(barco.texto[i]).toMatchObject({ tipo: 'numero', valor: '−1', tras: '.' })
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
    expect(fiebres.encuentros[0]?.opciones[0]?.alternativa).toEqual({ rasgo: 'Cirujano', asignado: false, rebaja: 2 }) // fase 13: «Cirujano −2»

    // «La Armada te persigue» ya tiene el formato de los Peligros 2.0 (Navío de línea de la Armada).
    const armada = vistaDeCarta(carta(95)) as VistaPeligro
    expect(armada.entraDuranteLaPartida).toBe(true)
    expect(armada.v2).toBe(true)
    expect(armada.encuentros[0]?.nombre).toBe('Navío de línea de la Armada')
    expect(armada.encuentros[0]?.opciones.map((o) => `${o.hab} ${o.dificultad}`)).toEqual(['NAV 4']) // fase 14: antes, 5
  })

  it('fase 11 · permanente: cinta «Permanente», los tipos de su encuentro, hueco de ilustración y su número del mazo de historia', () => {
    const v = vistaDeCarta(carta(228)) as VistaJugador & { historia?: { num: number; dorso: string } }
    expect(v.nombre).toBe('Arenas movedizas')
    expect(v.tipoTexto).toBe('Permanente')
    expect(v.rasgos).toEqual([])
    expect(v.tipos).toBe('Terreno') // fase 14: con la letra del tipo de un encuentro, no como un Rasgo
    expect(v.permanente).toBe(true)
    expect(v.arte).toBeUndefined() // «Ilustración pendiente»
    expect(v.historia).toEqual({ num: 228, dorso: 'misiones' })
    expect((vistaDeCarta(carta(234)) as VistaJugador).tipos).toBeUndefined() // «Viento a favor» no tiene tipo
    expect((vistaDeCarta(carta(220)) as VistaJugador).tipos).toBe('Guardia') // fase 14: «¡La guardia!» es de tipo Guardia
  })

  it('el robo de una recompensa va con su icono, sin verbo: «+1 [rep] · 2 [robar]» (La casa del gobernador y El ladrón del puerto)', () => {
    for (const n of [116, 117]) {
      const v = vistaDeCarta(carta(n)) as VistaCapitulo
      expect(v.recompensa, `carta ${n}`).toEqual([{ texto: '+1', icono: 'rep' }, { texto: '·' }, { texto: '2', icono: 'robar' }])
      expect(v.recompensaTexto, `carta ${n}`).toBeUndefined()
    }
  })

  it('capítulos: sello, travesía, Distancia, recompensa y pie', () => {
    const selva = vistaDeCarta(carta(119)) as VistaCapitulo
    expect([selva.sello, selva.de, selva.travesia]).toEqual(['II', 'IV', 'El templo perdido'])
    expect(selva.distancia).toBe(2)
    expect(selva.siguiente).toBe('Pon la carta 239 encima del mazo de Misiones')
    expect(selva.pie).toBe('Mazo de historia')

    const deuda = vistaDeCarta(carta(113)) as VistaCapitulo
    expect([deuda.sello, deuda.de, deuda.travesia]).toEqual(['I', 'I', 'Misión inicial'])
    // Fase 15, cuarta ronda: el recuadro solo dice qué carta coger; lo que se hace, en la carta de recompensa (287).
    expect(deuda.recompensa).toEqual([])
    expect(deuda.recompensaTexto).toBeUndefined()
    expect(textoPlano(deuda.recompensaMarcada)).toBe('Coge la carta 287 del mazo de historia.')
    const soplo = vistaDeCarta(carta(287)) as VistaJugador
    expect(soplo.tipoTexto).toBe('Recompensa · Cobrar la deuda')
    // Fase 13: sin «Otea» (Otear es siempre del mazo de Peligros); el mismo efecto.
    expect(textoPlano(soplo.texto)).toBe(
      'Mira las 3 cartas superiores del mazo de Misiones y devuélvelas encima o al fondo, en el orden que quieras, antes de reponer las misiones disponibles.',
    )
    expect(textoPlano((vistaDeCarta(carta(115)) as VistaCapitulo).recompensaMarcada)).toBe('Coge la carta 289 del mazo de historia.')
    // Con reputación y una carta: «+2 [rep]. Coge la carta 295 del mazo de historia.»
    expect(textoPlano((vistaDeCarta(carta(272)) as VistaCapitulo).recompensaMarcada)).toBe('+2. Coge la carta 295 del mazo de historia.')
    expect(deuda.pie).toBe('Misión inicial · a la vista al empezar')

    expect((vistaDeCarta(carta(153)) as VistaCapitulo).recompensaTexto).toBe('¡Victoria!')
    expect((vistaDeCarta(carta(116)) as VistaCapitulo).travesia).toBe('Aventura')

    // Salida doble: los capítulos II-a y II-b llevan su rama en el sello; la travesía sigue teniendo III capítulos.
    const barra = vistaDeCarta(carta(218)) as VistaCapitulo
    expect([barra.sello, barra.rama, barra.de, barra.nombre]).toEqual(['II', 'a', 'III', 'La barra de noche'])
    expect((vistaDeCarta(carta(140)) as VistaCapitulo).rama).toBe('b')
    // Final con elección (fase 15, cuarta ronda): el recuadro dice qué carta coger y la elección está en ella; sin etiqueta del
    // Tesoro (lo pone la opción que lo da).
    const templo = vistaDeCarta(carta(120)) as VistaCapitulo
    expect(templo.recompensa).toEqual([])
    expect(textoPlano(templo.recompensaMarcada)).toBe('Coge la carta 290 del mazo de historia.')
    expect(templo.siguiente).toBeUndefined()
    const altar = vistaDeCarta(carta(290)) as VistaJugador
    expect(altar.tipoTexto).toBe('Recompensa · El templo perdido')
    expect(textoPlano(altar.texto)).toMatch(/^Elige:/)
  })

  it('puerto: muelle, tres opciones comunes y la propia', () => {
    const tortuga = vistaDeCarta(carta(111)) as VistaPuerto
    expect(tortuga.muelle).toBe(4)
    expect(tortuga.comunes).toHaveLength(3)
    expect(tortuga.propia.nombre).toBe('Soplos de la Hermandad')
  })
})
