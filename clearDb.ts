import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './src/firebase.ts';

async function cleanDB() {
  console.log('Iniciando limpieza de base de datos...');
  
  // Limpiar orders
  const ordersSnap = await getDocs(collection(db, 'orders'));
  let count = 0;
  for (const d of ordersSnap.docs) {
    await deleteDoc(d.ref);
    count++;
  }
  console.log(`Borradas ${count} órdenes activas.`);

  // Limpiar paidOrders
  const paidSnap = await getDocs(collection(db, 'paidOrders'));
  count = 0;
  for (const d of paidSnap.docs) {
    await deleteDoc(d.ref);
    count++;
  }
  console.log(`Borradas ${count} órdenes pagadas.`);

  // Limpiar alerts
  const alertsSnap = await getDocs(collection(db, 'alerts'));
  count = 0;
  for (const d of alertsSnap.docs) {
    await deleteDoc(d.ref);
    count++;
  }
  console.log(`Borradas ${count} alertas.`);

  // Asegurar usuarios
  const usersSnap = await getDocs(collection(db, 'users'));
  count = 0;
  for (const d of usersSnap.docs) {
    const user = d.data();
    if (user.password === '123') {
      const newPass = 'Soma' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      await updateDoc(d.ref, { password: newPass });
      console.log(`Usuario ${user.username} actualizado. Nueva contraseña: ${newPass}`);
      count++;
    }
  }
  console.log(`Se actualizaron las contraseñas de ${count} usuarios.`);

  console.log('Limpieza completada exitosamente.');
  process.exit(0);
}

cleanDB().catch(console.error);
