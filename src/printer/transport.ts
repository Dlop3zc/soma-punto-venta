// Conexión directa con la impresora desde el navegador (Chrome / Edge, requiere HTTPS o localhost).
// - Web Serial: impresoras USB que aparecen como puerto COM, adaptadores USB-serie y Bluetooth (SPP).
// - WebUSB: impresoras USB "clase impresora". En Windows suele requerir el driver WinUSB (Zadig).

export type ConnectionType = 'serial' | 'usb';

// --- Tipos mínimos de Web Serial / WebUSB (no vienen en lib.dom de TypeScript) ---
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}
interface USBEndpointLike { endpointNumber: number; direction: 'in' | 'out'; type: string }
interface USBAlternateLike { interfaceClass: number; endpoints: USBEndpointLike[] }
interface USBInterfaceLike { interfaceNumber: number; alternate: USBAlternateLike; alternates: USBAlternateLike[] }
interface USBConfigurationLike { configurationValue: number; interfaces: USBInterfaceLike[] }
interface USBDeviceLike {
  productName?: string;
  manufacturerName?: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  configuration: USBConfigurationLike | null;
  configurations: USBConfigurationLike[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  selectAlternateInterface(n: number, alt: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
}
interface USBLike {
  requestDevice(options: { filters: object[] }): Promise<USBDeviceLike>;
  getDevices(): Promise<USBDeviceLike[]>;
}

const nav = navigator as Navigator & { serial?: SerialLike; usb?: USBLike };

export const isSerialSupported = () => !!nav.serial && window.isSecureContext;
export const isUsbSupported = () => !!nav.usb && window.isSecureContext;

export interface PrinterTransport {
  readonly type: ConnectionType;
  readonly label: string;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

const CHUNK_SIZE = 512;

// ---------------- Web Serial ----------------
class SerialTransport implements PrinterTransport {
  readonly type = 'serial' as const;
  readonly label: string;
  private port: SerialPortLike;

  constructor(port: SerialPortLike) {
    this.port = port;
    const info = port.getInfo();
    this.label = info.usbVendorId
      ? `Puerto serie (USB ${hex(info.usbVendorId)}:${hex(info.usbProductId ?? 0)})`
      : 'Puerto serie / Bluetooth';
  }

  static async open(port: SerialPortLike, baudRate: number) {
    try {
      await port.open({ baudRate });
    } catch (e) {
      // Si ya estaba abierto (p. ej. tras recargar en caliente) seguimos usándolo
      if (!(e instanceof DOMException && e.name === 'InvalidStateError')) throw e;
    }
    return new SerialTransport(port);
  }

  async write(data: Uint8Array) {
    if (!this.port.writable) throw new Error('El puerto de la impresora no está disponible.');
    const writer = this.port.writable.getWriter();
    try {
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        await writer.write(data.slice(i, i + CHUNK_SIZE));
      }
    } finally {
      writer.releaseLock();
    }
  }

  async close() {
    await this.port.close().catch(() => {});
  }
}

// ---------------- WebUSB ----------------
class UsbTransport implements PrinterTransport {
  readonly type = 'usb' as const;
  readonly label: string;
  private device: USBDeviceLike;
  private endpoint: number;

  constructor(device: USBDeviceLike, endpoint: number) {
    this.device = device;
    this.endpoint = endpoint;
    this.label = [device.manufacturerName, device.productName].filter(Boolean).join(' ')
      || `USB ${hex(device.vendorId)}:${hex(device.productId)}`;
  }

  static async open(device: USBDeviceLike) {
    if (!device.opened) await device.open();
    if (!device.configuration) await device.selectConfiguration(device.configurations[0].configurationValue);

    const config = device.configuration!;
    // Preferimos la interfaz clase impresora (7); si no, cualquiera con endpoint bulk de salida
    const candidates = [...config.interfaces].sort((a, b) =>
      Number(b.alternates.some(alt => alt.interfaceClass === 7)) - Number(a.alternates.some(alt => alt.interfaceClass === 7))
    );

    for (const iface of candidates) {
      for (const [altIndex, alt] of iface.alternates.entries()) {
        const out = alt.endpoints.find(ep => ep.direction === 'out' && ep.type === 'bulk');
        if (!out) continue;
        await device.claimInterface(iface.interfaceNumber);
        if (iface.alternates.length > 1) await device.selectAlternateInterface(iface.interfaceNumber, altIndex);
        return new UsbTransport(device, out.endpointNumber);
      }
    }
    throw new Error('No se encontró una salida de datos en el dispositivo USB. ¿Es una impresora?');
  }

  async write(data: Uint8Array) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      await this.device.transferOut(this.endpoint, data.slice(i, i + CHUNK_SIZE));
    }
  }

  async close() {
    await this.device.close().catch(() => {});
  }
}

// ---------------- API pública ----------------

// Abre el selector del navegador para que el usuario elija la impresora (requiere un clic).
export async function requestPrinter(type: ConnectionType, baudRate: number): Promise<PrinterTransport> {
  if (type === 'serial') {
    if (!isSerialSupported()) throw new Error(unsupportedMessage('Web Serial'));
    const port = await nav.serial!.requestPort();
    return SerialTransport.open(port, baudRate);
  }
  if (!isUsbSupported()) throw new Error(unsupportedMessage('WebUSB'));
  const device = await nav.usb!.requestDevice({ filters: [] });
  return UsbTransport.open(device);
}

// Reconecta sin intervención con un dispositivo autorizado previamente en este navegador.
export async function reconnectPrinter(type: ConnectionType, baudRate: number): Promise<PrinterTransport | null> {
  if (type === 'serial') {
    if (!isSerialSupported()) return null;
    const [port] = await nav.serial!.getPorts();
    return port ? SerialTransport.open(port, baudRate) : null;
  }
  if (!isUsbSupported()) return null;
  const [device] = await nav.usb!.getDevices();
  return device ? UsbTransport.open(device) : null;
}

function unsupportedMessage(api: string) {
  if (!window.isSecureContext) {
    return `La impresión directa requiere HTTPS (o localhost). Abre el sistema desde su dirección segura.`;
  }
  return `Este navegador no soporta ${api}. Usa Google Chrome o Microsoft Edge en computadora o Android.`;
}

function hex(n: number) {
  return n.toString(16).padStart(4, '0');
}
