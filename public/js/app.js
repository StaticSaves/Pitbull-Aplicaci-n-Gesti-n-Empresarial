
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

  const puedeVerCatalogo = Sesion.tienePermiso("productos.ver");
  const puedeRegistrarMovimientos =
    Sesion.tienePermiso("stock.merma") || Sesion.tienePermiso("stock.entrada");
  if (!puedeVerCatalogo && !puedeRegistrarMovimientos) {
    alert("No tienes permiso para acceder a la sección de productos");
    window.location.href = "index.html";
    return;
  }

  // Mostrar nombre del usuario en el topbar
  const u = Sesion.getUsuario();
  if (u) {
    window.PitbullMenu?.setUser(u);
    window.PitbullMenu?.applyPermissions();
    inicializarPestanasProductos();
    const el = document.getElementById("user-nombre");
    if (el) el.textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  }
  // Ocultar formulario si no puede crear productos
  const cardForm = document.getElementById("form-producto")?.closest(".card");
  if (cardForm) {
    cardForm.hidden =
      !Sesion.tienePermiso("productos.crear") &&
      !Sesion.tienePermiso("productos.editar");
    if (!Sesion.tienePermiso("productos.ver_costos")) {
      document.getElementById("label-prod-costo").hidden = true;
    }
    if (!Sesion.tienePermiso("productos.crear")) cardForm.hidden = true;
  }
  document.getElementById("product-edit-hint").hidden =
    !Sesion.tienePermiso("productos.editar") || Sesion.tienePermiso("productos.crear");
  document.querySelectorAll("#mov-prod-tipo option[data-permission]").forEach((option) => {
    option.hidden = !Sesion.tienePermiso(option.dataset.permission);
  });
  const primerMovimientoPermitido = document.querySelector(
    "#mov-prod-tipo option[data-permission]:not([hidden])",
  );
  if (primerMovimientoPermitido) {
    document.getElementById("mov-prod-tipo").value = primerMovimientoPermitido.value;
  }
  // Configurar botón de logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => Sesion.cerrar(API_BASE));
  }

  // Ahora sí: cargar datos
  if (puedeVerCatalogo || Sesion.tienePermiso("productos.crear") || Sesion.tienePermiso("productos.editar")) {
    cargarCategorias();
  }
  if (puedeVerCatalogo || puedeRegistrarMovimientos) cargarProductos();
})();

function inicializarPestanasProductos() {
  const tabs = [...document.querySelectorAll("[data-product-tab]")];
  const panels = [...document.querySelectorAll("[data-product-panel]")];
  const visibles = tabs.filter((tab) => {
    const visible = tab.dataset.permission.split("|").some((permiso) => Sesion.tienePermiso(permiso));
    tab.hidden = !visible;
    return visible;
  });

  function seleccionarTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.productPanel !== tab.dataset.productTab;
    });
  }

  visibles.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.addEventListener("click", () => seleccionarTab(tab));
  });
  if (visibles[0]) seleccionarTab(visibles[0]);
  window.PitbullProductTabs = { seleccionarTab: (name) => {
    const tab = visibles.find((item) => item.dataset.productTab === name);
    if (tab) seleccionarTab(tab);
  }};
}

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
let productosVisibles = [];

if (!Sesion.tienePermiso("productos.ver")) {
  $("#btn-exportar-productos-excel").hidden = true;
  $("#btn-exportar-productos-pdf").hidden = true;
}

$("#btn-exportar-productos-excel").addEventListener("click", exportarProductosExcel);
$("#btn-exportar-productos-pdf").addEventListener("click", exportarProductosPdf);

$("#form-movimiento-producto").addEventListener("submit", async (event) => {
  event.preventDefault();
  const tipo = $("#mov-prod-tipo").value;
  const cantidad = Number($("#mov-prod-cantidad").value);
  if (!Number.isInteger(cantidad) || cantidad === 0 || (tipo !== "ajuste_stock" && cantidad < 0)) {
    alert(tipo === "ajuste_stock"
      ? "Indica una cantidad entera distinta de cero."
      : "La cantidad debe ser un número entero mayor que cero.");
    return;
  }

  try {
    const response = await apiFetch(`${API_BASE}/movimientos_producto.php`, {
      method: "POST",
      body: JSON.stringify({
        tipo,
        producto_id: $("#mov-prod-producto").value,
        cantidad,
        motivo: $("#mov-prod-motivo").value.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo registrar el movimiento");
    $("#mov-prod-msg").textContent =
      `${data.mensaje}. Nuevo stock: ${data.stock_nuevo}. Impacto estimado: ${fmtMoney(data.impacto)}.`;
    $("#mov-prod-msg").hidden = false;
    $("#form-movimiento-producto").reset();
    await cargarProductos();
  } catch (error) {
    alert("Error: " + error.message);
  }
});

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
    const selectMovimiento = document.getElementById("mov-prod-producto");
    selectMovimiento.replaceChildren(new Option("— Seleccionar —", ""));
    productosCache.forEach((product) => {
      selectMovimiento.add(new Option(`${product.sku} — ${product.nombre}`, product.id));
    });
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
  productosVisibles = lista;
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

function csvValue(value) {
  const text = String(value ?? "");
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function exportarProductosExcel() {
  if (!Sesion.tienePermiso("productos.ver")) return;
  const headers = [
    "SKU",
    "Producto",
    "Categoría",
    "Precio de venta (Bs.)",
    "Precio mayorista (Bs.)",
    "Existencias",
    "Unidad",
  ];
  const rows = productosVisibles.map((product) => [
    product.sku,
    product.nombre,
    product.categoria_nombre || "",
    Number(product.precio || 0).toFixed(2),
    product.precio_mayorista == null ? "" : Number(product.precio_mayorista).toFixed(2),
    Number(product.stock || 0),
    product.unidad_medida || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvValue).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarProductosPdf() {
  if (!Sesion.tienePermiso("productos.ver")) return;
  const ventana = window.open("", "_blank");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para exportar a PDF.");
    return;
  }

  const filas = productosVisibles.map((product) => `
    <tr>
      <td>${escapeHtml(product.sku)}</td>
      <td>${escapeHtml(product.nombre)}</td>
      <td>${escapeHtml(product.categoria_nombre || "—")}</td>
      <td class="number">${fmtMoney(product.precio)}</td>
      <td class="number">${product.precio_mayorista == null ? "—" : fmtMoney(product.precio_mayorista)}</td>
      <td class="number">${Number(product.stock || 0)} ${escapeHtml(product.unidad_medida || "")}</td>
    </tr>
  `).join("");
  ventana.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Inventario de productos</title>
        <style>
          body { font: 12px Arial, sans-serif; color: #172033; margin: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { color: #596579; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
          th { background: #eef2f7; }
          .number { text-align: right; white-space: nowrap; }
          @media print { body { margin: 10mm; } tr { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>Inventario de productos</h1>
        <p>Generado: ${escapeHtml(new Date().toLocaleString("es-VE"))} · Productos: ${productosVisibles.length}</p>
        <table>
          <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Precio venta</th><th>Precio mayorista</th><th>Existencias</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="6">Sin productos para exportar</td></tr>'}</tbody>
        </table>
        <script>window.addEventListener("load", () => { window.print(); });</script>
      </body>
    </html>`);
  ventana.document.close();
}

// ============================================
// GUARDAR (crear o actualizar)
// ============================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("#prod-id").value;
  const btnGuardar = $("#btn-guardar-producto");
  const mensaje = $("#msg-producto");
  mensaje.hidden = true;

  const payload = {
    sku: $("#prod-sku").value.trim(),
    nombre: $("#prod-nombre").value.trim(),
    descripcion: $("#prod-descripcion").value.trim(),
    categoria_id: $("#prod-categoria").value,
    unidad_medida: $("#prod-unidad").value,
    precio: parseFloat($("#prod-precio").value) || 0,
    precio_mayorista: $("#prod-precio-mayorista").value,
    stock: parseInt($("#prod-stock").value) || 0,
    stock_minimo: parseInt($("#prod-stock-minimo").value) || 0,
  };
  if (Sesion.tienePermiso("productos.ver_costos")) {
    payload.costo = parseFloat($("#prod-costo").value) || 0;
  }

  const url = id ? `${API}?id=${id}` : API;
  const method = id ? "PUT" : "POST";

  btnGuardar.disabled = true;
  btnGuardar.textContent = id ? "Actualizando..." : "Guardando...";
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
    mensaje.textContent = data.mensaje || "Producto guardado correctamente.";
    mensaje.hidden = false;
  } catch (err) {
    alert("No se pudo guardar el producto: " + err.message);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar producto";
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
      form.closest(".card").hidden = false;
      $("#product-edit-hint").hidden = true;
      window.PitbullProductTabs?.seleccionarTab("form");
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
  $("#msg-producto").hidden = true;
  formTitle.textContent = " Nuevo Producto";
  btnCancelar.hidden = true;
  if (!Sesion.tienePermiso("productos.crear")) {
    form.closest(".card").hidden = true;
    $("#product-edit-hint").hidden = false;
    window.PitbullProductTabs?.seleccionarTab("catalog");
  }
}
