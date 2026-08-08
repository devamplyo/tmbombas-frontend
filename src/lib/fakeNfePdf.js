import jsPDF from 'jspdf';
import { brl, dateTimeBR } from '@/lib/format';
import { ensureSpace } from '@/lib/pdf';

function fakeAccessKey() {
  let s = '';
  for (let i = 0; i < 44; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function fakeNumero() {
  return String(Date.now()).slice(-6);
}

/**
 * Generates, entirely in the browser, a PDF that SIMULATES a Nota Fiscal de Venda (sales invoice, NF-e).
 * Doesn't represent any real issuance — doesn't call any server/SEFAZ/Focus NFe.
 * sale: { id, client_name, items: [{ product_name, quantity, total }], total, date }
 */
export function generateFakeSaleNfePdf(sale) {
  const doc = new jsPDF();
  const numero = fakeNumero();
  const chave = fakeAccessKey();

  doc.setFillColor(255, 205, 0);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('SIMULAÇÃO — DOCUMENTO SEM VALOR FISCAL', 105, 8, { align: 'center' });
  doc.setFont(undefined, 'normal');

  let y = 24;
  doc.setFontSize(16);
  doc.text('Nota Fiscal de Venda (NF-e) — Simulação', 14, y);
  y += 9;

  doc.setFontSize(9);
  doc.text(`Número: ${numero}   Série: 1`, 14, y);
  y += 5;
  doc.text(`Chave de acesso (simulada): ${chave}`, 14, y);
  y += 5;
  doc.text(`Data de emissão: ${dateTimeBR(sale.date)}`, 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Emitente', 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('TH Bombas — CNPJ a definir', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Destinatário', 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(sale.client_name?.trim() || 'Consumidor não identificado', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Itens', 14, y);
  y += 7;
  doc.setFontSize(9);
  (sale.items || []).forEach((it) => {
    y = ensureSpace(doc, y);
    doc.text(`${it.quantity}× ${it.product_name}`, 14, y);
    doc.text(brl(it.total), 196, y, { align: 'right' });
    y += 5;
  });

  y = ensureSpace(doc, y, 25) + 5;
  doc.setFontSize(12);
  doc.text(`Total: ${brl(sale.total)}`, 14, y);

  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(150, 0, 0);
  const warn = doc.splitTextToSize(
    'Este documento é uma simulação visual gerada localmente, sem qualquer validade fiscal. '
    + 'Não representa emissão real de Nota Fiscal Eletrônica junto à SEFAZ nem a nenhum provedor.',
    180
  );
  doc.text(warn, 14, y);

  doc.save(`nfe-simulada-${numero}.pdf`);
}
