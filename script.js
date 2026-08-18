/* ============================================================
   Happy Corner · Carta digital
   ------------------------------------------------------------
   Este script SOLO lee datos (de menu.json o del Google Sheet
   configurado en config.js) y los pinta en la página.
   Para cambiar el contenido del menú NO hay que tocar este
   archivo — se edita el Google Sheet (o menu.json si aún no
   hay Sheet conectado).

   Además incluye el "carrito local" del modelo híbrido: el
   cliente va tocando "Añadir" en los platos, se guarda en su
   propio navegador (localStorage) y puede abrir el panel
   "Mi Selección" para enseñárselo o leérselo al camarero. No
   hay pasarela de pago ni pedido real: es solo una ayuda visual.
   ============================================================ */

const JSON_URL = "menu.json";
const CART_STORAGE_KEY = "happycorner_cart_v1";

// El color de cada sección alterna automáticamente según su posición,
// igual que en la carta impresa — nunca hace falta tocar el diseño.
const SECTION_COLORS = ["#e6007e", "#5b2c87"];

// Icono conocido para las secciones originales. Cualquier sección nueva
// que se añada desde el Sheet (con un nombre distinto) recibe el icono
// genérico "plate" automáticamente.
const KNOWN_SECTION_ICONS = {
  "desayunos": "toast",
  "los favoritos": "star",
  "picoteo": "share",
  "postres": "cone",
  "postres · kürtőskalács": "cone",
  "postres/kürtőskalács": "cone"
};

const ICONS = {
  toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a8 8 0 0 1 16 0v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7Z"/><path d="M9 6.5C9 4 12 4 12 2c0 2 3 2 3 4.5"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="12" r="2.3"/><circle cx="17" cy="6" r="2.3"/><circle cx="17" cy="18" r="2.3"/><path d="M9 10.8 15 7.2M9 13.2l6 3.6"/></svg>`,
  cone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5c1 1.4 1.4 2.6.6 3.7-1 1.3-.4 2.6.7 3.1-1.2.4-1.6 1.7-.7 3 .9 1.2.5 2.5-.6 3.7"/><path d="M8 18h8l-1.6 2.7a2 2 0 0 1-1.7 1H11.3a2 2 0 0 1-1.7-1L8 18Z"/></svg>`,
  plate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`
};

// Postres/Kürtőskalács conserva su foto destacada oficial (fija, la pone
// la agencia — la clienta no puede cambiarla desde el Sheet). Desayunos
// ya tiene su foto arriba del todo, en la cabecera, así que no repetimos
// una segunda dentro de la sección. Cualquier sección nueva que la
// clienta añada tampoco lleva foto propia (para no decidir diseño por ella).
// OJO: esto vale tanto si el menú viene del Sheet como del menu.json local
// — es la única fuente de verdad para estas fotos fijas.
const KNOWN_SECTION_PHOTOS = {
  "postres": { image: "assets/kurtoskalacs.jpg", alt: "Kürtőskalács recién hecho" },
  "postres · kürtőskalács": { image: "assets/kurtoskalacs.jpg", alt: "Kürtőskalács recién hecho" },
  "postres/kürtőskalács": { image: "assets/kurtoskalacs.jpg", alt: "Kürtőskalács recién hecho" }
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function photoBlock(imageUrl, altText) {
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText || "")}" loading="lazy" />`;
  }
  return `
    <div class="photo-placeholder">
      ${ICONS.camera}
      <span>Foto próximamente</span>
    </div>`;
}

// Convierte un precio en texto ("3,20 €", "4.50€"...) a número, para
// poder sumar el total del carrito. Si no se puede leer, cuenta como 0.
function parsePrice(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d,.-]/g, "");
  const n = parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(n) {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// Normaliza el precio que se MUESTRA en la tarjeta, para que "3.2", "3,2 €"
// y "3,20€" salgan siempre igual ("3,20 €"), sin importar cómo lo tecleó
// la clienta en el Sheet. Si el precio no es un número reconocible (por
// ejemplo "Consultar" o "Incluido"), lo dejamos tal cual lo escribió, en
// vez de convertirlo a "0,00 €" — eso sí sería un cambio de significado.
function formatDisplayPrice(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const looksNumeric = /^\d+([.,]\d{1,2})?\s*€?$/.test(trimmed);
  return looksNumeric ? formatPrice(parsePrice(trimmed)) : trimmed;
}

/* ---------- Parser de CSV sencillo (soporta comillas y comas dentro de texto) ---------- */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((v) => v.trim() !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
}

// Convierte las filas planas del Sheet (una fila = un plato) en la
// misma estructura de "sections" que ya usa el resto de la página.
function sheetRowsToSections(rows) {
  const sections = [];
  const byTitle = new Map();

  rows.forEach((r) => {
    const title = r["sección"] || r["seccion"] || "";
    const visible = (r["visible"] || "si").toLowerCase();
    if (!title || visible === "no") return;

    if (!byTitle.has(title)) {
      const knownPhoto = KNOWN_SECTION_PHOTOS[title.trim().toLowerCase()];
      const section = {
        id: title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        title,
        icon: KNOWN_SECTION_ICONS[title.trim().toLowerCase()] || "plate",
        featuredImage: knownPhoto ? knownPhoto.image : null,
        featuredImageAlt: knownPhoto ? knownPhoto.alt : "",
        items: []
      };
      byTitle.set(title, section);
      sections.push(section);
    }

    byTitle.get(title).items.push({
      name: r["plato"] || r["nombre"] || "",
      description: r["descripción"] || r["descripcion"] || "",
      price: r["precio"] || "",
      image: r["imagen"] || r["foto"] || r["image"] || ""
    });
  });

  return sections;
}

/* ---------- Carrito local ("Mi Selección") ---------- */

let cart = loadCart();
// Mapa id -> {name, price, section}, se rellena al pintar los platos,
// para poder añadir/actualizar el carrito sin tener que releer el DOM.
let itemsById = {};

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    // Modo privado / localStorage no disponible: la selección solo
    // dura mientras esté abierta la pestaña, sin dar error al cliente.
  }
}

function getCartCount() {
  return Object.values(cart).reduce((sum, it) => sum + it.qty, 0);
}

function getCartTotal() {
  return Object.values(cart).reduce((sum, it) => sum + it.qty * it.price, 0);
}

function renderDishActions(id) {
  const qty = cart[id]?.qty || 0;
  if (qty <= 0) {
    return `
      <button type="button" class="add-btn" data-id="${id}">
        ${ICONS.plus}
        <span>Añadir</span>
      </button>`;
  }
  return `
    <div class="qty-stepper" data-id="${id}">
      <button type="button" class="qty-btn minus" data-id="${id}" aria-label="Quitar una unidad">−</button>
      <span class="qty-value">${qty}</span>
      <button type="button" class="qty-btn plus" data-id="${id}" aria-label="Añadir una unidad">+</button>
    </div>`;
}

function updateDishActionsSlot(id) {
  const slot = document.querySelector(`.dish-actions-slot[data-actions-for="${id}"]`);
  if (slot) slot.innerHTML = renderDishActions(id);
}

function changeQty(id, delta) {
  const meta = itemsById[id];
  if (!meta) return;

  const current = cart[id]?.qty || 0;
  const next = Math.max(0, current + delta);

  if (next === 0) {
    delete cart[id];
  } else {
    cart[id] = { name: meta.name, price: meta.price, section: meta.section, qty: next };
  }

  saveCart();
  updateDishActionsSlot(id);
  renderCartUI();

  if (delta > 0) {
    const card = document.querySelector(`.dish-card[data-id="${id}"]`);
    if (card) {
      card.classList.remove("just-added");
      void card.offsetWidth; // fuerza reflow para poder repetir la animación
      card.classList.add("just-added");
    }
    const fab = document.getElementById("cart-fab");
    if (fab) {
      fab.classList.remove("bump");
      void fab.offsetWidth;
      fab.classList.add("bump");
    }
  }
}

function renderCartUI() {
  const count = getCartCount();
  const total = getCartTotal();

  document.getElementById("cart-count-badge").textContent = count;
  document.getElementById("fab-total").textContent = formatPrice(total);
  document.getElementById("cart-fab").classList.toggle("has-items", count > 0);
  document.getElementById("cart-total-value").textContent = formatPrice(total);

  const list = document.getElementById("cart-items");
  const entries = Object.entries(cart);

  if (!entries.length) {
    list.innerHTML = `<p class="cart-empty">Aún no has añadido nada. Toca "Añadir" en los platos que te apetezcan.</p>`;
    return;
  }

  list.innerHTML = entries.map(([id, it]) => `
    <div class="cart-row">
      <div class="cart-row-text">
        <span class="cart-row-name">${escapeHtml(it.name)}</span>
        <span class="cart-row-section">${escapeHtml(it.section)}</span>
      </div>
      <div class="qty-stepper" data-id="${id}">
        <button type="button" class="qty-btn minus" data-id="${id}" aria-label="Quitar una unidad">−</button>
        <span class="qty-value">${it.qty}</span>
        <button type="button" class="qty-btn plus" data-id="${id}" aria-label="Añadir una unidad">+</button>
      </div>
      <div class="cart-row-price">${formatPrice(it.price * it.qty)}</div>
    </div>
  `).join("");
}

function setupCartUI() {
  const fab = document.getElementById("cart-fab");
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  const closeBtn = document.getElementById("cart-drawer-close");
  const clearBtn = document.getElementById("cart-clear-btn");

  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.add("open");
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  }

  fab.addEventListener("click", openDrawer);
  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  clearBtn.addEventListener("click", () => {
    cart = {};
    saveCart();
    Object.keys(itemsById).forEach(updateDishActionsSlot);
    renderCartUI();
  });

  // Delegación de eventos: un solo listener para todos los botones
  // "Añadir" / +/- de las tarjetas, aunque el menú se vuelva a pintar
  // (por ejemplo al refrescar los datos del Sheet).
  document.getElementById("menu-sections").addEventListener("click", (e) => {
    const addBtn = e.target.closest(".add-btn");
    if (addBtn) { changeQty(addBtn.dataset.id, 1); return; }
    const plusBtn = e.target.closest(".qty-btn.plus");
    if (plusBtn) { changeQty(plusBtn.dataset.id, 1); return; }
    const minusBtn = e.target.closest(".qty-btn.minus");
    if (minusBtn) { changeQty(minusBtn.dataset.id, -1); }
  });

  document.getElementById("cart-items").addEventListener("click", (e) => {
    const plusBtn = e.target.closest(".qty-btn.plus");
    if (plusBtn) { changeQty(plusBtn.dataset.id, 1); return; }
    const minusBtn = e.target.closest(".qty-btn.minus");
    if (minusBtn) { changeQty(minusBtn.dataset.id, -1); }
  });

  renderCartUI();
}

/* ---------- Render ---------- */

function renderHero(restaurant) {
  document.getElementById("hero-tagline").textContent = restaurant.tagline || "";
  document.getElementById("hero-subtitle").textContent = restaurant.subtitle || "";
  document.getElementById("hero-note").textContent = restaurant.note || "";
  document.getElementById("hero-photo").innerHTML = photoBlock(restaurant.heroImage, restaurant.heroImageAlt);
}

function renderNav(sections) {
  const nav = document.getElementById("section-nav");
  nav.innerHTML = sections.map((s, i) => {
    const color = SECTION_COLORS[i % SECTION_COLORS.length];
    return `<a href="#${s.id}" data-target="${s.id}" style="--section-color:${color}">${escapeHtml(s.title)}</a>`;
  }).join("");
}

// Esqueleto animado (shimmer) que se ve un instante mientras llegan
// los datos del Sheet, en vez de dejar la pantalla en blanco.
function renderSkeleton() {
  const main = document.getElementById("menu-sections");
  main.innerHTML = Array.from({ length: 3 }).map(() => `
    <div class="skeleton-section">
      <div class="skeleton-heading"></div>
      <div class="skeleton-card"></div>
    </div>
  `).join("");
}

// Anima la entrada de cada sección al hacer scroll y resalta en la
// navegación cuál sección se está viendo en cada momento.
function setupScrollAnimations(sections) {
  const sectionEls = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
  const navLinks = Array.from(document.querySelectorAll("#section-nav a"));

  if (!("IntersectionObserver" in window) || !sectionEls.length) {
    sectionEls.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  sectionEls.forEach((el) => revealObserver.observe(el));

  const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = navLinks.find((a) => a.dataset.target === entry.target.id);
      if (!link || !entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.remove("active"));
      link.classList.add("active");
    });
  }, { threshold: 0, rootMargin: "-45% 0px -45% 0px" });

  sectionEls.forEach((el) => spyObserver.observe(el));
}

function renderSections(sections) {
  const main = document.getElementById("menu-sections");
  itemsById = {};

  main.innerHTML = sections.map((section, i) => {
    const color = SECTION_COLORS[i % SECTION_COLORS.length];
    const icon = ICONS[section.icon] || ICONS.plate;
    const showPhoto = Boolean(section.featuredImageAlt);

    const dishes = (section.items || []).map((item, idx) => {
      const id = `${section.id}__${idx}`;
      itemsById[id] = {
        name: item.name,
        price: parsePrice(item.price),
        section: section.title
      };

      // Si el plato no tiene foto propia (columna "Imagen" del Sheet
      // vacía), no reservamos hueco de imagen: tarjeta compacta, sin
      // placeholder repetido. En cuanto le pongan una foto en el Sheet
      // —a un plato de siempre o a uno nuevo— pasa sola a la versión
      // con foto grande, sin tocar el código.
      const hasPhoto = Boolean(item.image);

      return `
        <article class="dish-card${hasPhoto ? "" : " no-photo"}" data-id="${id}">
          ${hasPhoto ? `<div class="dish-photo">${photoBlock(item.image, item.name)}</div>` : ""}
          <div class="dish-content">
            <div class="dish-text">
              <h3 class="dish-name">${escapeHtml(item.name)}</h3>
              ${item.description ? `<p class="dish-desc">${escapeHtml(item.description)}</p>` : ""}
            </div>
            <div class="dish-actions-row">
              <span class="dish-price">${escapeHtml(formatDisplayPrice(item.price))}</span>
              <span class="dish-actions-slot" data-actions-for="${id}">${renderDishActions(id)}</span>
            </div>
          </div>
        </article>`;
    }).join("");

    return `
      <section class="menu-section" id="${escapeHtml(section.id)}" style="--section-color:${color}">
        <div class="section-heading">
          ${icon}
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        ${showPhoto ? `<div class="section-photo">${photoBlock(section.featuredImage, section.featuredImageAlt)}</div>` : ""}
        <div class="dishes-grid">${dishes}</div>
      </section>
    `;
  }).join("");

  renderCartUI();
}

async function loadFromSheet(url) {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
  const text = await res.text();
  const rows = parseCSV(text);
  return sheetRowsToSections(rows);
}

async function loadFromLocalJSON() {
  const res = await fetch(`${JSON_URL}?v=${Date.now()}`, { cache: "no-store" });
  const data = await res.json();
  return data;
}

async function init() {
  renderSkeleton();
  try {
    let restaurant, sections, footer;

    if (typeof SHEET_CSV_URL === "string" && SHEET_CSV_URL.trim()) {
      // Contenido dinámico desde el Google Sheet. Los textos fijos
      // (cabecera, nota, pie) siguen viniendo de menu.json.
      const local = await loadFromLocalJSON();
      restaurant = local.restaurant || {};
      footer = local.footer || "";
      sections = await loadFromSheet(SHEET_CSV_URL);
    } else {
      const local = await loadFromLocalJSON();
      restaurant = local.restaurant || {};
      footer = local.footer || "";
      sections = local.sections || [];
    }

    renderHero(restaurant);
    renderNav(sections);
    renderSections(sections);
    document.getElementById("footer-text").textContent = footer;
    setupScrollAnimations(sections);
  } catch (err) {
    document.getElementById("menu-sections").innerHTML =
      `<p style="color:#6b6b6b;text-align:center;padding:40px 10px;">
        No se ha podido cargar el menú en este momento. Vuelve a intentarlo en unos segundos.
      </p>`;
    console.error("Error cargando el menú", err);
  }
}

setupCartUI();
init();
