import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";

export type XlsxValue = string | number | { formula: string } | undefined;

type XlsxSheet = {
  name: string;
  rows: XlsxValue[][];
  columnWidths?: number[];
  mergeCells?: string[];
  freezeRows?: number;
};

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const columnName = (index: number) => {
  let result = "";
  for (let value = index; value >= 0; value = Math.floor(value / 26) - 1) result = String.fromCharCode(65 + (value % 26)) + result;
  return result;
};

const cellXml = (reference: string, value: XlsxValue) => {
  if (value === undefined) return "";
  if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
  if (typeof value === "object") return `<c r="${reference}"><f>${escapeXml(value.formula)}</f></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const sheetXml = ({ rows, columnWidths, mergeCells, freezeRows }: XlsxSheet) => {
  const columnXml = columnWidths?.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("") ?? "";
  const rowsXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, value)).join("")}</row>`).join("");
  const pane = freezeRows ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
  const merges = mergeCells?.length ? `<mergeCells count="${mergeCells.length}">${mergeCells.map((reference) => `<mergeCell ref="${reference}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}<cols>${columnXml}</cols><sheetData>${rowsXml}</sheetData>${merges}</worksheet>`;
};

export async function createXlsxBlob(sheet: XlsxSheet) {
  const zip = new ZipWriter(new BlobWriter("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  const add = (path: string, content: string) => zip.add(path, new TextReader(content));
  const safeSheetName = escapeXml(sheet.name.slice(0, 31));
  await add("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  await add("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  await add("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  await add("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  await add("xl/worksheets/sheet1.xml", sheetXml(sheet));
  return zip.close();
}
