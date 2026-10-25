# PARAUTOS Prototype Parity Contract

## Purpose

`../documentos/prototipo` is the functional and visual reference for the final
application. The final application may improve security, persistence,
performance, accessibility, and responsive behavior, but it must not remove or
silently alter a prototype flow.

This file is the implementation contract and release checklist. A feature is
not complete merely because code exists.

## Status Vocabulary

- **Pending**: not started.
- **In progress**: implementation is incomplete.
- **Implemented**: code exists but parity has not been proven.
- **Verified**: functional, persistence, desktop, and mobile checks passed.
- **Accepted**: verified and explicitly accepted by the product owner.
- **Approved difference**: intentional difference from the prototype, with a
  reason recorded below the affected item.

Only **Verified** or **Accepted** items allow work to move to the next module.

## Mandatory Parity Gate

Run this gate before starting a subsequent module and before any release:

1. Compare the final screen and interaction to its prototype counterpart.
2. Test a successful path and each relevant validation failure.
3. Confirm data remains correct after refresh, logout/login, and reopening the
   case from MariaDB.
4. Test desktop and a mobile viewport. Reception must be usable one-handed in
   the workshop.
5. Confirm Superadministrator, Administrator, and Advisor permissions match the approved access matrix.
6. Record the commands, test data, and any approved difference in this file.
7. Mark the item **Verified** only when all its checkboxes are complete.

If a requirement has no automated test yet, the manual test and its date must
be recorded. No placeholder screen qualifies as parity.

## Continuidad de recepción entre dispositivos

- **Implemented (manual verification pending):** the seven-step reception has a
  MariaDB-backed draft per authenticated user. It can be resumed by that user on
  desktop or mobile; a revision conflict is surfaced instead of silently
  overwriting remote work. The browser keeps structured form changes in
  IndexedDB while offline, retries when connectivity returns, and checks for a
  remote revision on focus and every 30 seconds. This uses Express/MariaDB and
  browser APIs only; it does not require Redis, WebSocket, or a persistent
  worker.
- Selected evidence and handwritten-evaluation image files are retained in
  IndexedDB on the originating device, so an app reload after camera/gallery
  selection can restore them. They are uploaded only when the order is created;
  they are not yet transferred to another device or uploaded resumably.
- Manual verification still required: begin with the same Advisor on mobile and
  continue on desktop; disconnect before a field change and reconnect; then
  save competing changes from two sessions and confirm the `409` conflict notice
  does not overwrite either copy silently.

## Approved Architecture Differences

These are improvements, not parity failures:

- MariaDB is the source of truth instead of browser `localStorage`.
- Authentication uses Argon2id and HTTP-only sessions instead of selectable
  demo users.
- Files use private local storage in Hostinger (`$HOME/parautos-data/uploads`)
  or configurable S3/R2 storage, instead of Data URLs in `localStorage`.
- API authorization and state transitions run on Express, not only in the UI.
- Reception considerations are intentionally reduced from the prototype's 24 technical flags to six immediately observable intake checks, per product requirement for faster registration.
- The damage editor uses only the body type selected during registration, instead of allowing a second body-type selection in the editor, to prevent inconsistent marks and unnecessary data.

## Current Baseline

| Area | Status | Notes |
| --- | --- | --- |
| Login and session | Verified | Real login, bootstrap Superadministrator, logout, role in session; desktop/mobile validation recorded on 2026-10-17. |
| Login visual identity | Implemented | Prototype logo/background and responsive two-panel composition applied. |
| Application shell | Implemented | Sidebar, topbar, mobile navigation, role-visible navigation. |
| Dashboard | Implemented | Live metrics, priorities, distribution, pending-claim alert, derived operational-pending center, and responsive hierarchy use persisted cases. The new reminder/panel requires final manual visual validation. |
| Order registration | Implemented | The seven-step reception flow, attachments, diagnosis, signature, A4 snapshot, and audit trail persist. Cross-device structured draft continuity is implemented; its mobile/desktop and offline manual verification remains pending. |
| Orders list and detail | Implemented | Persistent inbox, filters, plate-based case identifiers, operational detail, regenerable reception A4 document, diagnosis viewer, quote tab, parts, final control, and history are available. |
| Local evidence storage | Implemented | Authenticated uploads support reception evidence and diagnosis/evaluation attachments. |

## R-01: Authentication and Access

Reference: `documentos/prototipo/index.html`, `panel.html`, `app.js` role rules.

- [x] Real user authentication replaces demo profile selection.
- [x] Superadministrator, Administrator, and Advisor roles exist.
- [x] Session is protected with an HTTP-only cookie.
- [x] Superadministrator-only account management is hidden and API-protected from Administrator and Advisor.
- [x] Administrator-only navigation is hidden from Advisor.
- [x] API authorization is verified for implemented protected modules, including HTTP tests for account management roles.
- [x] Login form visual parity was accepted manually on desktop and mobile on 2026-10-17.

Status: **Verified**

## R-02: Application Shell and Navigation

Reference: `documentos/prototipo/panel.html`, `styles.css`.

- [x] PARAUTOS logo, sidebar, topbar, avatar, alert affordance, and mobile navigation exist.
- [x] Routes exist for Dashboard, New order, Orders, Quotes, Parts, Reports, and Audit.
- [x] Auto, expanded, and compact sidebar modes persist locally; compact auto-expands on hover/focus.
- [x] Mobile menu has scrim, focus handoff, dynamic ARIA state, and Escape-to-close behavior.
- [x] Header notification center uses the authenticated operational-pending API; the Dashboard retains the separate pending-claim alert.
- [x] All navigation routes contain their real module, not a placeholder;
  Cotizaciones now provides an operational pending-quote inbox that opens the
  corresponding order quotation tab.
- [x] Desktop and mobile shell parity manually validated on 2026-10-17:
  navigation, mobile menu, sidebar modes, notification center, session reminder,
  plate identifiers and role-based route visibility were accepted.
- [x] Mobile navigation re-checked and accepted: it reappears when scrolling
  upward and when changing a route, without covering operational content.

Status: **Verified**

## R-03: Dashboard

Reference: `documentos/prototipo/app.js` `dashboard()`.

- [x] Greeting uses the signed-in user.
- [x] Four live metrics: pending quotes, approval wait, parts wait, repair.
- [x] Workshop priorities list uses real cases.
- [x] Case distribution uses real state counts.
- [x] Siniestro-pending alert is visible and actionable.
- [x] Desktop and mobile presentation match prototype hierarchy.
- [x] Dashboard metric cards use a consistent label/value/status layout; distribution bars and priority states use semantic colors, with compact-navigation tooltips.
- [x] Derived operational pending notifications identify active cases with diagnosis pending upload or diagnosis-ready quote pending creation; the same API feeds the Dashboard, bell panel, and once-per-session reminder.
- [x] Dashboard priorities and the order inbox use a plate-based visual identifier instead of emoji vehicle icons; the inbox has aligned Plate, Vehicle/order, Client/modality, and State/action columns.
- [x] Operational-pending reminder, bell panel, and plate-based layouts were
  manually validated on desktop and mobile on 2026-10-17.

Status: **Verified**

## R-04: New Order - Seven-Step Reception

Reference: `documentos/prototipo/app.js` `wizard()`, `considerStep()`,
`damageStep()`, `evidenceStep()`, `diagnosisStep()`, `summaryStep()`;
`api.js` `create()`.

### Step 1 - Data

- [x] Client, vehicle, modality, claim, mileage, fuel, VIN, year, color, and body type persist.
- [x] DNI/RUC, phone, email, plate normalization, VIN, year, and mileage validations exactly match prototype.
- [x] Insurer claim is required unless "claim pending" is explicitly selected.
- [x] Custom color option and validation exist.
- [x] Fuel labels and plate-format confirmation match prototype.
- [x] Desktop and mobile tab traversal follows the visual capture order, including
  the full-width fuel control after mileage and claim number.

### Step 2 - Checklist

- [x] The 44 catalog items persist in MariaDB.
- [x] API rejects incomplete checklists.
- [x] Each item has optional observation input.
- [x] Visual categories, counters, and SI/NO segmented controls are implemented.
- [x] Mobile checklist supports one-open-category review, confirmed “sin
  novedades” bulk marking with undo, compact conforming rows, and on-demand
  observation templates while preserving persisted `SI`/`NO` answers.

### Step 3 - Considerations

- [x] Six high-priority, immediately observable intake checks exist.
- [x] Flags remain optional and persist with reception.
- [x] A4 reception preview applies the 440-character consideration budget and `(+N mas)` behavior.
- [x] Mobile consideration rows use larger touch targets, selected-state feedback,
  an inspection hint, and spacing from the wizard navigation; visual refinement
  accepted on 2026-10-17.

### Step 4 - Damage Diagram

- [x] The registered body type and its five reference views are available.
- [x] Pointer/touch drawing stores normalized points by body/view.
- [x] Undo, redo, clear confirmation, view navigation, fullscreen, and lateral orientation behavior are implemented.
- [x] Drawings render in the A4 reception preview using their registered body/view reference.

### Step 5 - Evidence

- [x] Local authenticated image storage supports JPEG, PNG, and WEBP up to 5 MB.
- [x] Wizard supports camera/gallery, preview, individual removal, and maximum 15 images.
- [x] Evidence is attached during the final order creation flow.
- [x] Mobile presents separate **Tomar foto** and **Elegir del dispositivo**
  actions. **Tomar foto** uses the browser camera stream within the application
  (requires HTTPS), avoiding the native-camera navigation that can reload a
  mobile page. Selected images and the handwritten evaluation are retained
  locally across a reload before final order creation.

### Step 6 - Diagnosis

- [x] Free-text diagnosis persists.
- [x] Optional handwritten evaluation upload persists independently from evidence.
- [x] Review and legibility states persist.
- [x] Diagnosis entry visually separates free-text guidance, handwritten-photo
  capture, pending reminder, and uploaded-file review state.

### Step 7 - Summary and Signature

- [x] Summary contains client, vehicle, km/fuel, checklist count, evidence count, and damaged views.
- [x] Signature canvas supports touch input, restoration, and clear.
- [x] Checklist review checkbox is mandatory.
- [x] Acceptance checkbox is mandatory.
- [x] Signature is mandatory.
- [x] Order is created only after all step requirements pass.
- [x] Mobile summary groups signature guidance, A4 preview, signature reset, and
  final confirmations into distinct operational sections.
- [x] Creation produces an order number, a crypto-random six-digit public code, reception snapshot, and audit event. The code is persisted as `service_orders.public_code`, shown to authenticated staff in Order Detail Summary, and issued to the client with their reception/constancia.

### Cross-device draft continuity (approved enhancement)

- [x] A reception draft is persisted in MariaDB per authenticated user with its
  current step and revision.
- [x] A stale device cannot overwrite a newer remote draft: the server returns
  a conflict and the UI offers the current persisted version for reload.
- [x] Structured data is retained locally in IndexedDB while offline and is
  retried when browser connectivity returns.
- [x] Product-owner validation confirmed mobile→desktop and desktop→mobile
  continuity, offline recovery, reconnection, and concurrent-edit conflict
  handling. Evidence and diagnosis image files remain device-local before final
  order creation, by design.

Status: **Verified**

## R-05: Order Detail

Reference: `documentos/prototipo/app.js` `detail()` and detail tabs.

- [x] Operational order inbox lists real cases with search, state, modality, and pending-claim filters plus a compact selected-order inspection.
- [x] Summary tab with internal/public status and reception snapshot.
- [x] Operational-data editor and audited changes.
- [x] Pending claim reminder completion.
- [x] Reception evidence and diagnosis viewer.
- [x] Diagnosis evaluation supports multiple uploaded pages and page navigation from reception and the quote workspace.
- [x] The quote workspace provides a movable, resizable, zoomable diagnosis reference viewer with image pan and page thumbnails.
- [x] Reception detail presents an on-screen A4 documentary preview and provides authenticated diagnosis-evaluation download.
- [x] Reception detail can reopen the approved A4 checklist renderer from persisted data; it uses the registered body type code rather than inferring the body from damage marks.
- [x] Tabs for quote, parts, final control, and history; final control is an operational persisted workflow.
- [x] The order inbox uses stable plate badges and explicit column headers instead of vehicle emojis, including a responsive compact layout.
- [x] The narrow mobile layout now uses full-width filters and reserves space for
  the fixed navigation bar so selectors do not overflow and final cases are not
  obscured.
- [x] Orders inbox re-checked and accepted on a narrow mobile viewport: filters
  remain visible and the navigation does not obscure cases or actions.
- [x] Manual end-to-end validation on 2026-10-17 confirmed detail tabs,
  operational correction with reason and audit history, reception A4 reprint,
  reload/logout/login persistence, and desktop/mobile presentation using
  `DEM-101`.

Status: **Verified**

## R-06: Quotes

Reference: `documentos/prototipo/app.js` quote routes and version actions.

- [x] PEN/USD and no-IGV calculation.
- [x] Labor categories: Planchado, Pintura, Mecánica.
- [x] Parts lines and no-parts option, including a confirmation that removes parts from a draft when selected.
- [x] Draft versions can be created, edited, and deleted; every action is audited and deletion restores the prior version as current when applicable.
- [x] Send snapshot and `ESPERA_APROBACION` transition.
- [x] New version with mandatory adjustment reason; the previous sent version is retained as replaced history.
- [x] Approval snapshot, immutable approved version, and resulting state transition.
- [x] Quote history supports selecting any version for export, including historical replaced versions.
- [x] Persistent per-order draft is separated from immutable quote versions:
  saving a draft does not create a version; creating V1/Vn snapshots the saved
  draft and leaves it available for the next adjustment.
- [x] Direct PDF download produces an A4 institutional quotation with logo, order metadata, grouped line tables, total without IGV, continuation identifier, 20 mm left margin, and 15 mm document margins. Continuation tables reserve a 26 mm top area below the identifier.
- [x] Direct Excel download produces an institutional, editable `.xlsx` quotation with logo, order metadata, grouped items, currency formatting, formula-based subtotals and total, no-IGV notice, and a frozen area ending below the order metadata.
- [x] Quote print view and desktop diagnosis reference viewer.
- [x] Navigation-level Cotizaciones inbox lists cases in `COTIZACION_PENDIENTE`
  and `ESPERA_APROBACION`, filters by stage, modality, aging, date and text,
  and opens the matching order quotation tab. Desktop visual reticle, plate
  identifiers and action alignment were accepted on 2026-10-17. The mobile
  inbox and complete quote workflow were manually accepted on 2026-10-17.
- [x] Manual end-to-end validation confirmed draft save/reload, separate version
  creation, version adjustment reason, send/approval, history, PDF/XLSX export,
  Cotizaciones access, and desktop/mobile presentation.

Status: **Verified**

## R-07: Parts and Suppliers

Reference: `documentos/prototipo/app.js` parts view and `provider-catalog.js`.

- [x] Parts derive from approved quote lines; approved historical quotes were backfilled by migration.
- [x] Operational statuses (`POR_GESTIONAR`, `PEDIDO`, `EN_TALLER`) follow an
  individual-part workflow. Receipt is binary and recorded directly from the
  exterior checkbox; the inherited partial-receipt field is retained only for
  database compatibility and is no longer exposed or updated by the flow.
- [x] Supplier recommendations are filtered by vehicle brand and requested quality.
- [x] Provider snapshot/contact, ETA, quality, received quantity, part code, notes, freight, freight payment, expansion, and case owner persist with audit events.
- [x] Filters, metrics, global workbench, and mobile cards match prototype.
- [x] Repair can start only after all required parts are received and an approved quote exists.
- [x] Per-order desktop management redesign accepted on 2026-10-17: fast order
  registration, binary arrival control, supplier suggestions and direct contact
  card, compact details panel, and dedicated save-action bar.
- [x] Global workbench, mobile filters, cards, provider flow, and repair
  transition were re-checked and accepted on mobile.

Status: **Verified**

## R-08: Final Control, Publication, and Delivery

Reference: `documentos/prototipo/app.js` control flow and `constancia.js`.

- [x] Control requires an approved quote, all required parts received, and every approved labor line verified; verification persists per labor line.
- [x] Reopen before delivery requires a reason and creates an audit event.
- [x] Publish ready-for-pickup records an optional channel/note and publishes the public state.
- [x] Completing control sets internal `LISTA_PARA_ENTREGA` while public remains `EN_REPARACION` until publication.
- [x] Delivery requires published readiness and a conformity acknowledgement, then audits and sets both states to `ENTREGADA`.
- [x] Order detail provides a responsive Control final tab with persisted checkmarks, visible blockers, disabled invalid actions, publication fields, reopening reason, and delivery acknowledgement.
- [x] Delivered orders provide a direct downloadable A4 conformity PDF. It preserves the institutional quotation header, uses 20 mm left and 15 mm remaining margins, contains the client/vehicle text blocks and client signature only, and excludes advisor/manager data and the repair-line list.
- [x] Delivered-control consultation summarizes verified labor, supports optional grouped inspection by category, and exposes the conformity PDF action in the final-control header.
- [x] Printable conformity record matches the approved prototype content and
  geometry; manually validated on 2026-10-17.
- [x] Product-owner validation confirmed the complete mobile/desktop sequence:
  final control, publication, reopening, and delivery.

Status: **Verified**

## R-09: Public Tracking

Reference: `documentos/prototipo/seguimiento.html`, `seguimiento.js`.

- [x] Plate plus plaintext six-digit public code lookup; the tracking screen explains that the advisor/reception constancia issues the code and accepts URL-prefilled plate/code values.
- [x] Only public progress is exposed.
- [x] Terminal and cancelled states match prototype.
- [x] Mobile-first tracking screen matches prototype intent.
- [x] Product-owner validation confirmed desktop and local-network mobile lookup,
  URL prefill, valid/invalid handling, and public-only information display.

Status: **Verified**

## R-10: Reports, Audit, and Documents

Reference: `documentos/prototipo/app.js`, `constancia.js`.

- [x] Administrator-only reports dashboard, implemented and internally verified
  on 2026-10-17: route returns 401 without session, 403 to Asesor, and persisted
  operational analytics to Administrator; dashboard visual review confirmed by
  user.
- [x] Quote and pending-parts reports with local filters, implemented on
  2026-10-17 and manually validated end-to-end: state, modality, date, search,
  aging/urgency, advisor, provider and filter cleanup.
- [x] CSV export and institutional A4 PDF downloads implemented on 2026-10-17.
  Descargas, filtros y comportamiento visual fueron validados manualmente el
  2026-10-17.
- [x] Mobile report filters now stack without clipped controls; date labels use
  their own row and result tables render as cards on narrow screens.
- [x] Dashboard and both operational report tabs were re-checked and accepted
  on mobile after the responsive filter, result-card, and navigation changes.
- [x] Immutable Administrator-only audit search with text, user, action, and
  date filters; manually approved on 2026-10-17. The filter presents Spanish
  action labels while retaining technical values for the query.
- [x] Reception checklist A4 document includes data, inventory, flags, drawings, fuel, km, and signature.
- [x] A4 checklist selections render as explicit high-contrast marks, including when browser PDF export omits background colors.
- [x] Reception A4 uses the prototype's fixed-position heading and footer: PARAUTOS logo, title rule, contact strip, and brands strip.
- [x] Reception A4 side panel uses the prototype dimensions for fuel, mileage, and authorization signature.
- [x] Reception A4 print geometry is centralized in `client/src/print-layout.ts` for reuse after visual approval.
- [x] Reception A4 inventory uses a native print table with collapsed borders; checklist notes flow into the aligned observations block.
- [x] Reception A4 observations use a borderless two-column print table so wrapped checklist notes remain aligned.
- [x] The same approved reception A4 renderer is reusable from the order detail, allowing recovery/printing after registration without changing its visual geometry.
- [x] Quote PDF is generated directly for local file administration instead of opening the browser print dialog.
- [x] Quote Excel is generated directly as an editable institutional spreadsheet.
- [x] Work order PDF is generated from the selected approved quote, includes only grouped labor items without prices or parts, and uses the required A4 margins and continuation header.
- [x] Work order printable document matches the approved prototype output;
  manually validated on 2026-10-17.

Status: **Verified**

## Strategic Implementation Sequence

This sequence prioritizes completion of the daily workshop workflow before
building aggregate reporting. Each numbered stage must pass the Mandatory
Parity Gate before the next stage starts.

1. **Parity closure for implemented modules**: verify Administrator API
   authorization (R-01), real route contents and shell parity (R-02), and the
   desktop/mobile workflows for R-07, R-08, and R-09.
2. **R-07 Parts global workbench**: implemented with prototype-parity filters,
   metrics, global workbench, and mobile cards. Automated verification passed;
   desktop/mobile manual verification remains required before it is Verified.
3. **R-05 operational-data editor**: define the editable reception/order
   fields, authorization rules, and audited correction flow before dependent
   reports are built.
4. **R-08 printable conformity record**: complete the delivery evidence that
   closes the service workflow.
5. **R-10 immutable audit search**: provide administrator search by text,
   user, action, and date over the existing audit events.
6. **R-10 reports and exports**: implement the administrator dashboard,
   quote/pending-parts reports, filters, CSV export, and print views using the
   completed operational data.
7. **R-10 document parity closure**: visually validate the Work Order against
   the prototype and validate the printable conformity record after its
   implementation.

Reports must not precede R-07 and the operational-data editor: they depend on
complete, correct operational records to produce meaningful results.

## Verification Log

| Date | Item | Environment | Result | Evidence / Notes |
| --- | --- | --- | --- | --- |
| 2026-10-15 | Local MariaDB identity migration | Local MariaDB 11.8.9 | Passed | Bootstrap, login, session, logout verified. |
| 2026-10-15 | Core order/checklist persistence | Local MariaDB 11.8.9 | Passed | `OS-2026-00001` created with 44 checklist answers. |
| 2026-10-15 | Local evidence upload | Local API | Passed | Authenticated WEBP upload and attachment listing verified. |
| 2026-10-15 | Reception checklist A4 | Browser PDF print | Passed | Visual format approved: header, footer, native inventory table, high-contrast answers, body diagrams, side panel, and aligned observations render on one A4 page. |
| 2026-10-15 | R-04 seven-step reception | Local build and server tests | Passed | Exact Step 1 input validation, full 44-item gate, review, acceptance, PNG signature, order creation, reception snapshot, and audit event verified by build and tests. |
| 2026-10-15 | R-03 dashboard data | Local build and server tests | Passed | Authenticated orders and navigation summary drive metrics, priorities, distribution, and the pending-claim action. |
| 2026-10-15 | R-03 dashboard visual parity | Desktop and mobile browser | Passed | Six pending-quote cases, two pending claims, priorities, distribution, alert, and responsive hierarchy visually validated against the prototype. |
| 2026-10-15 | R-03 dashboard visual refinement | Local build and server tests | Passed | Metric cards now align label, value, and status text; semantic state colors, priority chips, order age, and compact-navigation tooltips added. |
| 2026-10-15 | Operational order inbox | Local build and server tests | Passed | Real-case list supports search, state/modality/pending-claim filters, semantic statuses, and selected-order inspection; evidence upload moved out of list rows. |
| 2026-10-15 | R-05 order detail read model | Local build and server tests | Passed | Authenticated order-detail API and Summary/Reception tabs show status, client/vehicle, checklist, considerations, diagnosis, damages, and attachment metadata. |
| 2026-10-15 | R-05 claim and attachment actions | Local build and server tests | Passed | Pending claim completion is audited; reception attachments are served only to authenticated sessions and previewed in the detail view. |
| 2026-10-15 | R-06 quote versions and transitions | Local migration and build | Passed | Versioned PEN/USD no-IGV quotes, labor/parts lines, no-parts rule, immutable send/approval snapshots, audited transitions, and detail tab implemented. |
| 2026-10-15 | R-05 detail structure and tabs | Local build and server tests | Passed | Responsive detail header, read-only internal/public status metadata, status-based progress, summary fields, quote/reception/history access, and honest pending states for parts and final control. |
| 2026-10-16 | R-06 quote editing and version history | Local build and server tests | Passed | Draft editing/deletion, audited actions, mandatory adjustment reason, recovery of prior version, sent and approved transitions, and no-parts confirmation are covered by 8 server tests. |
| 2026-10-16 | R-06 multi-page export data | Local MariaDB demo seed | Passed | `npm run seed:demo` created `OS-2026-00010` / `DEM-404` with V1 replaced and V2 sent; each version has 34 distributed line items. A second seed execution confirmed idempotency. |
| 2026-10-16 | R-06 PDF and Excel export build | Local production build | Passed | `npm run build` compiles direct PDF and dynamic Excel export. Manual visual verification of downloaded PDF/XLSX remains required. |
| 2026-10-16 | R-07 parts persistence and workflow | Local MariaDB migration, build, and server tests | Passed | Migrations `009_parts_management.sql` and `010_backfill_approved_parts.sql` applied. Approved quote lines derive persisted parts, with provider catalog, partial receipt, logistics, audit events, and a server-enforced repair transition. `npm run build` and `npm test` passed. |
| 2026-10-16 | R-08 final control workflow | Local MariaDB, production build, server tests | Passed | Migration `012_final_control_delivery.sql` applied. `npm run build` and `npm test` passed with server-side gates for approved quotes, received parts, persisted labor verification, audited reopening, publication, and delivery. Desktop/mobile visual flow remains manually unverified. |
| 2026-10-16 | R-08 bulk labor verification | Local production build and server tests | Passed | Transactional `Marcar todo` persists all labor checks, exposes indeterminate progress, and keeps final-control registration disabled until every labor item is verified. `npm run build` and `npm test` passed with 19 tests. |
| 2026-10-16 | Work order PDF export | Local production build and server tests | Passed | Approved quotes export a direct A4 work order with only Planchado, Pintura, and Mecánica lines, no prices or parts, vehicle summary, and continuation spacing. `npm run build` and `npm test` passed with 19 tests. |
| 2026-10-16 | Reception A4 reprint | Local production build and server tests | Passed | The approved A4 reception renderer was extracted for reuse from the order detail. Reprint uses persisted `bodyCode`, preserving the registered vehicle body even when no damage marks exist. `npm run build` and `npm test` passed. |
| 2026-10-16 | R-09 public tracking API | Local migration, server tests, production build | Passed | Migration `013_public_tracking_lookup.sql` applied. Hashed public-code and normalized plate lookup returns only order number, vehicle identity, and `publicStatus`; client/staff/contact/claim/quote data are absent. Invalid lookup has a uniform no-match response; API is IP rate limited. `npm test` passed with 21 tests and `npm run build` passed. Browser visual and live public-lookup checks remain required. |
| 2026-10-16 | R-09 six-digit public-code issuance | Local MariaDB migration, server tests, production build | Passed | Migrations `014_plaintext_public_tracking_code.sql` and `015_remove_legacy_public_code_hash_requirement.sql` add nullable `public_code`, backfill existing orders with six-digit numbers, and remove the legacy hash requirement/index. New orders use `crypto.randomInt`; the plaintext code is visible in authenticated Order Detail Summary and public lookup uses plate plus code. `npm test` passed with 22 tests and `npm run build` passed. Browser verification of the public form and advisor issuance remains required. |
| 2026-10-16 | R-07 global parts workbench | Automated build and subsequent product-owner validation | Passed | `npm test` and `npm run build` validate the authenticated persisted parts read model and client compilation; desktop/mobile filters, cards and repair transition were subsequently accepted. |
| 2026-10-16 | R-05 operational-data editor | Local MariaDB migration, server tests, production build | Passed | Migration `016_order_operational_data.sql` adds order-local operational contact overrides. Authenticated advisors and administrators can correct operational contacts and insurer claim state on non-terminal orders; corrections lock the order, preserve reception/client/vehicle records, and emit `OPERATIONAL_DATA_CORRECTED` old/new audit data with reason and request metadata. `npm test` passed with 28 tests and `npm run build` passed. Manual desktop/mobile flow verification remains required. |
| 2026-10-17 | R-01 login/session and roles | Desktop and mobile manual validation | Passed | Product owner confirmed login, reload/session persistence, logout, Administrator/Advisor visibility and operational access. |
| 2026-10-17 | R-08 downloadable conformity PDF | Local production build and server tests | Implemented; manual visual validation pending | Delivered order exposes `Descargar acta PDF`. The A4 PDF uses the quotation header, requested margins, client/vehicle text blocks, modality, order reference, and client signature; advisor/manager and repair-line content were intentionally omitted. `npm run build` and `npm test` passed. |
| 2026-10-17 | R-08 downloadable conformity PDF | Manual PDF validation | Passed | Product owner validated the A4 document: institutional header, 20 mm left and 15 mm remaining margins, approved textual content, date/signature layout, and exclusion of advisor/manager and repair-line content. |
| 2026-10-17 | R-10 work order PDF | Manual PDF validation | Passed | Product owner validated download, A4 format, institutional header, order/vehicle data, grouped labor-only content without prices or parts, legibility, and continuation behavior against the approved reference. |
| 2026-10-17 | R-10 immutable audit search | Manual Administrator/Advisor validation, production build, server tests | Passed | Product owner confirmed the read-only audit screen and text/user/action/date filters, persistence/coherence of results, and that Advisor neither sees nor accesses Auditoría. Action options use Spanish labels without changing technical filter values. `npm run build` and `npm test` passed with 34 tests. |
| 2026-10-17 | R-10 Dashboard and Reports | Manual desktop/mobile validation, API authorization checks, production build and server tests | Passed | Product owner validated dashboard and both operational reports. Filters, search, aging/urgency, advisor/provider, CSV and institutional A4 PDF downloads use the visible filtered set. API returned 401 without session, 403 for Asesor and 200 for Administrador; analytical series and funnel invariants were consistent. |
| 2026-10-17 | R-02/R-06 Cotizaciones inbox | Production build, server tests and product-owner validation | Passed | The navigation placeholder was replaced with a real pending-quote inbox. Product owner accepted its desktop/mobile metrics, filters, hierarchy, plate badges and quotation actions; quote workflow was subsequently validated end to end. |
| 2026-10-17 | R-02 shell, notifications and plate identifiers | Manual desktop/mobile validation | Passed | Product owner validated every navigation route, mobile menu, compact/expanded sidebar, bell and pending panel, once-per-session reminder, plate identifiers in Dashboard/Orders/Cotizaciones, and Administrator/Advisor route visibility. |
| 2026-10-17 | R-07 individual parts management redesign | Product-owner validation, production build and server tests | Passed | Product owner accepted the individual-parts workflow and its field/action distribution. Partial receipt was removed from active UI/API behavior; supplier contact, global workbench, filters, mobile layout and repair transition were subsequently validated. |
| 2026-10-17 | R-04 reception wizard mobile refinements | Mobile visual review, production build and server tests | Considerations accepted / implementation verified | Tab capture order was aligned with the rendered fields. Checklist gained category-level rapid review, undo and exception capture; diagnosis and summary/signature received clearer mobile task hierarchy. Product owner accepted the final consideration spacing and touch presentation. `npm run build` and `npm test` passed with 34 tests and 1 skipped. |
| 2026-10-17 | R-05 order detail | Manual desktop/mobile validation with `DEM-101` | Passed | Product owner verified all detail tabs, operational correction with reason, audit event in history, reception A4 reprint, reload/logout/login, and persistence in desktop and mobile. |
| 2026-10-17 | R-06 quote validation | Manual desktop/mobile validation, production build and server tests | Passed | Product owner confirmed draft save/reload, separate creation of versions, V2 adjustment reason, send/approval, historical versions, PDF/XLSX export and Cotizaciones access. The persisted draft recovery correction was included in the accepted flow. |
| 2026-10-17 | Dashboard operational pending center | Local MariaDB, production build, server tests and subsequent manual validation | Passed | `GET /orders/pending-notifications` derives outstanding diagnosis and quotation cases. Bell, Dashboard section, once-per-session reminder and direct order links were later accepted in the R-02/R-10 and Mandatory Parity Gate validation. |
| 2026-10-17 | Order inbox plate layout | Local production build, server tests and subsequent manual validation | Passed | Plate badges, explicit desktop columns and the mobile layout were accepted during R-05 and the Mandatory Parity Gate validation. |
| 2026-10-17 | R-04 cross-device reception draft and local media | Local MariaDB 11.8.9, production build, server tests and product-owner validation | Passed | Migration `018_reception_drafts.sql` persists the structured draft with revision control; mobile↔PC continuity, recovery and conflict handling were later confirmed. Media remains device-local until order creation by design. |
| 2026-10-17 | R-06 Cotizaciones inbox mobile hierarchy | Local production build and subsequent product-owner validation | Passed | The mobile case-card hierarchy, stacked filters and non-obstructive navigation were accepted before the parity gate closure. |
| 2026-10-17 | R-05 Orders inbox mobile alignment | Local production build and subsequent product-owner validation | Passed | Narrow filters, non-overflowing controls and mobile-navigation spacing were accepted before the parity gate closure. |
| 2026-10-17 | R-07 Repuestos mobile filter alignment | Local production build and subsequent product-owner validation | Passed | Global-parts filters, cards and mobile navigation behavior were accepted before the parity gate closure. |
| 2026-10-17 | R-04 reception continuity | Product-owner manual validation | Passed | Mobile↔PC continuation, offline recovery/reconnection, and concurrent-edit conflict handling were confirmed. |
| 2026-10-17 | R-08 final control and delivery | Product-owner manual validation | Passed | Final control, publication, reopening, and delivery were confirmed on the operational flow. |
| 2026-10-17 | R-09 public tracking regression | Server test suite and subsequent product-owner validation | Passed | `npm test` passed with 35 tests and 1 skipped; tracking service tests confirm plate/code lookup, normalized plate handling and public-only projection. Desktop and mobile validation subsequently passed. |
| 2026-10-17 | R-09 local mobile connectivity | Production build, server tests and subsequent product-owner validation | Passed | Tracking requests time out visibly; in local-network development a failed Vite proxy request retries against the same PC IP on port 3000 with development-only CORS. Mobile retest passed; production remains same-origin HTTPS. |
| 2026-10-17 | R-09 public tracking | Product-owner desktop/mobile validation | Passed | Public lookup functions correctly on PC and mobile after the local-network fallback correction. |

## Mandatory Parity Gate — 2026-10-17

| Check | Result | Evidence |
| --- | --- | --- |
| Functional and validation paths | Passed | Product owner completed R-04 continuity, R-05 detail, R-06 quotes, R-07 parts, R-08 final control/delivery, R-09 public tracking, and R-10 reports/audit paths. |
| MariaDB persistence and session recovery | Passed | Reception, quotes, parts, control, delivery, corrections and public codes were checked through reload/login recovery where applicable. |
| Desktop and mobile operation | Passed | Product owner accepted the responsive corrections for shell, Orders, Quotes, Parts, Dashboard/Reports, reception and public tracking. |
| Roles and public boundary | Passed | Administrator/Advisor restrictions are covered by tests and manual review; public tracking exposes only its public projection. |
| Commands | Passed | `npm run build` completed; `npm test` completed with 35 passed and 1 skipped. |
| Reusable validation data | Passed | `DEM-101`, `DEM-202`, `DEM-303`, `DEM-404`, report seeds, and public-code cases are documented in `DATOS_PRUEBA_MANUAL.md`. |
| Approved differences | Recorded | Direct PDF/XLSX exports, operational pending reminders, reception simplifications, persistent drafts and the Hostinger-compatible local-network tracking fallback are recorded in this document. |

**Gate result: Passed.** Functional prototype parity is closed. Pending work in
the technical prioritization concerns production hardening and infrastructure,
not unresolved parity flows.

- **2026-10-17 — S3/R2 attachment storage:** `STORAGE_PROVIDER=s3` now stores,
  retrieves and deletes attachments through an S3-compatible bucket while local
  records remain readable by their stored provider. Configuration is documented
  for AWS S3/Cloudflare R2; a real Hostinger smoke test awaits deployment
  credentials.
- **2026-10-17 — Binary image validation:** attachment uploads now verify JPEG,
  PNG or WebP file signatures and require that they match the declared MIME
  type, in addition to the existing one-file and 5 MB Multer limits. The server
  test suite covers valid signatures, arbitrary bytes and MIME mismatches.
- **2026-10-17 — Persistent public tracking limit:** migration
  `019_public_rate_limits.sql` was applied locally. Tracking uses MariaDB for a
  shared 60-second / 10-attempt limit keyed by a SHA-256 IP hash, returning 429
  after the limit without Redis or background workers; expired rows are pruned
  opportunistically.
- **2026-10-17 — Login and bootstrap hardening:** persistent MariaDB limits now
  protect both IP and normalized account keys, with bounded progressive delay.
  Rate-limited events are audited without credentials, and successful account
  authentication clears its corresponding account-key window.
- **2026-10-17 — HTTP security integration tests:** Express route tests confirm
  that exhausted login and tracking windows return 429 before credential or
  public-case lookups, and that valid login clears its account-key window.
- **2026-10-17 — ExcelJS audit review:** the forced downgrade proposed by npm
  audit was tested and reverted because it introduced a high-severity dependency
  and broke current XLSX formula typing. The maintained 4.4.0 version builds and
  exports correctly but retains two moderate transitive UUID advisories pending a
  compatible replacement or upstream release.
- **2026-10-17 — Public code review:** the visible six-digit code remains
  `crypto.randomInt`-generated and recoverable by staff, as required by the
  reception constancia and public-tracking parity. Its mandatory normalized
  plate, uniform no-match response and persistent tracking rate limit provide
  the compensating controls; a higher-entropy token requires an explicit future
  product-flow change.

## Approved Differences Log

- Quote documents are downloaded directly as PDF and editable XLSX files rather than using the browser print dialog. This supports local file administration and avoids browser-added headers, footers, and signature prompts.
- Reports and Audit were intentionally held as placeholders only until their real
  R-10 modules were implemented; both routes are now real Administrator-only
  modules. Cotizaciones is now also a real operational listing; R-02 remains
  pending only for final shell/mobile parity validation.
- The operational-pending center is an additive workflow reminder: it derives outstanding diagnosis uploads and quote transcription from persisted order state, rather than relying on manually dismissed notification records. It is global for Administrator and Advisor until a future per-advisor assignment rule is defined.
- The product decision recorded on 2026-10-17 keeps operational case and
  attachment access global for Administrator and Advisor. Authentication plus
  role authorization protect those resources; ownership restrictions will only
  be introduced together with an explicit advisor-assignment model.
