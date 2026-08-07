import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Bill, Category, MenuItem, Order, RestaurantSettings } from '../types';
import { formatCurrency, formatDateTime, isDrinkOrBeerItem } from './formatters';

export function printThermalReceipt(
  type: 'cuisine' | 'bar' | 'addition',
  order: Order,
  bill?: Bill,
  settings?: RestaurantSettings,
  categories: Category[] = [],
  menu: MenuItem[] = []
) {
  const restName = settings?.name || 'GastroBar & Resto';
  const restPhone = settings?.phone || '';
  const currency = settings?.currency || 'DA';

  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) return;

  const titleMap = {
    cuisine: 'TICKET CUISINE (PLATS)',
    bar: 'TICKET BAR / BIÈRES / COCKTAILS',
    addition: 'TICKET DE CAISSE - ADDITION',
  };

  const vatRate = settings?.vatRate ?? 0;
  const serviceRate = settings?.serviceRate ?? 0;

  const subtotal = order.items
    .filter((i) => i.status !== 'annulee')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const vat = bill?.taxAmount ?? (subtotal * vatRate) / 100;
  const service = bill?.serviceAmount ?? (subtotal * serviceRate) / 100;
  const total = bill?.total ?? subtotal + vat + service;

  const printedItems = order.items.filter((item) => {
    if (item.status === 'annulee') return false;
    if (type === 'cuisine') return !isDrinkOrBeerItem(item, categories, menu);
    if (type === 'bar') return isDrinkOrBeerItem(item, categories, menu);
    return true;
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${titleMap[type]} - Table ${order.tableId}</title>
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
            color: #000;
            font-size: 12px;
            line-height: 1.3;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; margin-bottom: 4px; text-transform: uppercase; }
          .subtitle { font-size: 14px; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 6px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 2px 0; }
          .item-qty { width: 24px; font-weight: bold; }
          .item-name { width: 160px; }
          .item-price { text-align: right; }
          .note { font-style: italic; font-size: 10px; padding-left: 24px; color: #333; }
          .footer { margin-top: 15px; font-size: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold title">${restName}</div>
          <div>Table N° ${order.tableId} | Commande #${order.orderNumber}</div>
          <div>${formatDateTime(order.createdAt)}</div>
          <div class="bold subtitle" style="margin-top:6px;">--- ${titleMap[type]} ---</div>
        </div>

        <table>
          ${printedItems
            .map(
              (item) => `
            <tr>
              <td class="item-qty">${item.quantity}x</td>
              <td class="item-name">${item.name}</td>
              ${type === 'addition' ? `<td class="item-price">${formatCurrency(item.unitPrice * item.quantity, currency)}</td>` : ''}
            </tr>
            ${item.notes ? `<tr><td colspan="3" class="note">>> REMARQUE: ${item.notes}</td></tr>` : ''}
          `
            )
            .join('')}
        </table>

        ${
          type === 'addition'
            ? `
          <div class="divider"></div>
          <table>
            <tr><td>Sous-total :</td><td class="text-right">${formatCurrency(subtotal, currency)}</td></tr>
            <tr><td>TVA (${vatRate}%) :</td><td class="text-right">${formatCurrency(vat, currency)}</td></tr>
            <tr><td>Service (${serviceRate}%) :</td><td class="text-right">${formatCurrency(service, currency)}</td></tr>
            ${bill?.discountAmount ? `<tr><td>Remise :</td><td class="text-right">-${formatCurrency(bill.discountAmount, currency)}</td></tr>` : ''}
            <tr class="bold" style="font-size: 14px;">
              <td style="padding-top:6px;">TOTAL :</td>
              <td class="text-right" style="padding-top:6px;">${formatCurrency(total, currency)}</td>
            </tr>
          </table>
          ${
            bill
              ? `
            <div class="divider"></div>
            <div>Mode de paiement: <span class="bold">${bill.paymentMethod.toUpperCase()}</span></div>
            ${bill.cashReceived ? `<div>Espèces reçues: ${formatCurrency(bill.cashReceived, currency)}</div>` : ''}
            ${bill.changeGiven ? `<div>Monnaie rendue: ${formatCurrency(bill.changeGiven, currency)}</div>` : ''}
          `
              : ''
          }
        `
            : ''
        }

        <div class="double-divider"></div>
        <div class="footer">
          ${type === 'addition' ? `Merci de votre visite et à bientôt !<br/>${restPhone}` : 'Ticket généré automatiquement par GastroPOS'}
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 800);
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function exportToPDF(title: string, columns: string[], data: Array<Record<string, string | number>>) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 28);

  let y = 40;
  const colWidth = 180 / columns.length;

  // Header
  doc.setFillColor(220, 220, 220);
  doc.rect(14, y - 5, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  columns.forEach((col, idx) => {
    doc.text(col, 16 + idx * colWidth, y);
  });

  y += 10;
  doc.setFont('helvetica', 'normal');

  data.forEach((row) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    columns.forEach((col, idx) => {
      const val = String(row[col] ?? '');
      doc.text(val.substring(0, 20), 16 + idx * colWidth, y);
    });
    y += 8;
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  data: Array<Record<string, unknown>>,
  totalColumn?: string // nom de la colonne à totaliser automatiquement (ex: 'Total')
) {
  const worksheet = XLSX.utils.json_to_sheet(data);

  if (totalColumn && data.length > 0) {
    const keys = Object.keys(data[0]);
    const colIndex = keys.indexOf(totalColumn);

    if (colIndex !== -1) {
      const colLetter = XLSX.utils.encode_col(colIndex);
      const firstDataRow = 2; // ligne 1 = en-têtes, les données commencent en ligne 2
      const lastDataRow = data.length + 1;
      const totalRowIndex = data.length + 1; // ligne juste après la dernière donnée (0-indexée)

      // Libellé "TOTAL" en première colonne de la ligne de total.
      XLSX.utils.sheet_add_aoa(worksheet, [['TOTAL']], { origin: { r: totalRowIndex, c: 0 } });

      // Vraie formule Excel =SOMME(...) — se recalcule automatiquement si
      // les valeurs sont modifiées dans Excel, pas un nombre figé.
      const totalCellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c: colIndex });
      worksheet[totalCellRef] = { t: 'n', f: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };

      // Étend la plage de la feuille pour inclure cette nouvelle ligne.
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      range.e.r = Math.max(range.e.r, totalRowIndex);
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}_${Date.now()}.xlsx`);
}

export function exportToCSV(filename: string, data: Array<Record<string, unknown>>) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
