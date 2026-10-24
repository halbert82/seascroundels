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

/** Las seis permanentes que pedían una Prueba con su Acción y ahora usan Destina (decisión de Albert). */
const ANTES_CON_PRUEBA = ['guardia', 'pm_ojos', 'pm_campanas', 'pm_cadena', 'pm_lechuza', 'pm_cobertura']

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
  it('ninguna carta que no sea un encuentro pide una Prueba (las seis permanentes, tampoco: usan Destina)', () => {
    const piden = CATALOGO.filter((e) => !TIPOS_DE_ENCUENTRO.has(e.tipo) && textosDe(e.carta).some((t) => PIDE_PRUEBA.test(t) || /haz una Prueba|supera una Prueba de/i.test(t))).map((e) => e.id)
    expect([...new Set(piden)]).toEqual([])
  })

  it('ninguna carta de jugador pide ya una Prueba', () => {
    const DEL_JUGADOR = new Set<EntradaCatalogo['tipo']>(['capitan', 'barco', 'tripulante', 'mejoraBarco', 'mejoraTripulante', 'evento', 'habilidad'])
    const piden = CATALOGO.filter((e) => DEL_JUGADOR.has(e.tipo) && textosDe(e.carta).some((t) => /Prueba de \[(COM|NAV|EXP)\] ?\d|haz una Prueba|supera una Prueba de/i.test(t)))
    expect(piden.map((e) => e.id)).toEqual([])
  })

  it('en el motor, las seis permanentes se quitan con Destina, nunca con una Prueba', () => {
    const formas = (id: string) => (reglasPermanente(id)?.quitar ?? []).map((q) => q.tipo)
    expect(Object.fromEntries(ANTES_CON_PRUEBA.map((id) => [id, formas(id)]))).toEqual({
      guardia: ['destina'],
      pm_ojos: ['destina'],
      pm_campanas: ['agotarRasgo', 'destina'],
      pm_cadena: ['destina'],
      pm_lechuza: ['agotarRasgo', 'destina'],
      pm_cobertura: ['destina'],
    })
  })

  it('los textos de Albert: «Destina» en las seis, sin efectos de fallar (un coste no se falla)', () => {
    const texto = (id: string) => DATOS.permanentes.find((p) => p.id === id)?.texto ?? ''
    expect(texto('guardia')).toBe(
      'Mientras esté, todas las Pruebas reciben {+1 r} de dificultad.\n**Acción:** Destina 5 [COM] ~(los echáis a palos)~ o agota a 2 Tripulantes ~(os escabullís por los tejados)~: descarta esta carta.',
    )
    expect(texto('pm_ojos')).toContain('**Acción:** Destina 5 [COM] con un solo Tripulante (3 [EXP] si es un _Explorador_): {2 robar} y descarta esta carta.')
    expect(texto('pm_campanas')).toContain('**Acción:** Agota a un _Oficial_ o destina 3 [COM]: descarta esta carta.')
    expect(texto('pm_cadena')).toBe('No puedes superar la misión. **Acción:** Destina 5 [COM] (4 si tienes un _Carpintero_ preparado): descarta esta carta y gana {1 avance}.')
    expect(texto('pm_lechuza')).toContain('**Acción:** Agota a un _Vigía_ o destina 3 [EXP]: descarta esta carta y el señalado queda **Aguerrido**.')
    expect(texto('pm_cobertura')).toBe('Los _Cañones_ no suman. **Acción:** Destina 3 [NAV]: descarta esta carta.')
    for (const id of ANTES_CON_PRUEBA) expect(texto(id), id).not.toMatch(/si fallas|si superas|Prueba de/)
  })

  it('el reglamento lo dice en la Prueba, en Destina y en «Aprende a jugar»; ya no hay «Prueba de una Acción»', () => {
    for (const titulo of ['### Prueba', '### Destina', '#### Resolver una Prueba']) expect(apartado(titulo), titulo).toMatch(/Solo los encuentros piden Pruebas/)
    expect(fuente).not.toMatch(/cambiarán a Destina|pasarán a Destina|Prueba de una Acción|Pruebas que nacen de una Acción/)
    expect(fuente).not.toMatch(/^#{2,4} Prueba de una Acción$/m)
  })

  it('fuera de los dos libros la regla de la Interrupción que pedía una Prueba con otra a medias', () => {
    expect(fuente).not.toMatch(/a medio resolver|queda en suspenso|Interrupción\*\* que pide una Prueba|que pide una Interrupción/)
  })
})

describe('Respuestas de Albert P120–P131: textos de las cartas', () => {
  const texto = (id: string) => CATALOGO.find((e) => e.id === id)?.carta as { texto?: string } | undefined
  const encuentro = (id: string, entorno: 'mar' | 'nat' | 'ciu') =>
    (DATOS.peligros.find((p) => p.id === id) as unknown as { encuentros: Record<string, { textoEfecto?: string }> }).encuentros[entorno]

  it('P125 y P132: el Filibustero borracho, el Galeote fugado y la Carne de cañón, como la Pistola («{+3 COM} en esta Prueba»)', () => {
    expect(texto('filibustero')?.texto).toBe('Inflige {1 herida} a Filibustero borracho: {+2 COM} en esta Prueba. (Límite de una vez por turno.)')
    expect(texto('galeote')?.texto).toBe('Inflige {1 herida} a Galeote fugado: {+2 NAV} en esta Prueba. (Límite de una vez por turno.)')
    expect(texto('carne_canon')?.texto).toBe(
      'Inflige {1 herida} a Carne de cañón: {+1 COM} a los demás Tripulantes asignados en esta Prueba. (Límite de una vez por turno.)',
    )
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
