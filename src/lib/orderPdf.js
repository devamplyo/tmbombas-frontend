import jsPDF from 'jspdf';
import { brl, dateBR, dateTimeBR } from '@/lib/format';
import { ensureSpace } from '@/lib/pdf';

const BRAND = [22, 119, 158];      // cyan escurecido — legível impresso, remete ao tema do app
const TEXT_DARK = [30, 41, 59];
const TEXT_MUTED = [100, 116, 139];
const ROW_ALT = [248, 250, 252];
const BORDER = [226, 232, 240];

function header(doc, title, order) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(18);
  doc.text('TM Bombas', 14, 15);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text("Gestão de bombas d'água e piscinas", 14, 22);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.text(title, 196, 15, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Nº ${order.order_number || order.id}`, 196, 22, { align: 'right' });
}

function infoBox(doc, order, lines) {
  const y = 40;
  const h = 8 + lines.length * 6;
  doc.setDrawColor(...BORDER);
  doc.setFillColor(...ROW_ALT);
  doc.roundedRect(14, y, 182, h, 2, 2, 'FD');

  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(9.5);
  let ly = y + 7;
  lines.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold');
    doc.text(`${label}:`, 18, ly);
    doc.setFont(undefined, 'normal');
    doc.text(String(value), 45, ly);
    ly += 6;
  });
  return y + h + 8;
}

function itemsTable(doc, items, startY) {
  let y = startY;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text('Itens', 14, y);
  y += 6;

  // header da tabela
  doc.setFillColor(...BRAND);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Descrição', 18, y + 5);
  doc.text('Valor', 192, y + 5, { align: 'right' });
  y += 7;

  doc.setFont(undefined, 'normal');
  items.forEach((it, idx) => {
    const desc = it.description
      ? doc.splitTextToSize(it.description, 150)
      : [];
    const rowH = 7 + desc.length * 4;
    y = ensureSpace(doc, y, rowH, 20);

    if (idx % 2 === 1) {
      doc.setFillColor(...ROW_ALT);
      doc.rect(14, y, 182, rowH, 'F');
    }

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(9.5);
    doc.text(it.name || '-', 18, y + 5);
    doc.text(brl(it.value), 192, y + 5, { align: 'right' });

    if (desc.length) {
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(desc, 18, y + 10);
    }

    y += rowH;
    doc.setDrawColor(...BORDER);
    doc.line(14, y, 196, y);
  });

  return y + 6;
}

function totalBox(doc, y, total) {
  y = ensureSpace(doc, y, 16, 20);
  doc.setFillColor(...BRAND);
  doc.roundedRect(130, y, 66, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('Total', 136, y + 8);
  doc.text(brl(total), 192, y + 8, { align: 'right' });
  return y + 20;
}

function footer(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, 285, 196, 285);
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em ${dateTimeBR(new Date())} · TM Bombas`, 14, 290);
    doc.text(`Página ${i}/${pageCount}`, 196, 290, { align: 'right' });
  }
}

/**
 * Gera o PDF de um Orçamento ou de uma Ordem de Serviço (mesmo modelo de
 * dados, diferenciados por `order.type`).
 */
export function generateServiceOrderPdf(order) {
  const doc = new jsPDF();
  const isOrcamento = order.type === 'orcamento';
  const title = isOrcamento ? 'Orçamento de Serviço' : 'Ordem de Serviço';

  header(doc, title, order);

  const infoLines = [
    ['Cliente', order.client_name || '-'],
    ['Data', dateBR(order.created_date)],
  ];
  if (order.scheduled_date) infoLines.push(['Previsão', dateBR(order.scheduled_date)]);
  if (!isOrcamento && order.description) infoLines.push(['Descrição', order.description]);

  let y = infoBox(doc, order, infoLines);

  if (isOrcamento && (order.items || []).length) {
    y = itemsTable(doc, order.items, y);
  }

  totalBox(doc, y, order.service_value);
  footer(doc);

  const prefix = isOrcamento ? 'orcamento' : 'os';
  doc.save(`${prefix}-${order.order_number || order.id}.pdf`);
}
