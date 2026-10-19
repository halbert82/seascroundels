// Juega desde la mesa como una persona: el jugador automático decide y el navegador pulsa cartas, menús y botones.
// Lo usan jugar-desde-mesa.mjs (partidas enteras) y comprobar-barra.mjs (la barra superior no se mueve).

export async function pulsarCarta(pagina, inst, etiqueta) {
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

export async function boton(pagina, texto) {
  const b = pagina.locator('.panel-decision button', { hasText: texto }).first()
  if (!(await b.count())) throw new Error(`No hay botón «${texto}»`)
  await b.click()
}

/**
 * Hace la siguiente decisión pulsando la mesa y espera a que el motor avance.
 * Devuelve el resultado de la partida si ha terminado (y entonces no pulsa nada).
 */
export async function jugarDecision(pagina) {
  const fin = pagina.locator('.fin-mision .boton.principal')
  if (await fin.count()) await fin.click()
  const { resultado, d, e, tarea } = await pagina.evaluate(() => {
    const s = window.__mesa.estado()
    return { resultado: s.resultado, d: s.pendiente, e: window.__mesa.sugerencia(), tarea: window.__mesa.jugadas() }
  })
  if (resultado) {
    await pagina.locator('.fin-partida').waitFor()
    return resultado
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
  return null
}
