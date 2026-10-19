let pdfLibrary: Promise<{
  jsPDF: typeof import("jspdf").jsPDF;
  autoTable: typeof import("jspdf-autotable").default;
}> | undefined;

export const loadPdfLibrary = () => pdfLibrary ??= Promise.all([
  import("jspdf"),
  import("jspdf-autotable"),
]).then(([jspdf, autoTable]) => ({ jsPDF: jspdf.jsPDF, autoTable: autoTable.default }));
