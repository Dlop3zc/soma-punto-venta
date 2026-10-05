// La carta vive en Firestore (`products` y `config/menu`) y la administra DLX desde
// carta-dlx (repo Dlop3zc/carta-dlx), donde también está la carta original (src/cartaInicial.ts).

// Lo que se guarda en cada producto vendido (copia en la cuenta: si después cambia
// el precio en la carta, las cuentas ya abiertas conservan el precio con que se pidió)
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}
