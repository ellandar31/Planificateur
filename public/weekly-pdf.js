import "./vendor/jspdf-4.2.1.min.js";
import { autoTable } from "./vendor/jspdf-autotable-5.0.8.js";
import { regular, bold } from "./vendor/noto-sans-fonts.js";

export function createWeekPdf({ restaurant, period, rows, groupRows }) {
  const pdf = new globalThis.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.addFileToVFS("NotoSans-Regular.ttf", regular);
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
  pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  pdf.setProperties({ title: `${restaurant} - ${period}` });
  pdf.setFont("NotoSans", "bold");
  pdf.setFontSize(16);
  const titleLines = pdf.splitTextToSize(restaurant, 277);
  pdf.text(titleLines, 10, 16);
  const subtitleY = 16 + titleLines.length * 7;
  pdf.setFont("NotoSans", "normal");
  pdf.setFontSize(10);
  pdf.text(period, 10, subtitleY);
  const groups = new Set(groupRows);
  const body = rows.slice(1).map((row, index) => groups.has(index + 2)
    ? [{ content: row[0], colSpan: rows[0].length, styles: { fillColor: [220, 230, 241], textColor: [32, 56, 100], fontStyle: "bold" } }]
    : row);
  autoTable(pdf, {
    head: [rows[0]],
    body,
    startY: subtitleY + 5,
    margin: { top: 10, right: 10, bottom: 14, left: 10 },
    theme: "grid",
    styles: { font: "NotoSans", fontSize: 8.5, cellPadding: 2, valign: "middle", overflow: "linebreak", lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [32, 56, 100], textColor: 255, fontStyle: "bold" },
    columnStyles: Object.fromEntries(rows[0].map((_, index) => [index, { cellWidth: 277 / rows[0].length }])),
    rowPageBreak: "avoid",
    showHead: "everyPage"
  });
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(`${page} / ${pageCount}`, 287, 203, { align: "right" });
  }
  return pdf;
}
