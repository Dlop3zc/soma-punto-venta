// Funciones de administración de usuarios (requieren el plan Blaze de Firebase).
// Desplegar con: npx firebase-tools deploy --only functions
// y compilar la app con VITE_ADMIN_FUNCTIONS=true para usarlas.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const MIN_PASSWORD_LENGTH = 8;

// Solo un administrador activo puede llamar estas funciones
async function assertAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const profile = snap.data();
  if (!profile || profile.active !== true || profile.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede hacer esto.');
  }
  return uid;
}

function targetUid(request) {
  const uid = request.data?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  return uid;
}

export const adminSetPassword = onCall(async (request) => {
  await assertAdmin(request);
  const uid = targetUid(request);
  const password = request.data?.password;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError('invalid-argument', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  await getAuth().updateUser(uid, { password });
  // Cierra las sesiones abiertas de ese usuario en otros dispositivos
  await getAuth().revokeRefreshTokens(uid);
  return { ok: true };
});

export const adminDeleteUser = onCall(async (request) => {
  const callerUid = await assertAdmin(request);
  const uid = targetUid(request);
  if (uid === callerUid) throw new HttpsError('failed-precondition', 'No puedes eliminar tu propio usuario.');
  await getFirestore().doc(`users/${uid}`).delete();
  await getAuth().deleteUser(uid).catch((e) => {
    if (e.code !== 'auth/user-not-found') throw e;
  });
  return { ok: true };
});
