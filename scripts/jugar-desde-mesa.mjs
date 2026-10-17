// Juega partidas enteras desde la interfaz: el jugador automático decide y el navegador pulsa la pantalla
// (cartas, menús y botones), como lo haría una persona. Falla si algo no se puede hacer con el ratón o si
// sale un error en la consola.
//
//   npm run build && node scripts/jugar-desde-mesa.mjs        (PARTIDAS=3 para más)

import { chromium } from 'playwright'
import { preview } from 'vite'

const PARTIDAS = Number(process.env.PARTIDAS ?? 1)
const servidor = await preview({ logLevel: 'error', preview: { port: 5199 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
let fallo = null

async function pulsarCarta(pagina, inst, etiqueta) {
  const carta = pagina.locator(`[data-inst="${inst}"]`).first()
  if (!(await carta.count())) {
    const donde = await pagina.evaluate((i) => {
      const s = window.__mesa.estado()
      const zona = Object.entries(s.zonas).find(([, l]) => l.includes(i))?.[0]
      return `${s.cartas[i]?.id} en ${zona} (decisión «${s.pendiente?.motivo.clave}»)`
    }, inst)
    throw new Error(`No está en la mesa la carta ${inst}: ${donde}`)
  }
  await carta.dispatchEvent('click')
  const menu = pagina.locator('.menu-carta')
  if (await menu.count()) {
    const opcion = menu.locator('button', { hasText: etiqueta })
    if (!(await opcion.count())) throw new Error(`El menú de ${inst} no tiene «${etiqueta}»`)
    await opcion.first().click()
  }
}

async function boton(pagina, texto) {
  const b = pagina.locator('.panel-decision button', { hasText: texto }).first()
  if (!(await b.count())) throw new Error(`No hay botón «${texto}»`)
  await b.click()
}

async function jugarUna(n) {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
  pagina.on('pageerror', (e) => errores.push(`partida ${n}: ${e.message}`))
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`partida ${n}: ${m.text()}`))
  await pagina.goto(`${base}?pruebas#/`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => localStorage.clear())
  await pagina.getByRole('button', { name: /Nueva partida/ }).click()
  await pagina.waitForFunction(() => window.__mesa)
  await pagina.evaluate(() => {
    // Sin animaciones: más rápido y sin esperar a que terminen.
    localStorage.setItem('sea-scoundrels/velocidad', 'sin')
  })
  let pasos = 0
  for (;;) {
    if (++pasos > 3000) throw new Error('Demasiados pasos')
    const fin = pagina.locator('.fin-mision .boton.principal')
    if (await fin.count()) await fin.click()
    const { resultado, d, e, tarea } = await pagina.evaluate(() => {
      const s = window.__mesa.estado()
      return { resultado: s.resultado, d: s.pendiente, e: window.__mesa.sugerencia(), tarea: window.__mesa.jugadas() }
    })
    if (resultado) {
      await pagina.locator('.fin-partida').waitFor()
      console.log(`Partida ${n}: ${resultado.gana ? 'victoria' : 'derrota'} en ${pasos} decisiones — ${resultado.motivo}`)
      break
    }
    if (!d || !e) throw new Error('Sin decisión')
    switch (e.tipo) {
      case 'accion': {
        const a = e.accion
        if (a.tipo === 'terminarPaso') await pagina.locator('.panel-decision .boton.principal').last().click()
        else if (a.tipo === 'retirarse') await boton(pagina, 'Retirarte a puerto')
        else if (a.tipo === 'reclutar') await pulsarCarta(pagina, a.carta, 'Reclutar')
        else if (a.tipo === 'despedir') await pulsarCarta(pagina, a.carta, 'Despedir')
        else if (a.tipo === 'adquirir') {
          await pulsarCarta(pagina, a.carta, 'Adquirir')
          const esperando = await pagina.evaluate(() => document.querySelector('.panel-decision .pd-aviso')?.textContent?.includes('Pulsa quién lleva') ?? false)
          if (esperando) await pulsarCarta(pagina, a.destino, 'Para')
        } else if (a.tipo === 'usar') {
          const etiqueta = await pagina.evaluate((u) => window.__mesa.etiquetaUso(u), a.uso)
          await pulsarCarta(pagina, a.uso.fuente ?? 'barco', etiqueta)
        }
        break
      }
      case 'usar': {
        const etiqueta = await pagina.evaluate((u) => window.__mesa.etiquetaUso(u), e.uso)
        if (d.tipo === 'ofrecer') await boton(pagina, etiqueta)
        else await pagina.locator('.ficha-uso', { hasText: etiqueta.replace(/^(Usar|Jugar) /, '') }).first().click()
        break
      }
      case 'pasar':
        await boton(pagina, 'Pasar')
        break
      case 'opcion':
        if (e.clave.startsWith('zarpar:')) await pulsarCarta(pagina, e.clave.slice(7), 'Zarpar')
        else {
          const texto = d.opciones.find((o) => o.clave === e.clave)?.texto
          await boton(pagina, texto)
        }
        break
      case 'cartas': {
        const unaSola = d.tipo === 'elegirCartas' && d.min === 1 && d.max === 1
        if (unaSola) await pulsarCarta(pagina, e.ids[0], 'Elegir')
        else {
          for (const id of e.ids) await pulsarCarta(pagina, id, d.tipo === 'cubrirDistancia' ? 'Usar para la Distancia' : 'Elegir')
          if (d.tipo === 'cubrirDistancia') await boton(pagina, 'Zarpar')
          else if (e.ids.length === 0) await boton(pagina, d.min === 0 ? 'Ninguna' : 'Confirmar')
          else await boton(pagina, 'Confirmar')
        }
        break
      }
      case 'reparto':
        for (const [inst, k] of Object.entries(e.n)) {
          for (let i = 0; i < k; i++) await pagina.locator(`.reparto-fila[data-inst="${inst}"] button`).last().click()
        }
        await boton(pagina, 'Confirmar')
        break
      case 'compromiso':
        if (d.opciones.length > 1) await pagina.locator('.opcion-prueba').nth(e.opcion).click()
        for (const id of e.tripulantes) await pulsarCarta(pagina, id, 'Comprometer')
        for (const id of e.cartas) await pulsarCarta(pagina, id, 'Añadir')
        await boton(pagina, e.tripulantes.length > 0 ? 'Comprometer' : 'No comprometer a nadie')
        break
    }
    // Esperar a que el motor avance.
    await pagina.waitForFunction((antes) => window.__mesa.estado().resultado || window.__mesa.jugadas() !== antes, tarea, { timeout: 5000 }).catch(async () => {
      const aviso = await pagina.locator('.aviso-error').textContent().catch(() => null)
      throw new Error(`La mesa no avanzó con ${JSON.stringify(e)} en «${d.motivo.clave}»${aviso ? `: ${aviso}` : ''}`)
    })
    if (await pagina.locator('.aviso-error').count()) throw new Error(`El motor rechazó una elección: ${await pagina.locator('.aviso-error').textContent()}`)
  }
  await pagina.screenshot({ path: new URL(`../capturas/mesa/final-partida-${n}.png`, import.meta.url).pathname })
  await pagina.close()
}

try {
  for (let n = 1; n <= PARTIDAS; n++) await jugarUna(n)
} catch (e) {
  fallo = e
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
if (errores.length) console.log(`Errores en la consola:\n${errores.join('\n')}`)
if (fallo) {
  console.error(fallo)
  process.exit(1)
}
if (errores.length) process.exit(1)
console.log('Todo se ha podido jugar desde la mesa.')
