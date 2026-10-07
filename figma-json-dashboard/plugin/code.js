// =============================================================================
// JSON Dashboard — motor del plugin (sandbox de Figma)
// Recibe el JSON desde ui.html y dibuja un dashboard genérico con Auto Layout.
// =============================================================================

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

// -----------------------------------------------------------------------------
// Configuración y tokens de diseño
// -----------------------------------------------------------------------------
const CONFIG = {
  DASHBOARD_WIDTH: 1200,
  MAX_DEPTH: 4,        // niveles de anidación que se dibujan como tarjetas
  MAX_ROWS: 50,        // filas máximas por tabla
  MAX_COLS: 8,         // columnas máximas por tabla
  MAX_CHIPS: 60,       // elementos máximos en listas de primitivos
  MAX_MIXED_ITEMS: 20, // elementos máximos en listas heterogéneas
  MAX_TEXT: 160,       // caracteres máximos por valor
  MAX_NODES: 5000,     // presupuesto total de nodos para proteger el rendimiento
  HISTORY_KEY: 'json-dashboard:history',
  HISTORY_SIZE: 10,
};

const COLORS = {
  page: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  sectionBg: '#FAFBFD',
  border: '#E3E8EF',
  header: '#0B1F3A',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  onDark: '#FFFFFF',
  onDarkMuted: '#A9B8CF',
  brand: '#2563EB',
  brandSoft: '#EAF1FF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  purple: '#7C3AED',
};

let FONTS = {
  regular: { family: 'Inter', style: 'Regular' },
  medium: { family: 'Inter', style: 'Medium' },
  semibold: { family: 'Inter', style: 'Semi Bold' },
  bold: { family: 'Inter', style: 'Bold' },
};

const FALLBACK_FONTS = {
  regular: { family: 'Roboto', style: 'Regular' },
  medium: { family: 'Roboto', style: 'Medium' },
  semibold: { family: 'Roboto', style: 'Medium' },
  bold: { family: 'Roboto', style: 'Bold' },
};

let nodeCount = 0;
let budgetExceeded = false;

// -----------------------------------------------------------------------------
// Utilidades de estilo
// -----------------------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function solid(hex, opacity) {
  return { type: 'SOLID', color: hexToRgb(hex), opacity: opacity === undefined ? 1 : opacity };
}

const SHADOW = {
  type: 'DROP_SHADOW',
  color: { r: 0.06, g: 0.09, b: 0.16, a: 0.06 },
  offset: { x: 0, y: 2 },
  radius: 6,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL',
};

function budgetLeft() {
  if (nodeCount >= CONFIG.MAX_NODES) budgetExceeded = true;
  return !budgetExceeded;
}

/** Crea un frame con Auto Layout. */
function makeFrame(name, o) {
  o = o || {};
  const f = figma.createFrame();
  nodeCount++;
  f.name = name;
  f.layoutMode = o.dir || 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = o.gap || 0;

  const p = o.padding === undefined ? 0 : o.padding;
  const [pt, pr, pb, pl] = Array.isArray(p)
    ? (p.length === 2 ? [p[0], p[1], p[0], p[1]] : p)
    : [p, p, p, p];
  f.paddingTop = pt; f.paddingRight = pr; f.paddingBottom = pb; f.paddingLeft = pl;

  f.fills = o.fill ? [solid(o.fill, o.fillOpacity)] : [];
  if (o.radius) f.cornerRadius = o.radius;
  if (o.stroke) {
    f.strokes = [solid(o.stroke)];
    f.strokeWeight = 1;
    f.strokeAlign = 'INSIDE';
  }
  if (o.bottomBorder) {
    f.strokes = [solid(o.bottomBorder)];
    f.strokeAlign = 'INSIDE';
    f.strokeTopWeight = 0;
    f.strokeLeftWeight = 0;
    f.strokeRightWeight = 0;
    f.strokeBottomWeight = 1;
  }
  if (o.shadow) f.effects = [SHADOW];
  if (o.align) f.counterAxisAlignItems = o.align;     // MIN | CENTER | MAX
  if (o.justify) f.primaryAxisAlignItems = o.justify; // MIN | CENTER | MAX | SPACE_BETWEEN
  if (o.wrap) {
    f.layoutWrap = 'WRAP';
    f.counterAxisSpacing = o.wrapGap === undefined ? f.itemSpacing : o.wrapGap;
  }
  f.clipsContent = !!o.clip;
  return f;
}

/** Crea un nodo de texto. */
function makeText(content, o) {
  o = o || {};
  const t = figma.createText();
  nodeCount++;
  t.fontName = FONTS[o.weight || 'regular'];
  t.characters = String(content);
  t.fontSize = o.size || 13;
  t.fills = [solid(o.color || COLORS.textPrimary)];
  if (o.lineHeight) t.lineHeight = { value: o.lineHeight, unit: 'PIXELS' };
  if (o.upper) t.textCase = 'UPPER';
  if (o.tracking) t.letterSpacing = { value: o.tracking, unit: 'PERCENT' };
  if (o.name) t.name = o.name;
  return t;
}

/** Agrega un hijo a un padre con Auto Layout y opcionalmente lo estira. */
function add(parent, child, o) {
  parent.appendChild(child);
  if (o && o.fillX) child.layoutSizingHorizontal = 'FILL';
  if (o && o.fillY) child.layoutSizingVertical = 'FILL';
  if (child.type === 'TEXT' && o && o.fillX) {
    child.textAutoResize = 'HEIGHT';
    if (o.maxLines) {
      child.textTruncation = 'ENDING';
      child.maxLines = o.maxLines;
    }
  }
  return child;
}

function makePill(label, bg, fg, o) {
  o = o || {};
  const pill = makeFrame('Badge', {
    dir: 'HORIZONTAL',
    padding: [3, 10],
    radius: 999,
    fill: bg,
    fillOpacity: o.bgOpacity,
    align: 'CENTER',
  });
  add(pill, makeText(label, { size: 11, weight: 'semibold', color: fg }));
  return pill;
}

// -----------------------------------------------------------------------------
// Utilidades de datos
// -----------------------------------------------------------------------------
function typeOf(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // string | number | boolean | object
}

function isPrimitive(v) {
  const t = typeOf(v);
  return t !== 'object' && t !== 'array';
}

function arrayKind(arr) {
  if (arr.length === 0) return 'empty';
  if (arr.every((x) => typeOf(x) === 'object')) return 'objects';
  if (arr.every(isPrimitive)) return 'primitives';
  return 'mixed';
}

/** "fechaAlta" / "fecha_alta" / "FECHA-ALTA" → "Fecha alta" */
function humanize(key) {
  const s = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(key);
}

function truncate(s, max) {
  s = String(s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function summarize(v) {
  const t = typeOf(v);
  if (t === 'array') return '[' + v.length + (v.length === 1 ? ' elemento]' : ' elementos]');
  if (t === 'object') {
    const n = Object.keys(v).length;
    return '{' + n + (n === 1 ? ' campo}' : ' campos}');
  }
  return String(v);
}

/** Devuelve texto + estilo según el tipo del valor. */
function formatValue(v) {
  switch (typeOf(v)) {
    case 'null':
      return { text: 'null', color: COLORS.textMuted, weight: 'regular' };
    case 'boolean':
      return { text: v ? 'true' : 'false', color: v ? COLORS.success : COLORS.danger, weight: 'semibold', bool: true };
    case 'number':
      return { text: String(v), color: COLORS.brand, weight: 'medium' };
    case 'string':
      return v === ''
        ? { text: '—', color: COLORS.textMuted, weight: 'regular' }
        : { text: truncate(v, CONFIG.MAX_TEXT), color: COLORS.textPrimary, weight: 'regular' };
    default:
      return { text: summarize(v), color: COLORS.purple, weight: 'medium' };
  }
}

function collectStats(root) {
  const stats = { fields: 0, objects: 0, arrays: 0, maxRecords: 0 };
  const stack = [root];
  let guard = 0;
  while (stack.length && guard++ < 100000) {
    const v = stack.pop();
    const t = typeOf(v);
    if (t === 'array') {
      stats.arrays++;
      stats.maxRecords = Math.max(stats.maxRecords, v.length);
      for (const x of v) stack.push(x);
    } else if (t === 'object') {
      stats.objects++;
      for (const k in v) stack.push(v[k]);
    } else {
      stats.fields++;
    }
  }
  return stats;
}

function timestamp() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function titleFromUrl(url) {
  try {
    const clean = url.split('?')[0].replace(/\/+$/, '');
    const last = clean.split('/').pop();
    return last ? humanize(last) : 'Respuesta JSON';
  } catch (e) {
    return 'Respuesta JSON';
  }
}

// -----------------------------------------------------------------------------
// Componentes del dashboard
// -----------------------------------------------------------------------------

/** Tarjeta con cabecera (título, subtítulo, badge) y cuerpo. */
function makeCard(title, o) {
  o = o || {};
  const card = makeFrame('Card · ' + title, {
    fill: COLORS.surface,
    radius: 12,
    stroke: COLORS.border,
    shadow: true,
    clip: true,
  });

  const header = add(card, makeFrame('Card header', {
    dir: 'HORIZONTAL',
    padding: [14, 20],
    gap: 10,
    align: 'CENTER',
    bottomBorder: COLORS.border,
  }), { fillX: true });

  const titles = add(header, makeFrame('Titles', { gap: 2 }), { fillX: true });
  add(titles, makeText(title, { size: 15, weight: 'semibold' }), { fillX: true, maxLines: 1 });
  if (o.subtitle) {
    add(titles, makeText(o.subtitle, { size: 11, color: COLORS.textMuted }), { fillX: true, maxLines: 1 });
  }
  if (o.badge) add(header, makePill(o.badge, COLORS.brandSoft, COLORS.brand));

  const body = add(card, makeFrame('Card body', {}), { fillX: true });
  return { card, body };
}

/** Lista de filas clave/valor (zebra, borde inferior). */
function makeKeyValueList(entries) {
  const list = makeFrame('Key/Value list', {});
  entries.forEach(([key, value], i) => {
    if (!budgetLeft()) return;
    const row = add(list, makeFrame('Row · ' + key, {
      dir: 'HORIZONTAL',
      padding: [10, 20],
      gap: 16,
      align: 'CENTER',
      fill: i % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt,
      bottomBorder: i < entries.length - 1 ? COLORS.border : undefined,
    }), { fillX: true });

    const keyCol = add(row, makeFrame('Key', { gap: 1 }));
    keyCol.layoutSizingHorizontal = 'FIXED';
    keyCol.resize(240, keyCol.height);
    add(keyCol, makeText(humanize(key), { size: 12, weight: 'medium', color: COLORS.textSecondary }), { fillX: true, maxLines: 1 });
    // Muestra la clave original debajo de la etiqueta legible cuando difieren
    if (humanize(key) !== String(key)) {
      add(keyCol, makeText(key, { size: 10, color: COLORS.textMuted }), { fillX: true, maxLines: 1 });
    }

    const fv = formatValue(value);
    if (fv.bool) {
      add(row, makePill(fv.text, value ? COLORS.successSoft : COLORS.dangerSoft, fv.color));
    } else {
      add(row, makeText(fv.text, { size: 13, weight: fv.weight, color: fv.color }), { fillX: true, maxLines: 3 });
    }
  });
  return list;
}

/** Tabla para arreglos de objetos. */
function makeTable(rows) {
  const table = makeFrame('Table', {});
  const visible = rows.slice(0, CONFIG.MAX_ROWS);

  // Unión de claves (orden de aparición)
  const allCols = [];
  visible.forEach((r) => Object.keys(r).forEach((k) => { if (allCols.indexOf(k) === -1) allCols.push(k); }));
  const cols = allCols.slice(0, CONFIG.MAX_COLS);

  // Cabecera
  const head = add(table, makeFrame('Table header', {
    dir: 'HORIZONTAL',
    padding: [10, 20],
    gap: 12,
    fill: COLORS.surfaceAlt,
    bottomBorder: COLORS.border,
  }), { fillX: true });
  cols.forEach((c) => {
    add(head, makeText(humanize(c), { size: 11, weight: 'semibold', color: COLORS.textSecondary, upper: true, tracking: 4 }), { fillX: true, maxLines: 1 });
  });

  // Filas
  for (let i = 0; i < visible.length; i++) {
    if (!budgetLeft()) break;
    const r = visible[i];
    const row = add(table, makeFrame('Row ' + (i + 1), {
      dir: 'HORIZONTAL',
      padding: [10, 20],
      gap: 12,
      align: 'CENTER',
      fill: i % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt,
      bottomBorder: i < visible.length - 1 ? COLORS.border : undefined,
    }), { fillX: true });

    cols.forEach((c) => {
      const has = Object.prototype.hasOwnProperty.call(r, c);
      const fv = has ? formatValue(r[c]) : { text: '—', color: COLORS.textMuted, weight: 'regular' };
      add(row, makeText(fv.text, { size: 12, weight: fv.weight, color: fv.color }), { fillX: true, maxLines: 2 });
    });
  }

  const notes = [];
  if (rows.length > visible.length) notes.push('Mostrando ' + visible.length + ' de ' + rows.length + ' registros');
  if (allCols.length > cols.length) notes.push((allCols.length - cols.length) + ' columnas ocultas: ' + truncate(allCols.slice(cols.length).join(', '), 120));
  if (notes.length) add(table, makeFootnote(notes.join(' · ')), { fillX: true });

  return table;
}

/** Chips para arreglos de valores simples. */
function makeChips(values) {
  const wrap = makeFrame('Chips', { dir: 'HORIZONTAL', padding: 16, gap: 8, wrap: true });
  values.slice(0, CONFIG.MAX_CHIPS).forEach((v) => {
    if (!budgetLeft()) return;
    const fv = formatValue(v);
    add(wrap, makePill(truncate(fv.text, 40), COLORS.brandSoft, COLORS.brand));
  });
  if (values.length > CONFIG.MAX_CHIPS) {
    add(wrap, makePill('+' + (values.length - CONFIG.MAX_CHIPS) + ' más', COLORS.surfaceAlt, COLORS.textSecondary));
  }
  return wrap;
}

function makeFootnote(text) {
  const f = makeFrame('Footnote', { padding: [8, 20], fill: COLORS.warningSoft });
  add(f, makeText(text, { size: 11, color: COLORS.warning }), { fillX: true });
  return f;
}

function makeEmpty(text) {
  const f = makeFrame('Empty', { padding: [16, 20] });
  add(f, makeText(text, { size: 12, color: COLORS.textMuted }), { fillX: true });
  return f;
}

/** Contenedor para tarjetas hijas dentro de una tarjeta. */
function makeSections() {
  return makeFrame('Sections', { padding: 16, gap: 16, fill: COLORS.sectionBg });
}

/**
 * Dibuja cualquier valor JSON dentro de `body` (frame vertical).
 * - Primitivos de un objeto → lista clave/valor
 * - Objetos anidados → tarjetas recursivas
 * - Arreglos de objetos → tabla; de primitivos → chips; mixtos → tarjetas por elemento
 */
function renderValueInto(body, value, depth) {
  if (!budgetLeft()) return;
  const t = typeOf(value);

  if (t === 'array') {
    renderArrayInto(body, value, depth);
    return;
  }
  if (t !== 'object') {
    add(body, makeKeyValueList([['valor', value]]), { fillX: true });
    return;
  }

  const entries = Object.keys(value).map((k) => [k, value[k]]);
  if (entries.length === 0) {
    add(body, makeEmpty('Objeto vacío'), { fillX: true });
    return;
  }

  const primitives = entries.filter(([, v]) => isPrimitive(v));
  const complex = entries.filter(([, v]) => !isPrimitive(v));

  if (primitives.length) add(body, makeKeyValueList(primitives), { fillX: true });

  if (complex.length) {
    if (depth >= CONFIG.MAX_DEPTH) {
      // Demasiado profundo: resumir en lugar de seguir anidando tarjetas
      add(body, makeKeyValueList(complex.map(([k, v]) => [k, truncate(JSON.stringify(v), CONFIG.MAX_TEXT)])), { fillX: true });
      return;
    }
    const sections = add(body, makeSections(), { fillX: true });
    complex.forEach(([k, v]) => {
      if (!budgetLeft()) return;
      add(sections, makeSectionCard(k, v, depth + 1), { fillX: true });
    });
  }
}

function renderArrayInto(body, arr, depth) {
  const kind = arrayKind(arr);
  if (kind === 'empty') {
    add(body, makeEmpty('Sin elementos'), { fillX: true });
  } else if (kind === 'objects') {
    add(body, makeTable(arr), { fillX: true });
  } else if (kind === 'primitives') {
    add(body, makeChips(arr), { fillX: true });
  } else {
    const sections = add(body, makeSections(), { fillX: true });
    arr.slice(0, CONFIG.MAX_MIXED_ITEMS).forEach((item, i) => {
      if (!budgetLeft()) return;
      add(sections, makeSectionCard('Elemento ' + (i + 1), item, depth + 1), { fillX: true });
    });
    if (arr.length > CONFIG.MAX_MIXED_ITEMS) {
      add(body, makeFootnote('Mostrando ' + CONFIG.MAX_MIXED_ITEMS + ' de ' + arr.length + ' elementos'), { fillX: true });
    }
  }
}

function makeSectionCard(key, value, depth) {
  const t = typeOf(value);
  let subtitle;
  let badge;
  if (t === 'array') {
    badge = value.length + (value.length === 1 ? ' registro' : ' registros');
    subtitle = key;
  } else if (t === 'object') {
    const n = Object.keys(value).length;
    badge = n + (n === 1 ? ' campo' : ' campos');
    subtitle = key;
  } else {
    subtitle = key;
  }
  const { card, body } = makeCard(humanize(key), { subtitle, badge });
  renderValueInto(body, value, depth);
  return card;
}

// ---- Cabecera y KPIs --------------------------------------------------------
function makeHeader(meta) {
  const header = makeFrame('Header', {
    dir: 'HORIZONTAL',
    padding: [24, 32],
    gap: 24,
    align: 'CENTER',
    fill: COLORS.header,
  });

  const left = add(header, makeFrame('Title block', { gap: 6 }), { fillX: true });
  add(left, makeText('ENTORNO DE PRUEBAS · DATA EXPLORER', { size: 11, weight: 'semibold', color: COLORS.onDarkMuted, tracking: 8 }));
  add(left, makeText(meta.title || titleFromUrl(meta.url), { size: 24, weight: 'bold', color: COLORS.onDark }), { fillX: true, maxLines: 1 });
  add(left, makeText(meta.url, { size: 12, color: COLORS.onDarkMuted }), { fillX: true, maxLines: 1 });

  const right = add(header, makeFrame('Meta', { dir: 'HORIZONTAL', gap: 8, align: 'CENTER' }));
  const ok = meta.status >= 200 && meta.status < 300;
  add(right, makePill((meta.method || 'GET') + ' · ' + meta.status, ok ? COLORS.successSoft : COLORS.warningSoft, ok ? COLORS.success : COLORS.warning));
  add(right, makePill(timestamp(), '#FFFFFF', COLORS.onDark, { bgOpacity: 0.12 }));
  return header;
}

function makeKpiTile(label, value, accent) {
  const tile = makeFrame('KPI · ' + label, {
    padding: [16, 20],
    gap: 6,
    fill: COLORS.surface,
    radius: 12,
    stroke: COLORS.border,
    shadow: true,
  });
  const bar = figma.createRectangle();
  nodeCount++;
  bar.name = 'Accent';
  bar.resize(28, 4);
  bar.cornerRadius = 2;
  bar.fills = [solid(accent)];
  add(tile, bar);
  add(tile, makeText(label, { size: 11, weight: 'semibold', color: COLORS.textSecondary, upper: true, tracking: 4 }), { fillX: true, maxLines: 1 });
  add(tile, makeText(value, { size: 26, weight: 'bold', color: COLORS.textPrimary }), { fillX: true, maxLines: 1 });
  return tile;
}

function makeKpiRow(data, meta) {
  const s = collectStats(data);
  const row = makeFrame('KPIs', { dir: 'HORIZONTAL', gap: 16 });
  const tiles = [
    ['Tipo raíz', typeOf(data) === 'array' ? 'Lista' : typeOf(data) === 'object' ? 'Objeto' : 'Valor', COLORS.purple],
    ['Campos (valores)', String(s.fields), COLORS.brand],
    ['Registros máx. en lista', String(s.maxRecords), COLORS.success],
    ['Tiempo de respuesta', (meta.elapsedMs !== undefined ? meta.elapsedMs : '—') + ' ms', COLORS.warning],
  ];
  tiles.forEach(([l, v, c]) => add(row, makeKpiTile(l, v, c), { fillX: true }));
  return row;
}

// -----------------------------------------------------------------------------
// Construcción principal
// -----------------------------------------------------------------------------
async function loadFonts() {
  try {
    await Promise.all(Object.values(FONTS).map((f) => figma.loadFontAsync(f)));
  } catch (e) {
    FONTS = FALLBACK_FONTS;
    await Promise.all(Object.values(FONTS).map((f) => figma.loadFontAsync(f)));
  }
}

async function buildDashboard(data, meta) {
  nodeCount = 0;
  budgetExceeded = false;
  await loadFonts();

  const root = makeFrame('Dashboard · ' + (meta.title || titleFromUrl(meta.url)), {
    fill: COLORS.page,
    radius: 16,
    clip: true,
  });
  root.counterAxisSizingMode = 'FIXED';
  root.resize(CONFIG.DASHBOARD_WIDTH, 100);
  root.primaryAxisSizingMode = 'AUTO';
  figma.currentPage.appendChild(root);

  add(root, makeHeader(meta), { fillX: true });
  const body = add(root, makeFrame('Body', { padding: 32, gap: 24 }), { fillX: true });

  add(body, makeKpiRow(data, meta), { fillX: true });

  const t = typeOf(data);
  if (t === 'object') {
    const keys = Object.keys(data);
    const primitives = keys.filter((k) => isPrimitive(data[k]));
    const complex = keys.filter((k) => !isPrimitive(data[k]));

    if (primitives.length) {
      const { card, body: cardBody } = makeCard('Resumen general', {
        subtitle: 'Propiedades de primer nivel',
        badge: primitives.length + ' campos',
      });
      add(cardBody, makeKeyValueList(primitives.map((k) => [k, data[k]])), { fillX: true });
      add(body, card, { fillX: true });
    }
    complex.forEach((k) => {
      if (!budgetLeft()) return;
      add(body, makeSectionCard(k, data[k], 1), { fillX: true });
    });
    if (!keys.length) add(body, makeEmpty('La respuesta es un objeto vacío.'), { fillX: true });
  } else if (t === 'array') {
    add(body, makeSectionCard('Resultados', data, 1), { fillX: true });
  } else {
    const { card, body: cardBody } = makeCard('Respuesta', { subtitle: 'Valor simple' });
    add(cardBody, makeKeyValueList([['valor', data]]), { fillX: true });
    add(body, card, { fillX: true });
  }

  if (budgetExceeded) {
    add(body, makeFootnote('Se alcanzó el límite de ' + CONFIG.MAX_NODES + ' elementos; parte de la respuesta no se dibujó.'), { fillX: true });
  }

  // Posicionar en el centro de la vista actual y enfocar
  const center = figma.viewport.center;
  root.x = Math.round(center.x - root.width / 2);
  root.y = Math.round(center.y - root.height / 2);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);

  return { nodes: nodeCount, truncated: budgetExceeded };
}

// -----------------------------------------------------------------------------
// Historial de URLs (clientStorage) y mensajes de la UI
// -----------------------------------------------------------------------------
async function sendHistory() {
  const items = (await figma.clientStorage.getAsync(CONFIG.HISTORY_KEY)) || [];
  figma.ui.postMessage({ type: 'history', items });
}

async function saveHistory(url) {
  const items = (await figma.clientStorage.getAsync(CONFIG.HISTORY_KEY)) || [];
  const next = [url].concat(items.filter((u) => u !== url)).slice(0, CONFIG.HISTORY_SIZE);
  await figma.clientStorage.setAsync(CONFIG.HISTORY_KEY, next);
  figma.ui.postMessage({ type: 'history', items: next });
}

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'save-history') {
    await saveHistory(msg.url);
    return;
  }

  if (msg.type === 'render-json') {
    try {
      const stats = await buildDashboard(msg.data, msg.meta || {});
      figma.notify('Dashboard generado (' + stats.nodes + ' elementos)' + (stats.truncated ? ' — truncado' : ''));
      figma.ui.postMessage({ type: 'render-done', stats });
    } catch (err) {
      console.error(err);
      figma.notify('Error al generar el dashboard: ' + err.message, { error: true });
      figma.ui.postMessage({ type: 'render-error', message: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (msg.type === 'close') figma.closePlugin();
};

sendHistory();
