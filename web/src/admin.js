import { apiGet, apiPost, apiPatch } from "./api";
import "./style.css";

const state = {
    activeTab: 'CATALOG',
    categories: [],
    items: [],
    selectedCatId: null,
    customers: [],
    selectedCustId: null,
    reports: null,
    reportFilter: {
        start: new Date().toISOString().split('T')[0], // Today
        end: new Date().toISOString().split('T')[0],
        branch: 'ALL'
    },
    toast: null,
    confirm: null, // ✅ Added confirm state
    modal: null
};

// --- HELPERS ---
function showToast(msg, type = 'success') {
    state.toast = { msg, type };
    render();
    setTimeout(() => {
        state.toast = null;
        render();
    }, 3000);
}

// ✅ Escape HTML helper (Missing in previous version but needed for confirmUi)
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// --- INITIALIZATION ---
async function init() {
    const role = localStorage.getItem('userRole');
    if (role !== 'ADMIN') {
        window.location.href = '/';
        return;
    }

    // Initial Render (Load Shell)
    render();

    // Load Data
    await loadCategories();
    await loadCustomers();
}

// --- DATA ---
async function loadCategories() {
    try {
        state.categories = await apiGet('/api/catalog/categories');
        render();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadItems(catId) {
    try {
        state.selectedCatId = catId;
        state.items = [];
        render();
        state.items = await apiGet(`/api/catalog/items?categoryId=${catId}&limit=500`);
        render();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadCustomers() {
    try {
        state.customers = await apiGet('/api/customers');
        render();
    } catch (e) { console.error(e); }
}

async function loadReports() {
    try {
        const { start, end, branch } = state.reportFilter; // ✅ Get Branch
        // Pass branch to API
        state.reports = await apiGet(`/api/reports/dashboard?startDate=${start}&endDate=${end}&branch=${branch}`);
        render();
    } catch (e) { console.error(e); }
}

// --- ICONS ---
function icon(name) {
    const cls = "w-4 h-4";
    const common = `class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    switch (name) {
        case 'plus': return `<svg ${common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
        case 'back': return `<svg ${common}><path d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>`;
        case 'edit': return `<svg ${common}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        case 'save': return `<svg ${common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
        case 'check-circle': return `<svg ${common}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        case 'alert-circle': return `<svg ${common}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        case 'info': return `<svg ${common}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        default: return '';
    }
}

// --- LAYOUT ---
function layout() {
    return `
    <div class="h-full flex flex-col font-sans text-slate-800">
        ${toastUi()}
        ${confirmUi()} 
        ${modalUi()}

        <div class="border-b bg-white z-30 shrink-0">
            <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
                
                <div class="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto">
                    <div class="flex items-center gap-2">
                        <div class="font-bold text-xl text-slate-900 tracking-tight">NRWashingPlus</div>
                        <span class="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-wider">Admin</span>
                    </div>
                    <div class="text-slate-500 text-xs font-medium">System Management</div>
                </div>

                <nav class="flex gap-1 text-sm font-medium bg-slate-100 p-1 rounded-lg">
                    <button onclick="window.switchTab('CATALOG')" class="px-6 py-1.5 rounded-md transition-all ${state.activeTab === 'CATALOG' ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-700'}">Catalog</button>
                    <button onclick="window.switchTab('CUSTOMERS')" class="px-6 py-1.5 rounded-md transition-all ${state.activeTab === 'CUSTOMERS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-700'}">Customers</button>
                    <button onclick="window.switchTab('REPORTS')" 
                        class="px-6 py-1.5 rounded-md transition-all ${state.activeTab === 'REPORTS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold' : 'text-slate-500 hover:text-slate-700'}">
                        Reports
                    </button>
                </nav>

                <div class="w-full md:w-auto flex justify-center md:justify-end">
                    <a href="/" class="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition flex items-center gap-2 shadow-sm">
                        ${icon('back')} Back to Board
                    </a>
                </div>
            </div>
        </div>

        <div class="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 overflow-hidden">
            ${state.activeTab === 'CATALOG' ? renderCatalogView() :
            state.activeTab === 'CUSTOMERS' ? renderCustomersView() :
                renderReportsView()}
        </div>
    </div>
    `;
}

// --- CATALOG VIEWS ---
function renderCatalogView() {
    return `
    <div class="flex flex-col md:flex-row gap-6 h-full">
        <div class="w-full md:w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[40vh] md:h-full">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div class="font-bold text-slate-700 text-sm uppercase tracking-wider">Categories</div>
                <button id="btnAddCategory" class="h-8 px-3 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 hover:text-slate-900 transition flex items-center gap-1 border border-slate-200">
                    ${icon('plus')} New
                </button>
            </div>
            <div class="flex-1 overflow-y-auto custom-scroll p-2 space-y-1">
                ${renderCategoriesList()}
            </div>
        </div>

        <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
            ${renderRightPanel()}
        </div>
    </div>
    `;
}

function renderCategoriesList() {
    if (state.categories.length === 0) return `<div class="p-8 text-center text-slate-400 text-sm">Loading...</div>`;

    return state.categories.map(c => `
        <div onclick="window.handleSelectCategory(${c.id})" 
             class="group relative p-3 rounded-xl cursor-pointer transition-all duration-200 flex justify-between items-center border 
             ${state.selectedCatId === c.id ? 'bg-slate-100 border-slate-300 shadow-inner' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}">
            
            <div class="flex flex-col flex-1 min-w-0 mr-2">
                <div class="font-bold text-base ${state.selectedCatId === c.id ? 'text-slate-900' : 'text-slate-600'}">${c.name}</div>
                <div class="text-xs font-bold text-slate-400 font-mono tracking-wide mt-0.5">${c.code}</div>
            </div>

            <div class="flex items-center gap-2">
                <button onclick="window.handleEditCategory(event, ${c.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all z-10 opacity-0 group-hover:opacity-100 focus:opacity-100">
                    ${icon('edit')}
                </button>
                <button onclick="window.handleToggleCategory(event, ${c.id}, ${!c.isActive})" 
                        class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all z-10 shrink-0
                        ${c.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}"
                        title="${c.isActive ? 'Deactivate' : 'Activate'}">
                   ${c.isActive ? 'Active' : 'Disabled'}
                </button>
            </div>
        </div>
    `).join('');
}

function renderRightPanel() {
    if (!state.selectedCatId) {
        return `<div class="h-full flex flex-col items-center justify-center text-slate-400 pointer-events-none p-8 text-center">
                <span class="font-medium text-slate-600">Inventory Workspace</span>
                <span class="text-sm mt-1 text-slate-400">Select a category from the left</span>
            </div>`;
    }

    const cat = state.categories.find(c => c.id === state.selectedCatId);

    return `
        <div class="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white shrink-0">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 font-mono font-bold text-lg">
                    ${cat.code}
                </div>
                <div class="min-w-0">
                    <div class="font-bold text-xl text-slate-900 truncate">${cat.name}</div>
                    <div class="text-sm text-slate-500 truncate">Manage items and pricing</div>
                </div>
            </div>
            
            <button id="btnAddItem" class="h-10 px-5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 shadow-md transition flex items-center gap-2 transform active:scale-95">
                ${icon('plus')} Add Item
            </button>
        </div>

        <div class="flex-1 overflow-y-auto bg-slate-50 custom-scroll relative">
            ${renderItemsTable()}
        </div>
    `;
}

function renderItemsTable() {
    if (state.items.length === 0) {
        return `<div class="h-full flex flex-col items-center justify-center text-slate-400">
                <p class="font-medium text-sm text-slate-500">No items found.</p>
                <button id="btnAddItemEmpty" class="mt-3 text-slate-900 font-bold hover:underline text-sm">Add First Item</button>
            </div>`;
    }

    return `
        <table class="w-full text-left border-collapse">
            <thead class="bg-white text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th class="py-4 px-6 w-32">Code</th>
                    <th class="py-4 px-6">Item Name</th>
                    <th class="py-4 px-6 text-right w-28">Price</th>
                    <th class="py-4 px-6 w-20 text-center">Unit</th>
                    <th class="py-4 px-6 w-32 text-center">Status</th>
                    <th class="py-4 px-6 w-24 text-right">Edit</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
                ${state.items.map(i => `
                    <tr class="hover:bg-slate-50 group transition-colors ${!i.isActive ? 'opacity-60 bg-slate-50' : ''}">
                        <td class="py-4 px-6">
                            <span class="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">${i.itemCode}</span>
                        </td>
                        <td class="py-4 px-6">
                            <div class="font-bold text-slate-800 text-base">${i.displayName}</div>
                        </td>
                        <td class="py-4 px-6 text-right">
                            <div class="font-mono text-base text-slate-900 font-bold">${Number(i.basePrice).toFixed(2)}</div>
                        </td>
                        <td class="py-4 px-6 text-center">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${i.unitType}</span>
                        </td>
                        <td class="py-4 px-6 text-center">
                            <button onclick="window.handleToggleItem(${i.id}, ${!i.isActive})" 
                                class="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wide transition-all border w-24 
                                ${i.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}">
                                ${i.isActive ? 'Active' : 'Off'}
                            </button>
                        </td>
                        <td class="py-4 px-6 text-right">
                            <button onclick="window.handleEditItem(${i.id})" class="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                ${icon('edit')}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ==========================================
// VIEW: CUSTOMERS
// ==========================================

function renderCustomersView() {
    return `
    <div class="flex flex-col md:flex-row gap-6 h-full">
        <div class="w-full md:w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[40vh] md:h-full">
            <div class="p-4 border-b border-slate-100 bg-white shrink-0">
                <div class="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">Customers</div>
                <input id="searchCustomers" placeholder="Search name or phone..." class="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 transition-all">
            </div>
            <div class="flex-1 overflow-y-auto custom-scroll p-2 space-y-1" id="customerList">
                ${renderCustomerListItems()}
            </div>
        </div>

        <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
            ${renderCustomerDetailsPanel()}
        </div>
    </div>
    `;
}

function renderCustomerListItems() {
    const term = (document.getElementById('searchCustomers')?.value || "").toLowerCase();
    const filtered = state.customers.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)));

    if (filtered.length === 0) return `<div class="p-8 text-center text-slate-400 text-sm">No customers found.</div>`;

    return filtered.map(c => `
        <div onclick="window.handleSelectCustomer(${c.id})" 
             class="group relative p-3 rounded-xl cursor-pointer transition-all duration-200 flex justify-between items-center border 
             ${state.selectedCustId === c.id ? 'bg-slate-100 border-slate-300 shadow-inner' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}">
            <div class="flex flex-col overflow-hidden">
                <div class="font-bold text-sm truncate ${state.selectedCustId === c.id ? 'text-slate-900' : 'text-slate-700'}">${c.name}</div>
                <div class="text-xs font-mono text-slate-400 mt-0.5">${c.phone || "No Phone"}</div>
            </div>
            ${c.isArchived ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">ARCHIVED</span>` : ''}
        </div>
    `).join('');
}

function renderCustomerDetailsPanel() {
    if (!state.selectedCustId) {
        return `<div class="h-full flex flex-col items-center justify-center text-slate-400 pointer-events-none p-8 text-center">
                <span class="font-medium text-slate-600">Customer Details</span>
                <span class="text-sm mt-1 text-slate-400">Select a customer to view or edit</span>
            </div>`;
    }

    const c = state.customers.find(cust => cust.id === state.selectedCustId);
    if (!c) return "";

    return `
        <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
            <div>
                <div class="font-bold text-xl text-slate-900">${c.name}</div>
                <div class="text-sm text-slate-500 font-mono">${c.phone || "No phone"}</div>
            </div>
            <div class="text-xs text-slate-400 text-right">
                <div class="font-bold uppercase tracking-wider mb-1">Last Updated</div>
                <div class="font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">${new Date(c.updatedAt).toLocaleString()}</div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto bg-slate-50 custom-scroll p-6">
            <div class="max-w-2xl mx-auto space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name</label>
                        <input id="custName" class="w-full h-11 border border-slate-300 rounded-xl px-3 text-sm font-medium focus:ring-2 focus:ring-slate-800 outline-none" value="${c.name}">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                        <input id="custPhone" class="w-full h-11 border border-slate-300 rounded-xl px-3 text-sm font-medium focus:ring-2 focus:ring-slate-800 outline-none" value="${c.phone || ''}">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                    <textarea id="custAddress" class="w-full border border-slate-300 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-800 outline-none h-24 resize-none">${c.address || ''}</textarea>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                    <textarea id="custNotes" class="w-full border border-slate-300 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-800 outline-none h-24 resize-none">${c.notes || ''}</textarea>
                </div>

                <div class="pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
                    <button onclick="window.handleArchiveCustomer(${c.id}, ${!c.isArchived})" 
                        class="w-full sm:w-auto h-11 px-5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2
                        ${c.isArchived ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}">
                        ${c.isArchived ? 'Unarchive Customer' : 'Archive Customer'}
                    </button>

                    <button onclick="window.handleSaveCustomer(${c.id})" 
                        class="w-full sm:w-auto h-11 px-8 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg transition-all flex items-center justify-center gap-2">
                        ${icon('save')} Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// VIEW: REPORTS
// ==========================================

function renderReportsView() {
    if (!state.reports) return `<div class="p-10 text-center text-slate-400">Loading Stats...</div>`;

    const {
        totalOrders, totalRevenue, pendingCount, completedCount, statusCounts, categoryBreakdown,
        unpaidProcessing, unpaidReady
    } = state.reports;

    // ✅ Helper to format money correctly (Commas + 2 Decimals)
    const fmtMoney = (amount) => {
        return Number(amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return `
    <div class="flex flex-col md:flex-row gap-6 h-full">
        <div class="w-full md:w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-fit">
            <div class="p-5 border-b border-slate-100 bg-white">
                <div class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Report Filters</div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Branch</label>
                        <select id="reportBranch" class="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-800 transition-all cursor-pointer">
                            <option value="ALL" ${state.reportFilter.branch === 'ALL' ? 'selected' : ''}>All Branches</option>
                            <option value="A" ${state.reportFilter.branch === 'A' ? 'selected' : ''}>Branch A</option>
                            <option value="B" ${state.reportFilter.branch === 'B' ? 'selected' : ''}>Branch B</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Start Date</label>
                        <input type="date" id="reportStart" value="${state.reportFilter.start}" class="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-800 transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">End Date</label>
                        <input type="date" id="reportEnd" value="${state.reportFilter.end}" class="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-800 transition-all">
                    </div>
                    <button onclick="window.applyReportFilter()" class="w-full h-10 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition shadow-md">Apply Filter</button>
                </div>
            </div>
            
            <div class="p-5 bg-slate-50 space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-500">Active Orders</span>
                    <span class="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">${pendingCount}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-500">Completed</span>
                    <span class="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">${completedCount}</span>
                </div>
            </div>
        </div>

        <div class="flex-1 flex flex-col gap-6 overflow-y-auto custom-scroll pr-2">
            
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid Revenue</div>
                            <div class="text-3xl font-bold text-slate-900">Rs. ${fmtMoney(totalRevenue)}</div>
                        </div>
                        <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" id="rupee" class="w-8 h-8">
                                <path fill="#3b3c3d" d="M38 38a3.89 3.89 0 0 1-3.69-5.11L35.61 29H34a1 1 0 0 1 0-2h3a1 1 0 0 1 .81.41 1 1 0 0 1 .14.91l-1.74 5.21A1.88 1.88 0 0 0 38 36a1 1 0 0 1 0 2zM32.73 19.69a1 1 0 1 0-1.46-1.38c-.39.42-1.51 1.58-1.92 1.93-1.08.92-4.75 3.37-4.79 3.4l0 .05a5 5 0 1 0 4.08-.4c.82-.58 1.61-1.16 2-1.53S32.57 19.85 32.73 19.69zM30 28a3 3 0 1 1-3-3A3 3 0 0 1 30 28z"></path>
                                <path fill="#3b3c3d" d="M30 4A23 23 0 1 0 53 27 23 23 0 0 0 30 4zm0 41A18 18 0 1 1 48 27 18 18 0 0 1 30 45zM52.45 38A22.71 22.71 0 0 1 49 46V43.23A24.74 24.74 0 0 0 52.45 38zM47 45.32v3.17A23.35 23.35 0 0 1 43 52V48.36A24.66 24.66 0 0 0 47 45.32zM41 49.45V53.2a22.58 22.58 0 0 1-4 1.73V51A25.17 25.17 0 0 0 41 49.45z"></path>
                                <path fill="#3b3c3d" d="M35 51.52v3.95A22.91 22.91 0 0 1 31 56V52A25.12 25.12 0 0 0 35 51.52zM29 52v4a22.91 22.91 0 0 1-4-.51V51.52A25.12 25.12 0 0 0 29 52zM23 51v3.91a22.58 22.58 0 0 1-4-1.73V49.45A24.8 24.8 0 0 0 23 51zM17 48.36V52a23.35 23.35 0 0 1-4-3.49V45.32A24.66 24.66 0 0 0 17 48.36zM11 43.23V46A22.71 22.71 0 0 1 7.55 38 24.74 24.74 0 0 0 11 43.23z"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unpaid (Processing)</div>
                            <div class="text-sm font-bold text-slate-700 mt-0.5">Rs. ${fmtMoney(unpaidProcessing)}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Unpaid (Ready)</div>
                            <div class="text-sm font-bold text-indigo-700 mt-0.5">Rs. ${fmtMoney(unpaidReady)}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Orders</div>
                        <div class="text-3xl font-bold text-slate-900">${totalOrders}</div>
                    </div>
                    <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" id="hanger" class="w-8 h-8">
                            <path d="M93 27H70.4L60 22.67v-1.92c3.45-.89 6-4.03 6-7.75 0-4.41-3.59-8-8-8s-8 3.59-8 8c0 1.1.9 2 2 2s2-.9 2-2c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4c-1.1 0-2 .9-2 2v3.67L45.6 27H23c-1.1 0-2 .9-2 2v24c0 1.1.9 2 2 2h12v6H12c-3.86 0-7 3.14-7 7 0 1.96.81 3.73 2.11 5A6.97 6.97 0 0 0 5 78c0 1.96.81 3.73 2.11 5A6.97 6.97 0 0 0 5 88c0 3.86 3.14 7 7 7h67c1.1 0 2-.9 2-2V55h12c1.1 0 2-.9 2-2V29c0-1.1-.9-2-2-2zm-35-.83 9.91 4.12C67.27 35.2 63.07 39 58 39s-9.27-3.8-9.91-8.71L58 26.17zM60 91H12c-1.65 0-3-1.35-3-3s1.35-3 3-3h48c1.65 0 3 1.35 3 3s-1.35 3-3 3zm0-10H12c-1.65 0-3-1.35-3-3s1.35-3 3-3h48c1.65 0 3 1.35 3 3s-1.35 3-3 3zm0-10H12c-1.65 0-3-1.35-3-3s1.35-3 3-3h48c1.65 0 3 1.35 3 3s-1.35 3-3 3zm31-20H81v-4c0-1.1-.9-2-2-2s-2 .9-2 2v44H66.31c.44-.91.69-1.93.69-3 0-1.96-.81-3.73-2.11-5A6.97 6.97 0 0 0 67 78c0-1.96-.81-3.73-2.11-5A6.97 6.97 0 0 0 67 68c0-3.86-3.14-7-7-7H39V47c0-1.1-.9-2-2-2s-2 .9-2 2v4H25V31h19.16c.98 6.77 6.8 12 13.84 12s12.86-5.23 13.84-12H91v20z"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div class="p-5 border-b border-slate-100 font-bold text-slate-800">Order Status Breakdown</div>
                    <div class="flex-1 overflow-y-auto">
                        <table class="w-full text-left">
                            <tbody class="divide-y divide-slate-100">
                                ${Object.entries(statusCounts).map(([status, count]) => {
        const percent = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
        return `
                                    <tr class="hover:bg-slate-50 transition-colors">
                                        <td class="px-5 py-3 font-bold text-xs text-slate-600 uppercase w-32">${status}</td>
                                        <td class="px-5 py-3 w-full">
                                            <div class="flex items-center gap-3">
                                                <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div class="h-full bg-indigo-600 rounded-full" style="width: ${percent}%"></div>
                                                </div>
                                                <span class="text-xs font-mono font-bold text-slate-400 w-8 text-right">${count}</span>
                                            </div>
                                        </td>
                                    </tr>`;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div class="p-5 border-b border-slate-100 flex justify-between items-center">
                        <span class="font-bold text-slate-800">Top Categories</span>
                        <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold uppercase">Active Orders</span>
                    </div>
                    <div class="flex-1 overflow-y-auto">
                        <table class="w-full text-left">
                            <tbody class="divide-y divide-slate-100">
                                ${Object.entries(categoryBreakdown || {}).map(([cat, count]) => {
        const maxVal = Math.max(...Object.values(categoryBreakdown), 1);
        const percent = Math.round((count / maxVal) * 100);
        return `
                                    <tr class="hover:bg-slate-50 transition-colors">
                                        <td class="px-5 py-3 font-bold text-xs text-slate-600 uppercase w-32 truncate" title="${cat}">${cat}</td>
                                        <td class="px-5 py-3 w-full">
                                            <div class="flex items-center gap-3">
                                                <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div class="h-full bg-emerald-500 rounded-full" style="width: ${percent}%"></div>
                                                </div>
                                                <span class="text-xs font-mono font-bold text-slate-400 w-8 text-right">${count}</span>
                                            </div>
                                        </td>
                                    </tr>`;
    }).join('')}
                                ${!categoryBreakdown || Object.keys(categoryBreakdown).length === 0 ? `<div class="p-8 text-center text-slate-400 text-xs">No active category data</div>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;
}

// --- TOAST UI ---
function toastUi() {
    if (!state.toast) return "";
    const { msg, type } = state.toast;

    // Default to Info (Slate/Dark for neutral updates)
    // OR we can make Info light too if you prefer: "bg-slate-50 border-slate-200 text-slate-800"
    // Let's stick to the main.js logic you liked.

    let bgClass = "bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-lg";

    if (type === 'success') {
        // ✅ Match Main.js: Light Green
        bgClass = "bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-lg";
    } else if (type === 'error') {
        // ✅ Match Main.js: Light Red
        bgClass = "bg-rose-50 border border-rose-200 text-rose-900 shadow-lg";
    }

    return `
    <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none">
        <div class="${bgClass} px-4 py-3 rounded-xl flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            ${type === 'success' ? icon('check-circle') : type === 'error' ? icon('alert-circle') : icon('info')}
            <span class="text-sm font-semibold">${escapeHtml(msg)}</span>
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
            Cancel
          </button>
          <button onclick="window.resolveConfirm(true)" class="flex-1 h-9 rounded-lg text-xs font-bold transition shadow-md ${btnClass}">
            Confirm
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
    let content = "";
    const inputStyle = "w-full h-11 border border-slate-300 rounded-xl px-3 text-sm focus:ring-2 focus:ring-slate-800 outline-none transition-all font-medium text-slate-700 bg-white";
    const labelStyle = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    // --- ADD CATEGORY ---
    if (type === 'ADD_CATEGORY') {
        content = `
            <h2 class="font-bold text-xl mb-6 text-slate-900">New Category</h2>
            <div class="space-y-5">
                <div><label class="${labelStyle}">Category Name</label><input id="newCatName" class="${inputStyle}" placeholder="e.g. Wash & Dry" autofocus></div>
                <div><label class="${labelStyle}">Short Code</label><input id="newCatCode" class="${inputStyle} uppercase font-mono tracking-widest" placeholder="e.g. WDP"></div>
            </div>
            <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button onclick="window.closeModal()" class="h-11 px-6 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">Cancel</button>
                <button onclick="window.submitAddCategory()" class="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition shadow-lg">Save</button>
            </div>
        `;
    }
    // --- EDIT CATEGORY ---
    else if (type === 'EDIT_CATEGORY') {
        content = `
            <h2 class="font-bold text-xl mb-6 text-slate-900">Edit Category</h2>
            <div class="space-y-5">
                <div><label class="${labelStyle}">Category Name</label><input id="editCatName" class="${inputStyle}" value="${data.name}" autofocus></div>
                <div><label class="${labelStyle}">Short Code</label><input id="editCatCode" class="${inputStyle} uppercase font-mono tracking-widest" value="${data.code}"></div>
            </div>
            <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button onclick="window.closeModal()" class="h-11 px-6 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">Cancel</button>
                <button onclick="window.submitEditCategory(${data.id})" class="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition shadow-lg">Update</button>
            </div>
        `;
    }
    // --- ITEM MODALS ---
    else if (type === 'ADD_ITEM' || type === 'EDIT_ITEM') {
        const isEdit = type === 'EDIT_ITEM';
        const title = isEdit ? 'Edit Item' : 'New Item';
        const btnText = isEdit ? 'Update' : 'Create';
        const name = isEdit ? data.displayName : '';
        const code = isEdit ? data.itemCode : '';
        const price = isEdit ? Number(data.basePrice).toFixed(2) : '';
        const days = isEdit ? data.defaultTatDays : 3;
        const unit = isEdit ? data.unitType : 'PCS';

        content = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="font-bold text-xl text-slate-900">${title}</h2>
                ${isEdit ? `<span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">${data.itemCode}</span>` : ''}
            </div>
            <div class="space-y-5">
                <div class="grid grid-cols-3 gap-4">
                     <div class="col-span-2">
                        <label class="${labelStyle}">Item Code</label>
                        <input id="itemCode" class="${inputStyle} uppercase font-mono" value="${code}" placeholder="e.g. WDP/SHT">
                     </div>
                     <div>
                        <label class="${labelStyle}">Unit</label>
                        <select id="itemUnit" class="${inputStyle} cursor-pointer">
                            <option value="PCS" ${unit === 'PCS' ? 'selected' : ''}>PCS</option>
                            <option value="KG" ${unit === 'KG' ? 'selected' : ''}>KG</option>
                            <option value="SET" ${unit === 'SET' ? 'selected' : ''}>SET</option>
                        </select>
                     </div>
                </div>
                <div><label class="${labelStyle}">Display Name</label><input id="itemName" class="${inputStyle}" value="${name}" placeholder="e.g. Cotton Shirt"></div>
                <div class="grid grid-cols-2 gap-4">
                     <div><label class="${labelStyle}">Price (Rs.)</label><input id="itemPrice" type="number" step="0.01" class="${inputStyle}" value="${price}" placeholder="0.00"></div>
                     <div><label class="${labelStyle}">TAT (Days)</label><input id="itemDays" type="number" class="${inputStyle}" value="${days}"></div>
                </div>
            </div>
            <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button onclick="window.closeModal()" class="h-11 px-6 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">Cancel</button>
                <button onclick="${isEdit ? `window.submitEditItem(${data.id})` : 'window.submitAddItem()'}" class="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition shadow-lg">${btnText}</button>
            </div>
        `;
    }

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100 ring-1 ring-black/5">
            ${content}
        </div>
    </div>
    `;
}

// --- GLOBAL ATTACHMENTS ---
window.switchTab = (tab) => {
    state.activeTab = tab;
    render();
    if (tab === 'CUSTOMERS' && state.customers.length === 0) loadCustomers();
    if (tab === 'REPORTS' && !state.reports) loadReports(); // Load only if empty
};
window.handleSelectCategory = (id) => { state.selectedCatId = id; loadItems(id); render(); };
window.handleToggleCategory = async (e, id, newVal) => {
    e.stopPropagation();
    const action = newVal ? 'Activate' : 'Deactivate';
    // Use 'danger' type for deactivation if it's destructive, or normal if it's reversible/safe.
    // For categories, hiding them is significant, so let's use danger for visual cue.
    const type = newVal ? 'normal' : 'danger';

    if (!await window.confirmAction(`${action} this category?\n\nIf deactivated, items will be hidden.`, type)) return;

    try {
        await apiPatch(`/api/catalog/categories/${id}/toggle`, { isActive: newVal });
        await loadCategories();
        showToast(`Category ${newVal ? 'Activated' : 'Deactivated'}`, 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
};
window.handleEditCategory = (e, id) => { e.stopPropagation(); state.modal = { type: 'EDIT_CATEGORY', data: state.categories.find(c => c.id === id) }; render(); };
window.handleToggleItem = async (id, newVal) => {
    // ✅ SAFETY CHECK: Only ask if we are Disabling (newVal is false)
    if (newVal === false) {
        // Use 'danger' type (red button)
        if (!await window.confirmAction("Disable this item?\nIt will be hidden from new orders.", 'danger')) return;
    }

    try {
        await apiPatch(`/api/catalog/items/${id}/toggle`, { isActive: newVal });
        await loadItems(state.selectedCatId);
        showToast(`Item ${newVal ? 'Enabled' : 'Disabled'}`, 'info');
    } catch (e) {
        showToast(e.message, 'error');
    }
};
window.handleEditItem = (id) => { state.modal = { type: 'EDIT_ITEM', data: state.items.find(i => i.id === id) }; render(); };
window.handleSelectCustomer = (id) => { state.selectedCustId = id; render(); };
window.handleSaveCustomer = async (id) => {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const notes = document.getElementById('custNotes').value.trim();

    // 1. Validate Name (Required)
    if (!name) {
        return showToast("Customer Name is required.", 'error');
    }

    // 2. Validate Phone Format (Sri Lanka: 10 Digits starting with 0)
    // Matches logic in Counter Board
    const slPhoneRegex = /^0\d{9}$/;
    if (!slPhoneRegex.test(phone)) {
        return showToast("Invalid Phone. Must be 10 digits starting with 0 (e.g., 077...)", 'error');
    }

    // 3. Duplicate Phone Check (Prevent Crashes)
    // We check our local list of customers before sending to server
    const currentCust = state.customers.find(c => c.id === id);

    // Only check if the phone number is being CHANGED
    if (currentCust && currentCust.phone !== phone) {
        const duplicate = state.customers.find(c => c.phone === phone);
        if (duplicate) {
            // Alert user instead of crashing
            return showToast(`Phone number already in use by: ${duplicate.name}`, 'error');
        }
    }

    // Prepare Payload
    const data = { name, phone, address, notes };

    try {
        await apiPatch(`/api/customers/${id}`, data);
        await loadCustomers();
        showToast("Customer details saved successfully!", 'success');
    } catch (e) {
        showToast(e.message || "Failed to save", 'error');
    }
};
window.handleArchiveCustomer = async (id, isArchived) => {
    const action = isArchived ? 'ARCHIVE' : 'UNARCHIVE';
    const type = isArchived ? 'danger' : 'normal';

    if (!await window.confirmAction(`${action} this customer?`, type)) return;

    try {
        await apiPatch(`/api/customers/${id}/archive`, { isArchived });
        await loadCustomers();
        showToast(`Customer ${isArchived ? 'Archived' : 'Unarchived'}`, 'info');
    } catch (e) {
        showToast(e.message, 'error');
    }
};

//Promise-based Confirmation with Type
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

window.closeModal = () => { state.modal = null; render(); };
window.submitAddCategory = async () => {
    const name = document.getElementById('newCatName').value.trim();
    const code = document.getElementById('newCatCode').value.trim().toUpperCase();
    if (!name || !code) return showToast("Required", 'error');
    try { await apiPost('/api/catalog/categories', { name, code }); window.closeModal(); await loadCategories(); showToast("Created"); } catch (e) { showToast(e.message, 'error'); }
};
window.submitEditCategory = async (id) => {
    const name = document.getElementById('editCatName').value.trim();
    const code = document.getElementById('editCatCode').value.trim().toUpperCase();
    try { await apiPatch(`/api/catalog/categories/${id}`, { name, code }); window.closeModal(); await loadCategories(); showToast("Updated"); } catch (e) { showToast(e.message, 'error'); }
};
window.submitAddItem = async () => {
    const payload = {
        categoryId: state.selectedCatId,
        displayName: document.getElementById('itemName').value,
        itemCode: document.getElementById('itemCode').value,
        basePrice: Number(document.getElementById('itemPrice').value),
        unitType: document.getElementById('itemUnit').value,
        defaultTatDays: Number(document.getElementById('itemDays').value)
    };
    try { await apiPost('/api/catalog/items', payload); window.closeModal(); await loadItems(state.selectedCatId); showToast("Added"); } catch (e) { showToast(e.message, 'error'); }
};
window.submitEditItem = async (id) => {
    const payload = {
        displayName: document.getElementById('itemName').value,
        itemCode: document.getElementById('itemCode').value,
        basePrice: Number(document.getElementById('itemPrice').value),
        unitType: document.getElementById('itemUnit').value,
        defaultTatDays: Number(document.getElementById('itemDays').value)
    };
    try { await apiPatch(`/api/catalog/items/${id}`, payload); window.closeModal(); await loadItems(state.selectedCatId); showToast("Updated"); } catch (e) { showToast(e.message, 'error'); }
};
window.applyReportFilter = () => {
    state.reportFilter.start = document.getElementById('reportStart').value;
    state.reportFilter.end = document.getElementById('reportEnd').value;
    state.reportFilter.branch = document.getElementById('reportBranch').value; // ✅ Capture Branch
    loadReports();
};

// --- RENDER ---
function render() {
    document.getElementById('app').innerHTML = layout();

    // Attach dynamic listeners
    if (state.activeTab === 'CUSTOMERS') {
        const searchInput = document.getElementById('searchCustomers');
        searchInput?.addEventListener('input', () => {
            const listContainer = document.getElementById('customerList');
            if (listContainer) listContainer.innerHTML = renderCustomerListItems();
        });
    }

    const btnAddCat = document.getElementById('btnAddCategory');
    if (btnAddCat) btnAddCat.onclick = () => { state.modal = { type: 'ADD_CATEGORY' }; render(); };

    const btnAddItem = document.getElementById('btnAddItem');
    if (btnAddItem) btnAddItem.onclick = () => { state.modal = { type: 'ADD_ITEM' }; render(); };

    const btnAddItemEmpty = document.getElementById('btnAddItemEmpty');
    if (btnAddItemEmpty) btnAddItemEmpty.onclick = () => { state.modal = { type: 'ADD_ITEM' }; render(); };
}

// Start
init();