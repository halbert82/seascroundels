// Un libro del reglamento, de la cubierta a la contraportada, listo para que Paged.js lo reparta en páginas A4.
// La estructura y el texto salen de fuente.ts; aquí solo se maqueta.

import { createContext, Fragment } from 'react'
import arteAprende from '../../assets/arte/cap_galeon.jpg'
import arteReferencia from '../../assets/arte/abordaje.jpg'
import { ARTE_CAPITULO } from './arte.ts'
import type { Bloque, Capitulo, Entrada, LibroId, Reglamento } from './fuente.ts'
import { Anatomia, Componentes, Contraportada, EjemploDeJuego, Mesa, PruebaFlujo, Turno } from './graficos.tsx'
import { Ejemplo } from './Ejemplo.tsx'
import { Filete, Rosa } from './piezas.tsx'

/** El reglamento entero, para los gráficos que toman textos de otra parte (la Prueba, de la Referencia rápida). */
export const ContextoReglamento = createContext<Reglamento | null>(null)

export const TITULO: Record<LibroId, string> = { aprende: 'Aprende a jugar', referencia: 'Referencia de reglas' }

/**
 * Capítulos de «Aprende a jugar» que empiezan en página nueva. «Ganar y perder» también, porque es el que va antes del
 * ejemplo de juego (que empieza en página par): si no, el libro dejaba una página derecha en blanco entre los dos.
 */
// TODO(diseño): «Ganar y perder» en página nueva lo he decidido yo (docs/decisiones.md, fase 9, «Última ronda de maqueta»).
const PAGINA_NUEVA = new Set(['Componentes', 'Anatomía de las cartas', 'Preparación de la partida', 'El turno', 'Las misiones', 'Heridas, daño y penalizaciones', 'Ganar y perder', 'Construir tu mazo'])

function Html({ html, className = '' }: { html: string; className?: string }) {
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Libro({ r, libro }: { r: Reglamento; libro: LibroId }) {
  return (
    <ContextoReglamento.Provider value={r}>
      <div className={`libro libro-${libro}`}>
        <Cubierta libro={libro} />
        <ComoUsar r={r} libro={libro} />
        <Indice r={r} libro={libro} />
        {libro === 'aprende' ? <CuerpoAprende r={r} /> : <CuerpoReferencia r={r} />}
        <Creditos libro={libro} />
        <Contraportada rapida={r.rapida} />
      </div>
    </ContextoReglamento.Provider>
  )
}

// ---------------------------------------------------------------------------
// Cubierta, «Cómo usar este libro» e índice

function Cubierta({ libro }: { libro: LibroId }) {
  return (
    <section className={`cubierta cubierta-${libro}`}>
      <div className="cubierta-marco">
        <div className="cubierta-juego">Sea Scoundrels</div>
        <div className="cubierta-lema">Juego de cartas en solitario · El Caribe, 1670</div>
        <div className="cubierta-arte">
          <img src={libro === 'aprende' ? arteAprende : arteReferencia} alt="" />
        </div>
        <Filete className="filete-oro" />
        <h1 className="cubierta-libro nombre-libro">{TITULO[libro]}</h1>
        <div className="cubierta-pie">
          {libro === 'aprende' ? 'Lee este libro antes de tu primera partida' : 'Consulta este libro cuando te surja una duda'}
          <span className="cubierta-version">Reglamento · versión 1.0</span>
        </div>
      </div>
    </section>
  )
}

function ComoUsar({ r, libro }: { r: Reglamento; libro: LibroId }) {
  return (
    <section className="preliminar como-usar">
      <h2 className="titulo-preliminar">Cómo usar este libro</h2>
      <Filete />
      <div className="como-usar-texto">
        {r.comoUsar.map((b, i) => (b.tipo === 'html' ? <Html key={i} html={b.html} /> : null))}
      </div>
      <div className="como-usar-libros">
        <div className={`como-usar-libro ${libro === 'aprende' ? 'actual' : ''}`}>
          <span className="cul-titulo">Aprende a jugar</span>
          <span className="cul-texto">Para leerlo de principio a fin. Trae los ejemplos, los diagramas y la ambientación.</span>
        </div>
        <div className={`como-usar-libro ${libro === 'referencia' ? 'actual' : ''}`}>
          <span className="cul-titulo">Referencia de reglas</span>
          <span className="cul-texto">Para consultar, de la A a la Z. Cada término de juego en negrita remite a su página.</span>
        </div>
      </div>
    </section>
  )
}

function Indice({ r, libro }: { r: Reglamento; libro: LibroId }) {
  return (
    <section className="preliminar pagina-indice">
      {libro === 'aprende' ? <IndiceAprende capitulos={r.aprende.capitulos} /> : <IndiceReferencia entradas={r.referencia.entradas} />}
    </section>
  )
}

function LineaIndice({ id, texto, nivel = 1 }: { id: string; texto: string; nivel?: number }) {
  return (
    <li className={`indice-linea nivel-${nivel}`}>
      <a href={`#${id}`} className="indice-texto">
        {texto}
      </a>
      <span className="indice-puntos" />
      <a className="num-pag" href={`#${id}`} />
    </li>
  )
}

function IndiceAprende({ capitulos }: { capitulos: Capitulo[] }) {
  return (
    <nav className="indice indice-aprende">
      <h2 className="titulo-indice">Índice</h2>
      <ol>
        {capitulos.map((c) => (
          <Fragment key={c.id}>
            <LineaIndice id={c.id} texto={c.titulo} />
            {c.bloques
              .filter((b): b is Bloque & { tipo: 'subtitulo' } => b.tipo === 'subtitulo')
              .filter(() => c.titulo !== 'Anatomía de las cartas')
              .map((b) => (
                <LineaIndice key={b.id} id={b.id} texto={b.texto} nivel={2} />
              ))}
          </Fragment>
        ))}
        <LineaIndice id="creditos" texto="Créditos" />
        <LineaIndice id="referencia-rapida" texto="Referencia rápida (contraportada)" />
      </ol>
    </nav>
  )
}

function IndiceReferencia({ entradas }: { entradas: Entrada[] }) {
  return (
    <nav className="indice indice-referencia">
      <h2 className="titulo-indice">Índice de entradas</h2>
      <ol>
        {entradas.map((e) => (
          <LineaIndice key={e.id} id={e.id} texto={e.titulo} />
        ))}
        <LineaIndice id="referencia-rapida" texto="Referencia rápida" />
      </ol>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Bloques del texto

export function BloqueVista({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case 'html':
      return <Html html={b.html} />
    case 'subtitulo':
      return (
        <h3 className="subtitulo" id={b.id}>
          {b.texto}
        </h3>
      )
    case 'ejemplo':
      return <Ejemplo b={b} />
    case 'importante':
      return (
        <div className="importante">
          <div className="importante-cabecera">¡Atención!</div>
          <Html html={b.html} />
        </div>
      )
    case 'consejo':
      return (
        <aside className="consejo">
          <div className="consejo-cabecera">Consejo</div>
          <Html html={b.html} />
        </aside>
      )
    case 'componentes':
      return <Componentes grupo={b.grupo} filas={b.filas} />
    case 'grafico':
      switch (b.nombre) {
        case 'anatomia':
          return <Anatomia tipo={b.arg} leyenda={b.leyenda ?? []} />
        case 'mesa':
          return <Mesa />
        case 'turno':
          return <Turno pasos={b.pasos ?? []} />
        case 'prueba':
          return <PruebaFlujo />
        default:
          return <div className="pendiente">[gráfico «{b.nombre}» pendiente]</div>
      }
  }
}

/**
 * Cabecera de un capítulo de «Aprende a jugar»: su ilustración a todo el ancho de la página (centrada, con fundido al
 * pergamino), el título, el filete y el epígrafe.
 */
export function InicioCapitulo({ c }: { c: Capitulo }) {
  const arte = ARTE_CAPITULO[c.titulo]
  return (
    <div className={`inicio-capitulo ${arte ? 'ancho con-arte' : ''}`}>
      {arte && (
        <div className="cabecera-arte" data-arte={arte.nombre}>
          <img src={arte.url} alt="" style={{ objectPosition: arte.encuadre }} />
        </div>
      )}
      <header className="cabecera-capitulo">
        <h2 className="titulo-capitulo">{c.titulo}</h2>
        <Filete />
        <Epigrafe c={c} />
      </header>
    </div>
  )
}

function Epigrafe({ c }: { c: Capitulo }) {
  if (!c.epigrafe) return <div className="epigrafe pendiente">[epígrafe pendiente]</div>
  return (
    <div className="epigrafe">
      <div className="epigrafe-texto" dangerouslySetInnerHTML={{ __html: c.epigrafe.html }} />
      <div className="epigrafe-autor">— {c.epigrafe.autor}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aprende a jugar

function CuerpoAprende({ r }: { r: Reglamento }) {
  const [primero, ...resto] = r.aprende.capitulos
  return (
    <>
      <section className="apertura">
        <div className="apertura-ornamento">
          <Rosa tam={34} />
        </div>
        <div className="apertura-texto" dangerouslySetInnerHTML={{ __html: r.aprende.intro }} />
      </section>
      {primero && <CapituloVista c={primero} primero />}
      {resto.map((c) => (
        <CapituloVista key={c.id} c={c} />
      ))}
    </>
  )
}

function CapituloVista({ c, primero = false }: { c: Capitulo; primero?: boolean }) {
  if (c.especial === 'ejemplo-de-juego') return <EjemploDeJuego c={c} />
  const nueva = PAGINA_NUEVA.has(c.titulo)
  return (
    <section className={`capitulo ${nueva ? 'pagina-nueva' : ''} ${primero ? 'primero' : ''}`} id={c.id}>
      <div className="flujo">
        <InicioCapitulo c={c} />
        {!c.conTema && <aside className="nota-tema pendiente">[nota pendiente]</aside>}
        {c.bloques.map((b, i) => (
          <BloqueVista key={i} b={b} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Referencia de reglas

function CuerpoReferencia({ r }: { r: Reglamento }) {
  const letras: { letra: string; entradas: Entrada[] }[] = []
  for (const e of r.referencia.entradas) {
    const ultima = letras.at(-1)
    if (ultima && ultima.letra === e.letra) ultima.entradas.push(e)
    else letras.push({ letra: e.letra, entradas: [e] })
  }
  return (
    <section className="referencia">
      <div className="flujo">
        <header className="cabecera-capitulo cabecera-referencia">
          <h2 className="titulo-capitulo marca-seccion">De la A a la Z</h2>
          <Filete />
          {r.referencia.epigrafe ? (
            <div className="epigrafe">
              <div className="epigrafe-texto" dangerouslySetInnerHTML={{ __html: r.referencia.epigrafe.html }} />
              <div className="epigrafe-autor">— {r.referencia.epigrafe.autor}</div>
            </div>
          ) : (
            <div className="epigrafe pendiente">[epígrafe pendiente]</div>
          )}
        </header>
        {r.referencia.intro.map((b, i) => (
          <div key={i} className="aviso-referencia">
            <BloqueVista b={b} />
          </div>
        ))}
        {letras.map((l) => (
          <Fragment key={l.letra}>
            <div className="letra">
              <span className="letra-linea" />
              <span className="letra-texto">{l.letra}</span>
              <span className="letra-linea" />
            </div>
            {l.entradas.map((e) => (
              <EntradaVista key={e.id} e={e} />
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

function EntradaVista({ e }: { e: Entrada }) {
  return (
    <article className="entrada" id={e.id} data-letra={e.letra}>
      <h3 className="entrada-titulo">{e.titulo}</h3>
      {e.bloques.map((b, i) => (
        <BloqueVista key={i} b={b} />
      ))}
      {e.vease.length > 0 && (
        <p className="vease">
          <span className="vease-rotulo">Véase también:</span>{' '}
          {e.vease.map((v, i) => (
            <Fragment key={v.titulo}>
              {/* Con una remisión al otro libro («Aprende a jugar, «El turno»»), la coma ya no separa: punto y coma. */}
              {i > 0 && (e.vease.some((x) => !(x.id && x.libro === 'referencia')) ? '; ' : ', ')}
              {v.id && v.libro === 'referencia' ? (
                <>
                  <a href={`#${v.id}`} className="vease-termino">
                    {v.titulo}
                  </a>
                  <span className="pag">
                    {' '}
                    (pág.&nbsp;
                    <a className="num-pag" href={`#${v.id}`} />)
                  </span>
                </>
              ) : (
                <>
                  <i>Aprende a jugar</i>, «<span className="vease-termino">{v.titulo}</span>»
                </>
              )}
            </Fragment>
          ))}
          .
        </p>
      )}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Créditos

// Créditos provisionales (aprobados por Albert); faltan las pruebas de juego y los agradecimientos.
function Creditos({ libro }: { libro: LibroId }) {
  return (
    <section className="creditos" id="creditos">
      <h2 className="titulo-preliminar marca-seccion">Créditos</h2>
      <Filete />
      <dl className="creditos-lista">
        <dt>Diseño del juego</dt>
        <dd>Albert Serrat</dd>
        <dt>Desarrollo y maquetación</dt>
        <dd>Albert Serrat, con la ayuda de Claude (Anthropic)</dd>
        <dt>Ilustraciones</dt>
        <dd>Provisionales, generadas con Midjourney. Las cartas sin ilustración llevan el hueco «Ilustración pendiente».</dd>
        <dt>Tipografías</dt>
        <dd>IM Fell English SC (Igino Marini) · Alegreya y Alegreya Sans (Juan Pablo del Peral, Huerta Tipográfica)</dd>
        <dt>Pruebas de juego</dt>
        <dd className="pendiente">[pendiente]</dd>
        <dt>Agradecimientos</dt>
        <dd className="pendiente">[pendiente]</dd>
      </dl>
      <p className="creditos-pie">
        Sea Scoundrels · {TITULO[libro]} · Reglamento versión 1.0. Este libro se genera a partir del reglamento: si una carta y el reglamento no coinciden, manda la carta.
      </p>
    </section>
  )
}
