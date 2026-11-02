import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";

export type XlsxValue = string | number | { formula?: string; value?: string | number; style?: number } | undefined;

type XlsxSheet = {
  name: string;
  rows: XlsxValue[][];
  columnWidths?: number[];
  mergeCells?: string[];
  freezeRows?: number;
  rowStyles?: Record<number, number>;
  rowHeights?: Record<number, number>;
  logo?: Blob;
};

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const columnName = (index: number) => {
  let result = "";
  for (let value = index; value >= 0; value = Math.floor(value / 26) - 1) result = String.fromCharCode(65 + (value % 26)) + result;
  return result;
};

const cellXml = (reference: string, value: XlsxValue, style?: number) => {
  if (value === undefined) return "";
  const cellStyle = typeof value === "object" && value.style !== undefined ? value.style : style;
  const styleXml = cellStyle === undefined ? "" : ` s="${cellStyle}"`;
  if (typeof value === "number") return `<c r="${reference}"${styleXml}><v>${value}</v></c>`;
  if (typeof value === "object") {
    if (value.formula) return `<c r="${reference}"${styleXml}><f>${escapeXml(value.formula)}</f></c>`;
    if (typeof value.value === "number") return `<c r="${reference}"${styleXml}><v>${value.value}</v></c>`;
    return `<c r="${reference}"${styleXml} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value.value ?? "")}</t></is></c>`;
  }
  return `<c r="${reference}"${styleXml} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const sheetXml = ({ rows, columnWidths, mergeCells, freezeRows, rowStyles, rowHeights, logo }: XlsxSheet) => {
  const columnXml = columnWidths?.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("") ?? "";
  const rowsXml = rows.map((row, rowIndex) => { const rowNumber = rowIndex + 1; const height = rowHeights?.[rowNumber]; return `<row r="${rowNumber}"${height ? ` ht="${height}" customHeight="1"` : ""}>${row.map((value, columnIndex) => cellXml(`${columnName(columnIndex)}${rowNumber}`, value, rowStyles?.[rowNumber])).join("")}</row>`; }).join("");
  const pane = freezeRows ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`;
  const merges = mergeCells?.length ? `<mergeCells count="${mergeCells.length}">${mergeCells.map((reference) => `<mergeCell ref="${reference}"/>`).join("")}</mergeCells>` : "";
  const drawing = logo ? `<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${pane}<cols>${columnXml}</cols><sheetData>${rowsXml}</sheetData>${merges}<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="portrait" paperSize="9" fitToWidth="1" fitToHeight="0"/>${drawing}</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;S/&quot; #,##0.00"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF17212B"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17212B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F8FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFED3337"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF9E8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border/><border><bottom style="thin"><color rgb="FFD8E0E8"/></bottom></border><border><top style="medium"><color rgb="FF17212B"/></top><bottom style="medium"><color rgb="FF17212B"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="2" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="2" fillId="0" borderId="2" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>`;

export async function createXlsxBlob(sheet: XlsxSheet) {
  const zip = new ZipWriter(new BlobWriter("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  const add = (path: string, content: string) => zip.add(path, new TextReader(content));
  const safeSheetName = escapeXml(sheet.name.slice(0, 31));
  const drawingContentTypes = sheet.logo ? `<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : "";
  await add("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${drawingContentTypes}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  await add("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  await add("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  await add("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  await add("xl/styles.xml", stylesXml);
  await add("xl/worksheets/sheet1.xml", sheetXml(sheet));
  if (sheet.logo) {
    await add("xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    await add("xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from><xdr:ext cx="1143000" cy="682000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo PARAUTOS"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1143000" cy="682000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`);
    await add("xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>`);
    await zip.add("xl/media/logo.png", new BlobReader(sheet.logo));
  }
  return zip.close();
}
