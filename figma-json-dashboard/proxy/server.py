"""
Proxy dinámico local para el plugin "JSON Dashboard" de Figma.

El plugin (que corre dentro de un iframe con origen "null" sobre HTTPS) no puede
llamar directamente a servidores internos HTTP por CORS y Mixed Content.
Este servidor corre en localhost (origen "potencialmente confiable" para el
navegador), recibe la URL destino, hace la petición del lado del servidor y
devuelve el JSON con cabeceras CORS abiertas.

Uso:
    pip install -r requirements.txt
    python server.py                 # escucha en http://localhost:5000

Variables de entorno opcionales:
    PROXY_HOST              Interfaz de escucha (por defecto 127.0.0.1)
    PROXY_PORT              Puerto (por defecto 5000)
    PROXY_TIMEOUT           Timeout por defecto en segundos (por defecto 15)
    PROXY_ALLOWED_NETWORKS  Redes destino permitidas, separadas por coma, en
                            notación CIDR. Usa "*" para permitir cualquier
                            destino. Por defecto solo redes privadas/locales.
    PROXY_VERIFY_TLS        "0" para no verificar certificados HTTPS internos
                            autofirmados (por defecto "1").
"""

from __future__ import annotations

import ipaddress
import json
import logging
import os
import socket
import time
from urllib.parse import urlparse

import requests
from flask import Flask, jsonify, request

# --------------------------------------------------------------------------- #
# Configuración
# --------------------------------------------------------------------------- #
HOST = os.getenv("PROXY_HOST", "127.0.0.1")
PORT = int(os.getenv("PROXY_PORT", "5000"))
DEFAULT_TIMEOUT = float(os.getenv("PROXY_TIMEOUT", "15"))
MAX_TIMEOUT = 120.0
VERIFY_TLS = os.getenv("PROXY_VERIFY_TLS", "1") != "0"

_DEFAULT_NETWORKS = "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8,::1/128,fc00::/7"
_RAW_NETWORKS = os.getenv("PROXY_ALLOWED_NETWORKS", _DEFAULT_NETWORKS).strip()
ALLOW_ANY_TARGET = _RAW_NETWORKS == "*"
ALLOWED_NETWORKS = (
    []
    if ALLOW_ANY_TARGET
    else [ipaddress.ip_network(n.strip(), strict=False) for n in _RAW_NETWORKS.split(",") if n.strip()]
)

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
# Cabeceras que el cliente NO puede reenviar al servidor destino.
BLOCKED_FORWARD_HEADERS = {"host", "content-length", "connection", "transfer-encoding", "origin", "referer"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("figma-proxy")

app = Flask(__name__)
app.json.ensure_ascii = False  # Mantener acentos/ñ legibles en la respuesta.
app.json.sort_keys = False     # Respetar el orden original de las claves del JSON.

session = requests.Session()
# Ignorar HTTP_PROXY/HTTPS_PROXY del sistema: los servidores internos se consultan
# directamente y no a través de un proxy corporativo.
session.trust_env = False


# --------------------------------------------------------------------------- #
# CORS: se aplica a TODAS las respuestas (incluidos errores y preflight OPTIONS)
# --------------------------------------------------------------------------- #
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept, Authorization"
    response.headers["Access-Control-Max-Age"] = "86400"
    # Chromium "Private Network Access": permite que un contexto público
    # (el iframe del plugin) llame a localhost.
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
class ProxyError(Exception):
    def __init__(self, http_status: int, code: str, message: str, **details):
        super().__init__(message)
        self.http_status = http_status
        self.code = code
        self.message = message
        self.details = details


def error_response(http_status: int, code: str, message: str, **details):
    payload = {"ok": False, "error": {"code": code, "message": message, **details}}
    return jsonify(payload), http_status


def validate_target_url(raw_url: str | None) -> str:
    """Valida formato, esquema y red destino de la URL."""
    if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
        raise ProxyError(400, "MISSING_TARGET_URL", "Debes enviar 'target_url'.")

    url = raw_url.strip()
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ProxyError(400, "INVALID_SCHEME", "La URL debe comenzar con http:// o https://.", url=url)
    if not parsed.hostname:
        raise ProxyError(400, "INVALID_URL", "La URL no contiene un host válido.", url=url)

    # Evita que el proxy se llame a sí mismo en bucle.
    if parsed.hostname in ("localhost", "127.0.0.1", "::1") and (parsed.port or 80) == PORT:
        raise ProxyError(400, "PROXY_LOOP", "La URL destino apunta al propio proxy.", url=url)

    if not ALLOW_ANY_TARGET:
        try:
            infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        except socket.gaierror:
            raise ProxyError(502, "DNS_ERROR", f"No se pudo resolver el host '{parsed.hostname}'.", url=url)

        addresses = {info[4][0] for info in infos}
        for addr in addresses:
            ip = ipaddress.ip_address(addr.split("%")[0])
            if not any(ip in net for net in ALLOWED_NETWORKS):
                raise ProxyError(
                    403,
                    "TARGET_NOT_ALLOWED",
                    f"El destino {addr} no está en las redes permitidas. "
                    "Ajusta PROXY_ALLOWED_NETWORKS si es intencional.",
                    url=url,
                )
    return url


def decode_json_body(resp: requests.Response):
    """Intenta decodificar el cuerpo como JSON tolerando encodings típicos de servlets Java."""
    raw = resp.content
    if not raw:
        return None

    candidates = []
    if resp.encoding:
        candidates.append(resp.encoding)
    candidates += ["utf-8-sig", "utf-8", "latin-1"]

    last_error = None
    for enc in dict.fromkeys(candidates):  # sin duplicados, preservando orden
        try:
            return json.loads(raw.decode(enc))
        except (UnicodeDecodeError, LookupError, json.JSONDecodeError) as exc:
            last_error = exc
    raise ValueError(str(last_error))


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "service": "figma-json-proxy",
            "allowed_networks": "*" if ALLOW_ANY_TARGET else [str(n) for n in ALLOWED_NETWORKS],
        }
    )


@app.route("/api/proxy", methods=["GET", "POST"])
def proxy():
    """
    POST /api/proxy  (recomendado)
        {
          "target_url": "http://192.168.28.130/reng/servlet/...",
          "method":  "GET",            # opcional: GET | POST | PUT | PATCH | DELETE
          "params":  {"k": "v"},       # opcional: query string extra
          "headers": {"X-Foo": "bar"}, # opcional: cabeceras a reenviar
          "body":    {...},            # opcional: cuerpo JSON para POST/PUT
          "timeout": 15                # opcional: segundos
        }

    GET /api/proxy?target_url=<url codificada>   (atajo para pruebas rápidas)
    """
    if request.method == "GET":
        options = {"target_url": request.args.get("target_url")}
    else:
        options = request.get_json(silent=True)
        if not isinstance(options, dict):
            return error_response(400, "INVALID_BODY", "El cuerpo debe ser un JSON con 'target_url'.")

    try:
        target_url = validate_target_url(options.get("target_url"))

        method = str(options.get("method") or "GET").upper()
        if method not in ALLOWED_METHODS:
            raise ProxyError(400, "INVALID_METHOD", f"Método no soportado: {method}.")

        try:
            timeout = min(float(options.get("timeout") or DEFAULT_TIMEOUT), MAX_TIMEOUT)
        except (TypeError, ValueError):
            raise ProxyError(400, "INVALID_TIMEOUT", "'timeout' debe ser numérico.")

        params = options.get("params") if isinstance(options.get("params"), dict) else None
        extra_headers = options.get("headers") if isinstance(options.get("headers"), dict) else {}
        headers = {"Accept": "application/json, text/plain, */*"}
        headers.update(
            {str(k): str(v) for k, v in extra_headers.items() if str(k).lower() not in BLOCKED_FORWARD_HEADERS}
        )

        body = options.get("body")
        log.info("→ %s %s", method, target_url)
        started = time.perf_counter()

        upstream = session.request(
            method,
            target_url,
            params=params,
            headers=headers,
            json=body if body is not None and method != "GET" else None,
            timeout=timeout,
            verify=VERIFY_TLS,
            allow_redirects=True,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        log.info("← %s %s (%d ms)", upstream.status_code, target_url, elapsed_ms)

    except ProxyError as exc:
        log.warning("✗ %s: %s", exc.code, exc.message)
        return error_response(exc.http_status, exc.code, exc.message, **exc.details)
    except requests.exceptions.Timeout:
        return error_response(504, "UPSTREAM_TIMEOUT", "El servidor interno no respondió a tiempo.", url=target_url)
    except requests.exceptions.SSLError as exc:
        return error_response(502, "SSL_ERROR", f"Error TLS con el servidor interno: {exc}", url=target_url)
    except requests.exceptions.ConnectionError:
        return error_response(
            502,
            "UPSTREAM_UNREACHABLE",
            "No se pudo conectar con el servidor interno (¿IP/puerto correctos? ¿estás en la VPN/red?).",
            url=target_url,
        )
    except requests.exceptions.InvalidURL as exc:
        return error_response(400, "INVALID_URL", f"URL inválida: {exc}")
    except requests.exceptions.RequestException as exc:
        return error_response(502, "UPSTREAM_ERROR", f"Error al consultar el servidor interno: {exc}")

    # Decodificar la respuesta
    try:
        data = decode_json_body(upstream)
        is_json = True
    except ValueError:
        data, is_json = None, False

    if upstream.status_code >= 400:
        details = {"upstream_status": upstream.status_code}
        if is_json:
            details["data"] = data
        else:
            details["preview"] = upstream.text[:500]
        return error_response(
            502, "UPSTREAM_HTTP_ERROR", f"El servidor interno respondió con HTTP {upstream.status_code}.", **details
        )

    if not is_json:
        return error_response(
            502,
            "NOT_JSON",
            "El servidor interno respondió, pero el contenido no es JSON válido.",
            upstream_status=upstream.status_code,
            content_type=upstream.headers.get("Content-Type"),
            preview=upstream.text[:500],
        )

    return jsonify(
        {
            "ok": True,
            "target_url": upstream.url,
            "status_code": upstream.status_code,
            "elapsed_ms": elapsed_ms,
            "content_type": upstream.headers.get("Content-Type"),
            "data": data,
        }
    )


# Errores genéricos de Flask, también en JSON (y con CORS gracias a after_request)
@app.errorhandler(404)
def not_found(_):
    return error_response(404, "NOT_FOUND", "Ruta no encontrada. Usa POST /api/proxy.")


@app.errorhandler(405)
def method_not_allowed(_):
    return error_response(405, "METHOD_NOT_ALLOWED", "Método HTTP no permitido en esta ruta.")


@app.errorhandler(500)
def internal_error(exc):
    log.exception("Error interno: %s", exc)
    return error_response(500, "INTERNAL_ERROR", "Error interno del proxy.")


if __name__ == "__main__":
    log.info("Proxy escuchando en http://%s:%d  (destinos: %s)", HOST, PORT, _RAW_NETWORKS)
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
