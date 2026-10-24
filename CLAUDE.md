# Sea Scoundrels — LCG pirata en solitario (app web)

El juego se llama **Sea Scoundrels**: ese es el título de la app, de la portada y de la pestaña del navegador. «La Sombra del Alba» es el nombre del Barco del jugador, no del juego.

Juego de cartas cooperativo en solitario, al estilo de los LCG (Arkham Horror, El Señor de los Anillos, Marvel Champions, Earthborne Rangers), ambientado en el Caribe de 1670. El diseñador es Albert. El diseño del juego (reglas y cartas) está cerrado en su versión 1.0. Esta app sirve para **jugarlo y probarlo**; los números de las cartas se ajustarán jugando.

## Cómo trabajar con Albert

- Habla siempre en **español**.
- Explica con **conceptos**, no con nombres de ficheros, funciones o siglas. Albert es ingeniero (firmware, TypeScript), pero aquí actúa como diseñador.
- Al terminar algo, da la **conclusión** de cada punto: cerrado, abierto, pendiente de trabajo o esperando su decisión.
- Cuando le plantees una decisión de reglas, dale **ejemplos de juego concretos**.
- **No inventes reglas.** Si el reglamento no cubre un caso, pregunta. Mientras tanto, usa la opción por defecto de la lista de «Decisiones pendientes» y márcala en el código con `// TODO(regla): …`.
- Si queda algo pendiente, termina con un bloque de respuesta que Albert pueda copiar y rellenar. Si él lo corrige, reescríbelo entero.

## Fuentes de verdad (por orden)

1. `docs/reglamento-v1.0.md`: el reglamento completo. Tiene una parte para aprender a jugar, una referencia de la A a la Z y una referencia rápida al final.
2. `data/cartas.json`: todas las cartas de la caja básica (153, con su número de colección). El campo `texto` es la versión 1.0, la buena. La sección `_leyenda` explica el marcado de los textos.
3. Los campos de ayuda que vienen del prototipo antiguo: `fallo`, `exito`, `siempre`, `ops`, `ayudaPrototipo`, `textoPrototipo`. Sirven al motor como pista, pero **si chocan con el texto o el reglamento, mandan el texto y el reglamento**.
4. **Fase 6:** `docs/peligros-2.0.md` (las 55 cartas de Peligro nuevas, que sustituyen a las 25 antiguas: estas se quedan en los datos marcadas `retirada`, solo para las pruebas) y `docs/jugador-2.0.md` (9 cartas de jugador nuevas). En `cartas.json` llevan `"version": 2` (los Peligros) y sus textos completos son solo para leerlos: lo que hacen está escrito a mano por carta en `src/engine/peligros2/` (reglas) y `src/engine/capacidades/jugador2.ts`.
5. **Fase 7:** `docs/misiones-2.0.md` (las 12 misiones 2.0: reglas y recompensas nuevas, capítulos con salida doble, Pasajeros, «¡La guardia!» y los mazos propios rehechos). Las reglas impresas de cada capítulo en `cartas.json` son para leerlas: lo que hace cada uno está escrito a mano en `src/engine/misiones2/`.
6. **Fase 8:** `docs/escenario-2.0.md` (las 14 cartas de Escenario 2.0, que sustituyen a las anteriores; lo que hace cada una está en `src/engine/capacidades/escenario.ts`). Inspirado y Aguerrido son **Ventajas**, no Estados (un efecto que solo ayuda es Ventaja; uno que perjudica o limita es Estado). La Taberna quita todos los Estados de los Tripulantes y el Astillero, todos los del Barco.

Recursos visuales:
- `referencia/cartas/NNN.webp`: imagen de cada carta tal y como está diseñada; el nombre es su número de colección. Es la referencia visual que hay que igualar.
- `referencia/estilo-cartas.css` y `referencia/plantilla-cartas.html`: la maquetación original de las cartas, con el CSS y una plantilla en una sintaxis de plantillas propia. `referencia/ejemplo-datos-render.json` contiene datos de ejemplo para esa plantilla. Pórtala a componentes React.
- `referencia/anatomia/`: tres láminas que explican las partes de las cartas de Tripulante, Misión y Peligro.
- `assets/iconos/*.svg`: iconos del juego. Se usan como máscara CSS y se colorean con `background-color`, como hace el CSS original.
- `assets/arte/*.jpg` y `data/arte.json`: las ilustraciones que ya existen, a qué carta van y su encuadre. Van grandes (1312 px de ancho, 768 las verticales) porque el reglamento las usa a todo el ancho; la mesa y la galería usan una copia pequeña en `assets/arte/mesa/`, que se genera con `npm run arte:mesa` al añadir o cambiar una. El resto de cartas aún no tiene ilustración; lleva un hueco con el texto «Ilustración pendiente».

## Alcance de la versión 0

- **Una partida jugable de principio a fin**, en solitario. Sin cuentas ni servidor, y sin menús más allá de una portada con «Nueva partida» y «Continuar».
- **Todo predefinido** (`mazosPredefinidos` en `cartas.json`): capitán Diego «Garra» Mendoza, puerto Tortuga, modo normal (12 de reputación y 11 cartas de Escenario), el mazo del capitán con 40 cartas (36 hasta la fase 6) y el mazo de muelle con 20 (corregido por Albert: el reglamento pide de 15 a 20).
- **Todas las reglas del reglamento implementadas:**
  - preparación;
  - el turno en 4 pasos;
  - puerto y muelle;
  - pagar descartando cartas, reclutar y adquirir;
  - zarpar y Distancia;
  - revelar Peligros y leer el encuentro del Entorno que toca;
  - Pruebas: comprometer (con las cartas de la mano), Destino, Sin oposición, ventana de acción y resolver;
  - Avance, retirarse y recompensas;
  - mazo de historia y Tesoros;
  - heridas, daño y hundimiento;
  - penalizaciones;
  - Escenario como reloj;
  - ganar y perder.
- **Todas las capacidades de las cartas implementadas.** Cuando una carta pide elegir, la interfaz lo pregunta. Una Respuesta o una Interrupción se ofrece al jugador en su momento, nunca se aplica sola. Una capacidad Obligada se aplica sola.
- **Guardado automático en el navegador**, para cerrar y continuar.
- **Registro de partida** visible: qué se reveló, qué Destino salió, qué se pagó.
- **Deshacer la última acción** mientras no se haya revelado información nueva. Es deseable, no obligatorio.

## Arquitectura

- **Vite + React + TypeScript** (modo estricto). Pruebas con **Vitest**. Animaciones con **Motion** (Framer Motion).
- **El motor va separado de la interfaz** (`src/engine`, sin React):
  - estado serializable, acciones y una función que aplica cada acción;
  - azar con semilla, para reproducir partidas en las pruebas;
  - el motor expone las decisiones pendientes («elige un Tripulante», «¿usas esta Respuesta?») y la interfaz solo las muestra;
  - cada capacidad de carta está en un registro por `id`, con su ventana (Acción, Respuesta, Interrupción, Obligado, Al zarpar, constante).
- **Pruebas del motor:** cada regla del reglamento con su ejemplo de juego convertido en prueba, y cada carta con al menos una prueba. El ejemplo de juego completo del reglamento («Así transcurre el primer turno…») debe reproducirse como prueba.
- **Las cartas se dibujan desde los datos** con componentes React, no con imágenes. Así un cambio de texto o de número en `cartas.json` aparece al instante. Las imágenes de `referencia/` solo sirven para comparar.

## Dirección visual: que se vea profesional desde el principio

- Tiene que parecer **un juego de cartas digital comercial**, no un prototipo. Albert ya tuvo una app anterior que parecía casera y no quiere repetirlo.
- **Mesa:** fondo oscuro con textura sutil (madera de cubierta o carta náutica antigua), zonas claras y con aire. En pantalla tienen que verse:
  - la tripulación y el Barco, con su daño, su Espacio y sus Mejoras;
  - la mano;
  - el muelle;
  - la misión en curso, con su Avance;
  - el mazo de Peligros y la Prueba en curso, con la suma y la dificultad bien visibles;
  - el reloj de Escenario, con los días que quedan;
  - la reputación.
- **Cartas fieles a su diseño** (`referencia/cartas`): mismas tipografías (IM Fell English SC para títulos; Alegreya y Alegreya Sans para textos, de Google Fonts), mismos colores e iconos. Al pasar el ratón por encima o tocar una carta, se amplía para leerla.
- **Animaciones con propósito:**
  - robar y descartar;
  - agotar, girando la carta 90 grados;
  - revelar un Peligro y su Destino, dándole la vuelta a la carta;
  - el Avance sumándose;
  - el daño y las heridas.
  - Rápidas (150–350 ms) y que no bloqueen.
- **Claridad en cada paso:** siempre se ve en qué paso del turno estás y qué puedes hacer. Las acciones posibles se resaltan y las imposibles no se ofrecen.
- **Pantallas:** escritorio primero (1440×900 y 1920×1080), pero usable en tableta horizontal.
- Sin emojis; usa los iconos de `assets/iconos`.
- **Comprueba con capturas** (Playwright) cada pantalla nueva y compara las cartas con su imagen de referencia antes de dar algo por terminado.

## Plan por fases

1. **Esqueleto y despliegue:**
   - proyecto Vite;
   - publicación en GitHub Pages con GitHub Actions (ruta base `/<nombre-del-repo>/`);
   - galería con todas las cartas dibujadas desde los datos, para compararlas con `referencia/cartas`. Albert la revisa antes de seguir.
2. **Motor, primera parte:** preparación, turno, puerto, muelle, pagar, reclutar, adquirir y Escenario, con sus pruebas.
3. **Motor, segunda parte:** misiones, Peligros, Pruebas, Destino, heridas, daño, recompensas, historia, ganar y perder, con sus pruebas.
4. **Capacidades de todas las cartas**, con sus pruebas.
5. **Mesa de juego y pulido visual:** animaciones, registro, guardado y deshacer.
6. **Peligros 2.0:** reglas nuevas (se queda en juego, Estados, Elige, Sin ayuda, Abordaje, Persigue, Incautado, ocupar el muelle), las 55 cartas nuevas en lugar de las antiguas y 9 cartas de jugador nuevas. Punto de control con el Grupo A (cartas 1–11) y entrega final con todas y el informe de equilibrio.
7. **Misiones 2.0:** reglas y recompensas nuevas de las 12 misiones, capítulos II-a/II-b, Pasajeros, fichas de misión, Gesta, finales con elección, «¡La guardia!» y los mazos propios con el formato 2.0 (cartas 218–225). Para las pruebas de cartas y reglas generales hay misiones de prueba sin reglas (`pruebas-mar5`, `pruebas-nat3`…).
8. **Reglamento al día, Estados y Ventajas, puertos y Escenario 2.0:** el reglamento recoge las reglas de Peligro de la fase 6; Inspirado y Aguerrido pasan a ser Ventajas; Taberna y Astillero quitan los Estados; las 14 cartas de Escenario nuevas. Para las pruebas que solo necesitan pasar turnos hay una carta de Escenario de prueba sin efecto (`pruebas-calma`).

9. **Reglamento maquetado:** dos libros («Aprende a jugar» y «Referencia de reglas») generados desde `docs/reglamento-v1.0.md` con `npm run reglamento` (React + Paged.js en `src/libro/`, PDF con el Chromium de Playwright; la publicación los genera). Las marcas `[!tema]`, `[!ejemplo]`, `[!importante]`, `[!consejo]`, `[!epigrafe]` y `[!grafico]` están explicadas al principio del reglamento. No se toca nada a mano: si algo sale mal maquetado, se arregla en la maqueta o en el reglamento. Lo ancho va centrado en la página; cada capítulo de «Aprende a jugar» lleva su ilustración (`src/libro/arte.ts`) y las columnas exteriores casi vacías, una viñeta. `npm run comprobar:reglamento` revisa que nada se monte, se descentre o se salga, que no queden marcas pendientes ni páginas casi vacías y que ninguna palabra se parta entre dos páginas. El índice de términos de la Referencia sale solo de las entradas y sus negritas (una prueba exige que tenga cada término en negrita, palabra clave y Rasgo de las cartas) y «Mazos de inicio», de los mazos predefinidos.

12. **Travesías de 2 y 4 capítulos:** El espía de Cádiz y El barco fantasma pasan a dos capítulos (135 y 147 unen los dos primeros; quedan libres los números 136 y 148); La Flota de la Plata y El templo perdido, a cuatro, con dos capítulos III nuevos (238 «Al abordaje del galeón» y 239 «La escalinata de los sacerdotes», con la ficha de Derrumbe). Al superar un capítulo, el siguiente va siempre encima del mazo de Misiones (sin barajar) y sale enseguida entre las disponibles. Detalle en la sección «Fase 12» de `docs/decisiones.md`.

13. **Revisión de las cartas de Peligro (tandas 1 y 2):** cartas 154 a 159, reglas de estilo de los Peligros y mazos propios (sin «Sin Prueba», Avance y daño con icono, «superior», «Elige» por líneas, «Vigía −2» bajo la Prueba, Otear siempre del mazo de Peligros), heridas libres en los encuentros, dos Destinos («Bruma en la selva») y la carta nueva 240 «Arenga del capitán» (en la colección, no en el mazo de inicio). Segunda ronda: Destinos simplificados (41 solo con modificador y Sin oposición; 6 con «Inflige 1 herida a un Tripulante asignado»), «Otea N», «Prepara a 1 Tripulante asignado», heridas libres por asignado (P79) y Cañones con «[mar], [agotar]:». Detalle en la sección «Fase 13» de `docs/decisiones.md`.

14. **Rotación de la tripulación:** palabra clave Enrolado N (pierde 1 ficha al final de cada turno, en la tripulación, y se va sin ninguna; Desgaste se quitó en la segunda ronda), seis Tripulantes nuevos (241–246; la Carne de cañón y el Galeote fugado pagan una herida para sumar, como el Filibustero borracho) y el jugador automático que despide para hacer sitio. Excepción temporal: mazo de muelle de 26 cartas para probar la fase 14 (25 desde que salió el Práctico del puerto, en la fase 15); se quita al rehacer los mazos de inicio. Tercera ronda: fuera el rehén (lo que capturaba, ahora descarta), reclutar sin coste revisado carta por carta, Abordaje sin tope y sin Cañones (ninguno pasa de 4) e inventario de Rasgos. Detalle en las secciones «Fase 14» de `docs/decisiones.md`.

15. **Misiones nuevas y Peligros nuevos:** palabras clave Descomunal N y Alerta; el Pasajero deja de ser regla general (no ocupa Capacidad; su carta lo dice todo) y las Habilidades pueden tener texto. Travesías «La Isla del Tesoro» (capítulo II al azar, 255–258), «La carrera de van Hoorn» (el rival con su barra y el primer Destina, 259–263) y «El fugitivo» (264–267); misiones sueltas «El naufragio del San José» (bucear en el mazo del naufragio, 269–271 y 277–285; antes «El pecio del San José»), «Escolta del San Telmo» y «El asedio de Port Royal» (permanentes con Vida que se protegen) y «La regata de San Juan»; ocho Peligros nuevos (247–254) con la permanente «Mala fama» (136); Tesoros 148, 263, 270 y 271. Mazo de Peligros de 64 cartas, mazo de Misiones de 16 y caja de 275 cartas (la quinta ronda quitó el Práctico del puerto, 166), con 11 cartas de recompensa (286, «Fondeáis sobre el San José», la del naufragio, y 287–296, las de los recuadros que decían algo más que qué se gana). Reglas por carta en `src/engine/peligros2/grupoF.ts`, `src/engine/misiones2/fase15.ts` y `src/engine/capacidades/tesoros15.ts`. Detalle en la sección «Fase 15» de `docs/decisiones.md`.

16. **Estados y Ventajas como cartas:** los Estados y las Ventajas pasan a ser cartas mini con sus capacidades (297–309); Extenuado y Desánimo (hoy «Desmoralizado»). Lo que solo se cuenta sigue con fichas (corrección de Albert: los dados son una regla casera suya, no del juego). Detalle en la sección «Fase 16» de `docs/decisiones.md`.

Al final de cada fase: pruebas verdes, despliegue y un resumen para Albert con conclusiones y lo pendiente.

## Decisiones de reglas

Todas las decisiones de Albert están en `docs/decisiones.md`, con su ejemplo y su prueba. Las que antes figuraban aquí como pendientes ya están confirmadas:

- **Loro parlanchín:** si nadie se compromete a la Prueba, puede unirse después del Destino (N14).
- **Isabela y el Amuleto vudú:** «reduce su Vida a 1» significa que queda con 1 Vida restante (heridas = Vida − 1).
- **Mazo de Escenario agotado:** no se rebaraja. Se juega el último turno y se pierde (D12).
- **Rehén:** fuera de la caja básica desde la fase 14 (tercera ronda); queda para una posible expansión. Lo que capturaba, ahora descarta, y si un efecto descartaría al Capitán, sufre 1 herida en su lugar.
- **Barco hundido:** las Mejoras de barco que se pierden **sí** activan sus efectos «después de que descartes esta carta».
- Si aparece cualquier otro caso no cubierto, pregunta a Albert con una opción por defecto y un ejemplo, y márcala en el código con `// TODO(regla): …` hasta que responda.
- **Fase 6:** las respuestas de Albert (P1–P48) están en `docs/decisiones.md`, sección «Fase 6». Reforzar y la Fiebre ya no existen: las cartas de la mano solo suman al comprometer. Ya no hay Pruebas dobles.
- **Fase 7:** respuestas P49–P56 en la sección «Fase 7» de `docs/decisiones.md`. «Las puertas de Panamá» tiene que seguir siendo una victoria rara (menos del 10 % de las partidas): no se toca su equilibrio.
- **Avance X / Y (19 de octubre de 2026):** los encuentros con Prueba dan X si la superas e Y si no. Albert eligió Y = mitad de X **hacia arriba** (1 / 1, 2 / 1, 3 / 2, 4 / 2), en el campo `avanceSinSuperar` de cada encuentro. Detalle en la sección «Avance con dos valores» de `docs/decisiones.md`.
- **Fase 8:** cambios, lecturas y respuestas P57–P59 en la sección «Fase 8» de `docs/decisiones.md` (alisios y huracanes cambian las Distancias de todas las misiones; Escasez se salta la Recarga; Impuestos pierde la Mejora de mayor coste; La Armada patrulla pone La Armada encima del mazo). P60 cerrada: el soborno de La Armada patrulla es 1 carta. P61: la dificultad suma todos los modificadores, el Destino incluido, y solo el resultado final no baja de 0.
- **Fase 12:** respuestas P67–P70 en la sección «Fase 12» de `docs/decisiones.md`. El equilibrio se ajusta jugando (Albert prefiere un reto antes que un juego fácil): para publicar, el único tope duro es Panamá por debajo del 10 % de las partidas. «Rumores del tesoro» da 2 en los capítulos II, III y IV.
- **Fase 13:** las heridas de los encuentros son siempre libres (las reparte el jugador entre todos sus Tripulantes); herir a un asignado queda para los Destinos. Respuestas P71–P85 e I1–I11 en la sección «Fase 13» de `docs/decisiones.md`. Reglas generales de Albert:
  - **Las cartas se aplican al pie de la letra:** si una carta daña el Barco, lo daña en cualquier Entorno (fuera P19).
  - **«Al zarpar:»** solo en cartas en juego (misiones, Mejoras, Tesoros) y se aplica solo; los Eventos dicen «**Respuesta:** Después de zarpar, …». Orden: zarpas, pagas la Distancia, «Al zarpar», Respuestas.
  - **«El Tripulante asignado con más (o menos) X» sin nadie asignado**, en un encuentro, es el de más (o menos) X de toda la tripulación.
  - **Las Mejoras de barco se usan en cualquier ventana** si la carta no dice otra cosa (fuera N18). Lo que dependa del Entorno lo dice la carta con el icono del Entorno delante del efecto: «[mar], [agotar]: efecto», «**Respuesta:** [ciu]: Después de…», «**Al zarpar:** [mar]: …». Los cuatro Cañones, solo en el Mar (P81).
  - **Un Destino sin nadie asignado** (P83): lo que le hace a «un Tripulante asignado» o a «el asignado con…» no se aplica; solo su Sin oposición. La regla de los encuentros (toda la tripulación, heridas libres) no vale para los Destinos.
- **Fase 14:** Enrolado es una palabra clave de Tripulante: pierde 1 ficha al final de cada turno, en la tripulación (cuenta turnos, no misiones). Desgaste se quitó. Despedir sigue sin dar nada a cambio. Reglas en `docs/decisiones.md`, sección «Fase 14».
  - **Principio de diseño de Albert:** que el jugador no tenga que recordar nada. Nada de efectos que esperan a «después» si se pueden aplicar en el momento.
  - Tercera ronda: cuando una carta habla del coste de otra («de coste 2 o menos»), mira el coste impreso; los descuentos solo rebajan lo que se paga. Abordaje: sin Cañones en esa Prueba y 1 herida por punto que falte, sin máximo.
  - Respuestas P89–P92 y Rasgos en la sección «Fase 14, tercera ronda: respuestas de Albert» de `docs/decisiones.md`: Rasgos de grupo y de oficio, tres fórmulas («si tienes un X», «si tienes un X preparado», «X asignado»; el Capitán cuenta siempre), objetos escritos como nombres de carta y el tipo de las permanentes dibujado como el de un encuentro («¡La guardia!» es Guardia). Cuarta ronda (P93–P94): la Balandra de la Hermandad pide «un Bucanero preparado» (Pirata desde la fase 15); Sangre caliente se queda «sin contar al Capitán» (el Capitán cuenta siempre en las fórmulas de Rasgo y en «Vigía −2»; en las demás elecciones manda la carta); un oficio no tiene límite en la tripulación, solo limita que la carta sea única.
  - Para cuando se rehagan los mazos de inicio: 2 o 3 Vigías, al menos 2 Oficiales además del Capitán y el Loro parlanchín (apuntado en `docs/decisiones.md`).
- **Fase 15:** el Pasajero ya no es regla general ni ocupa Capacidad; Descomunal N (al menos N asignados o se falla) y Alerta (el encuentro se resuelve siempre y, si la ves al otear, se queda encima del mazo) son palabras clave nuevas; el Abordaje es la misma regla cuando abordas tú. P95–P106 respondidas. El pecio pasa a ser «El naufragio del San José», con su mazo del naufragio de 12 cartas (269–271 y 277–285): cada carta dice qué hacer con ella («Quédate esta carta», «Pon esta carta en juego», «Vuelve a barajar esta carta…») y la que no dice nada se aparta; al terminar, todo vuelve al mazo de historia salvo lo que esté en juego. Tercera ronda: la misión 268 no tiene texto y su recompensa es «Coge la carta 286 del mazo de historia»; la 286, «Fondeáis sobre el San José», es la que hace bucear y vuelve al mazo de historia al terminar. P107–P109 respondidas (al buscar en el mazo de Misiones, se baraja). Cuarta ronda: P110 respondida (una carta de mazo propio que Se retira vuelve al mazo de historia y puede volver a salir); los trece recuadros de recompensa del inventario cumplen ya la regla: diez cartas de recompensa nuevas (287–296; los finales con elección 120, 145, 149 y 257 están en su carta), lo de Don Anselmo en su carta (221) y la 151 dice «Pon en juego la carta 222». Un capítulo II, III o IV superado vuelve al mazo de historia (el I se aparta); por eso «Las tres cruces del mapa» (293) solo baraja los capítulos II que no hayas superado.
- **Fase 16 (24 de octubre de 2026): Estados y Ventajas como cartas.** Los Estados y las Ventajas son cartas mini (297–309, 58 copias en una **reserva** aparte; sección `estados` de `cartas.json`, identificador «estado:clave», el mismo de sus capacidades). Cada carta dice qué hace y cómo se quita (Acciones: Carpintero para Anegado y Desarbolado —antes Vía de agua y Velas rotas—, Cirujano para Envenenado, otro Tripulante para Sangrando, Oficial para Asustado). Nuevos: **Extenuado** (sustituye a «no se prepara en tu próxima Fase de Inicio») y **Desánimo** (hoy **Desmoralizado**; sustituye a «−1 Mando»; el castigo llega al final del mismo turno). Caja de 336 cartas (antes se contaban 333: la fila de Tripulantes de Componentes se había quedado en 23 desde la fase 14; son 29; una prueba compara ahora la tabla con los datos). En la mesa, cada carta se ve sobre su Tripulante o junto al Barco por su cabecera y se amplía. **La caja trae fichas** (corrección de Albert: el «juego sin fichas» con dados de la primera entrega era una regla casera suya): fichas de herida, de daño, de Avance y de Entrenamiento, fichas genéricas (contadores y Enrolado) y fichas de reputación; la entrada «Fichas de misión» se queda como «Contadores» (lo que cuenta una carta, con fichas genéricas). P111 cerrada (Extenuado ya preparado: la carta se queda hasta la Fase de Inicio en que vaya a prepararse) y P112 cerrada (las cartas siguen diciendo «ficha»). Fichas de la caja (decisión de Albert, medidas en 1000 partidas): 12 de herida, 12 de daño, 12 de Avance, 6 de Entrenamiento y 20 genéricas, más 20 de reputación (P117, decisión de Albert: la partida larga llega como mucho a 19 y la 20 es de margen). P118: Componentes dice cuántas hay de cada clase (82 fichas en total). P113–P116 cerradas con la opción por defecto: se llaman «fichas» (las cartas no cambian), herida y daño son fichas distintas, el Entrenamiento es una ficha propia «+1» y los dados solo salen en el consejo de Componentes. **Reputación con fichas** (Albert): fuera el marcador; el jugador empieza sin fichas de reputación, coge 1 por cada punto que gana y devuelve 1 por cada punto que pierde (nunca baja de 0); en la mesa, un montón de fichas con su número. **La regata de San Juan (276)** termina como «La ruta de los alisios»: «**Obligado:** Con 8 fichas de Rival, el rival gana la regata y la misión termina. Si no la superas, apártala.» (en el momento de revelar el Peligro de la octava ficha, sin resolverlo; P119: si no la superas por cualquier motivo, también al retirarte o al hundirse el Barco, se aparta sin preguntar y no se gana nada). Detalle en la sección «Fase 16» de `docs/decisiones.md`.
- **Fase 15, quinta ronda (24 de octubre de 2026):** el Rasgo Bucanero pasa a llamarse **Pirata** (no cambia el nombre «Bucanero veterano»). Pirata también es un tipo de encuentro: el Rasgo va en cursiva («_Pirata_», `tieneRasgo`) y el tipo, en versalitas (`#Pirata#`, palabras clave del encuentro); son cosas distintas. Fuera el icono de quitar un Estado, el Estado del Barco Pólvora mojada y el Práctico del puerto (166): ninguna carta quita ya la Vía de agua ni las Velas rotas, solo el Astillero. Cambios carta por carta y lecturas (Fiador contra cualquier efecto, el [agotar] del Loro, la Pistola «+3 COM en esta Prueba», la culebrina que se adquiere) en la sección «Quinta ronda» de `docs/decisiones.md`.
  - **Norma de las heridas (Albert, revisión de las cartas de jugador): «Inflige» siempre.** Imperativo, como Daña, Cura o Roba: sin destinatario son heridas libres («Inflige {2 herida}»); con destinatario, van a quien diga («Inflige {1 herida} al Tripulante asignado con más [COM]», «Inflige {1 herida} a este Tripulante», «inflígele…»). Los momentos también: «Cuando vayas a infligir heridas a un Tripulante…». El daño del Barco, «Daña {N dano}» y «Cuando vayas a dañar el Barco…». Nada de «sufre» en las cartas (solo queda en la narración de algún ejemplo del reglamento).
  - **Normas de Albert de la revisión de los Peligros 154–162:** **redondeo**: siempre hacia arriba (regla general; las cartas no lo repiten). **Abordaje va en la Prueba**, como Sin ayuda y Descomunal: etiqueta junto al tipo del encuentro y recordatorio al final del texto («**Abordaje** (no puedes usar las capacidades de tus _Cañones_; si fallas, inflige 1 herida por cada punto que te falte).»); el Fallo ya no lo dice. **Primero el efecto y, entre paréntesis, lo temático**; nada de «A tu elección»: «**Elige:**». **Los Estados son adjetivos y siempre «queda»** (nunca «queda con»): Anegado (antes Vía de agua), Desarbolado (antes Velas rotas), Desmoralizado (antes Desánimo; «Tu tripulación queda **Desmoralizada**»); las claves internas no cambian. Los tipos de encuentro sin cartas (Terreno, Barco, Bestia, Sobrenatural, Pirata, Tripulación, Enfermedad) se quedan para cartas futuras; «Monstruo» pasó a «Bestia». Detalle en «Revisión de Albert de los Peligros 154–162» de `docs/decisiones.md`.
  - **Normas de estilo nuevas:** Cañón es un Rasgo y va en cursiva en los textos («_Cañón_», «_Cañones_»; no en los nombres de carta ni en la línea de Rasgos de las Mejoras). El icono de robar ya dice «roba una carta» y nunca lleva el verbo delante: «{2 robar}» se lee «roba 2 cartas» («Prepara un _Cañón_ y {1 robar}.»); el verbo se queda solo cuando se roba de otra manera («roba hasta tener…», «roba 1 carta menos», «roba 1 carta del mazo del naufragio»).
  - **Principio de fabricación (Albert, fase 16, corregido):** «El juego se fabrica con cartas y fichas. Lo que tenga texto o efecto propio es una carta (también los Estados y las Ventajas). Lo que solo haya que contar se lleva con fichas: de herida, de daño, de Avance, de Entrenamiento y genéricas (los contadores de misiones, permanentes y Tesoros, y Enrolado), más las fichas de reputación. Llevar la cuenta con dados es una regla casera, no del juego.» Tenerlo en cuenta en todo lo que se escriba.
- **Revisión de Albert de las cartas de jugador (24 de octubre de 2026):** textos nuevos de Eventos (44, 47 coste 1 y cura 2, 48 «Pólvora robada» coste 1 y prepara un _Cañón_, 49 gana 1, 53, 56 Soborno, 58 «Cubrir las espaldas», 60 Prisionero liberado solo en Ciudad y descarta las demás, 171 «¡Nadie se queda atrás!» con «destina 3 [COM]» como coste, 173 Virar y dar la cara: la Prueba de NAV pasa a ser de COM agotando un _Cañón_) y ambientaciones. Fuera 43 Botín escondido, 65 Retirada a tiempo y 170 Cortar por lo sano (números libres). Mazo del capitán de inicio: Arenga (240) por el Botín, 2.ª Reflejos de gato por la Retirada y el hueco de Cortar sin rellenar (39 cartas; opciones por defecto pendientes de confirmar). Fuera la mecánica Buscar: 100 Marineros sin barco (como Lenguas sueltas), 106 Carpinteros de ribera (descuento de 1 en Mejoras de barco), 117 y 210 roban, 279 pone 2 de Avance en una misión disponible; la entrada Buscar del reglamento solo habla del mazo de historia. Texto de reglas de las cartas de jugador a 18 px (cinco Tripulantes no caben: tamaño provisional hasta que Albert decida). Detalle en la sección «Revisión de las cartas de jugador» de `docs/decisiones.md`.
- **Solo los encuentros piden Pruebas (Albert, 24 de octubre de 2026, respuestas P120–P131):** solo los encuentros (cartas de Peligro, mazos propios y barcos rivales) piden Pruebas; cualquier otra carta que necesite una habilidad usa **Destina** (un coste: agotas Tripulantes que sumen ese valor o más, sin Destino ni cartas de la mano). Fuera la regla de la Interrupción que pedía una Prueba con otra a medias. Seis permanentes (220, 229, 230, 231, 235 y 237) aún tienen una Acción con Prueba: pasarán a Destina cuando Albert revise el mazo de historia (`TODO(regla)`). Además: P120 mazo del capitán de 39; P122 «Virar y dar la cara» hace la Prueba de COM a todos los efectos; P123 Carpinteros de ribera, solo la primera Mejora de barco; P124 Soborno sigue sin valer contra Alerta; P125 todas las cartas de jugador a 18 px (la ilustración baja un poco donde no cabe; el Barco no parte «Distancia −1»); P126 Pasajeros con «infligir»; P128 «que elijas»; P129 «por cada 2» cuenta parejas enteras; P130 Casco carcomido con mínimo 3; P131 redondeo en el párrafo de pagar costes. Detalle en «Respuestas de Albert P120–P131» de `docs/decisiones.md`. P132: el Filibustero borracho, el Galeote fugado y la Carne de cañón ponen los dos iconos en la misma línea, como la Pistola («Inflige {1 herida} a Filibustero borracho: {+2 COM} en esta Prueba.»), y caben sin bajar la ilustración.
- **Reglas generales de Albert (24 de octubre de 2026, fase 15, tercera ronda):**
  - **Toda carta del mazo de historia que sale del juego (se descarta, se pierde o termina su misión) vuelve al mazo de historia**, nunca a una pila de descartes. En el motor, `mover` (zonas.ts) lo hace solo para todas las cartas del mazo de historia (`esDeHistoria` en catalogo.ts).
  - **Los recuadros de recompensa de las misiones solo dicen qué carta coger** («Coge la carta N del mazo de historia», «Pon la carta N encima del mazo de Misiones», «Pon en juego la carta N») **o qué se gana** («gana 2 [rep]», «roba 2 cartas»). Las reglas que haga falta explicar van en una carta del mazo de historia: una **carta de recompensa** (tipo `recompensa`, sección `cartasDeRecompensa` de `cartas.json`; lo que hace, en `registrarCartaDeRecompensa`). Se coge, se hace lo que dice y vuelve al mazo de historia. Desde la cuarta ronda lo cumplen todos (117 «+1 y busca una Mejora» se queda: buscar es lo que se gana).
- **Normas de Albert para todo lo nuevo (23 de octubre de 2026):**
  - **El juego tiene que ser más difícil:** las cartas y misiones nuevas no deben bajar la dificultad. Si una medición muestra que algo nuevo sube mucho las victorias, avísalo en el informe.
  - **No se regala reputación:** cada punto de reputación tiene que costar riesgo.
