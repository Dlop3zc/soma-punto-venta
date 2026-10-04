import { create } from 'zustand';
import {
  requestPrinter, reconnectPrinter, type ConnectionType, type PrinterTransport,
} from '../printer/transport';
import { buildReceipt, buildPreBill, buildTestPage, type TicketSettings } from '../printer/tickets';
import type { Order, PaidOrder } from './useCartStore';

// La impresora está conectada a ESTE equipo, así que la configuración se guarda en el navegador.
export interface PrinterSettings extends TicketSettings {
  connectionType: ConnectionType;
  baudRate: number;
  autoPrintOnPay: boolean;
}

export const TIP_PERCENTAGES = [10, 15, 20];

const STORAGE_KEY = 'soma-printer-settings';

const DEFAULT_SETTINGS: PrinterSettings = {
  connectionType: 'usb',
  baudRate: 9600,
  paperWidth: 80,
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
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* almacenamiento no disponible */ }
  return DEFAULT_SETTINGS;
}

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
  openDrawer: () => Promise<boolean>;
}

const errorMessage = (e: unknown) => {
  if (e instanceof DOMException && e.name === 'NotFoundError') return 'No se seleccionó ninguna impresora.';
  if (e instanceof DOMException && e.name === 'SecurityError') return 'El navegador bloqueó el acceso al dispositivo. En Windows, las impresoras USB pueden requerir el driver WinUSB; prueba también la conexión por puerto serie.';
  if (e instanceof DOMException && e.name === 'NetworkError') return 'Se perdió la conexión con la impresora. Revisa el cable y vuelve a conectar.';
  return e instanceof Error ? e.message : String(e);
};

export const usePrinterStore = create<PrinterState>((set, get) => {
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

    printReceipt: (order, reprint = false) => send(buildReceipt(order, get().settings, { reprint })),

    printPreBill: (order) => send(buildPreBill(order, get().settings, TIP_PERCENTAGES)),

    printTest: () => send(buildTestPage(get().settings, get().deviceLabel || 'desconocida')),

    openDrawer: () => send(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])),
  };
});
