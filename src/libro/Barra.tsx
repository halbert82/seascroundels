// Barra de la web del reglamento: cambiar de libro, descargar el PDF y volver al juego. No sale en el PDF.

import type { LibroId } from './fuente.ts'

export const FICHERO: Record<LibroId, string> = { aprende: 'aprende-a-jugar', referencia: 'referencia-de-reglas' }

export function Barra({ libro }: { libro: LibroId }) {
  return (
    <nav className="barra-libro" aria-label="Reglamento">
      <a className="barra-juego" href="../">
        <span aria-hidden="true">‹</span> Sea Scoundrels
      </a>
      <div className="barra-libros">
        <a className={libro === 'aprende' ? 'actual' : ''} href={`./${FICHERO.aprende}.html`} aria-current={libro === 'aprende' ? 'page' : undefined}>
          Aprende a jugar
        </a>
        <a className={libro === 'referencia' ? 'actual' : ''} href={`./${FICHERO.referencia}.html`} aria-current={libro === 'referencia' ? 'page' : undefined}>
          Referencia de reglas
        </a>
      </div>
      <a className="barra-pdf" href={`./${FICHERO[libro]}.pdf`} download>
        Descargar PDF
      </a>
    </nav>
  )
}
