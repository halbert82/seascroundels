// Galería con todas las cartas de la Caja básica dibujadas desde los datos.
// Permite compararlas con las imágenes de referencia (lado a lado o por diferencia).

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CATALOGO as TODAS, type EntradaCatalogo, type TipoCarta } from '../../engine/catalogo.ts'

/** Las cartas de la caja: sin los Peligros antiguos, que solo se conservan para las pruebas del motor. */
const CATALOGO = TODAS.filter((e) => !(e.tipo === 'peligro' && e.carta.retirada))
import { CartaEscalada, dimensiones } from '../cartas/Carta.tsx'
import './galeria.css'

const URLS_REFERENCIA = import.meta.glob<string>('../../../referencia/cartas/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

function urlReferencia(num: number): string | undefined {
  return URLS_REFERENCIA[`../../../referencia/cartas/${String(num).padStart(3, '0')}.webp`]
}

interface Grupo {
  id: string
  nombre: string
  tipos: TipoCarta[]
}

const GRUPOS: Grupo[] = [
  { id: 'todas', nombre: 'Todas', tipos: [] },
  { id: 'capitan', nombre: 'Capitanes y Barco', tipos: ['capitan', 'barco'] },
  { id: 'tripulantes', nombre: 'Tripulantes', tipos: ['tripulante'] },
  { id: 'mejoras', nombre: 'Mejoras', tipos: ['mejoraBarco', 'mejoraTripulante'] },
  { id: 'mano', nombre: 'Eventos y Habilidades', tipos: ['evento', 'habilidad'] },
  { id: 'peligros', nombre: 'Peligros', tipos: ['peligro', 'mazoPropio'] },
  { id: 'misiones', nombre: 'Misiones', tipos: ['capitulo', 'pasajero', 'cartaMision'] },
  { id: 'tesoros', nombre: 'Tesoros', tipos: ['tesoro'] },
  { id: 'escenario', nombre: 'Escenario y Puertos', tipos: ['escenario', 'puerto'] },
]

type Modo = 'cartas' | 'lado' | 'diferencia'

const MODOS: { id: Modo; nombre: string; ayuda: string }[] = [
  { id: 'cartas', nombre: 'Cartas', ayuda: 'Solo las cartas dibujadas desde los datos' },
  { id: 'lado', nombre: 'Comparar', ayuda: 'Cada carta junto a su imagen de referencia' },
  { id: 'diferencia', nombre: 'Diferencia', ayuda: 'Imagen de referencia superpuesta: lo que coincide se ve negro' },
]

const TAMANOS = [
  { id: 's', nombre: 'Pequeñas', escala: 0.5 },
  { id: 'm', nombre: 'Medianas', escala: 0.64 },
  { id: 'l', nombre: 'Grandes', escala: 0.8 },
] as const

function nombreDe(e: EntradaCatalogo): string {
  return 'nombre' in e.carta ? e.carta.nombre : ''
}

function descripcion(e: EntradaCatalogo): string {
  const copias = e.copias === 1 ? '1 copia' : `${e.copias} copias`
  switch (e.tipo) {
    case 'capitulo': {
      const total = e.mision.capitulos.length
      if (e.mision.inicial) return 'Misión inicial'
      if (e.mision.aventura) return 'Aventura'
      const capitulos = new Set(e.mision.capitulos.map((c) => c.capitulo)).size
      return `Capítulo ${e.carta.capitulo}${e.carta.rama ? `-${e.carta.rama}` : ''} de ${['', 'I', 'II', 'III'][capitulos] ?? total}`
    }
    case 'pasajero':
      return `Pasajero · ${e.mision.nombre}`
    case 'cartaMision':
      return 'Carta de misión · apartada'
    case 'peligro':
      return `Peligro ${e.carta.nivel.toLowerCase()} · ${e.carta.entraDuranteLaPartida ? 'apartada' : copias}`
    case 'mazoPropio':
      return `${e.mazo.charAt(0).toUpperCase()}${e.mazo.slice(1)} · ${copias}`
    case 'tripulante':
      return `Tripulante · ${e.carta.senda} · ${copias}`
    case 'tesoro':
      return `Tesoro · ${e.carta.tipo}`
    case 'mejoraBarco':
      return `Mejora de barco · ${copias}`
    case 'mejoraTripulante':
      return `Mejora de tripulante · ${copias}`
    case 'evento':
      return `Evento · ${copias}`
    case 'habilidad':
      return `Habilidad · ${copias}`
    case 'capitan':
      return `Capitán · Mando ${e.carta.mando}`
    case 'barco':
      return 'Barco'
    case 'escenario':
      return 'Escenario'
    case 'puerto':
      return `Puerto · muelle ${e.carta.muelle}`
  }
}

interface Ampliada {
  entrada: EntradaCatalogo
  /** La carta está en la mitad izquierda de la pantalla: la ampliación va a la derecha. */
  aLaDerecha: boolean
  fijada: boolean
}

function Referencia({ num, escala, ancho, alto }: { num: number; escala: number; ancho: number; alto: number }) {
  const url = urlReferencia(num)
  if (!url) return null
  return (
    <img
      className="gal-ref"
      src={url}
      alt={`Referencia de la carta ${num}`}
      loading="lazy"
      width={ancho * escala}
      height={alto * escala}
    />
  )
}

function Elemento({
  entrada,
  modo,
  escala,
  onAmpliar,
  onSoltar,
}: {
  entrada: EntradaCatalogo
  modo: Modo
  escala: number
  onAmpliar: (entrada: EntradaCatalogo, elemento: HTMLElement, fijar: boolean) => void
  onSoltar: () => void
}) {
  const { ancho, alto } = dimensiones(entrada)
  return (
    <figure
      className="gal-item"
      data-num={entrada.num}
      onMouseEnter={(ev) => onAmpliar(entrada, ev.currentTarget, false)}
      onMouseLeave={onSoltar}
      onClick={(ev) => onAmpliar(entrada, ev.currentTarget, true)}
    >
      <div className="gal-pareja">
        <div className="gal-marco">
          <CartaEscalada entrada={entrada} escala={escala} />
          {modo === 'diferencia' && (
            <div className="gal-sobre">
              <Referencia num={entrada.num} escala={escala} ancho={ancho} alto={alto} />
            </div>
          )}
        </div>
        {modo === 'lado' && (
          <div className="gal-marco gal-marco-ref">
            <Referencia num={entrada.num} escala={escala} ancho={ancho} alto={alto} />
          </div>
        )}
      </div>
      <figcaption>
        <span className="gal-num">{String(entrada.num).padStart(3, '0')}</span>
        <span className="gal-nombre">{nombreDe(entrada)}</span>
        <span className="gal-meta">{descripcion(entrada)}</span>
      </figcaption>
    </figure>
  )
}

function Ampliacion({ a, modo, onCerrar }: { a: Ampliada; modo: Modo; onCerrar: () => void }) {
  const { ancho, alto } = dimensiones(a.entrada)
  const dos = modo === 'lado'
  const altoCabecera = document.querySelector('.gal-cabecera')?.getBoundingClientRect().height ?? 120
  const disponibleAlto = window.innerHeight - (a.fijada ? 96 : altoCabecera + 60)
  const disponibleAncho = (dos ? window.innerWidth * 0.9 : window.innerWidth * 0.5) / (dos ? 2 : 1)
  const escala = Math.min(1.45, disponibleAlto / alto, disponibleAncho / ancho)
  return (
    <motion.div
      className={a.fijada ? 'gal-zoom fijada' : 'gal-zoom'}
      data-lado={a.fijada ? 'centro' : a.aLaDerecha ? 'derecha' : 'izquierda'}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onCerrar}
    >
      <div className="gal-zoom-pareja">
        <div className="gal-marco">
          <CartaEscalada entrada={a.entrada} escala={escala} />
          {modo === 'diferencia' && (
            <div className="gal-sobre">
              <Referencia num={a.entrada.num} escala={escala} ancho={ancho} alto={alto} />
            </div>
          )}
        </div>
        {dos && (
          <div className="gal-marco gal-marco-ref">
            <Referencia num={a.entrada.num} escala={escala} ancho={ancho} alto={alto} />
          </div>
        )}
      </div>
      {a.fijada && <p className="gal-zoom-ayuda">Toca en cualquier sitio para cerrar</p>}
    </motion.div>
  )
}

export function Galeria() {
  const [grupo, setGrupo] = useState('todas')
  const [modo, setModo] = useState<Modo>('cartas')
  const [tamano, setTamano] = useState<(typeof TAMANOS)[number]['id']>('m')
  const [ampliada, setAmpliada] = useState<Ampliada | null>(null)
  const cabecera = useRef<HTMLElement>(null)

  // La ampliación lateral se coloca por debajo de la cabecera, que cambia de alto según el ancho.
  useEffect(() => {
    const el = cabecera.current
    if (!el) return
    const medir = () => document.documentElement.style.setProperty('--alto-cabecera', `${el.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const escala = TAMANOS.find((t) => t.id === tamano)?.escala ?? 0.64
  const tiposGrupo = GRUPOS.find((g) => g.id === grupo)?.tipos ?? []
  const visibles = useMemo(
    () => (tiposGrupo.length === 0 ? CATALOGO : CATALOGO.filter((e) => tiposGrupo.includes(e.tipo))),
    [tiposGrupo],
  )

  const ampliar = useCallback((entrada: EntradaCatalogo, elemento: HTMLElement, fijar: boolean) => {
    const caja = elemento.getBoundingClientRect()
    const aLaDerecha = caja.left + caja.width / 2 < window.innerWidth / 2
    setAmpliada((actual) => {
      if (actual?.fijada && !fijar) return actual
      return { entrada, aLaDerecha, fijada: fijar }
    })
  }, [])

  const soltar = useCallback(() => {
    setAmpliada((actual) => (actual?.fijada ? actual : null))
  }, [])

  useEffect(() => {
    const alPulsar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAmpliada(null)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])

  return (
    <div className="gal">
      <header className="gal-cabecera" ref={cabecera}>
        <div className="gal-marca">
          <h1>Sea Scoundrels</h1>
          <p>Galería de cartas · Caja básica · {CATALOGO.length} cartas</p>
        </div>
        <nav className="gal-filtros" aria-label="Tipo de carta">
          {GRUPOS.map((g) => {
            const cuenta = g.tipos.length === 0 ? CATALOGO.length : CATALOGO.filter((e) => g.tipos.includes(e.tipo)).length
            return (
              <button
                key={g.id}
                type="button"
                className={g.id === grupo ? 'gal-chip activo' : 'gal-chip'}
                aria-pressed={g.id === grupo}
                onClick={() => {
                  setGrupo(g.id)
                  window.scrollTo({ top: 0 })
                }}
              >
                {g.nombre}
                <span className="gal-cuenta">{cuenta}</span>
              </button>
            )
          })}
        </nav>
        <div className="gal-controles">
          <div className="gal-segmentos" role="group" aria-label="Modo de vista">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.ayuda}
                className={m.id === modo ? 'activo' : ''}
                aria-pressed={m.id === modo}
                onClick={() => setModo(m.id)}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          <div className="gal-segmentos" role="group" aria-label="Tamaño">
            {TAMANOS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === tamano ? 'activo' : ''}
                aria-pressed={t.id === tamano}
                onClick={() => setTamano(t.id)}
              >
                {t.nombre}
              </button>
            ))}
          </div>
        </div>
      </header>

      {modo !== 'cartas' && (
        <p className="gal-aviso">
          {modo === 'lado'
            ? 'A la izquierda, la carta dibujada desde los datos; a la derecha, su imagen de referencia.'
            : 'La imagen de referencia está superpuesta en modo diferencia: lo que coincide se ve negro y lo que cambia, iluminado.'}
        </p>
      )}

      <main className={modo === 'lado' ? 'gal-rejilla dobles' : 'gal-rejilla'}>
        {visibles.map((entrada) => (
          <Elemento
            key={entrada.num}
            entrada={entrada}
            modo={modo}
            escala={escala}
            onAmpliar={ampliar}
            onSoltar={soltar}
          />
        ))}
      </main>

      <AnimatePresence>
        {ampliada && (
          <Ampliacion
            key={`${ampliada.entrada.num}-${ampliada.fijada}`}
            a={ampliada}
            modo={modo}
            onCerrar={() => setAmpliada(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
