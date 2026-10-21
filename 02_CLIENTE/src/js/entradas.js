/**
 * PITBULL Manager v1.0
 * Entrada de Mercancía
 */

const API_BASE = "http://localhost:8000/api";
const API = `${API_BASE}/entradas.php`;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

let productosCache = [];
let almacenesCache = [];
let proveedoresCache = [];
let contadorLineas = 0;

// ============================================
// INICIALIZAR
// ============================================
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  if (!Sesion.tienePermiso("entradas.crear")) {
    alert("No tienes permiso para registrar entradas");
    window.location.href = "index.html";
    return;
  }

  const u = Sesion.getUsuario();
  $("#user-nombre").textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));

  // Ocultar links sin permiso
  if (!Sesion.tienePermiso("usuarios.ver")) {
    const el = $("#nav-usuarios");
    if (el) el.style.display = "none";
  }
  if (!Sesion.tienePermiso("config.editar")) {
    const el = $("#nav-config");
    if (el) el.style.display = "none";
  }

  await Promise.all([
    cargarProductos(),
    cargarAlmacenes(),
    cargarProveedores(),
  ]);

  agregarLinea(); // Primera línea vacía
  await cargarEntradas();
})();

// ============================================
// CARGAR DATOS
// ============================================
async function cargarProductos() {
  try {
    const res = await apiFetch(`${API_BASE}/productos.php`);
    productosCache = await res.json();
  } catch (e) {
    console.error("Error productos:", e);
  }
}

async function cargarAlmacenes() {
  try {
    const res = await apiFetch(`${API_BASE}/almacenes.php`);
    almacenesCache = await res.json();
    const sel = $("#ent-almacen");
    almacenesCache.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.nombre;
      if (a.es_principal == 1) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Error almacenes:", e);
  }
}

async function cargarProveedores() {
  try {
    const res = await apiFetch(`${API_BASE}/proveedores.php`);
    proveedoresCache = await res.json();
    const sel = $("#ent-proveedor");
    proveedoresCache.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.nombre;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Error proveedores:", e);
  }
}

async function cargarEntradas() {
  try {
    const res = await apiFetch(API);
    const data = await res.json();
    renderEntradas(data);
  } catch (e) {
    $("#tabla-entradas tbody").innerHTML =
      `<tr><td colspan="9" class="empty" style="color:var(--rojo)">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// ============================================
// RENDERIZAR HISTORIAL
// ============================================
function renderEntradas(lista) {
  const tbody = $("#tabla-entradas tbody");
  tbody.innerHTML = "";
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Sin entradas registradas</td></tr>`;
    return;
  }
  lista.forEach((e) => {
    const fecha = new Date(e.created_at).toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${e.id}</td>
            <td><strong>${escapeHtml(e.numero)}</strong></td>
            <td>${escapeHtml(e.proveedor_nombre || "—")}</td>
            <td>${escapeHtml(e.almacen_nombre || "—")}</td>
            <td>${e.total_lineas}</td>
            <td>${fmtMoney(e.total)}</td>
            <td>${fecha}</td>
            <td>${escapeHtml(e.usuario_nombre || "—")}</td>
            <td><button class="btn btn-sm btn-edit" data-ver="${e.id}">Ver</button></td>
        `;
    tbody.appendChild(tr);
  });
}

// ============================================
// AGREGAR LÍNEA DE PRODUCTO
// ============================================
$("#btn-agregar-linea").addEventListener("click", () => agregarLinea());

function agregarLinea() {
  contadorLineas++;
  const id = contadorLineas;

  // Opciones de productos
  const optsProductos = productosCache
    .map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.sku)} — ${escapeHtml(p.nombre)}</option>`,
    )
    .join("");

  const div = document.createElement("div");
  div.className = "linea-producto";
  div.dataset.linea = id;
  div.innerHTML = `
        <div class="linea-grid">
            <label>Producto *
                <select class="linea-producto-id" required>
                    <option value="">— Seleccionar —</option>
                    ${optsProductos}
                </select>
            </label>
            <label>Cantidad *
                <input type="number" class="linea-cantidad" min="1" value="1" required>
            </label>
            <label>Costo unitario (Bs.) *
                <input type="number" class="linea-costo" min="0" step="0.01" value="0" required>
            </label>
            <label>Gastos línea (Bs.)
                <input type="number" class="linea-gastos" min="0" step="0.01" value="0">
            </label>
            <label>Subtotal
                <input type="text" class="linea-subtotal" readonly value="Bs. 0.00" style="background:#f1f5f9">
            </label>
            <button type="button" class="btn btn-sm btn-danger btn-eliminar-linea" title="Eliminar línea">
                ✖
            </button>
        </div>
        <input type="text" class="linea-observacion" placeholder="Observación (opcional)" maxlength="255" style="margin-top:6px">
    `;

  $("#lineas-container").appendChild(div);

  // Eventos
  div
    .querySelectorAll(".linea-cantidad, .linea-costo, .linea-gastos")
    .forEach((el) => {
      el.addEventListener("input", recalcularTotales);
    });

  div.querySelector(".btn-eliminar-linea").addEventListener("click", () => {
    if ($$(".linea-producto").length === 1) {
      alert("Debe haber al menos una línea");
      return;
    }
    div.remove();
    recalcularTotales();
  });

  recalcularTotales();
}

// ============================================
// RECALCULAR TOTALES
// ============================================
function recalcularTotales() {
  let subtotal = 0;
  let gastos = 0;

  $$(".linea-producto").forEach((linea) => {
    const cant = parseFloat(linea.querySelector(".linea-cantidad").value) || 0;
    const costo = parseFloat(linea.querySelector(".linea-costo").value) || 0;
    const gastoL = parseFloat(linea.querySelector(".linea-gastos").value) || 0;
    const sub = cant * costo;
    subtotal += sub;
    gastos += gastoL;

    linea.querySelector(".linea-subtotal").value = fmtMoney(sub + gastoL);
  });

  $("#total-subtotal").textContent = fmtMoney(subtotal);
  $("#total-gastos").textContent = fmtMoney(gastos);
  $("#total-general").textContent = fmtMoney(subtotal + gastos);
}

// ============================================
// ENVIAR ENTRADA
// ============================================
$("#form-entrada").addEventListener("submit", async (e) => {
  e.preventDefault();

  const almacenId = $("#ent-almacen").value;
  if (!almacenId) {
    alert("Selecciona un almacén");
    return;
  }

  // Recolectar líneas
  const lineas = [];
  let valido = true;

  $$(".linea-producto").forEach((linea) => {
    const prodId = linea.querySelector(".linea-producto-id").value;
    const cant = parseInt(linea.querySelector(".linea-cantidad").value) || 0;
    const costo = parseFloat(linea.querySelector(".linea-costo").value) || 0;
    const gastos = parseFloat(linea.querySelector(".linea-gastos").value) || 0;
    const obs = linea.querySelector(".linea-observacion").value.trim();

    if (!prodId || cant <= 0) valido = false;
    else
      lineas.push({
        producto_id: parseInt(prodId),
        cantidad: cant,
        costo_unitario: costo,
        gastos_linea: gastos,
        observacion: obs || null,
      });
  });

  if (!valido || !lineas.length) {
    alert("Verifica que todas las líneas tengan producto y cantidad mayor a 0");
    return;
  }

  // Deshabilitar botón
  const btn = $("#btn-registrar");
  btn.disabled = true;
  btn.textContent = " Registrando...";

  try {
    const res = await apiFetch(API, {
      method: "POST",
      body: JSON.stringify({
        proveedor_id: $("#ent-proveedor").value || null,
        almacen_id: parseInt(almacenId),
        tipo: $("#ent-tipo").value,
        observaciones: $("#ent-observaciones").value.trim(),
        lineas: lineas,
      }),
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error + (data.detalle ? " — " + data.detalle : ""));

    alert(` ${data.mensaje}\nTotal: ${fmtMoney(data.total)}`);

    // Reset form
    resetFormulario();
    await cargarProductos(); // recargar porque cambió stock
    await cargarEntradas();
  } catch (err) {
    alert("❌ " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = " Registrar Entrada";
  }
});

// ============================================
// RESET
// ============================================
$("#btn-reset").addEventListener("click", (e) => {
  e.preventDefault();
  if (!confirm("¿Limpiar el formulario?")) return;
  resetFormulario();
});

function resetFormulario() {
  $("#lineas-container").innerHTML = "";
  contadorLineas = 0;
  $("#ent-observaciones").value = "";
  $("#ent-tipo").value = "compra";
  agregarLinea();
  recalcularTotales();
}
if (!Sesion.tienePermiso("usuarios.ver")) {
  const el = $("#nav-usuarios");
  if (el) el.style.display = "none";
}
if (!Sesion.tienePermiso("config.editar")) {
  const el = $("#nav-config");
  if (el) el.style.display = "none";
}
