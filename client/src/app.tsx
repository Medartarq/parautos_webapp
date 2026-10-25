import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { CurrentUser } from "@parautos/shared";
import loginBackground from "./assets/login-background.webp";
import logo from "./assets/logo_parautos.svg";
import "./reception.css";
import "./orders.css";
import "./final-control.css";
import "./parts-workbench.css";
import { NewOrder } from "./full-new-order";
import { api } from "./api";

const ReportsView = lazy(() => import("./reports-view").then(({ ReportsView }) => ({ default: ReportsView })));
const QuoteExportToolbar = lazy(() => import("./quote-export-toolbar").then(({ QuoteExportToolbar }) => ({ default: QuoteExportToolbar })));
const ReceptionDetail = lazy(() => import("./reception-detail").then(({ ReceptionDetail }) => ({ default: ReceptionDetail })));
const QuoteEditor = lazy(() => import("./quote-editor").then(({ QuoteEditor }) => ({ default: QuoteEditor })));
const FinalControl = lazy(() => import("./final-control").then(({ FinalControl }) => ({ default: FinalControl })));
const PartsOrderWorkbench = lazy(() => import("./parts-order-workbench").then(({ PartsOrderWorkbench }) => ({ default: PartsOrderWorkbench })));
const OrderDetail = lazy(() => import("./order-detail").then(({ OrderDetail }) => ({ default: OrderDetail })));
const AuditView = lazy(() => import("./audit-view").then(({ AuditView }) => ({ default: AuditView })));
const UsersView = lazy(() => import("./users-view").then(({ UsersView }) => ({ default: UsersView })));

type AppState = "loading" | "setup" | "login" | "dashboard";
type Route =
  "dashboard" | "new" | "orders" | "orderDetail" | "quotes" | "parts" | "reports" | "audit" | "users";
type DetailTab = "summary" | "reception" | "quotes" | "parts" | "control" | "history";
type DashboardOrder = {
  id: number;
  orderNumber: string;
  status: string;
  modality: string;
  createdAt: string;
  client: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
};
type OperationalPendingItem = {
  id: number;
  orderNumber: string;
  createdAt: string;
  client: string;
  plate: string;
  brand: string;
  model: string;
  kind: "DIAGNOSIS_PENDING" | "QUOTE_PENDING";
};
type OperationalPendingNotifications = {
  total: number;
  diagnosisPending: Omit<OperationalPendingItem, "kind">[];
  quotePending: Omit<OperationalPendingItem, "kind">[];
};
const pendingItems = (notifications: OperationalPendingNotifications): OperationalPendingItem[] => [
  ...notifications.diagnosisPending.map((item) => ({ ...item, kind: "DIAGNOSIS_PENDING" as const })),
  ...notifications.quotePending.map((item) => ({ ...item, kind: "QUOTE_PENDING" as const })),
];
const emptyPendingNotifications: OperationalPendingNotifications = { total: 0, diagnosisPending: [], quotePending: [] };

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

function PlateBadge({ plate, compact = false }: { plate: string; compact?: boolean }) {
  const normalized = plate.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{1,3})[- ]?([A-Z0-9]{2,4})$/);
  const prefix = match?.[1] || normalized.slice(0, 3);
  const suffix = match?.[2] || normalized.slice(3) || "—";
  return <span className={`plate-badge${compact ? " compact" : ""}`} aria-label={`Placa ${normalized}`} title={`Placa ${normalized}`}><b>{prefix}</b><small>{suffix}</small></span>;
}

function AccessLayout({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main className="login-page">
      <section
        className="login-image"
        style={{ backgroundImage: `url(${loginBackground})` }}
      >
        <div className="login-shade" />
        <img className="mobile-logo" src={logo} alt="PARAUTOS" />
      </section>
      <section className="login-panel">
        <div className="login-box">
          <div className="desktop-logo">
            <img src={logo} alt="PARAUTOS" />
          </div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {children}
          <footer>
            <p>Uso interno de Parautos Soluciones Automotrices.</p>
            <p>&copy; 2026 PARAUTOS</p>
          </footer>
        </div>
      </section>
    </main>
  );
}

function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(undefined);
    try {
      await api("/setup/initial", {
        method: "POST",
        body: JSON.stringify({
          token: form.get("token"),
          email: form.get("email"),
          username: form.get("username"),
          names: form.get("names"),
          password: form.get("password"),
        }),
      });
      onComplete();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible crear el administrador.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AccessLayout
      title="Configuracion inicial"
      lead="Crea la cuenta administradora inicial de PARAUTOS."
    >
      <form onSubmit={submit} className="login-form">
        <Field label="Token temporal">
          <input
            name="token"
            type="password"
            minLength={32}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Correo configurado">
          <input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Nombres y apellidos">
          <input name="names" minLength={3} required autoComplete="name" />
        </Field>
        <Field label="Usuario">
          <input
            name="username"
            minLength={3}
            pattern="[a-zA-Z0-9._-]+"
            required
            autoComplete="username"
          />
        </Field>
        <Field label="Contrasena definitiva">
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </Field>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button className="btn-submit" disabled={saving}>
          {saving ? "Creando cuenta..." : "Crear administrador"}
        </button>
      </form>
    </AccessLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-group">
      <span>{label}</span>
      <div className="field-control">{children}</div>
    </label>
  );
}

function LoginForm({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(undefined);
    try {
      const result = await api<{ user: CurrentUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
      });
      onLogin(result.user);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesion.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AccessLayout title="Inicia sesion" lead="Accede al panel principal.">
      <form onSubmit={submit} className="login-form">
        <Field label="Usuario o correo">
          <input
            name="identifier"
            minLength={3}
            required
            autoComplete="username"
            autoFocus
            placeholder="Usuario"
          />
        </Field>
        <Field label="Contrasena">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contrasena"
          />
        </Field>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button className="btn-submit" disabled={saving}>
          {saving ? "Ingresando..." : "Entrar"}
        </button>
        <a className="tracking-access" href="/seguimiento">Consulta publica de vehiculo</a>
      </form>
    </AccessLayout>
  );
}

const navigation: Array<{
  route: Route;
  icon: string;
  label: string;
  admin?: boolean;
  superadmin?: boolean;
}> = [
  { route: "dashboard", icon: "▦", label: "Panel principal" },
  { route: "new", icon: "+", label: "Nueva orden" },
  { route: "orders", icon: "▤", label: "Órdenes" },
  { route: "quotes", icon: "S/", label: "Cotizaciones" },
  { route: "parts", icon: "▧", label: "Repuestos" },
  { route: "reports", icon: "◫", label: "Reportes", admin: true },
  { route: "audit", icon: "⌁", label: "Auditoría", admin: true },
  { route: "users", icon: "♙", label: "Usuarios", superadmin: true },
];
const titles: Record<Route, string> = {
  dashboard: "Panel principal",
  new: "Nueva orden",
  orders: "Órdenes",
  orderDetail: "Detalle de orden",
  quotes: "Cotizaciones",
  parts: "Repuestos",
  reports: "Dashboard y reportes",
  audit: "Auditoría",
  users: "Usuarios",
};

function Dashboard({
  user,
  onLogout,
}: {
  user: CurrentUser;
  onLogout: () => void;
}) {
  const [route, setRoute] = useState<Route>("dashboard");
  const [dashboardFilter, setDashboardFilter] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<
    "auto" | "expanded" | "compact"
  >(
    () =>
      (localStorage.getItem("parautos-sidebar-mode") as
        "auto" | "expanded" | "compact") || "auto",
  );
  const [pendingClaims, setPendingClaims] = useState(0);
  const [operationalPending, setOperationalPending] = useState<OperationalPendingNotifications>(emptyPendingNotifications);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number>();
  const [selectedOrderTab, setSelectedOrderTab] = useState<DetailTab>();
  const [syncState, setSyncState] = useState<"loading" | "synced" | "error">(
    "loading",
  );
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const compact = sidebarMode === "compact";
  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      if (window.innerWidth > 700) return;
      const current = window.scrollY;
      if (Math.abs(current - previous) < 12) return;
      setMobileNavHidden(current > previous && current > 90);
      previous = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (window.innerWidth <= 700 && ["orders", "quotes", "parts", "reports"].includes(route)) {
      setMobileNavHidden(true);
    }
  }, [route]);
  const isAdministrator = user.role === "ADMINISTRADOR" || user.role === "SUPERADMINISTRADOR";
  useEffect(() => { if (user.role !== "SUPERADMINISTRADOR") return; void api<{ enabled: boolean; active: boolean }>("/demo/status").then((status) => { setDemoAvailable(status.enabled); setDemoMode(status.enabled && status.active); }).catch(() => { setDemoAvailable(false); setDemoMode(false); }); }, [user.role]);
  const toggleDemoMode = async () => { await api(`/demo/${demoMode ? "exit" : "enter"}`, { method: "POST" }); window.location.reload(); };
  const allowed = navigation.filter(
    (item) => (!item.admin || isAdministrator) && (!item.superadmin || user.role === "SUPERADMINISTRADOR"),
  );
  const changeRoute = (next: Route) => {
    setMobileNavHidden(false);
    setRoute(next);
    setMenuOpen(false);
  };
  const openPending = (item: OperationalPendingItem) => {
    setSelectedOrderId(item.id);
    setSelectedOrderTab(item.kind === "DIAGNOSIS_PENDING" ? "reception" : "quotes");
    setNotificationsOpen(false);
    setReminderOpen(false);
    changeRoute("orderDetail");
  };
  useEffect(() => {
    localStorage.setItem("parautos-sidebar-mode", sidebarMode);
  }, [sidebarMode]);
  useEffect(() => {
    const load = () => {
      setSyncState("loading");
      Promise.all([
        api<{ pendingClaims: number }>("/orders/navigation-summary"),
        api<OperationalPendingNotifications>("/orders/pending-notifications"),
      ])
        .then(([summary, notifications]) => {
          setPendingClaims(summary.pendingClaims);
          setOperationalPending(notifications);
          const reminderKey = `parautos-operational-reminder-${user.id}`;
          if (notifications.total > 0 && !sessionStorage.getItem(reminderKey)) {
            sessionStorage.setItem(reminderKey, "shown");
            setReminderOpen(true);
          }
          setSyncState("synced");
        })
        .catch(() => setSyncState("error"));
    };
    load();
  }, [route]);
  useEffect(() => {
    if (!menuOpen) return;
    sidebar.current
      ?.querySelector<HTMLButtonElement>("nav button")
      ?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  return (
    <div
      className={`app-shell ${compact ? "sidebar-collapsed" : ""} sidebar-${sidebarMode}`}
    >
      <aside
        id="app-navigation"
        ref={sidebar}
        className={`sidebar ${menuOpen ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <img src={logo} alt="PARAUTOS" />
        </div>
        <nav>
          {allowed.map((item) => (
            <button
              key={item.route}
              className={route === item.route ? "active" : ""}
              title={item.label}
              onClick={() => changeRoute(item.route)}
            >
              <b>{item.icon}</b>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div
            className="sidebar-modes"
            role="group"
            aria-label="Modo del menú"
          >
            {(["auto", "expanded", "compact"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={sidebarMode === mode ? "active" : ""}
                aria-pressed={sidebarMode === mode}
                onClick={() => setSidebarMode(mode)}
              >
                <b>{mode === "auto" ? "A" : mode === "expanded" ? "›" : "‹"}</b>
                <span>
                  {mode === "auto"
                    ? "Auto"
                    : mode === "expanded"
                      ? "Expandido"
                      : "Compacto"}
                </span>
              </button>
            ))}
          </div>
          <div className="session-card">
            <strong>{user.names}</strong>
            <small>
              {user.role === "SUPERADMINISTRADOR" ? "Superadministrador" : user.role === "ADMINISTRADOR" ? "Administrador" : "Asesor"}
            </small>
            <button onClick={onLogout}>Cerrar sesion</button>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="nav-scrim"
          aria-label="Cerrar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="workspace">
        <header className="topbar">
          <button
            ref={menuButton}
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
          >
            ☰
          </button>
          <div>
            <strong>{titles[route]}</strong>
            <small className={`sync-state ${syncState}`}>
              ●{" "}
              {syncState === "loading"
                ? "Sincronizando"
                : syncState === "synced"
                  ? "Sincronizado"
                  : "Sin conexión"}
            </small>
          </div>
            <div className="top-actions">
              {user.role === "SUPERADMINISTRADOR" && demoAvailable && <button className={`demo-mode-toggle${demoMode ? " active" : ""}`} onClick={() => void toggleDemoMode()}>{demoMode ? "Salir de demo" : "Modo demo"}</button>}
            <div className="notification-center">
              <button className="bell" title="Pendientes operativos" aria-label={`${operationalPending.total} pendientes operativos`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><BellIcon />{operationalPending.total > 0 && <b>{operationalPending.total > 99 ? "99+" : operationalPending.total}</b>}</button>
              {notificationsOpen && <OperationalNotificationsPanel notifications={operationalPending} onClose={() => setNotificationsOpen(false)} onOpen={openPending} />}
            </div>
            <span className="avatar">
              {user.names
                .split(" ")
                .slice(0, 2)
                .map((name) => name[0])
                .join("")}
            </span>
          </div>
        </header>
        <section className="app-content">
          {route === "dashboard" ? (
            <DashboardHome
              user={user}
              onNew={() => changeRoute("new")}
              onOrders={() => changeRoute("orders")}
              operationalPending={operationalPending}
              onOpenPending={openPending}
              onMetricFilter={(status) => { setDashboardFilter(status); changeRoute("orders"); }}
            />
          ) : route === "new" ? (
            <NewOrder onCreated={() => changeRoute("orders")} advisorName={user.names} />
          ) : route === "orders" ? (
            <OrdersView
              onNew={() => changeRoute("new")}
              onOpen={(orderId) => {
                setSelectedOrderId(orderId);
                setSelectedOrderTab(undefined);
                changeRoute("orderDetail");
              }}
              initialStatus={dashboardFilter}
            />
          ) : route === "orderDetail" && selectedOrderId ? (
            <Suspense fallback={<div className="empty">Cargando detalle de orden...</div>}><OrderDetail orderId={selectedOrderId} initialTab={selectedOrderTab} onBack={() => changeRoute("orders")} /></Suspense>
          ) : route === "parts" ? (
            <PartsGlobalWorkbench
              onOpenOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setSelectedOrderTab("parts");
                changeRoute("orderDetail");
              }}
            />
          ) : route === "quotes" ? (
            <QuotesView onOpen={(orderId) => { setSelectedOrderId(orderId); setSelectedOrderTab("quotes"); changeRoute("orderDetail"); }} />
          ) : route === "audit" ? (
            <Suspense fallback={<div className="empty">Cargando auditoría...</div>}><AuditView /></Suspense>
          ) : route === "users" ? (
            <Suspense fallback={<div className="empty">Cargando usuarios...</div>}><UsersView currentUserId={user.id} /></Suspense>
          ) : route === "reports" ? (
            <Suspense fallback={<div className="empty">Cargando reportes...</div>}><ReportsView /></Suspense>
          ) : (
            <ModulePlaceholder route={route} />
          )}
        </section>
      </main>
      {demoMode && <div className="demo-mode-banner" role="status">Modo demostración · datos ficticios aislados</div>}
      <nav className={`mobile-nav${mobileNavHidden ? " hidden" : ""}`}>
        {allowed.slice(0, 4).map((item) => (
          <button
            key={item.route}
            className={route === item.route ? "active" : ""}
            onClick={() => changeRoute(item.route)}
          >
            <b>{item.icon}</b>
            <span>
              {item.label === "Panel principal"
                ? "Panel"
                : item.label === "Cotizaciones"
                  ? "Cotiza."
                  : item.label}
            </span>
          </button>
        ))}
      </nav>
      {reminderOpen && <OperationalReminder notifications={operationalPending} onClose={() => setReminderOpen(false)} onView={() => { setReminderOpen(false); changeRoute("dashboard"); }} />}
    </div>
  );
}

function OperationalNotificationsPanel({ notifications, onClose, onOpen }: { notifications: OperationalPendingNotifications; onClose: () => void; onOpen: (item: OperationalPendingItem) => void }) {
  const items = pendingItems(notifications);
  const age = (createdAt: string) => { const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000); return days <= 0 ? "Creada hoy" : `Hace ${days} día${days === 1 ? "" : "s"}`; };
  return <section className="notifications-panel" role="dialog" aria-label="Pendientes operativos"><header><div><strong>Pendientes operativos</strong><small>{notifications.total} por atender</small></div><button className="btn small" type="button" onClick={onClose} aria-label="Cerrar pendientes">×</button></header>{items.length ? <div className="notifications-list">{items.slice(0, 8).map((item) => <button key={`${item.kind}-${item.id}`} className={`notification-item ${item.kind === "DIAGNOSIS_PENDING" ? "operational-diagnosis" : "operational-quote"}`} onClick={() => onOpen(item)}><strong>{item.kind === "DIAGNOSIS_PENDING" ? "Diagnóstico pendiente de subir" : "Cotización pendiente de crear"}</strong><span>{item.orderNumber} · {item.plate} · {item.client}</span><small>{age(item.createdAt)}</small></button>)}</div> : <p className="notification-empty">No hay pendientes operativos.</p>}</section>;
}

function OperationalReminder({ notifications, onClose, onView }: { notifications: OperationalPendingNotifications; onClose: () => void; onView: () => void }) {
  return <div className="operational-reminder-backdrop" role="presentation"><section className="operational-reminder" role="dialog" aria-modal="true" aria-labelledby="operational-reminder-title"><span className="reminder-icon" aria-hidden="true"><BellIcon /></span><h2 id="operational-reminder-title">Tienes {notifications.total} pendiente{notifications.total === 1 ? "" : "s"} por atender</h2><p>{notifications.diagnosisPending.length} diagnóstico{notifications.diagnosisPending.length === 1 ? "" : "s"} por subir y {notifications.quotePending.length} cotización{notifications.quotePending.length === 1 ? "" : "es"} por crear.</p><div><button className="btn" type="button" onClick={onClose}>Continuar trabajando</button><button className="btn primary" type="button" onClick={onView}>Ver pendientes</button></div></section></div>;
}

function DashboardHome({
  user,
  onNew,
  onOrders,
  operationalPending,
  onOpenPending,
  onMetricFilter,
}: {
  user: CurrentUser;
  onNew: () => void;
  onOrders: () => void;
  operationalPending: OperationalPendingNotifications;
  onOpenPending: (item: OperationalPendingItem) => void;
  onMetricFilter: (status: string) => void;
}) {
  const [orders, setOrders] = useState<DashboardOrder[]>();
  const [pendingClaims, setPendingClaims] = useState(0);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ orders: DashboardOrder[] }>("/orders"),
      api<{ pendingClaims: number }>("/orders/navigation-summary"),
    ])
      .then(([loadedOrders, summary]) => {
        if (!active) return;
        setOrders(loadedOrders.orders);
        setPendingClaims(summary.pendingClaims);
      })
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, []);
  const count = (status: string) =>
    orders?.filter((order) => order.status === status).length || 0;
  const statusMeta: Record<string, { label: string; tone: string }> = {
    COTIZACION_PENDIENTE: { label: "Cotización pendiente", tone: "red" },
    ESPERA_APROBACION: { label: "Espera aprobación", tone: "amber" },
    ESPERA_REPUESTOS: { label: "Espera repuestos", tone: "blue" },
    EN_REPARACION: { label: "En reparación", tone: "green" },
    LISTA_PARA_ENTREGA: { label: "Lista para entrega", tone: "ready" },
  };
  const distribution = Object.entries(statusMeta);
  const relativeDate = (value: string) => {
    const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
    return days <= 0 ? "Creada hoy" : `Hace ${days} día${days === 1 ? "" : "s"}`;
  };
  const pending = pendingItems(operationalPending);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Buenos días, {user.names.split(" ")[0]}</h1>
          <p>Vista operativa del taller actualizada en tiempo real.</p>
        </div>
        <button className="btn primary" onClick={onNew}>
          + Nueva orden
        </button>
      </div>
      <div className="metrics">
        <Metric label="Cotizaciones pendientes" tone="red" value={count("COTIZACION_PENDIENTE")} emptyLabel="Sin cotizaciones pendientes" onClick={() => onMetricFilter("COTIZACION_PENDIENTE")} />
        <Metric label="Pendientes de aprobación" tone="amber" value={count("ESPERA_APROBACION")} emptyLabel="Sin aprobaciones por atender" onClick={() => onMetricFilter("ESPERA_APROBACION")} />
        <Metric label="Espera de repuestos" tone="blue" value={count("ESPERA_REPUESTOS")} emptyLabel="Sin repuestos pendientes" onClick={() => onMetricFilter("ESPERA_REPUESTOS")} />
        <Metric label="En reparación" tone="green" value={count("EN_REPARACION")} emptyLabel="Sin vehículos en reparación" onClick={() => onMetricFilter("EN_REPARACION")} />
      </div>
      {pendingClaims > 0 && (
        <button className="dashboard-alert" onClick={onOrders}>
          <b>{pendingClaims} siniestro{pendingClaims === 1 ? "" : "s"} pendiente{pendingClaims === 1 ? "" : "s"}</b>
          <span>Registrar número de siniestro en las órdenes correspondientes.</span>
          <i>Ver órdenes →</i>
        </button>
      )}
      {pending.length > 0 && <section className="dashboard-operational-pending card"><header><div><h2>Pendientes operativos</h2><small>Diagnósticos y cotizaciones que requieren atención.</small></div><span className="status amber">{pending.length}</span></header><div>{pending.slice(0, 5).map((item) => <button key={`${item.kind}-${item.id}`} className="dashboard-pending-item" onClick={() => onOpenPending(item)}><span className={item.kind === "DIAGNOSIS_PENDING" ? "operational-diagnosis" : "operational-quote"}>{item.kind === "DIAGNOSIS_PENDING" ? "Diagnóstico pendiente" : "Cotización pendiente"}</span><strong>{item.orderNumber} · {item.plate}</strong><small>{item.client} · {relativeDate(item.createdAt)}</small></button>)}</div></section>}
      <div className="dashboard-columns">
        <section className="card">
          <header>
            <h2>Prioridades del taller</h2>
            <button className="btn small" onClick={onOrders}>Ver todas</button>
          </header>
          {loadError ? (
            <div className="empty">No fue posible cargar las prioridades.</div>
          ) : !orders ? (
            <div className="empty">Cargando órdenes...</div>
          ) : orders.length ? (
            <div className="dashboard-priorities">
              {orders.slice(0, 5).map((order) => {
                const meta = statusMeta[order.status] || { label: order.status, tone: "neutral" };
                return (
                <button key={order.id} className={`dashboard-priority ${meta.tone}`} onClick={onOrders}>
                   <PlateBadge plate={order.plate} compact />
                  <div>
                    <strong>{order.brand} {order.model} · {order.color}</strong>
                    <small>{order.plate} · {order.orderNumber} · {order.client} · {relativeDate(order.createdAt)}</small>
                  </div>
                  <b>{meta.label}</b>
                </button>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aún no hay órdenes registradas.</div>
          )}
        </section>
        <section className="card">
          <header>
            <h2>Distribucion de casos</h2>
          </header>
          <div className="card-body">
            {distribution.map(([status, meta]) => {
              const total = count(status);
              const width = orders?.length ? Math.max(0, (total / orders.length) * 100) : 0;
              return (
              <div className="chart-row" key={status}>
                <span>{meta.label}</span>
                <div>
                  <i className={meta.tone} style={{ width: `${width}%` }} />
                </div>
                <b>{total}</b>
              </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
function Metric({
  label,
  tone,
  value,
  emptyLabel,
  onClick,
}: {
  label: string;
  tone: string;
  value: number;
  emptyLabel: string;
  onClick?: () => void;
}) {
  return (
    <article className={`card metric ${tone}${onClick ? " clickable" : ""}`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{value === 0 ? emptyLabel : "Requiere seguimiento"}</em>
    </article>
  );
}
function ModulePlaceholder({ route }: { route: Route }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{titles[route]}</h1>
          <p>
            Este modulo conservara el flujo operativo definido en el prototipo.
          </p>
        </div>
        {route === "new" && (
          <button className="btn primary">+ Nueva orden</button>
        )}
      </div>
      <section className="card">
        <div className="empty">Modulo en implementacion.</div>
      </section>
    </>
  );
}

type OrderRow = {
  id: number;
  orderNumber: string;
  status: string;
  modality: string;
  client: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  claimPending: boolean | 0 | 1;
  createdAt: string;
};
type Attachment = { id: number; category: string; originalName: string };
function EvidenceUploader({ orderId }: { orderId: number }) {
  const [attachments, setAttachments] = useState<Attachment[]>();
  const [message, setMessage] = useState<string>();
  const load = () =>
    api<{ attachments: Attachment[] }>(`/attachments/orders/${orderId}`).then(
      (result) => setAttachments(result.attachments),
    );
  useEffect(() => {
    load().catch(() => setMessage("No fue posible consultar evidencias."));
  }, [orderId]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("file")) return;
    setMessage("Cargando evidencia...");
    const response = await fetch(`/api/v1/attachments/orders/${orderId}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!response.ok) {
      setMessage("No fue posible cargar la evidencia.");
      return;
    }
    event.currentTarget.reset();
    await load();
    setMessage("Evidencia cargada.");
  }
  return (
    <div className="evidence-box">
      <form onSubmit={upload}>
        <input name="category" type="hidden" value="RECEPCION" />
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <button className="btn small">Adjuntar evidencia</button>
      </form>
      {message && <small>{message}</small>}
      {attachments && attachments.length > 0 && (
        <p>
          {attachments.length} evidencia{attachments.length === 1 ? "" : "s"}{" "}
          registrada{attachments.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
function QuotesView({ onOpen }: { onOpen: (orderId: number) => void }) {
  const [orders, setOrders] = useState<OrderRow[]>(); const [search, setSearch] = useState(""); const [stage, setStage] = useState(""); const [modality, setModality] = useState(""); const [age, setAge] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  useEffect(() => { api<{ orders: OrderRow[] }>("/orders").then((result) => setOrders(result.orders)); }, []);
  const labels: Record<string, string> = { COTIZACION_PENDIENTE: "Por cotizar", ESPERA_APROBACION: "Enviada · espera aprobación" }; const all = (orders || []).filter((order) => ["COTIZACION_PENDIENTE", "ESPERA_APROBACION"].includes(order.status)); const daysOld = (date: string) => Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000); const visible = all.filter((order) => { const days = daysOld(order.createdAt); const ageMatch = !age || (age === "RECENT" && days <= 2) || (age === "ATTENTION" && days >= 3 && days <= 5) || (age === "OVERDUE" && days > 5); const date = order.createdAt.slice(0, 10); return (!stage || order.status === stage) && (!modality || order.modality === modality) && ageMatch && (!from || date >= from) && (!to || date <= to) && `${order.orderNumber} ${order.plate} ${order.client} ${order.brand} ${order.model}`.toLowerCase().includes(search.toLowerCase()); }); const filterChips = [[stage && `Etapa: ${labels[stage]}`], [modality && `Modalidad: ${modality}`], [age && `Antigüedad: ${age === "RECENT" ? "0–2 días" : age === "ATTENTION" ? "3–5 días" : "+5 días"}`], [from && `Desde: ${from}`], [to && `Hasta: ${to}`], [search && `Búsqueda: ${search}`]].map(([value]) => value).filter(Boolean) as string[]; const clear = () => { setSearch(""); setStage(""); setModality(""); setAge(""); setFrom(""); setTo(""); };
  return <><div className="page-head"><div><h1>Cotizaciones</h1><p>Priorice cotizaciones por crear y envíos pendientes de aprobación.</p></div></div><div className="quote-inbox-metrics"><button className={stage === "" ? "active" : ""} onClick={() => setStage("")}><small>Casos por atender</small><strong>{all.length}</strong></button><button className={stage === "COTIZACION_PENDIENTE" ? "active amber" : "amber"} onClick={() => setStage("COTIZACION_PENDIENTE")}><small>Por cotizar</small><strong>{all.filter((item) => item.status === "COTIZACION_PENDIENTE").length}</strong></button><button className={stage === "ESPERA_APROBACION" ? "active blue" : "blue"} onClick={() => setStage("ESPERA_APROBACION")}><small>En aprobación</small><strong>{all.filter((item) => item.status === "ESPERA_APROBACION").length}</strong></button><article><small>Más de 5 días</small><strong>{all.filter((item) => daysOld(item.createdAt) > 5).length}</strong></article></div><section className="card quote-inbox"><div className="quote-inbox-toolbar"><div className="quote-inbox-filter-group"><label>Etapa<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Todas las etapas</option><option value="COTIZACION_PENDIENTE">Por cotizar</option><option value="ESPERA_APROBACION">Enviada · espera aprobación</option></select></label><label>Modalidad<select value={modality} onChange={(event) => setModality(event.target.value)}><option value="">Todas las modalidades</option>{[...new Set(all.map((item) => item.modality))].map((item) => <option key={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label>Antigüedad<select value={age} onChange={(event) => setAge(event.target.value)}><option value="">Todas</option><option value="RECENT">0–2 días</option><option value="ATTENTION">3–5 días</option><option value="OVERDUE">Más de 5 días</option></select></label></div><div className="quote-inbox-dates"><span>Fecha de creación</span><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div><label className="quote-inbox-search">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, cliente o vehículo" /></label></div><div className="quote-inbox-resultbar">{filterChips.length ? <><div>{filterChips.map((item) => <span key={item}>{item}</span>)}</div><button onClick={clear}>Limpiar filtros</button></> : <span>Sin filtros aplicados</span>}<b>{visible.length} caso{visible.length === 1 ? "" : "s"}</b></div>{!orders ? <div className="empty">Cargando cotizaciones...</div> : !visible.length ? <div className="empty">No hay cotizaciones pendientes con estos filtros.</div> : <><div className="quote-inbox-head"><span aria-hidden="true" /><span>Vehículo y caso</span><span>Modalidad</span><span>Estado</span><span>Acción</span></div><div className="quote-inbox-list">{visible.map((order) => <button className="quote-case" key={order.id} onClick={() => onOpen(order.id)}><PlateBadge plate={order.plate} /><div className="quote-case-summary"><strong>{order.brand} {order.model}</strong><small>{order.orderNumber} · {order.client} · Hace {daysOld(order.createdAt)} día(s)</small></div><span className="quote-case-modality">{order.modality.replaceAll("_", " ")}</span><b className={`status quote-case-status ${order.status === "COTIZACION_PENDIENTE" ? "amber" : "blue"}`}>{labels[order.status]}</b><em className="quote-case-action">Abrir cotización →</em></button>)}</div></>}</section></>;
}
function OrdersView({ onNew, onOpen, initialStatus }: { onNew: () => void; onOpen: (orderId: number) => void; initialStatus?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>();
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "ALL");
  const [modality, setModality] = useState("ALL");
  const [onlyPendingClaim, setOnlyPendingClaim] = useState(false);
  useEffect(() => {
    api<{ orders: OrderRow[] }>("/orders").then((result) =>
      setOrders(
        result.orders.map((order) => ({
          ...order,
          claimPending: Boolean(order.claimPending),
        })),
      ),
    );
  }, []);
  const visible =
    orders?.filter((order) =>
      `${order.orderNumber} ${order.client} ${order.plate} ${order.brand} ${order.model}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ).filter((order) => status === "ALL" || order.status === status)
      .filter((order) => modality === "ALL" || order.modality === modality)
      .filter((order) => !onlyPendingClaim || Boolean(order.claimPending)) ?? [];
  const statuses: Record<string, string> = {
    COTIZACION_PENDIENTE: "Cotización pendiente",
    ESPERA_APROBACION: "Espera aprobación",
    ESPERA_REPUESTOS: "Espera repuestos",
    EN_REPARACION: "En reparación",
    LISTA_PARA_ENTREGA: "Lista para entrega",
    ENTREGADA: "Entregada",
    CANCELADA: "Cancelada",
  };
  const statusTone = (value: string) =>
    value === "COTIZACION_PENDIENTE" ? "red" :
    value === "ESPERA_APROBACION" ? "amber" :
    value === "ESPERA_REPUESTOS" ? "blue" :
    value === "EN_REPARACION" ? "green" : "neutral";
  const relativeDate = (value: string) => {
    const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
    return days <= 0 ? "Creada hoy" : `Hace ${days} día${days === 1 ? "" : "s"}`;
  };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Órdenes del taller</h1>
          <p>Busca por cliente, placa, marca, modelo o número de orden.</p>
        </div>
        <button className="btn primary" onClick={onNew}>
          + Nueva orden
        </button>
      </div>
      <div className="order-filters">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Ej. Corolla blanca, ABC-123 u OS-2026"
        />
        <label>
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Todos los estados</option>
            {Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Modalidad</span>
          <select value={modality} onChange={(event) => setModality(event.target.value)}>
            <option value="ALL">Todas las modalidades</option>
            {[...new Set(orders?.map((order) => order.modality) || [])].map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="order-claim-filter">
          <input type="checkbox" checked={onlyPendingClaim} onChange={(event) => setOnlyPendingClaim(event.target.checked)} />
          Siniestro pendiente
        </label>
      </div>
      <section className="card order-list">
        {orders && <div className="order-result-bar">{visible.length} de {orders.length} órdenes</div>}
        {!orders ? (
          <div className="empty">Cargando órdenes...</div>
        ) : visible.length === 0 ? (
          <div className="empty">No hay coincidencias.</div>
        ) : (
          <><div className="order-column-headings" aria-hidden="true"><span>Placa</span><span>Vehículo y orden</span><span>Cliente y modalidad</span><span>Estado y acción</span></div>{visible.map((order) => (
            <button className="order-row" key={order.id} onClick={() => onOpen(order.id)}>
              <PlateBadge plate={order.plate} />
              <div>
                <strong>
                  {order.brand} {order.model} · {order.color}
                </strong>
                <small>{order.plate} · {order.orderNumber} · {relativeDate(order.createdAt)}</small>
              </div>
              <div>
                <strong>{order.client}</strong>
                <small>{order.modality.replace("_", " ")}</small>
              </div>
              <div>
                <span className={`status ${statusTone(order.status)}`}>{statuses[order.status] || order.status}</span>
                {order.claimPending && <small className="claim-pending">Siniestro pendiente</small>}
                <small className="order-open">Ver detalle →</small>
              </div>
            </button>
          ))}</>
        )}
      </section>
    </>
  );
}

type OrderDetailData = OrderRow & {
  publicCode?: string;
  internalStatus: string;
  publicStatus: string;
  claimNumber?: string;
  documentType: string;
  documentNumber: string;
  phone?: string;
  email?: string;
  operationalPhone?: string;
  operationalEmail?: string;
  operationalDataUpdatedAt?: string;
  year?: number;
  vin?: string;
  bodyCode?: string;
  bodyName: string;
  diagnosisPending: boolean;
  reception: null | { mileage?: number; fuelLevel?: number; considerations?: string[] | string; diagnosis?: string; diagnosisLegibility?: string; diagnosisReviewState?: string; acceptedTerms: boolean };
  checklist: Array<{ category: string; name: string; answer: string; observation?: string }>;
  damages: Array<{ body: string; view: string; path: unknown[] }>;
  attachments: Array<{ id: number; category: string; originalName: string; mimeType: string; byteSize: number }>;
  history: Array<{ action: string; createdAt: string; actor?: string }>;
};
function LegacyOrderDetail({ orderId, onBack, initialTab = "summary" }: { orderId: number; onBack: () => void; initialTab?: "summary" | "reception" | "quotes" | "history" }) {
  const [order, setOrder] = useState<OrderDetailData>();
  const [tab, setTab] = useState<"summary" | "reception" | "quotes" | "history">(initialTab);
  const [quotes, setQuotes] = useState<Array<{ id: number; versionNumber: number; status: string; currency: string; noParts: boolean; totalWithoutIgv: number; lines: Array<{ description: string; quantity: number; unitPrice: number }> }>>();
  const [quoteCurrency, setQuoteCurrency] = useState<"PEN" | "USD">("PEN");
  const [quoteNoParts, setQuoteNoParts] = useState(false);
  const [quoteLines, setQuoteLines] = useState([{ type: "MANO_OBRA" as const, category: "PLANCHADO", description: "", quantity: 1, unitPrice: 0 }]);
  const [message, setMessage] = useState<string>();
  const [claimNumber, setClaimNumber] = useState("");
  useEffect(() => {
    api<{ order: OrderDetailData }>(`/orders/${orderId}`)
      .then((result) => setOrder(result.order))
      .catch((error: Error) => setMessage(error.message));
  }, [orderId]);
  useEffect(() => { if (tab === "quotes") api<{ quotes: typeof quotes extends Array<infer T> ? T[] : never }>(`/orders/${orderId}/quotes`).then((result) => setQuotes(result.quotes)).catch(() => setQuotes([])); }, [orderId, tab]);
  const completeClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api(`/orders/${orderId}/claim`, { method: "PATCH", body: JSON.stringify({ claimNumber }) });
      setOrder((current) => current ? { ...current, claimPending: false, claimNumber } : current);
      setMessage("Siniestro registrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible registrar el siniestro.");
    }
  };
  const quoteAction = async (quoteId: number, action: "send" | "approve") => {
    await api(`/orders/${orderId}/quotes/${quoteId}/${action}`, { method: "POST" });
    const result = await api<{ quotes: typeof quotes extends Array<infer T> ? T[] : never }>(`/orders/${orderId}/quotes`);
    setQuotes(result.quotes);
  };
  const createQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api(`/orders/${orderId}/quotes`, { method: "POST", body: JSON.stringify({ currency: quoteCurrency, noParts: quoteNoParts, lines: quoteLines.filter((line) => line.description.trim()) }) });
    const result = await api<{ quotes: typeof quotes extends Array<infer T> ? T[] : never }>(`/orders/${orderId}/quotes`); setQuotes(result.quotes);
  };
  if (!order) return <div className="empty">{message || "Cargando detalle de orden..."}</div>;
  const considerations = Array.isArray(order.reception?.considerations)
    ? order.reception.considerations
    : [];
  return <>
    <div className="page-head detail-page-head"><div><button className="btn small" onClick={onBack}>← Órdenes</button><h1>{order.orderNumber}</h1><p>{order.brand} {order.model} · {order.plate} · {order.client}</p></div><span className="status red">{order.internalStatus.replaceAll("_", " ")}</span></div>
    <div className="tabs"><button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Resumen</button><button className={tab === "reception" ? "active" : ""} onClick={() => setTab("reception")}>Recepción</button><button className={tab === "quotes" ? "active" : ""} onClick={() => setTab("quotes")}>Cotización</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historial</button></div>
    {tab === "summary" ? <><div className="detail-grid"><section className="card"><header><h2>Información del caso</h2></header><div className="card-body detail-fields"><div><small>Cliente</small><strong>{order.client}</strong><span>{order.documentType} {order.documentNumber}</span></div><div><small>Vehículo</small><strong>{order.brand} {order.model}</strong><span>{order.plate} · {order.color}</span></div><div><small>Estado interno</small><strong>{order.internalStatus.replaceAll("_", " ")}</strong></div><div><small>Estado público</small><strong>{order.publicStatus.replaceAll("_", " ")}</strong></div></div></section><section className="card"><header><h2>Recepción</h2></header><div className="card-body detail-fields"><div><small>Kilometraje</small><strong>{order.reception?.mileage ?? "No registrado"}</strong></div><div><small>Combustible</small><strong>{order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`}</strong></div><div><small>Checklist</small><strong>{order.checklist.length} ítems registrados</strong></div><div><small>Daños marcados</small><strong>{order.damages.length} trazos</strong></div></div></section></div>{order.claimPending && <form className="claim-completion card" onSubmit={completeClaim}><strong>Completar siniestro pendiente</strong><input value={claimNumber} onChange={(event) => setClaimNumber(event.target.value)} placeholder="Número de siniestro" required /><button className="btn primary">Registrar siniestro</button></form>}{message && <p className="hint">{message}</p>}</> : tab === "quotes" ? <><form className="card quote-editor" onSubmit={createQuote}><header><h2>Nueva versión</h2></header><div className="card-body"><select value={quoteCurrency} onChange={(event) => setQuoteCurrency(event.target.value as "PEN" | "USD")}><option value="PEN">PEN</option><option value="USD">USD</option></select>{quoteLines.map((line, index) => <div className="quote-line" key={index}><select value={line.category} onChange={(event) => setQuoteLines((current) => current.map((item, i) => i === index ? { ...item, category: event.target.value } : item))}><option>PLANCHADO</option><option>PINTURA</option><option>MECANICA</option></select><input value={line.description} placeholder="Descripción" onChange={(event) => setQuoteLines((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))}/><input type="number" min="1" value={line.quantity} onChange={(event) => setQuoteLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))}/><input type="number" min="0" value={line.unitPrice} onChange={(event) => setQuoteLines((current) => current.map((item, i) => i === index ? { ...item, unitPrice: Number(event.target.value) } : item))}/></div>)}<label><input type="checkbox" checked={quoteNoParts} onChange={(event) => setQuoteNoParts(event.target.checked)}/> Sin repuestos</label><button className="btn primary">Crear cotización</button></div></form><section className="card"><header><h2>Versiones de cotización</h2></header><div className="card-body">{!quotes ? "Cargando cotizaciones..." : quotes.length ? quotes.map((quote) => <div className="quote-row" key={quote.id}><div><strong>Versión {quote.versionNumber} · {quote.currency}</strong><small>{quote.lines.length} líneas · Total sin IGV: {quote.currency === "PEN" ? "S/" : "US$"} {quote.totalWithoutIgv.toFixed(2)}</small></div><span className="status">{quote.status}</span>{quote.status === "PENDIENTE" && <button className="btn small" onClick={() => quoteAction(quote.id, "send")}>Enviar</button>}{quote.status === "ENVIADA" && <button className="btn small primary" onClick={() => quoteAction(quote.id, "approve")}>Aprobar</button>}</div>) : "Aún no hay cotizaciones."}</div></section></> : tab === "reception" ? <div className="detail-grid"><section className="card"><header><h2>Checklist y consideraciones</h2></header><div className="card-body"><p>{considerations.length ? considerations.join(" · ") : "Sin consideraciones registradas."}</p><div className="detail-checklist">{order.checklist.map((item) => <div key={`${item.category}-${item.name}`}><span>{item.name}</span><b className={item.answer === "SI" ? "yes" : "no"}>{item.answer}</b>{item.observation && <small>{item.observation}</small>}</div>)}</div></div></section><section className="card"><header><h2>Diagnóstico y adjuntos</h2></header><div className="card-body"><p>{order.reception?.diagnosis || "Sin diagnóstico registrado."}</p><p className="hint">{order.reception?.diagnosisLegibility || "PENDIENTE"} · {order.reception?.diagnosisReviewState || "PENDIENTE_REVISION"}</p><div className="attachment-list">{order.attachments.length ? order.attachments.map((attachment) => <div key={attachment.id}><img src={`/api/v1/attachments/${attachment.id}/content`} alt={attachment.originalName} /><strong>{attachment.originalName}</strong><small>{attachment.category} · {Math.ceil(attachment.byteSize / 1024)} KB</small></div>) : "Sin adjuntos registrados."}</div></div></section></div> : <section className="card"><header><h2>Historial de la orden</h2></header><div className="card-body history-list">{order.history.length ? order.history.map((event, index) => <div key={`${event.action}-${event.createdAt}-${index}`}><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.actor || "Sistema"} · {new Date(event.createdAt).toLocaleString("es-PE")}</span></div>) : "Sin eventos registrados."}</div></section>}
  </>;
}

function UnavailableTab({ title, description }: { title: string; description: string }) { return <section className="card unavailable-tab"><header><h2>{title}</h2><span className="status neutral">Pendiente</span></header><div className="card-body"><strong>Función aún no disponible</strong><p>{description}</p></div></section>; }
type ManagedPart = { id: number; orderId: number; orderNumber: string; plate: string; brand: string; model: string; claimNumber?: string; description: string; quantity: number; receivedQuantity: number; partialReceived: boolean; fullyReceived: boolean; partiallyReceived: boolean; freightRequested: boolean; managementStatus: "POR_GESTIONAR" | "PEDIDO" | "EN_TALLER"; quality: "ORIGINAL" | "ALTERNATIVO"; partCode?: string; expectedDate?: string; providerId?: number | null; providerName?: string; providerContact?: string; providerEmail?: string; providerPhone?: string; notes?: string };
type PartProvider = { id: number; name: string; contactName?: string; email?: string; phone?: string; brands: string[]; qualities: string[]; leadTimeDays?: string };
type PartsLogistics = { freightRequested: boolean; freightAmount?: number | null; freightPayment: "PENDIENTE" | "PARCIAL" | "PAGADO"; expansionRequired: boolean; owner?: string; notes?: string };
function PartsWorkbench({ orderId, onRepairStarted }: { orderId?: number; onRepairStarted?: () => Promise<void> }) {
  const [parts, setParts] = useState<ManagedPart[]>(); const [providers, setProviders] = useState<PartProvider[]>([]); const [logistics, setLogistics] = useState<PartsLogistics>(); const [search, setSearch] = useState(""); const [state, setState] = useState(""); const [qualityFilter, setQualityFilter] = useState(""); const [providerFilter, setProviderFilter] = useState(""); const [freightFilter, setFreightFilter] = useState(""); const [edits, setEdits] = useState<Record<number, Partial<ManagedPart>>>({}); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState<number>();
  const load = async () => { try { const workbench = await api<{ parts: ManagedPart[]; providers: PartProvider[] }>("/orders/parts/workbench"); if (orderId) { const detail = await api<{ parts: ManagedPart[]; logistics: PartsLogistics }>(`/orders/${orderId}/parts`); setParts(detail.parts); setLogistics(detail.logistics); } else setParts(workbench.parts); setProviders(workbench.providers); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los repuestos."); } };
  useEffect(() => { void load(); }, [orderId]);
  const value = <K extends keyof ManagedPart>(part: ManagedPart, key: K) => (edits[part.id]?.[key] ?? part[key]) as ManagedPart[K];
  const patch = (part: ManagedPart, changes: Partial<ManagedPart>) => setEdits((current) => ({ ...current, [part.id]: { ...current[part.id], ...changes } }));
  const save = async (part: ManagedPart) => { const draft = edits[part.id] || {}; setBusy(part.id); try { const receivedQuantity = Number(draft.receivedQuantity ?? part.receivedQuantity); await api(`/orders/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ receivedQuantity, managementStatus: draft.managementStatus ?? part.managementStatus, quality: draft.quality ?? part.quality, partCode: draft.partCode ?? part.partCode ?? "", expectedDate: String(draft.expectedDate ?? part.expectedDate ?? "").slice(0, 10), providerId: draft.providerId ?? part.providerId ?? null, notes: draft.notes ?? part.notes ?? "" }) }); setEdits((current) => { const next = { ...current }; delete next[part.id]; return next; }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar el repuesto."); } finally { setBusy(undefined); } };
  const saveLogistics = async () => { if (!orderId || !logistics) return; setBusy(-2); try { await api(`/orders/${orderId}/parts/logistics`, { method: "PUT", body: JSON.stringify({ ...logistics, freightAmount: logistics.freightAmount === null || logistics.freightAmount === undefined || logistics.freightAmount === 0 ? null : Number(logistics.freightAmount) }) }); setMessage("Logística del caso guardada."); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar la logística."); } finally { setBusy(undefined); } };
  const visible = (parts || []).filter((part) => { const text = `${part.description} ${part.plate} ${part.orderNumber} ${part.claimNumber || ""} ${part.providerName || ""}`.toLowerCase(); const display = part.fullyReceived ? "RECIBIDO" : part.partiallyReceived ? "PARCIAL" : part.managementStatus; return (!search || text.includes(search.toLowerCase())) && (!state || display === state) && (!qualityFilter || part.quality === qualityFilter) && (!providerFilter || String(part.providerId || "") === providerFilter) && (!freightFilter || String(part.freightRequested) === freightFilter); });
  const received = (parts || []).filter((part) => part.fullyReceived).length; const partial = (parts || []).filter((part) => part.partiallyReceived).length; const pending = (parts || []).filter((part) => !part.fullyReceived); const overdue = (parts || []).filter((part) => !part.fullyReceived && part.expectedDate && new Date(part.expectedDate) < new Date(new Date().toDateString())).length; const withoutProvider = (parts || []).filter((part) => !part.fullyReceived && !part.providerId).length; const startRepair = async () => { if (!orderId) return; setBusy(-1); try { await api(`/orders/${orderId}/start-repair`, { method: "POST" }); setMessage("Reparación iniciada."); await load(); await onRepairStarted?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible iniciar la reparación."); } finally { setBusy(undefined); } };
  return <section className="parts-workbench"><div className="page-head"><div><h1>{orderId ? "Seguimiento de repuestos" : "Gestión de repuestos"}</h1><p>{orderId ? "Registre recepción parcial y complete la logística de las partidas aprobadas." : "Administre solicitudes, proveedores y recepciones sin abrir cada orden."}</p></div>{orderId && <button className="btn primary" disabled={busy === -1 || pending.length > 0} onClick={startRepair}>{pending.length ? `${pending.length} pendiente(s) para reparar` : "Iniciar reparación"}</button>}</div><div className="parts-metrics"><article className="card"><small>Por gestionar / pedido</small><strong>{pending.length}</strong></article><article className="card"><small>Recepción parcial</small><strong>{partial}</strong></article><article className="card"><small>Recibidos</small><strong>{received}</strong></article></div>{orderId && logistics && <section className="card parts-logistics"><header><h2>Logística del caso</h2><button className="btn small" disabled={busy === -2} onClick={saveLogistics}>{busy === -2 ? "Guardando..." : "Guardar logística"}</button></header><div className="card-body"><label><span>Flete solicitado</span><input type="checkbox" checked={logistics.freightRequested} onChange={(event) => setLogistics({ ...logistics, freightRequested: event.target.checked })} /></label><label>Importe de flete<input type="number" min="0" value={logistics.freightAmount || ""} onChange={(event) => setLogistics({ ...logistics, freightAmount: Number(event.target.value) || null })} /></label><label>Pago<select value={logistics.freightPayment} onChange={(event) => setLogistics({ ...logistics, freightPayment: event.target.value as PartsLogistics["freightPayment"] })}><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADO">Pagado</option></select></label><label><span>Ampliación requerida</span><input type="checkbox" checked={logistics.expansionRequired} onChange={(event) => setLogistics({ ...logistics, expansionRequired: event.target.checked })} /></label><label>Responsable<input value={logistics.owner || ""} onChange={(event) => setLogistics({ ...logistics, owner: event.target.value })} /></label><label>Observaciones<textarea value={logistics.notes || ""} onChange={(event) => setLogistics({ ...logistics, notes: event.target.value })} /></label></div></section>}<section className="card parts-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar placa, siniestro, orden o repuesto" /><select value={state} onChange={(event) => setState(event.target.value)}><option value="">Todos los estados</option><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="EN_TALLER">En taller</option><option value="RECIBIDO">Recibido</option></select></section>{message && <p className="hint">{message}</p>}<section className="card parts-table-wrap"><table className="parts-table"><thead><tr><th>Estado / caso</th><th>Repuesto</th><th>Recepción</th><th>Gestión y ETA</th><th>Proveedor recomendado</th><th /></tr></thead><tbody>{visible.map((part) => { const quality = value(part, "quality") as ManagedPart["quality"]; const suggestions = providers.filter((provider) => provider.brands.includes(part.brand.toUpperCase()) && provider.qualities.includes(quality)); const display = part.fullyReceived ? "Recibido" : part.partiallyReceived ? "Parcial" : value(part, "managementStatus").replaceAll("_", " "); return <tr key={part.id}><td><span className={`status ${part.fullyReceived ? "ready" : part.partiallyReceived ? "amber" : "blue"}`}>{display}</span><strong>{part.plate}</strong><small>{part.orderNumber} · {part.brand} {part.model}</small></td><td><strong>{part.description}</strong><input value={String(value(part, "partCode") || "")} onChange={(event) => patch(part, { partCode: event.target.value })} placeholder="Código" /><select value={quality} onChange={(event) => patch(part, { quality: event.target.value as ManagedPart["quality"] })}><option value="ORIGINAL">Original / genuino</option><option value="ALTERNATIVO">Alternativo</option></select></td><td><strong>{part.receivedQuantity} / {part.quantity}</strong><input type="number" min="0" max={part.quantity} step="0.001" value={Number(value(part, "receivedQuantity"))} onChange={(event) => patch(part, { receivedQuantity: Number(event.target.value) })} /></td><td><select value={value(part, "managementStatus")} disabled={part.fullyReceived} onChange={(event) => patch(part, { managementStatus: event.target.value as ManagedPart["managementStatus"] })}><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="EN_TALLER">En taller</option></select><input type="date" value={String(value(part, "expectedDate") || "").slice(0, 10)} onChange={(event) => patch(part, { expectedDate: event.target.value })} /></td><td><select value={Number(value(part, "providerId") || "")} onChange={(event) => patch(part, { providerId: event.target.value ? Number(event.target.value) : null })}><option value="">Sin proveedor</option>{suggestions.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.leadTimeDays ? ` · ${provider.leadTimeDays} días` : ""}</option>)}</select><small>{suggestions.length ? "Recomendado por marca y calidad" : "Sin coincidencia en catálogo"}</small></td><td><button className="btn small" disabled={busy === part.id} onClick={() => save(part)}>{busy === part.id ? "Guardando..." : "Guardar"}</button></td></tr>; })}{!visible.length && <tr><td colSpan={6} className="empty">No hay repuestos que coincidan con los filtros.</td></tr>}</tbody></table></section></section>;
}
function PartsWorkbenchDense({ orderId, onRepairStarted }: { orderId?: number; onRepairStarted?: () => Promise<void> }) {
  const [parts, setParts] = useState<ManagedPart[]>(); const [providers, setProviders] = useState<PartProvider[]>([]); const [logistics, setLogistics] = useState<PartsLogistics>(); const [search, setSearch] = useState(""); const [filter, setFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "RECEIVED">("ALL"); const [editing, setEditing] = useState<number>(); const [drafts, setDrafts] = useState<Record<number, Partial<ManagedPart>>>({}); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState<number>();
  const load = async () => { try { const workbench = await api<{ parts: ManagedPart[]; providers: PartProvider[] }>("/orders/parts/workbench"); setProviders(workbench.providers); if (orderId) { const detail = await api<{ parts: ManagedPart[]; logistics: PartsLogistics }>(`/orders/${orderId}/parts`); setParts(detail.parts); setLogistics(detail.logistics); } else setParts(workbench.parts); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los repuestos."); } };
  useEffect(() => { void load(); }, [orderId]);
  const patch = (part: ManagedPart, value: Partial<ManagedPart>) => setDrafts((current) => ({ ...current, [part.id]: { ...current[part.id], ...value } }));
  const field = <K extends keyof ManagedPart>(part: ManagedPart, key: K) => (drafts[part.id]?.[key] ?? part[key]) as ManagedPart[K];
  const save = async (part: ManagedPart) => { const draft = drafts[part.id] || {}; setBusy(part.id); try { await api(`/orders/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ receivedQuantity: Number(draft.receivedQuantity ?? part.receivedQuantity), managementStatus: draft.managementStatus ?? part.managementStatus, quality: draft.quality ?? part.quality, partCode: draft.partCode ?? part.partCode ?? "", expectedDate: String(draft.expectedDate ?? part.expectedDate ?? "").slice(0, 10), providerId: draft.providerId ?? part.providerId ?? null, notes: draft.notes ?? part.notes ?? "" }) }); setDrafts((current) => { const next = { ...current }; delete next[part.id]; return next; }); setEditing(undefined); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar el repuesto."); } finally { setBusy(undefined); } };
  const all = parts || []; const received = all.filter((part) => part.fullyReceived).length; const partial = all.filter((part) => part.partiallyReceived).length; const pending = all.length - received; const visible = all.filter((part) => { const text = `${part.description} ${part.partCode || ""} ${part.providerName || ""} ${part.plate} ${part.orderNumber}`.toLowerCase(); const state = part.fullyReceived ? "RECEIVED" : part.partiallyReceived ? "PARTIAL" : "PENDING"; return (!search || text.includes(search.toLowerCase())) && (filter === "ALL" || filter === state); });
  const startRepair = async () => { if (!orderId) return; setBusy(-1); try { await api(`/orders/${orderId}/start-repair`, { method: "POST" }); setMessage("Reparación iniciada."); await onRepairStarted?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible iniciar la reparación."); } finally { setBusy(undefined); } };
  const saveLogistics = async () => { if (!orderId || !logistics) return; setBusy(-2); try { await api(`/orders/${orderId}/parts/logistics`, { method: "PUT", body: JSON.stringify({ ...logistics, freightAmount: logistics.freightAmount ? Number(logistics.freightAmount) : null }) }); setMessage("Logística guardada."); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar la logística."); } finally { setBusy(undefined); } };
  return <section className="parts-optimized"><header className="parts-command"><div><p className="eyebrow">ABASTECIMIENTO DEL CASO</p><h1>{orderId ? "Repuestos aprobados" : "Gestión de repuestos"}</h1><p>{orderId ? `${received} de ${all.length} recibidos. Complete los pendientes para habilitar la reparación.` : "Priorice pedidos y recepciones de todos los casos."}</p></div>{orderId && <div className="parts-command-action"><strong>{pending ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Todo recibido"}</strong><button className="btn primary" disabled={pending > 0 || busy === -1} onClick={startRepair}>{busy === -1 ? "Iniciando..." : "Iniciar reparación"}</button></div>}</header><div className="parts-summary" role="group" aria-label="Resumen de repuestos"><button className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}><small>Total</small><strong>{all.length}</strong></button><button className={filter === "PENDING" ? "active pending" : "pending"} onClick={() => setFilter("PENDING")}><small>Por recibir</small><strong>{pending}</strong></button><button className={filter === "PARTIAL" ? "active partial" : "partial"} onClick={() => setFilter("PARTIAL")}><small>Parciales</small><strong>{partial}</strong></button><button className={filter === "RECEIVED" ? "active received" : "received"} onClick={() => setFilter("RECEIVED")}><small>Recibidos</small><strong>{received}</strong></button></div>{orderId && logistics && <details className="parts-logistics-compact"><summary>Logística del caso <span>{logistics.freightRequested ? "Flete solicitado" : "Sin flete"}{logistics.expansionRequired ? " · Ampliación requerida" : ""}</span></summary><div><label>Flete solicitado<input type="checkbox" checked={logistics.freightRequested} onChange={(event) => setLogistics({ ...logistics, freightRequested: event.target.checked })} /></label><label>Importe<input type="number" min="0" value={logistics.freightAmount || ""} onChange={(event) => setLogistics({ ...logistics, freightAmount: Number(event.target.value) || null })} /></label><label>Pago<select value={logistics.freightPayment} onChange={(event) => setLogistics({ ...logistics, freightPayment: event.target.value as PartsLogistics["freightPayment"] })}><option value="PENDIENTE">Pendiente</option><option value="PARCIAL">Parcial</option><option value="PAGADO">Pagado</option></select></label><label>Ampliación requerida<input type="checkbox" checked={logistics.expansionRequired} onChange={(event) => setLogistics({ ...logistics, expansionRequired: event.target.checked })} /></label><label>Responsable<input value={logistics.owner || ""} onChange={(event) => setLogistics({ ...logistics, owner: event.target.value })} /></label><label>Observaciones<textarea value={logistics.notes || ""} onChange={(event) => setLogistics({ ...logistics, notes: event.target.value })} /></label><button className="btn small" disabled={busy === -2} onClick={saveLogistics}>{busy === -2 ? "Guardando..." : "Guardar logística"}</button></div></details>}<div className="parts-list-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar repuesto, código o proveedor" /><span>{visible.length} partida{visible.length === 1 ? "" : "s"}</span></div>{message && <p className="hint">{message}</p>}<div className="parts-list">{visible.map((part) => { const quality = field(part, "quality") as ManagedPart["quality"]; const suggestions = providers.filter((provider) => provider.brands.includes(part.brand.toUpperCase()) && provider.qualities.includes(quality)); const state = part.fullyReceived ? "Recibido" : part.partiallyReceived ? "Recepción parcial" : field(part, "managementStatus").replaceAll("_", " "); return <article className={`part-row${part.fullyReceived ? " received" : part.partiallyReceived ? " partial" : ""}`} key={part.id}><div className="part-row-state"><span className="status">{state}</span><strong>{part.receivedQuantity} / {part.quantity}</strong><small>unidades recibidas</small></div><div className="part-row-main"><strong>{part.description}</strong><span>{part.partCode || "Sin código"} · {quality === "ORIGINAL" ? "Original / genuino" : "Alternativo"}</span><small>{part.providerName || "Sin proveedor asignado"}{part.expectedDate ? ` · ETA ${new Date(part.expectedDate).toLocaleDateString("es-PE")}` : ""}</small></div><div className="part-row-actions"><button className="btn small" onClick={() => setEditing(editing === part.id ? undefined : part.id)}>{editing === part.id ? "Cerrar" : "Gestionar"}</button></div>{editing === part.id && <div className="part-editor"><label>Recibido<input type="number" min="0" max={part.quantity} step="0.001" value={Number(field(part, "receivedQuantity"))} onChange={(event) => patch(part, { receivedQuantity: Number(event.target.value) })} /></label><label>Estado<select value={field(part, "managementStatus")} disabled={part.fullyReceived} onChange={(event) => patch(part, { managementStatus: event.target.value as ManagedPart["managementStatus"] })}><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="EN_TALLER">En taller</option></select></label><label>Código<input value={String(field(part, "partCode") || "")} onChange={(event) => patch(part, { partCode: event.target.value })} /></label><label>Calidad<select value={quality} onChange={(event) => patch(part, { quality: event.target.value as ManagedPart["quality"] })}><option value="ORIGINAL">Original / genuino</option><option value="ALTERNATIVO">Alternativo</option></select></label><label>ETA<input type="date" value={String(field(part, "expectedDate") || "").slice(0, 10)} onChange={(event) => patch(part, { expectedDate: event.target.value })} /></label><label>Proveedor<select value={Number(field(part, "providerId") || "")} onChange={(event) => patch(part, { providerId: event.target.value ? Number(event.target.value) : null })}><option value="">Sin proveedor</option>{suggestions.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.leadTimeDays ? ` · ${provider.leadTimeDays} días` : ""}</option>)}</select><small>{suggestions.length ? "Recomendado por marca y calidad" : "Sin recomendación disponible"}</small></label><label className="part-notes">Observación<textarea value={String(field(part, "notes") || "")} onChange={(event) => patch(part, { notes: event.target.value })} /></label><button className="btn primary" disabled={busy === part.id} onClick={() => save(part)}>{busy === part.id ? "Guardando..." : "Guardar cambios"}</button></div>}</article>; })}{!visible.length && <div className="empty">No hay repuestos para este filtro.</div>}</div></section>;
}
function PartsWorkbenchNumeric({ orderId, onRepairStarted }: { orderId?: number; onRepairStarted?: () => Promise<void> }) {
  const [parts, setParts] = useState<ManagedPart[]>(); const [providers, setProviders] = useState<PartProvider[]>([]); const [editing, setEditing] = useState<number>(); const [drafts, setDrafts] = useState<Record<number, Partial<ManagedPart>>>({}); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState<number>();
  const load = async () => { try { const workbench = await api<{ parts: ManagedPart[]; providers: PartProvider[] }>("/orders/parts/workbench"); setProviders(workbench.providers); setParts(orderId ? (await api<{ parts: ManagedPart[] }>(`/orders/${orderId}/parts`)).parts : workbench.parts); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los repuestos."); } };
  useEffect(() => { void load(); }, [orderId]);
  const patch = (part: ManagedPart, value: Partial<ManagedPart>) => setDrafts((current) => ({ ...current, [part.id]: { ...current[part.id], ...value } }));
  const field = <K extends keyof ManagedPart>(part: ManagedPart, key: K) => (drafts[part.id]?.[key] ?? part[key]) as ManagedPart[K];
  const persist = async (part: ManagedPart, receivedQuantity = Number(field(part, "receivedQuantity"))) => { setBusy(part.id); try { await api(`/orders/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ receivedQuantity, managementStatus: field(part, "managementStatus"), quality: field(part, "quality"), partCode: field(part, "partCode") || "", expectedDate: String(field(part, "expectedDate") || "").slice(0, 10), providerId: field(part, "providerId") || null, notes: field(part, "notes") || "" }) }); setDrafts((current) => { const next = { ...current }; delete next[part.id]; return next; }); setEditing(undefined); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar el repuesto."); } finally { setBusy(undefined); } };
  const all = parts || []; const received = all.filter((part) => part.fullyReceived).length; const partial = all.filter((part) => part.partiallyReceived).length; const pending = all.length - received;
  const startRepair = async () => { if (!orderId) return; setBusy(-1); try { await api(`/orders/${orderId}/start-repair`, { method: "POST" }); setMessage("Reparación iniciada."); await onRepairStarted?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible iniciar la reparación."); } finally { setBusy(undefined); } };
  return <section className="parts-optimized"><header className="parts-command"><div><p className="eyebrow">ABASTECIMIENTO DEL CASO</p><h1>{orderId ? "Repuestos aprobados" : "Gestión de repuestos"}</h1><p>{received} de {all.length} recibidos. Marque la recepción total directamente o gestione el detalle.</p></div>{orderId && <div className="parts-command-action"><strong>{pending ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Todo recibido"}</strong><button className="btn primary" disabled={pending > 0 || busy === -1} onClick={startRepair}>Iniciar reparación</button></div>}</header><div className="parts-summary"><div><small>Por recibir</small><strong>{pending}</strong></div><div><small>Parciales</small><strong>{partial}</strong></div><div><small>Recibidos</small><strong>{received}</strong></div></div>{message && <p className="hint">{message}</p>}<div className="parts-list">{all.map((part) => { const quality = field(part, "quality") as ManagedPart["quality"]; const suggestions = providers.filter((provider) => provider.brands.includes(part.brand.toUpperCase()) && provider.qualities.includes(quality)); return <article className={`part-row${part.fullyReceived ? " received" : part.partiallyReceived ? " partial" : ""}`} key={part.id}><div className="part-row-state"><span className="status">{part.fullyReceived ? "Recibido" : part.partiallyReceived ? "Parcial" : field(part, "managementStatus").replaceAll("_", " ")}</span><small>{part.partiallyReceived ? `${part.receivedQuantity} de ${part.quantity} recibidos` : `${part.quantity} unidad${part.quantity === 1 ? "" : "es"}`}</small></div><div className="part-row-main"><strong>{part.description}</strong><span>{part.providerName || "Sin proveedor asignado"}{part.expectedDate ? ` · ETA ${new Date(part.expectedDate).toLocaleDateString("es-PE")}` : ""}</span></div><div className="part-row-actions"><label className="part-quick-receive"><input type="checkbox" checked={part.fullyReceived} disabled={busy === part.id} onChange={(event) => void persist(part, event.target.checked ? part.quantity : 0)} /><span>Recibido</span></label><button className="btn small" onClick={() => setEditing(editing === part.id ? undefined : part.id)}>Gestionar</button></div>{editing === part.id && <div className="part-editor"><label>Recepción parcial<input type="number" min="0" max={part.quantity} step="0.001" value={Number(field(part, "receivedQuantity"))} onChange={(event) => patch(part, { receivedQuantity: Number(event.target.value) })} /></label><label>Estado<select value={field(part, "managementStatus")} disabled={part.fullyReceived} onChange={(event) => patch(part, { managementStatus: event.target.value as ManagedPart["managementStatus"] })}><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="EN_TALLER">En taller</option></select></label><label>Código<input value={String(field(part, "partCode") || "")} onChange={(event) => patch(part, { partCode: event.target.value })} /></label><label>Calidad<select value={quality} onChange={(event) => patch(part, { quality: event.target.value as ManagedPart["quality"] })}><option value="ORIGINAL">Original / genuino</option><option value="ALTERNATIVO">Alternativo</option></select></label><label>ETA<input type="date" value={String(field(part, "expectedDate") || "").slice(0, 10)} onChange={(event) => patch(part, { expectedDate: event.target.value })} /></label><label>Proveedor<select value={Number(field(part, "providerId") || "")} onChange={(event) => patch(part, { providerId: event.target.value ? Number(event.target.value) : null })}><option value="">Sin proveedor</option>{suggestions.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label><button className="btn primary" disabled={busy === part.id} onClick={() => void persist(part)}>Guardar cambios</button></div>}</article>; })}{!all.length && <div className="empty">No hay repuestos aprobados en esta orden.</div>}</div></section>;
}
function PartsGlobalWorkbench({ onOpenOrder }: { onOpenOrder: (orderId: number) => void }) {
  const [parts, setParts] = useState<ManagedPart[]>();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [provider, setProvider] = useState(""); const [urgency, setUrgency] = useState(""); const [quality, setQuality] = useState(""); const [message, setMessage] = useState<string>();
  useEffect(() => {
    api<{ parts: ManagedPart[] }>("/orders/parts/workbench")
      .then((result) => setParts(result.parts))
      .catch((error: Error) => setMessage(error.message));
  }, []);
  const all = parts || [];
  const displayStatus = (part: ManagedPart) => part.fullyReceived ? "RECIBIDO" : part.managementStatus;
  const statusLabel = (part: ManagedPart) => ({ POR_GESTIONAR: "Por gestionar", PEDIDO: "Pedido", EN_TALLER: "En taller", RECIBIDO: "Recibido" }[displayStatus(part)] || displayStatus(part));
  const overdue = (part: ManagedPart) => !part.fullyReceived && Boolean(part.expectedDate) && new Date(`${part.expectedDate}T00:00:00`) < new Date(new Date().toDateString());
  const daysUntil = (date?: string) => date ? Math.floor((new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : undefined;
   const visible = all.filter((part) => {
     const text = `${part.orderNumber} ${part.plate} ${part.description} ${part.partCode || ""} ${part.claimNumber || ""} ${part.providerName || ""}`.toLowerCase(); const days = daysUntil(part.expectedDate); const urgencyMatch = !urgency || (urgency === "OVERDUE" && days !== undefined && days < 0) || (urgency === "NEXT_3" && days !== undefined && days >= 0 && days <= 3) || (urgency === "NO_DATE" && !part.expectedDate);
     return (!search || text.includes(search.trim().toLowerCase())) && (!status || displayStatus(part) === status) && (!provider || (provider === "NO_PROVIDER" ? !part.providerId : String(part.providerId) === provider)) && (!quality || part.quality === quality) && urgencyMatch;
   });
   const providerOptions = [...new Map(all.filter((part) => part.providerId && part.providerName).map((part) => [String(part.providerId), part.providerName!])).entries()];
   const clearFilters = () => { setSearch(""); setStatus(""); setProvider(""); setUrgency(""); setQuality(""); }; const activeFilters = Boolean(search || status || provider || urgency || quality);
   const metrics = [
    ["Vencidos", all.filter(overdue).length, "overdue"],
    ["Pedidos", all.filter((part) => displayStatus(part) === "PEDIDO").length, "ordered"],
    ["Sin proveedor", all.filter((part) => !part.fullyReceived && !part.providerId).length, "unassigned"],
    ["Recibidos", all.filter((part) => part.fullyReceived).length, "received"],
  ];
  if (!parts) return <div className="empty">{message || "Cargando repuestos..."}</div>;
  return <section className="global-parts-workbench">
    <header className="page-head"><div><h1>Gestión de repuestos</h1><p>Priorice solicitudes y recepciones de todos los casos.</p></div></header>
    <div className="global-parts-metrics" aria-label="Indicadores de repuestos">{metrics.map(([label, count, tone]) => <article className={`card ${tone}`} key={label as string}><small>{label}</small><strong>{count}</strong></article>)}</div>
    <section className="card global-parts-panel"><div className="global-parts-filters"><div className="global-parts-filter-group"><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="RECIBIDO">Recibido</option><option value="EN_TALLER">En taller</option></select></label><label>Urgencia<select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="">Todas</option><option value="OVERDUE">Vencido</option><option value="NEXT_3">Próximos 3 días</option><option value="NO_DATE">Sin fecha</option></select></label><label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">Todos</option><option value="NO_PROVIDER">Sin proveedor</option>{providerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Calidad<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="">Todas</option><option value="ORIGINAL">Original</option><option value="ALTERNATIVO">Alternativo</option></select></label></div><label className="global-parts-search">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, siniestro, código, proveedor o repuesto" /></label></div><div className="global-parts-result">{activeFilters ? <button onClick={clearFilters}>Limpiar filtros</button> : <span>Sin filtros aplicados</span>}<b>{visible.length} repuesto(s) encontrado(s)</b></div>
      <div className="global-parts-table-wrap"><table className="global-parts-table"><thead><tr><th>Repuesto</th><th>Orden y vehículo</th><th>Estado</th><th>Proveedor / ETA</th><th>Recepción</th><th aria-label="Acciones" /></tr></thead><tbody>{visible.map((part) => <tr key={part.id}><td><strong>{part.description}</strong>{part.partCode && <small>Cód. {part.partCode}</small>}</td><td><strong>{part.orderNumber}</strong><small>{part.plate} · {part.brand} {part.model}</small></td><td><span className={`status ${part.fullyReceived ? "green" : overdue(part) ? "red" : part.partiallyReceived ? "blue" : "amber"}`}>{statusLabel(part)}</span></td><td><strong>{part.providerName || "Sin proveedor"}</strong><small>{part.expectedDate ? `ETA ${new Date(`${part.expectedDate}T00:00:00`).toLocaleDateString("es-PE")}` : "Sin fecha estimada"}</small></td><td><strong>{part.receivedQuantity} de {part.quantity}</strong><small>{part.fullyReceived ? "Recepción completa" : "Pendiente de recepción"}</small></td><td><button className="btn small" onClick={() => onOpenOrder(part.orderId)}>Gestionar</button></td></tr>)}</tbody></table></div>
      <div className="global-parts-cards">{visible.map((part) => <article key={part.id}><div><span className={`status ${part.fullyReceived ? "green" : overdue(part) ? "red" : part.partiallyReceived ? "blue" : "amber"}`}>{statusLabel(part)}</span><button className="btn small" onClick={() => onOpenOrder(part.orderId)}>Gestionar</button></div><strong>{part.description}</strong><p>{part.orderNumber} · {part.plate}</p><dl><div><dt>Proveedor</dt><dd>{part.providerName || "Sin proveedor"}</dd></div><div><dt>Recepción</dt><dd>{part.receivedQuantity} de {part.quantity}</dd></div>{part.expectedDate && <div><dt>ETA</dt><dd>{new Date(`${part.expectedDate}T00:00:00`).toLocaleDateString("es-PE")}</dd></div>}</dl></article>)}</div>
      {!visible.length && <p className="empty">No hay repuestos que coincidan con los filtros.</p>}
    </section>
  </section>;
}
type ReceptionCatalog = {
  bodyTypes: Array<{ id: number; code: string; name: string }>;
  checklist: Array<{ id: number; category: string; name: string }>;
};
function LegacyNewOrder({ onCreated }: { onCreated: () => void }) {
  const [catalog, setCatalog] = useState<ReceptionCatalog>();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Record<string, FormDataEntryValue>>({});
  const [answers, setAnswers] = useState<Record<number, "SI" | "NO">>({});
  const [claimPending, setClaimPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<ReceptionCatalog>("/orders/reception-catalog")
      .then(setCatalog)
      .catch((error: Error) => setMessage(error.message));
  }, []);
  useEffect(() => {
    const captureDraft = (event: MouseEvent) => {
      const button = (event.target as Element).closest("button");
      if (!button?.textContent?.includes("Continuar")) return;
      const form = button.closest("form");
      if (!form) return;
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        form.reportValidity();
        return;
      }
      setDraft(Object.fromEntries(new FormData(form)));
    };
    document.addEventListener("click", captureDraft, true);
    return () => document.removeEventListener("click", captureDraft, true);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
    if (Object.keys(answers).length !== catalog.checklist.length) {
      setMessage(
        "Responde los 44 items del checklist antes de crear la orden.",
      );
      return;
    }
    const current = new FormData(event.currentTarget);
    const value = (name: string) => draft[name] ?? current.get(name);
    setSaving(true);
    setMessage(undefined);
    try {
      const result = await api<{ order: { orderNumber: string } }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          client: {
            documentType:
              String(value("documentNumber")).length === 11 ? "RUC" : "DNI",
            documentNumber: value("documentNumber"),
            fullName: value("fullName"),
            phone: value("phone") || undefined,
            email: value("email") || undefined,
          },
          vehicle: {
            plate: value("plate"),
            brand: value("brand"),
            model: value("model"),
            year: value("year") || undefined,
            vin: value("vin") || undefined,
            color: value("color"),
            colorType: "CATALOGO",
            bodyTypeId: Number(value("bodyTypeId")),
          },
          modality: value("modality"),
          claimNumber: value("claimNumber") || undefined,
          claimPendingReminder: claimPending,
          mileage: value("mileage") || undefined,
          fuelLevel: Number(value("fuelLevel")) || undefined,
          considerations: [],
          checklist: catalog.checklist.map((item) => ({
            itemId: item.id,
            answer: answers[item.id],
          })),
          acceptedTerms: true,
        }),
      });
      setMessage(`Orden ${result.order.orderNumber} creada correctamente.`);
      setTimeout(onCreated, 900);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible crear la orden.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!catalog)
    return (
      <div className="empty">
        {message || "Cargando checklist de recepcion..."}
      </div>
    );
  const categories = [
    ...new Set(catalog.checklist.map((item) => item.category)),
  ];
  return (
    <form className="wizard" onSubmit={submit}>
      <div className="wizard-top">
        <div>
          <strong>
            {step === 1 ? "Datos del caso" : "Checklist de recepcion"}
          </strong>
          <small>Paso {step} de 2 · Guardado al confirmar</small>
        </div>
        <div className="steps">
          <i className={step === 1 ? "active" : "done"} />
          <i className={step === 2 ? "active" : ""} />
        </div>
      </div>
      <section className="card wizard-card">
        {step === 1 ? (
          <div className="form-grid">
            <div className="section-title">
              <span>1</span>
              <div>
                <h2>Cliente, vehiculo y condiciones de ingreso</h2>
                <small>Los campos con * son obligatorios.</small>
              </div>
            </div>
            <WizardField label="DNI o RUC *">
              <input
                name="documentNumber"
                inputMode="numeric"
                pattern="[0-9]{8}|[0-9]{11}"
                required
              />
            </WizardField>
            <WizardField label="Cliente *">
              <input name="fullName" required />
            </WizardField>
            <WizardField label="Celular">
              <input name="phone" inputMode="tel" />
            </WizardField>
            <WizardField label="Correo">
              <input name="email" type="email" />
            </WizardField>
            <WizardField label="Placa *">
              <input
                name="plate"
                required
                style={{ textTransform: "uppercase" }}
              />
            </WizardField>
            <WizardField label="Modalidad *">
              <select name="modality" required defaultValue="">
                <option value="" disabled>
                  Selecciona
                </option>
                <option value="PARTICULAR">Particular</option>
                <option value="MAPFRE">Mapfre</option>
                <option value="LA_POSITIVA">La Positiva</option>
                <option value="RIMAC">Rimac</option>
                <option value="PACIFICO">Pacifico</option>
                <option value="QUALITAS">Qualitas</option>
              </select>
            </WizardField>
            <WizardField label="Marca *">
              <input name="brand" required />
            </WizardField>
            <WizardField label="Modelo *">
              <input name="model" required />
            </WizardField>
            <WizardField label="Color *">
              <input name="color" required />
            </WizardField>
            <WizardField label="Carroceria *">
              <select name="bodyTypeId" required defaultValue="">
                <option value="" disabled>
                  Selecciona
                </option>
                {catalog.bodyTypes.map((body) => (
                  <option value={body.id} key={body.id}>
                    {body.name}
                  </option>
                ))}
              </select>
            </WizardField>
            <WizardField label="Año">
              <input name="year" type="number" min="1900" max="2099" />
            </WizardField>
            <WizardField label="VIN">
              <input name="vin" maxLength={17} />
            </WizardField>
            <WizardField label="Kilometraje">
              <input name="mileage" type="number" min="0" />
            </WizardField>
            <WizardField label="Combustible">
              <select name="fuelLevel" defaultValue="">
                <option value="">Selecciona</option>
                <option value="0">0%</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </WizardField>
            <div className="claim-field">
              <label>
                <input
                  type="checkbox"
                  checked={claimPending}
                  onChange={(event) => setClaimPending(event.target.checked)}
                />{" "}
                Numero de siniestro pendiente
              </label>
              <input
                name="claimNumber"
                disabled={claimPending}
                placeholder="Numero de siniestro"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="section-title">
              <span>✓</span>
              <div>
                <h2>Checklist de recepcion</h2>
                <small>
                  {Object.keys(answers).length} de {catalog.checklist.length}{" "}
                  respondidos · todos son obligatorios.
                </small>
              </div>
            </div>
            {categories.map((category) => (
              <section className="check-category" key={category}>
                <h3>{category}</h3>
                {catalog.checklist
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <div className="check-row" key={item.id}>
                      <strong>{item.name}</strong>
                      <div className="segmented">
                        <button
                          type="button"
                          className={
                            answers[item.id] === "SI" ? "selected" : ""
                          }
                          onClick={() =>
                            setAnswers({ ...answers, [item.id]: "SI" })
                          }
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          className={
                            answers[item.id] === "NO" ? "selected no" : ""
                          }
                          onClick={() =>
                            setAnswers({ ...answers, [item.id]: "NO" })
                          }
                        >
                          OBS
                        </button>
                      </div>
                    </div>
                  ))}
              </section>
            ))}
          </div>
        )}
      </section>
      {message && <p className="wizard-message">{message}</p>}
      <div className="wizard-actions">
        {step === 2 && (
          <button className="btn" type="button" onClick={() => setStep(1)}>
            ← Anterior
          </button>
        )}
        {step === 1 ? (
          <button
            className="btn primary"
            type="button"
            onClick={() => setStep(2)}
          >
            Continuar →
          </button>
        ) : (
          <button className="btn primary" disabled={saving} type="submit">
            {saving ? "Creando..." : "Confirmar y crear orden"}
          </button>
        )}
      </div>
    </form>
  );
}
function WizardField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="wizard-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function App() {
  const [state, setState] = useState<AppState>("loading");
  const [user, setUser] = useState<CurrentUser>();
  useEffect(() => {
    Promise.all([
      api<{ configured: boolean }>("/setup/status"),
      api<{ user: CurrentUser }>("/auth/me").catch(() => undefined),
    ])
      .then(([setup, session]) => {
        if (session?.user) {
          setUser(session.user);
          setState("dashboard");
        } else setState(setup.configured ? "login" : "setup");
      })
      .catch(() => setState("login"));
  }, []);
  if (state === "loading")
    return <main className="loading-screen">Cargando PARAUTOS...</main>;
  if (state === "setup")
    return <SetupForm onComplete={() => setState("login")} />;
  if (state === "login")
    return (
      <LoginForm
        onLogin={(currentUser) => {
          setUser(currentUser);
          setState("dashboard");
        }}
      />
    );
  return (
    <Dashboard
      user={user!}
      onLogout={() =>
        api("/auth/logout", { method: "POST" }).finally(() => {
          setUser(undefined);
          setState("login");
        })
      }
    />
  );
}
