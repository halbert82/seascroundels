// La misión en curso: su carta y su Avance, la carta de Peligro revelada y el panel de la Prueba.

import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { iconosDe, porId } from '../../engine/catalogo.ts'
import { destinoDe } from '../../engine/destinos.ts'
import { copia } from '../../engine/estado.ts'
import { desgloseDificultad, desgloseTotal, dificultadPrueba, nombreDelEncuentro, prevision, totalPrueba, type ParteDesglose } from '../../engine/prueba.ts'
import type { Decision, Estado, InstId } from '../../engine/tipos.ts'
import { valor } from '../../engine/valores.ts'
import { Destino } from '../cartas/CartaPeligro.tsx'
import { vistaDeCarta } from '../cartas/vista.ts'
import { describirEfectos } from '../textos/decisiones.ts'
import { impideRetirarse, impideSuperar } from '../../engine/definiciones.ts'
import { textoModSiguiente } from '../../engine/tareas/efectos.ts'
import { avancePrevisto } from '../../engine/tareas/encuentro.ts'
import { fichasVisibles, motivoSinSuperar } from '../../engine/misiones2/comun.ts'
import { anchoCentro } from './disposicion.ts'
import { useLienzo } from './Lienzo.tsx'
import { CartaMesa } from './CartaMesa.tsx'
import { CartaDe, useMesa } from './contexto.tsx'
import { DorsoEscalado } from './Dorso.tsx'
import { habilidadElegida, type Seleccion } from './interaccion.ts'
import { duracion, useVelocidad } from './preferencias.ts'
import { Icono, Numero } from './Zonas.tsx'
import { Explicable } from './Explicacion.tsx'
import { useAmpliable } from './Zoom.tsx'
import { AYUDA_FICHA_MISION, AYUDA_REGLA } from '../textos/glosario.ts'

function BarraAvance({ actual, necesario }: { actual: number; necesario: number }) {
  const velocidad = useVelocidad()
  return (
    <div className="avance" title={`Avance: ${actual} de ${necesario}`}>
      <div className="avance-cabecera">
        <Icono id="avance" />
        <span>Avance</span>
        <span className="avance-n">
          <Numero valor={actual} />
          <small>/ {necesario}</small>
        </span>
      </div>
      <div className="avance-barra">
        <motion.div
          className="avance-lleno"
          initial={false}
          animate={{ width: `${Math.min(100, (100 * actual) / Math.max(1, necesario))}%` }}
          transition={{ duration: duracion(velocidad, 0.35) }}
        />
        {Array.from({ length: Math.max(0, necesario - 1) }, (_, i) => (
          <span key={i} className="avance-corte" style={{ left: `${(100 * (i + 1)) / necesario}%` }} />
        ))}
      </div>
    </div>
  )
}

/** La última carta de Peligro revelada, aunque ya se haya resuelto (para que no pase sin verse). */
function ultimaRevelada(s: Estado, desde: number): InstId | null {
  for (let i = s.registro.length - 1; i >= Math.max(0, desde - 40); i--) {
    const d = s.registro[i]?.dato
    if (d?.tipo === 'revelado' && d.como === 'encuentro') return d.inst
  }
  return null
}

export function ZonaMision({ desde, decision, sel }: { desde: number; decision: Decision | null; sel: Seleccion | null }) {
  const { s } = useMesa()
  const { ancho } = useLienzo()
  const m = s.mision
  if (!m) return null
  const necesario = valor(s, { tipo: 'avanceNecesario', mision: m.carta })
  const enc = s.zonas.encuentro[0]
  const centro = anchoCentro(ancho) - 26
  const escalaPeligro = Math.max(0.46, Math.min(0.62, (centro * 0.32) / 378))
  const anchoPanel = centro - 378 * escalaPeligro - 16
  const resuelta = !enc ? ultimaRevelada(s, desde) : null
  return (
    <section className="zona zona-mision">
      <div className="mision-cabecera">
        <CartaDe inst={m.carta} escala={0.34} />
        <div className="mision-estado">
          <BarraAvance actual={copia(s, m.carta).avance} necesario={necesario} />
          {fichasVisibles(s).length > 0 && (
            <div className="mision-fichas">
              {fichasVisibles(s).map((f) => (
                <Explicable
                  key={f.ficha}
                  ayuda={AYUDA_FICHA_MISION[f.ficha]}
                  className={`ficha-mision${f.umbral > 0 && f.n >= f.umbral - 1 ? ' cerca' : ''}`}
                  etiqueta={`${f.nombre}: ${f.umbral > 0 ? `${f.n} de ${f.umbral}` : f.n}. ${f.nota}`}
                >
                  {f.nombre} <b>{f.umbral > 0 ? `${f.n}/${f.umbral}` : f.n}</b>
                </Explicable>
              ))}
            </div>
          )}
          <div className="mision-notas">
            <span>
              {m.cartasResueltas} {m.cartasResueltas === 1 ? 'carta resuelta' : 'cartas resueltas'}
            </span>
            {m.cartasResueltas === 0 && <span className="aviso">Hay que resolver al menos una carta para superarla</span>}
            {m.mazoMezclado && <span>Revelas del mazo de la misión</span>}
            {impideSuperar(s) && <span className="aviso">Una carta en juego te impide superarla</span>}
            {motivoSinSuperar(s) && <span className="aviso">{motivoSinSuperar(s)}</span>}
            {(m.sinRetirada || impideRetirarse(s)) && <span className="aviso">No puedes retirarte</span>}
            {(m.modsSiguientes ?? []).map((x, i) => (
              <span key={i} className="pendiente">
                {textoModSiguiente(x)}
              </span>
            ))}
          </div>
          {s.zonas.incautadas.length > 0 && (
            <div className="incautadas">
              <Explicable ayuda={AYUDA_REGLA.incautado} className="incautadas-rotulo">
                Incautado
              </Explicable>
              {s.zonas.incautadas.map((c) => (
                <CartaDe key={c} inst={c} escala={0.16} girar={false} />
              ))}
            </div>
          )}
        </div>
        {s.zonas.peligrosEnJuego.length + s.zonas.cartasMision.length > 0 && (
          <div className="en-juego">
            <Explicable ayuda={AYUDA_REGLA.seQuedaEnJuego} className="en-juego-rotulo">
              En juego
            </Explicable>
            <div className="en-juego-cartas">
              {[...s.zonas.cartasMision, ...s.zonas.peligrosEnJuego].map((c) => (
                <CartaDe key={c} inst={c} escala={0.26} />
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Con scroll propio (layoutScroll: las cartas que vuelan miden bien aunque se haya bajado). */}
      <motion.div layoutScroll className="mision-cuerpo">
        <div className="hueco-encuentro">
          {enc ? (
            <CartaDe inst={enc} escala={escalaPeligro} revelar="peligros" />
          ) : resuelta && s.cartas[resuelta] ? (
            <div className="resuelta">
              <CartaMesa inst={`resuelta-${resuelta}`} sinVuelo id={copia(s, resuelta).id} escala={escalaPeligro} marca="atenuada" />
              <span className="sello">Resuelta</span>
            </div>
          ) : (
            <DorsoEscalado tipo="peligros" escala={escalaPeligro} />
          )}
        </div>
        <PanelPrueba decision={decision} sel={sel} ancho={anchoPanel} />
      </motion.div>
    </section>
  )
}

function Partes({ partes }: { partes: ParteDesglose[] }) {
  return (
    <span className="partes">
      {partes.map((p, i) => (
        <span key={i} className={`parte parte-${p.tipo}${p.anulada ? ' anulada' : ''}`}>
          {i > 0 && <span className="mas">{p.n < 0 ? '−' : '+'}</span>}
          <span className="parte-n">{i === 0 ? p.n : Math.abs(p.n)}</span>
          <span className="parte-etiqueta">{p.etiqueta}</span>
        </span>
      ))}
    </span>
  )
}

/** Panel de la Prueba en curso (o la previsión mientras comprometes). */
export function PanelPrueba({ decision, sel, ancho }: { decision: Decision | null; sel: Seleccion | null; ancho: number }) {
  const { s } = useMesa()
  const p = s.prueba
  if (!p) return <div className="panel-prueba vacio">Sin Prueba en curso</div>
  const enc = { nombre: nombreDelEncuentro(s, p.encuentro) }

  // Comprometiendo: previsión con lo elegido en la mesa.
  if (decision?.tipo === 'comprometer') {
    const opcion = sel?.opcion ?? 0
    const hab = habilidadElegida(decision, sel ?? { de: '', cartas: [], opcion: 0, reparto: {}, mejora: null })
    const tripulantes = (sel?.cartas ?? []).filter((c) => decision.tripulantes.includes(c))
    const cartas = (sel?.cartas ?? []).filter((c) => decision.cartas.includes(c) && hab && iconosDe(copia(s, c).id, hab) > 0)
    const pv = prevision(s, p.encuentro, opcion, tripulantes, tripulantes.length > 0 ? cartas : [])
    return (
      <div className="panel-prueba">
        <Cabecera titulo={enc.nombre} hab={hab} />
        <Marcador total={pv.total} dificultad={pv.dificultad} prevision nadie={tripulantes.length === 0} />
        <AvanceDeLaPrueba hab={hab} />
        <p className="prueba-nota">
          {p.destino
            ? 'El Destino ya está a la vista (se aplica al comprometer). Pulsa Tripulantes y cartas de tu mano para comprometerlos.'
            : 'Previsión antes del Destino. Pulsa Tripulantes y cartas de tu mano para comprometerlos.'}
        </p>
        {p.destino && <DestinoGrande inst={p.destino} cancelado={p.destinoCancelado} ancho={Math.min(ancho, 400)} />}
      </div>
    )
  }

  if (p.automatica) {
    return (
      <div className="panel-prueba">
        <Cabecera titulo={enc.nombre} hab={p.hab} />
        <div className="marcador superada">
          <span className="marcador-texto">Superada automáticamente</span>
        </div>
      </div>
    )
  }

  const total = totalPrueba(s)
  const dificultad = dificultadPrueba(s)
  return (
    <div className={`panel-prueba${p.destino ? ' con-destino' : ''}`}>
      <Cabecera titulo={enc.nombre} hab={p.hab} />
      <Marcador total={total} dificultad={dificultad} nadie={p.comprometidos.length === 0} falla={p.falla} resultado={p.resultado} />
      <AvanceDeLaPrueba hab={p.hab} resultado={p.resultado} />
      <div className="desglose">
        <div className="desglose-fila">
          <span className="desglose-titulo">Total</span>
          {desgloseTotal(s).length > 0 ? <Partes partes={desgloseTotal(s)} /> : <span className="vacio">nadie comprometido</span>}
        </div>
        <div className="desglose-fila">
          <span className="desglose-titulo">Dificultad</span>
          <Partes partes={desgloseDificultad(s)} />
        </div>
      </div>
      {p.destino && <DestinoGrande inst={p.destino} cancelado={p.destinoCancelado} ancho={Math.min(ancho, 400)} />}
    </div>
  )
}

/** «Si la superas: +3 · Si no la superas: +1»: el Avance del encuentro según cómo salga la Prueba. */
function AvanceDeLaPrueba({ hab, resultado }: { hab: 'NAV' | 'COM' | 'EXP' | null; resultado?: 'superada' | 'fallada' | null }) {
  const { s } = useMesa()
  const a = avancePrevisto(s, hab)
  if (!a || a.siSuperas === a.siNo) return null
  return (
    <p className="prueba-avance">
      <Icono id="avance" />
      <span className={resultado === 'fallada' ? 'apagado' : resultado === 'superada' ? 'logrado' : ''}>Si la superas: +{a.siSuperas}</span>
      <span className="punto">·</span>
      <span className={resultado === 'superada' ? 'apagado' : resultado === 'fallada' ? 'logrado' : 'sin-superar'}>Si no la superas: +{a.siNo}</span>
    </p>
  )
}

function Cabecera({ titulo, hab }: { titulo: string; hab: 'NAV' | 'COM' | 'EXP' | null }) {
  return (
    <div className="prueba-cabecera">
      <span className="prueba-rotulo">Prueba</span>
      <span className="prueba-titulo">{titulo}</span>
      {hab && (
        <span className={`prueba-hab hab-${hab.toLowerCase()}`}>
          <Icono id={hab} /> {hab}
        </span>
      )}
    </div>
  )
}

function Marcador(p: { total: number; dificultad: number; prevision?: boolean; nadie?: boolean; falla?: boolean; resultado?: 'superada' | 'fallada' | null }) {
  const llega = !p.falla && !p.nadie && p.total >= p.dificultad
  const estado = p.resultado ?? (llega ? 'llega' : 'no-llega')
  const texto = p.falla
    ? 'El Destino la hace fallar'
    : p.nadie
      ? 'Sin nadie comprometido, se falla'
      : p.resultado === 'superada'
        ? 'Superada'
        : p.resultado === 'fallada'
          ? 'Fallada'
          : llega
            ? p.prevision
              ? 'Llegarías'
              : 'Llegas'
            : p.dificultad - p.total === 1
              ? 'Te falta 1'
              : `Te faltan ${p.dificultad - p.total}`
  return (
    <div className={`marcador ${estado}${p.prevision ? ' prevision' : ''}`}>
      <div className="marcador-num">
        <span className="cifra total">
          <Numero valor={p.total} />
        </span>
        <span className="contra">contra</span>
        <span className="cifra dificultad">
          <Numero valor={p.dificultad} />
        </span>
      </div>
      <span className="marcador-texto">{texto}</span>
    </div>
  )
}

/** El Destino revelado, ampliado, con su línea Sin oposición en palabras (tachada si hay alguien comprometido). */
function DestinoGrande({ inst, cancelado, ancho }: { inst: InstId; cancelado: boolean; ancho: number }) {
  const { s } = useMesa()
  const id = copia(s, inst).id
  const vista = vistaDeCarta(porId(id))
  const d = destinoDe(id)
  const escala = Math.min(0.95, ancho / 362)
  const conSinOposicion = d.sinOposicion.length > 0
  const hayComprometidos = (s.prueba?.comprometidos ?? []).some((c) => s.zonas.tripulacion.includes(c))
  const velocidad = useVelocidad()
  const ref = useRef<HTMLDivElement>(null)
  // La carta de la que sale el Destino se amplía al pasar por él (o al tocarlo).
  const ampliable = useAmpliable(id)
  // Al revelarse, el centro baja lo justo para que el Destino se vea entero (no queda bajo la barra de acciones).
  useEffect(() => {
    const el = ref.current
    const marco = el?.closest<HTMLElement>('.mision-cuerpo, .prueba-en-puerto')
    if (!el || !marco) return
    const t = window.setTimeout(() => {
      const sobra = el.getBoundingClientRect().bottom - marco.getBoundingClientRect().bottom
      const escalaLienzo = marco.getBoundingClientRect().height / (marco.offsetHeight || 1)
      if (sobra > 0) marco.scrollTo({ top: marco.scrollTop + sobra / (escalaLienzo || 1) + 6, behavior: 'smooth' })
    }, duracion(velocidad, 0.36) * 1000)
    return () => window.clearTimeout(t)
  }, [inst, velocidad])
  if (vista.forma !== 'peligro' && vista.forma !== 'mazoPropio') return null
  return (
    <motion.div
      ref={ref}
      key={inst}
      className={`destino-grande${cancelado ? ' cancelado' : ''}${conSinOposicion && hayComprometidos ? ' so-no-aplica' : ''}`}
      initial={duracion(velocidad, 1) > 0 ? { rotateX: 90, opacity: 0 } : false}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: duracion(velocidad, 0.35) }}
    >
      <span className="destino-rotulo">Destino</span>
      <div
        className="destino-ventana"
        style={{ width: 362 * escala, height: 132 * escala }}
        onPointerDown={ampliable.onPointerDown}
        onPointerEnter={ampliable.onPointerEnter}
        onPointerLeave={ampliable.onPointerLeave}
        onContextMenu={ampliable.onContextMenu}
        onClick={(e) => ampliable.alPulsar(e.currentTarget)}
      >
        <div className="destino-solo" style={{ transform: `scale(${escala})` }}>
          <Destino d={vista.destino} entraDuranteLaPartida={false} />
        </div>
      </div>
      {conSinOposicion && (
        <p className="sin-oposicion">
          <span className="so-etiqueta">Sin oposición:</span> <span className="so-efecto">{describirEfectos(d.sinOposicion)}</span>
          <span className="so-estado">{cancelado ? 'cancelado' : hayComprometidos ? 'no se aplica: hay Tripulantes comprometidos' : 'se aplica: no hay nadie comprometido'}</span>
        </p>
      )}
      {cancelado && <span className="sello cancelado">Cancelado</span>}
    </motion.div>
  )
}
