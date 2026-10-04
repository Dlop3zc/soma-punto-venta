import { describe, test, expect } from 'vitest';
import { EscPosBuilder, wrap } from './escpos';
import { buildReceipt, buildPreBill, type TicketSettings } from './tickets';
import { item, paid, order } from '../test/fixtures';

const settings: TicketSettings = {
  paperWidth: 58,
  useAccents: true,
  businessName: 'SOMA',
  headerLines: 'Av. Principal 123',
  footerLines: '¡Gracias!',
  openDrawerOnCash: true,
  copies: 1,
};

const DRAWER = [0x1b, 0x70, 0x00, 0x19, 0xfa];
const CUT = [0x1d, 0x56, 0x42, 0x00];

// Convierte los bytes a texto legible quitando los comandos ESC/POS
function render(bytes: Uint8Array): string {
  const cp850: Record<number, string> = {
    0xa0: 'á', 0x82: 'é', 0xa1: 'í', 0xa2: 'ó', 0xa3: 'ú', 0xa4: 'ñ', 0xa5: 'Ñ', 0xa8: '¿', 0xad: '¡',
    0xb5: 'Á', 0x90: 'É', 0xd6: 'Í', 0xe0: 'Ó', 0xe9: 'Ú',
  };
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b) { const c = bytes[i + 1]; i += c === 0x40 ? 1 : c === 0x70 ? 4 : 2; continue; }
    if (b === 0x1d) { const c = bytes[i + 1]; i += c === 0x56 ? 3 : 2; continue; }
    out += b === 0x0a ? '\n' : b < 0x80 ? String.fromCharCode(b) : (cp850[b] ?? '?');
  }
  return out;
}

const lines = (bytes: Uint8Array) => render(bytes).split('\n');
const count = (bytes: Uint8Array, seq: number[]) => {
  let n = 0;
  for (let i = 0; i <= bytes.length - seq.length; i++) if (seq.every((v, j) => bytes[i + j] === v)) n++;
  return n;
};

describe('wrap', () => {
  test('respeta palabras y el ancho', () => {
    expect(wrap('Mezcalita Maracuyá Mango Medio Litro', 16)).toEqual(['Mezcalita', 'Maracuyá Mango', 'Medio Litro']);
  });

  test('corta palabras más largas que la línea', () => {
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });
});

describe('EscPosBuilder', () => {
  test('acentos en página de códigos PC850', () => {
    const bytes = new EscPosBuilder({ columns: 32, useAccents: true }).text('Atendió ñ').build();
    expect(Array.from(bytes)).toContain(0xa2); // ó
    expect(Array.from(bytes)).toContain(0xa4); // ñ
  });

  test('sin acentos los quita en lugar de imprimir símbolos raros', () => {
    expect(render(new EscPosBuilder({ columns: 32, useAccents: false }).line('Atendió: Peña ¿listo?').build()))
      .toBe('Atendio: Pena listo?\n');
  });

  test('texto a la izquierda y monto a la derecha ocupan la línea exacta', () => {
    const out = lines(new EscPosBuilder({ columns: 32, useAccents: true }).pair('TOTAL', '$85.00').build());
    expect(out[0]).toHaveLength(32);
    expect(out[0].endsWith('$85.00')).toBe(true);
  });
});

describe('ticket de venta', () => {
  const sale = paid('2026-10-02 20:00', [
    item({ name: 'Mezcalita Maracuyá/Mango Medio Litro', price: 110, quantity: 2, note: 'sin chile' }),
    item({ name: 'Limonada 500 ML', price: 45, quantity: 1 }),
  ], { name: 'Mesa 4', waiter: 'Ana', total: 255, discount: 10, tip: 38.25, tipPercent: 15, paymentMethod: 'Efectivo', cashTendered: 300, change: 6.75 });

  test.each([[58, 32], [80, 48]] as const)('a %s mm ninguna línea pasa de %s columnas', (paperWidth, columns) => {
    for (const l of lines(buildReceipt(sale, { ...settings, paperWidth }))) {
      expect(l.length).toBeLessThanOrEqual(columns);
    }
  });

  test('incluye cuenta, productos, descuento, propina, total y cambio', () => {
    const text = render(buildReceipt(sale, settings));
    expect(text).toContain('Cuenta: Mesa 4');
    expect(text).toContain('Atendió: Ana');
    expect(text).toContain('2x Mezcalita');
    expect(text).toContain('* sin chile');
    expect(text).toMatch(/Descuento\s+-\$10\.00/);
    expect(text).toMatch(/TOTAL\s+\$255\.00/);
    expect(text).toMatch(/Propina \(15%\)\s+\$38\.25/);
    expect(text).toMatch(/TOTAL \+ PROPINA\s+\$293\.25/);
    expect(text).toMatch(/Cambio\s+\$6\.75/);
    expect(text).toContain('¡Gracias!');
  });

  test('abre el cajón en efectivo y corta el papel', () => {
    const bytes = buildReceipt(sale, settings);
    expect(count(bytes, DRAWER)).toBe(1);
    expect(count(bytes, CUT)).toBe(1);
  });

  test('no abre el cajón con tarjeta ni al reimprimir', () => {
    expect(count(buildReceipt({ ...sale, paymentMethod: 'Tarjeta' }, settings), DRAWER)).toBe(0);
    expect(count(buildReceipt(sale, settings, { reprint: true }), DRAWER)).toBe(0);
  });

  test('la reimpresión lo indica', () => {
    expect(render(buildReceipt(sale, settings, { reprint: true }))).toContain('REIMPRESIÓN');
  });

  test('copias: un corte por copia (máximo 3)', () => {
    expect(count(buildReceipt(sale, { ...settings, copies: 2 }), CUT)).toBe(2);
    expect(count(buildReceipt(sale, { ...settings, copies: 9 }), CUT)).toBe(3);
  });
});

describe('pre-cuenta', () => {
  test('muestra propinas sugeridas y aclara que no es comprobante', () => {
    const text = render(buildPreBill(order([item({ price: 100, quantity: 2 })]), settings, [10, 15]));
    expect(text).toContain('PRE-CUENTA');
    expect(text).toMatch(/10%\s+\$20\.00\s+Total \$220\.00/);
    expect(text).toMatch(/15%\s+\$30\.00\s+Total \$230\.00/);
    expect(text).toContain('no es un comprobante de pago');
  });
});
