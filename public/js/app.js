
const API_BASE = "api";

// ============================================
// HELPER DE FETCH AUTENTICADO
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
// ============================================
// GUARDIA DE SESIÓN
// ============================================
// Si no hay sesión válida, redirige a login antes de cargar nada.
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  // Mostrar nombre del usuario en el topbar
  const u = Sesion.getUsuario();
  if (u) {
    window.PitbullMenu?.setUser(u);
    window.PitbullMenu?.applyPermissions();
    const el = document.getElementById("user-nombre");
    if (el) el.textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  }
  // Ocultar formulario si no puede crear productos
  if (
    !Sesion.tienePermiso("productos.crear") &&
    !Sesion.tienePermiso("productos.editar")
  ) {
    const cardForm = document.getElementById("form-producto")?.closest(".card");
    if (cardForm) {
      cardForm.style.display = "none";
    }
  }
  // Configurar botón de logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => Sesion.cerrar(API_BASE));
  }

  // Ahora sí: cargar datos
  cargarCategorias();
  cargarProductos();
})();
const API = `${API_BASE}/productos.php`; // ← con /api/

// ============================================
// HELPERS
// ============================================
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

function fmtMoney(n) {
  return "Bs. " + Number(n || 0).toFixed(2);
}

// ============================================
// REFERENCIAS DEL DOM
// ============================================
const form = $("#form-producto");
const tbody = $("#tabla-productos tbody");
const formTitle = $("#form-title");
const btnCancelar = $("#btn-cancelar");
const inputBuscar = $("#buscar");
const selCategoria = $("#prod-categoria");

let productosCache = [];

// ============================================
// CARGAR CATEGORÍAS
// ============================================
async function cargarCategorias() {
  try {
    const res = await fetch(`${API_BASE}/categorias.php`);
    if (!res.ok) throw new Error("No se pudieron cargar categorías");
    const data = await res.json();
    data.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre;
      selCategoria.appendChild(opt);
    });
  } catch (e) {
    console.warn("Categorías no disponibles:", e.message);
  }
}

// ============================================
// LISTAR PRODUCTOS
// ============================================
async function cargarProductos() {
  try {
    const res = await apiFetch(API);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error al cargar");

    productosCache = Array.isArray(data) ? data : [];
    renderTabla(productosCache);
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="7" class="empty" style="color:var(--rojo)">
            Error al cargar productos: ${escapeHtml(e.message)}
        </td></tr>`;
  }
}

// ============================================
// RENDERIZAR TABLA
// ============================================
function renderTabla(lista) {
  tbody.innerHTML = "";

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Sin productos registrados</td></tr>`;
    return;
  }

  // ============================================
  // ¿QUÉ PUEDE HACER EL USUARIO?
  // ============================================
  const puedeEditar = Sesion.tienePermiso("productos.editar");
  const puedeEliminar = Sesion.tienePermiso("productos.eliminar");

  lista.forEach((p) => {
    const stockClass =
      p.stock <= 0
        ? "badge-rojo"
        : p.stock <= p.stock_minimo
          ? "badge-amarillo"
          : "badge-verde";

    // Construir acciones según permisos
    let acciones = "";
    if (puedeEditar) {
      acciones += `<button class="btn btn-sm btn-edit" data-edit="${p.id}">Editar</button>`;
    }
    if (puedeEliminar) {
      acciones += `<button class="btn btn-sm btn-danger" data-del="${p.id}">Eliminar</button>`;
    }
    if (!acciones) {
      acciones = `<span style="color:#94a3b8;font-size:12px;">— sin permisos —</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${p.id}</td>
            <td><strong>${escapeHtml(p.sku)}</strong></td>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.categoria_nombre || "—")}</td>
            <td>${fmtMoney(p.precio)}</td>
            <td><span class="badge ${stockClass}">${p.stock} ${escapeHtml(p.unidad_medida || "")}</span></td>
            <td>${acciones}</td>
        `;
    tbody.appendChild(tr);
  });
}

// ============================================
// GUARDAR (crear o actualizar)
// ============================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("#prod-id").value;

  const payload = {
    sku: $("#prod-sku").value.trim(),
    nombre: $("#prod-nombre").value.trim(),
    descripcion: $("#prod-descripcion").value.trim(),
    categoria_id: $("#prod-categoria").value,
    unidad_medida: $("#prod-unidad").value,
    costo: parseFloat($("#prod-costo").value) || 0,
    precio: parseFloat($("#prod-precio").value) || 0,
    precio_mayorista: $("#prod-precio-mayorista").value,
    stock: parseInt($("#prod-stock").value) || 0,
    stock_minimo: parseInt($("#prod-stock-minimo").value) || 0,
  };

  const url = id ? `${API}?id=${id}` : API;
  const method = id ? "PUT" : "POST";

  try {
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok)
      throw new Error(data.error || data.detalle || "Error desconocido");

    resetForm();
    await cargarProductos();
  } catch (err) {
    alert("X " + err.message);
  }
});

// ============================================
// EDITAR / ELIMINAR
// ============================================
tbody.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;

  if (editId) {
    try {
      const res = await apiFetch(`${API}?id=${editId}`);
      const prod = await res.json();
      if (!res.ok) throw new Error(prod.error);

      $("#prod-id").value = prod.id;
      $("#prod-sku").value = prod.sku;
      $("#prod-nombre").value = prod.nombre;
      $("#prod-descripcion").value = prod.descripcion || "";
      $("#prod-categoria").value = prod.categoria_id || "";
      $("#prod-unidad").value = prod.unidad_medida || "unidad";
      $("#prod-costo").value = prod.costo;
      $("#prod-precio").value = prod.precio;
      $("#prod-precio-mayorista").value = prod.precio_mayorista || "";
      $("#prod-stock").value = prod.stock;
      $("#prod-stock-minimo").value = prod.stock_minimo;

      formTitle.textContent = " Editar Producto #" + prod.id;
      btnCancelar.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  if (delId) {
    if (
      !confirm(
        `¿Desactivar el producto #${delId}?\n\n(No se borra del historial)`,
      )
    )
      return;
    try {
      const res = await apiFetch(`${API}?id=${delId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargarProductos();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }
});

// ============================================
// BUSCADOR
// ============================================
inputBuscar.addEventListener("input", () => {
  const q = inputBuscar.value.toLowerCase().trim();
  if (!q) {
    renderTabla(productosCache);
    return;
  }
  const filtrados = productosCache.filter(
    (p) =>
      p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q),
  );
  renderTabla(filtrados);
});

// ============================================
// CANCELAR FORMULARIO
// ============================================
btnCancelar.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  $("#prod-id").value = "";
  formTitle.textContent = " Nuevo Producto";
  btnCancelar.hidden = true;
}
if (!Sesion.tienePermiso("usuarios.ver")) {
  const el = $("#nav-usuarios");
  if (el) el.style.display = "none";
}
if (!Sesion.tienePermiso("config.editar")) {
  const el = $("#nav-config");
  if (el) el.style.display = "none";
}
