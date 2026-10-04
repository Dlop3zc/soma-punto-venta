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
- La configuración web de Firebase en `src/firebase.ts` es pública por diseño; lo que
  protege los datos son Authentication y las reglas.

## Puesta en producción de la seguridad (una sola vez)

> La app nueva y las reglas nuevas deben salir **juntas**: con las reglas nuevas la versión
> anterior de la app deja de funcionar, y la app nueva necesita las reglas. Hazlo fuera del
> horario de servicio.

1. **Activar el inicio de sesión con contraseña:** consola de Firebase → Authentication →
   *Comenzar* → Sign-in method → **Correo electrónico/contraseña** → Habilitar.
2. **Publicar la app nueva** (fusionar a `main` / desplegar como de costumbre).
3. **Publicar las reglas:**
   ```bash
   npx firebase login
   npm run deploy:rules
   ```
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
2. `cd functions && npm install && cd .. && npm run deploy:functions`
3. Compilar la app con la variable `VITE_ADMIN_FUNCTIONS=true` (en Vercel: Settings →
   Environment Variables) y volver a desplegar.

## Impresora de tickets

Impresión directa ESC/POS por WebUSB o Web Serial. Solo en Chrome o Edge y con la app
abierta por HTTPS. Se configura en **Impresora** (solo admin).
