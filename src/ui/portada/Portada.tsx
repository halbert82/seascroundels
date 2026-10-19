// Portada: título, «Nueva partida», «Continuar» (si hay una partida guardada) y la galería.

import { motion } from 'motion/react'
import arteGaleon from '../../../assets/arte/cap_galeon.jpg'
import { partidaGuardada } from '../mesa/usePartida.ts'
import { LIBROS } from '../reglamento.ts'
import './portada.css'

export function Portada({ irA, nueva }: { irA: (ruta: string) => void; nueva: () => void }) {
  const guardada = partidaGuardada()
  const empezarNueva = () => {
    if (guardada && !window.confirm('¿Empezar una partida nueva? Se perderá la partida guardada.')) return
    nueva()
  }
  return (
    <div className="portada" style={{ backgroundImage: `url(${arteGaleon})` }}>
      <div className="portada-velo" />
      <motion.div className="portada-contenido" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <span className="portada-antetitulo">El Caribe, 1670</span>
        <h1>Sea Scoundrels</h1>
        <p className="portada-lema">Un juego de cartas pirata en solitario</p>
        <div className="portada-botones">
          {guardada && (
            <button type="button" className="boton principal grande" onClick={() => irA('/partida')}>
              Continuar
              <small>
                Turno {guardada.turno} · {guardada.reputacion}/{guardada.reputacionObjetivo} de reputación
              </small>
            </button>
          )}
          <button type="button" className={`boton grande${guardada ? '' : ' principal'}`} onClick={empezarNueva}>
            Nueva partida
            <small>Diego «Garra» Mendoza en Tortuga · partida normal</small>
          </button>
        </div>
        <div className="portada-reglamento">
          <span className="portada-reglamento-rotulo">Reglamento</span>
          {LIBROS.map((l) => (
            <span key={l.nombre} className="portada-libro">
              <a className="libro" href={l.web}>
                {l.nombre}
              </a>
              <a className="pdf" href={l.pdf} download title={`Descargar «${l.nombre}» en PDF`}>
                PDF
              </a>
            </span>
          ))}
        </div>
        <button type="button" className="enlace" onClick={() => irA('/galeria')}>
          Galería de cartas
        </button>
      </motion.div>
    </div>
  )
}
