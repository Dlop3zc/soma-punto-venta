import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// El proyecto de Firebase se elige con variables de entorno (ver `.env` y `.env.example`).
// Estos valores son públicos por diseño: la seguridad la dan Firebase Authentication y
// las reglas de Firestore (firestore.rules).
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter(k => !firebaseConfig[k]);
if (missing.length) {
  throw new Error(`Falta la configuración de Firebase (${missing.join(', ')}). Revisa las variables VITE_FIREBASE_* en .env.example.`);
}

// Etiqueta visible para saber a qué base está conectada la app (p. ej. "Pruebas")
export const environmentLabel = env.VITE_ENVIRONMENT_LABEL?.trim() || '';

// Desarrollo local con `firebase emulators:start` (ver README)
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

// Las funciones de admin (cambiar contraseñas ajenas, borrar cuentas) requieren
// el plan Blaze y desplegar la carpeta `functions/`. Se activan con esta variable.
export const adminFunctionsEnabled = import.meta.env.VITE_ADMIN_FUNCTIONS === 'true';

const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-soma' } : firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// Segunda instancia para que el admin cree cuentas sin cerrar su propia sesión
// (createUserWithEmailAndPassword inicia sesión con la cuenta nueva).
export function getSecondaryAuth(): Auth {
  const name = 'secondary';
  const secondary = getApps().find(a => a.name === name)
    ?? initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-soma' } : firebaseConfig, name);
  const secondaryAuth = getAuth(getApp(secondary.name));
  if (useEmulators && !secondaryAuth.emulatorConfig) {
    connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return secondaryAuth;
}
