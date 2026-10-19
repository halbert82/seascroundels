// Tipos mínimos de Paged.js (la biblioteca no trae los suyos).
declare module 'pagedjs' {
  /** Un ajuste de la maqueta: sus métodos con nombre de gancho («onOverflow»…) se llaman al repartir. */
  export class Handler {
    constructor(chunker: unknown, polisher: unknown, caller: unknown)
  }
  export function registerHandlers(...handlers: (new (chunker: unknown, polisher: unknown, caller: unknown) => Handler)[]): void
  export class Previewer {
    constructor(options?: unknown)
    preview(
      content?: Node | string,
      stylesheets?: (string | Record<string, string>)[],
      renderTo?: HTMLElement,
    ): Promise<{ total: number; pages: { element: HTMLElement }[] }>
  }
}
