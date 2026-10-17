// La misión en curso: su carta y su Avance, la carta de Peligro revelada y el panel de la Prueba.

import { motion } from 'motion/react'
import { iconosDe, porId } from '../../engine/catalogo.ts'
import { destinoDe } from '../../engine/destinos.ts'
import { copia } from '../../engine/estado.ts'
import { encuentroDe } from '../../engine/peligros.ts'
import { desgloseDificultad, desgloseTotal, dificultadPrueba, prevision, totalPrueba, type ParteDesglose } from '../../engine/prueba.ts'
import type { Decision, Estado, InstId } from '../../engine/tipos.ts'
import { valor } from '../../engine/valores.ts'
import { CartaEscalada } from '../cartas/Carta.tsx'
import { CartaMesa } from './CartaMesa.tsx'
import { CartaDe, useMesa } from './contexto.tsx'
import { DorsoEscalado } from './Dorso.tsx'
import { habilidadElegida, type Seleccion } from './interaccion.ts'
import { duracion, useVelocidad } from './preferencias.ts'
import { Icono, Numero } from './Zonas.tsx'

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
  const m = s.mision
  if (!m) return null
  const necesario = valor(s, { tipo: 'avanceNecesario', mision: m.carta })
  const enc = s.zonas.encuentro[0]
  const resuelta = !enc ? ultimaRevelada(s, desde) : null
  return (
    <section className="zona zona-mision">
      <div className="mision-cabecera">
        <CartaDe inst={m.carta} escala={0.34} />
        <div className="mision-estado">
          <BarraAvance actual={copia(s, m.carta).avance} necesario={necesario} />
          <div className="mision-notas">
            <span>
              {m.cartasResueltas} {m.cartasResueltas === 1 ? 'carta resuelta' : 'cartas resueltas'}
            </span>
            {m.cartasResueltas === 0 && <span className="aviso">Hay que resolver al menos una carta para superarla</span>}
            {m.mazoMezclado && <span>Revelas del mazo de la misión</span>}
          </div>
        </div>
      </div>
      <div className="mision-cuerpo">
        <div className="hueco-encuentro">
          {enc ? (
            <CartaDe inst={enc} escala={0.52} revelar="peligros" />
          ) : resuelta && s.cartas[resuelta] ? (
            <div className="resuelta">
              <CartaMesa inst={`resuelta-${resuelta}`} sinVuelo id={copia(s, resuelta).id} escala={0.52} marca="atenuada" />
              <span className="sello">Resuelta</span>
            </div>
          ) : (
            <DorsoEscalado tipo="peligros" escala={0.52} />
          )}
        </div>
        <PanelPrueba decision={decision} sel={sel} />
      </div>
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
function PanelPrueba({ decision, sel }: { decision: Decision | null; sel: Seleccion | null }) {
  const { s } = useMesa()
  const p = s.prueba
  if (!p) return <div className="panel-prueba vacio">Sin Prueba en curso</div>
  const enc = encuentroDe(s, p.encuentro)

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
        <p className="prueba-nota">Previsión antes del Destino. Pulsa Tripulantes y cartas de tu mano para comprometerlos.</p>
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
    <div className="panel-prueba">
      <Cabecera titulo={enc.nombre} hab={p.hab} />
      <Marcador total={total} dificultad={dificultad} nadie={p.comprometidos.length === 0} falla={p.falla} resultado={p.resultado} />
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
      {p.destino && <DestinoGrande inst={p.destino} cancelado={p.destinoCancelado} />}
    </div>
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

/** La franja del Destino de su carta, ampliada. */
function DestinoGrande({ inst, cancelado }: { inst: InstId; cancelado: boolean }) {
  const { s } = useMesa()
  const id = copia(s, inst).id
  const entrada = porId(id)
  const escala = 0.86
  const d = destinoDe(id)
  return (
    <motion.div
      key={inst}
      className={`destino-grande${cancelado ? ' cancelado' : ''}`}
      initial={{ rotateX: 90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      title={`Destino «${d.nombre}»`}
    >
      <span className="destino-rotulo">Destino</span>
      <div className="destino-ventana" style={{ width: 362 * escala, height: 130 * escala }}>
        <div style={{ position: 'absolute', left: -8 * escala, top: -391 * escala }}>
          <CartaEscalada entrada={entrada} escala={escala} />
        </div>
      </div>
      {cancelado && <span className="sello cancelado">Cancelado</span>}
    </motion.div>
  )
}
