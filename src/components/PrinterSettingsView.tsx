import type { ReactNode } from 'react';
import { Printer, Usb, Cable, Unplug, FileText, Banknote } from 'lucide-react';
import { usePrinterStore } from '../store/usePrinterStore';
import { isSerialSupported, isUsbSupported } from '../printer/transport';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

export default function PrinterSettingsView() {
  const {
    settings, status, deviceLabel, lastError, transport,
    updateSettings, connect, disconnect, printTest, openDrawer,
  } = usePrinterStore();

  const supported = settings.connectionType === 'serial' ? isSerialSupported() : isUsbSupported();
  const busy = status === 'connecting' || status === 'printing';

  return (
    <div className="flex-1 h-full bg-zinc-900 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-zinc-800 bg-zinc-950">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span>🖨️</span> Impresora de Tickets
        </h1>
        <p className="text-zinc-400 mt-1">
          Impresión directa ESC/POS desde este equipo. La configuración se guarda en este navegador.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
          {/* Conexión */}
          <Card title="Conexión">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceButton
                active={settings.connectionType === 'usb'}
                disabled={!!transport}
                onClick={() => updateSettings({ connectionType: 'usb' })}
                icon={<Usb size={22} />}
                title="USB directo"
                subtitle="WebUSB"
              />
              <ChoiceButton
                active={settings.connectionType === 'serial'}
                disabled={!!transport}
                onClick={() => updateSettings({ connectionType: 'serial' })}
                icon={<Cable size={22} />}
                title="Puerto serie / Bluetooth"
                subtitle="Web Serial"
              />
            </div>

            {settings.connectionType === 'serial' && (
              <Field label="Velocidad (baudios)">
                <select
                  value={settings.baudRate}
                  disabled={!!transport}
                  onChange={(e) => updateSettings({ baudRate: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white disabled:opacity-50"
                >
                  {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            )}

            <div className={`rounded-xl p-4 border ${
              transport ? 'bg-emerald-950/30 border-emerald-500/30' : status === 'error' ? 'bg-red-950/30 border-red-500/30' : 'bg-zinc-950 border-zinc-800'
            }`}>
              <p className={`font-bold ${transport ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
                {transport ? `Conectada: ${deviceLabel}` : status === 'connecting' ? 'Conectando...' : 'Sin impresora conectada'}
              </p>
              {lastError && <p className="text-red-400 text-sm mt-1">{lastError}</p>}
              {!supported && (
                <p className="text-amber-400 text-sm mt-1">
                  {window.isSecureContext
                    ? 'Este navegador no soporta esta conexión. Usa Google Chrome o Microsoft Edge.'
                    : 'La impresión directa requiere abrir el sistema por HTTPS (o localhost).'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {transport ? (
                <button
                  onClick={disconnect}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
                >
                  <Unplug size={20} /> Desconectar
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={!supported || busy}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer size={20} /> Buscar impresora
                </button>
              )}
              <button
                onClick={printTest}
                disabled={!transport || busy}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={20} /> {status === 'printing' ? 'Imprimiendo...' : 'Imprimir prueba'}
              </button>
              <button
                onClick={openDrawer}
                disabled={!transport || busy}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Banknote size={20} /> Abrir cajón
              </button>
            </div>

            <details className="text-sm text-zinc-400">
              <summary className="cursor-pointer font-bold text-zinc-300">¿Cuál conexión elijo?</summary>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><b>USB directo:</b> impresoras térmicas USB. En Windows, si el navegador no la deja usar, instala el driver WinUSB para esa impresora (con la herramienta Zadig) o usa la opción de puerto serie.</li>
                <li><b>Puerto serie / Bluetooth:</b> impresoras que aparecen como puerto COM (USB-serie o Bluetooth emparejado). Normalmente 9600 o 115200 baudios; revisa la hoja de autoprueba de la impresora.</li>
                <li>Solo funciona en Chrome o Edge, abriendo el sistema por HTTPS. Una vez autorizada, la impresora se reconecta sola al abrir el sistema.</li>
              </ul>
            </details>
          </Card>

          {/* Formato del ticket */}
          <Card title="Formato del ticket">
            <Field label="Ancho de papel">
              <div className="grid grid-cols-2 gap-3">
                {([80, 58] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => updateSettings({ paperWidth: w })}
                    className={`py-3 rounded-xl font-bold ${settings.paperWidth === w ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {w} mm ({w === 80 ? 48 : 32} columnas)
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Nombre del negocio">
              <input
                value={settings.businessName}
                onChange={(e) => updateSettings({ businessName: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </Field>

            <Field label="Encabezado (dirección, teléfono, RFC — una línea por renglón)">
              <textarea
                rows={3}
                value={settings.headerLines}
                onChange={(e) => updateSettings({ headerLines: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </Field>

            <Field label="Pie de ticket">
              <textarea
                rows={2}
                value={settings.footerLines}
                onChange={(e) => updateSettings({ footerLines: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </Field>

            <Field label="Copias por venta">
              <select
                value={settings.copies}
                onChange={(e) => updateSettings({ copies: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
              >
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            <Check
              checked={settings.autoPrintOnPay}
              onChange={(v) => updateSettings({ autoPrintOnPay: v })}
              label="Imprimir ticket automáticamente al cobrar"
            />
            <Check
              checked={settings.openDrawerOnCash}
              onChange={(v) => updateSettings({ openDrawerOnCash: v })}
              label="Abrir cajón de dinero en pagos en efectivo"
            />
            <Check
              checked={settings.useAccents}
              onChange={(v) => updateSettings({ useAccents: v })}
              label="Imprimir acentos y ñ (desactívalo si salen símbolos raros)"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-zinc-400 font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 text-zinc-300 font-medium cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-blue-500" />
      {label}
    </label>
  );
}

function ChoiceButton({ active, disabled, onClick, icon, title, subtitle }: {
  active: boolean; disabled: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-xl text-left border-2 transition-colors disabled:cursor-not-allowed ${
        active ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
      } ${disabled && !active ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-2 font-bold">{icon} {title}</div>
      <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
    </button>
  );
}
