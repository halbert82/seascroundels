// Misiones 2.0: las cartas de los mazos propios (Templo y Escolta) con el formato de los Peligros 2.0, y el encuentro
// de Mar rehecho de «La Armada te persigue». Se prueban en misiones de prueba del Entorno de su mazo.

import { describe, expect, it } from 'vitest'

import { Jugador, type OpcionesSituacion, dificultadConDestino, totalSinDestinoPrueba } from './pruebas/situacion.ts'
import type { CartaId } from './tipos.ts'

/** El Templo es de Naturaleza; la Escolta, de Mar. */
function en(entorno: 'nat' | 'mar' | 'ciu', mazoPeligros: CartaId[], op: OpcionesSituacion = {}): Jugador {
  const mision = { nat: 'pruebas-nat3', mar: 'pruebas-mar5', ciu: 'pruebas-ciu4' }[entorno]
  return Jugador.enMision({ misiones: [mision], mazoPeligros, ...op })
}

/** Resuelve la Prueba: pasa las Interrupciones y Respuestas y, si «Ánimo» deja preparar a alguien, al primero. */
function resolver(j: Jugador): Jugador {
  j.pasarOfertas().seguir().pasarOfertas()
  if (j.decision.motivo.clave === 'preparar' && j.decision.tipo === 'elegirCartas') j.responder({ tipo: 'cartas', ids: j.decision.candidatas.slice(0, 1) })
  return j.pasarOfertas()
}

const robas = (j: Jugador, n: number) => j.registro.some((r) => r.startsWith(`Robas ${n}:`))

describe('122 · Guerreros esqueleto', () => {
  it('COM 4: si superas, esta carta Se retira; si fallas, 2 heridas repartidas entre los comprometidos', () => {
    const j = en('nat', ['esqueleto', 'calma', 'calma'], { tripulacion: ['reinaldo'] })
    j.comprometer('COM', ['capitan', 'reinaldo']).seguir()
    expect(j.zona('fueraDeJuego')).toContain('esqueleto')
    const k = en('nat', ['esqueleto', 'calma', 'calma'])
    k.comprometer('COM', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(2)
  })

  it('Destino «Huesos que se levantan»: si fallas, la carta vuelve encima del mazo; Sin oposición, 1 herida', () => {
    const j = en('nat', ['fauna', 'esqueleto', 'calma'])
    j.comprometer('EXP').seguir() // Serpientes sin nadie: 1 herida del fallo y 1 de Sin oposición
    expect(j.registro).toContain('«Guerreros esqueleto» vuelven a levantarse: la carta va encima del mazo del Templo.')
    expect(j.zona('mazoPeligros')[0]).toBe('esqueleto')
    expect(j.copia('capitan').heridas).toBe(2)
  })
})

describe('123 · Trampa de dardos', () => {
  it('EXP 3 (2 con un Explorador): si superas, 1 munición; si fallas, el comprometido con menos EXP queda Envenenado', () => {
    const j = en('nat', ['dardos', 'calma', 'calma'], { tripulacion: ['baqueano'], barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    j.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir().pasarOfertas()
    expect(j.copia('bronce').municion).toBe(1)
    const k = en('nat', ['dardos', 'calma', 'calma'])
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').estados).toContain('envenenado')
  })

  it('Destino «Dardos desde el techo»: el comprometido con la habilidad más baja sufre 1 herida', () => {
    const j = en('nat', ['fauna', 'dardos', 'calma'], { tripulacion: ['baqueano'] })
    j.comprometer('EXP', ['capitan', 'baqueano'])
    expect(j.copia('capitan').heridas).toBe(1)
  })
})

describe('124 · Ídolo maldito', () => {
  it('Elige: lo dejas (pierdes 1 Avance) o lo coges (EXP 4: si fallas, el comprometido con más EXP queda Maldito)', () => {
    const deja = en('nat', ['idolo', 'calma', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    expect(deja.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige', carta: 'idolo' } })
    deja.opcion('0')
    expect(deja.registro).toContain('Pierdes 1 de Avance.')
    expect(deja.registro).toContain('Ganas 1 de Avance (1/3).')
    const coge = en('nat', ['idolo', 'calma', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    coge.opcion('1').comprometer('EXP', ['capitan']).seguir()
    expect(coge.copia('capitan').estados).toContain('maldito')
  })

  it('si lo coges y superas, robas 3', () => {
    const j = en('nat', ['idolo', 'calma', 'calma'], { tripulacion: ['baqueano', 'herbolaria'] })
    j.comprometer('EXP', ['baqueano', 'herbolaria']).seguir().pasarOfertas()
    expect(robas(j, 3)).toBe(true)
  })
})

describe('125 · Pasadizo secreto', () => {
  it('sin Prueba: miras las 3 de arriba del mazo y pones 1 al fondo; Destino −1 (+0 sin oposición)', () => {
    const j = en('nat', ['pasadizo', 'calma', 'fauna', 'chubasco'])
    expect(j.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'alFondo', n: 1 } })
    j.elegir('fauna').elegir('calma', 'chubasco') // las otras dos, en el orden que quieras
    expect(j.zona('mazoPeligros').at(-1)).toBe('fauna')
    const k = en('nat', ['fauna', 'pasadizo', 'calma'])
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(1)
  })
})

describe('223 · La losa giratoria', () => {
  it('se queda en juego; el preparado con más EXP no puede comprometerse; se quita agotando a 2 Tripulantes', () => {
    const j = en('nat', ['losa', 'calma', 'calma'], { tripulacion: ['baqueano', 'viejo_lobo'] })
    expect(j.zona('peligrosEnJuego')).toEqual(['losa'])
    expect(j.estado.temporales.some((t) => t.clave === 'noCompromete' && t.inst === j.inst('baqueano'))).toBe(true)
    expect(j.avance('pruebas-nat3')).toBe(1)
    j.usar('losa.unico.accion0').elegir('capitan', 'viejo_lobo')
    expect(j.zona('peligrosEnJuego')).toEqual([])
    expect(j.estado.temporales.some((t) => t.clave === 'noCompromete')).toBe(false)
  })
})

describe('224 · El guardián de jade', () => {
  it('COM 6, −2 con un Escapulario; las Mejoras no suman; si superas, +1 Avance y robas 2', () => {
    const j = en('nat', ['guardian', 'calma', 'calma'], { capitan: { mejoras: ['escapulario', 'sable'] }, tripulacion: ['reinaldo'] })
    j.comprometer('COM', ['capitan', 'reinaldo'])
    expect(dificultadConDestino(j.estado)).toBe(4)
    expect(totalSinDestinoPrueba(j.estado)).toBe(7) // 3 + 4, sin el Sable
    resolver(j)
    expect(robas(j, 2)).toBe(true)
    expect(j.registro).toContain('Ganas 3 de Avance (4/3).')
  })

  it('si fallas, 1 herida por cada punto que falte (máximo 3), repartidas como quieras entre tus Tripulantes (fase 10)', () => {
    const j = en('nat', ['guardian', 'calma', 'calma'], { tripulacion: ['reinaldo'] })
    j.comprometer('COM', ['capitan']).seguir() // 3 contra 6
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 3 })
    j.repartir({ capitan: 3 })
    expect(j.copia('capitan').heridas).toBe(3)
  })
})

describe('130 · Galeón de la plata', () => {
  it('antes de comprometer puedes gastar 1 munición: −2; si superas, robas 2 y ganas 1 munición', () => {
    const j = en('mar', ['galeon', 'calma', 'calma'], { barco: { mejoras: [{ id: 'bronce', municion: 1 }] } })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige', carta: 'galeon' } })
    j.opcion('0').comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(robas(j, 2)).toBe(true)
    expect(j.copia('bronce').municion).toBe(1)
  })

  it('sin munición no se pregunta; Abordaje: sin nadie, te faltan 5 → 3 heridas', () => {
    const j = en('mar', ['galeon', 'calma', 'calma'])
    expect(j.decision.tipo).toBe('comprometer')
    j.comprometer('COM').seguir()
    expect(j.copia('capitan').heridas).toBe(3)
  })
})

describe('131 · Navío de escolta', () => {
  it('NAV 5: si superas, el siguiente encuentro #Barco# recibe −1; si fallas, 2 daños', () => {
    const j = en('mar', ['escolta', 'calma', 'oportunidad', 'calma'], { tripulacion: ['viejo_lobo'] })
    resolver(j.comprometer('NAV', ['capitan', 'viejo_lobo'])).seguir()
    j.comprometer('NAV', [j.copia('capitan').agotada ? 'viejo_lobo' : 'capitan'])
    expect(dificultadConDestino(j.estado)).toBe(2) // Navío a la deriva (Barco): NAV 3 − 1
    const k = en('mar', ['escolta', 'calma', 'calma'])
    k.comprometer('NAV').seguir()
    expect(k.estado.danoBarco).toBe(2)
  })

  it('Destino «Señales entre los mástiles»: +2 si el encuentro es #Barco#; Sin oposición, el Barco queda Perseguido', () => {
    const j = en('mar', ['oportunidad', 'escolta', 'calma'])
    j.comprometer('NAV')
    expect(j.estadosBarco).toContain('perseguido')
    const k = en('mar', ['oportunidad', 'escolta', 'calma'])
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(5)
  })
})

describe('132 · Fuego de cobertura', () => {
  it('se queda en juego: los Cañones no suman; Acción: Prueba de NAV 3 para descartarla', () => {
    const j = en('mar', ['cobertura', 'calma', 'calma'])
    expect(j.zona('peligrosEnJuego')).toEqual(['cobertura'])
    expect(j.valor({ tipo: 'sinCanones' })).toBeGreaterThan(0)
    j.usar('cobertura.unico.quitar0').comprometer('NAV', ['capitan']).seguir()
    expect(j.zona('peligrosEnJuego')).toEqual([])
  })
})

describe('133 · Marineros del galeón hundido', () => {
  it('NAV 2: si superas, reclutas gratis un Tripulante de coste 2 o menos (sin Capacidad, robas 1); si fallas, agotas 1', () => {
    const j = en('mar', ['naufragos_g', 'calma', 'calma'], { muelle: ['bucanero'] })
    j.comprometer('NAV', ['capitan']).seguir().elegir('bucanero')
    expect(j.zona('tripulacion')).toContain('bucanero')
    const lleno = en('mar', ['naufragos_g', 'calma', 'calma'], { muelle: ['bucanero'], tripulacion: ['grumete', 'marinero_p', 'saqueador', 'canonero'] })
    lleno.comprometer('NAV', ['capitan']).seguir()
    expect(robas(lleno, 1)).toBe(true)
  })
})

describe('134 · Mar gruesa', () => {
  it('NAV 3: si superas, +1 Avance; si fallas, 1 daño y 1 herida', () => {
    const j = en('mar', ['margruesa', 'calma', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(j.registro).toContain('Ganas 2 de Avance (3/5).')
    const k = en('mar', ['margruesa', 'calma', 'calma'])
    k.comprometer('NAV').seguir()
    expect([k.estado.danoBarco, k.copia('capitan').heridas]).toEqual([1, 1])
  })
})

describe('225 · Cofres por la borda', () => {
  it('Elige: os paráis a recoger la plata (robas 3 y pierdes 1 Avance) o seguís tras él (NAV 4: si superas, +2 Avance)', () => {
    const recoge = en('mar', ['cofres', 'calma', 'calma'], { avance: { 'pruebas-mar5': 1 } })
    recoge.opcion('0')
    expect(robas(recoge, 3)).toBe(true)
    expect(recoge.registro).toContain('Ganas 2 de Avance (2/5).')
    const sigue = en('mar', ['cofres', 'calma', 'calma'], { tripulacion: ['viejo_lobo'], avance: { 'pruebas-mar5': 1 } })
    resolver(sigue.opcion('1').comprometer('NAV', ['capitan', 'viejo_lobo']))
    expect(sigue.registro).toContain('Ganas 2 de Avance (5/5).')
  })

  it('Destino «El brillo de la plata»: si superas, robas 1; Sin oposición, descartas 1', () => {
    const j = en('mar', ['chubasco', 'cofres', 'calma'])
    j.comprometer('NAV', ['capitan']).seguir()
    expect(robas(j, 1)).toBe(true)
  })
})

describe('095 · La Armada te persigue (rehecha, P51)', () => {
  it('Mar · Navío de línea: NAV 5 y los Cañones no suman; si superas, +1 Avance y la carta se queda en el mazo', () => {
    const j = en('mar', ['armada', 'calma', 'calma'], { tripulacion: ['viejo_lobo'], barco: { mejoras: [{ id: 'bronce', municion: 1 }] } })
    expect(j.registro).toContain('Revelas «La Armada te persigue»: Navío de línea de la Armada (Mar).')
    resolver(j.comprometer('NAV', ['capitan', 'viejo_lobo']))
    expect(j.registro).toContain('La Armada te persigue: +1 de Avance (1/5).')
    expect(j.zona('descartesPeligros')).toContain('armada')
    expect(j.zona('fueraDeJuego')).not.toContain('armada')
  })

  it('Mar · Abordaje: sin nadie comprometido, te faltan 5 → 3 heridas', () => {
    const k = en('mar', ['armada', 'calma', 'calma'])
    k.comprometer('NAV').seguir()
    expect(k.copia('capitan').heridas).toBe(3)
    expect(k.zona('descartesPeligros')).toContain('armada')
  })

  it('Naturaleza · Desembarco de casacas: EXP 4; si superas, +1 munición; si fallas, 2 heridas y el Barco Perseguido', () => {
    const j = en('nat', ['armada', 'calma', 'calma'], { tripulacion: ['baqueano', 'herbolaria'], barco: { mejoras: [{ id: 'bronce', municion: 0 }] } })
    resolver(j.comprometer('EXP', ['baqueano', 'herbolaria']))
    expect(j.copia('bronce').municion).toBe(1)
    const k = en('nat', ['armada', 'calma', 'calma'])
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').heridas).toBe(2)
    expect(k.estadosBarco).toContain('perseguido')
  })

  it('Ciudad · Registro casa por casa: EXP 4; si superas, +1 Avance; si fallas, el comprometido con más EXP queda rehén', () => {
    const j = en('ciu', ['armada', 'calma', 'calma'], { tripulacion: ['baqueano', 'herbolaria'] })
    resolver(j.comprometer('EXP', ['baqueano', 'herbolaria']))
    expect(j.registro).toContain('La Armada te persigue: +1 de Avance (1/4).')
    const k = en('ciu', ['armada', 'calma', 'calma'], { tripulacion: ['vigia'] })
    k.comprometer('EXP', ['capitan', 'vigia']).seguir()
    expect(k.zona('rehenes')).toEqual(['vigia'])
  })

  it('Destino «Velas en el horizonte»: +2 si el encuentro es #Militar# o #Guardia#; Sin oposición, el Barco queda Perseguido', () => {
    const j = en('ciu', ['ley', 'armada', 'calma'])
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(5) // Ronda de la guardia: COM 3 + 2
    const k = en('ciu', ['ley', 'armada', 'calma'])
    k.comprometer('COM')
    expect(k.estadosBarco).toContain('perseguido')
  })
})
