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

### Pruebas automatizadas

```bash
npm test             # pruebas unitarias (Vitest): cobro, propinas, cuentas, inventario, analítica, tickets
npm run test:watch   # las vuelve a correr al guardar cambios
```

Las pruebas viven junto al código (`src/**/*.test.ts`) y usan datos de ejemplo de
`src/test/fixtures.ts`. Prueban funciones sin Firebase ni pantallas, así que corren en
menos de un segundo. Para agregar una, crea `algo.test.ts` junto al archivo que pruebas:

```ts
import { test, expect } from 'vitest';
import { computeCheckout } from './checkout';

test('propina del 15% con tarjeta', () => {
  const r = computeCheckout({ subtotal: 290, method: 'Tarjeta', discountInput: '', tipPercent: 15,
    customPercent: '', cashTipInput: '', tenderedInput: '' });
  expect(r.tip).toBe(43.5);
});
```

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

## Pruebas y producción

La app se conecta al proyecto de Firebase indicado por las variables `VITE_FIREBASE_*`:

- **`.env`** (incluido en el repo) apunta al proyecto de **pruebas**. Es lo que se usa por
  defecto en `npm run dev` y en cualquier build que no defina otras variables.
- **Producción:** define **todas** las variables de `.env.example` con los datos del proyecto
  real (consola de Firebase → Configuración del proyecto → Tus apps → Configuración del SDK):
  - en el hosting (Vercel → Settings → Environment Variables, ambiente *Production*), o
  - en un archivo `.env.production.local` (no se sube a git) si compilas en tu computadora.

  Las variables del hosting tienen prioridad sobre `.env`.
- `VITE_ENVIRONMENT_LABEL` muestra una etiqueta (por ejemplo **PRUEBAS**) en el encabezado
  y en el login. En producción déjala vacía.

Para publicar reglas y funciones en cada proyecto:

```bash
npx firebase login
npm run deploy:rules                        # proyecto de pruebas
npx firebase use --add                      # una vez: elegir el proyecto real y llamarlo "produccion"
npm run deploy:rules:prod                   # proyecto de producción
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
3. Definir `VITE_ADMIN_FUNCTIONS=true` en las variables de ese ambiente y volver a desplegar.

## Impresora de tickets

Impresión directa ESC/POS por WebUSB o Web Serial. Solo en Chrome o Edge y con la app
abierta por HTTPS. Se configura en **Impresora** (solo admin).
