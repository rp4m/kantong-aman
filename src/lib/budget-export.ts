import type { BudgetPeriod, BudgetItem, PIC, Category } from "./budget-types";
import { formatRupiah, formatDateRange } from "./budget-format";

export interface ExportRow {
  pic: string;
  category: string;
  notes: string;
  budget: number;
  realized: number;
  remaining: number;
  pct: number;
}

export interface PICGroup {
  pic: PIC;
  rows: ExportRow[];
  subtotalBudget: number;
  subtotalRealized: number;
  subtotalRemaining: number;
  subtotalPct: number;
}

export interface ExportData {
  period: BudgetPeriod;
  picGroups: PICGroup[];
  grandTotalBudget: number;
  grandTotalRealized: number;
  grandTotalRemaining: number;
  grandTotalPct: number;
  exportedAt: string;
}

export function buildExportData(
  period: BudgetPeriod,
  periodItems: BudgetItem[],
  catById: Map<string, Category>,
  picById: Map<string, PIC>,
  getRealization: (item: BudgetItem) => number,
): ExportData {
  // Group items by PIC
  const picMap = new Map<string, { pic: PIC; items: BudgetItem[] }>();
  for (const item of periodItems) {
    const pic = picById.get(item.picId);
    if (!pic) continue;
    if (!picMap.has(item.picId)) {
      picMap.set(item.picId, { pic, items: [] });
    }
    picMap.get(item.picId)!.items.push(item);
  }

  const picGroups: PICGroup[] = [];
  let grandTotalBudget = 0;
  let grandTotalRealized = 0;

  for (const { pic, items } of picMap.values()) {
    const rows: ExportRow[] = items.map((item) => {
      const cat = catById.get(item.categoryId);
      const realized = getRealization(item);
      const remaining = item.amount - realized;
      const pct = item.amount > 0 ? (realized / item.amount) * 100 : 0;
      return {
        pic: pic.name,
        category: cat?.name ?? "—",
        notes: item.notes,
        budget: item.amount,
        realized,
        remaining,
        pct,
      };
    });

    const subtotalBudget = rows.reduce((a, r) => a + r.budget, 0);
    const subtotalRealized = rows.reduce((a, r) => a + r.realized, 0);
    const subtotalRemaining = subtotalBudget - subtotalRealized;
    const subtotalPct = subtotalBudget > 0 ? (subtotalRealized / subtotalBudget) * 100 : 0;

    grandTotalBudget += subtotalBudget;
    grandTotalRealized += subtotalRealized;

    picGroups.push({
      pic,
      rows,
      subtotalBudget,
      subtotalRealized,
      subtotalRemaining,
      subtotalPct,
    });
  }

  const grandTotalRemaining = grandTotalBudget - grandTotalRealized;
  const grandTotalPct = grandTotalBudget > 0 ? (grandTotalRealized / grandTotalBudget) * 100 : 0;

  return {
    period,
    picGroups,
    grandTotalBudget,
    grandTotalRealized,
    grandTotalRemaining,
    grandTotalPct,
    exportedAt: new Date().toISOString(),
  };
}

// ===================== EXCEL EXPORT =====================
export async function exportToExcel(data: ExportData): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [];

  // Title header
  rows.push([`Laporan Budget: ${data.period.name}`]);
  rows.push([`Periode: ${formatDateRange(data.period.startDate, data.period.endDate)}`]);
  rows.push([`Diekspor: ${new Date(data.exportedAt).toLocaleString("id-ID")}`]);
  rows.push([]);

  for (const group of data.picGroups) {
    // PIC section header
    rows.push([`PIC: ${group.pic.name}`]);
    if (group.pic.email) rows.push([`Email: ${group.pic.email}`]);
    rows.push([]);

    // Table header
    rows.push(["No", "Kategori", "Catatan", "Budget", "Realisasi", "Sisa", "Utilisasi (%)"]);

    // Data rows
    group.rows.forEach((r, i) => {
      rows.push([
        i + 1,
        r.category,
        r.notes,
        r.budget,
        r.realized,
        r.remaining,
        Number(r.pct.toFixed(2)),
      ]);
    });

    // Subtotal
    rows.push([
      "",
      "SUBTOTAL",
      "",
      group.subtotalBudget,
      group.subtotalRealized,
      group.subtotalRemaining,
      Number(group.subtotalPct.toFixed(2)),
    ]);
    rows.push([]);
  }

  // Grand Total
  rows.push([]);
  rows.push([
    "",
    "GRAND TOTAL",
    "",
    data.grandTotalBudget,
    data.grandTotalRealized,
    data.grandTotalRemaining,
    Number(data.grandTotalPct.toFixed(2)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 5 },  // No
    { wch: 25 }, // Kategori
    { wch: 30 }, // Catatan
    { wch: 20 }, // Budget
    { wch: 20 }, // Realisasi
    { wch: 20 }, // Sisa
    { wch: 15 }, // Utilisasi
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Detail Budget");
  XLSX.writeFile(wb, `Budget_${data.period.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ===================== PDF EXPORT =====================
export async function exportToPDF(data: ExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ---- Header banner ----
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LAPORAN BUDGET", margin, 14);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.period.name, margin, 22);

  doc.setFontSize(8);
  doc.text(`Periode: ${formatDateRange(data.period.startDate, data.period.endDate)}`, margin, 29);
  doc.text(`Diekspor: ${new Date(data.exportedAt).toLocaleString("id-ID")}`, margin, 35);

  // ---- Grand Summary Cards ----
  let y = 46;
  doc.setTextColor(30, 30, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RINGKASAN TOTAL", margin, y);
  y += 4;

  const cardW = (pageW - margin * 2 - 6) / 4;
  const cardH = 16;
  const summaryCards = [
    { label: "Total Budget", value: formatRupiah(data.grandTotalBudget), color: [79, 70, 229] as [number, number, number] },
    { label: "Total Realisasi", value: formatRupiah(data.grandTotalRealized), color: [16, 185, 129] as [number, number, number] },
    { label: "Total Sisa", value: formatRupiah(data.grandTotalRemaining), color: [245, 158, 11] as [number, number, number] },
    { label: "Utilisasi", value: `${data.grandTotalPct.toFixed(1)}%`, color: [99, 102, 241] as [number, number, number] },
  ];

  summaryCards.forEach((card, i) => {
    const cx = margin + i * (cardW + 2);
    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, cx + 3, y + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, cx + 3, y + 11, { maxWidth: cardW - 4 });
  });

  y += cardH + 8;

  // ---- PIC Groups ----
  for (const group of data.picGroups) {
    // Check page break
    if (y > 250) {
      doc.addPage();
      y = 16;
    }

    // PIC section header
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, "F");
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`PIC: ${group.pic.name}`, margin + 3, y + 6.5);

    if (group.pic.email) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 140);
      doc.text(group.pic.email, margin + 3, y + 9.5);
    }

    y += 13;

    // Table
    autoTable(doc, {
      startY: y,
      head: [["No", "Kategori", "Catatan", "Budget", "Realisasi", "Sisa", "Utilisasi"]],
      body: [
        ...group.rows.map((r, i) => [
          String(i + 1),
          r.category,
          r.notes || "-",
          formatRupiah(r.budget),
          formatRupiah(r.realized),
          formatRupiah(r.remaining),
          `${r.pct.toFixed(1)}%`,
        ]),
        // Subtotal row
        ["", "SUBTOTAL", "", formatRupiah(group.subtotalBudget), formatRupiah(group.subtotalRealized), formatRupiah(group.subtotalRemaining), `${group.subtotalPct.toFixed(1)}%`],
      ],
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: {
        textColor: [30, 30, 50],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (hookData) => {
        const isLastRow = hookData.row.index === group.rows.length;
        if (isLastRow) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [224, 231, 255];
          hookData.cell.styles.textColor = [55, 48, 163];
        }
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
        6: { cellWidth: 15, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ---- Grand Total Footer ----
  if (y > 255) {
    doc.addPage();
    y = 16;
  }

  doc.setFillColor(79, 70, 229);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL", margin + 3, y + 5.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const gtParts = [
    `Budget: ${formatRupiah(data.grandTotalBudget)}`,
    `Realisasi: ${formatRupiah(data.grandTotalRealized)}`,
    `Sisa: ${formatRupiah(data.grandTotalRemaining)}`,
    `Utilisasi: ${data.grandTotalPct.toFixed(1)}%`,
  ];
  doc.text(gtParts.join("    |    "), margin + 3, y + 10.5);

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 170);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Halaman ${i} dari ${totalPages}  •  Kantong Aman`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
  }

  doc.save(`Budget_${data.period.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
