// Tipos mínimos del paquete «hyphen» (no trae los suyos): solo lo que usa silabas.ts.
declare module 'hyphen/es' {
  const es: {
    hyphenateSync(texto: string, opciones?: { hyphenChar?: string; minWordLength?: number }): string
  }
  export default es
}
