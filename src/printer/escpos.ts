// Constructor mínimo de comandos ESC/POS para impresoras térmicas (Epson y compatibles).

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Página de códigos PC850 (Multilingual Latin I): cubre acentos, ñ, ¿ y ¡.
// En la mayoría de impresoras Epson-compatibles se selecciona con ESC t 2.
const CP850: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87,
  'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e,
  'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'Ö': 0x99,
  'Ü': 0x9a, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
  'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, '¡': 0xad, 'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7,
  'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'Í': 0xd6, 'Î': 0xd7, 'Ó': 0xe0, 'Ô': 0xe2,
  'Ò': 0xe3, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb,
};

export type Align = 'left' | 'center' | 'right';

export interface EncoderOptions {
  columns: number;        // caracteres por línea (58 mm ≈ 32, 80 mm ≈ 48)
  useAccents: boolean;    // false = quitar acentos si la impresora no soporta PC850
}

// Operaciones con las que se arma un ticket. Las implementan EscPosBuilder (bytes para
// la impresora térmica) y HtmlTicketWriter (impresión con el driver del sistema).
export interface TicketWriter {
  readonly columns: number;
  align(a: Align): this;
  bold(on: boolean): this;
  size(width: number, height: number): this;
  line(t?: string): this;
  wrapped(t: string, columns?: number, indent?: string): this;
  separator(ch?: string): this;
  pair(left: string, right: string, columns?: number): this;
  feed(lines?: number): this;
  cut(): this;
  openDrawer(): this;
}

export class EscPosBuilder implements TicketWriter {
  private bytes: number[] = [];
  private readonly opts: EncoderOptions;

  constructor(opts: EncoderOptions) {
    this.opts = opts;
    this.raw(ESC, 0x40); // inicializar
    if (opts.useAccents) this.raw(ESC, 0x74, 2); // página de códigos PC850
  }

  get columns() {
    return this.opts.columns;
  }

  raw(...data: number[]) {
    this.bytes.push(...data);
    return this;
  }

  private encode(text: string): number[] {
    const out: number[] = [];
    const source = this.opts.useAccents ? text : text.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const ch of source) {
      const code = ch.charCodeAt(0);
      if (code < 0x80) out.push(code);
      else if (this.opts.useAccents && CP850[ch] !== undefined) out.push(CP850[ch]);
      else if (ch === '¿' || ch === '¡') continue;
      else out.push(0x3f); // '?'
    }
    return out;
  }

  align(a: Align) {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  // Tamaño de 1x a 8x en ancho y alto
  size(width: number, height: number) {
    const w = Math.min(8, Math.max(1, width)) - 1;
    const h = Math.min(8, Math.max(1, height)) - 1;
    return this.raw(GS, 0x21, (w << 4) | h);
  }

  text(t: string) {
    this.bytes.push(...this.encode(t));
    return this;
  }

  line(t = '') {
    return this.text(t).raw(LF);
  }

  // Texto que se ajusta a varias líneas respetando palabras
  wrapped(t: string, columns = this.opts.columns, indent = '') {
    wrap(t, columns - indent.length).forEach(l => this.line(indent + l));
    return this;
  }

  separator(ch = '-') {
    return this.line(ch.repeat(this.opts.columns));
  }

  // Texto a la izquierda y a la derecha en la misma línea
  pair(left: string, right: string, columns = this.opts.columns) {
    pairLines(left, right, columns).forEach(l => this.line(l));
    return this;
  }

  feed(lines = 1) {
    return this.raw(ESC, 0x64, Math.max(0, Math.min(255, lines)));
  }

  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00); // avanzar y corte parcial
  }

  // Pulso al conector del cajón de dinero (pin 2)
  openDrawer() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

// Texto a la izquierda y monto a la derecha; si el texto es largo, se parte en
// varias líneas y el monto va en la última.
export function pairLines(left: string, right: string, columns: number): string[] {
  const space = columns - right.length;
  const lines = wrap(left, Math.max(1, space - 1));
  return lines.map((l, i) => (i === lines.length - 1 ? l.padEnd(space) + right : l));
}

export function wrap(text: string, columns: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > columns) {
      if (current) { lines.push(current); current = ''; }
      for (let i = 0; i < word.length; i += columns) lines.push(word.slice(i, i + columns));
      continue;
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= columns) current += ' ' + word;
    else { lines.push(current); current = word; }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}
