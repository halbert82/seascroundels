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
  it('COM 4: si superas, esta carta Se retira; si fallas, Inflige 2 heridas, libres (fase 13)', () => {
    const j = en('nat', ['esqueleto', 'calma', 'calma'], { tripulacion: ['reinaldo'] })
    j.comprometer('COM', ['capitan', 'reinaldo']).seguir()
    expect(j.zona('fueraDeJuego')).toContain('esqueleto')
    // Las 2 heridas del fallo van a quien quiera el jugador: también al Carpintero, que no fue asignado.
    const k = en('nat', ['esqueleto', 'calma', 'calma'], { tripulacion: ['carpintero'] })
    k.comprometer('COM', ['capitan']).seguir().repartir({ capitan: 1, carpintero: 1 })
    expect(k.copia('capitan').heridas).toBe(1)
    expect(k.copia('carpintero').heridas).toBe(1)
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
  it('EXP 3 (Explorador −1): si superas, preparas un Cañón; si fallas, el comprometido con menos EXP queda Envenenado', () => {
    const j = en('nat', ['dardos', 'calma', 'calma'], { tripulacion: ['baqueano'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    j.comprometer('EXP', ['baqueano'])
    expect(dificultadConDestino(j.estado)).toBe(2)
    j.seguir().pasarOfertas()
    expect(j.copia('bronce').agotada).toBe(false)
    const k = en('nat', ['dardos', 'calma', 'calma'])
    k.comprometer('EXP', ['capitan']).seguir()
    expect(k.copia('capitan').estados).toContain('envenenado')
  })

  it('Destino «Dardos desde el techo»: inflige 1 herida a un Tripulante asignado, el que elijas (fase 13, I1: antes, al de la habilidad más baja); sin nadie asignado, solo su Sin oposición (P83)', () => {
    const j = en('nat', ['chubasco', 'dardos', 'calma'], { tripulacion: ['carpintero'] })
    j.comprometer('EXP', ['capitan', 'carpintero'])
    expect(j.decision).toMatchObject({ tipo: 'repartir', cantidad: 1 })
    j.repartir({ carpintero: 1 }) // el Carpintero, aunque el Capitán tenga menos EXP
    expect([j.copia('capitan').heridas, j.copia('carpintero').heridas]).toEqual([0, 1])
    // P83: sin nadie asignado, la herida «a un Tripulante asignado» no se aplica; solo la del Sin oposición, a quien elijas.
    const k = en('nat', ['chubasco', 'dardos', 'calma'], { tripulacion: ['carpintero'] })
    k.comprometer('EXP', [])
    expect(k.registro).toContain('No hay nadie asignado: lo que el Destino le hace a un Tripulante asignado no se aplica.')
    expect(k.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: 1 } })
    k.elegir('carpintero')
    expect(k.estado.pendiente?.tipo === 'elegirCartas' && k.decision.motivo.clave === 'herir').toBe(false)
    expect([k.copia('capitan').heridas, k.copia('carpintero').heridas]).toEqual([0, 1])
  })
})

describe('124 · Ídolo maldito', () => {
  it('Elige: lo dejas (pierdes 1 Avance) o lo coges (EXP 4: si fallas, el comprometido con más EXP queda Maldito)', () => {
    const deja = en('nat', ['idolo', 'calma', 'calma'], { avance: { 'pruebas-nat3': 1 } })
    expect(deja.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige', carta: 'idolo' } })
    deja.opcion('0')
    expect(deja.registro).toContain('Pierdes 1 de Avance.')
    expect(deja.registro).toContain('Ganas 3 de Avance (3/3).') // pagar cuenta como superar: X (fase 10b: 3 / 1)
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
  it('sin Prueba: Otea 3 (fase 13, I7: cada una arriba o al fondo, antes solo 1 al fondo); Destino −1 (+0 sin oposición)', () => {
    const j = en('nat', ['pasadizo', 'calma', 'fauna', 'chubasco', 'escollos'])
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear', carta: 'calma' } })
    j.opcion('fondo').opcion('fondo').opcion('arriba') // dos al fondo: ya no hay que dejar dos arriba
    expect(j.zona('mazoPeligros')).toEqual(['chubasco', 'escollos', 'calma', 'fauna'])
    const k = en('nat', ['fauna', 'pasadizo', 'calma'])
    k.comprometer('EXP', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(1)
  })
})

describe('223 · La losa giratoria', () => {
  it('pone en juego la permanente 236 junto al preparado con más EXP, que no puede ser asignado; se quita agotando a 2 Tripulantes', () => {
    const j = en('nat', ['losa', 'calma', 'calma'], { tripulacion: ['baqueano', 'viejo_lobo'] })
    expect(j.zona('permanentes')).toEqual(['pm_losa'])
    expect(j.estado.temporales.some((t) => t.clave === 'noCompromete' && t.inst === j.inst('baqueano'))).toBe(true)
    expect(j.avance('pruebas-nat3')).toBe(2)
    j.usar('pm_losa.accion0').elegir('capitan', 'viejo_lobo')
    expect(j.zona('permanentes')).toEqual([])
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
  it('antes de comprometer puedes agotar un Cañón: −2; si superas, robas 2 y preparas un Cañón', () => {
    const j = en('mar', ['galeon', 'calma', 'calma'], { barco: { mejoras: ['bronce'] } })
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'elige', carta: 'galeon' } })
    j.opcion('0').comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3)
    j.seguir()
    expect(robas(j, 2)).toBe(true)
    expect(j.copia('bronce').agotada).toBe(false)
  })

  it('sin Cañones preparados no se pregunta; Abordaje: sin nadie, te faltan 5 → 3 heridas', () => {
    const j = en('mar', ['galeon', 'calma', 'calma'])
    expect(j.decision.tipo).toBe('comprometer')
    j.comprometer('COM').seguir()
    expect(j.copia('capitan').heridas).toBe(3)
  })
})

describe('131 · Navío de escolta', () => {
  it('NAV 5: si superas, +1 Avance (fase 13, I2: antes, el siguiente encuentro #Barco# −1); si fallas, 2 daños', () => {
    const j = en('mar', ['escolta', 'calma', 'oportunidad', 'calma'], { tripulacion: ['viejo_lobo'] })
    resolver(j.comprometer('NAV', ['capitan', 'viejo_lobo']))
    expect(j.registro).toContain('Navío de escolta: +1 de Avance (1/5).')
    expect(j.registro).toContain('Ganas 3 de Avance (4/5).') // y los 3 del encuentro (3 / 2)
    j.seguir()
    j.comprometer('NAV', [j.copia('capitan').agotada ? 'viejo_lobo' : 'capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // Navío a la deriva (Barco): NAV 3, ya sin −1
    const k = en('mar', ['escolta', 'calma', 'calma'])
    k.comprometer('NAV').seguir()
    expect(k.estado.danoBarco).toBe(2)
  })

  it('Destino «Señales entre los mástiles»: −1 en cualquier encuentro (fase 13, I1: fuera el −2 con #Barco#); Sin oposición, el Barco queda Perseguido', () => {
    const j = en('mar', ['oportunidad', 'escolta', 'calma'])
    j.comprometer('NAV')
    expect(j.estadosBarco).toContain('perseguido')
    const k = en('mar', ['oportunidad', 'escolta', 'calma'])
    k.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(k.estado)).toBe(4) // Navío a la deriva (Barco): NAV 3 + 1, ya no + 2
  })
})

describe('132 · Fuego de cobertura', () => {
  it('pone en juego la permanente 237: los Cañones no suman; Acción: Prueba de NAV 3 para descartarla', () => {
    const j = en('mar', ['cobertura', 'calma', 'calma'])
    expect(j.zona('permanentes')).toEqual(['pm_cobertura'])
    expect(j.valor({ tipo: 'sinCanones' })).toBeGreaterThan(0)
    j.usar('pm_cobertura.quitar0').comprometer('NAV', ['capitan']).seguir()
    expect(j.zona('permanentes')).toEqual([])
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
    expect(j.registro).toContain('Ganas 1 de Avance (2/5).') // fase 11: NAV 3, Avance 1 / 1 (más el +1 del éxito)
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
    expect(recoge.registro).toContain('Ganas 3 de Avance (3/5).')
    const sigue = en('mar', ['cofres', 'calma', 'calma'], { tripulacion: ['viejo_lobo'], avance: { 'pruebas-mar5': 1 } })
    resolver(sigue.opcion('1').comprometer('NAV', ['capitan', 'viejo_lobo']))
    expect(sigue.registro.some((r) => r.startsWith('Ganas 3 de Avance'))).toBe(true) // fase 10b: 3 / 1
  })

  it('Destino «El brillo de la plata»: −1 y nada más (fase 13, I1: fuera «si superas, roba 1 carta»); Sin oposición, descartas 1', () => {
    const j = en('mar', ['chubasco', 'cofres', 'calma'])
    j.comprometer('NAV', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(3) // Chubasco repentino: NAV 2 + 1
    j.seguir()
    expect(j.registro).toContain('Total 2 contra 2: superas la Prueba.')
    expect(robas(j, 1)).toBe(false)
    const k = en('mar', ['chubasco', 'cofres', 'calma'], { mano: ['ojo', 'timon'] })
    k.comprometer('NAV', [])
    expect(k.decision).toMatchObject({ tipo: 'elegirCartas', motivo: { clave: 'descartar', n: 1 } })
    k.elegir('timon')
    expect(k.zona('mano')).toEqual(['ojo'])
  })
})

describe('095 · La Armada te persigue (rehecha, P51)', () => {
  it('Mar · Navío de línea: NAV 5 y los Cañones no suman; si superas, +1 Avance y la carta se queda en el mazo', () => {
    const j = en('mar', ['armada', 'calma', 'calma'], { tripulacion: ['viejo_lobo'], barco: { mejoras: ['bronce'] } })
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

  it('Naturaleza · Desembarco de casacas: EXP 4; si superas, preparas un Cañón; si fallas, 2 heridas y el Barco Perseguido', () => {
    const j = en('nat', ['armada', 'calma', 'calma'], { tripulacion: ['baqueano', 'herbolaria'], barco: { mejoras: [{ id: 'bronce', agotada: true }] } })
    resolver(j.comprometer('EXP', ['baqueano', 'herbolaria']))
    expect(j.copia('bronce').agotada).toBe(false)
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

  it('Destino «Velas en el horizonte»: −1 en cualquier encuentro (fase 13, I1: fuera el −2 con #Armada#, #Militar# o #Guardia#); Sin oposición, el Barco queda Perseguido', () => {
    const j = en('ciu', ['ley', 'armada', 'calma'])
    j.comprometer('COM', ['capitan'])
    expect(dificultadConDestino(j.estado)).toBe(4) // Ronda de la guardia (Guardia, Militar): COM 3 + 1, ya no + 2
    const k = en('ciu', ['ley', 'armada', 'calma'])
    k.comprometer('COM')
    expect(k.estadosBarco).toContain('perseguido')
  })
})

describe('Fase 13 · Otear con un mazo propio mezclado', () => {
  it('si la misión revela de un mazo mezclado («El galeón rezagado»), Otear mira ese mazo, el del que revelas', () => {
    // Sin cartas del mazo propio en el mazo de historia, el mazo de la misión son las 6 cartas de Peligro que se mezclan.
    const j = Jugador.enMision({ misiones: ['flota-II'], mazoHistoria: [], tripulacion: ['vigia'], mazoPeligros: ['ley', 'fauna', 'chubasco', 'escollos', 'calma', 'racha', 'amigos'] })
    expect(j.estado.mision?.mazoMezclado).toBe(true)
    const arriba = j.estado.zonas.mazoMision[0]
    j.usar('vigia.otear')
    expect(j.decision).toMatchObject({ tipo: 'elegirOpcion', motivo: { clave: 'otear' } })
    expect(j.registro.some((r) => r.startsWith('Oteas del mazo de la misión:'))).toBe(true)
    j.opcion('fondo')
    expect(j.estado.zonas.mazoMision.at(-1)).toBe(arriba)
    expect(j.zona('mazoPeligros')).toEqual(['amigos'])
  })
})

