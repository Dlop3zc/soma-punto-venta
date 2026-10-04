// Pruebas de las reglas de Firestore contra el emulador.
// Ejecutar con: npm run test:rules
import { test, before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, writeBatch, increment, query, where,
} from 'firebase/firestore';

let env;

const profile = (uid, role, extra = {}) => ({
  id: uid, username: uid, name: `Nombre ${uid}`, role, active: true, createdAt: 1, ...extra,
});

// Contexto con sesión para un uid
const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-soma',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/setup'), { initializedAt: 1 });
    await setDoc(doc(db, 'users/admin1'), profile('admin1', 'admin'));
    await setDoc(doc(db, 'users/mesero1'), profile('mesero1', 'waiter'));
    await setDoc(doc(db, 'users/cocina1'), profile('cocina1', 'kitchen'));
    await setDoc(doc(db, 'users/inactivo'), profile('inactivo', 'waiter', { active: false }));
    // Perfil del sistema anterior, con contraseña en texto plano
    await setDoc(doc(db, 'users/legacy123'), { id: 'legacy123', username: 'viejo', password: 'secreta', role: 'admin', name: 'Viejo' });
    await setDoc(doc(db, 'orders/o1'), { id: 'o1', name: 'Mesa 1', waiter: 'Nombre mesero1', items: [], total: 0, createdAt: 1 });
    await setDoc(doc(db, 'paidOrders/p1'), { id: 'p1', total: 100 });
    await setDoc(doc(db, 'inventory/cag-1'), { tracked: true, stock: 10, available: true });
    await setDoc(doc(db, 'products/cag-1'), { id: 'cag-1', name: 'Corona', price: 85, category: 'Caguama', visible: true, position: 0 });
    await setDoc(doc(db, 'products/oculto'), { id: 'oculto', name: 'Oculto', price: 1, category: 'Caguama', visible: false, position: 1 });
    await setDoc(doc(db, 'config/menu'), { categories: ['Caguama'] });
    await setDoc(doc(db, 'alerts/a1'), { id: 'a1', read: false, message: 'lista' });
  });
});

describe('sin sesión', () => {
  test('no puede leer nada del negocio', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'orders/o1')));
    await assertFails(getDocs(collection(db, 'paidOrders')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'users/legacy123')));
    await assertFails(getDocs(collection(db, 'cancellations')));
    await assertFails(getDocs(collection(db, 'cashCuts')));
    await assertFails(getDoc(doc(db, 'config/store')));
  });

  test('puede leer el menú digital: productos visibles, categorías e inventario', async () => {
    const db = anon();
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('visible', '==', true))));
    await assertSucceeds(getDoc(doc(db, 'products/cag-1')));
    await assertSucceeds(getDoc(doc(db, 'config/menu')));
    await assertSucceeds(getDocs(collection(db, 'inventory')));
  });

  test('no ve productos ocultos de la carta', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'products/oculto')));
    await assertFails(getDocs(collection(db, 'products')));
  });

  test('no puede modificar la carta ni el inventario', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'products/x'), { id: 'x', name: 'X', price: 1, category: 'C', visible: true, position: 0 }));
    await assertFails(setDoc(doc(db, 'config/menu'), { categories: [] }));
    await assertFails(setDoc(doc(db, 'inventory/cag-1'), { stock: increment(-1), updatedAt: 1 }, { merge: true }));
  });

  test('solo puede saber si ya se hizo la configuración inicial', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'config/setup')));
  });

  test('no puede escribir', async () => {
    await assertFails(setDoc(doc(anon(), 'orders/x'), { id: 'x' }));
    await assertFails(setDoc(doc(anon(), 'users/x'), profile('x', 'admin')));
  });
});

describe('usuarios y contraseñas', () => {
  test('un mesero no puede ver la lista de usuarios ni perfiles ajenos', async () => {
    const db = as('mesero1');
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'users/admin1')));
    await assertFails(getDoc(doc(db, 'users/legacy123')));
    await assertSucceeds(getDoc(doc(db, 'users/mesero1')));
  });

  test('un mesero no puede subirse de rol ni crear usuarios', async () => {
    const db = as('mesero1');
    await assertFails(updateDoc(doc(db, 'users/mesero1'), { role: 'admin' }));
    await assertFails(setDoc(doc(db, 'users/nuevo'), profile('nuevo', 'admin')));
  });

  test('el admin administra usuarios', async () => {
    const db = as('admin1');
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(doc(db, 'users/nuevo'), profile('nuevo', 'waiter')));
    await assertSucceeds(updateDoc(doc(db, 'users/mesero1'), { active: false }));
    await assertSucceeds(updateDoc(doc(db, 'users/mesero1'), { role: 'kitchen', name: 'Otro' }));
    await assertSucceeds(deleteDoc(doc(db, 'users/legacy123')));
  });

  test('no se pueden guardar contraseñas en los perfiles', async () => {
    const db = as('admin1');
    await assertFails(setDoc(doc(db, 'users/nuevo'), { ...profile('nuevo', 'waiter'), password: '12345678' }));
  });

  test('el admin no puede quitarse a sí mismo el acceso', async () => {
    const db = as('admin1');
    await assertFails(updateDoc(doc(db, 'users/admin1'), { active: false }));
    await assertFails(updateDoc(doc(db, 'users/admin1'), { role: 'waiter' }));
    await assertFails(deleteDoc(doc(db, 'users/admin1')));
    await assertSucceeds(updateDoc(doc(db, 'users/admin1'), { name: 'Nuevo nombre' }));
  });

  test('un usuario desactivado pierde todo el acceso', async () => {
    const db = as('inactivo');
    await assertFails(getDoc(doc(db, 'orders/o1')));
    await assertFails(setDoc(doc(db, 'orders/x'), { id: 'x' }));
    await assertSucceeds(getDoc(doc(db, 'users/inactivo'))); // solo para saber que está desactivado
  });

  test('una cuenta de Auth sin perfil no tiene acceso', async () => {
    const db = as('desconocido');
    await assertFails(getDoc(doc(db, 'orders/o1')));
    await assertFails(setDoc(doc(db, 'users/desconocido'), profile('desconocido', 'admin')));
  });
});

describe('configuración inicial', () => {
  test('el primer usuario puede crearse como admin una sola vez', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'config/setup')));
    const db = as('primero');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/primero'), profile('primero', 'admin'));
    batch.set(doc(db, 'config/setup'), { initializedAt: 2 });
    await assertSucceeds(batch.commit());

    // Ya configurado: nadie más puede repetirlo
    const db2 = as('segundo');
    const batch2 = writeBatch(db2);
    batch2.set(doc(db2, 'users/segundo'), profile('segundo', 'admin'));
    batch2.set(doc(db2, 'config/setup'), { initializedAt: 3 });
    await assertFails(batch2.commit());
  });

  test('no se puede crear un admin sin marcar la configuración', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'config/setup')));
    await assertFails(setDoc(doc(as('primero'), 'users/primero'), profile('primero', 'admin')));
  });
});

describe('operación del bar', () => {
  test('el mesero opera cuentas y cobra', async () => {
    const db = as('mesero1');
    await assertSucceeds(setDoc(doc(db, 'orders/o2'), { id: 'o2', items: [] }));
    await assertSucceeds(updateDoc(doc(db, 'orders/o1'), { name: 'Mesa 9' }));
    await assertSucceeds(setDoc(doc(db, 'paidOrders/o1'), { id: 'o1', total: 10 }));
    await assertSucceeds(deleteDoc(doc(db, 'orders/o1')));
  });

  test('el mesero no puede alterar ventas cobradas ni la configuración', async () => {
    const db = as('mesero1');
    await assertFails(updateDoc(doc(db, 'paidOrders/p1'), { total: 1 }));
    await assertFails(deleteDoc(doc(db, 'paidOrders/p1')));
    await assertFails(setDoc(doc(db, 'config/store'), { lastCutTime: 1 }));
  });

  test('el mesero solo puede descontar inventario', async () => {
    const db = as('mesero1');
    await assertSucceeds(setDoc(doc(db, 'inventory/cag-1'), { stock: increment(-2), updatedAt: 1 }, { merge: true }));
    await assertFails(setDoc(doc(db, 'inventory/cag-1'), { stock: increment(5), updatedAt: 1 }, { merge: true }));
    await assertFails(updateDoc(doc(db, 'inventory/cag-1'), { available: false }));
    await assertFails(setDoc(doc(db, 'inventory/nuevo'), { tracked: true, stock: 99, available: true }));
  });

  test('el mesero cancela productos enviados y deja registro', async () => {
    const db = as('mesero1');
    const cancel = (id, extra = {}) => ({
      id, orderId: 'o1', productId: 'cag-1', quantity: 2, restocked: true,
      cancelledBy: 'Nombre mesero1', reason: 'Cliente ya no lo quiso', createdAt: 1, ...extra,
    });

    // Cancelación con devolución al inventario, en el mismo lote
    const ok = writeBatch(db);
    ok.set(doc(db, 'cancellations/c1'), cancel('c1'));
    ok.set(doc(db, 'inventory/cag-1'), { stock: increment(2), updatedAt: 1, lastCancellationId: 'c1' }, { merge: true });
    await assertSucceeds(ok.commit());
    await assertSucceeds(getDoc(doc(as('cocina1'), 'cancellations/c1')));

    // No puede devolver más piezas de las canceladas
    const more = writeBatch(db);
    more.set(doc(db, 'cancellations/c2'), cancel('c2'));
    more.set(doc(db, 'inventory/cag-1'), { stock: increment(5), updatedAt: 1, lastCancellationId: 'c2' }, { merge: true });
    await assertFails(more.commit());

    // Ni reutilizar una cancelación ya registrada
    await assertFails(setDoc(doc(db, 'inventory/cag-1'), { stock: increment(2), updatedAt: 2, lastCancellationId: 'c1' }, { merge: true }));

    // Ni devolver si la cancelación dice que no se regresó
    const notRestocked = writeBatch(db);
    notRestocked.set(doc(db, 'cancellations/c3'), cancel('c3', { restocked: false }));
    notRestocked.set(doc(db, 'inventory/cag-1'), { stock: increment(2), updatedAt: 1, lastCancellationId: 'c3' }, { merge: true });
    await assertFails(notRestocked.commit());

    // Ni firmar a nombre de otro, ni borrar o editar el registro
    await assertFails(setDoc(doc(db, 'cancellations/c4'), cancel('c4', { cancelledBy: 'Otro' })));
    await assertFails(updateDoc(doc(db, 'cancellations/c1'), { quantity: 1 }));
    await assertFails(deleteDoc(doc(db, 'cancellations/c1')));
    await assertFails(setDoc(doc(as('cocina1'), 'cancellations/c5'), cancel('c5', { cancelledBy: 'Nombre cocina1' })));
  });

  test('solo el admin hace y ve cortes de caja, y no se pueden modificar', async () => {
    await assertFails(setDoc(doc(as('mesero1'), 'cashCuts/k1'), { id: 'k1', sales: 1 }));
    await assertFails(getDocs(collection(as('mesero1'), 'cashCuts')));
    const db = as('admin1');
    await assertSucceeds(setDoc(doc(db, 'cashCuts/k1'), { id: 'k1', sales: 100 }));
    await assertSucceeds(getDocs(collection(db, 'cashCuts')));
    await assertFails(updateDoc(doc(db, 'cashCuts/k1'), { sales: 1 }));
    await assertFails(deleteDoc(doc(db, 'cashCuts/k1')));
  });

  test('cocina marca listo y avisa, pero no edita otra cosa', async () => {
    const db = as('cocina1');
    await assertSucceeds(getDoc(doc(db, 'orders/o1')));
    await assertSucceeds(updateDoc(doc(db, 'orders/o1'), { items: [{ status: 'listo' }] }));
    await assertSucceeds(setDoc(doc(db, 'alerts/a2'), { id: 'a2', read: false }));
    await assertFails(updateDoc(doc(db, 'orders/o1'), { total: 999 }));
    await assertFails(deleteDoc(doc(db, 'orders/o1')));
    await assertFails(setDoc(doc(db, 'paidOrders/x'), { id: 'x' }));
  });

  test('las alertas solo se pueden marcar como leídas', async () => {
    const db = as('mesero1');
    await assertSucceeds(updateDoc(doc(db, 'alerts/a1'), { read: true }));
    await assertFails(updateDoc(doc(db, 'alerts/a1'), { message: 'otra' }));
    await assertFails(deleteDoc(doc(db, 'alerts/a1')));
  });

  test('el admin hace el corte e inventario completo', async () => {
    const db = as('admin1');
    await assertSucceeds(setDoc(doc(db, 'config/store'), { lastCutTime: 5 }, { merge: true }));
    await assertSucceeds(deleteDoc(doc(db, 'alerts/a1')));
    await assertSucceeds(setDoc(doc(db, 'inventory/cag-1'), { stock: 50, tracked: true, available: false }, { merge: true }));
  });

  test('solo el admin edita la carta, y con datos válidos', async () => {
    const product = (extra = {}) => ({
      id: 'p1', name: 'Margarita', price: 120, category: 'Coctelería', visible: true, position: 0, updatedAt: 1, ...extra,
    });
    const admin = as('admin1');
    await assertSucceeds(setDoc(doc(admin, 'products/p1'), product()));
    await assertSucceeds(updateDoc(doc(admin, 'products/p1'), { price: 99.5, visible: false }));
    await assertSucceeds(setDoc(doc(admin, 'config/menu'), { categories: ['Coctelería'], updatedAt: 1 }));
    await assertFails(setDoc(doc(admin, 'products/p2'), product({ id: 'p2', price: -5 })));
    await assertFails(setDoc(doc(admin, 'products/p3'), product({ id: 'otro' })));
    await assertFails(setDoc(doc(admin, 'products/p4'), product({ id: 'p4', name: '' })));
    await assertFails(setDoc(doc(admin, 'products/p5'), product({ id: 'p5', extra: 1 })));

    for (const uid of ['mesero1', 'cocina1']) {
      const db = as(uid);
      await assertSucceeds(getDoc(doc(db, 'products/p1')));
      await assertSucceeds(getDoc(doc(db, 'config/menu')));
      await assertFails(updateDoc(doc(db, 'products/p1'), { price: 1 }));
      await assertFails(deleteDoc(doc(db, 'products/p1')));
      await assertFails(setDoc(doc(db, 'config/menu'), { categories: [] }));
    }
    await assertFails(getDoc(doc(anon(), 'products/p1')));
    await assertSucceeds(deleteDoc(doc(admin, 'products/p1')));
  });

  test('colecciones desconocidas están cerradas', async () => {
    await assertFails(setDoc(doc(as('admin1'), 'otra/x'), { a: 1 }));
  });
});
