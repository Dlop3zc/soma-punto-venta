import { create } from 'zustand';
import { auth, db, functions, adminFunctionsEnabled, getSecondaryAuth } from '../firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  reauthenticateWithCredential, updatePassword, EmailAuthProvider, deleteUser as deleteAuthUser,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

export type UserRole = 'admin' | 'waiter' | 'kitchen';

// Perfil en `users/{uid}`. Las contraseñas viven solo en Firebase Authentication.
export interface UserProfile {
  id: string;        // = uid de Firebase Auth
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: number;
}

export interface NewUserInput {
  username: string;
  name: string;
  password: string;
  role: UserRole;
}

// Validaciones en src/utils/validation.ts (sin Firebase, para poder probarlas)
export {
  usernameToEmail, normalizeUsername, validateUsername, validatePassword, MIN_PASSWORD_LENGTH,
} from '../utils/validation';
import { usernameToEmail, normalizeUsername, MIN_PASSWORD_LENGTH } from '../utils/validation';

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet.';
    case 'auth/email-already-in-use':
      return 'Ese nombre de usuario ya existe o se usó antes. Elige otro.';
    case 'auth/weak-password':
      return `La contraseña es muy débil (mínimo ${MIN_PASSWORD_LENGTH} caracteres).`;
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con contraseña no está activado en Firebase (Authentication → Sign-in method → Email/Password).';
    case 'permission-denied':
      return 'No tienes permiso para realizar esta acción.';
    case 'functions/not-found':
    case 'functions/unavailable':
      return 'Las funciones de administración no están desplegadas en Firebase.';
  }
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
}

interface AuthState {
  users: UserProfile[];
  activeUser: UserProfile | null;
  loading: boolean;            // resolviendo la sesión guardada
  setupRequired: boolean;      // no existe ningún administrador todavía
  sessionError: string | null; // p. ej. cuenta desactivada

  initAuth: () => () => void;
  initUsersListener: () => () => void;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  bootstrapAdmin: (input: Omit<NewUserInput, 'role'>) => Promise<void>;
  createUser: (input: NewUserInput) => Promise<void>;
  updateUser: (id: string, updates: Partial<Pick<UserProfile, 'name' | 'role' | 'active'>>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setUserPassword: (id: string, password: string) => Promise<void>;
  changeOwnPassword: (current: string, next: string) => Promise<void>;
}

// Durante la configuración inicial la sesión existe unos instantes antes que el perfil
let creatingOwnProfile = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  users: [],
  activeUser: null,
  loading: true,
  setupRequired: false,
  sessionError: null,

  // Escucha la sesión de Firebase Auth y el perfil del usuario conectado.
  initAuth: () => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubProfile?.();
      unsubProfile = null;

      if (!fbUser) {
        let setupRequired = false;
        try {
          setupRequired = !(await getDoc(doc(db, 'config', 'setup'))).exists();
        } catch {
          // Si no se puede leer (reglas antiguas o sin red) se muestra el login normal
        }
        set({ activeUser: null, users: [], loading: false, setupRequired });
        return;
      }

      unsubProfile = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
        const profile = snap.exists() ? ({ ...snap.data(), id: snap.id } as UserProfile) : null;
        if (!profile && creatingOwnProfile) return;
        if (!profile || profile.active !== true) {
          set({
            activeUser: null,
            loading: false,
            sessionError: profile ? 'Tu usuario está desactivado. Pide ayuda al administrador.' : 'Tu usuario no tiene acceso a este sistema.',
          });
          signOut(auth);
          return;
        }
        set({ activeUser: profile, loading: false, sessionError: null, setupRequired: false });
      }, () => {
        set({ activeUser: null, loading: false, sessionError: 'No se pudo cargar tu perfil.' });
        signOut(auth);
      });
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  },

  // Lista de usuarios (para la pantalla de administración). Solo con sesión iniciada.
  initUsersListener: () => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as UserProfile & { password?: string });
      // Perfiles del sistema anterior (con contraseña en texto plano): el admin los elimina
      const legacy = all.filter(u => 'password' in u);
      if (legacy.length && get().activeUser?.role === 'admin') {
        legacy.forEach(u => deleteDoc(doc(db, 'users', u.id)).catch(console.error));
      }
      const users = all
        .filter(u => !legacy.includes(u))
        .sort((a, b) => a.name.localeCompare(b.name));
      set({ users });
    }, (error) => {
      console.error("🔥 Error escuchando users:", error);
    });
  },

  login: async (username, password) => {
    set({ sessionError: null });
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      return null;
    } catch (e) {
      return authErrorMessage(e);
    }
  },

  logout: async () => {
    await signOut(auth);
  },

  // Primera configuración: crea el administrador inicial. Las reglas solo lo
  // permiten mientras no exista `config/setup`.
  bootstrapAdmin: async ({ username, name, password }) => {
    creatingOwnProfile = true;
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
    } catch (e) {
      creatingOwnProfile = false;
      throw e;
    }
    try {
      const batch = writeBatch(db);
      const profile: UserProfile = {
        id: cred.user.uid,
        username: normalizeUsername(username),
        name: name.trim(),
        role: 'admin',
        active: true,
        createdAt: Date.now(),
      };
      batch.set(doc(db, 'users', cred.user.uid), profile);
      batch.set(doc(db, 'config', 'setup'), { initializedAt: Date.now() });
      await batch.commit();
    } catch (e) {
      // No dejar una cuenta huérfana si alguien más terminó la configuración primero
      await deleteAuthUser(cred.user).catch(() => {});
      throw e;
    } finally {
      creatingOwnProfile = false;
    }
  },

  createUser: async ({ username, name, password, role }) => {
    const secondaryAuth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(username), password);
    try {
      const profile: UserProfile = {
        id: cred.user.uid,
        username: normalizeUsername(username),
        name: name.trim(),
        role,
        active: true,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), profile);
    } catch (e) {
      await deleteAuthUser(cred.user).catch(() => {});
      throw e;
    } finally {
      await signOut(secondaryAuth).catch(() => {});
    }
  },

  updateUser: async (id, updates) => {
    await updateDoc(doc(db, 'users', id), updates);
  },

  // Sin Cloud Functions se borra el perfil: la cuenta queda sin acceso (las reglas
  // exigen un perfil activo). Con funciones también se borra la cuenta de Auth.
  deleteUser: async (id) => {
    if (adminFunctionsEnabled) {
      await httpsCallable(functions, 'adminDeleteUser')({ uid: id });
    } else {
      await deleteDoc(doc(db, 'users', id));
    }
  },

  setUserPassword: async (id, password) => {
    if (!adminFunctionsEnabled) {
      throw new Error('Cambiar la contraseña de otro usuario requiere activar las funciones de administración (plan Blaze).');
    }
    await httpsCallable(functions, 'adminSetPassword')({ uid: id, password });
  },

  changeOwnPassword: async (current, next) => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No hay sesión iniciada.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
    await updatePassword(user, next);
  },
}));
