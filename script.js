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
// Los 3 colores son, a propósito, los 3 colores del logo (rosa, morado,
// naranja de la sonrisa), para que la web se sienta más "de la marca".
const SECTION_COLORS = ["#e6007e", "#5b2c87", "#e07200"];

// Icono conocido para las secciones originales. Cualquier sección nueva
// que se añada desde el Sheet (con un nombre distinto) recibe el icono
// genérico "plate" automáticamente.
const KNOWN_SECTION_ICONS = {
  "desayunos": "toast",
  "los favoritos": "star",
  "picoteo": "share",
  "postres": "cone",
  "postres · kürtőskalács": "cone",
  "postres/kürtőskalács": "cone",
  "complementos · kürtőskalács": "fruit",
  "complementos/kürtőskalács": "fruit",
  "bebidas con alcohol": "beer",
  "bebidas sin alcohol": "drink",
  "bocadillos": "sandwich"
};

// Iconos Font Awesome (vía CDN, cargado en index.html) en vez de SVG
// dibujados a mano. La clase "fa-icon" es la que engancha con el tamaño
// y color definidos en style.css (los mismos sitios de siempre: cabecera
// de sección, botón "Añadir", placeholder de foto, carrito).
const ICONS = {
  toast: `<i class="fa-solid fa-bread-slice fa-icon" aria-hidden="true"></i>`,
  star: `<i class="fa-solid fa-star fa-icon" aria-hidden="true"></i>`,
  share: `<i class="fa-solid fa-utensils fa-icon" aria-hidden="true"></i>`,
  cone: `<i class="fa-solid fa-ice-cream fa-icon" aria-hidden="true"></i>`,
  fruit: `<i class="fa-solid fa-apple-whole fa-icon" aria-hidden="true"></i>`,
  beer: `<i class="fa-solid fa-beer-mug-empty fa-icon" aria-hidden="true"></i>`,
  drink: `<i class="fa-solid fa-glass-water fa-icon" aria-hidden="true"></i>`,
  sandwich: `<i class="fa-solid fa-hotdog fa-icon" aria-hidden="true"></i>`,
  plate: `<i class="fa-solid fa-bowl-food fa-icon" aria-hidden="true"></i>`,
  camera: `<i class="fa-solid fa-camera fa-icon" aria-hidden="true"></i>`,
  plus: `<i class="fa-solid fa-plus fa-icon" aria-hidden="true"></i>`
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

// La sección de Postres es el producto estrella (Kürtőskalács): en vez de
// pintar sus "sabores" como platos sueltos en la rejilla normal, se
// consolidan en UNA tarjeta con un selector de sabor/topping tipo pill.
// No cambia nada de los datos (siguen siendo 5 platos independientes con
// su propio id/precio para el carrito) ni del carrito — solo cambia cómo
// se pintan. Si el nombre de la sección cambia y deja de coincidir aquí,
// cae solo en la rejilla normal, sin romper nada.
const FLAGSHIP_SWITCHER_SECTIONS = new Set([
  "postres",
  "postres · kürtőskalács",
  "postres/kürtőskalács"
]);

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
    const items = section.items || [];

    const isFlagship =
      FLAGSHIP_SWITCHER_SECTIONS.has(section.title.trim().toLowerCase()) && items.length > 1;

    // Se rellena itemsById para TODOS los platos igual que siempre —
    // el selector de sabor de más abajo reutiliza estos mismos ids, no
    // crea ningún dato ni lógica de carrito nueva.
    const dishes = items.map((item, idx) => {
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

    const bodyHtml = isFlagship
      ? renderFlagshipCard(section, items)
      : `<div class="dishes-grid">${dishes}</div>`;

    return `
      <section class="menu-section" id="${escapeHtml(section.id)}" style="--section-color:${color}">
        <div class="section-heading">
          ${icon}
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        ${!isFlagship && showPhoto ? `<div class="section-photo">${photoBlock(section.featuredImage, section.featuredImageAlt)}</div>` : ""}
        ${bodyHtml}
      </section>
    `;
  }).join("");

  renderCartUI();
  setupFlagshipSwitchers();
}

// Tarjeta única del producto estrella con selector de sabor/topping tipo
// pill (segmented control). Cada pill sigue siendo, por debajo, uno de
// los platos normales de la sección (mismo id `${section.id}__${idx}`,
// mismo precio, mismo carrito) — solo se agrupan visualmente en una
// tarjeta en vez de repetirse 5 veces en la rejilla.
function renderFlagshipCard(section, items) {
  const first = items[0];
  const firstId = `${section.id}__0`;
  const photo = section.featuredImage
    ? `<div class="flagship-photo">${photoBlock(section.featuredImage, section.featuredImageAlt)}</div>`
    : "";

  const chips = items.map((item, idx) => {
    const id = `${section.id}__${idx}`;
    return `
      <button
        type="button"
        class="topping-chip${idx === 0 ? " is-active" : ""}"
        role="tab"
        aria-selected="${idx === 0 ? "true" : "false"}"
        data-id="${id}"
        data-name="${escapeHtml(item.name)}"
        data-desc="${escapeHtml(item.description || "")}"
        data-price-display="${escapeHtml(formatDisplayPrice(item.price))}"
      >${escapeHtml(item.name)}</button>`;
  }).join("");

  return `
    <article class="flagship-card">
      ${photo}
      <div class="flagship-content">
        <h3 class="flagship-name">${escapeHtml(section.title.split("·").pop().split("/").pop().trim())}</h3>
        <p class="flagship-desc" data-flagship-desc>${escapeHtml(first.description || "")}</p>

        <p class="topping-label">Elige tu sabor</p>
        <div class="topping-picker" role="tablist" aria-label="Elige tu sabor" data-topping-picker>
          <div class="topping-picker-indicator" data-topping-indicator aria-hidden="true"></div>
          ${chips}
        </div>

        <div class="dish-actions-row">
          <span class="dish-price" data-flagship-price>${escapeHtml(formatDisplayPrice(first.price))}</span>
          <span class="dish-actions-slot" data-actions-for="${firstId}">${renderDishActions(firstId)}</span>
        </div>
      </div>
    </article>`;
}

// Interacción del selector de sabor: mueve el indicador deslizante al
// chip pulsado (misma curva que el resto de transiciones del sitio) y
// hace un fundido corto de texto/precio en vez de un salto seco. Respeta
// prefers-reduced-motion (definido en CSS: el indicador solo cambia de
// opacidad, sin desplazamiento). No inventa carrito propio: al cambiar de
// sabor, simplemente apunta el slot de acciones al id de ESE sabor y
// reutiliza renderDishActions(), que ya sabe si ese sabor concreto está
// en la selección o no.
function setupFlagshipSwitchers() {
  document.querySelectorAll("[data-topping-picker]").forEach((picker) => {
    const indicator = picker.querySelector("[data-topping-indicator]");
    const chips = Array.from(picker.querySelectorAll(".topping-chip"));
    const card = picker.closest(".flagship-card");
    const descEl = card.querySelector("[data-flagship-desc]");
    const priceEl = card.querySelector("[data-flagship-price]");
    const actionsSlot = card.querySelector(".dish-actions-slot");

    function moveIndicator(chip, animate) {
      const pRect = picker.getBoundingClientRect();
      const cRect = chip.getBoundingClientRect();
      if (!animate) indicator.style.transition = "none";
      indicator.style.width = `${cRect.width}px`;
      indicator.style.transform = `translateX(${cRect.left - pRect.left - 5}px)`;
      if (!animate) {
        // Fuerza el reflow antes de devolver la transición normal, para
        // que este primer posicionado nunca se anime desde 0.
        void indicator.offsetWidth;
        indicator.style.transition = "";
      }
    }

    function selectChip(chip) {
      if (chip.classList.contains("is-active")) return;
      chips.forEach((c) => { c.classList.remove("is-active"); c.setAttribute("aria-selected", "false"); });
      chip.classList.add("is-active");
      chip.setAttribute("aria-selected", "true");
      moveIndicator(chip, true);

      // El chip pulsado siempre queda totalmente visible dentro del
      // selector (antes se podía quedar cortado a un lado si el picker
      // estaba desplazado). "nearest"/"nearest" evita que además salte
      // la página entera hacia ese punto.
      if (typeof chip.scrollIntoView === "function") {
        chip.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "nearest",
          inline: "nearest"
        });
      }

      descEl.style.opacity = "0";
      window.setTimeout(() => {
        descEl.textContent = chip.dataset.desc;
        priceEl.textContent = chip.dataset.priceDisplay;
        descEl.style.opacity = "1";
      }, 120);

      actionsSlot.dataset.actionsFor = chip.dataset.id;
      actionsSlot.innerHTML = renderDishActions(chip.dataset.id);
    }

    chips.forEach((chip) => chip.addEventListener("click", () => selectChip(chip)));
    window.addEventListener("resize", () => {
      const active = picker.querySelector(".topping-chip.is-active");
      if (active) moveIndicator(active, false);
    });

    moveIndicator(chips[0], false);
  });
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
