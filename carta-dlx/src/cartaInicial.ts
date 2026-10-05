// Carta original de Terraza SOMA. Solo se usa para llenar una base vacía con el botón
// "Importar carta inicial"; después la carta vive en Firestore (`products` y `config/menu`).

// Lo que se guarda en cada producto vendido (copia en la cuenta: si después cambia
// el precio en la carta, las cuentas ya abiertas conservan el precio con que se pidió)
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export const defaultCategories = [
  'Caguama',
  'Michelada',
  'Bebida Sin Alcohol',
  'Snacks',
  'Coctelería',
  'Coctelería Por Copeo',
  'Cerveza',
  'Tequila',
  'Mezcal',
  'Whisky',
  'Ron',
];

export const defaultProducts: Product[] = [
  // CAGUAMA
  { id: 'cag-1', name: 'Corona 1.2 LT', price: 85, category: 'Caguama' },
  { id: 'cag-2', name: 'Victoria 1.2 LT', price: 85, category: 'Caguama' },
  { id: 'cag-3', name: 'Modelo Especial 1 LT', price: 85, category: 'Caguama' },
  { id: 'cag-4', name: 'Modelo Negra Especial 1 LT', price: 85, category: 'Caguama' },
  { id: 'cag-5', name: 'Pacifico 1.2 LT', price: 85, category: 'Caguama' },

  // MICHELADA
  { id: 'mich-1', name: 'Chelada', price: 120, category: 'Michelada' },
  { id: 'mich-2', name: 'Cubana', price: 120, category: 'Michelada' },
  { id: 'mich-3', name: 'Clamato', price: 120, category: 'Michelada' },

  // BEBIDA SIN ALCOHOL
  { id: 'bsa-1', name: 'Limonada 500 ML', price: 60, category: 'Bebida Sin Alcohol' },
  { id: 'bsa-2', name: 'Naranjada 500 ML', price: 60, category: 'Bebida Sin Alcohol' },
  { id: 'bsa-3', name: 'Suerito 500 ML', price: 60, category: 'Bebida Sin Alcohol' },
  { id: 'bsa-4', name: 'Refresco Lata 355 ML', price: 45, category: 'Bebida Sin Alcohol' },
  { id: 'bsa-5', name: 'Botella de Agua 500 ML', price: 25, category: 'Bebida Sin Alcohol' },

  // SNACKS
  { id: 'snk-1', name: 'Papas Preparadas', price: 65, category: 'Snacks' },

  // COCTELERÍA
  { id: 'coc-1', name: 'Cantarito Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-2', name: 'Cantarito Litro', price: 160, category: 'Coctelería' },
  { id: 'coc-3', name: 'Mezcalita Maracuyá/Mango Medio Litro', price: 110, category: 'Coctelería' },
  { id: 'coc-4', name: 'Mezcalita Maracuyá/Mango Litro', price: 170, category: 'Coctelería' },
  { id: 'coc-5', name: 'Mezcalita Frutos Rojos Medio Litro', price: 110, category: 'Coctelería' },
  { id: 'coc-6', name: 'Mezcalita Frutos Rojos Litro', price: 170, category: 'Coctelería' },
  { id: 'coc-7', name: 'Mezcalita Jamaica Medio Litro', price: 110, category: 'Coctelería' },
  { id: 'coc-8', name: 'Mezcalita Jamaica Litro', price: 170, category: 'Coctelería' },
  { id: 'coc-9', name: 'Mojito Mango/Maracuyá Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-10', name: 'Mojito Mango/Maracuyá Litro', price: 150, category: 'Coctelería' },
  { id: 'coc-11', name: 'Mojito Frutos Rojos Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-12', name: 'Mojito Frutos Rojos Litro', price: 150, category: 'Coctelería' },
  { id: 'coc-13', name: 'Mojito Tradicional Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-14', name: 'Mojito Tradicional Litro', price: 150, category: 'Coctelería' },
  { id: 'coc-15', name: 'Paloma Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-16', name: 'Paloma Litro', price: 160, category: 'Coctelería' },
  { id: 'coc-17', name: 'Pink Paloma Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-18', name: 'Pink Paloma Litro', price: 160, category: 'Coctelería' },
  { id: 'coc-19', name: 'Tinto de Verano Medio Litro', price: 100, category: 'Coctelería' },
  { id: 'coc-20', name: 'Tinto de Verano Litro', price: 160, category: 'Coctelería' },

  // COCTELERÍA POR COPEO
  { id: 'cop-1', name: 'Gin & Tonic Frutos Rojos', price: 160, category: 'Coctelería Por Copeo' },
  { id: 'cop-2', name: 'Gin & Tonic Toronja', price: 160, category: 'Coctelería Por Copeo' },
  { id: 'cop-3', name: 'Gin & Tonic Kiwi Fresa', price: 160, category: 'Coctelería Por Copeo' },
  { id: 'cop-4', name: 'Gin & Tonic Mango Maracuyá', price: 160, category: 'Coctelería Por Copeo' },
  { id: 'cop-5', name: 'Frozen Margarita de Mango', price: 120, category: 'Coctelería Por Copeo' },
  { id: 'cop-6', name: 'Frozen Margarita de Limón', price: 120, category: 'Coctelería Por Copeo' },
  { id: 'cop-7', name: 'Frozen Margarita de Frutos Rojos', price: 120, category: 'Coctelería Por Copeo' },

  // CERVEZA
  { id: 'cer-1', name: 'Corona 355 ML', price: 50, category: 'Cerveza' },
  { id: 'cer-2', name: 'Victoria 355 ML', price: 50, category: 'Cerveza' },
  { id: 'cer-3', name: 'Stella Artois 355 ML', price: 55, category: 'Cerveza' },
  { id: 'cer-4', name: 'Amstel Ultra 355 ML', price: 55, category: 'Cerveza' },
  { id: 'cer-5', name: 'Modelo Especial 473 ML (Cerillito)', price: 65, category: 'Cerveza' },
  { id: 'cer-6', name: 'Tarro Chelado', price: 15, category: 'Cerveza' },
  { id: 'cer-7', name: 'Tarro Cubano', price: 25, category: 'Cerveza' },

  // TEQUILA
  { id: 'teq-1', name: 'Don Julio 70 Cristalino 700 ML - Botella', price: 2200, category: 'Tequila' },
  { id: 'teq-2', name: 'Don Julio 70 Cristalino 700 ML - Shot', price: 150, category: 'Tequila' },
  { id: 'teq-3', name: 'Don Julio Blanco 700 ML - Botella', price: 1600, category: 'Tequila' },
  { id: 'teq-4', name: 'Don Julio Blanco 700 ML - Shot', price: 110, category: 'Tequila' },
  { id: 'teq-5', name: 'Tequila 1800 - Botella', price: 1800, category: 'Tequila' },
  { id: 'teq-6', name: 'Tequila 1800 - Shot', price: 120, category: 'Tequila' },
  { id: 'teq-7', name: 'Maestro Dobel Cristalino 700 ML - Botella', price: 2000, category: 'Tequila' },
  { id: 'teq-8', name: 'Maestro Dobel Cristalino 700 ML - Shot', price: 130, category: 'Tequila' },
  { id: 'teq-9', name: 'Hornitos 1 LT - Botella', price: 1100, category: 'Tequila' },
  { id: 'teq-10', name: 'Hornitos 1 LT - Shot', price: 80, category: 'Tequila' },
  { id: 'teq-11', name: 'Jose Cuervo Plata 990 ML - Botella', price: 1000, category: 'Tequila' },
  { id: 'teq-12', name: 'Jose Cuervo Plata 990 ML - Shot', price: 65, category: 'Tequila' },
  { id: 'teq-13', name: 'Jose Cuervo Reposado 990 ML - Botella', price: 850, category: 'Tequila' },
  { id: 'teq-14', name: 'Jose Cuervo Reposado 990 ML - Shot', price: 50, category: 'Tequila' },

  // MEZCAL
  { id: 'mez-1', name: '400 Conejos Joven 700 ML - Botella', price: 1650, category: 'Mezcal' },
  { id: 'mez-2', name: '400 Conejos Joven 700 ML - Shot', price: 110, category: 'Mezcal' },
  { id: 'mez-3', name: '400 Conejos Reposado 700 ML - Botella', price: 1800, category: 'Mezcal' },
  { id: 'mez-4', name: '400 Conejos Reposado 700 ML - Shot', price: 120, category: 'Mezcal' },

  // WHISKY
  { id: 'whi-1', name: 'Johnnie Walker Red Label 700 ML - Botella', price: 1300, category: 'Whisky' },
  { id: 'whi-2', name: 'Johnnie Walker Red Label 700 ML - Shot', price: 90, category: 'Whisky' },
  { id: 'whi-3', name: 'Johnnie Walker Black Label 750 ML - Botella', price: 2100, category: 'Whisky' },
  { id: 'whi-4', name: 'Johnnie Walker Black Label 750 ML - Shot', price: 140, category: 'Whisky' },
  { id: 'whi-5', name: 'Jack Daniels 700 ML - Botella', price: 1650, category: 'Whisky' },
  { id: 'whi-6', name: 'Jack Daniels 700 ML - Shot', price: 110, category: 'Whisky' },

  // RON
  { id: 'ron-1', name: 'Bacardi 980 ML - Botella', price: 900, category: 'Ron' },
  { id: 'ron-2', name: 'Bacardi 980 ML - Shot', price: 70, category: 'Ron' },
  { id: 'ron-3', name: 'Bacardi Añejo 700 ML - Botella', price: 1050, category: 'Ron' },
  { id: 'ron-4', name: 'Bacardi Añejo 700 ML - Shot', price: 80, category: 'Ron' },
  { id: 'ron-5', name: 'Baraima 750 ML - Botella', price: 850, category: 'Ron' },
  { id: 'ron-6', name: 'Baraima 750 ML - Shot', price: 60, category: 'Ron' },
];
