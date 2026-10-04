import { create } from 'zustand';
import {
  requestPrinter, reconnectPrinter, type ConnectionType, type PrinterTransport,
} from '../printer/transport';
import {
  buildReceipt, buildPreBill, buildTestPage, buildReceiptHtml, buildPreBillHtml, buildTestPageHtml,
  buildCashCut, buildCashCutHtml, type TicketSettings,
} from '../printer/tickets';
import type { CashCut } from '../utils/cashCut';
import { printHtml } from '../printer/browserPrint';
import type { Order, PaidOrder } from './useCartStore';

// - 'system': impresora instalada en Windows/Mac; se imprime con el diálogo del navegador.
// - 'direct': USB / puerto serie directo con comandos ESC/POS (Chrome/Edge; ideal en Android).
export type PrintMode = 'system' | 'direct';

// La impresora está conectada a ESTE equipo, así que la configuración se guarda en el navegador.
export interface PrinterSettings extends TicketSettings {
  mode: PrintMode;
  connectionType: ConnectionType;
  baudRate: number;
  autoPrintOnPay: boolean;
}

export const TIP_PERCENTAGES = [10, 15, 20];

const STORAGE_KEY = 'soma-printer-settings';

export type DeviceKind = 'android' | 'ios' | 'desktop';

export function detectDevice(): DeviceKind {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  // iPadOS se presenta como Mac; se distingue por la pantalla táctil
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

// Android con Chrome toma la impresora USB directo (cable OTG); en PC/Mac el sistema
// ya instaló su driver, así que se imprime a través de él.
export function recommendedMode(): PrintMode {
  return detectDevice() === 'android' && typeof navigator !== 'undefined' && 'usb' in navigator ? 'direct' : 'system';
}

const DEFAULT_SETTINGS: PrinterSettings = {
  mode: 'system',
  connectionType: 'usb',
  baudRate: 9600,
  paperWidth: 58,
  useAccents: true,
  businessName: 'SOMA',
  headerLines: '',
  footerLines: '¡Gracias por su visita!',
  openDrawerOnCash: false,
  autoPrintOnPay: true,
  copies: 1,
};

function loadSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PrinterSettings>;
      // Configuraciones anteriores a los modos: ya usaban la impresión directa
      return { ...DEFAULT_SETTINGS, mode: 'direct', ...saved };
    }
  } catch { /* almacenamiento no disponible */ }
  return { ...DEFAULT_SETTINGS, mode: recommendedMode() };
}

// Hay forma de imprimir en este equipo (modo sistema siempre; directo si está conectada)
export const selectCanPrint = (s: { settings: PrinterSettings; transport: PrinterTransport | null }) =>
  s.settings.mode === 'system' || !!s.transport;

function saveSettings(settings: PrinterSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* almacenamiento no disponible */ }
}

type Status = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';

interface PrinterState {
  settings: PrinterSettings;
  status: Status;
  deviceLabel: string | null;
  lastError: string | null;
  transport: PrinterTransport | null;

  updateSettings: (updates: Partial<PrinterSettings>) => void;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  printReceipt: (order: PaidOrder, reprint?: boolean) => Promise<boolean>;
  printPreBill: (order: Order) => Promise<boolean>;
  printTest: () => Promise<boolean>;
  printCashCut: (cut: CashCut) => Promise<boolean>;
  openDrawer: () => Promise<boolean>;
}

const errorMessage = (e: unknown) => {
  if (e instanceof DOMException && e.name === 'NotFoundError') return 'No se seleccionó ninguna impresora.';
  if (e instanceof DOMException && e.name === 'SecurityError') return 'El navegador bloqueó el acceso al dispositivo. En Windows, las impresoras USB pueden requerir el driver WinUSB; prueba también la conexión por puerto serie.';
  if (e instanceof DOMException && e.name === 'NetworkError') return 'Se perdió la conexión con la impresora. Revisa el cable y vuelve a conectar.';
  return e instanceof Error ? e.message : String(e);
};

export const usePrinterStore = create<PrinterState>((set, get) => {
  const viaSystem = async (html: string): Promise<boolean> => {
    set({ lastError: null });
    const ok = await printHtml(html);
    if (!ok) set({ lastError: 'El navegador no pudo abrir la impresión.' });
    return ok;
  };

  const send = async (data: Uint8Array): Promise<boolean> => {
    let { transport } = get();
    if (!transport) {
      await get().reconnect();
      transport = get().transport;
    }
    if (!transport) {
      set({ status: 'disconnected', lastError: 'No hay impresora conectada.' });
      return false;
    }
    set({ status: 'printing', lastError: null });
    try {
      await transport.write(data);
      set({ status: 'connected' });
      return true;
    } catch (e) {
      // Un error de escritura casi siempre significa cable desconectado o impresora apagada
      await transport.close();
      set({ status: 'error', transport: null, lastError: errorMessage(e) });
      return false;
    }
  };

  return {
    settings: loadSettings(),
    status: 'disconnected',
    deviceLabel: null,
    lastError: null,
    transport: null,

    updateSettings: (updates) => {
      const settings = { ...get().settings, ...updates };
      saveSettings(settings);
      set({ settings });
    },

    connect: async () => {
      const { settings, transport } = get();
      set({ status: 'connecting', lastError: null });
      try {
        await transport?.close();
        const t = await requestPrinter(settings.connectionType, settings.baudRate);
        set({ transport: t, status: 'connected', deviceLabel: t.label });
      } catch (e) {
        set({ transport: null, status: 'error', lastError: errorMessage(e) });
      }
    },

    reconnect: async () => {
      const { settings, transport } = get();
      if (transport) return;
      try {
        const t = await reconnectPrinter(settings.connectionType, settings.baudRate);
        if (t) set({ transport: t, status: 'connected', deviceLabel: t.label, lastError: null });
      } catch (e) {
        set({ status: 'error', lastError: errorMessage(e) });
      }
    },

    disconnect: async () => {
      await get().transport?.close();
      set({ transport: null, status: 'disconnected', deviceLabel: null });
    },

    printReceipt: (order, reprint = false) => {
      const { settings } = get();
      return settings.mode === 'system'
        ? viaSystem(buildReceiptHtml(order, settings, { reprint }))
        : send(buildReceipt(order, settings, { reprint }));
    },

    printPreBill: (order) => {
      const { settings } = get();
      return settings.mode === 'system'
        ? viaSystem(buildPreBillHtml(order, settings, TIP_PERCENTAGES))
        : send(buildPreBill(order, settings, TIP_PERCENTAGES));
    },

    printTest: () => {
      const { settings, deviceLabel } = get();
      return settings.mode === 'system'
        ? viaSystem(buildTestPageHtml(settings, 'Impresora del sistema'))
        : send(buildTestPage(settings, deviceLabel || 'desconocida'));
    },

    printCashCut: (cut) => {
      const { settings } = get();
      return settings.mode === 'system'
        ? viaSystem(buildCashCutHtml(cut, settings))
        : send(buildCashCut(cut, settings));
    },

    openDrawer: () => send(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])),
  };
});
