import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// La configuración web de Firebase es pública por diseño: la seguridad la dan
// Firebase Authentication y las reglas de Firestore (firestore.rules).
const firebaseConfig = {
  apiKey: "AIzaSyDOda3blcbXK2I1VgGaRyMDPSP5BrnlLHY",
  authDomain: "punto-venta-7fa81.firebaseapp.com",
  projectId: "punto-venta-7fa81",
  storageBucket: "punto-venta-7fa81.firebasestorage.app",
  messagingSenderId: "782980453983",
  appId: "1:782980453983:web:7a6f62e43dd75c09362dea",
  measurementId: "G-X2Z8LTQBRS"
};

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
