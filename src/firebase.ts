import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDOda3blcbXK2I1VgGaRyMDPSP5BrnlLHY",
  authDomain: "punto-venta-7fa81.firebaseapp.com",
  projectId: "punto-venta-7fa81",
  storageBucket: "punto-venta-7fa81.firebasestorage.app",
  messagingSenderId: "782980453983",
  appId: "1:782980453983:web:7a6f62e43dd75c09362dea",
  measurementId: "G-X2Z8LTQBRS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
