# SOMA Punto de Venta

Punto de venta para bar/restaurante: cuentas por mesa, cocina, caja con propinas,
inventario, impresión de tickets ESC/POS y analítica. Hecho con React + Vite y Firebase
(Authentication + Firestore).

## Desarrollo

```bash
npm install
npm run dev            # contra el proyecto real de Firebase
```

### Desarrollo local sin tocar datos reales

Requiere Java 11+ para el emulador de Firestore.

```bash
npm run emulators      # terminal 1: Auth + Firestore locales (UI en http://localhost:4000)
npm run dev:emulators  # terminal 2: la app conectada a los emuladores
```

La primera vez la app muestra **Configuración inicial** para crear el administrador.

### Pruebas de las reglas de seguridad

```bash
npm run test:rules
```

## Seguridad

- Las contraseñas viven solo en **Firebase Authentication**. Los perfiles (`users/{uid}`)
  guardan nombre, rol (`admin`, `waiter`, `kitchen`) y si están activos.
- Se inicia sesión con un **usuario** (ej. `mesero1`); por dentro se convierte en
  `mesero1@usuarios.soma-pos.app`. No se envían correos a esas direcciones.
- Las reglas de `firestore.rules` exigen sesión con un perfil activo y limitan cada rol a
  lo que necesita. Un usuario **desactivado** pierde el acceso al instante.
- La configuración web de Firebase (variables `VITE_FIREBASE_*`) es pública por diseño;
  lo que protege los datos son Authentication y las reglas.

## Publicar la app (pruebas y producción)

Hay dos ambientes, cada uno con **su propio proyecto de Firebase** (base de datos, usuarios y dirección web):

| Ambiente | Configuración | Alias en `.firebaserc` | Publicar |
|---|---|---|---|
| Pruebas | `.env.pruebas` | `pruebas` | `npm run deploy:pruebas` |
| Producción | `.env.produccion` | `produccion` | `npm run deploy:prod` |

- `npm run dev` siempre usa **pruebas**.
- Cada `deploy:*` compila la app, la publica en Firebase Hosting y publica las reglas de Firestore.
- La app queda en `https://<id-del-proyecto>.web.app`.
- **El build de producción se niega a compilar si:**
  - falta algún dato;
  - `.env.produccion` y `.firebaserc` no coinciden;
  - producción apunta al proyecto de pruebas;
  - tiene la etiqueta "Pruebas".

### Crear el proyecto de producción (una sola vez)

1. **Crear el proyecto.** En [console.firebase.google.com](https://console.firebase.google.com): **Agregar proyecto**, con un nombre como `soma-pos`.
   - Google Analytics es opcional.
   - Anota el **ID del proyecto** (por ejemplo `soma-pos-1a2b3`).
2. **Activar el inicio de sesión con contraseña.** **Authentication** → *Comenzar* → *Sign-in method* → **Correo electrónico/contraseña** → Habilitar.
3. **Crear la base de datos.** **Firestore Database** → *Crear base de datos*.
   - Elige la ubicación más cercana, por ejemplo `nam5` o `us-central`.
   - Escoge *modo de producción*.
4. **Registrar la app web.** ⚙️ *Configuración del proyecto* → *Tus apps* → ícono **</>**.
   - Registra la app con el nombre `SOMA POS`. Deja *Hosting* sin marcar: no hace falta.
   - Copia los valores de `firebaseConfig` en `.env.produccion`:
     - `apiKey` → `VITE_FIREBASE_API_KEY`
     - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
     - y así con los demás.
5. **Conectar el alias.** En la terminal:
   ```bash
   npx firebase login --no-localhost     # si no has iniciado sesión
   npx firebase use --add                # elige el proyecto nuevo y llámalo: produccion
   ```
   Esto agrega `"produccion": "<id>"` a `.firebaserc`.
6. **Publicar.** Corre `npm run deploy:prod`.
   - Si dice que no encuentra el sitio de Hosting, ve en la consola a **Hosting** → *Comenzar* (avanza sin ejecutar los comandos que muestra) y repite.
7. **Configuración inicial.** Abre `https://<id>.web.app`, crea el **administrador** (aparece "Configuración inicial") y da de alta al personal en **Usuarios**.
   - La carta se importa sola.
   - El inventario empieza vacío.
8. **Guardar la configuración.** Sube `.env.produccion` y `.firebaserc` a git.
   - Estos valores no son secretos: lo que protege los datos son Authentication y las reglas.

Desde ese momento, los cambios se prueban primero con `npm run deploy:pruebas` y, cuando todo está bien, se publican con `npm run deploy:prod`.

### Instalar la app en tablets y celulares

La app se puede instalar: abre en pantalla completa y tiene su propio ícono.

- **Android (Chrome):** abre la dirección y ve a menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).
- **iPad/iPhone (Safari):** abre la dirección y toca Compartir → **Agregar a inicio**.
- **PC (Chrome/Edge):** usa el ícono de instalar en la barra de direcciones.

Cuando se publica una versión nueva, la app muestra **"Hay una versión nueva"** con el botón *Actualizar*. Nunca se recarga sola, para no interrumpir un cobro.

### Solo reglas o funciones

```bash
npm run deploy:rules          # reglas en pruebas
npm run deploy:rules:prod     # reglas en producción
```

## Puesta en producción de la seguridad (una sola vez)

> La app nueva y las reglas nuevas deben salir **juntas**: con las reglas nuevas la versión
> anterior de la app deja de funcionar, y la app nueva necesita las reglas. Hazlo fuera del
> horario de servicio.

1. **Activar el inicio de sesión con contraseña:** consola de Firebase → Authentication →
   *Comenzar* → Sign-in method → **Correo electrónico/contraseña** → Habilitar.
2. **Publicar la app nueva** (fusionar a `main` / desplegar como de costumbre).
3. **Publicar las reglas** (`npm run deploy:rules` en pruebas, `npm run deploy:rules:prod`
   en producción; ver la sección anterior).
4. Abrir la app: aparece **Configuración inicial**. Crear la cuenta del administrador.
5. En **Usuarios**, dar de alta a cada mesero y a cocina con una contraseña inicial.
   Cada quien puede cambiarla después con el botón 🔑.

Los perfiles del sistema anterior (que guardaban contraseñas en texto plano) se borran
solos la primera vez que el administrador entra. Las contraseñas viejas que quedaron en el
historial de git dejan de servir porque ya no se usan en ningún lado.

## Funciones de administración (opcional, plan Blaze)

Sin ellas, el admin puede crear, desactivar y eliminar usuarios, y cada quien cambia su
propia contraseña. Con ellas, el admin también puede **restablecer contraseñas olvidadas**
y borrar cuentas por completo.

1. Cambiar el proyecto al plan **Blaze** en la consola de Firebase.
2. `cd functions && npm install && cd .. && npm run deploy:functions` (o `deploy:functions:prod`).
3. Poner `VITE_ADMIN_FUNCTIONS=true` en `.env.pruebas` o `.env.produccion` y volver a publicar.

## Impresora de tickets

> **Activación por ambiente.** La impresión solo aparece donde `VITE_PRINTING=true`. Hoy está
> activa en pruebas (`.env.pruebas`) y apagada en producción. Para activarla en producción,
> agrega `VITE_PRINTING=true` a `.env.produccion` y publica con `npm run deploy:prod`.
> Apagada, la app oculta la pantalla Impresora, el indicador del encabezado y todos los botones
> de imprimir.

Se configura en **Impresora** (solo admin), por equipo. Hay dos modos y el ticket es el mismo
en ambos:

- **Impresora del sistema** (recomendado en PC/Mac). Usa el driver instalado (la Ofichido de
  58 mm aparece en Windows como *POS-58*) y el cuadro de impresión del navegador.
  1. Instalar el driver y conectar la impresora por USB.
  2. En **Imprimir prueba**, elegir la impresora, papel de 58 mm, márgenes *Ninguno* y sin
     encabezados/pies de página. Chrome recuerda la elección.
  3. Para no ver el cuadro de impresión cada vez: abrir la app con un acceso directo de Chrome
     que tenga `--kiosk-printing` al final del destino.

  En este modo la app no puede abrir el cajón de dinero.
- **USB directo** (recomendado en Android con cable OTG). Comandos ESC/POS por WebUSB o Web
  Serial, sin driver; imprime sin cuadro de diálogo y puede abrir el cajón. Solo en Chrome o
  Edge y con la app abierta por HTTPS. En Windows/Mac normalmente no funciona porque el driver
  del sistema ya tiene tomada la impresora.

En iPad/iPhone no se puede usar una impresora USB.

## Corte de caja y cancelaciones

- **Corte (admin):** muestra solo el turno actual, es decir, lo cobrado desde el último corte. Incluye:
  - Ventas en efectivo y con tarjeta.
  - Propinas y descuentos.
  - Ventas por mesero.
  - Productos cancelados.
- **Al cerrar el turno** se captura el fondo de caja y, opcionalmente, el efectivo contado. La app calcula el efectivo esperado (fondo + ventas en efectivo + propinas en efectivo) y muestra si sobra o falta.
- **Cada corte se guarda en `cashCuts`.** En "Cortes anteriores" se puede consultar, imprimir o exportar a CSV. Un corte guardado no se puede modificar.
- **Las cuentas abiertas no se borran** con el corte: pasan al siguiente turno.
- **Cancelaciones:** cualquier mesero puede quitar productos que ya se enviaron a cocina.
  - Indica la cantidad y el motivo, y si las piezas regresan al inventario.
  - Cada cancelación queda en `cancellations` con quién la hizo y por qué, y aparece en el corte.
  - Si el producto se estaba preparando, cocina ve un aviso en "Por Cocinar".
- Después de actualizar, despliega las reglas: `npm run deploy:rules`.

## Carta (productos y precios)

- **Dónde vive la carta:** en Firestore. Los productos están en `products` y el orden de las categorías en `config/menu`. El admin la edita desde la pantalla **Carta**:
  - Agregar, editar o borrar productos.
  - Ocultarlos sin borrarlos.
  - Ordenarlos.
  - Administrar las categorías.
- **Primera vez:** la primera vez que un admin entra, se importa sola la carta original (`src/data/defaultMenu.ts`). Ese archivo ya no se usa después.
- **Cambios de precio:** solo aplican a lo que se pida después. Las cuentas abiertas y las ventas pasadas conservan el precio con que se pidió.
- **Borrar un producto** también borra su registro de inventario. Las ventas anteriores no se pierden.
- **Después de actualizar,** despliega las reglas *antes* de entrar como admin: `npm run deploy:rules`. Sin ellas, la importación inicial falla.

## Menú digital (QR para los clientes)

- **Dirección:** `https://<id-del-proyecto>.web.app/carta` (en producción, `https://soma-pos.web.app/carta`). Es la que va en el QR de las mesas.
- Se abre sin iniciar sesión, en el celular, y se actualiza sola.
- Muestra los productos **visibles** de la Carta, con sus categorías en el mismo orden.
- Marca como **Agotado** lo que en Inventario está sin existencias o desactivado.
- El admin lo abre desde **Carta → Menú digital**.
- Para que funcione hay que publicar las reglas (`npm run deploy:rules` / `deploy:rules:prod`): permiten leer sin sesión los productos visibles, el orden de las categorías y el inventario (incluye las existencias). Nada de ventas, cuentas ni personal.
