// Mazo de historia (fase 10, como el de Arkham Horror 3.ª edición): las cartas que no empiezan en ningún mazo llevan su
// número bien visible en el anverso y, en el dorso, el dorso del mazo al que van, con el mismo número. Se buscan por él
// («Pon la carta 137 encima del mazo de Misiones»).

import { esDelPecio, type EntradaCatalogo } from '../../engine/catalogo.ts'

/** El dorso del mazo al que va una carta del mazo de historia. */
export type DorsoHistoria = 'misiones' | 'muelle' | 'peligros'

/**
 * Si la carta empieza en el mazo de historia, el dorso del mazo al que va: los capítulos II y III, al de Misiones; los
 * Tesoros, al de muelle (son Mejoras); los mazos propios y «La Armada te persigue», al de Peligros. Los Pasajeros y
 * las permanentes no van a ningún mazo: llevan el dorso de misión, porque salen durante las misiones.
 */
export function dorsoDeHistoria(e: EntradaCatalogo): DorsoHistoria | null {
  switch (e.tipo) {
    case 'capitulo':
      return e.carta.capitulo === 'I' ? null : 'misiones'
    case 'tesoro':
      // Fase 15: los Tesoros 270 y 271 van en el mazo del pecio, con el dorso de misión de las demás (si llevaran el de
      // muelle, se sabría cuándo toca un Tesoro).
      return esDelPecio(e.id) ? 'misiones' : 'muelle'
    case 'mazoPropio':
      return 'peligros'
    case 'peligro':
      return e.carta.entraDuranteLaPartida && !e.carta.retirada ? 'peligros' : null
    case 'pasajero':
    // Fase 15: las cartas del mazo del pecio salen al superar su misión: dorso de misión.
    case 'pecio':
    // Fase 11: las permanentes (también «¡La guardia!») no van a ningún mazo (van a la zona de permanentes): dorso de
    // misión, pila normal.
    case 'permanente':
      return 'misiones'
    default:
      return null
  }
}
