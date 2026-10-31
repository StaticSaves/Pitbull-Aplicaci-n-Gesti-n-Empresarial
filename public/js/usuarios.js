/**
 * PITBULL Manager v1.0
 * Gestión de usuarios y permisos por rol
 */

const API_BASE = "api";
const API = `${API_BASE}/usuarios.php`;

const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[s],
  );
}

// ============================================
// FETCH AUTENTICADO
// ============================================
async function apiFetch(url, options = {}) {
  const token = Sesion.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    Sesion.limpiar();
    window.location.href = "login.html";
    throw new Error("Sesión expirada");
  }
  return res;
}

let usuariosCache = [];
let usuarioActualId = null;
let usuarioPasswordId = null;
let rolesCache = [];
let catalogoPermisos = [];
let rolSeleccionado = null;

// ============================================
// INICIALIZAR
// ============================================
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  const puedeVerUsuarios = Sesion.tienePermiso("usuarios.ver");
  const puedeGestionarRoles = Sesion.tienePermiso("roles.gestionar");
  const puedeCrearUsuarios = Sesion.tienePermiso("usuarios.crear");
  const puedeEditarUsuarios = Sesion.tienePermiso("usuarios.editar");
  if (!puedeVerUsuarios && !puedeGestionarRoles && !puedeCrearUsuarios && !puedeEditarUsuarios) {
    alert("No tienes permiso para acceder a esta sección");
    window.location.href = "index.html";
    return;
  }

  const u = Sesion.getUsuario();
  inicializarPestanasUsuarios();
  window.PitbullMenu?.setUser(u);
  window.PitbullMenu?.applyPermissions();
  usuarioActualId = u.id;
  $("#user-nombre").textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));

  const formCard = $("#form-usuario").closest(".card");
  formCard.hidden = !puedeCrearUsuarios && !puedeEditarUsuarios;
  if (puedeVerUsuarios) {
    await cargarUsuarios();
  } else {
    $("#tabla-usuarios").closest(".card").hidden = true;
  }
  if (puedeCrearUsuarios || puedeEditarUsuarios) {
    if (!puedeCrearUsuarios) formCard.hidden = true;
    try {
      await cargarRoles();
    } catch (error) {
      alert("Error al cargar los roles: " + error.message);
    }
  }
  if (puedeGestionarRoles) await cargarPermisosRoles();
})();

function inicializarPestanasUsuarios() {
  const tabs = [...document.querySelectorAll("[data-users-tab]")];
  const panels = [...document.querySelectorAll("[data-users-panel]")];
  const visibles = tabs.filter((tab) => {
    const visible = tab.dataset.permission
      .split("|")
      .some((permiso) => Sesion.tienePermiso(permiso));
    tab.hidden = !visible;
    if (tab.dataset.usersTab === "crear" && !Sesion.tienePermiso("usuarios.crear")) {
      tab.textContent = "Editar usuario";
    }
    return visible;
  });

  panels.forEach((panel) => {
    const permisos = {
      crear: "usuarios.crear|usuarios.editar",
      usuarios: "usuarios.ver",
      roles: "roles.gestionar",
    }[panel.dataset.usersPanel];
    panel.hidden = !permisos.split("|").some((permiso) => Sesion.tienePermiso(permiso));
  });

  visibles.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.addEventListener("click", () => seleccionarPestanaUsuarios(tab.dataset.usersTab));
  });
  const pestanaInicial = puedeInicializarUsuarios();
  if (pestanaInicial) seleccionarPestanaUsuarios(pestanaInicial);
}

function puedeInicializarUsuarios() {
  if (Sesion.tienePermiso("usuarios.crear")) return "crear";
  if (Sesion.tienePermiso("usuarios.ver")) return "usuarios";
  if (Sesion.tienePermiso("usuarios.editar")) return "crear";
  return "roles";
}

function seleccionarPestanaUsuarios(nombre) {
  const tabs = [...document.querySelectorAll("[data-users-tab]")];
  const panels = [...document.querySelectorAll("[data-users-panel]")];
  const seleccionada = tabs.find((tab) => tab.dataset.usersTab === nombre && !tab.hidden);
  if (!seleccionada) return;

  tabs.forEach((tab) => {
    const selected = tab === seleccionada;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panels.forEach((panel) => {
    const permissions = {
      crear: "usuarios.crear|usuarios.editar",
      usuarios: "usuarios.ver",
      roles: "roles.gestionar",
    }[panel.dataset.usersPanel];
    panel.hidden = panel.dataset.usersPanel !== nombre ||
      !permissions.split("|").some((permission) => Sesion.tienePermiso(permission));
  });
}

// ============================================
// CARGAR ROLES
// ============================================
async function cargarRoles() {
  const res = await apiFetch(`${API_BASE}/roles.php`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudieron cargar los roles");
  const sel = $("#user-rol");
  data.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.nombre} — ${r.descripcion || ""}`;
    sel.appendChild(opt);
  });
}

async function cargarPermisosRoles() {
  const contenedor = $("#role-permissions");
  try {
    const res = await apiFetch(`${API_BASE}/roles.php?action=permisos`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los permisos");
    rolesCache = data.roles;
    catalogoPermisos = data.permisos;

    const selector = $("#role-selector");
    selector.replaceChildren();
    rolesCache.forEach((rol) => {
      const option = document.createElement("option");
      option.value = rol.id;
      option.textContent = rol.nombre;
      selector.appendChild(option);
    });
    selector.addEventListener("change", () => renderPermisosRol());
    renderPermisosRol();
  } catch (error) {
    contenedor.innerHTML = `<p class="empty" role="alert">Error: ${escapeHtml(error.message)}</p>`;
  }
}

function renderPermisosRol() {
  const selector = $("#role-selector");
  rolSeleccionado = rolesCache.find((rol) => String(rol.id) === selector.value);
  const contenedor = $("#role-permissions");
  if (!rolSeleccionado) {
    contenedor.textContent = "No hay roles disponibles.";
    return;
  }

  const permisosRol = new Set(rolSeleccionado.permisos);
  const grupos = new Map();
  const nombresModulos = {
    inventario: "Inventario",
    ventas: "Ventas",
    pedidos: "Pedidos",
    caja: "Caja",
    finanzas: "Finanzas",
    configuracion: "Administración",
  };
  catalogoPermisos.forEach((permiso) => {
    if (!grupos.has(permiso.modulo)) grupos.set(permiso.modulo, []);
    grupos.get(permiso.modulo).push(permiso);
  });

  contenedor.innerHTML = [...grupos.entries()].map(([modulo, permisos]) => `
    <section class="permission-group" aria-labelledby="permission-group-${escapeHtml(modulo)}">
      <h3 id="permission-group-${escapeHtml(modulo)}">${escapeHtml(nombresModulos[modulo] || modulo)}</h3>
      ${permisos.map((permiso) => {
        const bloqueado =
          permiso.clave === "roles.gestionar" &&
          rolSeleccionado.nombre.toLowerCase() !== "gerente";
        const checked = permiso.clave === "roles.gestionar"
          ? rolSeleccionado.nombre.toLowerCase() === "gerente"
          : permisosRol.has(permiso.clave);
        return `
          <label class="permission-option">
            <input type="checkbox" data-role-permission="${escapeHtml(permiso.clave)}"
              ${checked ? "checked" : ""} ${bloqueado ? "disabled" : ""}>
            <span>${escapeHtml(permiso.descripcion || permiso.clave)}<small>${escapeHtml(permiso.clave)}</small></span>
          </label>`;
      }).join("")}
    </section>
  `).join("");
}

// ============================================
// CARGAR USUARIOS
// ============================================
async function cargarUsuarios() {
  try {
    const res = await apiFetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    usuariosCache = data;
    renderTabla(usuariosCache);
  } catch (e) {
    $("#tabla-usuarios tbody").innerHTML =
      `<tr><td colspan="7" class="empty" style="color:var(--rojo)">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// ============================================
// RENDER TABLA
// ============================================
function renderTabla(lista) {
  const tbody = $("#tabla-usuarios tbody");
  tbody.innerHTML = "";

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Sin usuarios</td></tr>`;
    return;
  }

  const puedoEditar = Sesion.tienePermiso("usuarios.editar");
  const puedoEliminar = Sesion.tienePermiso("usuarios.eliminar");

  lista.forEach((u) => {
    const estadoBadge =
      u.activo == 1
        ? '<span class="badge badge-verde">Activo</span>'
        : '<span class="badge badge-rojo">Inactivo</span>';

    let acciones = "";
    if (puedoEditar) {
      acciones += `<button class="btn btn-sm btn-edit" data-action="edit" data-id="${u.id}">Editar</button>`;
      acciones += `<button class="btn btn-sm btn-edit" data-action="pass" data-id="${u.id}" title="Cambiar contraseña">Cambiar clave</button>`;
    }
    if (puedoEliminar && u.id != usuarioActualId) {
      if (u.activo == 1) {
        acciones += `<button class="btn btn-sm btn-danger" data-action="del" data-id="${u.id}">Desactivar</button>`;
      } else {
        acciones += `<button class="btn btn-sm btn-primary" data-action="reac" data-id="${u.id}">Reactivar</button>`;
      }
    }
    if (!acciones)
      acciones = `<span style="color:#94a3b8;font-size:12px;">—</span>`;

    const tr = document.createElement("tr");
    if (u.activo == 0) tr.style.opacity = "0.55";
    tr.innerHTML = `
            <td>${u.id}</td>
            <td>${escapeHtml(u.cedula || "—")}</td>
            <td>${escapeHtml(u.nombre_completo)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge badge-azul">${escapeHtml(u.rol_nombre)}</span></td>
            <td>${estadoBadge}</td>
            <td>${acciones}</td>
        `;
    tbody.appendChild(tr);
  });
}

// ============================================
// GUARDAR (crear o editar)
// ============================================
$("#form-usuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#user-id").value;
  if (!id && !Sesion.tienePermiso("usuarios.crear")) {
    alert("No tienes permiso para crear usuarios");
    return;
  }
  if (id && !Sesion.tienePermiso("usuarios.editar")) {
    alert("No tienes permiso para editar usuarios");
    return;
  }

  const payload = {
    cedula: $("#user-cedula").value.trim(),
    nombre_completo: $("#user-nombre-completo").value.trim(),
    email: $("#user-email").value.trim(),
    telefono: $("#user-telefono").value.trim(),
    rol_id: $("#user-rol").value,
  };

  if (!id) {
    payload.password = $("#user-password").value;
  }

  const url = id ? `${API}?id=${id}` : API;
  const method = id ? "PUT" : "POST";

  try {
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");

    resetForm();
    if (Sesion.tienePermiso("usuarios.ver")) await cargarUsuarios();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// ============================================
// ACCIONES DE LA TABLA
// ============================================
$("#tabla-usuarios").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  console.log("[Tabla] action:", action, "id:", id);

  // ---------------- EDITAR ----------------
  if (action === "edit") {
    const u = usuariosCache.find((x) => String(x.id) === String(id));
    if (!u) {
      alert("Usuario no encontrado en cache");
      return;
    }
    $("#user-id").value = u.id;
    $("#form-usuario").closest(".card").hidden = false;
    $("#user-cedula").value = u.cedula || "";
    $("#user-nombre-completo").value = u.nombre_completo;
    $("#user-email").value = u.email;
    $("#user-telefono").value = u.telefono || "";
    $("#user-rol").value = u.rol_id;

    $("#label-password").style.display = "none";
    $("#user-password").required = false;

    $("#form-title").textContent = `Editar usuario #${u.id}`;
    $("#btn-cancelar").hidden = false;
    seleccionarPestanaUsuarios("crear");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // ---------------- DESACTIVAR ----------------
  if (action === "del") {
    if (!confirm(`¿Desactivar al usuario #${id}?`)) return;
    try {
      const res = await apiFetch(`${API}?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargarUsuarios();
    } catch (err) {
      alert("Error: " + err.message);
    }
    return;
  }

  // ---------------- REACTIVAR ----------------
  if (action === "reac") {
    try {
      const res = await apiFetch(`${API}?action=reactivar&id=${id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargarUsuarios();
    } catch (err) {
      alert("Error: " + err.message);
    }
    return;
  }

  // ---------------- CAMBIAR CONTRASEÑA ----------------
  if (action === "pass") {
    const user = usuariosCache.find((x) => String(x.id) === String(id));
    if (!user) {
      alert("Usuario no encontrado en cache");
      return;
    }

    usuarioPasswordId = user.id;

    const inputHidden = $("#modal-user-id");
    if (inputHidden) inputHidden.value = user.id;

    $("#modal-user-nombre").textContent = user.nombre_completo;
    $("#modal-password-nueva").value = "";
    $("#modal-password-confirmar").value = "";
    $("#modal-password").hidden = false;

    console.log("[Modal] Abriendo para usuario id:", usuarioPasswordId);

    setTimeout(() => $("#modal-password-nueva").focus(), 100);
    return;
  }
});

// ============================================
// CANCELAR FORMULARIO
// ============================================
$("#btn-cancelar").addEventListener("click", resetForm);

function resetForm() {
  $("#form-usuario").reset();
  $("#user-id").value = "";
  $("#form-title").textContent = " Nuevo Usuario";
  $("#btn-cancelar").hidden = true;
  $("#label-password").style.display = "block";
  $("#user-password").required = true;
  if (!Sesion.tienePermiso("usuarios.crear")) {
    $("#form-usuario").closest(".card").hidden = true;
    seleccionarPestanaUsuarios("usuarios");
  }
}

// ============================================
// MODAL DE CONTRASEÑA
$("#btn-cerrar-modal").addEventListener("click", () => {
  $("#modal-password").hidden = true;
  usuarioPasswordId = null;
});

$("#form-password").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = usuarioPasswordId;

  console.log("[Modal submit] id:", id);

  if (!id) {
    alert(
      "Error: no se seleccionó ningún usuario. Cierra el modal e intenta de nuevo.",
    );
    return;
  }

  const p1 = $("#modal-password-nueva").value;
  const p2 = $("#modal-password-confirmar").value;

  if (p1 !== p2) {
    alert("Las contraseñas no coinciden");
    return;
  }
  if (p1.length < 6) {
    alert("Mínimo 6 caracteres");
    return;
  }

  try {
    const url = `${API}?id=${id}&action=cambiar_password`;
    console.log("[Modal submit] PUT", url);

    const res = await apiFetch(url, {
      method: "PUT",
      body: JSON.stringify({ password_nueva: p1 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cambiar contraseña");

    $("#modal-password").hidden = true;
    usuarioPasswordId = null;
    alert(" Contraseña actualizada");
  } catch (err) {
    alert(" " + err.message);
  }
});

// ============================================
// BUSCADOR
// ============================================
$("#buscar").addEventListener("input", () => {
  const q = $("#buscar").value.toLowerCase().trim();
  if (!q) return renderTabla(usuariosCache);
  const filtrados = usuariosCache.filter(
    (u) =>
      (u.nombre_completo || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.cedula || "").toLowerCase().includes(q) ||
      (u.rol_nombre || "").toLowerCase().includes(q),
  );
  renderTabla(filtrados);
});

$("#btn-guardar-permisos").addEventListener("click", async () => {
  if (!rolSeleccionado) return;
  const btn = $("#btn-guardar-permisos");
  const mensaje = $("#msg-permisos");
  const permisos = [...document.querySelectorAll("[data-role-permission]:checked")]
    .map((input) => input.dataset.rolePermission);
  btn.disabled = true;
  mensaje.hidden = true;

  try {
    const res = await apiFetch(`${API_BASE}/roles.php?id=${rolSeleccionado.id}`, {
      method: "PUT",
      body: JSON.stringify({ permisos }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron guardar los permisos");
    mensaje.textContent = "Permisos actualizados. La pantalla se actualizará.";
    mensaje.hidden = false;
    await Sesion.verificarConServidor(API_BASE);
    window.location.reload();
  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    btn.disabled = false;
  }
});
