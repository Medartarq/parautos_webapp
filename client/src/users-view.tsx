import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";

type ManagedUser = { id: number; names: string; username: string; email: string; role: "SUPERADMINISTRADOR" | "ADMINISTRADOR" | "ASESOR"; active: boolean; createdAt: string; deactivatedAt?: string; anonymizedAt?: string; canDelete: boolean; deleteHint: string };
export function UsersView({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<ManagedUser[]>([]); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>(); const [saving, setSaving] = useState(false); const [search, setSearch] = useState(""); const [showPassword, setShowPassword] = useState(false); const [editingUser, setEditingUser] = useState<ManagedUser | null>(null); const [editSaving, setEditSaving] = useState(false);
  const load = async () => { try { setError(undefined); setUsers((await api<{ users: ManagedUser[] }>("/users")).users); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar usuarios."); } };
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setSaving(true); setMessage(undefined); setError(undefined); try { await api("/users", { method: "POST", body: JSON.stringify({ names: form.get("names"), username: form.get("username"), email: form.get("email"), role: form.get("role"), password: form.get("password") }) }); formElement.reset(); setMessage("Usuario creado correctamente."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear el usuario."); } finally { setSaving(false); } };
  const toggle = async (user: ManagedUser) => { const action = user.active ? "desactivar" : "activar"; if (!window.confirm(`¿Confirma ${action} la cuenta de ${user.names}?`)) return; setError(undefined); try { await api(`/users/${user.id}/active`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) }); setMessage(`Cuenta ${user.active ? "desactivada" : "activada"} correctamente.`); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar el usuario."); } };
  const remove = async (user: ManagedUser) => { const action = user.deleteHint === "Anonimizar y retirar acceso" ? "anonimizar y retirar el acceso de" : "eliminar permanentemente a"; if (!window.confirm(`¿Confirma ${action} ${user.names}? Esta acción no se puede deshacer.`)) return; setError(undefined); try { await api(`/users/${user.id}`, { method: "DELETE" }); setMessage(user.deleteHint === "Anonimizar y retirar acceso" ? "Cuenta anonimizada y acceso retirado correctamente." : "Usuario eliminado permanentemente."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible retirar el usuario."); } };
  const openEditModal = (user: ManagedUser) => { setEditingUser(user); setError(undefined); setMessage(undefined); };
  const closeEditModal = () => { setEditingUser(null); setError(undefined); setMessage(undefined); };
  const isEditingSelf = editingUser ? editingUser.id === currentUserId : false;
  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    const names = String(form.get("names") || "").trim();
    const email = String(form.get("email") || "").trim();
    const username = String(form.get("username") || "").trim();
    const newPassword = String(form.get("newPassword") || "").trim();
    const body: Record<string, string | boolean> = {};
    if (names) body.names = names;
    if (email) body.email = email;
    if (username) body.username = username;
    if (newPassword) body.newPassword = newPassword;
    if (!isEditingSelf) {
      const role = String(form.get("role") || "").trim();
      const active = form.get("active") === "on";
      if (role) body.role = role;
      body.active = active;
    }
    if (Object.keys(body).length === 0) { setError("Debe proporcionar al menos un campo para actualizar."); return; }
    setEditSaving(true); setError(undefined); setMessage(undefined);
    try {
      await api(`/users/${editingUser.id}`, { method: "PUT", body: JSON.stringify(body) });
      closeEditModal();
      setMessage("Usuario actualizado correctamente.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar el usuario.");
    } finally {
      setEditSaving(false);
    }
  };
  const visibleUsers = users.filter((user) => `${user.names} ${user.username} ${user.email} ${user.role}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())); const activeCount = users.filter((user) => user.active).length;
  return <><div className="page-head users-page-head"><div><h1>Usuarios</h1><p>Administra accesos operativos y administrativos de PARAUTOS.</p></div><span className="users-count">{activeCount} activo{activeCount === 1 ? "" : "s"} · {users.length} total</span></div><section className="card users-create"><header><div><h2>Crear usuario</h2><p>Las cuentas nuevas quedan activas inmediatamente.</p></div></header><form onSubmit={(event) => void create(event)}><div className="users-form-grid"><label>Nombres y apellidos<input name="names" placeholder="Ej. Ana Pérez" minLength={3} autoComplete="name" required /></label><label>Usuario<input name="username" placeholder="ana.perez" pattern="[a-zA-Z0-9._\-]+" minLength={3} autoComplete="username" required /><small>Solo letras, números, punto, guion y guion bajo.</small></label><label>Correo corporativo<input name="email" type="email" placeholder="ana@empresa.com" autoComplete="email" required /></label><label>Rol<select name="role" defaultValue="ASESOR"><option value="ASESOR">Asesor — gestión operativa</option><option value="ADMINISTRADOR">Administrador — todos los módulos, sin gestión de cuentas</option></select></label><label className="users-password">Contraseña inicial<div><input name="password" type={showPassword ? "text" : "password"} minLength={12} autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Mostrar"}</button></div><small>Mínimo 12 caracteres. Compártala de forma segura.</small></label><aside className="users-access-guide"><strong>Acceso inicial seguro</strong><span>Use una contraseña temporal de al menos 12 caracteres y compártala mediante un canal seguro.</span></aside></div><footer><p>El usuario podrá iniciar sesión al finalizar la creación.</p><button type="submit" className="btn primary" disabled={saving}>{saving ? "Creando usuario..." : "Crear usuario"}</button></footer></form></section>{message && <p className="users-notice success-message" role="status">{message}</p>}{error && <p className="users-notice form-error" role="alert">{error}</p>}<section className="card users-directory"><header><div><h2>Directorio de usuarios</h2><p>Consulta el acceso y estado de cada cuenta.</p></div><label className="users-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, usuario o correo" /></label></header>{visibleUsers.length ? <><div className="users-table-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acciones</span></div><div className="users-list">{visibleUsers.map((user) => { const isCurrentUser = user.id === currentUserId; return <article key={user.id} className={!user.active ? "inactive" : ""}><div className="user-identity"><span className="user-avatar" aria-hidden="true">{user.names.trim().slice(0, 1).toUpperCase()}</span><div><strong>{user.names}</strong><small>@{user.username} · {user.email}</small></div></div><span className={`user-role ${user.role === "SUPERADMINISTRADOR" ? "superadmin" : user.role === "ADMINISTRADOR" ? "admin" : "advisor"}`}>{user.role === "SUPERADMINISTRADOR" ? "Superadmi" : user.role === "ADMINISTRADOR" ? "Administrador" : "Asesor"}</span><div className="user-status"><span className={`user-state ${user.active ? "active" : "inactive"}`}>{user.anonymizedAt ? "Anonimizado" : user.active ? "Activo" : "Inactivo"}</span>{isCurrentUser && <small className="user-current">Cuenta actual</small>}</div><div className="user-actions">{!user.anonymizedAt && <button className="btn user-toggle" onClick={() => void openEditModal(user)}>Editar</button>}{!isCurrentUser && !user.anonymizedAt && <button className="btn user-toggle" onClick={() => void toggle(user)}>{user.active ? "Desactivar" : "Activar"}</button>}{!isCurrentUser && (user.canDelete ? <button className="btn user-delete" onClick={() => void remove(user)}>{user.deleteHint}</button> : !user.anonymizedAt && <button className="btn user-pending-delete" disabled title={user.deleteHint}>{user.deleteHint}</button>)}</div></article>; })}</div></> : <div className="empty">No se encontraron usuarios con esa búsqueda.</div>}</section>
    {editingUser && (
      <div className="modal-overlay" onClick={closeEditModal}>
        <div className="modal-content card" onClick={(event) => event.stopPropagation()}>
          <button className="btn small" type="button" onClick={closeEditModal} style={{ position: "absolute", top: "10px", right: "12px", padding: "4px 8px", fontSize: "12px" }}>×</button>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>Editar Usuario</h3>
          <p style={{ color: "#666", marginBottom: 18 }}>Modifica los datos de <strong>{editingUser.names}</strong> (@{editingUser.username}).</p>
          <form onSubmit={saveEdit} style={{ display: "grid", gap: 12 }}>
            {!isEditingSelf ? (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Nombres y apellidos
                  <input name="names" defaultValue={editingUser.names} minLength={3} maxLength={120} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Nombre de usuario (Username)
                  <input name="username" defaultValue={editingUser.username} minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Correo corporativo
                  <input name="email" type="email" defaultValue={editingUser.email} maxLength={150} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Rol
                  <select name="role" defaultValue={editingUser.role} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }}>
                    <option value="ASESOR">Asesor — gestión operativa</option>
                    <option value="ADMINISTRADOR">Administrador — todos los módulos, sin gestión de cuentas</option>
                    <option value="SUPERADMINISTRADOR">Superadministrador — acceso total y cuentas</option>
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#333" }}>
                  <input type="checkbox" name="active" defaultChecked={editingUser.active} />
                  <span>Cuenta activa (puede iniciar sesión)</span>
                </label>
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #eee" }}>
                  <h4 style={{ marginBottom: 10, fontSize: "0.95rem", color: "#17202b" }}>Restablecer Contraseña</h4>
                  <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 10 }}>
                    Asigna una contraseña temporal. El usuario deberá usarla para iniciar sesión.
                  </p>
                  <input name="newPassword" type="password" placeholder="Nueva contraseña temporal (ej. Parautos2026!)" minLength={12} maxLength={128} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                  <small style={{ color: "#666", fontSize: "0.8rem" }}>Mínimo 12 caracteres. Déjalo vacío para no cambiarla.</small>
                </div>
              </>
            ) : (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Nombres y apellidos
                  <input name="names" defaultValue={editingUser.names} minLength={3} maxLength={120} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Nombre de usuario (Username)
                  <input name="username" defaultValue={editingUser.username} minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#333" }}>
                  Correo corporativo
                  <input name="email" type="email" defaultValue={editingUser.email} maxLength={150} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cfd9e5", borderRadius: 8, font: "inherit" }} />
                </label>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn" onClick={closeEditModal} style={{ minHeight: 38 }}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={editSaving} style={{ minHeight: 38 }}>{editSaving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>;
}
