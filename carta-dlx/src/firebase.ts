import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Se conecta a la base de SOMA (ver .env.produccion / .env.pruebas). La carta pública lee sin
// sesión; el editor (/admin) entra con una cuenta de DLX registrada en `menuEditors`.
const env = import.meta.env;
export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const db = getFirestore(app);
