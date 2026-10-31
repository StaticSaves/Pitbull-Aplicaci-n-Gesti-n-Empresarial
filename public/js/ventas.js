/**
 * PITBULL Manager v1.0
 * Punto de Venta (POS)
 */

const API_BASE = "api";
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

function inicializarPestanasVentas(puedeRegistrar) {
  const tabs = [...document.querySelectorAll("[data-sales-tab]")];
  const panels = [...document.querySelectorAll("[data-sales-panel]")];
  const visibles = tabs.filter((tab) => {
    const visible = tab.dataset.salesTab === "create"
      ? puedeRegistrar
      : Sesion.tienePermiso(tab.dataset.permission);
    tab.hidden = !visible;
    return visible;
  });
  $("#ventas-no-register").hidden = puedeRegistrar;

  function seleccionarTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.salesPanel !== tab.dataset.salesTab;
    });
  }

  visibles.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.addEventListener("click", () => seleccionarTab(tab));
  });
  if (visibles[0]) seleccionarTab(visibles[0]);
}

// ============================================
// INICIALIZAR
// ============================================
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  if (!Sesion.tienePermiso("ventas.ver")) {
    alert("No tienes permiso para acceder a la sección de ventas");
    window.location.href = "index.html";
    return;
  }

  const u = Sesion.getUsuario();
  const puedeRegistrar =
    Sesion.tienePermiso("ventas.crear") &&
    Sesion.tienePermiso("caja.ver") &&
    Sesion.tienePermiso("productos.ver");
  inicializarPestanasVentas(puedeRegistrar);
  window.PitbullMenu?.setUser(u);
  window.PitbullMenu?.applyPermissions();
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));
  if (puedeRegistrar) {
    $("#pos-vendedor").value = u.nombre_completo || "";
    $("#pos-vendedor-rol").textContent = u.rol_nombre || "";
    $("#pos-fecha").textContent = new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

    const res = await apiFetch(`${API_BASE}/caja.php?action=actual`);
    const caja = await res.json();
    if (!res.ok) throw new Error(caja.error || "No se pudo consultar la caja");
    if (!caja || caja.estado !== "abierta") {
      if (!confirm("No tienes caja abierta. ¿Quieres ir a abrirla ahora?")) {
        window.location.href = "index.html";
        return;
      }
      window.location.href = "caja.html";
      return;
    }

    try {
      const configResponse = await apiFetch(`${API_BASE}/config_sistema.php`);
      const config = await configResponse.json();
      if (configResponse.ok) {
        ivaPorcentaje = parseFloat(config.config?.iva_porcentaje?.valor || 16);
      }
      $("#pos-iva-pct").textContent = ivaPorcentaje;
    } catch (error) {
      console.warn("No se pudo cargar el IVA configurado:", error.message);
    }

    await cargarProductos();
    renderCarrito();
    configurarBuscadorProductos();
    $("#pos-descuento").addEventListener("input", recalcular);
    $("#pos-aplica-iva").addEventListener("change", recalcular);
    $("#btn-vaciar").addEventListener("click", () => {
      if (!carrito.length) return;
      if (!confirm("¿Vaciar el carrito?")) return;
      carrito = [];
      renderCarrito();
    });
    $("#btn-cobrar").addEventListener("click", cobrar);
  }
  await cargarHistorialVentas();
})();

async function cargarHistorialVentas() {
  const tbody = $("#tabla-ventas tbody");
  try {
    const res = await apiFetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar el historial");
    if (!Array.isArray(data)) throw new Error("Respuesta de historial no válida");

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">Sin ventas registradas</td></tr>';
      return;
    }

    data.forEach((venta) => {
      const tr = document.createElement("tr");
      const fecha = new Date(String(venta.created_at).replace(" ", "T"));
      tr.innerHTML = `
        <td><strong>${escapeHtml(venta.numero_factura || `#${venta.id}`)}</strong></td>
        <td>${escapeHtml(venta.cliente_nombre || "Cliente general")}</td>
        <td>${Number.isNaN(fecha.getTime()) ? "—" : escapeHtml(fecha.toLocaleString("es-VE"))}</td>
        <td>${escapeHtml(venta.usuario_nombre || "—")}</td>
        <td>${Number(venta.total_lineas || 0)}</td>
        <td>${escapeHtml(venta.metodo_pago || "—")}</td>
        <td>${fmtMoney(venta.total)}</td>
        <td>${escapeHtml(venta.estado || "—")}</td>
        <td><button type="button" class="btn btn-sm btn-edit" data-sale-detail="${Number(venta.id)}">Ver</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty" style="color:var(--rojo)">Error: ${escapeHtml(error.message)}</td></tr>`;
  }
}

$("#btn-actualizar-ventas").addEventListener("click", cargarHistorialVentas);
$("#tabla-ventas").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-sale-detail]");
  if (!button) return;

  try {
    const res = await apiFetch(`${API}?id=${button.dataset.saleDetail}`);
    const venta = await res.json();
    if (!res.ok) throw new Error(venta.error || "No se pudo cargar el detalle");
    const lineas = (venta.lineas || []).map((linea) =>
      `${linea.cantidad} x ${linea.producto_nombre} — ${fmtMoney(linea.subtotal)}`,
    );
    alert([
      `Factura: ${venta.numero_factura}`,
      `Cliente: ${venta.cliente_nombre || "Cliente general"}`,
      `Vendedor: ${venta.usuario_nombre || "—"}`,
      `Total: ${fmtMoney(venta.total)}`,
      "",
      ...lineas,
    ].join("\n"));
  } catch (error) {
    alert("Error: " + error.message);
  }
});

// ============================================
// CARGAR PRODUCTOS
// ============================================
async function cargarProductos() {
  const res = await apiFetch(`${API_BASE}/productos.php`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el catálogo.");
  if (!Array.isArray(data)) {
    throw new Error("El catálogo devolvió una respuesta no válida.");
  }
  productosCache = data;
}

// ============================================
// BUSCADOR EN VENTANA EMERGENTE
// ============================================
function configurarBuscadorProductos() {
  const modal = $("#modal-productos");
  const inputModal = $("#modal-buscar-producto");

  $("#form-buscar-producto").addEventListener("submit", (event) => {
    event.preventDefault();
    inputModal.value = $("#pos-buscar").value.trim();
    modal.showModal();
    buscarProductos(inputModal.value);
    inputModal.focus();
  });

  $("#form-modal-busqueda").addEventListener("submit", (event) => {
    event.preventDefault();
    buscarProductos(inputModal.value);
  });
  inputModal.addEventListener("input", () => buscarProductos(inputModal.value));

  $("#btn-cerrar-busqueda").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
  modal.addEventListener("close", () => $("#pos-buscar").focus());

  $("#modal-productos-resultados").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-product-id]");
    if (!button) return;
    const product = productosCache.find(
      (item) => String(item.id) === button.dataset.productId,
    );
    if (product) agregarAlCarrito(product);
  });
}

function buscarProductos(query) {
  const results = $("#modal-productos-resultados");
  const term = query.trim().toLocaleLowerCase("es");

  const matches = productosCache.filter((product) => {
    const sku = String(product.sku || "").toLocaleLowerCase("es");
    const name = String(product.nombre || "").toLocaleLowerCase("es");
    const reservado = carrito.find(
      (item) => String(item.producto_id) === String(product.id),
    )?.cantidad || 0;
    const disponible = Number(product.stock) > reservado;
    return disponible && (!term || sku.includes(term) || name.includes(term));
  });

  if (!matches.length) {
    results.innerHTML =
      `<tr><td colspan="5" class="empty">${
        term
          ? "No hay productos disponibles con ese nombre o código."
          : "No hay productos disponibles."
      }</td></tr>`;
    return;
  }

  results.innerHTML = matches.map((product) => `
    <tr>
      <td><strong>${escapeHtml(product.sku)}</strong></td>
      <td>${escapeHtml(product.nombre)}</td>
      <td>${Number(product.stock) - (carrito.find(
        (item) => String(item.producto_id) === String(product.id),
      )?.cantidad || 0)}</td>
      <td class="align-right">${fmtMoney(product.precio)}</td>
      <td>
        <button type="button" class="btn btn-sm btn-primary" data-product-id="${escapeHtml(product.id)}">
          Agregar
        </button>
      </td>
    </tr>
  `).join("");
}

// ============================================
// AGREGAR AL CARRITO
// ============================================
function agregarAlCarrito(prod) {
  const existente = carrito.find(
    (item) => String(item.producto_id) === String(prod.id),
  );
  const stock = Number(prod.stock);

  if (existente) {
    if (existente.cantidad + 1 > stock) {
      alert(`Stock insuficiente. Máximo: ${stock}`);
      return;
    }
    existente.cantidad++;
  } else {
    carrito.push({
      producto_id: prod.id,
      nombre: prod.nombre,
      sku: prod.sku,
      precio: Number(prod.precio),
      cantidad: 1,
      stock_max: stock,
    });
  }
  renderCarrito();
  if ($("#modal-productos").open) {
    buscarProductos($("#modal-buscar-producto").value);
  }
}

// ============================================
// RENDER CARRITO
// ============================================
function renderCarrito() {
  const cont = $("#pos-lineas");
  cont.innerHTML = "";

  if (!carrito.length) {
    cont.innerHTML =
      '<tr><td colspan="6" class="empty">Busca un producto para iniciar la venta.</td></tr>';
    actualizarContadorProductos();
    $("#btn-vaciar").disabled = true;
    recalcular();
    return;
  }

  cont.innerHTML = carrito.map((item, idx) => `
    <tr>
      <td>${escapeHtml(item.sku)}</td>
      <td><strong>${escapeHtml(item.nombre)}</strong></td>
      <td>
        <div class="pos-linea-cantidad">
          <button type="button" class="btn-mini" data-accion="menos" data-idx="${idx}" aria-label="Reducir cantidad">−</button>
          <input type="number" min="1" max="${item.stock_max}" value="${item.cantidad}" data-idx="${idx}" class="inp-cant" aria-label="Cantidad de ${escapeHtml(item.nombre)}">
          <button type="button" class="btn-mini" data-accion="mas" data-idx="${idx}" aria-label="Aumentar cantidad">+</button>
        </div>
      </td>
      <td class="align-right">${fmtMoney(item.precio)}</td>
      <td class="align-right"><strong>${fmtMoney(item.precio * item.cantidad)}</strong></td>
      <td><button type="button" class="btn btn-sm btn-ghost" data-accion="quitar" data-idx="${idx}">Quitar</button></td>
    </tr>
  `).join("");

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
  $("#btn-vaciar").disabled = carrito.length === 0;
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

  const ventanaComprobante = window.open("about:blank", "_blank");
  const btn = $("#btn-cobrar");
  btn.disabled = true;
  btn.textContent = "Procesando...";

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
    const comprobanteEnPestanaNueva =
      ventanaComprobante && !ventanaComprobante.closed;
    if (comprobanteEnPestanaNueva) {
      ventanaComprobante.location.href = url;
    }

    alert(` ${data.mensaje}\nTotal: ${fmtMoney(data.total)}`);
    if (!comprobanteEnPestanaNueva) {
      window.location.href = url;
      return;
    }

    // Limpiar
    carrito = [];
    $("#cli-nombre").value = "";
    $("#cli-cedula").value = "";
    $("#cli-telefono").value = "";
    $("#pos-descuento").value = "0";

    renderCarrito();
    await cargarHistorialVentas();
    try {
      await cargarProductos();
    } catch (err) {
      alert(
        "La venta fue registrada, pero no se pudo actualizar el catálogo: " +
          err.message,
      );
    }
  } catch (err) {
    if (ventanaComprobante && !ventanaComprobante.closed) {
      ventanaComprobante.close();
    }
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Registrar venta";
  }
}
