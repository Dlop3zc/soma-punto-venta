export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'Bebidas' | 'Snacks';
}

export const mockProducts: Product[] = [
  { id: '1', name: 'Cerveza Corona', price: 40, category: 'Bebidas' },
  { id: '2', name: 'Margarita', price: 90, category: 'Bebidas' },
  { id: '3', name: 'Refresco', price: 30, category: 'Bebidas' },
  { id: '4', name: 'Agua Mineral', price: 25, category: 'Bebidas' },
  { id: '5', name: 'Papas Gajo', price: 60, category: 'Snacks' },
  { id: '6', name: 'Nachos', price: 80, category: 'Snacks' },
  { id: '7', name: 'Cacahuates', price: 20, category: 'Snacks' },
];

export const categories = ['Todo', 'Bebidas', 'Snacks'] as const;
export type Category = typeof categories[number];
