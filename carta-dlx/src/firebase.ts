import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Se conecta a la base de SOMA solo para leer (sin sesión). Ver .env.produccion / .env.pruebas.
const env = import.meta.env;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const db = getFirestore(app);
