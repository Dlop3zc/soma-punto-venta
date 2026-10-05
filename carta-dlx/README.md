# Carta digital de Terraza SOMA (DLX)

La carta que ven los clientes al escanear el QR de las mesas. Es una app aparte del punto de venta
y la administra DLX: se publica en su propio sitio, con su propia dirección.

- Se abre sin iniciar sesión, en el celular, y se actualiza sola.
- **Los productos, precios y categorías vienen en vivo del punto de venta SOMA.** Se editan allá, en
  la pantalla **Carta**: lo que está oculto ahí no aparece aquí, y el orden es el mismo.
- Marca como **Agotado** lo que en el **Inventario** de SOMA está sin existencias o con "En carta" apagado.
- Solo lee. No guarda nada ni puede modificar la base de SOMA.

## Desarrollo

```bash
cd carta-dlx
npm install
npm run dev        # contra la base de PRUEBAS de SOMA
```

`.env.pruebas` y `.env.produccion` traen la configuración web de las dos bases de SOMA. Esos valores
son públicos; lo que protege los datos son las reglas de Firestore de SOMA (`../firestore.rules`),
que dejan leer sin sesión solo los productos visibles, el orden de las categorías y el inventario.

## Publicar (proyecto de Firebase de DLX)

La carta se publica en un proyecto de Firebase de DLX, aparte del de SOMA. Solo usa Hosting.

1. **Una sola vez:** crea el proyecto en [console.firebase.google.com](https://console.firebase.google.com)
   (por ejemplo `carta-soma-dlx`) y entra a **Hosting → Comenzar** (avanza sin correr los comandos que muestra).
2. **Una sola vez:** en esta carpeta, `npx firebase use --add`, elige ese proyecto y llámalo `default`.
3. `npm run deploy`. Compila contra la base de producción de SOMA y publica en `https://<id-del-proyecto>.web.app`.
4. Esa dirección es la que va en el QR. Si DLX conecta un dominio propio (Hosting → Agregar dominio
   personalizado), el QR puede apuntar a ese dominio y no habrá que reimprimirlo si cambia el proyecto.

Si SOMA cambia sus reglas de Firestore y quita la lectura pública de `products`, `config/menu` o
`inventory`, esta carta muestra "No pudimos cargar la carta".
