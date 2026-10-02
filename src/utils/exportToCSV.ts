import type { PaidOrder } from '../store/useCartStore';

export function exportPaidOrdersToCSV(orders: PaidOrder[]) {
  // Define the headers for the CSV
  const headers = [
    'Fecha',
    'Hora',
    'Cuenta',
    'Mesero',
    'Método de Pago',
    'Total',
    'Descuento',
    'Propina',
    '% Propina',
    'Efectivo Recibido',
    'Cambio',
    'Cantidad de Artículos',
    'Detalle de Artículos'
  ];

  // Map each order to a CSV row
  const rows = orders.map(order => {
    const date = new Date(order.paidAt);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Format items as "2x Cerveza, 1x Nachos"
    const itemsDetail = order.items
      .map(item => `${item.quantity}x ${item.name}`)
      .join(' | ')
      .replace(/"/g, '""'); // Escape quotes for CSV

    const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);

    return [
      dateStr,
      timeStr,
      `"${order.name.replace(/"/g, '""')}"`,
      `"${(order.waiter || 'Desconocido').replace(/"/g, '""')}"`,
      order.paymentMethod,
      order.total.toFixed(2),
      (order.discount || 0).toFixed(2),
      (order.tip || 0).toFixed(2),
      order.tipPercent ?? '',
      order.cashTendered !== undefined ? order.cashTendered.toFixed(2) : '',
      order.change !== undefined ? order.change.toFixed(2) : '',
      totalItems,
      `"${itemsDetail}"` // Enclose in quotes to handle commas in the detail
    ].join(',');
  });

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n');

  // Create a Blob and trigger download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is BOM for UTF-8 Excel support
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fileName = `Reporte_Ventas_POS_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
