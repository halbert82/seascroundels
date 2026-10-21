// Una prueba (al menos) por cada Mejora de barco, Mejora de tripulante y Tesoro.

import { describe, expect, it } from 'vitest'

import { Jugador, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'

describe('Mejoras de barco', () => {
  it('021 · Casco reforzado: +1 al daño máximo', () => {
    expect(Jugador.en({ barco: { mejoras: ['casco'] } }).valor({ tipo: 'danoMaximo' })).toBe(6)
  })

  it('022 · Vela mayor: +1 de Avance al zarpar hacia una misión de Mar; en tierra, no', () => {
    const mar = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['vela'] }, mazoPeligros: ['calma', 'calma', 'calma'] })
    expect(mar.registro).toContain('Vela mayor: +1 de Avance (1/3).')
    const tierra = Jugador.enMision({ barco: { mejoras: ['vela'] }, mazoPeligros: ['calma', 'calma', 'calma'] })
    expect(tierra.registro.some((t) => t.startsWith('Vela mayor'))).toBe(false)
  })

  it('023 · Hamacas en el entrepuente: +1 a la Capacidad', () => {
    expect(Jugador.en({ barco: { mejoras: ['hamacas'] } }).valor({ tipo: 'capacidad' })).toBe(5)
  })

  it('024 · Bandera negra: +1 a las Pruebas de COM en el Mar; en tierra, no', () => {
    const mar = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['bandera'] }, mazoPeligros: ['fauna', 'chubasco', 'calma'] })
    mar.comprometer('COM', ['capitan'])
    expect(totalSinDestinoPrueba(mar.estado)).toBe(3 + 1)
    const tierra = Jugador.enMision({ barco: { mejoras: ['bandera'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    tierra.comprometer('COM', ['capitan'])
    expect(totalSinDestinoPrueba(tierra.estado)).toBe(3)
  })

  it('025 · Chalupa: +1 de Avance al zarpar hacia una misión de Naturaleza o Ciudad', () => {
    const j = Jugador.enMision({ barco: { mejoras: ['chalupa'] }, mazoPeligros: ['calma', 'calma', 'calma'] })
    expect(j.registro).toContain('Chalupa: +1 de Avance (1/3).')
  })

  it('026 · Botica de a bordo: descartas 1 carta y curas 1 herida; dos veces por turno', () => {
    const j = Jugador.en({ capitan: { heridas: 3 }, barco: { mejoras: ['botica'] }, mano: ['ojo', 'timon', 'coraje'] })
    j.usar('botica.curar').elegir('ojo')
    j.usar('botica.curar').elegir('timon')
    expect(j.copia('capitan').heridas).toBe(1)
    expect(j.ofrece('usar', 'botica.curar')).toBe(false)
  })

  it('027 · Víveres de reserva: se descarta y prepara a todos tus Tripulantes', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', agotada: true }], capitan: { agotada: true }, barco: { mejoras: ['viveres'] } })
    j.usar('viveres.preparar')
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('capitan').agotada).toBe(false)
    expect(j.zona('descartesMuelle')).toContain('viveres')
  })

  it('028 · La Cruz de Santa Bárbara: más de 2 daños a la vez se quedan en 2; es indestructible', () => {
    // Arrecife de los Ahorcados (fallo: 3 daños) con el Destino «Fallo».
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['cruz'] }, mazoPeligros: ['arrecifes', 'leyenda', 'calma'] })
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.estado.danoBarco).toBe(2)
    expect(j.registro).toContain('La Cruz de Santa Bárbara deja el daño en 2.')
    const hundido = Jugador.en({ barco: { dano: 5, mejoras: ['cruz', 'vela'] } })
    expect(hundido.zona('mejoras')).toEqual(['cruz'])
  })

  it('029 · Cañones de bronce (fase 10b): se agotan y la Prueba de COM recibe +2; con «Los Cañones no suman», nada', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['bronce'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('bronce.disparar')
    expect(totalSinDestinoPrueba(j.estado)).toBe(5)
    expect(j.copia('bronce').agotada).toBe(true)
    expect(j.ofreceCapacidad('bronce.disparar')).toBe(false)
    const niebla = Jugador.enMision({ misiones: ['fantasma-I'], barco: { mejoras: ['bronce'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    niebla.comprometer('COM', ['capitan']).usar('bronce.disparar')
    expect(totalSinDestinoPrueba(niebla.estado)).toBe(3)
    // Agotados no disparan.
    const agotados = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: [{ id: 'bronce', agotada: true }] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    agotados.comprometer('COM', ['capitan'])
    expect(agotados.ofreceCapacidad('bronce.disparar')).toBe(false)
  })

  it('030 · Carronadas: antes de asignar, se agotan y superas una Prueba de COM de dificultad 4 o menos sin revelar Destino', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['carronadas'] }, mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.usar('carronadas.disparar')
    expect(j.registro).toContain('Superas automáticamente la Prueba de COM, sin revelar Destino.')
    expect(j.registro.some((t) => t.startsWith('Destino:'))).toBe(false)
    expect(j.zona('mazoPeligros')[0]).toBe('leyenda')
    expect(j.copia('carronadas').agotada).toBe(true)
    // Fragata cazadora (COM 5): no se puede.
    const fragata = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['carronadas'] }, mazoPeligros: ['cazadores', 'chubasco', 'calma'] })
    expect(fragata.ofreceCapacidad('carronadas.disparar')).toBe(false)
  })

  it('031 · Culebrina de proa: se agota y una Prueba de NAV en el Mar recibe +2', () => {
    // Niebla espesa (NAV 3) con el Destino de «Fauna» (−1). Diego 2 + 1 (Barco) = 3; con la Culebrina, 5; con el Destino, 4.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['culebrina'] }, mazoPeligros: ['niebla', 'fauna', 'calma'] })
    j.comprometer('NAV', ['capitan']).usar('culebrina.disparar').seguir()
    expect(j.registro).toContain('Total 4 contra 3: superas la Prueba.')
  })

  it('032 · Pedrero de borda: se agota y descartas una carta de Peligro con Prueba de COM; solo en el Mar, porque la carta lo dice', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['pedrero'] }, mazoPeligros: ['rivales', 'calma', 'calma'] })
    j.usar('pedrero.disparar')
    expect(j.zona('descartesPeligros')).toContain('rivales')
    expect(j.copia('pedrero').agotada).toBe(true)
    // En «Cobrar la deuda» (Ciudad), la Pelea de taberna (COM 3) no se puede descartar con el Pedrero: dice «[mar], [agotar]».
    const tierra = Jugador.enMision({ barco: { mejoras: ['pedrero'] }, mazoPeligros: ['rivales', 'calma', 'calma'] })
    expect(tierra.ofreceCapacidad('pedrero.disparar')).toBe(false)
  })

  it('033 · Velas de tormenta: se agotan y descartan una carta de Peligro con Prueba de NAV', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['velas_tormenta'] }, mazoPeligros: ['chubasco', 'calma', 'calma'] })
    j.usar('velas_tormenta.esquivar')
    expect(j.zona('descartesPeligros')).toContain('chubasco')
    expect(j.copia('velas_tormenta').agotada).toBe(true)
    const com = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['velas_tormenta'] }, mazoPeligros: ['fauna', 'calma', 'calma'] })
    expect(com.ofreceCapacidad('velas_tormenta.esquivar')).toBe(false)
  })
})

describe('Mejoras de tripulante', () => {
  it('034, 035, 036 · Sable (+1 COM), Brújula (+1 NAV) y Catalejo (+1 EXP) a su portador', () => {
    const j = Jugador.en({ capitan: { mejoras: ['sable', 'brujula', 'catalejo'] } })
    const diego = j.estado.capitan
    expect(j.valor({ tipo: 'habilidad', carta: diego, hab: 'COM' })).toBe(4)
    expect(j.valor({ tipo: 'habilidad', carta: diego, hab: 'NAV' })).toBe(3)
    expect(j.valor({ tipo: 'habilidad', carta: diego, hab: 'EXP' })).toBe(2)
  })

  it('037 · Pistola de chispa: se agota y da +2 a una Prueba de COM en la que participa su portador', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], capitan: { mejoras: ['pistola'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('pistola.disparar').seguir()
    expect(j.registro).toContain('Total 5 contra 4: superas la Prueba.')
    expect(j.copia('pistola').agotada).toBe(true)
  })

  it('038 · Escapulario del Carmen: se agota y cancela el Destino de una Prueba en la que participa su portador', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], capitan: { mejoras: ['escapulario'] }, mazoPeligros: ['fauna', 'leyenda', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('escapulario.cancelar').pasarOfertas().seguir()
    expect(j.registro).toContain('Cancelas el Destino de la carta «Bestias de leyenda»: no se aplica nada de él.')
    expect(j.registro).toContain('Total 3 contra 2: superas la Prueba.')
  })

  it('039 · Amuleto vudú: se descarta y su portador, que iba a quedar derrotado, se queda con 1 Vida', () => {
    const j = Jugador.en({ barco: { dano: 5 }, tripulacion: [{ id: 'bucanero', heridas: 1, mejoras: ['amuleto'] }] })
    j.usar('amuleto.salvar')
    expect(j.zona('tripulacion')).toContain('bucanero')
    expect(j.copia('bucanero').heridas).toBe(1)
    expect(j.zona('descartesMuelle')).toContain('amuleto')
  })

  it('040 · Ron de la reserva: se descarta, prepara a su portador y le cura 1', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', heridas: 1, agotada: true, mejoras: ['ron_reserva'] }] })
    j.usar('ron_reserva.beber')
    expect(j.copia('bucanero').agotada).toBe(false)
    expect(j.copia('bucanero').heridas).toBe(0)
    expect(j.zona('descartesMuelle')).toContain('ron_reserva')
  })

  it('041 · Patente de corso: solo la lleva el Capitán; −1 a la dificultad de los encuentros Militar y Guardia', () => {
    const tienda = Jugador.en({ tripulacion: ['bucanero'], mano: ['ojo', 'timon'], muelle: ['patente'] })
    expect(tienda.ofrece('adquirir', 'patente', 'capitan')).toBe(true)
    expect(tienda.ofrece('adquirir', 'patente', 'bucanero')).toBe(false)
    // Patrulla española (Militar, COM 4): pide 3.
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], capitan: { mejoras: ['patente'] }, mazoPeligros: ['ley', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
  })

  it('042 · Coleto de cuero: +1 a la Vida del portador', () => {
    const j = Jugador.en({ tripulacion: [{ id: 'bucanero', mejoras: ['coleto'] }] })
    expect(j.valor({ tipo: 'vida', carta: j.inst('bucanero') })).toBe(3)
  })
})

describe('Tesoros', () => {
  it('121 · Espada del sacerdote: +2 COM y cancela el Destino de una Prueba de COM de su portador, una vez por misión', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], capitan: { mejoras: ['espada'] }, mazoPeligros: ['fauna', 'leyenda', 'fauna', 'leyenda', 'calma'] })
    expect(j.valor({ tipo: 'habilidad', carta: j.estado.capitan, hab: 'COM' })).toBe(5)
    j.comprometer('COM', ['capitan']).usar('espada.cancelar').seguir()
    expect(j.registro).toContain('Total 5 contra 2: superas la Prueba.')
    j.copia('capitan').agotada = false // para la segunda Prueba de la misión
    j.seguir().comprometer('COM', ['capitan'])
    expect(j.ofreceCapacidad('espada.cancelar')).toBe(false)
  })

  it('129 · Mascarón del galeón: +1 al daño máximo y evita el daño al Barco una vez por misión', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['mascaron'] }, mazoPeligros: ['arrecifes', 'leyenda', 'calma'] })
    expect(j.valor({ tipo: 'danoMaximo' })).toBe(6)
    j.comprometer('NAV', ['capitan']).seguir().usar('mascaron.evitar')
    expect(j.estado.danoBarco).toBe(0)
  })

  it('138 · Los despachos del Rey: al zarpar, oteas 2 del mazo de Peligros (P4, fase 10b: sin preguntar si se usa)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['despachos'] }, mazoPeligros: ['leyenda', 'cazadores', 'calma', 'calma'] })
    j.opcion('fondo').opcion('fondo')
    expect(j.zona('mazoPeligros').slice(-2)).toEqual(['leyenda', 'cazadores'])
    expect(j.zona('descartesPeligros')).toEqual(['calma']) // la primera carta revelada ya es el Mar en calma
  })

  it('142 · Mapa de las calas: tus misiones de Naturaleza necesitan 1 de Avance menos', () => {
    const j = Jugador.en({ barco: { mejoras: ['mapa_calas'] }, misiones: ['aguada-I', 'deuda-I'] })
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('aguada-I') })).toBe(2)
    expect(j.valor({ tipo: 'avanceNecesario', mision: j.inst('deuda-I') })).toBe(3)
  })

  it('146 · Pólvora del Rey (fase 10b): después de agotar un Cañón en una Prueba de COM, quitas 1 ficha y la Prueba recibe +2 más', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: [{ id: 'polvora_rey', fichas: 3 }, 'bronce'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('bronce.disparar').usar('polvora_rey.disparo')
    expect(totalSinDestinoPrueba(j.estado)).toBe(7) // Diego 3 + 2 de los Cañones + 2 de la Pólvora
    expect(j.copia('polvora_rey').fichas).toBe(2)
    // Con la última ficha, la carta se descarta (vuelve al mazo de historia). En una Prueba de NAV no se ofrece.
    const k = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: [{ id: 'polvora_rey', fichas: 1 }, 'bronce'] }, mazoPeligros: ['rivales', 'chubasco', 'calma'] })
    k.comprometer('COM', ['capitan']).usar('bronce.disparar').usar('polvora_rey.disparo')
    expect(k.zonaDe('polvora_rey')).toBe('mazoHistoria')
    const m = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: [{ id: 'polvora_rey', fichas: 3 }, 'culebrina'] }, mazoPeligros: ['niebla', 'fauna', 'calma'] })
    m.comprometer('NAV', ['capitan']).usar('culebrina.disparar')
    expect(m.decision.tipo).not.toBe('ofrecer')
  })

  it('150 · Farol de los ahogados: descarta un Destino y revela otro, una vez por misión', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar3'], barco: { mejoras: ['farol'] }, mazoPeligros: ['fauna', 'leyenda', 'chubasco', 'calma'] })
    j.comprometer('COM', ['capitan']).usar('farol.destino')
    expect(j.registro).toContain('Descartas el Destino de la carta «Bestias de leyenda». Nuevo Destino, de la carta «Chubasco»: 0.')
    expect(j.ofreceCapacidad('farol.destino')).toBe(false)
  })
})
