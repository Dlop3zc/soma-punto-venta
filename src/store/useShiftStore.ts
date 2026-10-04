import { create } from 'zustand';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, runTransaction, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { useAuthStore } from './useAuthStore';
import { useCartStore } from './useCartStore';
import {
  summarizeShift, expectedCash, round2, type Cancellation, type CashCut,
} from '../utils/cashCut';

export interface CutInput {
  openingFloat: number;
  countedCash: number | null;
  notes: string;
}

interface ShiftState {
  cancellations: Cancellation[];
  cashCuts: CashCut[];
  initCancellationsListener: () => () => void;
  initCashCutsListener: () => () => void;
  performCut: (input: CutInput) => Promise<CashCut>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  cancellations: [],
  cashCuts: [],

  initCancellationsListener: () => onSnapshot(collection(db, 'cancellations'), (snapshot) => {
    const cancellations = snapshot.docs.map(d => d.data() as Cancellation).sort((a, b) => a.createdAt - b.createdAt);
    set({ cancellations });
  }, (error) => {
    console.error("🔥 Error escuchando cancellations:", error);
  }),

  // Solo admin (las reglas no dejan leer cortes a nadie más)
  initCashCutsListener: () => onSnapshot(collection(db, 'cashCuts'), (snapshot) => {
    const cashCuts = snapshot.docs.map(d => d.data() as CashCut).sort((a, b) => b.createdAt - a.createdAt);
    set({ cashCuts });
  }, (error) => {
    console.error("🔥 Error escuchando cashCuts:", error);
  }),

  // Cierra el turno: guarda el resumen y mueve el inicio del siguiente turno a "ahora".
  // Las cuentas abiertas no se tocan: pasan al siguiente turno.
  performCut: async ({ openingFloat, countedCash, notes }) => {
    const { paidOrders, orders, lastCutTime } = useCartStore.getState();
    const to = Date.now();
    const summary = summarizeShift(paidOrders, get().cancellations, lastCutTime, to);
    const expected = expectedCash(summary, round2(openingFloat));
    const ref = doc(collection(db, 'cashCuts'));

    const cut: CashCut = {
      ...summary,
      id: ref.id,
      createdAt: to,
      madeBy: useAuthStore.getState().activeUser?.name || 'Desconocido',
      openOrders: orders.length,
      openingFloat: round2(openingFloat),
      expectedCash: expected,
      countedCash: countedCash === null ? null : round2(countedCash),
      difference: countedCash === null ? null : round2(countedCash - expected),
      notes: notes.trim(),
    };

    await runTransaction(db, async (tx) => {
      const storeRef = doc(db, 'config', 'store');
      const snap = await tx.get(storeRef);
      // Si otro dispositivo cerró el turno mientras tanto, este resumen ya no es válido
      if ((snap.data()?.lastCutTime || 0) !== lastCutTime) {
        throw new Error('Otro dispositivo acaba de hacer el corte. Revisa el historial de cortes.');
      }
      tx.set(ref, cut);
      tx.set(storeRef, { lastCutTime: to }, { merge: true });
    });

    // Avisos ya leídos: no hacen falta en el siguiente turno
    try {
      const read = await getDocs(query(collection(db, 'alerts'), where('read', '==', true)));
      if (!read.empty) {
        const batch = writeBatch(db);
        read.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.error('No se pudieron limpiar los avisos:', e);
    }

    return cut;
  },
}));
