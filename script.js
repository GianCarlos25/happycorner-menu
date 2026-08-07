/* ============================================================
   Happy Corner · Carta digital
   ------------------------------------------------------------
   Este script SOLO lee datos (de menu.json o del Google Sheet
   configurado en config.js) y los pinta en la página.
   Para cambiar el contenido del menú NO hay que tocar este
   archivo — se edita el Google Sheet (o menu.json si aún no
   hay Sheet conectado).
   ============================================================ */

const JSON_URL = "menu.json";

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
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>`
};

// Estas dos secciones conservan su foto destacada preparada en el diseño
// original. Cualquier sección nueva que la clienta añada no lleva foto
// propia (para no tener que decidir diseño por ella).
const SECTIONS_WITH_FEATURED_PHOTO = new Set(["Desayunos", "Postres · Kürtőskalács", "Postres", "Postres/Kürtőskalács"]);

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
      const section = {
        id: title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title,
        icon: KNOWN_SECTION_ICONS[title.trim().toLowerCase()] || "plate",
        featuredImage: null,
        featuredImageAlt: SECTIONS_WITH_FEATURED_PHOTO.has(title) ? title : "",
        items: []
      };
      byTitle.set(title, section);
      sections.push(section);
    }

    byTitle.get(title).items.push({
      name: r["plato"] || r["nombre"] || "",
      description: r["descripción"] || r["descripcion"] || "",
      price: r["precio"] || ""
    });
  });

  return sections;
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

  main.innerHTML = sections.map((section, i) => {
    const color = SECTION_COLORS[i % SECTION_COLORS.length];
    const icon = ICONS[section.icon] || ICONS.plate;
    const showPhoto = Boolean(section.featuredImageAlt);

    const items = (section.items || []).map((item) => `
      <div class="item">
        <div class="item-text">
          <span class="item-name">${escapeHtml(item.name)}</span>
          ${item.description ? `<span class="item-desc">${escapeHtml(item.description)}</span>` : ""}
        </div>
        <div class="item-price">${escapeHtml(item.price)}</div>
      </div>
    `).join("");

    return `
      <section class="menu-section" id="${escapeHtml(section.id)}" style="--section-color:${color}">
        <div class="section-heading">
          ${icon}
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        ${showPhoto ? `<div class="section-photo">${photoBlock(section.featuredImage, section.featuredImageAlt)}</div>` : ""}
        <div class="card">${items}</div>
      </section>
    `;
  }).join("");
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
      `<p style="color:#f2eafc;text-align:center;padding:40px 10px;">
        No se ha podido cargar el menú en este momento. Vuelve a intentarlo en unos segundos.
      </p>`;
    console.error("Error cargando el menú", err);
  }
}

init();
