// Imprime un documento HTML con el diálogo de impresión del navegador, usando la
// impresora instalada en el sistema (driver de Windows/Mac). Para imprimir sin el
// diálogo en una PC, abrir Chrome con la opción --kiosk-printing.

const CLEANUP_MS = 60_000;

export function printHtml(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => iframe.remove(), 500);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        resolve(false);
        return;
      }
      win.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, CLEANUP_MS);
      try {
        win.focus();
        win.print();
        resolve(true);
      } catch {
        cleanup();
        resolve(false);
      }
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}
