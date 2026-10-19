// «Mazos de inicio», al final de «Aprende a jugar»: la partida de iniciación y la lista de sus dos mazos, sacadas de los
// mazos predefinidos de la app (data/cartas.json). Así quien juegue con las cartas en la mesa puede preparar la
// primera partida, y si cambian los mazos de la app, cambia el libro.

import { DATOS } from "../engine/datos.ts";
import { nombreDe, porId, type TipoCarta } from "../engine/catalogo.ts";
import { MODOS } from "../engine/preparacion.ts";
import type { Capitulo } from "./fuente.ts";
import { Filete, Miniatura } from "./piezas.tsx";

interface Linea {
  id: string;
  copias: number;
  nombre: string;
  num: number;
}

/** Las cartas de un mazo, sin repetir y con sus copias, agrupadas por tipo (en el orden de `grupos`). */
function agrupar(
  ids: string[],
  grupos: { titulo: string; tipos: TipoCarta[] }[],
): { titulo: string; lineas: Linea[]; total: number }[] {
  const copias = new Map<string, number>();
  for (const id of ids) copias.set(id, (copias.get(id) ?? 0) + 1);
  const orden = new Intl.Collator("es", { sensitivity: "base" });
  const sinSignos = (t: string) => t.replace(/^[^\p{L}]+/u, "");
  return grupos.map((g) => {
    const lineas = [...copias]
      .filter(([id]) => g.tipos.includes(porId(id).tipo))
      .map(([id, n]) => ({
        id,
        copias: n,
        nombre: nombreDe(id),
        num: porId(id).num,
      }))
      .sort((a, b) => orden.compare(sinSignos(a.nombre), sinSignos(b.nombre)));
    return {
      titulo: g.titulo,
      lineas,
      total: lineas.reduce((n, l) => n + l.copias, 0),
    };
  });
}

function Lista({
  titulo,
  ids,
  grupos,
  columnas = false,
}: {
  titulo: string;
  ids: string[];
  grupos: { titulo: string; tipos: TipoCarta[] }[];
  columnas?: boolean;
}) {
  return (
    <div className="mazo-inicio">
      <h3 className="mazo-inicio-titulo">
        {titulo}
        <span className="mazo-inicio-total">{ids.length} cartas</span>
      </h3>
      <div className={columnas ? "mazo-inicio-grupos" : ""}>
        {agrupar(ids, grupos).map((g) => (
          <div
            key={g.titulo}
            className={`mazo-inicio-grupo ${g.lineas.length > 12 ? "largo" : ""}`}
          >
            <h4 className="mazo-inicio-tipo">
              {g.titulo} <span>({g.total})</span>
            </h4>
            <ul>
              {g.lineas.map((l) => (
                <li key={l.id}>
                  <span className="mazo-inicio-copias">
                    {l.copias}&thinsp;×
                  </span>
                  <span className="mazo-inicio-nombre">{l.nombre}</span>
                  <span className="mazo-inicio-num">
                    {String(l.num).padStart(3, "0")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MazosDeInicio({ c }: { c: Capitulo }) {
  const m = DATOS.mazosPredefinidos;
  const modo = MODOS[m.modo];
  const puerto = porId(m.puertoInicial);
  return (
    <section className="capitulo mazos-de-inicio pagina-nueva" id={c.id}>
      <div className="flujo">
        <header className="cabecera-capitulo cabecera-apendice">
          <h2 className="titulo-capitulo">{c.titulo}</h2>
          <Filete />
        </header>
        <div className="mazos-inicio-partida ancho">
          <div className="mazos-inicio-cartas">
            <Miniatura id={m.capitanInicial} ancho={22} />
            <Miniatura id="barco" ancho={22} />
            <Miniatura id={puerto.id} ancho={22} />
          </div>
          <p>
            Tu primera partida: <b>{nombreDe(m.capitanInicial)}</b> con{" "}
            <b>{DATOS.barco.nombre}</b>, en el puerto de{" "}
            <b>{nombreDe(puerto.id)}</b>, en una partida <b>{m.modo}</b> (
            {modo.reputacion} de reputación para ganar y {modo.escenario} cartas
            de Escenario).
          </p>
          <p>
            Prepara tus dos mazos con estas cartas. El número de la derecha es
            su número de colección, el de abajo a la derecha de cada carta.
          </p>
        </div>
        <div className="mazos-inicio-listas ancho">
          <Lista
            titulo="Mazo del capitán"
            ids={m.mazoDelCapitan}
            columnas
            grupos={[
              { titulo: "Eventos", tipos: ["evento"] },
              { titulo: "Habilidades", tipos: ["habilidad"] },
            ]}
          />
          <Lista
            titulo="Mazo de muelle"
            ids={m.mazoDeMuelle}
            grupos={[
              { titulo: "Tripulantes", tipos: ["tripulante"] },
              { titulo: "Mejoras de barco", tipos: ["mejoraBarco"] },
              { titulo: "Mejoras de tripulante", tipos: ["mejoraTripulante"] },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
