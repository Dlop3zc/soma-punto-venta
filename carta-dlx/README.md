# Carta digital de Terraza SOMA (DLX)

La carta que ven los clientes al escanear el QR de las mesas, y el lugar donde DLX da de alta los
productos. Es una app aparte del punto de venta y se publica en su propio sitio.

- **`/`: carta para clientes.** Se abre sin iniciar sesión, en el celular, y se actualiza sola.
- **`/admin`: editor de DLX.** Productos, precios, categorías, su orden y si están visibles. Pide
  inicio de sesión con una cuenta de DLX (ver abajo).
- Todo se guarda en la base de SOMA (`products` y `config/menu`), así que **el punto de venta vende
  esos mismos productos al momento**. SOMA ya no tiene pantalla para editarlos.
- **El inventario se lleva en SOMA.** Las ventas descuentan existencias, y lo que queda sin
  existencias o con "En carta" apagado aparece como **Agotado** en la carta.
- Ocultar un producto lo quita de la carta y del punto de venta. Borrarlo no borra las ventas pasadas.
- Si la base está vacía, el editor ofrece **Importar carta inicial** (la carta original de Terraza SOMA).

## Cuentas de DLX para editar la carta (una vez por persona)

Las cuentas viven en el Firebase Authentication del proyecto de SOMA, pero **no** son usuarios del
punto de venta: no pueden entrar a él ni ver ventas, cortes, personal ni inventario, y el admin de
SOMA no las ve. Se dan de alta a mano en la [consola de Firebase](https://console.firebase.google.com),
en el proyecto de SOMA (`soma-pos` en producción y el de pruebas por separado):

1. **Authentication → Users → Add user:** correo y contraseña de la persona de DLX. Copia su **User UID**.
2. **Firestore Database → Iniciar colección** `menuEditors` (o entra a ella si ya existe) → **Agregar documento**:
   - ID del documento: el **User UID** del paso 1.
   - Campo `active`, tipo *boolean*, valor `true`.
3. Para quitarle el acceso, cambia `active` a `false` o borra el documento.

## Desarrollo

```bash
cd carta-dlx
npm install
npm run dev        # contra la base de PRUEBAS de SOMA
```

`.env.pruebas` y `.env.produccion` traen la configuración web de las dos bases de SOMA. Esos valores
son públicos; lo que protege los datos son las reglas de Firestore de SOMA (`../firestore.rules`):
sin sesión solo se leen los productos visibles, el orden de las categorías y el inventario, y solo
las cuentas de `menuEditors` escriben la carta.

## Publicar (proyecto de Firebase de DLX)

La carta se publica en un proyecto de Firebase de DLX, aparte del de SOMA. Solo usa Hosting.

1. **Una sola vez:** crea el proyecto en [console.firebase.google.com](https://console.firebase.google.com)
   (por ejemplo `carta-soma-dlx`) y entra a **Hosting → Comenzar** (avanza sin correr los comandos que muestra).
2. **Una sola vez:** en esta carpeta, `npx firebase use --add`, elige ese proyecto y llámalo `default`.
3. `npm run deploy`. Compila contra la base de producción de SOMA y publica en `https://<id-del-proyecto>.web.app`.
4. Esa dirección es la que va en el QR. Si DLX conecta un dominio propio (Hosting → Agregar dominio
   personalizado), el QR puede apuntar a ese dominio y no habrá que reimprimirlo si cambia el proyecto.

Las reglas de Firestore viven en el repo de SOMA (`../firestore.rules`) y se publican con SOMA
(`npm run deploy:pruebas` / `deploy:prod` en la raíz). Si quitan la lectura pública de `products`,
`config/menu` o `inventory`, esta carta muestra "No pudimos cargar la carta"; sin `menuEditors`, el
editor no puede guardar.
