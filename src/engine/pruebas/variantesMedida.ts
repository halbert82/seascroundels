// Variantes de reglas solo para medir el equilibrio. Cambian los datos cargados en memoria del proceso de la medida;
// nunca se usan en la partida real. Se activan con MEDIR_VARIANTE, una lista separada por comas:
//
//   REP=N     reputación para ganar en el modo de la partida
//   ESC=N     cartas de Escenario del modo de la partida
//   MODO=x    modo de partida (corta, normal o larga)
//   SINESC    partida de aprendizaje (sin mazo de Escenario)
//   R:id=±N   suma N a la reputación de la recompensa de un capítulo (en un final con elección, a cada opción)
//   AV:id=N   Avance necesario de un capítulo
//   MAZO:a=b  en el mazo del capitán de inicio, la carta a pasa a ser b (fase 13: «Arenga del capitán» en lugar de
//             «Ron para los valientes», MAZO:ron_valientes=arenga; el mazo de inicio de la partida no cambia)
//   DIF:p=±N  suma N a la dificultad de las Pruebas de los encuentros de la carta de Peligro p (DIF:p.mar=±N, solo el de
//             ese Entorno: mar, nat o ciu). Informe de dificultad del 5 de noviembre de 2026; el texto no cambia.
//   AVP:p.e=X/Y  Avance del encuentro del Entorno e de la carta de Peligro p (X si superas la Prueba, Y si no; sin
//             Prueba, AVP:p.e=X)
//   FUERA:p   saca la carta de Peligro p del mazo de Peligros (todas sus copias)
//   SINGESTA:id  el capítulo id no tiene Gesta (no da el +1 de reputación)
//   ANTES_P134  la reputación de antes de P134: las siete recompensas que siguen bajadas, con 1 más (la manera 3 del
//             informe de dificultad está en los datos desde el 5 de noviembre de 2026; las otras tres volvieron con P135)
//   ANTES_P135  la reputación de P134 sin P135: las recompensas finales de El fugitivo y La Isla del Tesoro con 1 menos
//   JUGADOR_ANTES  el jugador automático elige misión con el criterio de antes de P135 (cada capítulo casi por sí solo;
//             el resto de la travesía contaba un 20 %)
//
// Fase 11: la reputación nueva de las misiones (antes R1–R3), las Pruebas fáciles a 1 / 1 (A1) y las misiones iniciales
// con precio (I2) ya están en los datos; I1 se descartó.

import { CATALOGO, porId } from '../catalogo.ts'
import { DATOS, type CapituloDatos } from '../datos.ts'
import { reglasMision } from '../misiones2/registro.ts'
import { MODOS } from '../preparacion.ts'
import { valorarTravesias } from './jugadores.ts'
import type { Modo } from '../tipos.ts'

export interface VarianteMedida {
  claves: Set<string>
  rep?: number
  escenario?: number
  modo: Modo
  /** Fase 12: cambios de reputación (suma) y de Avance (valor) por capítulo. */
  reputacionCapitulo: Record<string, number>
  avanceCapitulo: Record<string, number>
  /** Fase 13: cartas que se cambian en el mazo del capitán de inicio (de → a). */
  mazo: Record<string, string>
  /** Informe de dificultad: dificultad de más por encuentro de Peligro («p» o «p.entorno»). */
  dificultadPeligro: Record<string, number>
  /** Informe de dificultad: Avance de un encuentro de Peligro («p.entorno» → [X, Y]; sin Prueba, [X]). */
  avancePeligro: Record<string, [number, number] | [number]>
  /** Informe de dificultad: cartas de Peligro fuera del mazo. */
  fueraDelMazo: string[]
  /** Informe de dificultad: capítulos sin Gesta. */
  sinGesta: string[]
}

export function leerVariante(texto: string | undefined): VarianteMedida {
  const v: VarianteMedida = { claves: new Set(), modo: 'normal', reputacionCapitulo: {}, avanceCapitulo: {}, mazo: {}, dificultadPeligro: {}, avancePeligro: {}, fueraDelMazo: [], sinGesta: [] }
  const atajos: Record<string, string> = { ANTES_P134, ANTES_P135 }
  const partes = (texto ?? '').split(',').map((p) => p.trim()).filter(Boolean).flatMap((p) => atajos[p]?.split(',') ?? [p])
  for (const parte of partes) {
    const [clave, valor] = parte.split('=')
    if (clave === 'REP') v.rep = Number(valor)
    else if (clave === 'ESC') v.escenario = Number(valor)
    else if (clave === 'MODO') v.modo = valor as Modo
    else if (clave === 'SINESC' || clave === 'JUGADOR_ANTES') v.claves.add(clave)
    else if (clave?.startsWith('R:')) v.reputacionCapitulo[clave.slice(2)] = Number(valor)
    else if (clave?.startsWith('AV:')) v.avanceCapitulo[clave.slice(3)] = Number(valor)
    else if (clave?.startsWith('MAZO:') && valor) v.mazo[clave.slice(5)] = valor
    else if (clave?.startsWith('DIF:')) v.dificultadPeligro[clave.slice(4)] = Number(valor)
    else if (clave?.startsWith('AVP:') && valor) {
      const [x, y] = valor.split('/').map(Number)
      v.avancePeligro[clave.slice(4)] = y === undefined ? [x ?? 0] : [x ?? 0, y]
    } else if (clave?.startsWith('FUERA:')) v.fueraDelMazo.push(clave.slice(6))
    else if (clave?.startsWith('SINGESTA:')) v.sinGesta.push(clave.slice(9))
    else if (clave) throw new Error(`Variante de medida desconocida: ${clave}`)
  }
  return v
}

/** Aplica la variante a los datos en memoria. Llamar una sola vez por proceso, antes de jugar. */
export function aplicarVariante(v: VarianteMedida): void {
  valorarTravesias(v.claves.has('JUGADOR_ANTES') ? 'capitulo' : 'travesia')
  if (v.rep !== undefined) MODOS[v.modo].reputacion = v.rep
  if (v.escenario !== undefined) MODOS[v.modo].escenario = v.escenario
  const capitulo = (id: string): CapituloDatos => {
    const e = porId(id)
    if (e.tipo !== 'capitulo') throw new Error(`${id} no es un capítulo`)
    return e.carta
  }
  for (const [id, n] of Object.entries(v.reputacionCapitulo)) {
    const r = capitulo(id).recompensa
    // Fase 15, cuarta ronda: un final con elección está en su carta de recompensa («Ante el altar»).
    const cogida = r.coge !== undefined ? CATALOGO.find((e) => e.num === r.coge) : undefined
    const elige = cogida?.tipo === 'recompensa' ? cogida.carta.elige : undefined
    if (elige) for (const o of elige) o.rep = (o.rep ?? 0) + n
    else r.rep = (r.rep ?? 0) + n
  }
  for (const [id, n] of Object.entries(v.avanceCapitulo)) capitulo(id).avanceNecesario = n
  const mazo = DATOS.mazosPredefinidos.mazoDelCapitan
  for (const [de, a] of Object.entries(v.mazo)) {
    porId(a)
    const i = mazo.indexOf(de)
    if (i < 0) throw new Error(`«${de}» no está en el mazo del capitán de inicio`)
    mazo[i] = a
  }
  // Informe de dificultad (5 de noviembre de 2026): números de encuentros de Peligro concretos y cartas fuera del mazo.
  const encuentros = (clave: string) => {
    const [id, entorno] = clave.split('.')
    const e = porId(id ?? '')
    if (e.tipo !== 'peligro') throw new Error(`${id} no es una carta de Peligro`)
    const todos = Object.entries(e.carta.encuentros)
    const elegidos = entorno ? todos.filter(([k]) => k === entorno) : todos
    if (elegidos.length === 0) throw new Error(`${clave}: no hay encuentro en ese Entorno`)
    return elegidos.map(([, enc]) => enc)
  }
  for (const [clave, n] of Object.entries(v.dificultadPeligro)) {
    for (const enc of encuentros(clave)) {
      for (const o of enc.prueba) {
        o.dificultad += n
        if (o.alternativa) o.alternativa.dificultad += n
      }
    }
  }
  for (const [clave, [x, y]] of Object.entries(v.avancePeligro)) {
    for (const enc of encuentros(clave)) {
      enc.avance = x
      if (y !== undefined) enc.avanceSinSuperar = y
    }
  }
  for (const id of v.fueraDelMazo) {
    porId(id)
    const lista = DATOS.mazosPredefinidos.mazoDePeligros
    if (!lista.includes(id)) throw new Error(`«${id}» no está en el mazo de Peligros`)
    DATOS.mazosPredefinidos.mazoDePeligros = lista.filter((x) => x !== id)
  }
  for (const id of v.sinGesta) {
    capitulo(id)
    const reglas = reglasMision(id)
    if (!reglas?.gesta) throw new Error(`«${id}» no tiene Gesta`)
    delete reglas.gesta
  }
}

/**
 * P134 (5 de noviembre de 2026, decisión de Albert): las diez recompensas que daban 3 o más de reputación dan 1 menos (en
 * los finales con elección, cada opción). P135 (el mismo día, opción B) devolvió el punto a tres: «Vivo, no muerto»,
 * «…tomada por los ingleses» y «La cueva se viene abajo». ANTES_P134 deja las otras siete como estaban antes de P134, para
 * comparar con lo de antes; ANTES_P135 quita el punto a las tres (la reputación de P134 sola).
 */
export const ANTES_P134 =
  'R:espia-II=1,R:sanfelipe-II-b=1,R:sanfelipe-III=1,R:fantasma-II=1,R:flota-IV=1,R:vanhoorn-II-a=1,R:templo-IV=1'
export const ANTES_P135 = 'R:isla-II-ingleses=-1,R:isla-II-temblor=-1,R:fugitivo-II=-1'

/**
 * Las maneras de endurecer el juego del informe de dificultad (5 de noviembre de 2026), como variantes de medida. Solo
 * para medir. P134: Albert eligió la 3, que ya está en los datos; aquí queda «antes» (la reputación de antes de P134). La
 * 1 (el reloj) queda como idea de «modo difícil» y la 2 (los Peligros), para cuando Albert termine de revisar sus textos.
 * Medidas sobre los datos de hoy, la 1, la 2 y «gesta» se suman a la 3.
 */
export const MANERAS: Record<string, { nombre: string; variante: string }> = {
  1: { nombre: 'El reloj: 10 cartas de Escenario en la partida normal', variante: 'ESC=10' },
  2: {
    nombre: 'Peligros: +1 a las 22 Pruebas de COM que menos se fallan y −1 al Avance de los 15 encuentros que lo dan gratis',
    variante:
      'DIF:p2_grilletes.mar=1,DIF:p2_holandes.mar=1,DIF:p2_bokor.mar=1,DIF:p2_rebato.mar=1,' +
      'DIF:p2_quinto.mar=1,DIF:p2_curazao.mar=1,DIF:p2_presa.mar=1,DIF:p2_hombro.nat=1,' +
      'DIF:p2_lenguas.mar=1,DIF:p2_tortugas.mar=1,DIF:p2_fuerza.ciu=1,DIF:p2_murcielagos.ciu=1,' +
      'DIF:p2_tiburones.mar=1,DIF:p2_sangre.mar=1,DIF:p2_tahur.nat=1,DIF:p2_hermanos.ciu=1,' +
      'DIF:p2_niebla.mar=1,DIF:p2_murcielagos.mar=1,DIF:p2_oro.ciu=1,DIF:p2_lenguas.ciu=1,' +
      'DIF:p2_curazao.nat=1,DIF:p2_fuego.ciu=1,AVP:p2_bajamar.mar=1,AVP:p2_fuego.nat=1,' +
      'AVP:p2_arenas.nat=1,AVP:p2_jaguar.nat=1,AVP:p2_desertores.mar=0,AVP:p2_desertores.ciu=0,' +
      'AVP:p2_rebato.ciu=1,AVP:p2_morro.mar=1,AVP:p2_hermanos.mar=0,AVP:p2_barril.ciu=0,' +
      'AVP:p2_paga.mar=1,AVP:p2_motin.ciu=1,AVP:p2_estrella.ciu=0,AVP:p2_presa.ciu=0,' +
      'AVP:p2_presagio.nat=1',
  },
  antes: { nombre: 'Antes de P134: las siete recompensas que siguen bajadas, con 1 más de reputación', variante: 'ANTES_P134' },
  gesta: { nombre: '«Rumbo a mar abierto» sin Gesta', variante: 'SINGESTA:prueba-I' },
}
