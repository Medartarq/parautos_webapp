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
import { openReceptionPrint } from "./reception-print";
import { api } from "./api";
import { loadPdfLibrary } from "./pdf-library";

const ReportsView = lazy(() => import("./reports-view").then(({ ReportsView }) => ({ default: ReportsView })));

type AppState = "loading" | "setup" | "login" | "dashboard";
type Route =
  "dashboard" | "new" | "orders" | "orderDetail" | "quotes" | "parts" | "reports" | "audit" | "users";
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
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const compact =
    sidebarMode === "compact" || (sidebarMode === "auto" && route === "parts");
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
            />
          ) : route === "new" ? (
            <NewOrder onCreated={() => changeRoute("orders")} />
          ) : route === "orders" ? (
            <OrdersView
              onNew={() => changeRoute("new")}
              onOpen={(orderId) => {
                setSelectedOrderId(orderId);
                setSelectedOrderTab(undefined);
                changeRoute("orderDetail");
              }}
            />
          ) : route === "orderDetail" && selectedOrderId ? (
            <OrderDetail
              orderId={selectedOrderId}
              initialTab={selectedOrderTab}
              onBack={() => changeRoute("orders")}
            />
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
            <AuditView />
          ) : route === "users" ? (
            <UsersView />
          ) : route === "reports" ? (
            <Suspense fallback={<div className="empty">Cargando reportes...</div>}><ReportsView /></Suspense>
          ) : (
            <ModulePlaceholder route={route} />
          )}
        </section>
      </main>
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
}: {
  user: CurrentUser;
  onNew: () => void;
  onOrders: () => void;
  operationalPending: OperationalPendingNotifications;
  onOpenPending: (item: OperationalPendingItem) => void;
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
        <Metric label="Cotizaciones pendientes" tone="red" value={count("COTIZACION_PENDIENTE")} emptyLabel="Sin cotizaciones pendientes" />
        <Metric label="Pendientes de aprobación" tone="amber" value={count("ESPERA_APROBACION")} emptyLabel="Sin aprobaciones por atender" />
        <Metric label="Espera de repuestos" tone="blue" value={count("ESPERA_REPUESTOS")} emptyLabel="Sin repuestos pendientes" />
        <Metric label="En reparación" tone="green" value={count("EN_REPARACION")} emptyLabel="Sin vehículos en reparación" />
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
}: {
  label: string;
  tone: string;
  value: number;
  emptyLabel: string;
}) {
  return (
    <article className={`card metric ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{value === 0 ? emptyLabel : "Requiere seguimiento"}</em>
    </article>
  );
}
type AuditEvent = { id: number; entity: string; recordId: string; action: string; createdAt: string; actorUserId?: number; actorName?: string; orderNumber?: string; previousData?: unknown; newData?: unknown };
type AuditResult = { events: AuditEvent[]; actions: string[]; users: Array<{ id: number; names: string }> };
const auditActionLabels: Record<string, string> = {
  CREATED: "Orden creada",
  CLAIM_COMPLETED: "Número de siniestro registrado",
  DIAGNOSIS_UPLOADED: "Diagnóstico cargado",
  OPERATIONAL_DATA_CORRECTED: "Datos operativos corregidos",
  QUOTE_CREATED: "Cotización creada",
  QUOTE_UPDATED: "Cotización actualizada",
  QUOTE_DELETED: "Cotización eliminada",
  QUOTE_SENT: "Cotización enviada",
  QUOTE_APPROVED: "Cotización aprobada",
  PART_UPDATED: "Repuesto actualizado",
  PARTS_LOGISTICS_UPDATED: "Logística de repuestos actualizada",
  REPAIR_STARTED: "Reparación iniciada",
  LABOR_VERIFIED: "Partida de mano de obra verificada",
  LABOR_VERIFICATION_REMOVED: "Verificación de partida retirada",
  ALL_LABOR_VERIFIED: "Todas las partidas verificadas",
  ALL_LABOR_VERIFICATIONS_REMOVED: "Verificación masiva retirada",
  FINAL_CONTROL_COMPLETED: "Control final completado",
  FINAL_CONTROL_REOPENED: "Control final reabierto",
  READY_FOR_PICKUP_PUBLISHED: "Lista para entrega publicada",
  ORDER_DELIVERED: "Orden entregada",
};
const auditActionLabel = (action: string) => auditActionLabels[action] || action.replaceAll("_", " ");
function AuditView() {
  const [result, setResult] = useState<AuditResult>(); const [text, setText] = useState(""); const [action, setAction] = useState(""); const [userId, setUserId] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [error, setError] = useState<string>();
  const load = async () => { try { setError(undefined); const query = new URLSearchParams(); if (text.trim()) query.set("text", text.trim()); if (action) query.set("action", action); if (userId) query.set("userId", userId); if (from) query.set("from", from); if (to) query.set("to", to); setResult(await api<AuditResult>(`/audit/events?${query}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar la auditoría."); } };
  useEffect(() => { void load(); }, []);
  return <><div className="page-head"><div><h1>Auditoría</h1><p>Consulta inmutable de eventos registrados en la aplicación.</p></div></div><section className="card audit-view"><div className="audit-filters"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Buscar acción, entidad, registro o usuario" /><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">Todas las acciones</option>{result?.actions.map((item) => <option key={item} value={item}>{auditActionLabel(item)}</option>)}</select><select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Todos los usuarios</option>{result?.users.map((item) => <option key={item.id} value={item.id}>{item.names}</option>)}</select><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="btn primary" onClick={() => void load()}>Filtrar</button></div>{error ? <div className="empty">{error}</div> : !result ? <div className="empty">Cargando auditoría...</div> : <div className="audit-events">{result.events.length ? result.events.map((event) => <article key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.orderNumber || `${event.entity} #${event.recordId}`}</span></div><div><b>{event.actorName || "Sistema"}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></article>) : <div className="empty">No hay eventos con estos filtros.</div>}</div>}</section></>;
}
type ManagedUser = { id: number; names: string; username: string; email: string; role: "SUPERADMINISTRADOR" | "ADMINISTRADOR" | "ASESOR"; active: boolean; createdAt: string };
function UsersView() {
  const [users, setUsers] = useState<ManagedUser[]>([]); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>(); const [saving, setSaving] = useState(false); const [search, setSearch] = useState(""); const [showPassword, setShowPassword] = useState(false);
  const load = async () => { try { setError(undefined); setUsers((await api<{ users: ManagedUser[] }>("/users")).users); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar usuarios."); } };
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); setMessage(undefined); setError(undefined); try { await api("/users", { method: "POST", body: JSON.stringify({ names: form.get("names"), username: form.get("username"), email: form.get("email"), role: form.get("role"), password: form.get("password") }) }); event.currentTarget.reset(); setMessage("Usuario creado correctamente."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear el usuario."); } finally { setSaving(false); } };
  const toggle = async (user: ManagedUser) => { const action = user.active ? "desactivar" : "activar"; if (!window.confirm(`¿Confirma ${action} la cuenta de ${user.names}?`)) return; setError(undefined); try { await api(`/users/${user.id}/active`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) }); setMessage(`Cuenta ${user.active ? "desactivada" : "activada"} correctamente.`); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar el usuario."); } };
  const visibleUsers = users.filter((user) => `${user.names} ${user.username} ${user.email} ${user.role}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())); const activeCount = users.filter((user) => user.active).length;
  return <><div className="page-head users-page-head"><div><h1>Usuarios</h1><p>Administra accesos operativos y administrativos de PARAUTOS.</p></div><span className="users-count">{activeCount} activo{activeCount === 1 ? "" : "s"} · {users.length} total</span></div><section className="card users-create"><header><div><h2>Crear usuario</h2><p>Las cuentas nuevas quedan activas inmediatamente.</p></div></header><form onSubmit={(event) => void create(event)}><div className="users-form-grid"><label>Nombres y apellidos<input name="names" placeholder="Ej. Ana Pérez" minLength={3} autoComplete="name" required /></label><label>Usuario<input name="username" placeholder="ana.perez" pattern="[a-zA-Z0-9._-]+" minLength={3} autoComplete="username" required /><small>Solo letras, números, punto, guion y guion bajo.</small></label><label>Correo corporativo<input name="email" type="email" placeholder="ana@empresa.com" autoComplete="email" required /></label><label>Rol<select name="role" defaultValue="ASESOR"><option value="ASESOR">Asesor — gestión operativa</option><option value="ADMINISTRADOR">Administrador — todos los módulos, sin gestión de cuentas</option></select></label><label className="users-password">Contraseña inicial<div><input name="password" type={showPassword ? "text" : "password"} minLength={12} autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Mostrar"}</button></div><small>Mínimo 12 caracteres. Compártala de forma segura.</small></label></div><footer><p>El usuario podrá iniciar sesión al finalizar la creación.</p><button className="btn primary" disabled={saving}>{saving ? "Creando usuario..." : "Crear usuario"}</button></footer></form></section>{message && <p className="users-notice success-message" role="status">{message}</p>}{error && <p className="users-notice form-error" role="alert">{error}</p>}<section className="card users-directory"><header><div><h2>Directorio de usuarios</h2><p>Consulta el acceso y estado de cada cuenta.</p></div><label className="users-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, usuario o correo" /></label></header>{visibleUsers.length ? <><div className="users-table-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acciones</span></div><div className="users-list">{visibleUsers.map((user) => <article key={user.id} className={!user.active ? "inactive" : ""}><div className="user-identity"><span className="user-avatar" aria-hidden="true">{user.names.trim().slice(0, 1).toUpperCase()}</span><div><strong>{user.names}</strong><small>@{user.username} · {user.email}</small></div></div><span className={`user-role ${user.role === "SUPERADMINISTRADOR" ? "superadmin" : user.role === "ADMINISTRADOR" ? "admin" : "advisor"}`}>{user.role === "SUPERADMINISTRADOR" ? "Superadministrador" : user.role === "ADMINISTRADOR" ? "Administrador" : "Asesor"}</span><span className={`user-state ${user.active ? "active" : "inactive"}`}>{user.active ? "Activo" : "Inactivo"}</span><button className={`btn user-toggle ${user.active ? "danger" : ""}`} onClick={() => void toggle(user)}>{user.active ? "Desactivar" : "Activar"}</button></article>)}</div></> : <div className="empty">No se encontraron usuarios con esa búsqueda.</div>}</section></>;
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
function OrdersView({ onNew, onOpen }: { onNew: () => void; onOpen: (orderId: number) => void }) {
  const [orders, setOrders] = useState<OrderRow[]>();
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("ALL");
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

const detailStatuses: Record<string, { label: string; tone: string; progress: number }> = {
  COTIZACION_PENDIENTE: { label: "Cotización pendiente", tone: "red", progress: 25 },
  ESPERA_APROBACION: { label: "Espera de aprobación", tone: "amber", progress: 25 },
  ESPERA_REPUESTOS: { label: "Espera de repuestos", tone: "blue", progress: 50 },
  EN_REPARACION: { label: "En reparación", tone: "green", progress: 75 },
  LISTA_PARA_ENTREGA: { label: "Lista para entrega", tone: "ready", progress: 100 },
  ENTREGADA: { label: "Entregada", tone: "ready", progress: 100 },
  CANCELADA: { label: "Cancelada", tone: "neutral", progress: 0 },
};
type DetailTab = "summary" | "reception" | "quotes" | "parts" | "control" | "history";
function OrderDetail({ orderId, initialTab, onBack }: { orderId: number; initialTab?: DetailTab; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>(initialTab || "summary");
  const [order, setOrder] = useState<OrderDetailData>();
  const [message, setMessage] = useState<string>();
  const [claimNumber, setClaimNumber] = useState("");
  const [operationalEditing, setOperationalEditing] = useState(false);
  const [operationalPhone, setOperationalPhone] = useState("");
  const [operationalEmail, setOperationalEmail] = useState("");
  const [operationalClaim, setOperationalClaim] = useState("");
  const [operationalPending, setOperationalPending] = useState(false);
  const [operationalReason, setOperationalReason] = useState("");
  const [operationalBusy, setOperationalBusy] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const refreshOrder = async () => {
    try { setOrder((await api<{ order: OrderDetailData }>(`/orders/${orderId}`)).order); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la orden."); }
  };
  useEffect(() => {
    void refreshOrder();
  }, [orderId]);
  if (!order) return <div className="empty">{message || "Cargando detalle de orden..."}</div>;
  const status = detailStatuses[order.internalStatus] || {
    label: order.internalStatus.replaceAll("_", " "), tone: "neutral", progress: 0,
  };
  const completeClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api(`/orders/${orderId}/claim`, { method: "PATCH", body: JSON.stringify({ claimNumber }) });
      setOrder({ ...order, claimPending: false, claimNumber });
      setMessage("Siniestro registrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible registrar el siniestro.");
    }
  };
  const beginOperationalEdit = () => {
    setOperationalPhone(order.operationalPhone || ""); setOperationalEmail(order.operationalEmail || "");
    setOperationalClaim(order.claimNumber || ""); setOperationalPending(Boolean(order.claimPending)); setOperationalReason(""); setOperationalEditing(true);
  };
  const saveOperationalData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setOperationalBusy(true); setMessage(undefined);
    try {
      await api(`/orders/${orderId}/operational-data`, { method: "PATCH", body: JSON.stringify({ phoneOverride: operationalPhone, emailOverride: operationalEmail, claimNumber: operationalClaim, claimPendingReminder: operationalPending, reason: operationalReason }) });
      setOperationalEditing(false); setMessage("Datos operativos actualizados."); await refreshOrder();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar los datos operativos."); }
    finally { setOperationalBusy(false); }
  };
  const tabs: Array<[DetailTab, string]> = [
    ["summary", "Resumen"], ["reception", "Recepción"], ["quotes", "Cotización"],
    ["parts", "Repuestos"], ["control", "Control final"], ["history", "Historial"],
  ];
  return <>
    <section className="detail-hero">
      <div className="detail-identity"><button className="btn small" onClick={onBack}>← Órdenes</button><h1>{order.orderNumber}</h1><p>{order.brand} {order.model} · {order.color} · {order.plate}</p><div className="detail-meta"><span>{order.modality.replaceAll("_", " ")}</span><span>{order.bodyName}</span><span>Cliente: {order.client}</span></div><a className="btn small public-tracking-link" href={`/seguimiento?plate=${encodeURIComponent(order.plate)}&code=${encodeURIComponent(order.publicCode || "")}`} target="_blank" rel="noreferrer">Abrir seguimiento público ↗</a></div>
      <div className="detail-statuses"><span className={`status ${status.tone}`}>Interno · {status.label}</span><span className="status neutral">Público · {order.publicStatus.replaceAll("_", " ")}</span><label>Estado actual<select value={order.internalStatus} disabled aria-describedby="status-readonly"><option>{status.label}</option></select><small id="status-readonly">Solo lectura: no hay API de cambio manual de estado.</small></label></div>
    </section>
    <section className="detail-progress card"><div><small>Avance del caso</small><strong>{status.progress}%</strong><span>Etapa alcanzada; no representa avance físico exacto.</span></div><div className="progress-bar" aria-label={`Avance ${status.progress}%`}><i style={{ width: `${status.progress}%` }} /></div></section>
    <div className="tabs" role="tablist" aria-label="Detalle de orden">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "summary" && <><div className="detail-grid"><section className="card"><header><h2>Información del caso</h2></header><div className="card-body detail-fields"><DetailField label="Cliente" value={order.client} note={`${order.documentType} ${order.documentNumber}`} /><DetailField label="Vehículo" value={`${order.brand} ${order.model}`} note={`${order.plate} · ${order.color}`} /><DetailField label="Modalidad" value={order.modality.replaceAll("_", " ")} note={order.claimNumber ? `Siniestro: ${order.claimNumber}` : order.claimPending ? "Siniestro pendiente" : "Sin siniestro registrado"} /><DetailField label="Carrocería" value={order.bodyName} note={order.year ? `Año ${order.year}` : "Año no registrado"} /><DetailField label="Código público" value={order.publicCode || "No disponible"} note="Compártalo con el cliente junto con la placa para el seguimiento." /><DetailField label="Estados" value={`Interno: ${status.label}`} note={`Público: ${order.publicStatus.replaceAll("_", " ")}`} /></div></section><section className="card"><header><h2>Resumen de recepción</h2></header><div className="card-body detail-fields"><DetailField label="Kilometraje" value={order.reception?.mileage === undefined ? "No registrado" : `${order.reception.mileage} km`} /><DetailField label="Combustible" value={order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`} /><DetailField label="Checklist" value={`${order.checklist.length} ítems registrados`} /><DetailField label="Daños" value={`${order.damages.length} marcas registradas`} /><DetailField label="Evidencias" value={`${order.attachments.length} archivos adjuntos`} /><DetailField label="Diagnóstico" value={order.reception?.diagnosis ? "Registrado" : "No registrado"} /></div></section></div><section className="card operational-data-editor"><header><div><h2>Contacto operativo actual</h2><small>La recepción original y su documento A4 son inmutables.</small></div>{!operationalEditing && <button className="btn small" disabled={["ENTREGADA", "CANCELADA"].includes(order.internalStatus)} onClick={beginOperationalEdit}>Corregir datos</button>}</header>{operationalEditing ? <form className="card-body operational-data-form" onSubmit={saveOperationalData}><label>Teléfono operativo<input inputMode="tel" value={operationalPhone} onChange={(event) => setOperationalPhone(event.target.value)} maxLength={20} /></label><label>Correo operativo<input type="email" value={operationalEmail} onChange={(event) => setOperationalEmail(event.target.value)} maxLength={150} /></label>{order.modality !== "PARTICULAR" && <><label>Número de siniestro<input value={operationalClaim} disabled={operationalPending} onChange={(event) => setOperationalClaim(event.target.value)} maxLength={60} /></label><label className="operational-pending"><input type="checkbox" checked={operationalPending} onChange={(event) => { setOperationalPending(event.target.checked); if (event.target.checked) setOperationalClaim(""); }} /> Siniestro pendiente</label></>}<label className="operational-reason">Motivo de corrección<textarea required minLength={1} maxLength={500} value={operationalReason} onChange={(event) => setOperationalReason(event.target.value)} /></label><div className="operational-actions"><button type="button" className="btn" disabled={operationalBusy} onClick={() => setOperationalEditing(false)}>Cancelar</button><button className="btn primary" disabled={operationalBusy}>{operationalBusy ? "Guardando..." : "Guardar cambios"}</button></div></form> : <div className="card-body detail-fields"><DetailField label="Teléfono" value={order.operationalPhone || "Sin override"} /><DetailField label="Correo" value={order.operationalEmail || "Sin override"} /><DetailField label="Siniestro" value={order.claimNumber || (order.claimPending ? "Pendiente" : "No corresponde")} /></div>}</section>{order.claimPending && <form className="claim-completion card" onSubmit={completeClaim}><strong>Completar siniestro pendiente</strong><input value={claimNumber} onChange={(event) => setClaimNumber(event.target.value)} placeholder="Número de siniestro" required /><button className="btn primary">Registrar siniestro</button></form>}</>}
    {tab === "reception" && <ReceptionDetail order={order} onRefresh={refreshOrder} />}
    {tab === "quotes" && <><QuoteExportToolbar order={order} revision={quoteRevision} /><QuoteTabImproved orderId={orderId} diagnoses={order.attachments.filter((attachment) => attachment.category === "EVALUACION_MANUSCRITA")} onQuotesChanged={() => setQuoteRevision((current) => current + 1)} /></>}
    {tab === "parts" && <PartsOrderWorkbench orderId={orderId} onRepairStarted={refreshOrder} />}
    {tab === "control" && <FinalControl orderId={orderId} order={order} onChanged={refreshOrder} />}
    {tab === "history" && <section className="card"><header><h2>Historial resumido</h2></header><div className="card-body history-list">{order.history.length ? order.history.map((event, index) => <div key={`${event.createdAt}-${index}`}><strong>{auditActionLabel(event.action)}</strong><span>{new Date(event.createdAt).toLocaleString()} · {event.actor || "Sistema"}</span></div>) : <p className="hint">No hay eventos registrados.</p>}</div></section>}
    {message && <p className="hint detail-message">{message}</p>}
  </>;
}
function DetailField({ label, value, note }: { label: string; value: string; note?: string }) { return <div><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div>; }
async function downloadConformityPdf(data: { orderNumber: string; client: string; documentNumber: string; phone?: string; modality: string; plate: string; brand: string; model: string; completedAt?: string }) {
  const { jsPDF } = await loadPdfLibrary();
  const pdf = new jsPDF({ unit: "mm", format: "a4" }); const left = 20; const right = 15; const width = 210 - left - right; let y = 16;
  const rasterizeLogo = () => new Promise<string>((resolve, reject) => { const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")?.drawImage(image, 0, 0); resolve(canvas.toDataURL("image/png")); }; image.onerror = reject; image.src = logo; });
  try { pdf.addImage(await rasterizeLogo(), "PNG", left, y - 5, 29, 18); } catch { pdf.setTextColor(237, 51, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text("PARAUTOS", left, y + 5); }
  pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Acta de Conformidad de Servicios", 195, y + 1, { align: "right" });
  pdf.setFontSize(8); pdf.text(`Orden de servicio: ${data.orderNumber}`, 195, y + 6, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setTextColor(95, 107, 122); pdf.text("B & P Service S.A.C. · PARAUTOS · RUC 20560170549 · Av. América Norte N.° 2404, Trujillo", 195, y + 11, { align: "right" }); y += 15;
  pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(.5); pdf.line(left, y, 195, y);
  // La cabecera se mantiene fija; el bloque de conformidad se centra en el área útil restante del A4.
  const date = new Date(data.completedAt || Date.now()); pdf.setTextColor(23, 33, 43); pdf.setFontSize(9); pdf.text(`Trujillo, ${date.toLocaleDateString("es-PE")}`, 195, 60, { align: "right" });
  y = 96;
  const statement = "Mediante el presente documento, se deja constancia que se ha recibido a mi satisfacción los servicios brindados por PARAUTOS, servicios que corresponden al 100% del monto total de la orden de servicio suscrita. Por lo cual, procedo al retiro de mi unidad de las instalaciones de la empresa en mención.";
  pdf.setFontSize(9.5); pdf.text(pdf.splitTextToSize(statement, width), left, y, { lineHeightFactor: 1.45, align: "justify", maxWidth: width }); y += pdf.getTextDimensions(pdf.splitTextToSize(statement, width)).h * 1.45 + 15;
  const field = (label: string, value: string) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.text(`${label}:`, left, y); pdf.setFont("helvetica", "normal"); pdf.text(value || "No registrado", left + pdf.getTextWidth(`${label}: `), y); y += 7; };
  field("NOMBRES Y APELLIDOS", data.client); field("DNI", data.documentNumber); field("TELÉFONO", data.phone || ""); y += 12;
  field("MODALIDAD", data.modality.replaceAll("_", " ")); field("PLACA", data.plate); field("MARCA", data.brand); field("MODELO", data.model); y += 8;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.text("Con mi firma acepto recibir mi vehículo con las reparaciones concluidas.", left, y);
  const signatureY = y + 42; pdf.setDrawColor(23, 33, 43); pdf.line(72, signatureY, 138, signatureY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("FIRMA DE CONFORMIDAD", 105, signatureY + 5, { align: "center" }); pdf.setFont("helvetica", "normal"); pdf.text(data.client, 105, signatureY + 9, { align: "center" });
  pdf.save(`Acta_de_Conformidad_${data.orderNumber}.pdf`);
}
type FinalControlData = { internalStatus: string; publicStatus: string; labor: Array<{ id: number; description: string; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; quantity: number; verified: boolean }>; pendingParts: Array<{ id: number; description: string; quantity: number; receivedQuantity: number }>; record: null | { completedAt?: string; publishedAt?: string; publicationChannel?: string; publicationNote?: string; deliveredAt?: string; conformityAcknowledgedAt?: string } };
function FinalControlLegacy({ orderId, order, onChanged }: { orderId: number; order: OrderDetailData; onChanged: () => Promise<void> }) {
  const [control, setControl] = useState<FinalControlData>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  const [conformity, setConformity] = useState(false);
  const load = async () => { try { setControl((await api<{ control: FinalControlData }>(`/orders/${orderId}/final-control`)).control); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar el control final."); } };
  useEffect(() => { void load(); }, [orderId]);
  const act = async (path: string, body?: unknown) => { setBusy(true); setMessage(undefined); try { await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }); await load(); await onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible registrar la acción."); } finally { setBusy(false); } };
  const toggle = async (line: FinalControlData["labor"][number]) => { setBusy(true); try { await api(`/orders/${orderId}/final-control/labor/${line.id}`, { method: "PUT", body: JSON.stringify({ verified: !line.verified }) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la verificación."); } finally { setBusy(false); } };
  if (!control) return <div className="empty">{message || "Cargando control final..."}</div>;
  const downloadConformity = () => void downloadConformityPdf({ orderNumber: order.orderNumber, client: order.client, documentNumber: order.documentNumber, phone: order.operationalPhone || order.phone, modality: order.modality, plate: order.plate, brand: order.brand, model: order.model, completedAt: control.record?.completedAt });
  const blockers = [!control.labor.length ? "La cotización aprobada no tiene partidas de mano de obra." : "", control.pendingParts.length ? `${control.pendingParts.length} repuesto(s) aún no se ha(n) recibido.` : "", control.labor.some((line) => !line.verified) ? "Debe verificar todas las partidas de mano de obra." : ""].filter(Boolean);
  const completed = Boolean(control.record?.completedAt);
  const published = control.publicStatus === "LISTA_PARA_ENTREGA";
  const delivered = Boolean(control.record?.deliveredAt);
  const categoryLabels: Record<string, string> = { PLANCHADO: "Planchado", PINTURA: "Pintura", MECANICA: "Mecánica" };
  const laborGroups = control.labor.reduce<Record<string, FinalControlData["labor"]>>((groups, line) => { const category = line.category || "OTROS"; (groups[category] ||= []).push(line); return groups; }, {});
  return <section className="final-control">
    <section className="card final-control-card">
      <header className="control-card-header">
        <h2>Control final obligatorio</h2>
        <div className="control-header-actions"><span className={`status ${completed ? "ready" : "amber"}`}>{delivered ? "Entregada" : completed ? "Completado" : "Pendiente"}</span>{delivered && <button className="btn control-document-action" type="button" onClick={downloadConformity}>Descargar acta PDF</button>}</div>
      </header>
      <div className="card-body">
        {delivered ? <>
          <div className="control-delivered-summary"><strong>Control final completado</strong><span>{control.labor.filter((line) => line.verified).length} de {control.labor.length} partidas verificadas · Orden entregada</span></div>
          <p className="control-delivered-note">La orden fue entregada. Puede descargar el acta de conformidad.</p>
          <details className="control-verified-details"><summary>Ver partidas verificadas <span>{control.labor.length}</span></summary><div className="control-verified-groups">{Object.entries(laborGroups).map(([category, lines]) => <section key={category}><h3>{categoryLabels[category] || "Otras partidas"}<small>{lines.length} verificadas</small></h3><div className="control-labor readonly">{lines.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div></section>)}</div></details>
        </> : <>
          {blockers.length > 0 && !completed && <ul className="control-blockers">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
          {control.labor.length > 0 && <div className="control-labor">{control.labor.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled={busy || completed} onChange={() => void toggle(line)} /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div>}
          <div className="control-actions">{completed ? <button className="btn" disabled={busy || !reason.trim()} onClick={() => void act(`/orders/${orderId}/final-control/reopen`, { reason })}>Reabrir control</button> : <button className="btn primary" disabled={busy || blockers.length > 0} onClick={() => void act(`/orders/${orderId}/final-control/complete`)}>Registrar control final</button>}</div>
          {completed && <label className="control-form">Motivo para reabrir<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Describa el motivo" /></label>}
        </>}
      </div>
    </section>
    {completed && !delivered && <section className="card"><header><h2>Publicación y entrega</h2><span className="status neutral">Público · {control.publicStatus.replaceAll("_", " ")}</span></header><div className="card-body control-form">{!published ? <><label>Canal de aviso (opcional)<input value={channel} onChange={(event) => setChannel(event.target.value)} maxLength={80} placeholder="WhatsApp, llamada..." /></label><label>Nota (opcional)<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label><div className="control-actions"><button className="btn primary" disabled={busy} onClick={() => void act(`/orders/${orderId}/final-control/publish`, { channel, note })}>Publicar lista para entrega</button></div></> : <><p className="hint">Publicada{control.record?.publicationChannel ? ` por ${control.record.publicationChannel}` : ""}{control.record?.publicationNote ? `: ${control.record.publicationNote}` : "."}</p><label className="control-conformity"><input type="checkbox" checked={conformity} onChange={(event) => setConformity(event.target.checked)} />Confirmo la conformidad del cliente al momento de la entrega.</label><div className="control-actions"><button className="btn primary" disabled={busy || !conformity} onClick={() => void act(`/orders/${orderId}/final-control/deliver`, { conformityAcknowledged: true })}>Registrar entrega</button></div></>}</div></section>}
    {message && <p className="hint detail-message">{message}</p>}
  </section>;
}
function FinalControl({ orderId, order, onChanged }: { orderId: number; order: OrderDetailData; onChanged: () => Promise<void> }) {
  const [control, setControl] = useState<FinalControlData>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    try { setControl((await api<{ control: FinalControlData }>(`/orders/${orderId}/final-control`)).control); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar el control final."); }
  };
  useEffect(() => { void load(); }, [orderId]);
  const setAll = async (verified: boolean) => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/labor`, { method: "PUT", body: JSON.stringify({ verified }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar las verificaciones."); }
    finally { setBusy(false); }
  };
  const toggle = async (line: FinalControlData["labor"][number]) => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/labor/${line.id}`, { method: "PUT", body: JSON.stringify({ verified: !line.verified }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la verificación."); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/complete`, { method: "POST" }); await load(); await onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible registrar el control final."); }
    finally { setBusy(false); }
  };
  const verified = control?.labor.filter((line) => line.verified).length ?? 0;
  const allVerified = Boolean(control?.labor.length) && verified === control?.labor.length;
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = verified > 0 && !allVerified; }, [verified, allVerified]);
  if (!control) return <div className="empty">{message || "Cargando control final..."}</div>;
  if (control.record?.completedAt) return <FinalControlLegacy orderId={orderId} order={order} onChanged={onChanged} />;
  const changesBlocked = busy || Boolean(control.record?.deliveredAt);
  const blockers = [!control.labor.length ? "La cotización aprobada no tiene partidas de mano de obra." : "", control.pendingParts.length ? `${control.pendingParts.length} repuesto(s) aún no se ha(n) recibido.` : "", !allVerified && control.labor.length ? "Faltan partidas de mano de obra por verificar." : ""].filter(Boolean);
  return <section className="final-control"><section className="card"><header><h2>Control final obligatorio</h2><span className="status amber">Pendiente</span></header><div className="card-body"><div className="control-progress"><strong>{verified} de {control.labor.length} verificadas</strong><span>{allVerified ? "Lista para el control final" : "Revise cada partida antes de continuar"}</span></div>{blockers.length > 0 && <ul className="control-blockers">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}{control.labor.length > 0 && <div className="control-labor"><label className="control-select-all"><input ref={selectAllRef} type="checkbox" checked={allVerified} disabled={changesBlocked} onChange={(event) => void setAll(event.target.checked)} /><span>Marcar todo</span><small>{verified}/{control.labor.length}</small></label>{control.labor.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled={changesBlocked} onChange={() => void toggle(line)} /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div>}<div className="control-action-bar"><p>{blockers.length ? `${blockers.length} bloqueo(s) pendiente(s)` : "Todas las validaciones están completas."}</p><button className="btn primary" disabled={busy || blockers.length > 0} onClick={() => void complete()}>Registrar control final</button></div>{message && <p className="hint">{message}</p>}</div></section></section>;
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
function PartsOrderWorkbench({ orderId, onRepairStarted }: { orderId?: number; onRepairStarted?: () => Promise<void> }) {
  const [parts, setParts] = useState<ManagedPart[]>(); const [providers, setProviders] = useState<PartProvider[]>([]); const [editing, setEditing] = useState<number>(); const [drafts, setDrafts] = useState<Record<number, Partial<ManagedPart>>>({}); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState<number>();
  const load = async () => { try { const workbench = await api<{ parts: ManagedPart[]; providers: PartProvider[] }>("/orders/parts/workbench"); setProviders(workbench.providers); setParts(orderId ? (await api<{ parts: ManagedPart[] }>(`/orders/${orderId}/parts`)).parts : workbench.parts); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los repuestos."); } };
  useEffect(() => { void load(); }, [orderId]);
  const patch = (part: ManagedPart, value: Partial<ManagedPart>) => setDrafts((current) => ({ ...current, [part.id]: { ...current[part.id], ...value } }));
  const field = <K extends keyof ManagedPart>(part: ManagedPart, key: K) => (drafts[part.id]?.[key] ?? part[key]) as ManagedPart[K];
  const save = async (part: ManagedPart, changes: Partial<ManagedPart> = {}) => { const draft = { ...drafts[part.id], ...changes }; setBusy(part.id); setMessage(undefined); try { await api(`/orders/parts/${part.id}`, { method: "PATCH", body: JSON.stringify({ receivedQuantity: Number(draft.receivedQuantity ?? part.receivedQuantity), partialReceived: false, managementStatus: draft.managementStatus ?? part.managementStatus, quality: draft.quality ?? part.quality, partCode: draft.partCode ?? part.partCode ?? "", expectedDate: String(draft.expectedDate ?? part.expectedDate ?? "").slice(0, 10), providerId: draft.providerId ?? part.providerId ?? null, notes: draft.notes ?? part.notes ?? "" }) }); setDrafts((current) => { const next = { ...current }; delete next[part.id]; return next; }); setEditing(undefined); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar el repuesto."); } finally { setBusy(undefined); } };
  const all = parts || []; const received = all.filter((part) => part.fullyReceived).length; const ordered = all.filter((part) => !part.fullyReceived && part.managementStatus === "PEDIDO").length; const pending = all.length - received;
  const startRepair = async () => { if (!orderId) return; setBusy(-1); try { await api(`/orders/${orderId}/start-repair`, { method: "POST" }); setMessage("Reparación iniciada."); await onRepairStarted?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible iniciar la reparación."); } finally { setBusy(undefined); } };
  const date = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-PE") : "Sin fecha estimada";
  return <section className="parts-optimized parts-individual-workflow"><header className="parts-command"><div><p className="eyebrow">ABASTECIMIENTO DEL CASO</p><h1>{orderId ? "Repuestos aprobados" : "Gestión de repuestos"}</h1><p>{received} de {all.length} recibidos. Cada tarjeta corresponde a un repuesto y su recepción se registra directamente.</p></div>{orderId && <div className="parts-command-action"><strong>{pending ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Todo recibido"}</strong><button className="btn primary" disabled={pending > 0 || busy === -1} onClick={startRepair}>{busy === -1 ? "Iniciando..." : "Iniciar reparación"}</button></div>}</header><div className="parts-summary"><div><small>Por gestionar</small><strong>{all.filter((part) => !part.fullyReceived && part.managementStatus === "POR_GESTIONAR").length}</strong></div><div><small>Pedidos</small><strong>{ordered}</strong></div><div><small>Recibidos</small><strong>{received}</strong></div></div>{message && <p className="hint">{message}</p>}<div className="parts-list">{all.map((part) => { const quality = field(part, "quality") as ManagedPart["quality"]; const providerId = field(part, "providerId"); const selectedProvider = providers.find((provider) => provider.id === Number(providerId)); const providerName = selectedProvider?.name || part.providerName; const providerContact = selectedProvider?.contactName || part.providerContact; const providerPhone = selectedProvider?.phone || part.providerPhone; const providerEmail = selectedProvider?.email || part.providerEmail; const suggestions = providers.filter((provider) => provider.brands.includes(part.brand.toUpperCase()) && provider.qualities.includes(quality)); const isOrdered = part.managementStatus === "PEDIDO"; const isReceived = part.fullyReceived; return <article className={`part-row individual-part${isReceived ? " received" : ""}`} key={part.id}><div className="part-row-state"><span className={`status ${isReceived ? "green" : isOrdered ? "blue" : "amber"}`}>{isReceived ? "En taller" : isOrdered ? "Pedido" : "Por gestionar"}</span><small>{part.quantity} unidad{part.quantity === 1 ? "" : "es"}</small></div><div className="part-row-main"><strong>{part.description}</strong><span>{providerName || "Proveedor pendiente"} · {date(field(part, "expectedDate") as string | undefined)}</span>{isOrdered && !isReceived && <small className="part-ready">Listo para registrar llegada</small>}</div><div className="part-row-actions"><label className="part-quick-receive"><input type="checkbox" checked={isReceived} disabled={!isOrdered || isReceived || busy === part.id} onChange={(event) => { if (event.target.checked) void save(part, { receivedQuantity: part.quantity, managementStatus: "PEDIDO" }); }} /><span>{isReceived ? "Recibido" : "Registrar llegada"}</span></label>{!isReceived && <button className="btn small" disabled={!providerId || busy === part.id || isOrdered} onClick={() => void save(part, { managementStatus: "PEDIDO" })}>{isOrdered ? "Pedido registrado" : "Registrar pedido"}</button>}<button className="btn small" onClick={() => setEditing(editing === part.id ? undefined : part.id)}>{editing === part.id ? "Ocultar detalles" : "Gestionar"}</button></div><div className="part-editor individual-part-editor" hidden={editing !== part.id}><div className="part-editor-heading"><div><strong>{isReceived ? "Datos del repuesto" : "Datos de pedido"}</strong><span>{isReceived ? "Consulte o corrija la información de respaldo del repuesto recibido." : "Asigne proveedor, confirme la fecha estimada y guarde antes de registrar el pedido."}</span></div></div><label>Proveedor<select value={providerId || ""} onChange={(event) => patch(part, { providerId: event.target.value ? Number(event.target.value) : null })}><option value="">Sin proveedor asignado</option>{suggestions.length > 0 && <optgroup label="Sugeridos para este vehículo">{suggestions.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</optgroup>}<optgroup label="Todos los proveedores">{providers.filter((provider) => !suggestions.some((suggested) => suggested.id === provider.id)).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</optgroup></select></label><label>Fecha estimada de llegada<input type="date" value={String(field(part, "expectedDate") || "").slice(0, 10)} onChange={(event) => patch(part, { expectedDate: event.target.value })} /></label><label>Calidad<select value={quality} onChange={(event) => patch(part, { quality: event.target.value as ManagedPart["quality"] })}><option value="ORIGINAL">Original / genuino</option><option value="ALTERNATIVO">Alternativo</option></select></label><label>Código<input value={String(field(part, "partCode") || "")} onChange={(event) => patch(part, { partCode: event.target.value })} /></label>{providerName && <aside className="provider-contact-card"><strong>{providerName}</strong><span>{providerContact || "Sin contacto registrado"}</span>{providerPhone && <a href={`tel:${providerPhone}`}>{providerPhone}</a>}{providerEmail && <a href={`mailto:${providerEmail}`}>{providerEmail}</a>}</aside>}<label className="part-notes">Notas<input value={String(field(part, "notes") || "")} onChange={(event) => patch(part, { notes: event.target.value })} placeholder="Observaciones opcionales" /></label><footer><span>Guarde proveedor, fecha, calidad, código y notas.</span><button className="btn primary" disabled={busy === part.id} onClick={() => void save(part)}>{busy === part.id ? "Guardando..." : "Guardar detalles"}</button></footer></div></article>; })}</div>{!parts && <p className="empty">Cargando repuestos...</p>}{parts && !all.length && <p className="empty">La cotización aprobada no contiene repuestos.</p>}</section>;
}
type QuoteLine = { type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number };
type QuoteVersion = { id: number; versionNumber: number; status: string; currency: "PEN" | "USD"; noParts: boolean; adjustmentReason?: string; createdAt: string; sentAt?: string; approvedAt?: string; totalWithoutIgv: number; lines: QuoteLine[] };
const laborCategories: Array<[QuoteLine["category"], string]> = [["PLANCHADO", "Planchado"], ["PINTURA", "Pintura"], ["MECANICA", "Mecánica"]];
const newQuoteLine = (type: QuoteLine["type"], category?: QuoteLine["category"]): QuoteLine => ({ type, category, description: "", quantity: 1, unitPrice: 0 });
function QuoteTab({ orderId, diagnoses }: { orderId: number; diagnoses: OrderDetailData["attachments"] }) {
  const [quotes, setQuotes] = useState<QuoteVersion[]>(); const [draft, setDraft] = useState<QuoteLine[]>([newQuoteLine("MANO_OBRA", "PLANCHADO"), newQuoteLine("MANO_OBRA", "PINTURA"), newQuoteLine("MANO_OBRA", "MECANICA"), newQuoteLine("REPUESTO")]); const [currency, setCurrency] = useState<"PEN" | "USD">("PEN"); const [noParts, setNoParts] = useState(false); const [adjustmentReason, setAdjustmentReason] = useState(""); const [message, setMessage] = useState<string>(); const [diagnosisOpen, setDiagnosisOpen] = useState(false); const [saving, setSaving] = useState(false);
  const load = async () => { try { setQuotes((await api<{ quotes: QuoteVersion[] }>(`/orders/${orderId}/quotes`)).quotes); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar las cotizaciones."); } };
  useEffect(() => { void load(); }, [orderId]);
  const latest = quotes?.[0]; const isAdjustment = Boolean(latest && latest.status !== "PENDIENTE"); const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value); const updateLine = (index: number, patch: Partial<QuoteLine>) => setDraft((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line)); const addLine = (type: QuoteLine["type"], category?: QuoteLine["category"]) => setDraft((current) => [...current, newQuoteLine(type, category)]); const removeLine = (index: number) => setDraft((current) => current.filter((_, position) => position !== index));
  useEffect(() => { if (!latest) return; setDraft(latest.lines.length ? latest.lines : [newQuoteLine("MANO_OBRA", "PLANCHADO")]); setCurrency(latest.currency); setNoParts(latest.noParts); setAdjustmentReason(""); }, [latest?.id]);
  const toggleNoParts = (checked: boolean) => { if (!checked) { setNoParts(false); return; } if (draft.some((line) => line.type === "REPUESTO") && !window.confirm("Se eliminarán las partidas de repuestos del borrador. ¿Desea continuar?")) return; if (checked) setDraft((current) => current.filter((line) => line.type !== "REPUESTO")); setNoParts(checked); };
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage(undefined); const lines = draft.filter((line) => line.description.trim()); if (!lines.length) { setMessage("Agregue al menos una partida con descripción."); return; } if (isAdjustment && !adjustmentReason.trim()) { setMessage("Indique el motivo del ajuste para crear una nueva versión."); return; } setSaving(true); try { const body = JSON.stringify({ currency, noParts, adjustmentReason: isAdjustment ? adjustmentReason.trim() : undefined, lines }); if (latest?.status === "PENDIENTE") await api(`/orders/${orderId}/quotes/${latest.id}`, { method: "PUT", body }); else await api(`/orders/${orderId}/quotes`, { method: "POST", body }); setAdjustmentReason(""); setMessage(latest?.status === "PENDIENTE" ? "Borrador de cotización guardado." : "Versión de cotización creada."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar la cotización."); } finally { setSaving(false); } };
  const transition = async (quote: QuoteVersion, action: "send" | "approve") => { try { await api(`/orders/${orderId}/quotes/${quote.id}/${action}`, { method: "POST" }); setMessage(action === "send" ? "Cotización enviada para aprobación." : "Cotización aprobada."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la cotización."); } };
  const removeQuote = async (quote: QuoteVersion) => { if (!window.confirm(`¿Eliminar la cotización V${quote.versionNumber}? Esta acción quedará registrada en el historial de modificaciones.`)) return; try { await api(`/orders/${orderId}/quotes/${quote.id}`, { method: "DELETE" }); setMessage(`Cotización V${quote.versionNumber} eliminada y registrada en auditoría.`); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible eliminar la cotización."); } };
  const total = draft.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); const indexed = draft.map((line, index) => ({ line, index }));
  const addAndFocus = (type: QuoteLine["type"], category?: QuoteLine["category"]) => { const nextIndex = draft.length; addLine(type, category); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#quote-line-${nextIndex}`)?.focus()); };
  const onItemKeyDown = (event: import("react").KeyboardEvent<HTMLInputElement>, type: QuoteLine["type"], category?: QuoteLine["category"]) => { if (event.key !== "Enter") return; event.preventDefault(); addAndFocus(type, category); };
  const onQuoteKeyDown = (event: import("react").KeyboardEvent<HTMLFormElement>) => { if (event.key === "Enter") { event.preventDefault(); return; } if (!event.ctrlKey || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; const section = (event.target as HTMLElement).closest<HTMLElement>("[data-quote-category]"); const current = section?.dataset.quoteCategory; const categories = noParts ? ["PLANCHADO", "PINTURA", "MECANICA"] : ["PLANCHADO", "PINTURA", "MECANICA", "REPUESTO"]; const position = categories.indexOf(current || ""); if (position < 0) return; event.preventDefault(); const direction = event.key === "ArrowDown" ? 1 : -1; const next = categories[(position + direction + categories.length) % categories.length]; document.querySelector<HTMLInputElement>(`[data-quote-category="${next}"] input`)?.focus(); };
  const renderLines = (title: string, lines: Array<{ line: QuoteLine; index: number }>, type: QuoteLine["type"], category?: QuoteLine["category"]) => <section className="quote-section" data-quote-category={category || "REPUESTO"}><div className="quote-section-head"><div><h3>{title}</h3><small>{lines.length ? `${lines.length} partida${lines.length === 1 ? "" : "s"} · ${money(lines.reduce((sum, { line }) => sum + line.quantity * line.unitPrice, 0))}` : "Sin partidas"}</small></div><button type="button" className="btn small" onClick={() => addAndFocus(type, category)}>+ Agregar</button></div>{lines.length > 0 && <div className="quote-table"><div className="quote-table-head"><span>Descripción (Enter crea otra fila)</span><span>Cant.</span><span>P. unit.</span><span>Subtotal</span><span /></div>{lines.map(({ line, index }) => <div className="quote-row" key={index}><input id={`quote-line-${index}`} value={line.description} onKeyDown={(event) => onItemKeyDown(event, type, category)} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder={type === "REPUESTO" ? "Escriba y presione Enter" : "Escriba y presione Enter"} /><input type="number" min="0.001" step="0.001" value={line.quantity} onKeyDown={(event) => onItemKeyDown(event, type, category)} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 0 })} /><input type="number" min="0" step="0.01" value={line.unitPrice} onKeyDown={(event) => onItemKeyDown(event, type, category)} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) || 0 })} /><strong>{money(line.quantity * line.unitPrice)}</strong><button type="button" className="quote-remove" onClick={() => removeLine(index)} aria-label={`Eliminar ${line.description || "partida"}`}>×</button></div>)}</div>}</section>;
  return <div className={`quote-workspace${diagnosisOpen ? " diagnosis-open" : ""}`}><form className="card quote-editor quote-builder" onSubmit={submit} onKeyDown={onQuoteKeyDown}><header><div><h2>{latest ? `Cotización V${latest.versionNumber + 1}` : "Nueva cotización"}</h2><small>{latest?.status === "APROBADA" ? "La última versión está aprobada y no admite ajustes." : "Enter agrega una partida; Ctrl + Alt + ↑/↓ cambia de categoría."}</small></div>{latest && <span className={`status ${latest.status === "APROBADA" ? "ready" : latest.status === "ENVIADA" ? "amber" : "neutral"}`}>{latest.status}</span>}</header><div className="card-body">{latest?.status === "APROBADA" ? <p className="hint">No se puede crear una nueva versión después de la aprobación.</p> : <><div className="quote-settings"><label className="quote-check"><span>Este servicio no requiere repuestos</span><input type="checkbox" checked={noParts} onChange={(event) => setNoParts(event.target.checked)} /></label>{diagnoses.length > 0 && <QuoteDiagnosisButton diagnoses={diagnoses} onOpenChange={setDiagnosisOpen} />}<label>Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value as "PEN" | "USD")}><option value="PEN">S/ Soles</option><option value="USD">US$ Dólares</option></select></label>{latest && <label className="quote-reason">Motivo del ajuste<input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={500} required /></label>}</div><h3 className="quote-labor-title">Mano de obra</h3>{laborCategories.map(([category, label]) => renderLines(label, indexed.filter(({ line }) => line.type === "MANO_OBRA" && line.category === category), "MANO_OBRA", category))}{!noParts && renderLines("Repuestos", indexed.filter(({ line }) => line.type === "REPUESTO"), "REPUESTO")}<footer className="quote-total"><div><small>Total sin IGV</small><strong>{money(total)}</strong><span>La presente cotización no contempla IGV.</span></div><button type="submit" className="btn primary">Crear versión</button></footer></>}</div>{message && <p className="hint quote-message">{message}</p>}</form><section className="card quote-overview"><header><div><h2>Historial de versiones</h2><small>{latest ? `Versión vigente: V${latest.versionNumber}` : "Sin versiones registradas"}</small></div></header><div className="card-body quote-history">{quotes === undefined ? <p className="hint">Cargando versiones...</p> : quotes.length === 0 ? <p className="hint">La primera versión aparecerá aquí.</p> : quotes.map((quote) => <article key={quote.id}><div><strong>V{quote.versionNumber} · {quote.status}</strong><span>{new Date(quote.createdAt).toLocaleString()}</span>{quote.adjustmentReason && <small>Ajuste: {quote.adjustmentReason}</small>}</div><div><b>{new Intl.NumberFormat("es-PE", { style: "currency", currency: quote.currency }).format(quote.totalWithoutIgv)}</b><span>{quote.approvedAt ? `Aprobada ${new Date(quote.approvedAt).toLocaleDateString()}` : quote.sentAt ? `Enviada ${new Date(quote.sentAt).toLocaleDateString()}` : "Pendiente"}</span></div>{quote.status === "PENDIENTE" && <div className="quote-actions"><button type="button" className="btn" onClick={() => void transition(quote, "send")}>Marcar enviada</button><button type="button" className="btn danger" onClick={() => void removeQuote(quote)}>Eliminar</button></div>}{quote.status === "ENVIADA" && <div className="quote-actions"><button type="button" className="btn primary" onClick={() => void transition(quote, "approve")}>Marcar aprobada</button></div>}</article>)}</div></section></div>;
}
function QuoteTabImproved({ orderId, diagnoses, onQuotesChanged }: { orderId: number; diagnoses: OrderDetailData["attachments"]; onQuotesChanged: () => void }) {
  const emptyDraft = () => [newQuoteLine("MANO_OBRA", "PLANCHADO"), newQuoteLine("MANO_OBRA", "PINTURA"), newQuoteLine("MANO_OBRA", "MECANICA"), newQuoteLine("REPUESTO")];
  const [quotes, setQuotes] = useState<QuoteVersion[]>(); const [draftId, setDraftId] = useState<number>(); const [draft, setDraft] = useState<QuoteLine[]>(emptyDraft); const [currency, setCurrency] = useState<"PEN" | "USD">("PEN"); const [noParts, setNoParts] = useState(false); const [reason, setReason] = useState(""); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false); const [diagnosisOpen, setDiagnosisOpen] = useState(false); const [dirty, setDirty] = useState(false);
  useEffect(() => { const allowDocumentScroll = (event: WheelEvent) => { if (event.target instanceof HTMLElement && event.target.closest(".diagnosis-reference")) event.stopPropagation(); }; window.addEventListener("wheel", allowDocumentScroll, { capture: true, passive: true }); return () => window.removeEventListener("wheel", allowDocumentScroll, true); }, []);
  const load = async () => { const [quoteResult, draftResult] = await Promise.all([api<{ quotes: QuoteVersion[] }>(`/orders/${orderId}/quotes`), api<{ draft?: { id: number; currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLine[] } }>(`/orders/${orderId}/quote-draft`)]); setQuotes(quoteResult.quotes); const saved = draftResult.draft; setDraftId(saved?.id); setDraft(saved?.lines.length ? saved.lines : emptyDraft()); setCurrency(saved?.currency || "PEN"); setNoParts(saved?.noParts || false); setDirty(false); };
  useEffect(() => { void load().catch((error: Error) => setMessage(error.message)); }, [orderId]);
  useEffect(() => { if (!dirty) return; const confirmExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", confirmExit); return () => window.removeEventListener("beforeunload", confirmExit); }, [dirty]);
  const latest = quotes?.[0]; const versionCount = quotes?.length || 0; const requiresReason = versionCount > 0; const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency" as const, currency }).format(value); const normalizedLines = () => draft.filter((line) => line.description.trim()).map((line) => ({ ...line, description: line.description.trim(), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
  const update = (index: number, patch: Partial<QuoteLine>) => { setDirty(true); setDraft((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line)); }; const add = (type: QuoteLine["type"], category?: QuoteLine["category"]) => { const index = draft.length; setDirty(true); setDraft((current) => [...current, newQuoteLine(type, category)]); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#quote-draft-${index}`)?.focus()); }; const remove = (index: number) => { setDirty(true); setDraft((current) => current.filter((_, position) => position !== index)); };
  const setWithoutParts = (checked: boolean) => { if (checked && draft.some((line) => line.type === "REPUESTO" && line.description.trim())) { if (!window.confirm("Se eliminarán los repuestos del borrador. ¿Desea continuar?")) return; setDraft((current) => current.filter((line) => line.type !== "REPUESTO")); } setDirty(true); setNoParts(checked); };
  const saveDraft = async () => { const lines = normalizedLines(); const omittedLines = draft.length - lines.length; if (!lines.length) { setMessage("Agregue al menos una partida con descripción antes de guardar."); return false; } setBusy(true); try { const result = await api<{ draft: { id: number } }>(`/orders/${orderId}/quote-draft`, { method: "PUT", body: JSON.stringify({ currency, noParts, lines }) }); setDraftId(result.draft.id); setDirty(false); setMessage(`Borrador guardado.${omittedLines ? ` Se omitieron ${omittedLines} fila(s) sin descripción.` : ""}`); return true; } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar el borrador."); return false; } finally { setBusy(false); } };
  const reloadDraft = async () => { if (dirty && !window.confirm("Hay cambios sin guardar. Recargar restaurará la última versión guardada. ¿Desea continuar?")) return; setBusy(true); try { await load(); setMessage(draftId ? "Borrador recargado desde la versión guardada." : "Aún no hay un borrador guardado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible recargar el borrador."); } finally { setBusy(false); } };
  const createVersion = async () => { if (requiresReason && !reason.trim()) { setMessage("Indique el motivo del ajuste para crear la nueva versión."); return; } const saved = await saveDraft(); if (!saved) return; setBusy(true); try { await api(`/orders/${orderId}/quotes/from-draft`, { method: "POST", body: JSON.stringify({ adjustmentReason: requiresReason ? reason.trim() : undefined }) }); setReason(""); await load(); onQuotesChanged(); setMessage(`Versión V${versionCount + 1} creada desde el borrador.`); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible crear la versión."); } finally { setBusy(false); } };
  const action = async (quote: QuoteVersion, actionName: "send" | "approve" | "delete") => { if (actionName === "delete" && !window.confirm(`¿Eliminar V${quote.versionNumber}? La acción quedará auditada.`)) return; setBusy(true); try { await api(`/orders/${orderId}/quotes/${quote.id}${actionName === "delete" ? "" : `/${actionName}`}`, { method: actionName === "delete" ? "DELETE" : "POST" }); await load(); onQuotesChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la cotización."); } finally { setBusy(false); } };
  const categories: Array<[QuoteLine["type"], QuoteLine["category"], string]> = [["MANO_OBRA", "PLANCHADO", "Planchado"], ["MANO_OBRA", "PINTURA", "Pintura"], ["MANO_OBRA", "MECANICA", "Mecánica"], ["REPUESTO", undefined, "Repuestos"]]; const total = draft.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return <div className={`quote-workspace${diagnosisOpen ? " diagnosis-open" : ""}`}><form className="card quote-editor quote-builder" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}><header><div><h2>Borrador de cotización</h2><small>{draftId ? "Edite, guarde el borrador y cree una versión cuando esté listo." : "Guarde el borrador antes de crear la primera versión."}</small></div><span className="status neutral">{draftId ? "BORRADOR GUARDADO" : "NUEVO BORRADOR"}</span></header><div className="card-body"><div className="quote-settings"><label className="quote-check"><span>Este servicio no requiere repuestos</span><input type="checkbox" checked={noParts} onChange={(event) => setWithoutParts(event.target.checked)} /></label>{diagnoses.length > 0 && <QuoteDiagnosisButton diagnoses={diagnoses} onOpenChange={setDiagnosisOpen} />}<label>Moneda<select value={currency} onChange={(event) => { setDirty(true); setCurrency(event.target.value as "PEN" | "USD"); }}><option value="PEN">S/ Soles</option><option value="USD">US$ Dólares</option></select></label><div className={`quote-draft-controls ${dirty ? "dirty" : ""}`}><span>{dirty ? "Cambios sin guardar" : draftId ? "Borrador guardado" : "Sin guardar"}</span><button type="button" className="quote-reload-draft" disabled={busy} onClick={() => void reloadDraft()}><b aria-hidden="true">↻</b> Recargar borrador</button></div>{requiresReason && <label className="quote-reason">Motivo de la nueva versión<input value={reason} onChange={(event) => { setDirty(true); setReason(event.target.value); }} required /></label>}</div><h3 className="quote-labor-title">Mano de obra</h3>{categories.filter(([type]) => type === "MANO_OBRA" || !noParts).map(([type, category, title]) => { const rows = draft.map((line, index) => ({ line, index })).filter(({ line }) => line.type === type && line.category === category); const subtotal = rows.reduce((sum, { line }) => sum + line.quantity * line.unitPrice, 0); return <section className="quote-section" key={title}><div className="quote-section-head"><div><h3>{title}</h3><small>{money(subtotal)}</small></div><button type="button" className="btn small" onClick={() => add(type, category)}>+ Agregar</button></div><div className="quote-table"><div className="quote-table-head"><span>Descripción</span><span>Cant.</span><span>P. unit.</span><span>Subtotal</span><span /></div>{rows.map(({ line, index }) => <div className="quote-row" key={index}><input id={`quote-draft-${index}`} value={line.description} placeholder="Escriba y presione Enter" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(type, category); } }} onChange={(event) => update(index, { description: event.target.value })} /><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) || 0 })} /><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => update(index, { unitPrice: Number(event.target.value) || 0 })} /><strong>{money(line.quantity * line.unitPrice)}</strong><button type="button" className="quote-remove" onClick={() => remove(index)}>×</button></div>)}</div></section>; })}<footer className="quote-total"><div><small>Total sin IGV</small><strong>{money(total)}</strong><span>La presente cotización no contempla IGV.</span></div><div className="quote-draft-actions"><button type="submit" className="btn" disabled={busy}>{busy ? "Guardando..." : "Guardar borrador"}</button><button type="button" className="btn primary" disabled={busy} onClick={() => void createVersion()}>{`Crear versión V${versionCount + 1}`}</button></div></footer></div>{message && <p className="hint quote-message">{message}</p>}</form><section className="card quote-overview"><header><div><h2>Historial de versiones</h2><small>Las versiones creadas son instantáneas auditables.</small></div></header><div className="card-body quote-history">{quotes?.length ? quotes.map((quote) => <article key={quote.id}><div><strong>V{quote.versionNumber} · {quote.status}</strong><span>{new Date(quote.createdAt).toLocaleString()}</span>{quote.adjustmentReason && <small>Motivo: {quote.adjustmentReason}</small>}</div><div><b>{new Intl.NumberFormat("es-PE", { style: "currency", currency: quote.currency }).format(quote.totalWithoutIgv)}</b></div>{quote.status === "PENDIENTE" && <div className="quote-actions"><button type="button" className="btn" disabled={busy} onClick={() => void action(quote, "send")}>Marcar enviada</button><button type="button" className="btn danger" disabled={busy} onClick={() => void action(quote, "delete")}>Eliminar</button></div>}{quote.status === "ENVIADA" && <div className="quote-actions"><button type="button" className="btn primary" disabled={busy} onClick={() => void action(quote, "approve")}>Aprobar</button></div>}</article>) : <p className="hint">Aún no se creó una versión. Guarda el trabajo y crea V1 cuando esté listo.</p>}</div></section></div>;
}
function QuoteExportToolbar({ order, revision }: { order: OrderDetailData; revision: number }) {
  const [quotes, setQuotes] = useState<QuoteVersion[]>();
  const [selected, setSelected] = useState("");
  useEffect(() => { api<{ quotes: QuoteVersion[] }>(`/orders/${order.id}/quotes`).then((result) => { setQuotes(result.quotes); setSelected(String(result.quotes[0]?.id || "")); }).catch(() => setQuotes([])); }, [order.id, revision]);
  const print = (quoteId = selected) => {
    const quote = quotes?.find((item) => item.id === Number(quoteId)); if (!quote) return;
    const escape = (value: string | number | undefined) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
    const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: quote.currency }).format(value);
    const groups: Array<[string, QuoteLine[]]> = [["Planchado", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PLANCHADO")], ["Pintura", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PINTURA")], ["Mecánica", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "MECANICA")], ["Repuestos", quote.lines.filter((line) => line.type === "REPUESTO")]];
    const rows = groups.filter(([, lines]) => lines.length).map(([title, lines]) => `<section class="group"><h2>${title}</h2><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escape(line.description)}</td><td>${line.quantity}</td><td>${money(line.unitPrice)}</td><td>${money(line.quantity * line.unitPrice)}</td></tr>`).join("")}</tbody></table></section>`).join("") || "<p class=\"empty\">No se registraron partidas.</p>";
    const popup = window.open("", "parautos-cotizacion", "width=900,height=700"); if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>Cotización ${escape(order.orderNumber)} V${quote.versionNumber}</title><style>@page{size:A4;margin:11mm 10mm 14mm}*{box-sizing:border-box}body{margin:0;color:#17212b;font:9pt Arial,sans-serif}.doc-head{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:5mm;border-bottom:.5mm solid #ed3337}.doc-head img{width:29mm;height:auto}.doc-head h1{margin:0;font-size:15pt}.doc-head p{margin:1.5mm 0 0;color:#5f6b7a;font-size:8pt}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:2.5mm 8mm;margin:5mm 0}.meta div{padding-bottom:1.4mm;border-bottom:.25mm solid #d8e0e8}.meta b{display:block;margin-bottom:.5mm;color:#5f6b7a;font-size:7pt;text-transform:uppercase}.group{break-inside:avoid;margin-top:4mm}.group h2{margin:0;padding:1.8mm 2.2mm;background:#f7f8fa;border-left:1mm solid #ed3337;font-size:9pt}table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{padding:1.7mm 2mm;border-bottom:.25mm solid #d8e0e8;text-align:left}th{color:#5f6b7a;font-size:7pt;text-transform:uppercase}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.total{display:flex;justify-content:flex-end;gap:7mm;margin-top:5mm;padding:3mm;border-top:.5mm solid #17212b;font-size:10pt}.total strong{font-size:12pt}.notice{margin-top:3mm;padding:2.5mm 3mm;border:1px solid #f4c36b;border-radius:2mm;background:#fff9e8;color:#8a5b08;font-size:8pt}.doc-foot{position:fixed;bottom:0;left:0;right:0;padding-top:2mm;border-top:.25mm solid #d8e0e8;color:#5f6b7a;font-size:7pt}.continuation{display:none}@media print{thead{display:table-header-group}.doc-head{break-inside:avoid}.doc-foot{position:fixed}.continuation{display:block;position:running(continuation)}} </style></head><body><header class="doc-head"><img src="${logo}" alt="PARAUTOS"><div><h1>Cotización formal · V${quote.versionNumber}</h1><p>B & P Service S.A.C. · PARAUTOS · RUC 20560170549 · Av. América Norte N.° 2404, Trujillo</p></div></header><section class="meta"><div><b>Orden</b>${escape(order.orderNumber)}</div><div><b>Fecha</b>${new Date(quote.createdAt).toLocaleDateString("es-PE")}</div><div><b>Cliente</b>${escape(order.client)}</div><div><b>Documento</b>${escape(order.documentType)} ${escape(order.documentNumber)}</div><div><b>Vehículo</b>${escape(`${order.brand} ${order.model} · ${order.color}`)}</div><div><b>Placa / siniestro</b>${escape(order.plate)}${order.claimNumber ? ` · ${escape(order.claimNumber)}` : ""}</div></section>${rows}<section class="total"><span>Total sin IGV</span><strong>${money(quote.totalWithoutIgv)}</strong></section><p class="notice">La presente cotización no contempla IGV.</p><footer class="doc-foot">PARAUTOS · Cotización ${escape(order.orderNumber)} · Placa ${escape(order.plate)}${order.claimNumber ? ` · Siniestro ${escape(order.claimNumber)}` : ""}</footer></body></html>`);
    popup.document.close();
    const documentTitle = popup.document.querySelector(".doc-head h1");
    if (documentTitle) documentTitle.textContent = "Cotización de Servicio";
    const continuation = `PARAUTOS · ${escape(order.orderNumber)} · Placa ${escape(order.plate)}${order.claimNumber ? ` · Siniestro ${escape(order.claimNumber)}` : ""}`;
    popup.document.querySelectorAll("table thead").forEach((head) => {
      const row = popup.document.createElement("tr"); row.className = "quote-continuation";
      const cell = popup.document.createElement("th"); cell.colSpan = 4; cell.textContent = continuation;
      row.append(cell); head.prepend(row);
    });
    const printStyle = popup.document.createElement("style");
    printStyle.textContent = "@page{size:A4;margin:15mm 15mm 15mm 20mm}.quote-continuation{display:none}.group{break-inside:auto!important;margin-top:4mm!important}.group h2{break-after:avoid}table{table-layout:fixed!important}th:first-child,td:first-child{width:52%!important;text-align:left!important}th:nth-child(2),td:nth-child(2){width:14%!important;text-align:right!important}th:nth-child(3),td:nth-child(3){width:18%!important;text-align:right!important}th:nth-child(4),td:nth-child(4){width:16%!important;text-align:right!important}.doc-head{padding-bottom:4mm!important}.doc-head h1{font-size:14pt!important}.doc-foot{padding-bottom:1mm}";
    popup.document.head.append(printStyle);
    popup.focus();
    const logoImage = popup.document.images[0];
    const openPrint = () => setTimeout(() => popup.print(), 100);
    if (logoImage?.complete) openPrint(); else if (logoImage) { logoImage.onload = openPrint; logoImage.onerror = openPrint; } else openPrint();
  };
  const rasterizeLogo = () => new Promise<string>((resolve, reject) => { const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")?.drawImage(image, 0, 0); resolve(canvas.toDataURL("image/png")); }; image.onerror = reject; image.src = logo; });
  const download = async () => {
    const quote = quotes?.find((item) => item.id === Number(selected)); if (!quote) return;
    const { jsPDF, autoTable } = await loadPdfLibrary();
    const pdf = new jsPDF({ unit: "mm", format: "a4" }); const left = 20; const right = 15; const width = 210 - left - right; let y = 16;
    const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: quote.currency }).format(value);
    try { pdf.addImage(await rasterizeLogo(), "PNG", left, y - 5, 29, 18); } catch { pdf.setTextColor(237, 51, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text("PARAUTOS", left, y + 5); }
    pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Cotización de Servicio", 195, y + 1, { align: "right" });
    y += 6; pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(95, 107, 122); pdf.text("B & P Service S.A.C. · PARAUTOS · RUC 20560170549 · Av. América Norte N.° 2404, Trujillo", 195, y, { align: "right" });
    y += 10; pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(.5); pdf.line(left, y, 195, y); y += 7;
    const metadata = [["ORDEN", order.orderNumber, "FECHA", new Date(quote.createdAt).toLocaleDateString("es-PE")], ["CLIENTE", order.client, "DOCUMENTO", `${order.documentType} ${order.documentNumber}`], ["VEHÍCULO", `${order.brand} ${order.model} · ${order.color}`, "PLACA / SINIESTRO", `${order.plate}${order.claimNumber ? ` · ${order.claimNumber}` : ""}`]];
    autoTable(pdf, { startY: y, margin: { left, right }, body: metadata, theme: "plain", styles: { fontSize: 8, cellPadding: 1.3, textColor: [23, 33, 43] }, columnStyles: { 0: { cellWidth: 27, fontStyle: "bold", textColor: [95, 107, 122] }, 1: { cellWidth: 60 }, 2: { cellWidth: 32, fontStyle: "bold", textColor: [95, 107, 122] }, 3: { cellWidth: 56 } }, didDrawCell: (data) => { if (data.row.index < 3) { pdf.setDrawColor(216, 224, 232); pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); } } });
    y = (pdf as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    const groups: Array<[string, QuoteLine[]]> = [["Planchado", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PLANCHADO")], ["Pintura", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PINTURA")], ["Mecánica", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "MECANICA")], ["Repuestos", quote.lines.filter((line) => line.type === "REPUESTO")]];
    groups.filter(([, lines]) => lines.length).forEach(([title, lines]) => { pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(1); pdf.line(left, y, left, y + 8); pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text(title, left + 3, y + 5); y += 9; autoTable(pdf, { startY: y, margin: { left, right, top: 26, bottom: 15 }, head: [["Descripción", "Cant.", "Precio unitario", "Subtotal"]], body: lines.map((line) => [line.description, String(line.quantity), money(line.unitPrice), money(line.quantity * line.unitPrice)]), theme: "plain", styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [23, 33, 43], lineWidth: 0 }, headStyles: { fillColor: [255, 255, 255], textColor: [95, 107, 122], fontStyle: "bold", fontSize: 7.2 }, columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 24 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 } }, didDrawCell: (data) => { pdf.setDrawColor(216, 224, 232); pdf.setLineWidth(.15); pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); }, didDrawPage: (data) => { if (data.pageNumber > 1) { pdf.setFontSize(7); pdf.setTextColor(95, 107, 122); pdf.text(`PARAUTOS · ${order.orderNumber} · Placa ${order.plate}${order.claimNumber ? ` · Siniestro ${order.claimNumber}` : ""}`, left, 16); } } }); y = (pdf as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6; });
    pdf.setDrawColor(23, 33, 43); pdf.line(left, y, 195, y); y += 7; pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(23, 33, 43); pdf.text("Total sin IGV", 164, y, { align: "right" }); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.text(money(quote.totalWithoutIgv), 195, y, { align: "right" }); y += 8;
    pdf.setFillColor(255, 249, 232); pdf.setDrawColor(244, 195, 107); pdf.roundedRect(left, y, width, 8, 1.5, 1.5, "FD"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(138, 91, 8); pdf.text("La presente cotización no contempla IGV.", left + 3, y + 5);
    pdf.save(`Cotizacion_de_Servicio_${order.orderNumber}_V${quote.versionNumber}.pdf`);
  };
  const downloadWorkOrder = async () => {
    const quote = quotes?.find((item) => item.id === Number(selected));
    if (!quote || quote.status !== "APROBADA") return;
    const { jsPDF, autoTable } = await loadPdfLibrary();
    const pdf = new jsPDF({ unit: "mm", format: "a4" }); const left = 20; const right = 15; const bottom = 15; let y = 15;
    try { pdf.addImage(await rasterizeLogo(), "PNG", left, y, 29, 18); } catch { pdf.setTextColor(237, 51, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text("PARAUTOS", left, y + 9); }
    pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("Orden de Trabajo", 195, y + 8, { align: "right" });
    y = 38; pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(.5); pdf.line(left, y, 195, y); y += 7;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(95, 107, 122); pdf.text(`ORDEN ${order.orderNumber} · V${quote.versionNumber}`, left, y);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(23, 33, 43); pdf.text(`Placa: ${order.plate} · Marca: ${order.brand}`, left, y + 5); pdf.text(`Modelo: ${order.model} · Color: ${order.color}`, left, y + 10); y += 17;
    const groups: Array<[string, QuoteLine[]]> = [["Planchado", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PLANCHADO")], ["Pintura", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PINTURA")], ["Mecánica", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "MECANICA")]];
    groups.filter(([, lines]) => lines.length).forEach(([title, lines]) => {
      pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(1); pdf.line(left, y, left, y + 7); pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text(title, left + 3, y + 4.5); y += 8;
      autoTable(pdf, { startY: y, margin: { left, right, top: 26, bottom }, head: [["", "Descripción", "Cant."]], body: lines.map((line) => ["[ ]", line.description, String(line.quantity)]), theme: "plain", styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [23, 33, 43], lineWidth: 0 }, headStyles: { fillColor: [255, 255, 255], textColor: [95, 107, 122], fontStyle: "bold", fontSize: 7.2 }, columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 133 }, 2: { cellWidth: 30, halign: "right" } }, didDrawCell: (data) => { pdf.setDrawColor(216, 224, 232); pdf.setLineWidth(.15); pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); }, didDrawPage: (data) => { if (data.pageNumber > 1) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122); pdf.text(`Orden ${order.orderNumber} · Placa ${order.plate}`, left, 16); } } });
      y = (pdf as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    });
    pdf.save(`Orden_de_Trabajo_${order.orderNumber}_V${quote.versionNumber}.pdf`);
  };
  const downloadExcel = async () => {
    const quote = quotes?.find((item) => item.id === Number(selected)); if (!quote) return;
    const { Workbook } = await import("exceljs"); const workbook = new Workbook(); workbook.creator = "PARAUTOS"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("Cotización", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .79, right: .59, top: .79, bottom: .59, header: .2, footer: .2 } } });
    sheet.views = [{ state: "frozen", ySplit: 8 }]; sheet.columns = [{ width: 52 }, { width: 11 }, { width: 18 }, { width: 18 }];
    sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:D2"); sheet.getCell("A2").value = "COTIZACIÓN DE SERVICIO"; sheet.getCell("A2").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF17212B" } }; sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.mergeCells("A3:D3"); sheet.getCell("A3").value = "B & P Service S.A.C. · RUC 20560170549 · Av. América Norte N.° 2404, Trujillo"; sheet.getCell("A3").font = { name: "Arial", size: 9, color: { argb: "FF5F6B7A" } }; sheet.getCell("A3").alignment = { horizontal: "center" };
    const metadata: Array<[string, string, string, string]> = [["ORDEN", order.orderNumber, "VERSIÓN", `V${quote.versionNumber} · ${quote.status}`], ["CLIENTE", order.client, "DOCUMENTO", `${order.documentType} ${order.documentNumber}`], ["VEHÍCULO", `${order.brand} ${order.model} · ${order.color}`, "PLACA / SINIESTRO", `${order.plate}${order.claimNumber ? ` · ${order.claimNumber}` : ""}`]];
    metadata.forEach((row, index) => { const excelRow = sheet.getRow(index + 5); row.forEach((value, column) => { const cell = excelRow.getCell(column + 1); cell.value = value; cell.font = { name: "Arial", size: 9, bold: column === 0 || column === 2, color: { argb: column === 0 || column === 2 ? "FF5F6B7A" : "FF17212B" } }; cell.border = { bottom: { style: "thin", color: { argb: "FFD8E0E8" } } }; }); });
    let rowNumber = 9; const currencyFormat = quote.currency === "PEN" ? '"S/" #,##0.00' : '"US$" #,##0.00'; const groups: Array<[string, QuoteLine[]]> = [["PLANCHADO", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PLANCHADO")], ["PINTURA", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "PINTURA")], ["MECÁNICA", quote.lines.filter((line) => line.type === "MANO_OBRA" && line.category === "MECANICA")], ["REPUESTOS", quote.lines.filter((line) => line.type === "REPUESTO")]]; const subtotalRows: number[] = [];
    groups.filter(([, lines]) => lines.length).forEach(([title, lines]) => { sheet.mergeCells(`A${rowNumber}:D${rowNumber}`); const titleCell = sheet.getCell(`A${rowNumber}`); titleCell.value = title; titleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF17212B" } }; titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F8FA" } }; titleCell.border = { left: { style: "thick", color: { argb: "FFED3337" } } }; rowNumber += 1; const header = sheet.getRow(rowNumber); ["Descripción", "Cant.", "Precio unitario", "Subtotal"].forEach((value, index) => { const cell = header.getCell(index + 1); cell.value = value; cell.font = { name: "Arial", size: 8, bold: true, color: { argb: "FF5F6B7A" } }; cell.alignment = { horizontal: index === 0 ? "left" : "right" }; cell.border = { bottom: { style: "thin", color: { argb: "FFD8E0E8" } } }; }); rowNumber += 1; lines.forEach((line) => { const row = sheet.getRow(rowNumber); row.values = [line.description, line.quantity, line.unitPrice, { formula: `B${rowNumber}*C${rowNumber}` }]; row.eachCell((cell, column) => { cell.font = { name: "Arial", size: 9, color: { argb: "FF17212B" } }; cell.alignment = { horizontal: column === 1 ? "left" : "right" }; cell.border = { bottom: { style: "thin", color: { argb: "FFD8E0E8" } } }; }); row.getCell(3).numFmt = currencyFormat; row.getCell(4).numFmt = currencyFormat; subtotalRows.push(rowNumber); rowNumber += 1; }); rowNumber += 1; });
    sheet.mergeCells(`A${rowNumber}:C${rowNumber}`); const totalLabel = sheet.getCell(`A${rowNumber}`); totalLabel.value = "TOTAL SIN IGV"; totalLabel.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF17212B" } }; totalLabel.alignment = { horizontal: "right" }; const total = sheet.getCell(`D${rowNumber}`); total.value = { formula: subtotalRows.map((row) => `D${row}`).join("+") || "0" }; total.numFmt = currencyFormat; total.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF17212B" } }; total.border = { top: { style: "medium", color: { argb: "FF17212B" } } }; rowNumber += 2;
    sheet.mergeCells(`A${rowNumber}:D${rowNumber}`); const notice = sheet.getCell(`A${rowNumber}`); notice.value = "La presente cotización no contempla IGV. Modifique las partidas según corresponda; los subtotales y el total se recalculan automáticamente."; notice.font = { name: "Arial", size: 8, color: { argb: "FF8A5B08" } }; notice.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E8" } }; notice.alignment = { wrapText: true }; sheet.getRow(rowNumber).height = 30;
    try { const image = workbook.addImage({ base64: await rasterizeLogo(), extension: "png" }); sheet.addImage(image, { tl: { col: 0, row: 0 }, ext: { width: 126, height: 35 } }); } catch { /* The workbook remains usable if the logo cannot be rasterized. */ }
    const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Cotizacion_de_Servicio_${order.orderNumber}_V${quote.versionNumber}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  };
  const selectedQuote = quotes?.find((quote) => quote.id === Number(selected));
  return <section className="quote-export card"><div><small>Documento formal</small><strong>Exportar versión seleccionada</strong></div><select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!quotes?.length}>{quotes?.map((quote) => <option key={quote.id} value={quote.id}>V{quote.versionNumber} · {quote.status} · {new Intl.NumberFormat("es-PE", { style: "currency", currency: quote.currency }).format(quote.totalWithoutIgv)}</option>)}</select><button className="btn quote-work-order-action" type="button" disabled={selectedQuote?.status !== "APROBADA"} onClick={downloadWorkOrder}>Orden de Trabajo PDF</button><button className="btn quote-excel-action" type="button" disabled={!selected} onClick={downloadExcel}>Descargar Excel</button><button className="btn quote-pdf-action" type="button" disabled={!selected} onClick={download}>Descargar PDF</button></section>;
}
function QuoteDiagnosisButton({ diagnoses, onOpenChange }: { diagnoses: OrderDetailData["attachments"]; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false); const [zoom, setZoom] = useState(1); const [page, setPage] = useState(0); const [pan, setPan] = useState({ x: 0, y: 0 }); const [position, setPosition] = useState<{ x: number; y: number }>(); const [size, setSize] = useState({ width: 365, height: 620 }); const viewer = useRef<HTMLElement>(null);
  const diagnosis = diagnoses[Math.min(page, diagnoses.length - 1)]; const source = `/api/v1/attachments/${diagnosis.id}/content`; const changeOpen = (value: boolean) => { setOpen(value); onOpenChange(value); };
  const trackPointer = (event: import("react").PointerEvent, kind: "move" | "resize" | "resizeWidthLeft" | "pan") => { if (kind === "move" && (event.target as HTMLElement).closest("button")) return; event.preventDefault(); const rect = viewer.current?.getBoundingClientRect(); if (!rect) return; const startX = event.clientX; const startY = event.clientY; const start = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, panX: pan.x, panY: pan.y }; const move = (pointer: PointerEvent) => { if (kind === "move") setPosition({ x: Math.max(8, Math.min(window.innerWidth - 240, start.x + pointer.clientX - startX)), y: Math.max(8, Math.min(window.innerHeight - 100, start.y + pointer.clientY - startY)) }); else if (kind === "pan") setPan({ x: start.panX + pointer.clientX - startX, y: start.panY + pointer.clientY - startY }); else if (kind === "resizeWidthLeft") { const width = Math.max(300, Math.min(window.innerWidth - 16, start.width - (pointer.clientX - startX))); setSize({ width, height: start.height }); setPosition({ x: start.x + start.width - width, y: start.y }); } else setSize({ width: Math.max(300, Math.min(window.innerWidth - 16, start.width + pointer.clientX - startX)), height: Math.max(380, Math.min(window.innerHeight - 16, start.height + pointer.clientY - startY)) }); }; const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); };
  const changePage = (next: number) => { setPage(next); setPan({ x: 0, y: 0 }); setZoom(1); };
  return <><button type="button" className="btn quote-diagnosis-button" onClick={() => changeOpen(true)}>◉ Ver diagnóstico ({diagnoses.length})</button>{open && <aside ref={viewer} className="diagnosis-reference" role="dialog" aria-label="Diagnóstico técnico" onPointerDownCapture={(event) => event.preventDefault()} onWheel={(event) => { event.preventDefault(); window.scrollBy({ top: event.deltaY, left: 0 }); }} style={{ width: size.width, height: size.height, left: position?.x, top: position?.y, right: position ? "auto" : undefined }}><header onPointerDown={(event) => trackPointer(event, "move")}><div><strong>Diagnóstico técnico</strong><small>Referencia visual para cotizar · Página {page + 1} de {diagnoses.length}</small></div><div><button type="button" onClick={() => setZoom((current) => Math.max(.75, current - .25))}>−</button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>100%</button><button type="button" onClick={() => setZoom((current) => Math.min(3, current + .25))}>＋</button><button type="button" onClick={() => changeOpen(false)} aria-label="Cerrar diagnóstico">×</button></div></header><div className="diagnosis-reference-pages"><button type="button" onClick={() => changePage(Math.max(0, page - 1))} disabled={page === 0}>←</button><span>Página {page + 1} de {diagnoses.length}</span><button type="button" onClick={() => changePage(Math.min(diagnoses.length - 1, page + 1))} disabled={page === diagnoses.length - 1}>→</button></div><div className="diagnosis-reference-image" onPointerDown={(event) => trackPointer(event, "pan")}><img src={source} alt={diagnosis.originalName} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} /></div>{diagnoses.length > 1 && <div className="diagnosis-reference-thumbnails">{diagnoses.map((item, index) => <button type="button" className={index === page ? "active" : ""} key={item.id} onClick={() => changePage(index)}><img src={`/api/v1/attachments/${item.id}/content`} alt={`Página ${index + 1}`} /></button>)}</div>}<footer>{diagnosis.originalName} · {Math.ceil(diagnosis.byteSize / 1024)} KB</footer><button type="button" className="diagnosis-reference-resize" onPointerDown={(event) => trackPointer(event, "resize")} aria-label="Cambiar ancho y alto del visor" /><button type="button" className="diagnosis-reference-resize-side" onPointerDown={(event) => trackPointer(event, "resizeWidthLeft")} aria-label="Cambiar ancho del visor" /></aside>}</>;
}
function ReceptionDetail({ order, onRefresh }: { order: OrderDetailData; onRefresh: () => Promise<void> }) {
  const considerations = Array.isArray(order.reception?.considerations) ? order.reception.considerations : [];
  const categories = [...new Set(order.checklist.map((item) => item.category))];
  const diagnoses = order.attachments.filter((attachment) => attachment.category === "EVALUACION_MANUSCRITA");
  const [diagnosisPage, setDiagnosisPage] = useState(0);
  const diagnosis = diagnoses[Math.min(diagnosisPage, Math.max(diagnoses.length - 1, 0))];
  const [diagnosisMessage, setDiagnosisMessage] = useState<string>();
  const downloadChecklist = async () => {
    const { jsPDF, autoTable } = await loadPdfLibrary();
    const pdf = new jsPDF({ unit: "mm", format: "a4" }); const left = 15; const right = 15; let y = 16;
    const drawLogo = () => new Promise<string>((resolve, reject) => { const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")?.drawImage(image, 0, 0); resolve(canvas.toDataURL("image/png")); }; image.onerror = reject; image.src = logo; });
    try { pdf.addImage(await drawLogo(), "PNG", left, 10, 27, 17); } catch { pdf.setTextColor(237, 51, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("PARAUTOS", left, 18); }
    pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Ficha de recepción", 195, 16, { align: "right" }); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(95, 107, 122); pdf.text(`Orden ${order.orderNumber} · Generado ${new Date().toLocaleDateString("es-PE")}`, 195, 21, { align: "right" }); y = 31;
    const metadata = [["CLIENTE", order.client, "DOCUMENTO", `${order.documentType} ${order.documentNumber}`], ["VEHÍCULO", `${order.brand} ${order.model} · ${order.color}`, "PLACA", order.plate], ["SINIESTRO", order.claimNumber || "Pendiente", "KILOMETRAJE", order.reception?.mileage === undefined ? "No registrado" : `${order.reception.mileage} km`], ["COMBUSTIBLE", order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`, "CARROCERÍA", order.bodyName]];
    autoTable(pdf, { startY: y, margin: { left, right }, body: metadata, theme: "plain", styles: { fontSize: 8, cellPadding: 1.4, textColor: [23, 33, 43] }, columnStyles: { 0: { cellWidth: 28, fontStyle: "bold", textColor: [95, 107, 122] }, 1: { cellWidth: 59 }, 2: { cellWidth: 28, fontStyle: "bold", textColor: [95, 107, 122] }, 3: { cellWidth: 55 } }, didDrawCell: (data) => { pdf.setDrawColor(216, 224, 232); pdf.setLineWidth(.15); pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); } });
    y = (pdf as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7; pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(23, 33, 43); pdf.text("Checklist de recepción", left, y); y += 3;
    autoTable(pdf, { startY: y, margin: { left, right, top: 22, bottom: 15 }, head: [["Categoría", "Ítem", "Sí", "No", "Observación"]], body: order.checklist.map((item) => [item.category, item.name, item.answer === "SI" ? "X" : "", item.answer === "NO" ? "X" : "", item.observation || ""]), theme: "plain", styles: { fontSize: 7.2, cellPadding: 1.35, textColor: [23, 33, 43] }, headStyles: { fillColor: [247, 248, 250], textColor: [95, 107, 122], fontStyle: "bold", fontSize: 6.8 }, columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 58 }, 2: { cellWidth: 10, halign: "center" }, 3: { cellWidth: 10, halign: "center" }, 4: { cellWidth: 48 } }, didDrawCell: (data) => { pdf.setDrawColor(216, 224, 232); pdf.setLineWidth(.12); pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); }, didDrawPage: (data) => { if (data.pageNumber > 1) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122); pdf.text(`PARAUTOS · Ficha de recepción · ${order.orderNumber} · ${order.plate}`, left, 15); } } });
    pdf.save(`Checklist_de_Recepcion_${order.orderNumber}.pdf`);
  };
  const uploadDiagnosis = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const uploadForm = event.currentTarget; const files = new FormData(uploadForm).getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setDiagnosisMessage("Seleccione una o más imágenes para continuar."); return; }
    setDiagnosisMessage(`Cargando ${files.length} página${files.length === 1 ? "" : "s"}...`);
    try {
      for (const file of files) { const form = new FormData(); form.append("category", "EVALUACION_MANUSCRITA"); form.append("file", file); const response = await fetch(`/api/v1/attachments/orders/${order.id}`, { method: "POST", credentials: "include", body: form }); if (!response.ok) { const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined; throw new Error(body?.error?.message || "No fue posible cargar el diagnóstico."); } }
      uploadForm.reset(); await onRefresh(); setDiagnosisPage(diagnoses.length); setDiagnosisMessage(`${files.length} página${files.length === 1 ? "" : "s"} cargada${files.length === 1 ? "" : "s"} y recordatorio completado.`);
    } catch (error) { setDiagnosisMessage(error instanceof Error ? error.message : "No fue posible cargar el diagnóstico."); }
  };
  return <div className="reception-screen">
    <div className="reception-workspace">
        <section className="card reception-inventory-card"><header><div><h2>Inventario de recepción</h2><small>{order.checklist.length} ítems verificados al ingreso</small></div><div className="reception-document-actions"><span className="status neutral">Registro cerrado</span><button className="btn small reception-pdf-action" type="button" onClick={() => openReceptionPrint({ modality: order.modality, claimNumber: order.claimNumber, plate: order.plate, documentNumber: order.documentNumber, brand: order.brand, client: order.client, model: order.model, phone: order.phone, year: order.year, color: order.color, vin: order.vin, email: order.email, mileage: order.reception?.mileage, fuelLevel: order.reception?.fuelLevel, considerations, checklist: order.checklist, body: order.bodyCode || order.damages[0]?.body || "V3", damages: order.damages as Array<{ body: string; view: "01" | "02" | "03" | "04" | "05"; path: Array<{ u: number; v: number }> }>, evidenceCount: order.attachments.filter((attachment) => attachment.category === "RECEPCION").length, signature: order.attachments.find((attachment) => attachment.category === "OTRO") ? `/api/v1/attachments/${order.attachments.find((attachment) => attachment.category === "OTRO")?.id}/content` : undefined })}>Abrir checklist A4</button></div></header><div className="reception-inventory">{categories.map((category) => <section key={category}><h3>{category}</h3>{order.checklist.filter((item) => item.category === category).map((item) => <div key={item.name}><span>{item.name}</span><i className={item.answer === "SI" ? "yes" : "no"}>{item.answer}</i>{item.observation && <small>{item.observation}</small>}</div>)}</section>)}</div></section>
      <section className="reception-insights"><article className="card"><header><h2>Consideraciones de ingreso</h2></header><div className="card-body"><p>{considerations.length ? considerations.join(" · ") : "Sin consideraciones registradas."}</p></div></article><article className="card"><header><h2>Condiciones registradas</h2></header><div className="card-body reception-metrics"><DetailField label="Kilometraje" value={order.reception?.mileage === undefined ? "No registrado" : `${order.reception.mileage} km`} /><DetailField label="Combustible" value={order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`} /><DetailField label="Carrocería" value={order.bodyName} /><DetailField label="Daños visibles" value={`${order.damages.length} marcas`} /><DetailField label="Firma" value="Registrada" /><DetailField label="Términos" value={order.reception?.acceptedTerms ? "Aceptados" : "Pendientes"} /></div></article></section>
    </div>
    <aside className="reception-support card diagnosis-card"><header><div><small>Evaluación de recepción</small><h2>Diagnóstico</h2></div>{diagnosis ? <span className="status ready">{diagnoses.length} página{diagnoses.length === 1 ? "" : "s"}</span> : order.diagnosisPending ? <span className="status amber">Pendiente</span> : <span className="status neutral">Sin archivo</span>}</header><div className="card-body"><section className="diagnosis-note"><span>Descripción registrada</span><p>{order.reception?.diagnosis || "No se registró una descripción de diagnóstico."}</p></section><div className="diagnosis-tags"><span>{order.reception?.diagnosisLegibility || "PENDIENTE"}</span><span>{(order.reception?.diagnosisReviewState || "PENDIENTE_REVISION").replaceAll("_", " ")}</span></div>{diagnosis && <><div className="diagnosis-page-nav"><button type="button" onClick={() => setDiagnosisPage((page) => Math.max(0, page - 1))} disabled={diagnosisPage === 0} aria-label="Página anterior">←</button><strong>Página {Math.min(diagnosisPage + 1, diagnoses.length)} de {diagnoses.length}</strong><button type="button" onClick={() => setDiagnosisPage((page) => Math.min(diagnoses.length - 1, page + 1))} disabled={diagnosisPage >= diagnoses.length - 1} aria-label="Página siguiente">→</button></div><a className="diagnosis-preview" href={`/api/v1/attachments/${diagnosis.id}/content`} target="_blank" rel="noreferrer" aria-label="Abrir evaluación a tamaño completo"><img src={`/api/v1/attachments/${diagnosis.id}/content`} alt={diagnosis.originalName} /><i>Ver a tamaño completo</i></a><div className="diagnosis-thumbnails">{diagnoses.map((page, index) => <button type="button" className={index === diagnosisPage ? "active" : ""} key={page.id} onClick={() => setDiagnosisPage(index)} aria-label={`Ver página ${index + 1}`}><img src={`/api/v1/attachments/${page.id}/content`} alt="" /></button>)}</div><div className="diagnosis-file"><span>{diagnosis.originalName}</span><a className="btn" href={`/api/v1/attachments/${diagnosis.id}/content`} download={diagnosis.originalName}>Descargar imagen</a></div></>}<form className="diagnosis-late-upload" onSubmit={uploadDiagnosis}><p className="hint">{diagnosis ? "Agregar más páginas a la evaluación." : order.diagnosisPending ? "El recordatorio se cerrará al cargar el archivo." : "Puede adjuntar la evaluación después de crear la orden."}</p><input name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple /><button className="btn primary">{diagnosis ? "Agregar páginas" : "Cargar evaluación"}</button></form>{diagnosisMessage && <p className="hint">{diagnosisMessage}</p>}</div></aside>
  </div>;
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
                          Si
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
                          No
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
