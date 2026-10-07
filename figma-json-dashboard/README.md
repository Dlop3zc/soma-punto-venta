# JSON Dashboard: plugin de Figma + proxy local

```
Figma (iframe ui.html) ──fetch POST──▶ http://localhost:5000/api/proxy ──HTTP──▶ http://192.168.x.x/reng/servlet/...
          │                                   (Flask + CORS)                         (servidor interno)
          └─postMessage(JSON)──▶ code.js ──▶ dibuja el dashboard con Auto Layout en el lienzo
```

## 1. Iniciar el proxy (Python 3.9+)

```bash
cd figma-json-dashboard/proxy
python -m venv .venv
# Windows: .venv\Scripts\activate    |  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python server.py
# → Proxy escuchando en http://127.0.0.1:5000
```

Prueba rápida desde otra terminal:

```bash
curl http://localhost:5000/api/health
curl -X POST http://localhost:5000/api/proxy \
     -H "Content-Type: application/json" \
     -d '{"target_url": "http://192.168.28.130/reng/servlet/TuServlet"}'
```

Variables de entorno opcionales:

| Variable | Por defecto | Uso |
|---|---|---|
| `PROXY_PORT` | `5000` | Puerto. Si lo cambias, actualiza `devAllowedDomains` en `manifest.json` y la URL del proxy en la UI. |
| `PROXY_TIMEOUT` | `15` | Timeout por defecto (segundos). |
| `PROXY_ALLOWED_NETWORKS` | redes privadas + loopback | CIDRs destino permitidos, separados por comas. `*` permite cualquier destino. |
| `PROXY_VERIFY_TLS` | `1` | Pon `0` para aceptar certificados autofirmados de servidores HTTPS internos. |

Códigos de error que devuelve el proxy (`{"ok": false, "error": {"code": ...}}`):
`MISSING_TARGET_URL`, `INVALID_SCHEME`, `INVALID_URL`, `TARGET_NOT_ALLOWED` (403), `DNS_ERROR`,
`UPSTREAM_UNREACHABLE` (502), `UPSTREAM_TIMEOUT` (504), `UPSTREAM_HTTP_ERROR` (502, incluye `upstream_status`),
`NOT_JSON` (502, incluye `preview` del contenido recibido).

## 2. Cargar el plugin en Figma Desktop

1. Abre la app de escritorio de Figma y un archivo de diseño.
2. Menú **Plugins → Development → Import plugin from manifest…**
3. Selecciona `figma-json-dashboard/plugin/manifest.json`.
4. Ejecútalo con **Plugins → Development → JSON Dashboard**.

## 3. Probar

1. Con el proxy corriendo, abre **Configuración avanzada → Probar conexión con el proxy** (debe decir "Proxy OK").
2. Pega la URL del servidor interno (ej. `http://192.168.28.130/reng/servlet/...`), elige GET o POST
   (con cuerpo JSON opcional) y pulsa **Obtener Datos**.
3. El plugin crea un frame `Dashboard · …` en el centro de la vista:
   - **Cabecera** con título, URL, método/estado HTTP y fecha.
   - **KPIs**: tipo raíz, nº de valores, registros de la lista más grande, tiempo de respuesta.
   - **Resumen general**: propiedades simples de primer nivel como filas clave/valor.
   - Una **tarjeta por cada objeto/lista**: objetos → filas clave/valor (recursivo hasta 4 niveles),
     listas de objetos → tabla (50 filas / 8 columnas máx.), listas simples → chips.
4. Las URLs usadas se guardan (últimas 10) y aparecen como sugerencias en el campo de URL.

Límites ajustables en `CONFIG` al inicio de `code.js`.

## Solución de problemas

- **"No se pudo conectar con el proxy"**: el servidor Python no está corriendo o el puerto no coincide.
- **Error de CSP / `Refused to connect`** en la consola (Plugins → Development → Show/Hide console):
  la URL del proxy no está en `devAllowedDomains` del `manifest.json`. Tras editar el manifest,
  vuelve a ejecutar el plugin.
- **`UPSTREAM_UNREACHABLE` / `UPSTREAM_TIMEOUT`**: tu equipo no ve la IP interna (VPN, firewall, IP o puerto incorrectos).
  Comprueba con `curl http://192.168.28.130/...` desde la misma máquina.
- **`TARGET_NOT_ALLOWED`**: el host destino resuelve a una IP pública; añádela a `PROXY_ALLOWED_NETWORKS`.
- **`NOT_JSON`**: el servlet devolvió HTML (página de login, error de Tomcat…); revisa el campo `preview`.
- El proxy ignora `HTTP_PROXY`/`HTTPS_PROXY` del sistema para que las IPs internas se consulten directamente.
