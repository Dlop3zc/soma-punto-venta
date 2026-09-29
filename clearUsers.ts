import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './src/firebase.ts';

const generateId = () => Math.random().toString(36).substr(2, 9);

async function cleanUsers() {
  console.log('Limpiando y recreando usuarios...');
  
  // Borrar todos
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const d of usersSnap.docs) {
    await deleteDoc(d.ref);
  }

  // Crear 3 unicos
  const defaultUsers = [
    { id: generateId(), username: 'admin', password: 'SomaAdmin2026', name: 'Administrador', role: 'admin', createdAt: Date.now() },
    { id: generateId(), username: 'mesero1', password: 'SomaMesero1', name: 'Ana (Mesera)', role: 'waiter', createdAt: Date.now() },
    { id: generateId(), username: 'cocina', password: 'SomaCocina1', name: 'Cocina Principal', role: 'kitchen', createdAt: Date.now() },
  ];

  for (const u of defaultUsers) {
    await setDoc(doc(db, 'users', u.id), u);
  }

  console.log('Usuarios recreados exitosamente con nuevas contraseñas.');
  process.exit(0);
}

cleanUsers().catch(console.error);
