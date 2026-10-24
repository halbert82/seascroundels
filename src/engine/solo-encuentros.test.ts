// Respuestas de Albert P120–P131 y regla general nueva: solo los encuentros (cartas de Peligro, mazos propios y barcos
// rivales) piden Pruebas; las demás cartas, cuando necesitan una habilidad, usan Destina. Lo que hace cada carta que cambia
// está en las pruebas de su grupo (Carpinteros en escenario.test, Casco carcomido en peligros2-grupoA.test, Fango en
// peligros2-grupoB.test, Virar en cartas-jugador2.test, la maqueta en vista.test).

import { describe, expect, it } from 'vitest'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import { CATALOGO, type EntradaCatalogo } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { reglasPermanente } from './definiciones.ts'
import './pruebas/situacion.ts' // registra todas las reglas y capacidades

/** Los encuentros: lo único que puede pedir una Prueba. */
const TIPOS_DE_ENCUENTRO = new Set<EntradaCatalogo['tipo']>(['peligro', 'mazoPropio'])

/** Las seis permanentes que todavía piden una Prueba con su Acción (pasarán a Destina cuando Albert revise el mazo de historia). */
const PENDIENTES = ['guardia', 'pm_ojos', 'pm_campanas', 'pm_cadena', 'pm_lechuza', 'pm_cobertura']

/** Todos los textos de una carta (sus campos de texto, a cualquier profundidad), sin los del prototipo antiguo. */
function textosDe(carta: unknown): string[] {
  const textos: string[] = []
  const recorrer = (o: unknown, clave = ''): void => {
    if (['textoPrototipo', 'ayudaPrototipo', 'fallo', 'exito', 'siempre', 'ops'].includes(clave)) return
    if (typeof o === 'string') textos.push(o)
    else if (Array.isArray(o)) o.forEach((x) => recorrer(x))
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) recorrer(v, k)
  }
  recorrer(carta)
  return textos
}

/** «Prueba de [COM] 5», «supera una Prueba de [EXP] 3»: una Prueba con su habilidad y su dificultad. */
const PIDE_PRUEBA = /Prueba de \[(COM|NAV|EXP)\] \d/

/** Las palabras de un apartado del reglamento («### Prueba» o «#### Resolver una Prueba»), hasta el siguiente título. */
function apartado(titulo: string): string {
  const inicio = fuente.indexOf(`${titulo}\n`)
  if (inicio < 0) throw new Error(`No existe el apartado «${titulo}»`)
  const resto = fuente.slice(inicio + titulo.length)
  const fin = resto.search(/\n#{2,4} /)
  return fin < 0 ? resto : resto.slice(0, fin)
}

describe('Regla general (Albert): solo los encuentros piden Pruebas', () => {
  it('ninguna carta que no sea un encuentro pide una Prueba, salvo las seis permanentes pendientes', () => {
    const piden = CATALOGO.filter((e) => !TIPOS_DE_ENCUENTRO.has(e.tipo) && textosDe(e.carta).some((t) => PIDE_PRUEBA.test(t))).map((e) => e.id)
    expect([...new Set(piden)].sort()).toEqual([...PENDIENTES].sort())
  })

  it('ninguna carta de jugador pide ya una Prueba', () => {
    const DEL_JUGADOR = new Set<EntradaCatalogo['tipo']>(['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'])
    const piden = CATALOGO.filter((e) => DEL_JUGADOR.has(e.tipo) && textosDe(e.carta).some((t) => /Prueba de \[(COM|NAV|EXP)\] ?\d|haz una Prueba|supera una Prueba de/i.test(t)))
    expect(piden.map((e) => e.id)).toEqual([])
  })

  it('en el motor, las únicas permanentes que se quitan con una Prueba son las pendientes', () => {
    const conPrueba = DATOS.permanentes.filter((p) => reglasPermanente(p.id)?.quitar.some((q) => q.tipo === 'prueba')).map((p) => p.id)
    // «Ojos amarillos» hace su Prueba con su propia Acción (solo con el Tripulante que agota), no con «quitar».
    expect(conPrueba.sort()).toEqual(PENDIENTES.filter((id) => id !== 'pm_ojos').sort())
  })

  it('el reglamento lo dice en la Prueba, en Destina y en «Aprende a jugar»; la Referencia nombra las seis pendientes', () => {
    for (const titulo of ['### Prueba', '### Destina', '#### Resolver una Prueba']) expect(apartado(titulo), titulo).toMatch(/Solo los encuentros piden Pruebas/)
    expect(apartado('### Prueba')).toMatch(/cambiarán a Destina/)
    for (const nombre of ['¡La guardia!', 'Ojos amarillos en la espesura', 'Campanas a rebato', 'La cadena de la bocana', 'La lechuza canta tres veces', 'Fuego de cobertura']) {
      expect(apartado('### Prueba de una Acción'), nombre).toContain(`«${nombre}»`)
    }
    expect(apartado('#### Pruebas que nacen de una Acción')).toMatch(/seis permanentes .* pasarán a Destina/)
  })

  it('fuera de los dos libros la regla de la Interrupción que pedía una Prueba con otra a medias', () => {
    expect(fuente).not.toMatch(/a medio resolver|queda en suspenso|Interrupción\*\* que pide una Prueba|que pide una Interrupción/)
  })
})

describe('Respuestas de Albert P120–P131: textos de las cartas', () => {
  const texto = (id: string) => CATALOGO.find((e) => e.id === id)?.carta as { texto?: string } | undefined
  const encuentro = (id: string, entorno: 'mar' | 'nat' | 'ciu') =>
    (DATOS.peligros.find((p) => p.id === id) as unknown as { encuentros: Record<string, { textoEfecto?: string }> }).encuentros[entorno]

  it('P125: el Filibustero borracho y el Galeote fugado dicen «en esta Prueba» (como la Pistola)', () => {
    expect(texto('filibustero')?.texto).toBe('Inflige {1 herida} a Filibustero borracho: recibe {+2 COM} en esta Prueba. (Límite de una vez por turno.)')
    expect(texto('galeote')?.texto).toBe('Inflige {1 herida} a Galeote fugado: recibe {+2 NAV} en esta Prueba. (Límite de una vez por turno.)')
    expect(CATALOGO.flatMap((e) => textosDe(e.carta)).filter((t) => t.includes('para esta Prueba'))).toEqual([])
  })

  it('P126: los Pasajeros, con la norma «Inflige»', () => {
    for (const p of DATOS.pasajeros) {
      expect(p.texto.split('\n')[0], p.id).toBe(
        'Viaja contigo, pero no es un Tripulante: no puede ser asignado, y no se le pueden infligir heridas ni poner Estados ni Ventajas.',
      )
    }
  })

  it('P128: El Santo Oficio («una Mejora que elijas») y Presa fácil (primero el efecto); ya no queda ningún «a tu elección»', () => {
    expect(encuentro('p2_santooficio', 'ciu')?.textoEfecto).toBe(
      '**Al revelarse:** **Incautado:** una Mejora que elijas va debajo de la carta de misión; si llevas el Amuleto vudú, tiene que ser él (cosa de brujas). Si superas la misión, la recuperas.',
    )
    expect(encuentro('p2_presa', 'ciu')?.textoEfecto).toBe(
      '~Toda la ciudad está en la procesión del santo, y el mercader con ella.~ Puedes recuperar a la mano 2 cartas de tu descarte (os coláis en su casa y os lleváis lo que te vendió caro). Si lo haces, un Tripulante que elijas queda **Buscado** (alguien os vio salir por la ventana).',
    )
    expect(CATALOGO.flatMap((e) => textosDe(e.carta)).filter((t) => /a tu elección/i.test(t))).toEqual([])
  })

  it('el icono de robar nunca lleva el verbo delante: ningún «roba {N robar}» en la caja', () => {
    expect(CATALOGO.flatMap((e) => textosDe(e.carta)).filter((t) => /roba \{[^}]*robar\}/i.test(t))).toEqual([])
  })
})
