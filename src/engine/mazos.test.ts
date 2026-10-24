import { describe, expect, it } from 'vitest'
import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { claseDe, erroresDeMazos } from './mazos.ts'

// Las reglas se prueban con los mazos de inicio («Pólvora y abordaje»).
const predefinidos = () => ({
  capitan: DATOS.mazosPredefinidos.capitanInicial,
  mazoDelCapitan: [...DATOS.mazosPredefinidos.mazoDelCapitan],
  mazoDeMuelle: [...DATOS.mazosPredefinidos.mazoDeMuelle],
})

describe('Construir tu mazo', () => {
  it('los mazos de inicio «Pólvora y abordaje» cumplen las reglas: muelle de 20 y capitán de 36 (decisión de Albert)', () => {
    // Fuera la excepción temporal de la fase 14 (muelle de inicio de 25 cartas) y el hueco de «Cortar por lo sano» (P120).
    const m = predefinidos()
    expect(DATOS.mazosPredefinidos.nombre).toBe('Pólvora y abordaje')
    expect(m.mazoDeMuelle).toHaveLength(20)
    expect(m.mazoDelCapitan).toHaveLength(36)
    expect(erroresDeMazos(m)).toEqual([])
    // Con 25 cartas de muelle, como el de inicio de antes, ya no valdría.
    expect(erroresDeMazos({ ...m, mazoDeMuelle: [...m.mazoDeMuelle, 'grumete', 'grumete', 'matasanos', 'vela', 'casco'] })).toEqual([
      'El mazo de muelle tiene 25 cartas; debe tener de 15 a 20.',
    ])
  })

  it('«Pólvora y abordaje»: 14 Tripulantes, 5 Mejoras de barco y 1 de tripulante; 12 Habilidades y 24 Eventos', () => {
    const cuenta = (ids: readonly string[]) => {
      const n = new Map<string, number>()
      for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1)
      return Object.fromEntries([...n].sort(([a], [b]) => a.localeCompare(b)))
    }
    const tipos = (ids: readonly string[]) => cuenta(ids.map((id) => CATALOGO.find((e) => e.id === id)?.tipo ?? '?'))
    const m = predefinidos()
    expect(tipos(m.mazoDeMuelle)).toEqual({ mejoraBarco: 5, mejoraTripulante: 1, tripulante: 14 })
    expect(tipos(m.mazoDelCapitan)).toEqual({ evento: 24, habilidad: 12 })
    expect(cuenta(m.mazoDeMuelle)).toEqual(
      cuenta(['isabela', 'reinaldo', 'viejo_lobo', 'bucanero', 'bucanero', 'filibustero', 'tuerto', 'carne_canon', 'carne_canon', 'canonero', 'carpintero', 'vigia', 'bartolome', 'loro', 'bandera', 'bronce', 'bronce', 'carronadas', 'hamacas', 'sable']),
    )
    expect(cuenta(m.mazoDelCapitan)).toEqual(
      cuenta([
        ...['abordaje', 'coraje', 'timon', 'emboscada', 'ojo', 'estrellas'].flatMap((id) => [id, id]),
        ...['virar', 'polvora_c', 'todos', 'arriba', 'ron_valientes', 'reflejos'].flatMap((id) => [id, id]),
        ...['ni_hombre', 'a_por_ellos', 'prisionero', 'arenga', 'reparacion', 'vendas', 'ron_descanso', 'cambio_rumbo', 'viento', 'soborno', 'cataplasma', 'taberna'],
      ]),
    )
    // «Para cuando se rehagan los mazos de inicio» (Albert, fase 14): 2 o 3 Vigías, al menos 2 Oficiales además del
    // Capitán y el Loro parlanchín.
    const conRasgo = (r: string) => m.mazoDeMuelle.filter((id) => (CATALOGO.find((e) => e.id === id)?.carta as { rasgos?: string[] }).rasgos?.includes(r)).length
    expect(conRasgo('Vigía')).toBeGreaterThanOrEqual(2)
    expect(conRasgo('Vigía')).toBeLessThanOrEqual(3)
    expect(conRasgo('Oficial')).toBeGreaterThanOrEqual(2)
    expect(m.mazoDeMuelle).toContain('loro')
  })

  it('las siete cartas del núcleo del mazo de inicio vienen con dos copias en la caja (decisión de Albert)', () => {
    for (const id of ['virar', 'polvora_c', 'todos', 'arriba', 'ron_valientes', 'carne_canon', 'bronce']) {
      expect(CATALOGO.find((e) => e.id === id)?.copias, id).toBe(2)
    }
  })

  it('el mazo de muelle debe tener de 15 a 20 cartas y el del capitán de 30 a 40', () => {
    const corto = { ...predefinidos(), mazoDeMuelle: predefinidos().mazoDeMuelle.slice(0, 14) }
    expect(erroresDeMazos(corto)).toEqual(['El mazo de muelle tiene 14 cartas; debe tener de 15 a 20.'])
    const largo = { ...predefinidos(), mazoDelCapitan: [...predefinidos().mazoDelCapitan, 'vendas', 'reparacion', 'taberna', 'cataplasma', 'soborno'] }
    expect(erroresDeMazos(largo)).toContain('El mazo del capitán tiene 41 cartas; debe tener de 30 a 40.')
  })

  it('como máximo 3 copias de cada carta por su nombre, y 1 de cada carta única', () => {
    const m = predefinidos()
    // Cuatro Bucaneros y dos Isabelas en lugar de las primeras cartas del muelle de inicio.
    m.mazoDeMuelle = m.mazoDeMuelle.filter((c) => c !== 'bucanero' && c !== 'isabela')
    m.mazoDeMuelle.splice(0, 6, 'bucanero', 'bucanero', 'bucanero', 'bucanero', 'isabela', 'isabela')
    expect(erroresDeMazos(m)).toEqual(
      expect.arrayContaining(['Hay 4 copias de «Bucanero veterano»; el máximo es 3.', 'Hay 2 copias de «Isabela «Cuervo» Saldaña»; el máximo es 1.']),
    )
  })

  it('cada carta va en su mazo: Tripulantes y Mejoras en el de muelle; Eventos y Habilidades en el del capitán', () => {
    const m = predefinidos()
    m.mazoDeMuelle[0] = 'ojo'
    m.mazoDelCapitan[0] = 'sable'
    expect(erroresDeMazos(m)).toEqual([
      '«Ojo avizor» no puede ir en el mazo de muelle (solo Tripulantes y Mejoras).',
      '«Sable de abordaje» no puede ir en el mazo del capitán (solo Eventos y Habilidades).',
    ])
  })

  it('los mazos de inicio no usan más copias de las que trae la caja', () => {
    const m = predefinidos()
    for (const entrada of CATALOGO) {
      const usadas = [...m.mazoDeMuelle, ...m.mazoDelCapitan].filter((id) => id === entrada.id).length
      expect(usadas, entrada.id).toBeLessThanOrEqual(entrada.copias)
    }
  })
  it('fase 11 · toda carta de jugador tiene Clase en los datos (Piratería o Neutral, explícita); los Tesoros no', () => {
    const DE_JUGADOR = new Set(['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'])
    for (const e of CATALOGO) {
      if (!DE_JUGADOR.has(e.tipo)) continue
      expect('senda' in e.carta && ['Piratería', 'Neutral'].includes(String(e.carta.senda)), `${e.num} ${e.id}`).toBe(true)
    }
    for (const t of DATOS.tesoros) expect('senda' in t, t.id).toBe(false)
    // Las de Piratería que Albert enumeró (todas las demás Mejoras, Eventos y Habilidades son Neutrales).
    const pirateria = CATALOGO.filter((e) => ['mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'].includes(e.tipo) && claseDe(e.id) === 'Piratería').map((e) => e.num)
    // Revisión de Albert: fuera «Botín escondido» (43).
    expect(pirateria).toEqual([24, 29, 30, 32, 37, 40, 41, 48, 51, 57, 58, 60, 66, 69, 171, 172, 173])
    // Los dos Capitanes son de Piratería: sus mazos de inicio siguen siendo legales.
    expect(DATOS.capitanes.map((c) => c.senda)).toEqual(['Piratería', 'Piratería'])
  })

  it('fase 11 · un Capitán solo puede usar cartas de su Clase y Neutrales (también Mejoras, Eventos y Habilidades)', () => {
    // Con un Capitán Neutral (supuesto), la Bandera negra, «¡Nadie se queda atrás!» y «¡Al abordaje!» no valdrían.
    const m = predefinidos()
    expect(erroresDeMazos(m)).toEqual([])
    const neutral = DATOS.capitanes[0]
    if (!neutral) throw new Error('sin Capitán')
    const antes = neutral.senda
    neutral.senda = 'Neutral'
    try {
      m.mazoDeMuelle[0] = 'bandera'
      expect(erroresDeMazos(m)).toEqual(
        expect.arrayContaining([
          '«Bandera negra» es de la Clase Piratería y tu Capitán es de Neutral.',
          '«¡Nadie se queda atrás!» es de la Clase Piratería y tu Capitán es de Neutral.',
          '«¡Al abordaje!» es de la Clase Piratería y tu Capitán es de Neutral.',
        ]),
      )
    } finally {
      neutral.senda = antes
    }
  })
})
