import { wrap, pairLines, type Align, type TicketWriter } from './escpos';

// Arma el mismo ticket que EscPosBuilder, pero como documento HTML para imprimirlo
// con el driver de la impresora (Windows/Mac) desde el diálogo del navegador.

interface Row {
  text: string;
  align: Align;
  bold: boolean;
  width: number;  // 1 = normal, 2 = doble ancho
  height: number; // 1 = normal, 2 = doble alto
}

type Block = Row | 'page-break';

const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class HtmlTicketWriter implements TicketWriter {
  readonly columns: number;
  private blocks: Block[] = [];
  private state = { align: 'left' as Align, bold: false, width: 1, height: 1 };

  constructor(columns: number) {
    this.columns = columns;
  }

  align(a: Align) { this.state.align = a; return this; }
  bold(on: boolean) { this.state.bold = on; return this; }

  size(width: number, height: number) {
    this.state.width = Math.min(2, Math.max(1, width));
    this.state.height = Math.min(2, Math.max(1, height));
    return this;
  }

  line(t = '') {
    this.blocks.push({ text: t, ...this.state });
    return this;
  }

  wrapped(t: string, columns = this.columns, indent = '') {
    wrap(t, columns - indent.length).forEach(l => this.line(indent + l));
    return this;
  }

  separator(ch = '-') {
    return this.line(ch.repeat(this.columns));
  }

  pair(left: string, right: string, columns = this.columns) {
    pairLines(left, right, columns).forEach(l => this.line(l));
    return this;
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.line('');
    return this;
  }

  // En papel continuo cada copia va en su propia "página"
  cut() {
    this.blocks.push('page-break');
    return this;
  }

  // El cajón solo se puede abrir con impresión directa (ESC/POS)
  openDrawer() {
    return this;
  }

  // Texto plano por renglón (para comparar con la versión ESC/POS)
  rows(): string[] {
    return this.blocks.filter((b): b is Row => b !== 'page-break').map(b => b.text);
  }

  build(): string {
    const pages: string[][] = [[]];
    for (const b of this.blocks) {
      if (b === 'page-break') pages.push([]);
      else pages[pages.length - 1].push(this.renderRow(b));
    }
    const body = pages
      .filter(p => p.length)
      .map(p => `<section class="ticket">${p.join('')}</section>`)
      .join('');

    // Letra monoespaciada: cada carácter mide 0.6em, así que `columns` caracteres
    // ocupan exactamente el ancho imprimible (48 mm en papel de 58 mm, 72 mm en 80 mm).
    const printable = this.columns <= 32 ? 48 : 72;
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Ticket</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: "Courier New", Courier, monospace; font-size: ${(printable / (this.columns * 0.6)).toFixed(3)}mm; line-height: 1.25; }
  .ticket { width: ${printable}mm; margin: 0 auto; padding: 2mm 0; break-after: page; }
  .ticket:last-child { break-after: auto; }
  .r { white-space: pre; overflow: hidden; min-height: 1.25em; }
  .b { font-weight: 700; }
  .center { text-align: center; }
  .right { text-align: right; }
  .w2 { font-size: 2em; line-height: 1.25; }
  .h2 { height: 2.5em; }
  .h2 > span { display: inline-block; transform: scaleY(2); transform-origin: top; }
  .w2.h2 { height: auto; }
  .w2.h2 > span { transform: none; }
</style></head>
<body>${body}</body></html>`;
  }

  private renderRow(r: Row): string {
    const classes = ['r'];
    if (r.bold) classes.push('b');
    if (r.align !== 'left') classes.push(r.align);
    if (r.width === 2) classes.push('w2');
    if (r.height === 2) classes.push('h2');
    return `<div class="${classes.join(' ')}"><span>${escapeHtml(r.text) || '&nbsp;'}</span></div>`;
  }
}
