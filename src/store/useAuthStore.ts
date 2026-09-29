import { create } from 'zustand';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  createdAt: number;
}

interface AuthState {
  users: UserProfile[];
  activeUser: UserProfile | null;
  loading: boolean;
  initUsersListener: () => () => void;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  createUser: (user: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useAuthStore = create<AuthState>((set, get) => ({
  users: [],
  activeUser: null,
  loading: true,

  initUsersListener: () => {
    set({ loading: true });
    
    // Check if we need to seed initial users
    const seedInitialUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      if (snap.empty) {
        console.log('No users found. Creating default users...');
        const defaultUsers: UserProfile[] = [
          { id: generateId(), username: 'admin', password: 'SomaAdmin2026', name: 'Administrador', role: 'admin', createdAt: Date.now() },
          { id: generateId(), username: 'mesero1', password: 'SomaMesero1', name: 'Ana (Mesera)', role: 'waiter', createdAt: Date.now() },
          { id: generateId(), username: 'cocina', password: 'SomaCocina1', name: 'Cocina Principal', role: 'kitchen', createdAt: Date.now() },
        ];
        
        for (const user of defaultUsers) {
          await setDoc(doc(db, 'users', user.id), user);
        }
      }
    };
    
    seedInitialUsers().catch(console.error);

    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      set({ users, loading: false });
      
      // If current user is deleted, log them out
      const { activeUser } = get();
      if (activeUser && !users.find(u => u.id === activeUser.id)) {
        set({ activeUser: null });
      } else if (activeUser) {
        // Update active user data if it changed
        const updatedUser = users.find(u => u.id === activeUser.id);
        if (updatedUser) set({ activeUser: updatedUser });
      }
    }, (error) => {
      console.error("🔥 Error escuchando users:", error);
      set({ loading: false });
    });

    return () => unsub();
  },

  login: async (username, password) => {
    const { users } = get();
    // Encontramos el usuario por username (ignorando mayúsculas)
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user && user.password === password) {
      set({ activeUser: user });
      return true;
    }
    return false;
  },

  logout: () => {
    set({ activeUser: null });
  },

  createUser: async (userData) => {
    const id = generateId();
    const newUser: UserProfile = {
      ...userData,
      id,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', id), newUser);
  },

  updateUser: async (id, updates) => {
    await setDoc(doc(db, 'users', id), updates, { merge: true });
  },

  deleteUser: async (id) => {
    await deleteDoc(doc(db, 'users', id));
  }
}));
