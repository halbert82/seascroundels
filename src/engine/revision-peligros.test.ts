// Revisión de Albert de los Peligros 154–162 y normas nuevas: una prueba por regla general y por lo que cambia en los
// datos de las cartas (lo que hace cada encuentro está en las pruebas de su grupo).

import { describe, expect, it } from 'vitest'
import { CATALOGO } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { definicionEncuentro } from './definiciones.ts'
import { esAbordaje } from './prueba.ts'
import { Jugador } from './pruebas/situacion.ts'

type Encuentro = { nombre: string; textoEfecto?: string; textoExito?: string; textoFallo?: string; etiquetas?: string[]; prueba: unknown[]; palabrasClave: string[]; avance: number; avanceSinSuperar?: number }

/** Todos los textos de la caja (sin las cartas de Peligro retiradas, que solo sirven a las pruebas antiguas). */
function textosDeLaCaja(): string[] {
  const textos: string[] = []
  const recorrer = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(recorrer)
    else if (o && typeof o === 'object') {
      if ((o as { retirada?: boolean }).retirada) return
      for (const v of Object.values(o)) {
        if (typeof v === 'string') textos.push(v)
        else recorrer(v)
      }
    }
  }
  recorrer(DATOS)
  return textos
}

type CartaConEncuentros = { id: string; retirada?: boolean; encuentros?: Record<string, Encuentro>; encuentro?: Encuentro }

/** Los encuentros de una carta de Peligro (o de un mazo propio, que tiene uno solo: «unico») por su id. */
function encuentros(id: string): Record<string, Encuentro> {
  const p = ([...DATOS.peligros, ...DATOS.cartasDeMazoPropio] as unknown as CartaConEncuentros[]).find((x) => x.id === id)
  if (!p) throw new Error(`No existe ${id}`)
  return p.encuentros ?? (p.encuentro ? { unico: p.encuentro } : {})
}

describe('Redondeo (regla general nueva): siempre hacia arriba', () => {
  it('ninguna carta dice ya «redondeando hacia arriba»', () => {
    expect(textosDeLaCaja().filter((t) => /redondeando/i.test(t))).toEqual([])
  })
})

describe('Abordaje pasa a la Prueba (como Sin ayuda y Descomunal)', () => {
  const RECORDATORIO = '**Abordaje** (no puedes usar las capacidades de tus _Cañones_; si fallas, inflige 1 herida por cada punto que te falte).'
  const conAbordaje = () => {
    const lista: { carta: string; enc: Encuentro }[] = []
    for (const p of [...DATOS.peligros, ...DATOS.cartasDeMazoPropio] as unknown as CartaConEncuentros[]) {
      if (p.retirada) continue
      for (const enc of Object.values(encuentros(p.id))) if ((enc.etiquetas ?? []).includes('Abordaje')) lista.push({ carta: p.id, enc })
    }
    return lista
  }

  it('los 9 encuentros llevan la etiqueta, terminan con el recordatorio y su Fallo ya no dice Abordaje', () => {
    const lista = conAbordaje()
    expect(lista.map((x) => x.enc.nombre).sort()).toEqual(
      ['Al abordaje del filibote', 'El barco de van Hoorn', 'El barco del fugitivo', 'El barco fantasma', 'El falso mercante', 'Fragata a popa', 'Galeón de la plata', 'Navío de línea de la Armada', 'Proa en la niebla'].sort(),
    )
    for (const { enc } of lista) {
      expect(enc.textoEfecto?.endsWith(RECORDATORIO), enc.nombre).toBe(true)
      expect(enc.textoFallo ?? '', enc.nombre).not.toContain('Abordaje')
      expect(enc.prueba.length, enc.nombre).toBeGreaterThan(0)
    }
    // Con Alerta, las dos etiquetas: primero Abordaje.
    expect(encuentros('barco_vanhoorn').unico?.etiquetas).toEqual(['Abordaje', 'Alerta'])
    // Lo que quedaba en el Fallo, se queda.
    expect(encuentros('barco_fugitivo').unico?.textoFallo).toBe('El fugitivo escapa: la misión falla.')
    expect(encuentros('p2_armada').mar?.textoFallo).toBe('~Os da alcance y os aborda.~')
  })

  it('la regla no cambia: sigue siendo un Abordaje para el motor (sin Cañones y una herida por punto que falte)', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-mar5'], mazoPeligros: ['p2_niebla', 'chubasco', 'calma'], barco: { mejoras: ['bronce'] } })
    expect(definicionEncuentro(j.estado, j.estado.zonas.encuentro[0]!).abordaje).toBe(true)
    j.comprometer('COM', [])
    expect(esAbordaje(j.estado)).toBe(true)
    expect(j.ofreceCapacidad('bronce.disparar')).toBe(false)
  })
})

describe('Norma de estilo: primero el efecto y, entre paréntesis, lo temático; «A tu elección» pasa a «Elige:»', () => {
  it('ningún texto usa ya la fórmula «A tu elección:» (P128: tampoco dentro de una frase; ver solo-encuentros.test)', () => {
    expect(textosDeLaCaja().filter((t) => /a tu elección:/i.test(t))).toEqual([])
  })

  it('los cuatro textos de Albert', () => {
    expect(encuentros('p2_fuego').ciu?.textoExito).toBe(
      '~Entre el humo y los gritos, nadie os vigila.~ **Elige:** {2 robar} (saqueáis los almacenes) o prepara a todos los Tripulantes asignados (ayudáis con los cubos y os invitan en la taberna).',
    )
    const textos = textosDeLaCaja()
    expect(textos).toContain('~La marea trae la carga del galeón.~ **Elige:** prepara a todos los Tripulantes agotados, que quedan **Borrachos** (abrís el de ron), o prepara un _Cañón_ (abrís el de pólvora).')
    expect(textos).toContain('**Elige:** {2 robar} (saqueáis la bodega) o prepara un _Cañón_ (saqueáis la Santa Bárbara).')
    expect(DATOS.escenario.find((e) => e.id === 'desercion')?.texto).toBe(
      '**Elige:** descarta 1 carta por cada Tripulante, máximo 3 (pagas la soldada), o tu Tripulante de menor coste vuelve al muelle con sus Mejoras descartadas (deserta). Tu Capitán nunca deserta.',
    )
  })
})

describe('Tipos de encuentro: «Monstruo» pasa a «Bestia»', () => {
  it('ninguna carta usa ya «Monstruo»', () => {
    const tipos = CATALOGO.flatMap((e) => (e.tipo === 'peligro' ? Object.values(e.carta.encuentros).flatMap((x) => x?.palabrasClave ?? []) : []))
    expect(tipos).not.toContain('Monstruo')
    expect(encuentros('leyenda').mar?.palabrasClave).toContain('Bestia')
  })
})

describe('Cartas 154–162: nombres, dificultades y Avances nuevos', () => {
  it('158 «Varados en la arena», 160 «Fuego en la Santa Bárbara», 161 «Casco carcomido por la broma» y «Puente desatendido»', () => {
    expect(encuentros('p2_bajamar').mar?.nombre).toBe('Varados en la arena')
    expect(encuentros('p2_fuego').mar?.nombre).toBe('Fuego en la Santa Bárbara')
    expect(encuentros('p2_broma').mar?.nombre).toBe('Casco carcomido por la broma')
    expect(encuentros('p2_broma').nat?.nombre).toBe('Puente desatendido')
  })

  it('162 «Rayos en la sierra» es EXP 2 y «La riada» da 2 / 1 de Avance', () => {
    expect(encuentros('p2_turbonada').nat?.prueba).toEqual([{ hab: 'EXP', dificultad: 2 }])
    expect([encuentros('p2_turbonada').ciu?.avance, encuentros('p2_turbonada').ciu?.avanceSinSuperar]).toEqual([2, 1])
  })

  it('«La riada»: si superas, 2 de Avance; si no, 1', () => {
    const j = Jugador.enMision({ misiones: ['pruebas-ciu4'], mazoPeligros: ['p2_turbonada', 'chubasco', 'calma'] })
    j.comprometer('NAV', []).seguir()
    expect(j.avance('pruebas-ciu4')).toBe(1)
  })
})
