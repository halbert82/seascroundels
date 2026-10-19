// Tipos mínimos de Paged.js (la biblioteca no trae los suyos).
declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: unknown)
    preview(
      content?: Node | string,
      stylesheets?: (string | Record<string, string>)[],
      renderTo?: HTMLElement,
    ): Promise<{ total: number; pages: { element: HTMLElement }[] }>
  }
}
