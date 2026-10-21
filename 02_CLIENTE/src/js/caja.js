/**
 * PITBULL Manager v1.0
 * Control de Caja
 */

const API_BASE = "http://localhost:8000/api";
const API = `${API_BASE}/caja.php`;

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

let cajaActual = null;

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

  await cargarEstado();
  await cargarHistorial();
})();

// ============================================
// ESTADO ACTUAL
// ============================================
async function cargarEstado() {
  try {
    const res = await apiFetch(`${API}?action=actual`);
    cajaActual = await res.json();

    const info = $("#caja-info");
    if (!cajaActual || cajaActual.estado === "cerrada") {
      info.innerHTML = `<div class="empty">No tienes caja abierta. Abre una para comenzar a vender.</div>`;
      $("#card-abrir").hidden = false;
      $("#card-cerrar").hidden = true;
      $("#card-movimiento").hidden = true;
    } else {
      info.innerHTML = `
                <div class="caja-panel">
                    <div class="caja-stat">
                        <span class="caja-label">Apertura</span>
                        <strong>${fmtMoney(cajaActual.monto_apertura)}</strong>
                    </div>
                    <div class="caja-stat">
                        <span class="caja-label">Ventas en efectivo</span>
                        <strong>${fmtMoney(cajaActual.total_ventas_efectivo || 0)}</strong>
                    </div>
                    <div class="caja-stat">
                        <span class="caja-label">Esperado en caja</span>
                        <strong>${fmtMoney(cajaActual.monto_esperado || 0)}</strong>
                    </div>
                    <div class="caja-stat">
                        <span class="caja-label">Abierta desde</span>
                        <strong>${new Date(cajaActual.abierta_en).toLocaleString("es-VE")}</strong>
                    </div>
                </div>
            `;
      $("#card-abrir").hidden = true;
      $("#card-cerrar").hidden = false;
      $("#card-movimiento").hidden = false;
    }
  } catch (e) {
    $("#caja-info").innerHTML =
      `<div class="empty" style="color:var(--rojo)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ============================================
// ABRIR CAJA
// ============================================
$("#form-abrir").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await apiFetch(`${API}?action=abrir`, {
      method: "POST",
      body: JSON.stringify({
        monto_apertura: parseFloat($("#monto-apertura").value) || 0,
        notas: $("#notas-apertura").value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert("O " + data.mensaje);
    await cargarEstado();
    await cargarHistorial();
  } catch (e) {
    alert("X " + e.message);
  }
});

// ============================================
// CERRAR CAJA
// ============================================
$("#form-cerrar").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!confirm("¿Confirmas el cierre de caja?")) return;

  try {
    const res = await apiFetch(`${API}?action=cerrar`, {
      method: "POST",
      body: JSON.stringify({
        monto_cierre: parseFloat($("#monto-cierre").value) || 0,
        notas: $("#notas-cierre").value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(
      `O ${data.mensaje}\nEsperado: ${fmtMoney(data.esperado)}\nContado: ${fmtMoney(data.monto_cierre)}`,
    );
    await cargarEstado();
    await cargarHistorial();
  } catch (e) {
    alert("X " + e.message);
  }
});

// ============================================
// MOVIMIENTO MANUAL
// ============================================
$("#form-movimiento").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await apiFetch(`${API}?action=movimiento`, {
      method: "POST",
      body: JSON.stringify({
        tipo: $("#mov-tipo").value,
        monto: parseFloat($("#mov-monto").value) || 0,
        concepto: $("#mov-concepto").value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert("O" + data.mensaje);
    $("#form-movimiento").reset();
    await cargarEstado();
  } catch (e) {
    alert("X " + e.message);
  }
});

// ============================================
// HISTORIAL
// ============================================
async function cargarHistorial() {
  try {
    const res = await apiFetch(`${API}?action=historial`);
    const data = await res.json();
    const tbody = $("#tabla-cajas tbody");
    tbody.innerHTML = "";

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">Sin cajas registradas</td></tr>`;
      return;
    }

    data.forEach((c) => {
      const tr = document.createElement("tr");
      const badge =
        c.estado === "abierta"
          ? '<span class="badge badge-verde">Abierta</span>'
          : '<span class="badge badge-azul">Cerrada</span>';
      const dif = c.diferencia_cierre || 0;
      const difClass =
        dif < 0
          ? "color:var(--rojo)"
          : dif > 0
            ? "color:var(--amarillo)"
            : "color:var(--verde)";

      tr.innerHTML = `
                <td>${c.id}</td>
                <td>${escapeHtml(c.usuario_nombre)}</td>
                <td>${fmtMoney(c.monto_apertura)}</td>
                <td>${c.monto_cierre ? fmtMoney(c.monto_cierre) : "—"}</td>
                <td>${c.monto_esperado ? fmtMoney(c.monto_esperado) : "—"}</td>
                <td style="${difClass}"><strong>${c.monto_cierre ? fmtMoney(dif) : "—"}</strong></td>
                <td>${badge}</td>
                <td><button class="btn btn-sm btn-edit" data-ver="${c.id}">Ver</button></td>
            `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    $("#tabla-cajas tbody").innerHTML =
      `<tr><td colspan="8" class="empty" style="color:var(--rojo)">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// Ver detalle
$("#tabla-cajas").addEventListener("click", async (e) => {
  const id = e.target.dataset.ver;
  if (!id) return;
  try {
    const res = await apiFetch(`${API}?id=${id}`);
    const c = await res.json();
    let txt = `Caja #${c.id}\nUsuario: ${c.usuario_nombre}\nApertura: ${fmtMoney(c.monto_apertura)}\n`;
    if (c.monto_cierre) {
      txt += `Cierre: ${fmtMoney(c.monto_cierre)}\nEsperado: ${fmtMoney(c.monto_esperado)}\nDiferencia: ${fmtMoney(c.diferencia_cierre)}\n`;
    }
    txt += `\n--- Movimientos ---\n`;
    (c.movimientos || []).forEach((m) => {
      txt += `${m.tipo.padEnd(18)} ${fmtMoney(m.monto).padStart(15)}  ${m.concepto}\n`;
    });
    alert(txt);
  } catch (e) {
    alert("Error: " + e.message);
  }
});
