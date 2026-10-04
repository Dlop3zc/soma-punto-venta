import { EscPosBuilder, type TicketWriter } from './escpos';
import { HtmlTicketWriter } from './htmlTicket';
import type { Order, PaidOrder, CartItem } from '../store/useCartStore';

export interface TicketSettings {
  paperWidth: 58 | 80;
  useAccents: boolean;
  businessName: string;
  headerLines: string; // varias líneas separadas por salto de línea (dirección, teléfono, RFC...)
  footerLines: string;
  openDrawerOnCash: boolean;
  copies: number;
}

const money = (n: number) => `$${n.toFixed(2)}`;

const columnsFor = (width: 58 | 80) => (width === 58 ? 32 : 48);

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString('es-MX')} ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

// Cada ticket se escribe una sola vez y sale en dos formatos:
// bytes ESC/POS (impresión directa) o HTML (impresora del sistema).
function toEscPos(s: TicketSettings, write: (b: TicketWriter) => void): Uint8Array {
  const b = new EscPosBuilder({ columns: columnsFor(s.paperWidth), useAccents: s.useAccents });
  write(b);
  return b.build();
}

function toHtml(s: TicketSettings, write: (b: TicketWriter) => void): string {
  const b = new HtmlTicketWriter(columnsFor(s.paperWidth));
  write(b);
  return b.build();
}

function header(b: TicketWriter, s: TicketSettings) {
  b.align('center');
  if (s.businessName.trim()) {
    b.bold(true).size(2, 2).wrapped(s.businessName.trim(), Math.floor(b.columns / 2)).size(1, 1).bold(false);
  }
  s.headerLines.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => b.wrapped(l));
  b.align('left').separator();
}

function footer(b: TicketWriter, s: TicketSettings) {
  const lines = s.footerLines.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) {
    b.feed(1).align('center');
    lines.forEach(l => b.wrapped(l));
    b.align('left');
  }
  b.feed(3).cut();
}

function itemLines(b: TicketWriter, items: CartItem[]) {
  items.forEach(item => {
    b.pair(`${item.quantity}x ${item.name}`, money(item.price * item.quantity));
    if (item.quantity > 1) b.line(`   ${money(item.price)} c/u`);
    if (item.note) b.wrapped(`* ${item.note}`, b.columns, '   ');
  });
}

function orderInfo(b: TicketWriter, order: Order, dateTs: number) {
  b.bold(true).line(`Cuenta: ${order.name}`).bold(false);
  b.line(`Atendió: ${order.waiter}`);
  b.line(`Fecha: ${formatDate(dateTs)}`);
  b.separator();
}

type ReceiptOptions = { reprint?: boolean };

// Ticket de venta (después de cobrar)
export const buildReceipt = (order: PaidOrder, s: TicketSettings, opts: ReceiptOptions = {}) =>
  toEscPos(s, b => writeReceipt(b, order, s, opts));
export const buildReceiptHtml = (order: PaidOrder, s: TicketSettings, opts: ReceiptOptions = {}) =>
  toHtml(s, b => writeReceipt(b, order, s, opts));

function writeReceipt(b: TicketWriter, order: PaidOrder, s: TicketSettings, opts: ReceiptOptions) {
  const copies = Math.max(1, Math.min(3, s.copies));

  for (let copy = 0; copy < copies; copy++) {
    header(b, s);
    if (opts.reprint) b.align('center').bold(true).line('*** REIMPRESIÓN ***').bold(false).align('left');
    orderInfo(b, order, order.paidAt);
    itemLines(b, order.items);
    b.separator();

    const subtotal = order.total + (order.discount || 0);
    if (order.discount) {
      b.pair('Subtotal', money(subtotal));
      b.pair('Descuento', `-${money(order.discount)}`);
    }
    b.bold(true).size(1, 2).pair('TOTAL', money(order.total)).size(1, 1).bold(false);

    if (order.tip) {
      b.pair(order.tipPercent ? `Propina (${order.tipPercent}%)` : 'Propina', money(order.tip));
      b.bold(true).pair('TOTAL + PROPINA', money(order.total + order.tip)).bold(false);
    }

    b.feed(1).pair('Pago', order.paymentMethod);
    if (order.paymentMethod === 'Efectivo' && order.cashTendered !== undefined) {
      b.pair('Recibido', money(order.cashTendered));
      b.pair('Cambio', money(order.change || 0));
    }
    footer(b, s);
  }

  if (s.openDrawerOnCash && order.paymentMethod === 'Efectivo' && !opts.reprint) b.openDrawer();
}

// Pre-cuenta para llevar a la mesa antes de cobrar
export const buildPreBill = (order: Order, s: TicketSettings, tipSuggestions: number[]) =>
  toEscPos(s, b => writePreBill(b, order, s, tipSuggestions));
export const buildPreBillHtml = (order: Order, s: TicketSettings, tipSuggestions: number[]) =>
  toHtml(s, b => writePreBill(b, order, s, tipSuggestions));

function writePreBill(b: TicketWriter, order: Order, s: TicketSettings, tipSuggestions: number[]) {
  header(b, s);
  b.align('center').bold(true).line('PRE-CUENTA').bold(false).align('left');
  orderInfo(b, order, Date.now());
  itemLines(b, order.items);
  b.separator();
  b.bold(true).size(1, 2).pair('TOTAL', money(order.total)).size(1, 1).bold(false);

  if (tipSuggestions.length) {
    b.feed(1).line('Propina sugerida:');
    tipSuggestions.forEach(p => {
      const tip = Math.round(order.total * p) / 100;
      b.pair(`  ${p}%  ${money(tip)}`, `Total ${money(order.total + tip)}`);
    });
  }
  b.feed(1).align('center').wrapped('Este documento no es un comprobante de pago').align('left');
  footer(b, s);
}

export const buildTestPage = (s: TicketSettings, label: string) => toEscPos(s, b => writeTestPage(b, s, label));
export const buildTestPageHtml = (s: TicketSettings, label: string) => toHtml(s, b => writeTestPage(b, s, label));

function writeTestPage(b: TicketWriter, s: TicketSettings, label: string) {
  header(b, s);
  b.align('center').bold(true).line('PRUEBA DE IMPRESIÓN').bold(false).align('left');
  b.line(`Conexión: ${label}`);
  b.line(`Papel: ${s.paperWidth} mm (${b.columns} columnas)`);
  b.line(`Fecha: ${formatDate(Date.now())}`);
  b.separator();
  b.line('Acentos: áéíóú ÁÉÍÓÚ ñÑ ¿? ¡!');
  b.pair('Producto de ejemplo', money(123.45));
  b.bold(true).line('Texto en negritas').bold(false);
  b.size(2, 2).line('Grande').size(1, 1);
  b.line('1234567890'.repeat(Math.ceil(b.columns / 10)).slice(0, b.columns));
  footer(b, s);
}
