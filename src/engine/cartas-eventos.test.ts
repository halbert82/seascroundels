// Una prueba (al menos) por cada Evento y Habilidad del mazo del capitán, y la opción propia de Nassau.

import { describe, expect, it } from 'vitest'
import { capacidadesDe } from './capacidades/index.ts'
import { iconosDe } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { dificultadPrueba, totalPrueba } from './prueba.ts'
import { Jugador } from './pruebas/situacion.ts'

describe('Habilidades (sin texto)', () => {
  it('solo se usan por sus iconos: cada uno suma 1', () => {
    for (const h of DATOS.habilidades) {
      expect(capacidadesDe(h.id)).toEqual([])
      const total = iconosDe(h.id, 'NAV') + iconosDe(h.id, 'COM') + iconosDe(h.id, 'EXP')
      expect(total, h.nombre).toBe(2)
    }
  })
})

describe('Eventos sin etiqueta (en cualquier pausa)', () => {
  it('043 · Botín escondido: buscas una Mejora en el mazo de muelle', () => {
    const j = Jugador.en({ mano: ['botin'], mazoMuelle: ['bucanero', 'sable'] })
    j.usar('botin.jugar')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'buscar' } })
    j.elegir('sable')
    expect(j.zona('muelle')).toContain('sable')
    expect(j.zona('descartesCapitan')).toEqual(['botin'])
  })

  it('044 · Rumores de taberna: oteas 2 y eliges el orden de las que dejas arriba', () => {
    const j = Jugador.en({ mano: ['taberna'], mazoPeligros: ['leyenda', 'calma', 'chubasco'] })
    j.usar('taberna.jugar').opcion('arriba').opcion('arriba')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'ordenarOteo' }, min: 2, max: 2 })
    j.elegir('calma', 'leyenda')
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'leyenda', 'chubasco'])
  })

  it('045 · Remiendo de urgencia: reparas 2', () => {
    const j = Jugador.en({ mano: ['reparacion'], barco: { dano: 3 } })
    j.usar('reparacion.jugar')
    expect(j.estado.danoBarco).toBe(1)
  })

  it('046 · Vendas y aguardiente: curas 2, repartidas como quieras', () => {
    const j = Jugador.en({ mano: ['vendas'], capitan: { heridas: 1 }, tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.usar('vendas.jugar')
    expect([j.copia('capitan').heridas, j.copia('bucanero').heridas]).toEqual([0, 0])
  })

  it('048 · Pólvora de contrabando: añades 1 de munición a un Cañón', () => {
    const j = Jugador.en({ mano: ['polvora_c'], barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    j.usar('polvora_c.jugar')
    expect(j.copia('bronce').municion).toBe(1)
  })
})

describe('Eventos de Acción', () => {
  it('047 · El capitán hace guardia: agotas a Diego y curas 1 a cada Tripulante', () => {
    const j = Jugador.en({ mano: ['ron_descanso'], capitan: { heridas: 2 }, tripulacion: [{ id: 'bucanero', heridas: 1 }] })
    j.usar('ron_descanso.jugar')
    expect(j.copia('capitan').agotada).toBe(true)
    expect([j.copia('capitan').heridas, j.copia('bucanero').heridas]).toEqual([1, 0])
  })

  it('051 · ¡Arriba, perros!: preparas a un Tripulante', () => {
    const j = Jugador.en({ mano: ['arriba'], tripulacion: [{ id: 'bucanero', agotada: true }] })
    j.usar('arriba.jugar')
    expect(j.copia('bucanero').agotada).toBe(false)
  })

  it('059 · Náufrago en la playa: reclutas gratis a uno de las 3 primeras del mazo de muelle; al final del turno, se descarta', () => {
    const j = Jugador.en({ mano: ['naufrago', 'ojo'], mazoMuelle: ['sable', 'bucanero', 'vela', 'casco'], escenario: ['calma_ev', 'calma_ev'] })
    j.usar('naufrago.jugar').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'naufrago' } })
    j.elegir('bucanero')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.zona('descartesMuelle').sort()).toEqual(['sable', 'vela'])
    expect(j.zona('mazoMuelle')).toEqual(['casco'])
    j.pasarTurnoEnPuerto()
    expect(j.zona('tripulacion')).not.toContain('bucanero')
    expect(j.zona('descartesMuelle')).toContain('bucanero')
  })

  it('063 · Trampa en la maleza: este turno, −1 a la dificultad de las Pruebas de COM en Naturaleza', () => {
    // «Agua y leña» (Naturaleza, Distancia 1): Bandoleros (COM 3) pide 2.
    const j = Jugador.en({ mano: ['trampa'], tripulacion: ['bucanero'], misiones: ['pruebas-nat3'], mazoPeligros: ['rivales', 'chubasco', 'calma'], escenario: ['calma_ev'] })
    j.usar('trampa.jugar').zarpar('pruebas-nat3') // Distancia 1 − 1 del Barco = 0
    j.comprometer('COM', ['capitan'])
    expect(dificultadPrueba(j.estado)).toBe(2)
  })
})

describe('Respuestas al revelar una carta de Peligro', () => {
  it('049 · ¡A toda vela!: en el Mar, +2 de Avance', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['viento', 'ojo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.usar('viento.jugar').elegir('ojo')
    expect(j.registro).toContain('¡A toda vela!: +2 de Avance (2/3).')
  })

  it('054 · Sangre fría: en Ciudad, ganas el Avance de la carta y la descartas sin resolverla', () => {
    // «Cobrar la deuda»: Pelea de taberna (2 de Avance).
    const j = Jugador.enMision({ mano: ['sangre_fria', 'ojo', 'timon'], mazoPeligros: ['rivales', 'calma', 'calma'] })
    j.usar('sangre_fria.jugar').elegir('ojo', 'timon')
    expect(j.registro).toContain('«Pelea de taberna»: +2 de Avance (2/3).')
    expect(j.zona('descartesPeligros')).toContain('rivales')
  })

  it('055 · Cambio de rumbo: en el Mar, la carta va al fondo del mazo y revelas otra', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['cambio_rumbo', 'ojo'], mazoPeligros: ['leyenda', 'calma', 'chubasco'] })
    j.usar('cambio_rumbo.jugar').elegir('ojo')
    expect(j.zona('mazoPeligros')).toEqual(['chubasco', 'leyenda'])
    expect(j.registro.some((t) => t.endsWith(': Mar en calma (Mar).'))).toBe(true)
  })

  it('056 · Soborno: en Ciudad, superas la Prueba sin revelar Destino', () => {
    const j = Jugador.enMision({ mano: ['soborno', 'ojo', 'timon'], mazoPeligros: ['rivales', 'leyenda', 'calma'] })
    j.usar('soborno.jugar').elegir('ojo', 'timon')
    expect(j.registro).toContain('Superas automáticamente la Prueba de COM, sin revelar Destino.')
    expect(j.registro.some((t) => t.startsWith('Destino:'))).toBe(false)
  })
})

describe('Otras Respuestas', () => {
  it('050 · Mapa robado: después de zarpar, +1 de Avance y robas 1', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['mapa', 'timon'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.usar('mapa.jugar').elegir('timon')
    expect(j.registro).toContain('Mapa robado: +1 de Avance (1/3).')
    expect(j.zona('mano')).toEqual(['ojo'])
  })

  it('052 · Ánimo renovado: después de fallar una Prueba, robas 2', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['animo'], mazoPeligros: ['chubasco', 'leyenda', 'calma'] })
    j.comprometer('NAV', ['capitan']).seguir()
    j.usar('animo.jugar')
    expect(j.zona('mano')).toEqual(['ojo', 'ojo'])
  })

  it('057 · ¡Todos a una!: tras comprometer, +1 por cada Tripulante comprometido', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['todos', 'ojo'], tripulacion: ['bucanero'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan', 'bucanero'])
    j.usar('todos.jugar').elegir('ojo')
    expect(totalPrueba(j.estado)).toBe(3 + 2 + 2)
  })

  it('060 · Prisionero liberado: tras superar una Prueba de COM, reclutas gratis del muelle a uno de coste 2 o menos', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['prisionero', 'ojo'], muelle: ['grumete', 'contrabandista'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).seguir()
    j.usar('prisionero.jugar').elegir('ojo')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'reclutarGratis' } })
    expect((j.decision as { candidatas: string[] }).candidatas.length).toBe(1) // el Contrabandista cuesta 3
    j.elegir('grumete')
    expect(j.zona('tripulacion')).toContain('grumete')
  })

  it('061 · Senda escondida: después de zarpar hacia una misión de Naturaleza, +2 de Avance', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], mano: ['senda', 'ojo'], mazoPeligros: ['calma', 'calma', 'calma'] })
    j.usar('senda.jugar').elegir('ojo')
    expect(j.registro).toContain('Senda escondida: +2 de Avance (2/3).')
  })

  it('064 · Lección aprendida: tras fallar, ficha de Entrenamiento de esa habilidad para un participante con hueco', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['leccion', 'ojo'], tripulacion: ['bucanero'], mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.comprometer('COM', ['bucanero']).seguir()
    j.usar('leccion.jugar').elegir('ojo')
    expect(j.copia('bucanero').entrenamiento).toEqual(['COM'])
  })

  it('065 · Retirada a tiempo: tras revelarse el Destino, descartas la carta de Peligro sin resolverla', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['retirada', 'ojo'], mazoPeligros: ['cazadores', 'leyenda', 'calma', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('retirada.jugar').elegir('ojo')
    expect(j.zona('descartesPeligros')).toEqual(expect.arrayContaining(['cazadores', 'leyenda']))
    expect(j.estado.danoBarco).toBe(0) // sin el fallo de la Fragata
    // La Fragata no da Avance ni cuenta como resuelta: después se revela y resuelve el Mar en calma.
    expect(j.estado.mision?.cartasResueltas).toBe(1)
    expect(j.avance('pruebas-mar3')).toBe(2)
  })
})

describe('Interrupciones', () => {
  it('053 · Reflejos de gato: cancelas un Destino', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['reflejos', 'ojo'], mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('reflejos.jugar').elegir('ojo').seguir()
    expect(j.registro).toContain('Total 3 contra 2: superas la Prueba.')
  })

  it('058 · Ni un hombre atrás: las heridas de un participante las sufre otro participante', () => {
    // «Puñal escondido»: uno de los comprometidos sufre 1 herida. Va a Diego y se desvía al Bucanero.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], mano: ['ni_hombre', 'ojo'], tripulacion: ['bucanero'], mazoPeligros: ['fauna', 'rivales', 'calma'] })
    j.comprometer('COM', ['capitan', 'bucanero']).elegir('capitan')
    j.usar('ni_hombre.jugar').elegir('ojo')
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.copia('bucanero').heridas).toBe(1)
  })

  it('062 · Perdidos en la espesura: en Naturaleza, ignoras los efectos de fallo', () => {
    // Barranco (EXP 2, fallo: 1 herida) con el Destino «Fallo».
    const j = Jugador.enMision({ misiones: ['pruebas-nat3'], mano: ['espesura', 'ojo'], tripulacion: ['bucanero'], mazoPeligros: ['escollos', 'leyenda', 'calma'] })
    j.comprometer('EXP', ['capitan']).seguir()
    j.usar('espesura.jugar').elegir('ojo')
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.registro).toContain('Ignoras los efectos de fallo del encuentro.')
  })
})

describe('112 · Nassau: Entrenamiento', () => {
  it('si te quedas en puerto, pones una ficha de +1 a la habilidad que elijas en un Tripulante con hueco', () => {
    const j = Jugador.en({ puerto: 'nassau', tripulacion: ['bucanero'] })
    j.terminar().opcion('quedarse').opcion('propia').elegir('bucanero').opcion('NAV')
    expect(j.copia('bucanero').entrenamiento).toEqual(['NAV'])
    expect(j.valor({ tipo: 'habilidad', carta: j.inst('bucanero'), hab: 'NAV' })).toBe(1 + 1 + 1)
  })
})
