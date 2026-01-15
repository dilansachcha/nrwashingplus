import "./style.css";
import { apiGet, apiPost, apiPatch } from "./api";

const STATUS_OPTIONS = [
  "RECEIVED",
  "SORTING",
  "WASHING",
  "DRYING",
  "IRONING",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

// ✅ must match Prisma PaymentMethod enum
const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "OTHER"];

// ✅ invoice-level tat types
const INVOICE_TAT_TYPES = ["NORMAL", "ONE_DAY", "EXPRESS"];

// ---------------------------
// State
// ---------------------------
const state = {
  // Auth State
  user: localStorage.getItem('userRole') ? {
    role: localStorage.getItem('userRole'),
    branch: localStorage.getItem('userBranch'),
    name: localStorage.getItem('userName')
  } : null,

  // App State
  branch: localStorage.getItem('userBranch') || "A", // Default to assigned branch
  paid: "",
  status: "",
  yymmdd: yymmddFromDate(new Date()),

  loading: false,
  orders: [],
  selectedOrderCode: null,
  selectedOrder: null,
  toast: null,
  confirm: null,
  modal: null,

  // add item modal
  categories: [],
  categoriesLoading: false,
  selectedCategoryId: "",

  // ✅ simple category -> items dropdown state
  itemLoading: false,
  categoryItems: [],
  selectedItemCode: "",

  // invoice modal
  invoiceTatType: "NORMAL",

  searchQuery: "",
};

// ---------------------------
// Helpers
// ---------------------------
function money(n) {
  const x = Number(n ?? 0);
  return x.toFixed(2);
}

function tatLabel(defaultTatDays) {
  const d = Number(defaultTatDays ?? 0);
  return `NORMAL ${d} day${d === 1 ? "" : "s"}`;
}

function tatRate(t) {
  if (t === "ONE_DAY") return 0.5;
  if (t === "EXPRESS") return 0.85;
  return 0;
}

function calcServiceCharge(subtotal, tatType) {
  const s = Number(subtotal || 0);
  return Number((s * tatRate(tatType)).toFixed(2));
}

function yymmddFromDate(d) {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function dateInputValueFromYYMMDD(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return "";
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  return `20${yy}-${mm}-${dd}`;
}

// ✅ IMPORTANT: must escape quotes too because we use it in value="..."
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ✅ Debounce helper for phone search
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function badge(text, kind = "gray", iconName = null) {
  const map = {
    gray: "bg-slate-200 text-slate-800",
    green: "bg-emerald-200 text-emerald-900",
    red: "bg-rose-200 text-rose-900",
    blue: "bg-sky-200 text-sky-900",
    yellow: "bg-amber-200 text-amber-900",
    purple: "bg-violet-200 text-violet-900",
    orange: "bg-orange-100 text-orange-800",
  };

  const iconHtml = iconName ? `<span class="mr-1 flex items-center">${icon(iconName, "w-3 h-3")}</span>` : "";

  return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center w-fit ${map[kind] ?? map.gray
    }">${iconHtml}${escapeHtml(text)}</span>`;
}

function statusKind(s) {
  if (s === "READY") return "purple";
  if (s === "DELIVERED") return "green";
  if (s === "CANCELLED") return "red";
  if (s === "WASHING" || s === "DRYING" || s === "IRONING") return "blue";
  return "gray";
}

// ✅ Logic to map backend status to UI Label
function getPaymentState(order) {
  const s = order.invoiceStatus; // "NONE", "FINAL", "PAID", "VOID"
  if (!s || s === 'NONE') return 'NO INV';
  if (s === 'FINAL') return 'UNPAID'; // Map FINAL -> UNPAID for UI
  return s; // PAID, VOID return as is
}

// ✅ Color mapping
function invoiceStatusKind(status) {
  switch (status) {
    case 'PAID': return 'green';
    case 'UNPAID': return 'yellow';
    case 'FINAL': return 'yellow';
    case 'NO INV': return 'blue';    // ✅ Blue for No Invoice
    case 'NONE': return 'blue';
    case 'VOID': return 'red';
    default: return 'gray';
  }
}

function paidKind(isPaid) {
  return isPaid ? "green" : "yellow";
}

function setToast(type, msg) {
  state.toast = { type, msg };
  render();
  setTimeout(() => {
    if (state.toast && state.toast.msg === msg) {
      state.toast = null;
      render();
    }
  }, 2500);
}

function setLoading(v) {
  state.loading = v;
  render();
}

function qs(params) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") u.set(k, String(v));
  });
  return u.toString();
}

function getSelectedCatalogItem() {
  return (state.categoryItems || []).find((x) => x.code === state.selectedItemCode) || null;
}

// ---------------------------
// Inline icons (SVG)
// ---------------------------
function icon(name, cls = "w-4 h-4") {
  const common = `class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  switch (name) {
    case "refresh":
      return `<svg ${common}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    case "plus":
      return `<svg ${common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    case "status":
      return `<svg ${common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    case "invoice":
      return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    case "pay": // Generic Banknote (Currency Neutral)
      return `<svg ${common}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`;
    case "home":
      return `<svg ${common}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    case "file-text": // Note
      return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    case "check-circle": // Paid
      return `<svg ${common}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    case "alert-circle": // Pending
      return `<svg ${common}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    case "zap": // Express
      return `<svg ${common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    case "clock": // One Day
      return `<svg ${common}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    case "search":
      return `<svg ${common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    case "chevron-down":
      return `<svg ${common}><polyline points="6 9 12 15 18 9"/></svg>`;
    case "calendar":
      return `<svg ${common}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    default:
      return "";
  }
}

// ---------------------------
// Backend calls
// ---------------------------
async function loadOrdersBoard() {
  try {
    setLoading(true);

    const query = qs({
      branch: state.branch,
      paid: state.paid,
      status: state.status,
      yymmdd: state.yymmdd,
    });

    const data = await apiGet(`/api/orders/today?${query}`);
    state.orders = Array.isArray(data) ? data : [];

    if (state.selectedOrderCode) {
      const stillThere = state.orders.find((o) => o.orderCode === state.selectedOrderCode);
      if (!stillThere) {
        state.selectedOrderCode = null;
        state.selectedOrder = null;
      }
    }
  } catch (e) {
    setToast("error", e.message || "Failed to load orders");
  } finally {
    setLoading(false);
  }
}

async function createNewOrder(payload) {
  try {
    const res = await apiPost("/api/orders", {
      branch: state.branch,
      customerName: payload.name,
      customerPhone: payload.phone,
      customerAddress: payload.address,
      customerNotes: payload.customerNotes, // Note: backend calls it 'customerNotes'    
      notes: payload.notes, // Order notes
      yymmdd: payload.yymmdd, // ✅ SEND THE DATE
    });
    setToast("success", `Created: ${res.orderCode}`);

    state.selectedOrderCode = res.orderCode;
    await loadOrdersBoard();
    await loadOrderDetails(res.orderCode);
  } catch (e) {
    setToast("error", e.message || "Failed to create order");
  }
}

async function lookupCustomerByPhone(phone) {
  try {
    const res = await apiGet(`/api/orders?q=${encodeURIComponent(phone)}`);
    if (Array.isArray(res) && res.length > 0) {
      const first = res[0];

      // 1. Nested Check (Safety fallback)
      if (first.customer && first.customer.phone.includes(phone)) {
        return first.customer;
      }

      // 2. Flattened Check (Standard Search)
      if (first.customerName && (first.customerPhone || "").includes(phone)) {
        return {
          name: first.customerName,
          phone: first.customerPhone,
          // ✅ READ THE NEW FIELDS HERE
          address: first.customerAddress || "",
          notes: first.customerNotes || ""
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function loadOrderDetails(orderCode) {
  try {
    state.selectedOrderCode = orderCode;
    render();
    const order = await apiGet(`/api/orders/${encodeURIComponent(orderCode)}`);
    state.selectedOrder = order;
    render();
  } catch (e) {
    setToast("error", e.message || "Failed to load order details");
  }
}

async function updateOrderStatus(orderCode, newStatus) {
  try {
    await apiPatch(`/api/orders/${encodeURIComponent(orderCode)}/status`, { status: newStatus });
    setToast("success", `Status updated: ${newStatus}`);
    await loadOrdersBoard();
    await loadOrderDetails(orderCode);
  } catch (e) {
    setToast("error", e.message || "Failed to update status");
  }
}

async function createInvoice(orderCode, discount = 0, tatType = "NORMAL") {
  try {
    const inv = await apiPost(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
      discount: Number(discount || 0),
      tatType,
    });
    setToast("success", `Invoice created: ${inv.invoiceNo ?? "OK"}`);
    await loadOrdersBoard();
    await loadOrderDetails(orderCode);
  } catch (e) {
    setToast("error", e.message || "Failed to create invoice");
  }
}

async function payInvoice(invoiceNo, paymentMethod, paidAmount) {
  try {
    const res = await apiPost(`/api/invoices/${encodeURIComponent(invoiceNo)}/pay`, {
      paymentMethod,
      paidAmount: Number(paidAmount),
    });
    setToast("success", `Paid: ${res.invoiceNo ?? invoiceNo}`);
    await loadOrdersBoard();
    if (state.selectedOrderCode) await loadOrderDetails(state.selectedOrderCode);
  } catch (e) {
    setToast("error", e.message || "Failed to pay invoice");
  }
}

async function addItemToOrder(orderCode, itemCode, qty) {
  try {
    await apiPost(`/api/orders/${encodeURIComponent(orderCode)}/items`, {
      itemCode,
      qty: Number(qty),
    });
    setToast("success", "Item added");
    await loadOrdersBoard();
    await loadOrderDetails(orderCode);
  } catch (e) {
    setToast("error", e.message || "Failed to add item");
  }
}

// ✅ NEW: Professional Thermal Receipt Logic with Speed Label
async function printInvoice(invoiceNo) {
  try {
    const invoice = await apiGet(`/api/invoices/${encodeURIComponent(invoiceNo)}`);
    const order = invoice.order || {};
    const customer = order.customer || { name: "Walk-in", phone: "" };
    const dateStr = new Date(invoice.createdAt).toLocaleString('en-GB');

    const orderStatus = order.status || "UNKNOWN";
    const payStatus = invoice.status || "PENDING";

    const linesHtml = (invoice.lines || []).map(line => `
      <tr style="border-bottom: 1px dotted #888;">
        <td style="padding: 4px 0; vertical-align: top;">
          <div style="font-weight:bold; font-size:11px;">${escapeHtml(line.itemCode)}</div>
          <div style="font-size:9px;">${escapeHtml(line.description)}</div>
        </td>
        <td style="padding: 4px 0; text-align: center; vertical-align: top; font-size:11px;">${Number(line.qty)}</td>
        <td style="padding: 4px 0; text-align: right; vertical-align: top; font-size:11px;">${money(line.lineTotal)}</td>
      </tr>
    `).join('');

    const serviceCharge = Number(invoice.serviceCharge);
    const discount = Number(invoice.discount);

    // ✅ Requirement: Mention Speed in Invoice
    const speedLabel = invoice.tatType !== 'NORMAL' ? `(${invoice.tatType.replace('_', ' ')})` : '';

    let extrasHtml = '';
    if (serviceCharge > 0) {
      extrasHtml += `<div style="display:flex; justify-content:space-between;"><span>Service Chg ${speedLabel}:</span><span>${money(serviceCharge)}</span></div>`;
    }
    if (discount > 0) {
      extrasHtml += `<div style="display:flex; justify-content:space-between;"><span>Discount:</span><span>-${money(discount)}</span></div>`;
    }

    const w = window.open('', '_blank', 'width=360,height=600');
    w.document.write(`
      <html>
      <head>
        <title>Invoice ${invoice.invoiceNo}</title>
        <style>
          @page { margin: 0; size: auto; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 11px; 
            margin: 0; 
            padding: 5px; 
            width: 300px; /* Thermal paper width */
            color: #000;
          }
          .header { text-align: center; margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          .header h2 { margin: 0; font-size: 14px; font-weight: bold; }
          .meta { margin-bottom: 5px; font-size: 10px; }
          .meta div { display: flex; justify-content: space-between; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
          th { text-align: left; border-bottom: 1px solid #000; font-size: 9px; padding-bottom: 2px; }
          
          .totals { border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
          .grand { font-weight: bold; font-size: 13px; border-top: 1px dashed #000; margin-top: 3px; padding-top: 3px; }
          
          .status-box { 
            margin-top: 8px; 
            border: 1px solid #000; 
            padding: 4px; 
            text-align: center; 
            font-size: 10px; 
            font-weight: bold; 
          }
          
          .footer { text-align: center; margin-top: 10px; font-size: 9px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>NR WASHING PLUS</h2>
          <div style="font-size:10px">Mattegoda</div>
          <div style="font-size:9px">07X-XXXXXXX</div>
        </div>
        
        <div class="meta">
          <div><span>Inv: ${invoice.invoiceNo}</span></div>
          <div><span>${dateStr}</span></div>
          <div style="margin-top:3px"><span>Cust: ${escapeHtml(customer.name).substring(0, 30)}</span></div>
          <div><span>Tel: ${escapeHtml(customer.phone || '-')}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 55%">Item</th>
              <th style="width: 15%; text-align: center">Qty</th>
              <th style="width: 30%; text-align: right">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div class="totals">
          <div style="display:flex; justify-content:space-between;">
             <span>Subtotal:</span><span>${money(invoice.subtotal)}</span>
          </div>
          ${extrasHtml}
          <div style="display:flex; justify-content:space-between;" class="grand">
             <span>TOTAL:</span><span>${money(invoice.total)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:3px;">
             <span>Paid:</span><span>${money(invoice.paidAmount)}</span>
          </div>
           <div style="display:flex; justify-content:space-between;">
             <span>Balance:</span><span>${money(invoice.balance)}</span>
          </div>
        </div>

<div class="status-box">
          STATUS: ${orderStatus} <br>
          PAYMENT: ${payStatus === 'FINAL' ? 'UNPAID' : payStatus}
        </div>

        <div class="footer">
          Thank you! Come Again.<br>
          (No refunds after wash)<br>
          Software by DS44
        </div>
        <script>
           window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); } };
        </script>
      </body>
      </html>
    `);
    w.document.close();
  } catch (e) {
    setToast("error", "Failed to print: " + e.message);
  }
}

// ✅ NEW: Final Optimized Print Tags Logic (Stickers)
async function printTags(orderCode) {
  try {
    const order = await apiGet(`/api/orders/${encodeURIComponent(orderCode)}`);
    if (!order || !order.items || order.items.length === 0) {
      return setToast("error", "No items to print tags for");
    }

    const customerName = order.customer?.name || "Walk-in";
    const customerPhone = order.customer?.phone || "";
    // Format: "Name (Phone)" - keep it short
    const custString = `${customerName.substring(0, 17)} (${customerPhone})`;

    const w = window.open('', '_blank', 'width=400,height=600');

    const tagsHtml = order.items.map((item, index) => {
      let itemTags = "";
      // Loop for quantity (print 1 sticker per physical piece)
      for (let i = 1; i <= Number(item.qty); i++) {
        itemTags += `
          <div class="tag">
            <div class="header">${escapeHtml(order.orderCode)}</div>
            
            <div class="customer">${escapeHtml(custString)}</div>
            
            <div class="main-code">${escapeHtml(item.itemCode)}</div>
            
            <div class="footer">
              Item <b>${index + 1}/${order.items.length}</b> &bull; Pc <b>${i}/${item.qty}</b>
            </div>
            
            <div class="cut-line"></div>
          </div>
        `;
      }
      return itemTags;
    }).join('');

    w.document.write(`
      <html>
      <head>
        <title>Tags - ${order.orderCode}</title>
        <style>
          @page { size: auto; margin: 0; }
          body { 
            font-family: sans-serif; 
            margin: 0; 
            padding: 0; 
          }
          .tag {
            width: 40mm;  /* Fits standard small label rolls */
            height: 25mm; /* Fixed height per sticker */
            position: relative;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            page-break-after: always; /* Force printer to see this as new page/label */
            overflow: hidden;
            text-align: center;
            padding-bottom: 2px; /* Space for cut line */
          }

          /* The Order ID - Big & Bold */
          .header { 
            font-size: 15px; 
            font-weight: 900; 
            letter-spacing: -0.5px;
            margin-bottom: 1px;
          }
          
          /* Customer Info - Small but readable */
          .customer { 
            font-size: 8px; 
            font-weight: bold; 
            white-space: nowrap; 
            width: 95%;
            overflow: hidden; 
            text-overflow: ellipsis; 
          }
          
          /* Item Code - The most important operational detail */
          .main-code { 
            font-size: 16px; 
            font-weight: 900; 
            margin: 1px 0; 
            text-transform: uppercase;
          }
          
          /* Counters */
          .footer { 
            font-size: 12px; 
            font-weight: 600;
          }

          /* Visual Cut Line for continuous rolls */
          .cut-line {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            border-bottom: 2px dashed #000;
          }
        </style>
      </head>
      <body>
        ${tagsHtml}
        <script>
           window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); } };
        </script>
      </body>
      </html>
    `);
    w.document.close();
  } catch (e) {
    setToast("error", "Failed to print tags");
  }
}

// ---------------------------
// Catalog (categories + items)
// ---------------------------
async function loadCategories() {
  try {
    state.categoriesLoading = true;
    render();
    const rows = await apiGet("/api/catalog/categories");
    state.categories = Array.isArray(rows) ? rows : [];
  } catch (e) {
    setToast("error", e.message || "Failed to load categories");
  } finally {
    state.categoriesLoading = false;
    render();
  }
}

function normalizeCatalogRows(rows) {
  return (rows || [])
    .map((it) => ({
      code: it.itemCode ?? "",
      name: it.displayName ?? "",
      price: it.basePrice ?? null,
      defaultTatDays: Number(it.defaultTatDays ?? 0),
      isActive: it.isActive ?? true,
      category: it.category ?? null,
    }))
    .filter((x) => x.code);
}

function catalogItemsUrl({ categoryId, limit }) {
  const p = new URLSearchParams();
  p.set("active", "true");
  p.set("limit", String(limit ?? 200));
  if (categoryId) p.set("categoryId", String(categoryId));
  return `/api/catalog/items?${p.toString()}`;
}

async function loadItemsForCategory(categoryId) {
  if (!categoryId) return;
  state.itemLoading = true;
  state.categoryItems = [];
  state.selectedItemCode = "";
  render();

  try {
    const data = await apiGet(catalogItemsUrl({ categoryId, limit: 300 }));
    const rows = Array.isArray(data) ? data : [];
    state.categoryItems = normalizeCatalogRows(rows);
  } catch (e) {
    setToast("error", e.message || "Failed to load category items");
  } finally {
    state.itemLoading = false;
    render();
  }
}

// ---------------------------
// Modal control
// ---------------------------
function openModal(type, data = {}) {
  state.modal = { type, data };

  if (type === "ADD_ITEM") {
    state.selectedCategoryId = "";
    state.itemLoading = false;
    state.categoryItems = [];
    state.selectedItemCode = "";
    if (!state.categories || state.categories.length === 0) loadCategories();
  }

  if (type === "INVOICE") {
    state.invoiceTatType = "NORMAL";
  }

  render();
}

function closeModal() {
  state.modal = null;
  render();
}

// ---------------------------
// UI helpers
// ---------------------------
function uiLabelClass() {
  return "text-xs lg:text-sm text-slate-500 mb-1";
}

function uiDateClass() {
  return "h-11 lg:h-12 w-full border rounded-xl px-3 pr-10 text-sm lg:text-base bg-white cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200";
}

function uiTextInputClass() {
  return "h-11 lg:h-12 w-full border rounded-xl px-3 text-sm lg:text-base bg-white focus:outline-none focus:ring-2 focus:ring-sky-200";
}

function uiSelectClass() {
  return "h-11 lg:h-12 w-full border rounded-xl px-3 pr-10 text-sm lg:text-base bg-white cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200";
}

function btnPrimary(extra = "") {
  return `h-11 lg:h-12 rounded-xl bg-slate-900 text-white text-sm lg:text-base font-semibold hover:opacity-95 cursor-pointer ${extra}`;
}
function btnGhost(extra = "") {
  return `h-11 lg:h-12 rounded-xl bg-white border text-slate-900 text-sm lg:text-base font-semibold hover:bg-slate-50 cursor-pointer ${extra}`;
}
function btnSuccess(extra = "") {
  return `h-11 lg:h-12 rounded-xl bg-emerald-600 text-white text-sm lg:text-base font-semibold hover:opacity-95 cursor-pointer ${extra}`;
}

// ---------------------------
// Layout
// ---------------------------
function layout() {
  const paidVal = state.paid;
  const statusVal = state.status;

  return `
  <div class="min-h-screen bg-slate-50">
    ${toastUi()}
    ${confirmUi()} ${modalUi()}

<div class="border-b bg-white">
      <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
        
        <div class="w-full sm:w-auto flex flex-col items-center sm:items-start text-center sm:text-left">
           <div class="font-bold text-lg lg:text-xl">NRWashingPlus</div>
           <div class="text-slate-500 text-sm lg:text-base">Counter Board</div>
        </div>

        <div class="w-full sm:w-auto sm:ml-auto flex items-center justify-center sm:justify-end gap-2">
          
          <button id="btnNewOrder" class="${btnPrimary("flex-1 sm:flex-none px-4 lg:px-5 flex items-center justify-center gap-2")}">
            ${icon("plus", "w-4 h-4 lg:w-5 lg:h-5")}
            New Order
          </button>

          <button id="btnRefresh" class="${btnGhost("flex-1 sm:flex-none px-4 lg:px-5 flex items-center justify-center gap-2")}">
            ${icon("refresh", "w-4 h-4 lg:w-5 lg:h-5")}
            Refresh
          </button>

${state.user?.role === 'ADMIN' ? `
            <a href="/admin.html" class="flex-1 sm:flex-none h-11 lg:h-12 px-4 lg:px-5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm lg:text-base font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition flex items-center justify-center gap-2">
              <svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin Panel
            </a>
          ` : ''}

<button id="btnLogout" class="h-11 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition flex flex-col items-end justify-center leading-tight">
            <span>${state.user?.name || state.user?.role || 'GUEST'}</span>
            <span class="font-normal text-[10px] opacity-75">Sign Out</span>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-12 gap-5">
      <div class="col-span-12 lg:col-span-7">
        <div class="bg-white rounded-2xl shadow-sm border p-4 lg:p-5">
          <div class="rounded-2xl bg-sky-50/60 border border-sky-100 p-4 lg:p-5">
            <div class="mb-4 relative flex gap-2">
              <div class="relative flex-1">
                 <input id="orderSearch" type="text" placeholder="Global Search (Order #, Name, Phone)...Overrides filters below" 
                     class="${uiTextInputClass()} pl-10" value="${escapeHtml(state.searchQuery)}"/>
                 <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                   ${icon("search", "w-5 h-5")}
                 </div>
              </div>
              <button id="btnTriggerSearch" class="${btnGhost("px-4")}">Search</button>
            </div>

<div class="flex flex-wrap lg:flex-nowrap gap-3 lg:gap-4 items-end ${state.searchQuery ? 'opacity-50 pointer-events-none' : ''}">
              
              <div class="w-full lg:w-[15rem] shrink-0">
                <div class="${uiLabelClass()}">Date</div>
                <div class="relative">
                  <input id="dateSelect" type="date"
                    value="${dateInputValueFromYYMMDD(state.yymmdd)}"
                    class="${uiDateClass()} appearance-none [&::-webkit-calendar-picker-indicator]:hidden" 
                    ${state.searchQuery ? 'disabled' : ''} />
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    ${icon("calendar", "w-4 h-4")}
                  </div>
                </div>
              </div>

<div class="w-full sm:w-[10rem] lg:w-[6rem] shrink-0">
                <div class="${uiLabelClass()}">Branch</div>
                <div class="relative">
                  <select id="branchSelect" class="${uiSelectClass()} appearance-none" 
                    ${state.searchQuery ? 'disabled' : ''}
                    ${state.user?.role === 'STAFF' ? 'disabled' : ''} 
                  >
                    ${(!state.user?.branch || state.user?.branch === 'A')
      ? `<option value="A" ${state.branch === "A" ? "selected" : ""}>A</option>`
      : ''
    }
                    
                    ${(!state.user?.branch || state.user?.branch === 'B')
      ? `<option value="B" ${state.branch === "B" ? "selected" : ""}>B</option>`
      : ''
    }
                  </select>
                  
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                     ${state.user?.role === 'STAFF' ? icon("lock", "w-3 h-3") : icon("chevron-down", "w-4 h-4")}
                  </div>
                </div>
              </div>

              <div class="w-full sm:flex-1 lg:w-[12rem] shrink-0">
                <div class="${uiLabelClass()}">Paid</div>
                <div class="relative">
                  <select id="paidSelect" class="${uiSelectClass()} appearance-none" ${state.searchQuery ? 'disabled' : ''}>
                    <option value="" ${paidVal === "" ? "selected" : ""}>All</option>
                    <option value="true" ${paidVal === "true" ? "selected" : ""}>Paid only</option>
                    <option value="false" ${paidVal === "false" ? "selected" : ""}>Unpaid only</option>
                  </select>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    ${icon("chevron-down", "w-4 h-4")}
                  </div>
                </div>
              </div>

              <div class="w-full sm:flex-1 lg:w-[12rem] shrink-0">
                <div class="${uiLabelClass()}">Status</div>
                <div class="relative">
                  <select id="statusSelect" class="${uiSelectClass()} appearance-none" ${state.searchQuery ? 'disabled' : ''}>
                    <option value="" ${statusVal === "" ? "selected" : ""}>All</option>
                    ${STATUS_OPTIONS.map(
      (s) => `<option value="${s}" ${statusVal === s ? "selected" : ""}>${s}</option>`
    ).join("")}
                  </select>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    ${icon("chevron-down", "w-4 h-4")}
                  </div>
                </div>
              </div>

            </div>

<div class="mt-3 flex flex-row items-center justify-between gap-2">
<div class="text-[12px] lg:text-sm text-slate-600">
  ${state.searchQuery
      ? `<span class="text-indigo-600 font-bold">Search Results for: "${escapeHtml(state.searchQuery)}"</span>`
      : `Showing: <b class="text-slate-800">${state.yymmdd}</b>`
    }
</div>
              <div class="text-sm lg:text-base text-slate-800">
                <b>${state.orders.length}</b> orders
              </div>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-sm lg:text-base">
              <thead class="bg-sky-50 text-slate-700">
                <tr class="text-left border-b">
                  <th class="py-3 px-2">Order</th>
                  <th class="py-3 px-2">Customer</th>
                  <th class="py-3 px-2">Items</th>
                  <th class="py-3 px-2">Total</th>
                  <th class="py-3 px-2">Status</th>
                  <th class="py-3 px-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                ${state.orders
      .map((o) => {
        const selected = o.orderCode === state.selectedOrderCode;

        // ✅ FIXED: Use 'o.tatType' directly (since backend flattens it)
        let listSpeedIcon = "";

        if (o.tatType === 'EXPRESS') {
          listSpeedIcon = `<span class="text-red-600 mr-1 inline-flex items-center p-1" title="Express">${icon('zap', 'w-3 h-3')}</span>`;
        } else if (o.tatType === 'ONE_DAY') {
          listSpeedIcon = `<span class="text-orange-500 mr-1 inline-flex items-center p-1" title="One Day">${icon('clock', 'w-3 h-3')}</span>`;
        }

        return `
            <tr data-order="${escapeHtml(o.orderCode)}"
                class="border-b hover:bg-slate-50 cursor-pointer ${selected ? "bg-slate-100" : ""}">
              <td class="py-3 px-2 font-semibold">
                  <div class="flex items-center">
                    ${escapeHtml(o.orderCode)} ${listSpeedIcon}
                  </div>
              </td>
                        <td class="py-3 px-2">
                          <div class="font-medium">${escapeHtml(o.customerName ?? "-")}</div>
                          <div class="text-xs lg:text-sm text-slate-500">${escapeHtml(o.customerPhone ?? "")}</div>
                        </td>
                        <td class="py-3 px-2">${o.itemCount}</td>
                        <td class="py-3 px-2 font-semibold">${money(o.total)}</td>
                        <td class="py-3 px-2">${badge(o.status, statusKind(o.status))}</td>
                        <td class="py-3 px-2">
  ${badge(getPaymentState(o), invoiceStatusKind(getPaymentState(o)))}
</td>
                      </tr>
                    `;
      })
      .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-span-12 lg:col-span-5" id="details-panel-container">
        <div class="bg-white rounded-2xl shadow-sm border p-4 lg:p-5 min-h-[260px]">
          ${detailsPanel()}
        </div>
      </div>
    </div>
    <button id="btnBackToTop" 
            class="fixed bottom-6 right-6 bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition-opacity opacity-50 hover:opacity-100 z-50"
            onclick="window.scrollTo({top: 0, behavior: 'smooth'});">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  </div>
  `;
}

function detailsPanel() {
  if (!state.selectedOrderCode) {
    return `<div class="text-slate-600 text-sm lg:text-base">Select an order from the left to view details.</div>`;
  }

  const o = state.selectedOrder;
  if (!o) return `<div class="text-slate-600 text-sm lg:text-base">Loading ${escapeHtml(state.selectedOrderCode)}...</div>`;

  const latestInvoice =
    o.invoices && o.invoices.length
      ? [...o.invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null;

  const invoiceNo = latestInvoice?.invoiceNo ?? null;
  const invoiceStatus = latestInvoice?.status ?? "NONE";
  const canPay = invoiceNo && invoiceStatus !== "PAID";
  // ✅ Check if invoice exists to toggle buttons
  const hasInvoice = !!invoiceNo;

  // ✅ NEW: Speed Badge logic in Details Panel (SVG Icons)
  let speedBadge = "";
  if (latestInvoice) {
    if (latestInvoice.tatType === "ONE_DAY") {
      speedBadge = badge("ONE DAY", "orange", "clock");
    } else if (latestInvoice.tatType === "EXPRESS") {
      speedBadge = badge("EXPRESS", "red", "zap");
    }
  }

  // ✅ NEW: Paid Date logic with Time
  let paidString = "";
  if (latestInvoice?.paidAt) {
    const d = new Date(latestInvoice.paidAt);
    paidString = `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return `
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-bold text-base lg:text-lg truncate">${escapeHtml(o.orderCode)}</span>
          ${invoiceNo ? `<span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-mono font-bold">${escapeHtml(invoiceNo)}</span>` : ''}
        </div>
        <div class="text-xs lg:text-sm text-slate-500 mt-1">${escapeHtml(o.branch)} • ${new Date(o.createdAt).toLocaleString()}</div>
      </div>
      <div class="flex gap-2 shrink-0">
        ${speedBadge} 
        ${badge(o.status, statusKind(o.status))}
        
${(() => {
      let label = "NO INV";
      if (invoiceStatus === 'PAID') label = "PAID";
      else if (invoiceStatus === 'FINAL') label = "UNPAID"; // Map FINAL -> UNPAID
      else if (invoiceStatus === 'VOID') label = "VOID";

      // Uses the helper you added: invoiceStatusKind
      return badge(label, invoiceStatusKind(label));
    })()}
        </div>
    </div>

    <div class="mt-4 text-sm lg:text-base">
      <div class="text-slate-500 text-xs lg:text-sm">Customer</div>
      <div class="font-semibold">${escapeHtml(o.customer?.name ?? "-")}</div>
      <div class="text-slate-600">${escapeHtml(o.customer?.phone ?? "")}</div>
      ${o.customer?.address ? `<div class="text-slate-500 text-xs mt-1 flex items-center gap-1">${icon("home", "w-3 h-3")} ${escapeHtml(o.customer.address)}</div>` : ''}
      ${o.customer?.notes ? `<div class="text-slate-500 text-xs mt-1 flex items-center gap-1">${icon("file-text", "w-3 h-3")} ${escapeHtml(o.customer.notes)}</div>` : ''}
    </div>

    <div class="mt-4">
      <div class="text-slate-500 text-xs lg:text-sm mb-2">Items</div>

      <div class="border rounded-xl overflow-hidden">
        <div class="max-h-56 overflow-y-auto overflow-x-auto lg:overflow-x-hidden">
          <table class="w-full table-fixed text-sm lg:text-base min-w-[520px] lg:min-w-0">
            <colgroup>
              <col class="w-[6rem]" />
              <col />
              <col class="w-[4.5rem]" />
              <col class="w-[6rem]" />
            </colgroup>

            <thead class="bg-sky-50 text-slate-700">
              <tr>
                <th class="text-left p-2 lg:p-3">Code</th>
                <th class="text-left p-2 lg:p-3">Name</th>
                <th class="text-right p-2 lg:p-3">Qty</th>
                <th class="text-right p-2 lg:p-3">Total</th>
              </tr>
            </thead>

            <tbody>
              ${(o.items ?? [])
      .map(
        (it) => `
                <tr class="border-t align-top">
                  <td class="p-2 lg:p-3 font-mono text-xs lg:text-sm truncate">${escapeHtml(it.itemCode)}</td>
                  <td class="p-2 lg:p-3 whitespace-normal break-words">${escapeHtml(it.itemName)}</td>
                  <td class="p-2 lg:p-3 text-right">${Number(it.qty ?? 0)}</td>
                  <td class="p-2 lg:p-3 text-right font-semibold">${money(it.lineTotal)}</td>
                </tr>
              `
      )
      .join("")}
              ${!o.items || o.items.length === 0
      ? `<tr><td class="p-3 text-slate-500 text-sm" colspan="4">No items yet.</td></tr>`
      : ""
    }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-2 text-sm lg:text-base">
      <div class="bg-slate-50 rounded-xl p-3">
        <div class="text-xs lg:text-sm text-slate-500">Subtotal</div>
        <div class="font-bold">${money(o.subtotal)}</div>
      </div>
      <div class="bg-slate-50 rounded-xl p-3">
        <div class="text-xs lg:text-sm text-slate-500">Discount</div>
        <div class="font-bold">${money(o.discount)}</div>
      </div>
      <div class="bg-slate-50 rounded-xl p-3">
        <div class="text-xs lg:text-sm text-slate-500">Total</div>
        <div class="font-bold">${money(o.total)}</div>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${!hasInvoice ? `
      <button id="btnAddItem" class="${btnPrimary("w-full flex items-center justify-center gap-2")}">
        ${icon("plus", "w-4 h-4 lg:w-5 lg:h-5")}
        Add item
      </button>
      ` : `
      <button disabled class="opacity-50 cursor-not-allowed w-full h-11 lg:h-12 rounded-xl bg-slate-100 border text-slate-400 font-semibold flex items-center justify-center gap-2">
        ${icon("plus", "w-4 h-4 lg:w-5 lg:h-5")}
        Order Locked
      </button>
      `}

      <button id="btnStatus" class="${btnGhost("w-full flex items-center justify-center gap-2")}">
        ${icon("status", "w-4 h-4 lg:w-5 lg:h-5")}
        Change status
      </button>

      ${!hasInvoice ? `
      <button id="btnCreateInvoice" class="${btnGhost("w-full flex items-center justify-center gap-2")}">
        ${icon("invoice", "w-4 h-4 lg:w-5 lg:h-5")}
        Create invoice
      </button>
      ` : ''}

      ${hasInvoice ? `
      <button id="btnPrintInvoice" class="${btnGhost("w-full flex items-center justify-center gap-2")}">
        <svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print Invoice
      </button>
      ` : ''}

      <button id="btnPrintTags" class="${btnGhost("w-full flex items-center justify-center gap-2")}">
         <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
         Print Tags
      </button>

<button id="btnPayInvoice"
        class="${btnSuccess(`w-full sm:col-span-2 flex items-center justify-center gap-2 ${canPay ? "" : "opacity-50 pointer-events-none"}`)}">
        ${icon("pay", "w-4 h-4 lg:w-5 lg:h-5")}
        Pay invoice
      </button>

      <div class="sm:col-span-2 text-xs lg:text-sm text-center text-slate-500 mt-2 flex items-center justify-center gap-1">
         ${latestInvoice?.paidAt
      ? `${icon("check-circle", "w-4 h-4 text-emerald-600")} Paid via <b>${latestInvoice.paymentMethod}</b> on ${paidString}`
      : (invoiceNo ? `${icon("alert-circle", "w-4 h-4 text-amber-500")} Payment Pending` : "No Invoice Created")}
      </div>
    </div>
  `;
}

function toastUi() {
  if (!state.toast) return "";
  const isErr = state.toast.type === "error";
  return `
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
      <div class="px-4 py-3 rounded-xl shadow-lg border ${isErr
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900"
    }">
        ${escapeHtml(state.toast.msg)}
      </div>
    </div>
  `;
}

// ✅ NEW: Confirmation Toast UI (Supports 'danger' type)
function confirmUi() {
  if (!state.confirm) return "";

  // Decide button color based on type
  const isDanger = state.confirm.type === 'danger';
  const btnClass = isDanger
    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
    : "bg-slate-900 hover:bg-slate-800 text-white";

  return `
    <div class="fixed top-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-200">
      <div class="bg-white px-6 py-5 rounded-2xl shadow-2xl border border-slate-200 flex flex-col items-center gap-4 min-w-[320px]">
        <div class="text-slate-800 font-semibold text-center text-sm leading-relaxed">
          ${escapeHtml(state.confirm.msg)}
        </div>
        <div class="flex gap-3 w-full">
          <button onclick="window.resolveConfirm(false)" class="flex-1 h-9 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">
            No, Keep it
          </button>
          <button onclick="window.resolveConfirm(true)" class="flex-1 h-9 rounded-lg text-xs font-bold transition shadow-md ${btnClass}">
            ${isDanger ? 'Yes, Cancel Order' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
    <div class="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[1px]" onclick="window.resolveConfirm(false)"></div>
  `;
}

function modalUi() {
  if (!state.modal) return "";
  const { type, data } = state.modal;

  // Login Modal is special (cannot close, backdrop is solid)
  // Login Modal (Blurry Background + Eye Icon)
  if (type === "LOGIN") {
    return `
    <div class="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 border border-white/20">
        <div class="text-center mb-6">
          <div class="font-bold text-2xl text-slate-900">NRWashingPlus</div>
          <div class="text-slate-500 text-sm">System Login</div>
        </div>
        <div id="loginError" class="hidden mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg text-center font-medium"></div>
        
        <form id="loginForm" class="space-y-4">
          <div>
             <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
             <input id="loginUser" type="text" class="${uiTextInputClass()}" placeholder="admin / staffA" required autofocus />
          </div>
          
          <div>
             <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
             <div class="relative">
               <input id="loginPass" type="password" class="${uiTextInputClass()} pr-10" placeholder="••••" required />
               <button type="button" id="togglePass" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                 <svg id="eyeIcon" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                 </svg>
               </button>
             </div>
          </div>

          <button type="submit" class="${btnPrimary("w-full mt-2 shadow-lg")}">Sign In</button>
        </form>
      </div>
    </div>
    `;
  }

  return `
    <div class="fixed inset-0 z-[50] bg-black/40 flex items-center justify-center p-4">
      <div class="w-full max-w-xl bg-white rounded-2xl shadow-xl border p-5">
        ${type === "CREATE_ORDER" ? modalCreateOrder() : ""}
        ${type === "ADD_ITEM" ? modalAddItem(data) : ""}
        ${type === "STATUS" ? modalStatus(data) : ""}
        ${type === "INVOICE" ? modalInvoice(data) : ""}
        ${type === "PAY" ? modalPay(data) : ""}
      </div>
    </div>
  `;
}

function modalHeader(title) {
  return `
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="text-lg font-bold">${escapeHtml(title)}</div>
      <button id="modalClose" class="h-10 px-4 rounded-xl border text-sm hover:bg-slate-50 cursor-pointer">Close</button>
    </div>
  `;
}

// ✅ NEW: Enhanced Create Order Modal
function modalCreateOrder() {
  return `
    ${modalHeader("New Order")}
    <div class="text-sm text-slate-500 mb-4">
      Creating order for Branch <b>${escapeHtml(state.branch)}</b> on <b>${state.yymmdd}</b>.
    </div>

    <label class="block text-sm text-slate-600 mb-1">Customer Phone (Type to search)</label>
    <input id="custPhone" type="tel" placeholder="077..." class="${uiTextInputClass()}"/>
    <div id="phoneHint" class="text-xs text-sky-600 mt-1 h-4"></div>

    <label class="block text-sm text-slate-600 mb-1 mt-3">Customer Name</label>
    <input id="custName" type="text" placeholder="Name" class="${uiTextInputClass()}"/>

    <label class="block text-sm text-slate-600 mb-1 mt-3">Address (Optional)</label>
    <input id="custAddress" type="text" placeholder="123 Main St" class="${uiTextInputClass()}"/>

    <label class="block text-sm text-slate-600 mb-1 mt-3">Customer Notes (Optional)</label>
    <input id="custNotes" type="text" placeholder="Gate code, preference..." class="${uiTextInputClass()}"/>

    <button id="confirmCreateOrder" class="mt-4 w-full h-11 px-4 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95 cursor-pointer">
      Create Order
    </button>
  `;
}

function modalAddItem({ orderCode }) {
  const items = state.categoryItems || [];
  const selected = state.selectedItemCode;

  return `
    ${modalHeader("Add Item")}
    <div class="text-xs text-slate-500 mb-3">Order: <b>${escapeHtml(orderCode)}</b></div>

    <label class="block text-sm text-slate-600 mb-1">Category</label>
    <select id="catFilter" class="${uiSelectClass()}">
      <option value="">Select category</option>
      ${(state.categories || [])
      .map(
        (c) => `<option value="${c.id}" ${String(c.id) === String(state.selectedCategoryId) ? "selected" : ""
          }>${c.code ? `${escapeHtml(c.code)} - ` : ""}${escapeHtml(c.name)}</option>`
      )
      .join("")}
    </select>

    <div class="text-xs text-slate-500 mt-2 mb-3">
      ${state.categoriesLoading ? "Loading categories..." : ""}
    </div>

    <label class="block text-sm text-slate-600 mb-1">Item</label>
    <select id="itemSelect" class="${uiSelectClass()}" ${state.selectedCategoryId ? "" : "disabled"}>
      <option value="">
        ${state.selectedCategoryId ? (state.itemLoading ? "Loading items..." : "Select item") : "Select category first"}
      </option>
${!state.itemLoading
      ? items
        .map((it) => {
          const tat = tatLabel(it.defaultTatDays); // <-- uses defaultTatDays already in items
          const pricePart = it.price != null ? ` (Rs. ${money(it.price)})` : "";
          return `<option value="${escapeHtml(it.code)}" ${selected === it.code ? "selected" : ""}>
        ${escapeHtml(it.code)} - ${escapeHtml(it.name)} (${escapeHtml(tat)})${pricePart}
      </option>`;
        })
        .join("")
      : ""
    }

    </select>

    ${(() => {
      const sel = getSelectedCatalogItem();
      if (!sel) return "";
      return `<div class="text-xs text-slate-500 mt-2">
    Default turnaround: <b>${escapeHtml(tatLabel(sel.defaultTatDays))}</b>
  </div>`;
    })()}

    <div class="mt-3">
      <label class="block text-sm text-slate-600 mb-1">Qty</label>
      <input id="itemQty" type="number" min="1" value="1" class="${uiTextInputClass()}"/>
    </div>

    <button id="confirmAddItem" class="mt-4 w-full h-11 px-4 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95 cursor-pointer">
      Add Item
    </button>
  `;
}

function modalStatus({ orderCode, current }) {
  return `
    ${modalHeader("Change Status")}
    <div class="text-xs text-slate-500 mb-3">Order: <b>${escapeHtml(orderCode)}</b></div>

    <label class="block text-sm text-slate-600 mb-1">New status</label>
    <select id="newStatus" class="${uiSelectClass()}">
      ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`).join("")}
    </select>

    <button id="confirmStatus" class="mt-4 w-full h-11 px-4 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95 cursor-pointer">
      Update Status
    </button>
  `;
}

function modalInvoice({ orderCode }) {
  const subtotal = Number(state.selectedOrder?.subtotal ?? 0);
  const tatType = state.invoiceTatType || "NORMAL";
  const charge = calcServiceCharge(subtotal, tatType);

  return `
    ${modalHeader("Create Invoice")}
    <div class="text-xs text-slate-500 mb-3">Order: <b>${escapeHtml(orderCode)}</b></div>

    <label class="block text-sm text-slate-600 mb-1">Service speed</label>
    <select id="invoiceTatType" class="${uiSelectClass()}">
      <option value="NORMAL" ${tatType === "NORMAL" ? "selected" : ""}>NORMAL (no extra)</option>
      <option value="ONE_DAY" ${tatType === "ONE_DAY" ? "selected" : ""}>ONE DAY (+50%)</option>
      <option value="EXPRESS" ${tatType === "EXPRESS" ? "selected" : ""}>EXPRESS (+85%)</option>
    </select>

    <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
      <div class="bg-slate-50 rounded-xl p-2">
        <div class="text-xs text-slate-500">Subtotal</div>
        <div class="font-bold">${money(subtotal)}</div>
      </div>
      <div class="bg-slate-50 rounded-xl p-2">
        <div class="text-xs text-slate-500">Service charge</div>
        <div class="font-bold">${money(charge)}</div>
      </div>
      <div class="bg-slate-50 rounded-xl p-2">
        <div class="text-xs text-slate-500">Before discount</div>
        <div class="font-bold">${money(subtotal + charge)}</div>
      </div>
    </div>

    <label class="block text-sm text-slate-600 mb-1 mt-3">Discount</label>
    <input id="discount" type="number" min="0" value="0" class="${uiTextInputClass()}"/>

    <button id="confirmInvoice" class="mt-4 w-full h-11 px-4 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-95 cursor-pointer">
      Create Invoice
    </button>
  `;
}

function modalPay({ invoiceNo, total }) {
  return `
    ${modalHeader("Pay Invoice")}
    <div class="text-sm text-slate-600 mb-3">
      Invoice: <b>${escapeHtml(invoiceNo)}</b>
    </div>

    <label class="block text-sm text-slate-600 mb-1">Payment method</label>
    <select id="paymentMethod" class="${uiSelectClass()}">
      ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
    </select>

    <label class="block text-sm text-slate-600 mb-1 mt-3">Paid amount</label>
    <input id="paidAmount" type="number" min="0" value="${Number(total ?? 0)}" class="${uiTextInputClass()}"/>

    <button id="confirmPay" class="mt-4 w-full h-11 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:opacity-95 cursor-pointer">
      Confirm Payment
    </button>
  `;
}

// ---------------------------
// Handlers
// ---------------------------
function attachHandlers() {

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.reload();
  });

  // ✅ LOGIN HANDLER
  if (state.modal?.type === "LOGIN") {

    // Toggle Password Visibility
    document.getElementById("togglePass")?.addEventListener("click", () => {
      const input = document.getElementById("loginPass");
      const icon = document.getElementById("eyeIcon");

      if (input.type === "password") {
        input.type = "text";
        // Switch to "Eye Open" icon
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
      } else {
        input.type = "password";
        // Switch back to "Eye Closed" icon
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
      }
    });

    document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("loginUser").value;
      const p = document.getElementById("loginPass").value;
      const errBox = document.getElementById("loginError");

      try {
        // 1. Call Login
        // Note: We use the new apiPost which handles the URL correctly now
        const res = await apiPost("/auth/login", { username: u, pass: p });

        // 2. Validate Response (Debugging)
        console.log("Login Success:", res);

        // 3. SAVE SESSION
        localStorage.setItem('authToken', res.access_token);
        localStorage.setItem('userRole', res.user.role);
        localStorage.setItem('userBranch', res.user.branch || "");

        // ✅ CRITICAL: Save the Name properly
        // If res.user.name is undefined, it defaults to role
        localStorage.setItem('userName', res.user.name || res.user.role);

        // 4. UPDATE STATE IMMEDIATELY
        state.user = {
          role: res.user.role,
          branch: res.user.branch,
          name: res.user.name || res.user.role
        };

        state.branch = res.user.branch || "A"; // Force branch setting
        state.modal = null; // Close modal

        render();
        loadOrdersBoard();

      } catch (err) {
        console.error(err);
        errBox.innerText = "Invalid credentials";
        errBox.classList.remove("hidden");
      }
    });
    return; // Stop attaching other handlers if we are in login mode
  }

  document.getElementById("btnNewOrder")?.addEventListener("click", () => {
    openModal("CREATE_ORDER");
  });

  // ✅ UPDATED: Refresh Button (Reset to Defaults)
  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    // 1. Reset State
    state.searchQuery = "";
    state.branch = "A";
    state.paid = "";
    state.status = "";
    state.yymmdd = yymmddFromDate(new Date()); // Today
    state.selectedOrderCode = null;
    state.selectedOrder = null;

    // 2. Reset UI Input Values (so they match state)
    const searchInput = document.getElementById("orderSearch");
    if (searchInput) searchInput.value = "";

    // 3. Reload Data
    setLoading(true);
    render(); // Re-renders the dropdowns with new state values
    await loadOrdersBoard();
  });

  document.getElementById("dateSelect")?.addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v + "T00:00:00");
    state.yymmdd = yymmddFromDate(d);
    state.selectedOrderCode = null;
    state.selectedOrder = null;
    loadOrdersBoard();
  });

  // ✅ NEW: Make the whole Date Input open the Picker on click
  document.getElementById("dateSelect")?.addEventListener("click", function (e) {
    try {
      // This forces the browser's native date picker to open
      this.showPicker();
    } catch (err) {
      // Failsafe for older browsers that don't support showPicker
      console.log("Date picker not supported programmatically");
    }
  });

  document.getElementById("branchSelect")?.addEventListener("change", (e) => {
    state.branch = e.target.value;
    state.selectedOrderCode = null;
    state.selectedOrder = null;
    loadOrdersBoard();
  });

  document.getElementById("paidSelect")?.addEventListener("change", (e) => {
    state.paid = e.target.value;
    loadOrdersBoard();
  });

  document.getElementById("statusSelect")?.addEventListener("change", (e) => {
    state.status = e.target.value;
    loadOrdersBoard();
  });

  // ✅ Search Handler: Button Click (Standard Logic)
  // This triggers a global search API call when clicked
  document.getElementById("btnTriggerSearch")?.addEventListener("click", async () => {
    const q = document.getElementById("orderSearch").value.trim();
    state.searchQuery = q;

    if (!q) {
      // Reload today's if empty
      await loadOrdersBoard();
    } else {
      state.loading = true;
      render();
      try {
        const results = await apiGet(`/api/orders?q=${encodeURIComponent(q)}`);
        state.orders = Array.isArray(results) ? results : [];
        // If exact match, open it
        if (state.orders.length === 1) {
          loadOrderDetails(state.orders[0].orderCode);
        } else {
          state.selectedOrderCode = null;
          state.selectedOrder = null;
        }
      } catch (e) {
        setToast("error", "Search failed");
      } finally {
        state.loading = false;
        render();
        // Restore focus
        // ✅ FIX: Restore focus AND move cursor to the end
        const input = document.getElementById("orderSearch");
        if (input) {
          input.focus();
          const len = input.value.length;
          // This forces the cursor to the very end of the text
          input.setSelectionRange(len, len);
        }
      }
    }
  });

  // Also trigger search on Enter key
  document.getElementById("orderSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btnTriggerSearch").click();
    }
  });

  document.querySelectorAll("tr[data-order]").forEach((tr) => {
    tr.addEventListener("click", () => {
      loadOrderDetails(tr.getAttribute("data-order"));

      // UI Scroll Logic
      if (window.innerWidth < 1024) {
        // Mobile/Tablet (< 1024px): Scroll DOWN to the details panel
        setTimeout(() => {
          const details = document.getElementById("details-panel-container");
          if (details) {
            details.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else {
        // Desktop (>= 1024px): Scroll UP to top so details are visible
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  document.getElementById("btnAddItem")?.addEventListener("click", () => {
    if (!state.selectedOrderCode) return;
    openModal("ADD_ITEM", { orderCode: state.selectedOrderCode });
  });

  document.getElementById("btnStatus")?.addEventListener("click", () => {
    const orderCode = state.selectedOrderCode;
    if (!orderCode) return;
    openModal("STATUS", { orderCode, current: state.selectedOrder?.status ?? "RECEIVED" });
  });

  // ✅ NEW: Print Tags Handler
  document.getElementById("btnPrintTags")?.addEventListener("click", () => {
    if (state.selectedOrderCode) {
      printTags(state.selectedOrderCode);
    }
  });

  document.getElementById("btnCreateInvoice")?.addEventListener("click", () => {
    if (!state.selectedOrderCode) return;
    openModal("INVOICE", { orderCode: state.selectedOrderCode });
  });

  // ✅ NEW: Print Invoice Handler
  document.getElementById("btnPrintInvoice")?.addEventListener("click", () => {
    const o = state.selectedOrder;
    // Find latest invoice number
    const latest = o.invoices && o.invoices.length
      ? [...o.invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null;

    if (latest?.invoiceNo) {
      printInvoice(latest.invoiceNo);
    }
  });

  document.getElementById("btnPayInvoice")?.addEventListener("click", () => {
    const o = state.selectedOrder;
    if (!o) return;

    const latest =
      o.invoices && o.invoices.length
        ? [...o.invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;

    if (!latest?.invoiceNo) return setToast("error", "No invoice found. Create invoice first.");
    if (latest.status === "PAID") return setToast("error", "Invoice already PAID.");

    openModal("PAY", { invoiceNo: latest.invoiceNo, total: o.total ?? latest.total ?? 0 });
  });

  document.getElementById("modalClose")?.addEventListener("click", closeModal);

  // ✅ NEW: Handle Create Order + Auto Lookup
  if (state.modal?.type === "CREATE_ORDER") {

    let selectedCustomer = null; // Store the full customer object if found

    // Auto-Lookup as you type
    const onPhoneInput = debounce(async (e) => {
      const val = e.target.value.trim();
      const hint = document.getElementById("phoneHint");
      selectedCustomer = null; // Reset on typing

      if (val.length > 4) { // Start searching earlier (5 chars)
        hint.innerText = "Searching...";
        hint.className = "text-xs text-slate-500 mt-1 h-4";

        const cust = await lookupCustomerByPhone(val);

        if (cust) {
          selectedCustomer = cust; // Save it!

          // Show a clickable suggestion
          hint.innerHTML = `✓ Found: <b class="cursor-pointer underline">${escapeHtml(cust.name)}</b> (${cust.phone})`;
          hint.className = "text-xs text-emerald-600 mt-1 h-4";

          // Click handler to auto-fill immediately
          hint.onclick = () => {
            document.getElementById("custPhone").value = cust.phone;
            document.getElementById("custName").value = cust.name || "";
            document.getElementById("custAddress").value = cust.address || "";
            document.getElementById("custNotes").value = cust.notes || "";
          };

          // Auto-fill other fields immediately (but leave phone partial so they can keep typing if needed)
          document.getElementById("custName").value = cust.name || "";
          document.getElementById("custAddress").value = cust.address || "";
          document.getElementById("custNotes").value = cust.notes || "";
        } else {
          hint.innerText = "New customer";
          hint.className = "text-xs text-sky-600 mt-1 h-4";
          hint.onclick = null;
          // Clear fields if no match
          document.getElementById("custName").value = "";
          document.getElementById("custAddress").value = "";
          document.getElementById("custNotes").value = "";
        }
      } else {
        hint.innerText = "";
      }
    }, 500);

    document.getElementById("custPhone")?.addEventListener("input", onPhoneInput);

    // Confirm Create
    // Confirm Create
    document.getElementById("confirmCreateOrder")?.addEventListener("click", async () => {
      const name = document.getElementById("custName").value.trim();
      let phone = document.getElementById("custPhone").value.trim();
      const address = document.getElementById("custAddress").value.trim();
      const notes = document.getElementById("custNotes").value.trim();

      // 1. Validate Sri Lankan Phone (Mobile OR Landline)
      // Rules: Starts with '0', followed by exactly 9 digits (Total 10)
      // Examples: 0771234567 (Mobile), 0112345678 (Landline)
      const slPhoneRegex = /^0\d{9}$/;

      if (!slPhoneRegex.test(phone)) {
        return setToast("error", "Invalid Number. Must be 10 digits starting with 0 (e.g. 077... or 011...).");
      }

      // 2. Validate Name
      if (!name) {
        return setToast("error", "Customer Name is required.");
      }
      // --- VALIDATION END ---

      // Logic to use matched full number if user typed partial
      if (selectedCustomer && selectedCustomer.phone.includes(phone)) {
        phone = selectedCustomer.phone;
      }

      closeModal();

      await createNewOrder({
        name,
        phone,
        address,
        customerNotes: notes,
        yymmdd: state.yymmdd
      });
    });
  }

  // ---- ADD ITEM modal
  if (state.modal?.type === "ADD_ITEM") {
    document.getElementById("catFilter")?.addEventListener("change", async (e) => {
      state.selectedCategoryId = e.target.value || "";
      state.categoryItems = [];
      state.selectedItemCode = "";
      render();

      if (state.selectedCategoryId) {
        await loadItemsForCategory(state.selectedCategoryId);
      }
    });

    document.getElementById("itemSelect")?.addEventListener("change", (e) => {
      state.selectedItemCode = e.target.value || "";
    });

    document.getElementById("confirmAddItem")?.addEventListener("click", async () => {
      const orderCode = state.modal.data.orderCode;
      const itemCode = state.selectedItemCode;
      const qty = Number(document.getElementById("itemQty").value || 1);

      if (!state.selectedCategoryId) return setToast("error", "Select a category first");
      if (!itemCode) return setToast("error", "Select an item");
      if (qty <= 0) return setToast("error", "Qty must be > 0");

      closeModal();
      await addItemToOrder(orderCode, itemCode, qty);
    });
  }

  // ---- STATUS modal
  if (state.modal?.type === "STATUS") {
    document.getElementById("confirmStatus")?.addEventListener("click", async () => {
      const orderCode = state.modal.data.orderCode;
      const newStatus = document.getElementById("newStatus").value;

      // ✅ Updated Safety Check
      if (newStatus === "CANCELLED") {
        // Removed "Cannot be undone". Added 'danger' for Red button.
        const confirmed = await window.confirmAction(
          "Are you sure you want to CANCEL this order?",
          'danger'
        );

        if (!confirmed) return;
      }

      closeModal();
      await updateOrderStatus(orderCode, newStatus);
    });
  }

  // ---- INVOICE modal
  if (state.modal?.type === "INVOICE") {
    document.getElementById("invoiceTatType")?.addEventListener("change", (e) => {
      state.invoiceTatType = e.target.value || "NORMAL";
      render();
    });

    document.getElementById("confirmInvoice")?.addEventListener("click", async () => {
      const orderCode = state.modal.data.orderCode;
      const discount = Number(document.getElementById("discount").value || 0);
      const tatType = state.invoiceTatType || "NORMAL";
      closeModal();
      await createInvoice(orderCode, discount, tatType);
    });
  }

  // ---- PAY modal
  if (state.modal?.type === "PAY") {
    document.getElementById("confirmPay")?.addEventListener("click", async () => {
      const invoiceNo = state.modal.data.invoiceNo;
      const paymentMethod = document.getElementById("paymentMethod").value;
      const paidAmount = Number(document.getElementById("paidAmount").value || 0);

      if (!paymentMethod) return setToast("error", "Select payment method");
      if (paidAmount <= 0) return setToast("error", "Paid amount must be > 0");

      closeModal();
      await payInvoice(invoiceNo, paymentMethod, paidAmount);
    });
  }
}

// ✅ NEW: Promise-based Confirmation with Type
window.confirmAction = (msg, type = 'normal') => {
  return new Promise((resolve) => {
    state.confirm = {
      msg,
      type, // 'normal' or 'danger'
      resolve: (val) => {
        state.confirm = null;
        render();
        resolve(val);
      }
    };
    render();
  });
};

window.resolveConfirm = (result) => {
  if (state.confirm) state.confirm.resolve(result);
};

function render() {
  document.getElementById("app").innerHTML = layout();
  attachHandlers();
}

// boot
const hasToken = !!localStorage.getItem('authToken');
if (!hasToken) {
  state.modal = { type: "LOGIN" }; // Show login immediately
  render();
} else {
  render();
  loadOrdersBoard();
}