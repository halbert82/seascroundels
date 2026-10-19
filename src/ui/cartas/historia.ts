// Mazo de historia (fase 10, como el de Arkham Horror 3.ª edición): las cartas que no empiezan en ningún mazo llevan su
// número bien visible en el anverso y, en el dorso, el dorso del mazo al que van, con el mismo número. Se buscan por él
// («Añade la carta 137 al mazo de Misiones»).

import type { EntradaCatalogo } from '../../engine/catalogo.ts'

/** El dorso del mazo al que va una carta del mazo de historia. */
export type DorsoHistoria = 'misiones' | 'muelle' | 'peligros'

/**
 * Si la carta empieza en el mazo de historia, el dorso del mazo al que va: los capítulos II y III, al de Misiones; los
 * Tesoros, al de muelle (son Mejoras); los mazos propios y «La Armada te persigue», al de Peligros. Los Pasajeros y
 * «¡La guardia!» no van a ningún mazo: llevan el dorso de misión, porque salen de las misiones.
 */
export function dorsoDeHistoria(e: EntradaCatalogo): DorsoHistoria | null {
  switch (e.tipo) {
    case 'capitulo':
      return e.carta.capitulo === 'I' ? null : 'misiones'
    case 'tesoro':
      return 'muelle'
    case 'mazoPropio':
      return 'peligros'
    case 'peligro':
      return e.carta.entraDuranteLaPartida && !e.carta.retirada ? 'peligros' : null
    case 'pasajero':
    case 'cartaMision':
      return 'misiones'
    default:
      return null
  }
}
