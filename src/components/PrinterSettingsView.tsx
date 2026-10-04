import type { ReactNode } from 'react';
import { Printer, Usb, Cable, Unplug, FileText, Banknote, Monitor } from 'lucide-react';
import { usePrinterStore, detectDevice, recommendedMode, type PrintMode } from '../store/usePrinterStore';
import { isSerialSupported, isUsbSupported } from '../printer/transport';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

export default function PrinterSettingsView() {
  const {
    settings, status, deviceLabel, lastError, transport,
    updateSettings, connect, disconnect, printTest, openDrawer,
  } = usePrinterStore();

  const supported = settings.connectionType === 'serial' ? isSerialSupported() : isUsbSupported();
  const busy = status === 'connecting' || status === 'printing';
  const device = detectDevice();
  const recommended = recommendedMode();

  const changeMode = async (mode: PrintMode) => {
    if (mode === settings.mode) return;
    if (mode === 'system' && transport) await disconnect();
    updateSettings({ mode });
  };

  return (
    <div className="flex-1 h-full bg-zinc-900 flex flex-col overflow-hidden">
      <div className="page-header">
        <h1 className="page-title">
          <span>🖨️</span> Impresora de Tickets
        </h1>
        <p className="text-zinc-400 mt-1">
          Configura cómo imprime ESTE equipo. Se guarda en este navegador.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
          {/* Modo de impresión */}
          <Card title="¿Cómo imprime este equipo?" className="lg:col-span-2">
            {device === 'ios' && (
              <div className="rounded-xl p-4 border bg-amber-950/30 border-amber-500/30 text-amber-300 text-sm">
                En iPad o iPhone no se puede usar una impresora USB. Imprime desde una computadora o un
                Android conectado a la impresora; aquí solo funcionaría una impresora con AirPrint (Wi‑Fi).
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <ChoiceButton
                active={settings.mode === 'system'}
                disabled={false}
                onClick={() => changeMode('system')}
                icon={<Monitor size={22} />}
                title="Impresora del sistema"
                subtitle={`Driver instalado en Windows o Mac${recommended === 'system' ? ' · recomendado aquí' : ''}`}
              />
              <ChoiceButton
                active={settings.mode === 'direct'}
                disabled={false}
                onClick={() => changeMode('direct')}
                icon={<Usb size={22} />}
                title="USB directo"
                subtitle={`Chrome/Edge sin driver; ideal en Android${recommended === 'direct' ? ' · recomendado aquí' : ''}`}
              />
            </div>
          </Card>

          {settings.mode === 'system' ? (
          <Card title="Impresora del sistema">
            <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-300">
              <li>
                Conecta la impresora por USB e instala su driver (en Windows suele aparecer como
                <b> POS-58</b>; viene en el CD o en la página del fabricante).
              </li>
              <li>
                Presiona <b>Imprimir prueba</b>. En el cuadro de impresión elige esa impresora, papel de
                <b> 58 mm</b> (o 80 mm), márgenes <b>Ninguno</b> y quita encabezados y pies de página.
                Chrome recuerda esta elección.
              </li>
              <li>
                Opcional, para que no aparezca el cuadro cada vez: abre la app desde un acceso directo de
                Chrome con <code className="text-amber-300">--kiosk-printing</code> al final del destino
                (clic derecho al acceso directo → Propiedades → Destino).
              </li>
            </ol>
            {lastError && <p className="text-red-400 text-sm">{lastError}</p>}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={printTest}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                <FileText size={20} /> Imprimir prueba
              </button>
            </div>
            <p className="text-zinc-500 text-xs">
              En este modo no se puede abrir el cajón de dinero desde la app. Si tu cajón se conecta a la
              impresora, el driver suele tener una opción para abrirlo al imprimir.
            </p>
          </Card>
          ) : (
          <Card title="Conexión">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceButton
                active={settings.connectionType === 'usb'}
                disabled={!!transport}
                onClick={() => updateSettings({ connectionType: 'usb' })}
                icon={<Usb size={22} />}
                title="Cable USB"
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
          )}

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
            {/* Opciones de los comandos ESC/POS; con el driver del sistema no aplican */}
            {settings.mode === 'direct' && (
              <>
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
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-zinc-950 border border-zinc-800 rounded-2xl p-4 md:p-6 space-y-5 ${className}`}>
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
