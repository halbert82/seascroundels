// El panel de decisión: qué te pide el juego ahora, con sus botones, contadores y confirmación.

import type { ReactNode } from 'react'
import { iconosDe, nombreDe } from '../../engine/catalogo.ts'
import { copia } from '../../engine/estado.ts'
import type { Decision, Eleccion, Estado, InstId } from '../../engine/tipos.ts'
import { navParaDistancia } from '../../engine/valores.ts'
import { definicionActual, problemaCompromiso } from '../../engine/prueba.ts'
import { CartaEscalada } from '../cartas/Carta.tsx'
import { porId } from '../../engine/catalogo.ts'
import { loQuePierdesAlRetirarte, textoDecision, textoUso } from '../textos/decisiones.ts'
import { CartaDe, useMesa } from './contexto.tsx'
import { eleccionConfirmada, type Seleccion } from './interaccion.ts'
import { Icono } from './Zonas.tsx'

interface Props {
  decision: Decision
  sel: Seleccion
  setSel: (s: Seleccion) => void
  elegir: (e: Eleccion) => void
}

function Boton({ children, onClick, principal, peligro, desactivado, titulo }: { children: ReactNode; onClick: () => void; principal?: boolean; peligro?: boolean; desactivado?: boolean; titulo?: string }) {
  return (
    <button type="button" className={`boton${principal ? ' principal' : ''}${peligro ? ' peligro' : ''}`} onClick={onClick} disabled={desactivado} title={titulo}>
      {children}
    </button>
  )
}

const TERMINAR: Record<string, string> = {
  jugarCartas: 'Terminar de jugar cartas',
  trasEncuentro: 'Seguir: revelar otra carta',
  ventanaPrueba: 'Resolver la Prueba',
  'pausa.inicio': 'Seguir',
}

export function PanelDecision({ decision: d, sel, setSel, elegir }: Props) {
  const { s, inter } = useMesa()
  const t = textoDecision(s, d)
  const confirmada = eleccionConfirmada(s, d, sel)
  const botones: ReactNode[] = []
  let centro: ReactNode = null

  switch (d.tipo) {
    case 'ventanaAccion':
      for (const a of d.acciones) {
        if (a.tipo === 'usar' && a.uso.fuente === null) {
          botones.push(
            <Boton key={a.uso.clave} onClick={() => elegir({ tipo: 'accion', accion: a })}>
              {textoUso(s, a.uso).carta}
            </Boton>,
          )
        }
      }
      if (d.acciones.some((a) => a.tipo === 'retirarse')) {
        botones.push(
          <Boton key="retirarse" peligro onClick={() => elegir({ tipo: 'accion', accion: { tipo: 'retirarse' } })} titulo={`Vuelves a puerto y ${loQuePierdesAlRetirarte(s)}.`}>
            Retirarte a puerto
          </Boton>,
        )
      }
      if (sel.mejora) {
        botones.push(
          <Boton key="cancelar" onClick={() => setSel({ ...sel, mejora: null })}>
            Cancelar
          </Boton>,
        )
        centro = <span className="pd-aviso">Pulsa quién lleva «{nombreDe(copia(s, sel.mejora).id)}» (o el Barco).</span>
      }
      botones.push(
        <Boton key="terminar" principal onClick={() => elegir({ tipo: 'accion', accion: { tipo: 'terminarPaso' } })}>
          {TERMINAR[d.motivo.clave] ?? 'Seguir'}
        </Boton>,
      )
      break
    case 'elegirCartas': {
      const unaSola = d.min === 1 && d.max === 1
      centro = unaSola ? <span className="pd-aviso">Pulsa la carta que eliges.</span> : <span className="pd-contador">{sel.cartas.length} elegidas · {d.min === d.max ? `elige ${d.min}` : `de ${d.min} a ${d.max}`}</span>
      if (!unaSola) {
        if (d.min === 0 && sel.cartas.length === 0) {
          botones.push(
            <Boton key="ninguna" onClick={() => elegir({ tipo: 'cartas', ids: [] })}>
              Ninguna
            </Boton>,
          )
        } else {
          botones.push(
            <Boton key="confirmar" principal desactivado={!confirmada} onClick={() => confirmada && elegir(confirmada)}>
              Confirmar
            </Boton>,
          )
        }
      }
      break
    }
    case 'elegirOpcion':
      for (const o of d.opciones) {
        botones.push(
          <Boton key={o.clave} principal={d.opciones.length === 1} onClick={() => elegir({ tipo: 'opcion', clave: o.clave })}>
            {o.texto}
          </Boton>,
        )
      }
      if (d.motivo.clave === 'otear' && d.motivo.carta) {
        centro = (
          <span className="pd-carta">
            <CartaEscalada entrada={porId(d.motivo.carta)} escala={0.14} />
          </span>
        )
      }
      break
    case 'ofrecer':
      for (const u of d.usos) {
        const tu = textoUso(s, u)
        botones.push(
          <Boton key={`${u.fuente}/${u.clave}`} principal onClick={() => elegir({ tipo: 'usar', uso: u })} titulo={tu.texto}>
            {tu.carta}
          </Boton>,
        )
      }
      botones.push(
        <Boton key="pasar" onClick={() => elegir({ tipo: 'pasar' })}>
          Pasar
        </Boton>,
      )
      break
    case 'repartir': {
      const puesto = Object.values(sel.reparto).reduce<number>((a, b) => a + (b ?? 0), 0)
      centro = (
        <div className="reparto">
          {(Object.entries(d.maximos) as [InstId, number][]).map(([inst, max]) => {
            const n = sel.reparto[inst] ?? 0
            return (
              <span key={inst} className="reparto-fila" data-inst={inst}>
                <span className="reparto-nombre">{nombreDe(copia(s, inst).id)}</span>
                <button type="button" className="mini" disabled={n <= 0} onClick={() => setSel({ ...sel, reparto: { ...sel.reparto, [inst]: n - 1 } })}>
                  −
                </button>
                <b>{n}</b>
                <button type="button" className="mini" disabled={n >= max || puesto >= d.cantidad} onClick={() => setSel({ ...sel, reparto: { ...sel.reparto, [inst]: n + 1 } })}>
                  +
                </button>
              </span>
            )
          })}
          <span className="pd-contador">
            {puesto} de {d.cantidad}
          </span>
        </div>
      )
      botones.push(
        <Boton key="confirmar" principal desactivado={!confirmada} onClick={() => confirmada && elegir(confirmada)}>
          Confirmar
        </Boton>,
      )
      break
    }
    case 'cubrirDistancia': {
      const nav = navCubierta(s, d, sel.cartas)
      // Fase 10: hay que agotar al menos a un Tripulante; las cartas con NAV solo completan.
      const conTripulante = sel.cartas.some((c) => d.tripulantes.includes(c))
      const vale = nav >= d.distancia && conTripulante
      centro = (
        <span className={`pd-contador ${vale ? 'bien' : 'mal'}`}>
          <Icono id="NAV" /> {nav} de {d.distancia}
          {!conTripulante && sel.cartas.length > 0 && <small> · falta un Tripulante</small>}
        </span>
      )
      botones.push(
        <Boton key="confirmar" principal desactivado={!vale} onClick={() => confirmada && elegir(confirmada)}>
          {d.motivo.clave === 'destina' ? 'Destinar' : 'Zarpar'}
        </Boton>,
      )
      break
    }
    case 'comprometer': {
      if (d.opciones.length > 1) {
        centro = (
          <div className="opciones-prueba">
            {d.opciones.map((o, i) => (
              <button
                key={i}
                type="button"
                className={`opcion-prueba hab-${o.hab.toLowerCase()}${i === sel.opcion ? ' activa' : ''}`}
                onClick={() => setSel({ ...sel, opcion: i, cartas: sel.cartas.filter((c) => d.tripulantes.includes(c)) })}
              >
                <Icono id={o.hab} /> {o.hab} {o.dificultad}
                {o.alternativa && (
                  <small>
                    ({o.alternativa.rasgo}
                    {o.alternativa.comprometido ? ' asignado' : ''} −{o.dificultad - o.alternativa.dificultad})
                  </small>
                )}
              </button>
            ))}
          </div>
        )
      }
      const alguien = sel.cartas.some((c) => d.tripulantes.includes(c))
      // Fase 15: si la asignación no vale (Descomunal, Sin ayuda, «como mucho uno»…), se dice por qué y no se confirma.
      const problema =
        confirmada?.tipo === 'compromiso' && alguien && s.prueba
          ? problemaCompromiso(s, definicionActual(s), d.opciones[confirmada.opcion]?.hab ?? 'COM', confirmada.tripulantes, confirmada.cartas)
          : null
      if (problema) {
        centro = (
          <>
            {centro}
            <span className="pd-contador mal">{problema}</span>
          </>
        )
      }
      botones.push(
        <Boton key="confirmar" principal desactivado={problema !== null} onClick={() => confirmada && !problema && elegir(confirmada)}>
          {alguien ? 'Asignar' : 'No asignar a nadie'}
        </Boton>,
      )
      break
    }
  }

  const libres = d.libres ?? []
  return (
    <div className="panel-decision">
      <div className="pd-texto">
        <h3>{t.titulo}</h3>
        {t.ayuda && <p>{t.ayuda}</p>}
        {libres.length > 0 && (
          <div className="pd-libres">
            <span>También puedes usar:</span>
            {libres.map((u) => (
              <button key={`${u.fuente}/${u.clave}`} type="button" className="ficha-uso" title={textoUso(s, u).texto} onClick={() => elegir({ tipo: 'usar', uso: u })}>
                {textoUso(s, u).carta.replace(/^(Usar|Jugar) /, '')}
              </button>
            ))}
          </div>
        )}
      </div>
      {inter.apartadas.length > 0 && (
        <div className="bandeja">
          <span className="bandeja-rotulo">{rotuloBandeja(s, inter.apartadas)}</span>
          <div className="bandeja-cartas">
            {inter.apartadas.map((c) => (
              <CartaDe key={c} inst={c} escala={inter.apartadas.length > 7 ? 0.24 : 0.3} />
            ))}
          </div>
        </div>
      )}
      {centro && <div className="pd-centro">{centro}</div>}
      <div className="pd-botones">{botones}</div>
    </div>
  )
}

function rotuloBandeja(s: Estado, cartas: readonly InstId[]): string {
  const c = cartas[0]
  if (!c) return ''
  if (s.zonas.mazoMuelle.includes(c)) return 'En el mazo de muelle'
  if (s.zonas.mazoPeligros.includes(c) || s.zonas.mazoMision.includes(c)) return 'Del mazo de Peligros'
  if (s.zonas.resolviendo.includes(c)) return 'Las cartas que miras'
  return 'Cartas para elegir'
}

function navCubierta(s: Estado, d: Extract<Decision, { tipo: 'cubrirDistancia' }>, elegidas: readonly InstId[]): number {
  const tripulantes = elegidas.filter((c) => d.tripulantes.includes(c))
  const cartas = elegidas.filter((c) => d.cartas.includes(c))
  return navParaDistancia(s, tripulantes) + cartas.reduce((n, c) => n + iconosDe(copia(s, c).id, 'NAV'), 0)
}
