// Una prueba (al menos) por cada Capitán y Tripulante, con una situación de juego concreta.

import { describe, expect, it } from 'vitest'
import { capacidadesDe } from './capacidades/index.ts'
import { DATOS } from './datos.ts'

import { Jugador, totalSinDestinoPrueba } from './pruebas/situacion.ts'

describe('Cartas sin texto', () => {
  it('Rufián de cubierta y Bucanero veterano solo aportan sus números', () => {
    for (const id of ['marinero_p', 'bucanero']) {
      expect(capacidadesDe(id)).toEqual([])
      const t = DATOS.tripulantes.find((x) => x.id === id)
      const j = Jugador.en({ tripulacion: [id] })
      // Con Diego preparado, +1 a cada habilidad.
      expect(j.valor({ tipo: 'habilidad', carta: j.inst(id), hab: 'COM' })).toBe((t?.COM ?? 0) + 1)
      expect(j.valor({ tipo: 'vida', carta: j.inst(id) })).toBe(t?.vida)
    }
  })
})

describe('002 · Catalina «la Enganchadora» Rojas', () => {
  it('se agota y el próximo Tripulante que reclutes este turno cuesta 2 menos; el siguiente, lo normal', () => {
    const j = Jugador.en({ capitanId: 'capitan2', mano: ['ojo', 'timon', 'coraje', 'estrellas'], muelle: ['contrabandista', 'bucanero'] })
    j.usar('capitan2.agotar')
    expect(j.copia('capitan2').agotada).toBe(true)
    expect(j.valor({ tipo: 'coste', carta: j.inst('contrabandista') })).toBe(1)
    j.reclutar('contrabandista').elegir('ojo')
    expect(j.valor({ tipo: 'coste', carta: j.inst('bucanero') })).toBe(2)
    expect(j.ofrece('usar', 'capitan2.agotar')).toBe(false)
  })
})

describe('005 · Grumete leal', () => {
  it('se descarta y las heridas que iba a sufrir otro Tripulante quedan en 0', () => {
    // Tiburones (COM 2, fallo: 1 herida) con el Destino «Fallo»: Diego falla y va a sufrir 1 herida.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['grumete'], mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.comprometer('COM', ['capitan']).seguir()
    j.repartir({ capitan: 1 }) // heridas libres (fase 10): el jugador elige a quién
    expect(j.ofreceCapacidad('grumete.salvar')).toBe(true)
    j.usar('grumete.salvar')
    expect(j.copia('capitan').heridas).toBe(0)
    expect(j.zona('descartesMuelle')).toContain('grumete')
  })

  it('no se protege a sí mismo', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['grumete'], mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.comprometer('COM', ['grumete']).seguir()
    expect(j.ofreceCapacidad('grumete.salvar')).toBe(false)
  })
})

describe('007 · Uñas largas', () => {
  it('si superas una Prueba en la que participa, robas 1', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['saqueador'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.comprometer('COM', ['saqueador']).seguir()
    expect(j.ofreceCapacidad('saqueador.superar')).toBe(true)
    j.usar('saqueador.superar')
    expect(j.zona('mano')).toEqual(['ojo'])
  })
})

describe('008 · Contrabandista del bajo Caribe', () => {
  it('si superas una Prueba de NAV en la que participa, ganas 1 de Avance', () => {
    // Chubasco repentino (NAV 2): el Contrabandista suma 2 + 1 (Diego) + 1 (Barco).
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['contrabandista'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.comprometer('NAV', ['contrabandista']).seguir().usar('contrabandista.superar')
    expect(j.registro).toContain('Contrabandista del bajo Caribe: +1 de Avance (1/3).')
  })

  it('en una Prueba de COM no se ofrece', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['contrabandista'], mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    j.comprometer('COM', ['contrabandista']).seguir()
    expect(j.ofreceCapacidad('contrabandista.superar')).toBe(false)
  })
})

describe('009 · Filibustero borracho', () => {
  it('en la ventana de la Prueba: sufre 1 herida y tiene +2 COM; una vez por turno', () => {
    // Piratas rivales (COM 4) con el Destino de «Fauna» (−1). Filibustero 3 + 1 (Diego) = 4; con la furia, 6; con el Destino, 5.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['filibustero'], mazoPeligros: ['rivales', 'fauna', 'calma'] })
    j.comprometer('COM', ['filibustero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(4)
    j.usar('filibustero.furia')
    expect(j.copia('filibustero').heridas).toBe(1)
    expect(totalSinDestinoPrueba(j.estado)).toBe(6)
    expect(j.ofreceCapacidad('filibustero.furia')).toBe(false)
    j.seguir()
    expect(j.registro).toContain('Total 5 contra 4: superas la Prueba.')
  })

  it('también antes de comprometer, en la pausa tras revelar el encuentro', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['filibustero'], mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    expect(j.ofreceCapacidad('filibustero.furia')).toBe(true)
    j.usar('filibustero.furia').comprometer('COM', ['filibustero'])
    expect(totalSinDestinoPrueba(j.estado)).toBe(6)
  })
})

describe('010 · Cañonero', () => {
  it('se agota y prepara un Cañón (fase 10b)', () => {
    const j = Jugador.en({ tripulacion: ['canonero'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.usar('canonero.preparar')
    expect(j.copia('bronce').agotada).toBe(false)
    expect(j.copia('canonero').agotada).toBe(true)
  })

  it('no se ofrece si todos los Cañones están preparados', () => {
    const j = Jugador.en({ tripulacion: ['canonero'], barco: { mejoras: ['bronce'] } })
    expect(j.ofrece('usar', 'canonero.preparar')).toBe(false)
  })
})

describe('011 · Isabela «Cuervo» Saldaña', () => {
  it('se agota y otro Tripulante que iba a quedar derrotado se queda con 1 Vida', () => {
    // El Barco se hunde: cada Tripulante sufre 1 herida. El Bucanero (Vida 2) ya tenía 1. (Es el ejemplo de «Capacidades
    // de las cartas» del reglamento, con el Barco hundido en lugar del tiburón.)
    const j = Jugador.en({ barco: { dano: 5 }, tripulacion: [{ id: 'bucanero', heridas: 1 }, 'isabela'] })
    expect(j.ofreceCapacidad('isabela.salvar')).toBe(true)
    j.usar('isabela.salvar')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.copia('isabela').agotada).toBe(true)
  })

  it('también salva al Capitán: «otro Tripulante»', () => {
    const j = Jugador.en({ barco: { dano: 5 }, capitan: { heridas: 3 }, tripulacion: ['isabela'] })
    j.usar('isabela.salvar')
    expect(j.estado.resultado).toBeNull()
    expect(j.copia('capitan').heridas).toBe(3)
  })
})

describe('012 · Íñigo «Lince» Quintero', () => {
  it('se agota, descarta la carta de Peligro revelada sin resolverla y revela otra', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['bartolome'], mazoPeligros: ['leyenda', 'calma', 'chubasco'] })
    expect(j.registro.some((x) => x.endsWith(': Kraken (Mar).'))).toBe(true)
    j.usar('bartolome.descartar')
    expect(j.zona('descartesPeligros')).toContain('leyenda')
    expect(j.registro.some((x) => x.endsWith(': Mar en calma (Mar).'))).toBe(true)
    expect(j.copia('bartolome').agotada).toBe(true)
    expect(j.estado.mision?.cartasResueltas).toBe(1)
  })
})

describe('013 · Rodrigo «Carnicero» Ortega', () => {
  it('fase 15, quinta ronda: COM 3 y sin límite: no se agota en ninguna Prueba de COM del turno', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['reinaldo'], mazoPeligros: ['fauna', 'chubasco', 'fauna', 'chubasco', 'calma'] })
    expect(DATOS.tripulantes.find((t) => t.id === 'reinaldo')?.COM).toBe(3)
    j.comprometer('COM', ['reinaldo']).seguir()
    expect(j.copia('reinaldo').agotada).toBe(false)
    expect(j.registro).toContain('Rodrigo «Carnicero» Ortega es asignado sin agotarse.')
    j.seguir() // trasEncuentro: siguiente carta
    j.comprometer('COM', ['reinaldo']).seguir()
    expect(j.copia('reinaldo').agotada).toBe(false)
  })

  it('en una Prueba que no es de COM se agota como cualquiera', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['reinaldo'], mazoPeligros: ['chubasco', 'chubasco', 'calma'] })
    j.comprometer('NAV', ['reinaldo'])
    expect(j.copia('reinaldo').agotada).toBe(true)
  })
})

describe('014 · Carpintero de a bordo', () => {
  it('se agota y repara 1; sin daño no se ofrece', () => {
    const j = Jugador.en({ tripulacion: ['carpintero'], barco: { dano: 2 } })
    j.usar('carpintero.reparar')
    expect(j.estado.danoBarco).toBe(1)
    expect(Jugador.en({ tripulacion: ['carpintero'] }).ofrece('usar', 'carpintero.reparar')).toBe(false)
  })
})

describe('015 · Matasanos', () => {
  it('se agota y cura 2 heridas a un Tripulante (eliges a cuál)', () => {
    const j = Jugador.en({ capitan: { heridas: 3 }, tripulacion: ['matasanos', { id: 'bucanero', heridas: 1 }] })
    j.usar('matasanos.curar')
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'curarUno', n: 2 } })
    j.elegir('capitan')
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.copia('bucanero').heridas).toBe(1)
  })
})

describe('016 · Espadachín errante', () => {
  it('+2 COM si es el único que participa; con otro, no (fase 15, quinta ronda: coste 2 y COM 2)', () => {
    const datos = DATOS.tripulantes.find((t) => t.id === 'espadachin')
    expect([datos?.coste, datos?.COM]).toEqual([2, 2])
    // Tiburón tigre (COM 3), Destino «Sin novedad».
    const solo = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['espadachin', 'bucanero'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    solo.comprometer('COM', ['espadachin'])
    expect(totalSinDestinoPrueba(solo.estado)).toBe(2 + 1 + 2)
    const juntos = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['espadachin', 'bucanero'], mazoPeligros: ['bestias', 'chubasco', 'calma'] })
    juntos.comprometer('COM', ['espadachin', 'bucanero'])
    expect(totalSinDestinoPrueba(juntos.estado)).toBe(2 + 1 + (2 + 1))
  })
})

describe('017 · Vigía inexperta', () => {
  it('se agota y otea 1: la carta de arriba del mazo de Peligros va arriba o al fondo', () => {
    const j = Jugador.en({ tripulacion: ['vigia'], mazoPeligros: ['leyenda', 'calma'] })
    j.usar('vigia.otear')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'leyenda' } })
    j.opcion('fondo')
    expect(j.zona('mazoPeligros')).toEqual(['calma', 'leyenda'])
  })
})

describe('018 · Viejo lobo de mar', () => {
  it('si participa, descarta el Destino y revela otro; una vez por turno', () => {
    // Niebla espesa (NAV 3). El Destino «Fallo» se descarta y sale «Sin novedad».
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['viejo_lobo'], mazoPeligros: ['niebla', 'leyenda', 'chubasco', 'calma'] })
    j.comprometer('NAV', ['viejo_lobo'])
    j.usar('viejo_lobo.destino')
    expect(j.registro).toContain('Descartas el Destino de la carta «Bestias de leyenda». Nuevo Destino, de la carta «Chubasco»: 0.')
    expect(j.ofreceCapacidad('viejo_lobo.destino')).toBe(false)
    j.seguir()
    expect(j.registro.some((t) => t.includes('superas la Prueba'))).toBe(true)
  })
})

describe('019 · Rastreador de la selva', () => {
  it('si superas una Prueba de EXP en la que participa, ganas 1 de Avance', () => {
    // «Cobrar la deuda» (Ciudad): Un soplo en la taberna (EXP 2).
    const j = Jugador.enMision({ tripulacion: ['baqueano'], mazoPeligros: ['encrucijada', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['baqueano']).seguir().usar('baqueano.superar')
    expect(j.registro).toContain('Rastreador de la selva: +1 de Avance (1/3).')
  })
})

describe('020 · Loro parlanchín', () => {
  it('tras revelarse el Destino se agota (coste) y se asigna a la Prueba', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: ['loro', 'bucanero'], mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['bucanero'])
    j.usar('loro.unirse')
    expect(j.estado.prueba?.comprometidos).toContain(j.inst('loro'))
    expect(j.copia('loro').agotada).toBe(true)
    // Bucanero EXP 0 + 1 (Diego preparado) y el Loro EXP 1 + 1.
    expect(totalSinDestinoPrueba(j.estado)).toBe(3)
  })

  it('fase 15, quinta ronda: COM 1; se agota como coste, así que Aguerrido no le ahorra agotarse', () => {
    expect(DATOS.tripulantes.find((t) => t.id === 'loro')?.COM).toBe(1)
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: [{ id: 'loro', estados: ['aguerrido'] }, 'bucanero'], mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['bucanero'])
    j.usar('loro.unirse')
    expect(j.estado.prueba?.comprometidos).toContain(j.inst('loro'))
    expect(j.copia('loro').agotada).toBe(true)
    expect(j.estados('loro')).toEqual(['aguerrido'])
  })

  it('agotado, no se ofrece', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], tripulacion: [{ id: 'loro', agotada: true }, 'bucanero'], mazoPeligros: ['niebla', 'chubasco', 'calma'] })
    j.comprometer('EXP', ['bucanero'])
    expect(j.ofreceCapacidad('loro.unirse')).toBe(false)
  })
})
