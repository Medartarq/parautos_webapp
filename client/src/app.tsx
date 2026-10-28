import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
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
import { useQuery } from "@tanstack/react-query";
import { DataScopeContext, useScopedQuery } from "./scoped-query";
import { Pagination, usePagination, type PageInfo } from "./pagination";

const ReportsView = lazy(() => import("./reports-view").then(({ ReportsView }) => ({ default: ReportsView })));
const OrderDetail = lazy(() => import("./order-detail").then(({ OrderDetail }) => ({ default: OrderDetail })));
const AuditView = lazy(() => import("./audit-view").then(({ AuditView }) => ({ default: AuditView })));
const UsersView = lazy(() => import("./users-view").then(({ UsersView }) => ({ default: UsersView })));

type AppState = "loading" | "setup" | "login" | "dashboard";
type Route =
  "dashboard" | "new" | "orders" | "orderDetail" | "quotes" | "parts" | "reports" | "audit" | "users";
type DetailTab = "summary" | "reception" | "quotes" | "parts" | "control" | "history";
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
  diagnosisCount?: number;
  quoteCount?: number;
  diagnosisPending: Omit<OperationalPendingItem, "kind">[];
  quotePending: Omit<OperationalPendingItem, "kind">[];
};
const pendingItems = (notifications: OperationalPendingNotifications): OperationalPendingItem[] => [
  ...notifications.diagnosisPending.map((item) => ({ ...item, kind: "DIAGNOSIS_PENDING" as const })),
  ...notifications.quotePending.map((item) => ({ ...item, kind: "QUOTE_PENDING" as const })),
];
const emptyPendingNotifications: OperationalPendingNotifications = { total: 0, diagnosisPending: [], quotePending: [] };

const syncLabels = { error: "Sin conexión", loading: "Sincronizando", synced: "Sincronizado" };
const roleLabels: Record<CurrentUser["role"], string> = { SUPERADMINISTRADOR: "Superadministrador", ADMINISTRADOR: "Administrador", ASESOR: "Asesor" };
const mobileLabels: Partial<Record<Route, string>> = { dashboard: "Panel", quotes: "Cotiza." };
const orderStatusTones: Record<string, string> = { COTIZACION_PENDIENTE: "red", ESPERA_APROBACION: "amber", ESPERA_REPUESTOS: "blue", EN_REPARACION: "green" };

function getSyncState(isError: boolean, isFetching: boolean) {
  if (isError) return "error";
  return isFetching ? "loading" : "synced";
}

function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Creada hoy";
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

function PlateBadge({ plate, compact = false }: Readonly<{ plate: string; compact?: boolean }>) {
  const normalized = plate.trim().toUpperCase();
  const match = /^([A-Z]{1,3})[- ]?([A-Z0-9]{2,4})$/.exec(normalized);
  const prefix = match?.[1] || normalized.slice(0, 3);
  const suffix = match?.[2] || normalized.slice(3) || "—";
  return <span className={`plate-badge${compact ? " compact" : ""}`} aria-label={`Placa ${normalized}`} title={`Placa ${normalized}`}><b>{prefix}</b><small>{suffix}</small></span>;
}

function AccessLayout({
  title,
  lead,
  children,
}: Readonly<{
  title: string;
  lead: string;
  children: ReactNode;
}>) {
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

function SetupForm({ onComplete }: Readonly<{ onComplete: () => void }>) {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
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
        <button type="submit" className="btn-submit" disabled={saving}>
          {saving ? "Creando cuenta..." : "Crear administrador"}
        </button>
      </form>
    </AccessLayout>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="form-group">
      <span>{label}</span>
      <div className="field-control">{children}</div>
    </label>
  );
}

function LoginForm({ onLogin }: Readonly<{ onLogin: (user: CurrentUser) => void }>) {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
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
        <button type="submit" className="btn-submit" disabled={saving}>
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

function Dashboard({ user, onLogout }: Readonly<{ user: CurrentUser; onLogout: () => Promise<void> }>) {
  const status = useQuery({
    queryKey: ["session", user.id, "demo-status"],
    queryFn: ({ signal }) => api<{ enabled: boolean; active: boolean }>("/demo/status", { signal }),
    enabled: user.role === "SUPERADMINISTRADOR", staleTime: Infinity, retry: false,
  });
  const demoMode = Boolean(status.data?.enabled && status.data.active);
  const scope = useMemo(() => ({ userId: user.id, mode: demoMode ? "demo" as const : "production" as const }), [user.id, demoMode]);
  if (user.role === "SUPERADMINISTRADOR" && !status.data)
    return <main className="loading-screen">{status.isError ? <div role="alert">No fue posible verificar el modo de trabajo. <button className="btn" onClick={() => void status.refetch()}>Reintentar</button></div> : "Cargando PARAUTOS..."}</main>;
  return <DataScopeContext.Provider value={scope}>
    <DashboardContent key={demoMode ? "demo" : "production"} user={user} onLogout={onLogout} demoMode={demoMode} demoAvailable={Boolean(status.data?.enabled)} />
  </DataScopeContext.Provider>;
}

function DashboardContent({ user, onLogout, demoMode, demoAvailable }: Readonly<{
  user: CurrentUser; onLogout: () => Promise<void>; demoMode: boolean; demoAvailable: boolean;
}>) {
  const [route, setRoute] = useState<Route>("dashboard");
  const [dashboardFilter, setDashboardFilter] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionError, setSessionError] = useState<string>();
  const [sidebarMode, setSidebarMode] = useState<"expanded" | "compact">(
    () => localStorage.getItem("parautos-sidebar-mode") === "compact" ? "compact" : "expanded",
  );

  const notificationsQuery = useScopedQuery<OperationalPendingNotifications>("pending-notifications", "/orders/pending-notifications");
  const operationalPending = notificationsQuery.data ?? emptyPendingNotifications;
  const [reminderOpen, setReminderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number>();
  const [selectedOrderTab, setSelectedOrderTab] = useState<DetailTab>();
  const syncState = getSyncState(notificationsQuery.isError, notificationsQuery.isFetching);
  const [mobileNavHidden, setMobileNavHidden] = useState(false);

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
    setReminderOpen(false);
    changeRoute("orderDetail");
  };
  useEffect(() => {
    localStorage.setItem("parautos-sidebar-mode", sidebarMode);
  }, [sidebarMode]);
  useEffect(() => {
    const notifications = notificationsQuery.data;
    const reminderKey = `parautos-operational-reminder-${demoMode ? "demo" : "production"}-${user.id}`;
    if (notifications && notifications.total > 0 && !sessionStorage.getItem(reminderKey)) {
      sessionStorage.setItem(reminderKey, "shown");
      setReminderOpen(true);
    }
  }, [notificationsQuery.data, demoMode, user.id]);
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
          <span className="sidebar-mode-label">Tamaño del menú</span>
          <fieldset
            className="sidebar-modes"
            aria-label="Modo del menú"
          >
            {(["expanded", "compact"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={sidebarMode === mode ? "active" : ""}
                aria-pressed={sidebarMode === mode}
                onClick={() => setSidebarMode(mode)}
              >
                <b aria-hidden="true">{mode === "expanded" ? "▤" : "▥"}</b>
                <span>{mode === "expanded" ? "Amplio" : "Compacto"}</span>
              </button>
            ))}
          </fieldset>
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
              {syncLabels[syncState]}
            </small>
          </div>
            <div className="top-actions">
              {user.role === "SUPERADMINISTRADOR" && demoAvailable && <button className={`demo-mode-toggle${demoMode ? " active" : ""}`} onClick={() => void toggleDemoMode()}>{demoMode ? "Salir de demo" : "Modo demo"}</button>}
            <NotificationCenter notifications={operationalPending} onOpen={openPending} />
            <ProfileDropdown user={user} onLogout={() => onLogout().catch(() => setSessionError("No fue posible cerrar la sesión. Verifique la conexión e inténtelo nuevamente."))} />
          </div>
        </header>
        <section className="app-content">
          {sessionError && <p className="form-error" role="alert">{sessionError}</p>}
          <DashboardRoute route={route} user={user} demoMode={demoMode} dashboardFilter={dashboardFilter}
            selectedOrderId={selectedOrderId} selectedOrderTab={selectedOrderTab}
            operationalPending={operationalPending} openPending={openPending} changeRoute={changeRoute}
            onMetricFilter={(status) => { setDashboardFilter(status); changeRoute("orders"); }}
            onOpenOrder={(id, tab) => { setSelectedOrderId(id); setSelectedOrderTab(tab); changeRoute("orderDetail"); }} />
        </section>
      </main>
      {demoMode && <output className="demo-mode-banner">Modo demostración · datos ficticios aislados</output>}
      <nav className={`mobile-nav${mobileNavHidden ? " hidden" : ""}`}>
        {allowed.slice(0, 4).map((item) => (
          <button key={item.route} className={route === item.route ? "active" : ""} onClick={() => changeRoute(item.route)}>
            <b>{item.icon}</b><span>{mobileLabels[item.route] ?? item.label}</span>
          </button>
        ))}
      </nav>
      {reminderOpen && <OperationalReminder notifications={operationalPending} onClose={() => setReminderOpen(false)} onView={() => { setReminderOpen(false); changeRoute("dashboard"); }} />}
    </div>
  );
}

function NotificationCenter({ notifications, onOpen }: Readonly<{ notifications: OperationalPendingNotifications; onOpen: (item: OperationalPendingItem) => void }>) {
  const [open, setOpen] = useState(false);
  return <div className="notification-center">
    <button className="bell" title="Pendientes operativos" aria-label={`${notifications.total} pendientes operativos`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <BellIcon />{notifications.total > 0 && <b>{notifications.total > 99 ? "99+" : notifications.total}</b>}
    </button>
    {open && <OperationalNotificationsPanel notifications={notifications} onClose={() => setOpen(false)} onOpen={(item) => { setOpen(false); onOpen(item); }} />}
  </div>;
}

function ProfileDropdown({ user, onLogout }: Readonly<{ user: CurrentUser; onLogout: () => Promise<void> }>) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const initials = user.names.split(" ").slice(0, 2).map((name) => name[0]).join("");
  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector("button")?.focus();
    const onClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);
  return <div className="profile-dropdown" ref={container}>
    <button ref={trigger} className="avatar-btn" aria-label="Perfil de usuario" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="avatar">{initials}</span></button>
    {open && <dialog ref={dialog} open className="profile-menu" aria-label="Perfil de usuario" onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }}>
      <div className="profile-menu-header"><span className="profile-menu-avatar" aria-hidden="true">{initials}</span><div><strong>{user.names}</strong><small>{roleLabels[user.role]}</small></div></div>
      <div className="profile-menu-details"><span>Cuenta activa</span><b>{user.email}</b></div>
      <button className="profile-menu-item" type="button" onClick={() => void onLogout()}>Cerrar sesión <span aria-hidden="true">→</span></button>
    </dialog>}
  </div>;
}

type DashboardRouteProps = Readonly<{
  route: Route;
  user: CurrentUser;
  demoMode: boolean;
  dashboardFilter?: string;
  selectedOrderId?: number;
  selectedOrderTab?: DetailTab;
  operationalPending: OperationalPendingNotifications;
  openPending: (item: OperationalPendingItem) => void;
  changeRoute: (route: Route) => void;
  onMetricFilter: (status: string) => void;
  onOpenOrder: (id: number, tab?: DetailTab) => void;
}>;

function DashboardRoute({ route, user, demoMode, dashboardFilter, selectedOrderId, selectedOrderTab, operationalPending, openPending, changeRoute, onMetricFilter, onOpenOrder }: DashboardRouteProps) {
  switch (route) {
    case "dashboard": return (
      <DashboardHome
        user={user}
        onNew={() => changeRoute("new")}
        onOrders={() => changeRoute("orders")}
        operationalPending={operationalPending}
        onOpenPending={openPending}
        onMetricFilter={onMetricFilter}
      />
    );
    case "new": return (
      <NewOrder key={`${demoMode}:${user.id}`} draftScope={`${demoMode ? "demo" : "production"}:${user.id}`} onCreated={() => changeRoute("orders")} advisorName={user.names} />
    );
    case "orders": return (
      <OrdersView onNew={() => changeRoute("new")} onOpen={(orderId) => onOpenOrder(orderId)} initialStatus={dashboardFilter} />
    );
    case "orderDetail":
      if (!selectedOrderId) return <ModulePlaceholder route={route} />;
      return (
        <Suspense fallback={<div className="empty">Cargando detalle de orden...</div>}><OrderDetail orderId={selectedOrderId} initialTab={selectedOrderTab} onBack={() => changeRoute("orders")} /></Suspense>
      );
    case "parts": return (
      <PartsGlobalWorkbench onOpenOrder={(orderId) => onOpenOrder(orderId, "parts")} />
    );
    case "quotes": return <QuotesView onOpen={(orderId) => onOpenOrder(orderId, "quotes")} />;
    case "audit": return (
      <Suspense fallback={<div className="empty">Cargando auditoría...</div>}><AuditView /></Suspense>
    );
    case "users": return (
      <Suspense fallback={<div className="empty">Cargando usuarios...</div>}><UsersView currentUserId={user.id} /></Suspense>
    );
    case "reports": return (
      <Suspense fallback={<div className="empty">Cargando reportes...</div>}><ReportsView /></Suspense>
    );
  }
}

function OperationalNotificationsPanel({ notifications, onClose, onOpen }: Readonly<{ notifications: OperationalPendingNotifications; onClose: () => void; onOpen: (item: OperationalPendingItem) => void }>) {
  const items = pendingItems(notifications);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    closeButton.current?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  return <dialog open className="notifications-panel" aria-label="Pendientes operativos" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <header><div><strong>Pendientes operativos</strong><small>{notifications.total} por atender</small></div><button ref={closeButton} className="btn small" type="button" onClick={onClose} aria-label="Cerrar pendientes">×</button></header>
    {items.length ? <div className="notifications-list">{items.slice(0, 8).map((item) => <button key={`${item.kind}-${item.id}`} className={`notification-item ${item.kind === "DIAGNOSIS_PENDING" ? "operational-diagnosis" : "operational-quote"}`} onClick={() => onOpen(item)}>
      <strong>{item.kind === "DIAGNOSIS_PENDING" ? "Diagnóstico pendiente de subir" : "Cotización pendiente de crear"}</strong><span>{item.orderNumber} · {item.plate} · {item.client}</span><small>{relativeDate(item.createdAt)}</small>
    </button>)}</div> : <p className="notification-empty">No hay pendientes operativos.</p>}
  </dialog>;
}

function OperationalReminder({ notifications, onClose, onView }: Readonly<{ notifications: OperationalPendingNotifications; onClose: () => void; onView: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const diagnosisCount = notifications.diagnosisCount ?? notifications.diagnosisPending.length;
  const quoteCount = notifications.quoteCount ?? notifications.quotePending.length;
  return <dialog ref={dialog} className="operational-reminder" aria-labelledby="operational-reminder-title" onCancel={onClose}><span className="reminder-icon" aria-hidden="true"><BellIcon /></span><h2 id="operational-reminder-title">Tienes {notifications.total} pendiente{notifications.total === 1 ? "" : "s"} por atender</h2><p>{diagnosisCount} diagnóstico{diagnosisCount === 1 ? "" : "s"} por subir y {quoteCount} cotización{quoteCount === 1 ? "" : "es"} por crear.</p><div><button className="btn" type="button" onClick={onClose}>Continuar trabajando</button><button className="btn primary" type="button" onClick={onView}>Ver pendientes</button></div></dialog>;
}

function DashboardHome({
  user,
  onNew,
  onOrders,
  operationalPending,
  onOpenPending,
  onMetricFilter,
}: Readonly<{
  user: CurrentUser;
  onNew: () => void;
  onOrders: () => void;
  operationalPending: OperationalPendingNotifications;
  onOpenPending: (item: OperationalPendingItem) => void;
  onMetricFilter: (status: string) => void;
}>) {
  const ordersQuery = useScopedQuery<{ orders: OrderRow[]; counts: Record<string, number> }>("orders", "/orders/recent");
  const summaryQuery = useScopedQuery<{ pendingClaims: number }>("navigation-summary", "/orders/navigation-summary");
  const orders = ordersQuery.data?.orders;
  const pendingClaims = summaryQuery.data?.pendingClaims ?? 0;
  const loadError = ordersQuery.isError || summaryQuery.isError;
  const count = (status: string) => ordersQuery.data?.counts?.[status] || 0;
  const statusMeta: Record<string, { label: string; tone: string }> = {
    COTIZACION_PENDIENTE: { label: "Cotización pendiente", tone: "red" },
    ESPERA_APROBACION: { label: "Espera aprobación", tone: "amber" },
    ESPERA_REPUESTOS: { label: "Espera repuestos", tone: "blue" },
    EN_REPARACION: { label: "En reparación", tone: "green" },
    LISTA_PARA_ENTREGA: { label: "Lista para entrega", tone: "ready" },
  };
  const distribution = Object.entries(statusMeta);
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
      {pending.length > 0 && <section className="dashboard-operational-pending card"><header><div><h2>Pendientes operativos</h2><small>Diagnósticos y cotizaciones que requieren atención.</small></div><span className="status amber">{operationalPending.total}</span></header><div>{pending.slice(0, 5).map((item) => <button key={`${item.kind}-${item.id}`} className="dashboard-pending-item" onClick={() => onOpenPending(item)}><span className={item.kind === "DIAGNOSIS_PENDING" ? "operational-diagnosis" : "operational-quote"}>{item.kind === "DIAGNOSIS_PENDING" ? "Diagnóstico pendiente" : "Cotización pendiente"}</span><strong>{item.orderNumber} · {item.plate}</strong><small>{item.client} · {relativeDate(item.createdAt)}</small></button>)}</div></section>}
      <div className="dashboard-columns">
        <section className="card">
          <header>
            <h2>Prioridades del taller</h2>
            <button className="btn small" onClick={onOrders}>Ver todas</button>
          </header>
          {loadError && (
            <div className="empty">No fue posible cargar las prioridades.</div>
          )}
          {!loadError && !orders && <output className="empty">Cargando órdenes...</output>}
          {!loadError && orders && orders.length > 0 && (
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
          )}
          {!loadError && orders?.length === 0 && (
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
}: Readonly<{
  label: string;
  tone: string;
  value: number;
  emptyLabel: string;
  onClick?: () => void;
}>) {
  const content = <><small>{label}</small><strong>{value}</strong><em>{value === 0 ? emptyLabel : "Requiere seguimiento"}</em></>;
  return (
    onClick
      ? <button type="button" className={`card metric ${tone} clickable`} onClick={onClick}>{content}</button>
      : <article className={`card metric ${tone}`}>{content}</article>
  );
}
function ModulePlaceholder({ route }: Readonly<{ route: Route }>) {
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
const quoteLabels: Record<string, string> = { COTIZACION_PENDIENTE: "Por cotizar", ESPERA_APROBACION: "Enviada · espera aprobación" };
const ageLabels: Record<string, string> = { RECENT: "0–2 días", ATTENTION: "3–5 días", OVERDUE: "+5 días" };
const daysOld = (date: string) => Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);


function QuotesView({ onOpen }: Readonly<{ onOpen: (orderId: number) => void }>) {
  const [search, setSearch] = useState(""); const [stage, setStage] = useState(""); const [modality, setModality] = useState(""); const [age, setAge] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const paging = usePagination({ search, status: stage, modality, age, from, to, view: "quotes" });
  const ordersQuery = useScopedQuery<{ orders: OrderRow[]; pagination: PageInfo; counts: Record<string, number>; overdue: number }>("orders", `/orders?${paging.params}`);
  const orders = ordersQuery.data?.orders;
  const loadError = ordersQuery.error?.message;
  const visible = orders ?? [];
  const counts = ordersQuery.data?.counts ?? {};
  const filterChips = [
    stage && `Etapa: ${quoteLabels[stage]}`, modality && `Modalidad: ${modality}`,
    age && `Antigüedad: ${ageLabels[age]}`, from && `Desde: ${from}`, to && `Hasta: ${to}`, search && `Búsqueda: ${search}`,
  ].filter(Boolean);
  const clear = () => { setSearch(""); setStage(""); setModality(""); setAge(""); setFrom(""); setTo(""); };
  return <>
    <div className="page-head"><div><h1>Cotizaciones</h1><p>Priorice cotizaciones por crear y envíos pendientes de aprobación.</p></div></div>
    <div className="quote-inbox-metrics">
      <button className={stage === "" ? "active" : ""} onClick={() => setStage("")}><small>Casos por atender</small><strong>{(counts.COTIZACION_PENDIENTE ?? 0) + (counts.ESPERA_APROBACION ?? 0)}</strong></button>
      <button className={stage === "COTIZACION_PENDIENTE" ? "active amber" : "amber"} onClick={() => setStage("COTIZACION_PENDIENTE")}><small>Por cotizar</small><strong>{counts.COTIZACION_PENDIENTE ?? 0}</strong></button>
      <button className={stage === "ESPERA_APROBACION" ? "active blue" : "blue"} onClick={() => setStage("ESPERA_APROBACION")}><small>En aprobación</small><strong>{counts.ESPERA_APROBACION ?? 0}</strong></button>
      <article><small>Más de 5 días</small><strong>{ordersQuery.data?.overdue ?? 0}</strong></article>
    </div>
    <section className="card quote-inbox">
      <div className="quote-inbox-toolbar">
        <div className="quote-inbox-filter-group">
          <label>Etapa<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Todas las etapas</option><option value="COTIZACION_PENDIENTE">Por cotizar</option><option value="ESPERA_APROBACION">Enviada · espera aprobación</option></select></label>
          <label>Modalidad<select value={modality} onChange={(event) => setModality(event.target.value)}><option value="">Todas las modalidades</option>{["PARTICULAR", "PACIFICO", "MAPFRE", "LA_POSITIVA", "RIMAC", "QUALITAS"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
          <label>Antigüedad<select value={age} onChange={(event) => setAge(event.target.value)}><option value="">Todas</option><option value="RECENT">0–2 días</option><option value="ATTENTION">3–5 días</option><option value="OVERDUE">Más de 5 días</option></select></label>
        </div>
        <div className="quote-inbox-dates"><span>Fecha de creación</span><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
        <label className="quote-inbox-search">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, cliente o vehículo" /></label>
      </div>
      {filterChips.length > 0 && <div className="quote-inbox-resultbar"><div>{filterChips.map((item) => <span key={item}>{item}</span>)}</div><button onClick={clear}>Limpiar filtros</button></div>}
      <Pagination controls={paging} info={ordersQuery.data?.pagination} busy={ordersQuery.isFetching} />
      <QuoteResults orders={orders} visible={visible} loadError={loadError} onOpen={onOpen} />
    </section>
  </>;
}

function QuoteResults({ orders, visible, loadError, onOpen }: Readonly<{ orders?: OrderRow[]; visible: OrderRow[]; loadError?: string; onOpen: (id: number) => void }>) {
  if (!orders) return <div className="empty" role={loadError ? "alert" : "status"}>{loadError || "Cargando cotizaciones..."}</div>;
  if (!visible.length) return <div className="empty">No hay cotizaciones pendientes con estos filtros.</div>;
  return <>
    <div className="quote-inbox-head"><span aria-hidden="true" /><span>Vehículo y caso</span><span>Modalidad</span><span>Estado</span><span>Acción</span></div>
    <div className="quote-inbox-list">{visible.map((order) => <button className="quote-case" key={order.id} onClick={() => onOpen(order.id)}>
      <PlateBadge plate={order.plate} />
      <div className="quote-case-summary"><strong>{order.brand} {order.model}</strong><small>{order.orderNumber} · {order.client} · Hace {daysOld(order.createdAt)} día(s)</small></div>
      <span className="quote-case-modality">{order.modality.replaceAll("_", " ")}</span>
      <b className={`status quote-case-status ${order.status === "COTIZACION_PENDIENTE" ? "amber" : "blue"}`}>{quoteLabels[order.status]}</b>
      <em className="quote-case-action">Abrir cotización →</em>
    </button>)}</div>
  </>;
}
function OrdersView({ onNew, onOpen, initialStatus }: Readonly<{ onNew: () => void; onOpen: (orderId: number) => void; initialStatus?: string }>) {
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "ALL");
  const [modality, setModality] = useState("ALL");
  const [onlyPendingClaim, setOnlyPendingClaim] = useState(false);
  const paging = usePagination({ search: filter, status, modality, pendingClaim: String(onlyPendingClaim) });
  const ordersQuery = useScopedQuery<{ orders: OrderRow[]; pagination: PageInfo; total: number }>("orders", `/orders?${paging.params}`);
  const orders = ordersQuery.data?.orders;
  const loadError = ordersQuery.error?.message;
  const visible = orders ?? [];
  const statuses: Record<string, string> = {
    COTIZACION_PENDIENTE: "Cotización pendiente",
    ESPERA_APROBACION: "Espera aprobación",
    ESPERA_REPUESTOS: "Espera repuestos",
    EN_REPARACION: "En reparación",
    LISTA_PARA_ENTREGA: "Lista para entrega",
    ENTREGADA: "Entregada",
    CANCELADA: "Cancelada",
  };
  const statusTone = (value: string) => orderStatusTones[value] ?? "neutral";
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
            {["PARTICULAR", "PACIFICO", "MAPFRE", "LA_POSITIVA", "RIMAC", "QUALITAS"].map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="order-claim-filter">
          <input type="checkbox" checked={onlyPendingClaim} onChange={(event) => setOnlyPendingClaim(event.target.checked)} />
          {" Siniestro pendiente"}
        </label>
      </div>
      <section className="card order-list">
        <Pagination controls={paging} info={ordersQuery.data?.pagination} busy={ordersQuery.isFetching} />
        {!orders && (
          <div className="empty" role={loadError ? "alert" : "status"}>{loadError || "Cargando órdenes..."}</div>
        )}
        {orders && visible.length === 0 && (
          <div className="empty">No hay coincidencias.</div>
        )}
        {orders && visible.length > 0 && (
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
                {Boolean(order.claimPending) && <small className="claim-pending">Siniestro pendiente</small>}
                <small className="order-open">Ver detalle →</small>
              </div>
            </button>
          ))}</>
        )}
      </section>
    </>
  );
}
type ManagedPart = { id: number; orderId: number; orderNumber: string; plate: string; brand: string; model: string; claimNumber?: string; description: string; quantity: number; receivedQuantity: number; partialReceived: boolean; fullyReceived: boolean; partiallyReceived: boolean; freightRequested: boolean; managementStatus: "POR_GESTIONAR" | "PEDIDO" | "EN_TALLER"; quality: "ORIGINAL" | "ALTERNATIVO"; partCode?: string; expectedDate?: string; providerId?: number | null; providerName?: string; providerContact?: string; providerEmail?: string; providerPhone?: string; notes?: string };
const overdue = (part: ManagedPart) => !part.fullyReceived && Boolean(part.expectedDate) && new Date(`${part.expectedDate}T00:00:00`) < new Date(new Date().toDateString());
function partTone(part: ManagedPart) {
  if (part.fullyReceived) return "green";
  if (overdue(part)) return "red";
  return part.partiallyReceived ? "blue" : "amber";
}
function expectedDateLabel(date?: string) {
  if (!date) return "Sin fecha estimada";
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString("es-PE");
  return `ETA ${formatted}`;
}
function PartsGlobalWorkbench({ onOpenOrder }: Readonly<{ onOpenOrder: (orderId: number) => void }>) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [provider, setProvider] = useState(""); const [urgency, setUrgency] = useState(""); const [quality, setQuality] = useState("");
  const paging = usePagination({ search, status, provider, age: urgency, quality });
  const partsQuery = useScopedQuery<{ parts: ManagedPart[]; pagination: PageInfo; metrics: Record<string, number>; providerOptions: { id: number; name: string }[] }>("orders", `/orders/parts/workbench?${paging.params}`);
  const parts = partsQuery.data?.parts;
  const all = parts ?? [];
  const displayStatus = (part: ManagedPart) => part.fullyReceived ? "RECIBIDO" : part.managementStatus;
  const statusLabel = (part: ManagedPart) => ({ POR_GESTIONAR: "Por gestionar", PEDIDO: "Pedido", EN_TALLER: "En taller", RECIBIDO: "Recibido" }[displayStatus(part)] || displayStatus(part));
   const visible = all;
   const providerOptions = (partsQuery.data?.providerOptions ?? []).map((p) => [String(p.id), p.name]);
   const clearFilters = () => { setSearch(""); setStatus(""); setProvider(""); setUrgency(""); setQuality(""); }; const activeFilters = Boolean(search || status || provider || urgency || quality);
   const metrics = [
    ["Vencidos", partsQuery.data?.metrics.overdue ?? 0, "overdue"],
    ["Pedidos", partsQuery.data?.metrics.ordered ?? 0, "ordered"],
    ["Sin proveedor", partsQuery.data?.metrics.unassigned ?? 0, "unassigned"],
    ["Recibidos", partsQuery.data?.metrics.received ?? 0, "received"],
  ];
  return <section className="global-parts-workbench">
    <header className="page-head"><div><h1>Gestión de repuestos</h1><p>Priorice solicitudes y recepciones de todos los casos.</p></div></header>
    <div className="global-parts-metrics" aria-label="Indicadores de repuestos">{metrics.map(([label, count, tone]) => <article className={`card ${tone}`} key={label as string}><small>{label}</small><strong>{count}</strong></article>)}</div>
    <section className="card global-parts-panel"><div className="global-parts-filters"><div className="global-parts-filter-group"><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="POR_GESTIONAR">Por gestionar</option><option value="PEDIDO">Pedido</option><option value="RECIBIDO">Recibido</option><option value="EN_TALLER">En taller</option></select></label><label>Urgencia<select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="">Todas</option><option value="OVERDUE">Vencido</option><option value="NEXT_3">Próximos 3 días</option><option value="NO_DATE">Sin fecha</option></select></label><label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">Todos</option><option value="NO_PROVIDER">Sin proveedor</option>{providerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Calidad<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="">Todas</option><option value="ORIGINAL">Original</option><option value="ALTERNATIVO">Alternativo</option></select></label></div><label className="global-parts-search">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, siniestro, código, proveedor o repuesto" /></label></div>
      {activeFilters && <div className="global-parts-result"><button onClick={clearFilters}>Limpiar filtros</button></div>}
      <Pagination controls={paging} info={partsQuery.data?.pagination} busy={partsQuery.isFetching} />
      <div className="global-parts-table-wrap"><table className="global-parts-table"><thead><tr><th>Repuesto</th><th>Orden y vehículo</th><th>Estado</th><th>Proveedor / ETA</th><th>Recepción</th><th aria-label="Acciones" /></tr></thead><tbody>{visible.map((part) => <tr key={part.id}><td><strong>{part.description}</strong>{part.partCode && <small>Cód. {part.partCode}</small>}</td><td><strong>{part.orderNumber}</strong><small>{part.plate} · {part.brand} {part.model}</small></td><td><span className={`status ${partTone(part)}`}>{statusLabel(part)}</span></td><td><strong>{part.providerName || "Sin proveedor"}</strong><small>{expectedDateLabel(part.expectedDate)}</small></td><td><strong>{part.receivedQuantity} de {part.quantity}</strong><small>{part.fullyReceived ? "Recepción completa" : "Pendiente de recepción"}</small></td><td><button className="btn small" onClick={() => onOpenOrder(part.orderId)}>Gestionar</button></td></tr>)}</tbody></table></div>
      <div className="global-parts-cards">{visible.map((part) => <article key={part.id}><div><span className={`status ${partTone(part)}`}>{statusLabel(part)}</span><button className="btn small" onClick={() => onOpenOrder(part.orderId)}>Gestionar</button></div><strong>{part.description}</strong><p>{part.orderNumber} · {part.plate}</p><dl><div><dt>Proveedor</dt><dd>{part.providerName || "Sin proveedor"}</dd></div><div><dt>Recepción</dt><dd>{part.receivedQuantity} de {part.quantity}</dd></div>{part.expectedDate && <div><dt>ETA</dt><dd>{new Date(`${part.expectedDate}T00:00:00`).toLocaleDateString("es-PE")}</dd></div>}</dl></article>)}</div>
      {partsQuery.error && <p role="alert">{partsQuery.error.message}</p>}
      {!partsQuery.isFetching && !visible.length && <p className="empty">No hay repuestos que coincidan con los filtros.</p>}
    </section>
  </section>;
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
        api("/auth/logout", { method: "POST" }).then(() => {
          setUser(undefined);
          setState("login");
        })
      }
    />
  );
}
