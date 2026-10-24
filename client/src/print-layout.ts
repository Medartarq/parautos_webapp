// Fixed A4 geometry shared by printed documents. Values match the approved reception prototype.
export const A4_RECEPTION_PRINT_STYLES = `
  @media print { body { background:#fff } }
  .sheet { print-color-adjust:exact; -webkit-print-color-adjust:exact }
  .print-logo { position:absolute; left:14.9mm; top:9.8mm; width:24.2mm; height:auto }
  .title { left:auto!important; right:14.9mm; top:18.71mm; font-size:12pt!important; font-weight:700!important; letter-spacing:0!important }
  .subtitle { display:none }
  .rule { left:40.6mm!important; top:22.84mm!important; width:154.3mm!important; height:.69mm!important; background:#221e1f!important }
  .reference-side { position:absolute!important; left:152.92mm!important; top:171.19mm!important; width:42mm!important; height:56.46mm!important; display:grid!important; grid-template-rows:13.92mm 12.45mm 1fr!important; gap:1.2mm!important }
  .reference-side > * { min-height:0; border:.5mm solid #231f20!important; position:relative!important; overflow:hidden }
  .reference-side > :first-child { padding-top:1.87mm!important }
  .reference-side > :nth-child(2) { padding-top:2.4mm!important }
  .reference-side > :last-child { padding-top:1mm!important }
  .reference-side .sign { display:flex!important; flex-direction:column!important; align-items:center!important; padding:1mm!important; text-align:center!important }
  .reference-side .signature-title { display:block!important; flex:0 0 auto!important; min-height:7.5mm!important; font-size:5.2pt!important; font-weight:700!important; line-height:1.25!important }
  .reference-side .sign img { position:static!important; display:block!important; flex:1 1 auto!important; min-height:0!important; width:34mm!important; height:11mm!important; margin:auto 0 .4mm!important; object-fit:contain!important }
  .reference-side .sign label { position:static!important; display:block!important; flex:0 0 auto!important; width:100%!important; font-size:8pt!important; line-height:1!important }
  .reference-side i { print-color-adjust:exact; -webkit-print-color-adjust:exact }
  .checklist { display:block!important; overflow:hidden!important }
  .print-inventory { width:180mm; border-collapse:collapse; table-layout:fixed; font-size:6.9pt; line-height:1 }
  .print-inventory th, .print-inventory td { height:5.12mm; border:.25mm solid #231f20; padding:0 1mm; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; vertical-align:middle; font-weight:400 }
  .print-inventory th { font-size:6pt; text-align:left }
  .print-inventory th:nth-child(3n + 2), .print-inventory th:nth-child(3n) { padding:0; background:#221e1f; color:#fff; text-align:center; font-size:7.5pt; font-weight:700 }
  .print-inventory td:nth-child(3n + 2), .print-inventory td:nth-child(3n) { padding:0; text-align:center; font-size:9pt; font-weight:700 }
  .print-observations { position:absolute; left:28.6mm; top:76.5mm; width:166.4mm; height:15mm; border-collapse:collapse; table-layout:fixed; font-size:8pt; line-height:1.2 }
  .print-observations th, .print-observations td { padding:0; border:0; vertical-align:top; text-align:left; font-weight:400 }
  .print-observations th { width:26.4mm; font-size:9pt; white-space:nowrap }
  .print-observations td { overflow:hidden; overflow-wrap:anywhere }
  .reference-fuel .fuel-tick { width:.6mm!important; background:#231f20!important }
  .reference-fuel .fuel-tick.selected { width:2.2mm!important; background:#111!important; box-shadow:0 0 0 .2mm #111; print-color-adjust:exact; -webkit-print-color-adjust:exact }
  .reference-fuel::before, .reference-fuel::after { position:absolute; top:7.2mm; font-size:9pt; line-height:1; content:"" }
  .reference-fuel::before { content:"E"; left:2.6mm }
  .reference-fuel::after { content:"F"; right:2.6mm }
  .print-km-title { position:absolute!important; left:0!important; right:0!important; top:1.3mm!important; text-align:center!important; font-size:8pt!important; line-height:1!important }
  .reference-km div:has(> i) { position:absolute!important; left:1.6mm!important; right:1.6mm!important; bottom:.6mm!important; height:5.1mm!important; display:grid!important; grid-template-columns:repeat(8,1fr)!important }
  .reference-km div:has(> i) i { position:static!important; width:auto!important; height:auto!important; margin:0!important; transform:none!important; display:grid!important; place-items:center!important; border:.25mm solid #231f20!important; font-size:9pt!important }
  .reference-km div:has(> i) i + i { border-left:0!important }
  .print-footer { position:absolute; left:14.93mm; top:271.29mm; width:180mm; height:5.71mm; padding-left:22mm; display:flex; align-items:center; gap:2.4mm; background:#221e1f; color:#fff; font-size:9.5pt; font-weight:700; print-color-adjust:exact; -webkit-print-color-adjust:exact }
  .print-footer span { flex:1 }
  .print-brands { position:absolute; left:14.9mm; top:277.6mm; width:180mm; height:auto }
`;
