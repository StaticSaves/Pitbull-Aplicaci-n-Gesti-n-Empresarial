/**
 * PITBULL Manager v1.0
 * Punto de Venta (POS)
 */

const API_BASE = "http://localhost:8000/api";
const API = `${API_BASE}/ventas.php`;

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
let carrito = [];
let ivaPorcentaje = 16;

// ============================================
// INICIALIZAR
// ============================================
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  const u = Sesion.getUsuario();
  $("#user-nombre").textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));

  if (!Sesion.tienePermiso("usuarios.ver")) {
    const el = $("#nav-usuarios");
    if (el) el.style.display = "none";
  }
  if (!Sesion.tienePermiso("config.editar")) {
    const el = $("#nav-config");
    if (el) el.style.display = "none";
  }

  // Verificar caja abierta
  const res = await apiFetch(`${API_BASE}/caja.php?action=actual`);
  const caja = await res.json();
  if (!caja || caja.estado !== "abierta") {
    if (!confirm("No tienes caja abierta. ¿Quieres ir a abrirla ahora?")) {
      window.location.href = "index.html";
      return;
    }
    window.location.href = "caja.html";
    return;
  }

  // Cargar IVA desde config
  try {
    const res = await apiFetch(`${API_BASE}/config_sistema.php`);
    const cfg = await res.json();
    ivaPorcentaje = parseFloat(cfg.config?.iva_porcentaje?.valor || 16);
    $("#pos-iva-pct").textContent = ivaPorcentaje;
  } catch (e) {}

  await cargarProductos();
  renderCarrito();

  // Configurar secciones colapsables
  configurarSeccionesColapsables();

  // Listeners de campos del cliente (para el resumen)
  ["cli-nombre", "cli-cedula", "cli-telefono"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", actualizarResumenCliente);
  });

  // Listeners de totales
  $("#pos-descuento").addEventListener("input", recalcular);
  $("#pos-aplica-iva").addEventListener("change", recalcular);

  // Vaciar carrito
  $("#btn-vaciar").addEventListener("click", () => {
    if (!carrito.length) return;
    if (!confirm("¿Vaciar el carrito?")) return;
    carrito = [];
    renderCarrito();
  });

  // Cobrar
  $("#btn-cobrar").addEventListener("click", cobrar);
})();

// ============================================
// CARGAR PRODUCTOS
// ============================================
async function cargarProductos() {
  const res = await apiFetch(`${API_BASE}/productos.php`);
  productosCache = await res.json();
  renderProductos(productosCache);
}

function renderProductos(lista) {
  const cont = $("#pos-productos");
  cont.innerHTML = "";
  lista
    .filter((p) => p.stock > 0)
    .forEach((p) => {
      const div = document.createElement("div");
      div.className = "pos-card";
      div.dataset.id = p.id;
      div.innerHTML = `
            <div class="pos-card-sku">${escapeHtml(p.sku)}</div>
            <div class="pos-card-nombre">${escapeHtml(p.nombre)}</div>
            <div class="pos-card-precio">${fmtMoney(p.precio)}</div>
            <div class="pos-card-stock">Stock: ${p.stock}</div>
        `;
      div.addEventListener("click", () => agregarAlCarrito(p));
      cont.appendChild(div);
    });
  if (!cont.children.length) {
    cont.innerHTML = `<div class="empty">Sin productos disponibles</div>`;
  }
}

// ============================================
// BUSCADOR
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const buscar = $("#pos-buscar");
  if (buscar) {
    buscar.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtrados = productosCache.filter(
        (p) =>
          (p.sku || "").toLowerCase().includes(q) ||
          (p.nombre || "").toLowerCase().includes(q),
      );
      renderProductos(filtrados);
    });
  }
});

// ============================================
// AGREGAR AL CARRITO
// ============================================
function agregarAlCarrito(prod) {
  const existente = carrito.find((x) => x.producto_id === prod.id);

  if (existente) {
    if (existente.cantidad + 1 > prod.stock) {
      alert(`Stock insuficiente. Máximo: ${prod.stock}`);
      return;
    }
    existente.cantidad++;
  } else {
    carrito.push({
      producto_id: prod.id,
      nombre: prod.nombre,
      sku: prod.sku,
      precio: parseFloat(prod.precio),
      cantidad: 1,
      stock_max: prod.stock,
    });
  }

  renderCarrito();
  autoColapsarSecciones();
}

// ============================================
// AUTO-COLAPSAR SECCIONES
// ============================================
function autoColapsarSecciones() {
  // Si hay 3+ líneas, colapsar la sección de cliente
  const seccionCliente = document.getElementById("seccion-cliente");
  if (carrito.length >= 3 && seccionCliente) {
    seccionCliente.classList.add("colapsada");
    actualizarResumenCliente();
  }

  // Siempre expandir productos
  const seccionProd = document.getElementById("seccion-productos");
  if (seccionProd) seccionProd.classList.remove("colapsada");
}

// ============================================
// CONFIGURAR SECCIONES COLAPSABLES (click manual)
// ============================================
function configurarSeccionesColapsables() {
  document.querySelectorAll(".pos-seccion-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seccion = btn.closest(".pos-seccion");
      seccion.classList.toggle("colapsada");
      if (seccion.id === "seccion-cliente") {
        actualizarResumenCliente();
      }
    });
  });
}

// ============================================
// ACTUALIZAR RESUMEN DEL CLIENTE
// ============================================
function actualizarResumenCliente() {
  const resumen = document.getElementById("cliente-resumen");
  if (!resumen) return;

  const nombre = $("#cli-nombre").value.trim();
  const cedula = $("#cli-cedula").value.trim();
  const telefono = $("#cli-telefono").value.trim();

  if (!nombre && !cedula && !telefono) {
    resumen.hidden = true;
    return;
  }

  const partes = [];
  if (nombre) partes.push(`<strong>${escapeHtml(nombre)}</strong>`);
  if (cedula) partes.push(`CI: ${escapeHtml(cedula)}`);
  if (telefono) partes.push(`Tel: ${escapeHtml(telefono)}`);

  resumen.innerHTML = partes.join(" · ");
  resumen.hidden = false;
}

// ============================================
// RENDER CARRITO
// ============================================
function renderCarrito() {
  const cont = $("#pos-lineas");
  cont.innerHTML = "";

  if (!carrito.length) {
    cont.innerHTML = `<div class="empty">Agrega productos al carrito</div>`;
    actualizarContadorProductos();
    recalcular();
    return;
  }

  carrito.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "pos-linea";
    div.innerHTML = `
            <div class="pos-linea-info">
                <div class="pos-linea-nombre">${escapeHtml(item.nombre)}</div>
                <div class="pos-linea-sku">${escapeHtml(item.sku)}</div>
            </div>
            <div class="pos-linea-cantidad">
                <button class="btn-mini" data-accion="menos" data-idx="${idx}">−</button>
                <input type="number" min="1" value="${item.cantidad}" data-idx="${idx}" class="inp-cant">
                <button class="btn-mini" data-accion="mas" data-idx="${idx}">+</button>
            </div>
            <div class="pos-linea-precio">
                ${fmtMoney(item.precio * item.cantidad)}
            </div>
            <button class="btn-mini btn-rojo" data-accion="quitar" data-idx="${idx}">✖</button>
        `;
    cont.appendChild(div);
  });

  cont.querySelectorAll("button[data-accion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      const accion = btn.dataset.accion;
      if (accion === "mas") {
        if (carrito[idx].cantidad + 1 > carrito[idx].stock_max) {
          alert("Stock insuficiente");
          return;
        }
        carrito[idx].cantidad++;
      }
      if (accion === "menos") {
        carrito[idx].cantidad--;
        if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
      }
      if (accion === "quitar") carrito.splice(idx, 1);
      renderCarrito();
    });
  });

  cont.querySelectorAll(".inp-cant").forEach((inp) => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.idx);
      const v = parseInt(inp.value) || 1;
      if (v > carrito[idx].stock_max) {
        alert("Stock insuficiente");
        inp.value = carrito[idx].cantidad;
        return;
      }
      carrito[idx].cantidad = Math.max(1, v);
      renderCarrito();
    });
  });

  actualizarContadorProductos();
  recalcular();
}

// ============================================
// CONTADOR DE PRODUCTOS
// ============================================
function actualizarContadorProductos() {
  const contador = document.getElementById("contador-productos");
  if (contador) {
    contador.textContent = carrito.reduce((sum, i) => sum + i.cantidad, 0);
  }
}

// ============================================
// RECALCULAR TOTALES
// ============================================
function recalcular() {
  const subtotal = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  const descuento = parseFloat($("#pos-descuento").value) || 0;
  const base = Math.max(0, subtotal - descuento);
  const aplicaIVA = $("#pos-aplica-iva").checked;
  const iva = aplicaIVA ? base * (ivaPorcentaje / 100) : 0;
  const total = base + iva;

  $("#pos-subtotal").textContent = fmtMoney(subtotal);
  $("#pos-iva").textContent = fmtMoney(iva);
  $("#pos-total").textContent = fmtMoney(total);

  $("#btn-cobrar").disabled = carrito.length === 0;
}

// ============================================
// COBRAR
// ============================================
async function cobrar() {
  if (!carrito.length) return;
  if (!confirm(`¿Confirmar la venta por ${$("#pos-total").textContent}?`))
    return;

  const btn = $("#btn-cobrar");
  btn.disabled = true;
  btn.textContent = " Procesando...";

  try {
    const res = await apiFetch(API, {
      method: "POST",
      body: JSON.stringify({
        cliente_nombre: $("#cli-nombre").value.trim(),
        cliente_cedula: $("#cli-cedula").value.trim(),
        cliente_telefono: $("#cli-telefono").value.trim(),
        lineas: carrito.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio,
        })),
        descuento_global: parseFloat($("#pos-descuento").value) || 0,
        aplica_iva: $("#pos-aplica-iva").checked,
        metodo_pago: $("#pos-metodo-pago").value,
      }),
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error + (data.detalle ? " — " + data.detalle : ""));

    const url = `comprobante.html?id=${data.id}`;
    window.open(url, "_blank");

    alert(` ${data.mensaje}\nTotal: ${fmtMoney(data.total)}`);

    // Limpiar
    carrito = [];
    $("#cli-nombre").value = "";
    $("#cli-cedula").value = "";
    $("#cli-telefono").value = "";
    $("#pos-descuento").value = "0";

    // Restaurar secciones
    const secCli = document.getElementById("seccion-cliente");
    if (secCli) secCli.classList.remove("colapsada");
    actualizarResumenCliente();

    renderCarrito();
    await cargarProductos();
  } catch (err) {
    alert("x " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = " COBRAR Y REGISTRAR";
  }
}
