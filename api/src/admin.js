import { apiGet, apiPost, apiPatch } from "./api";
import "./style.css"; // Reuse your Tailwind styles

const state = {
    categories: [],
    items: [],
    selectedCatId: null,
    modal: null
};

// --- INITIALIZATION ---
async function init() {
    // 1. Check Auth (Admin Only)
    const role = localStorage.getItem('userRole');
    if (role !== 'ADMIN') {
        window.location.href = '/';
        return;
    }

    // 2. Load Data
    await loadCategories();
    renderCategories();

    // 3. Attach Global Event Listeners
    document.getElementById('btnAddCategory').addEventListener('click', () => openModal('ADD_CATEGORY'));
    document.getElementById('btnAddItem').addEventListener('click', () => {
        if (state.selectedCatId) openModal('ADD_ITEM');
    });
}

// --- DATA FETCHING ---
async function loadCategories() {
    try {
        state.categories = await apiGet('/api/catalog/categories');
    } catch (e) {
        alert("Failed to load categories: " + e.message);
    }
}

async function loadItems(catId) {
    try {
        // Fetch items for specific category
        // Note: You might need to update your backend GET /items to filter by categoryId if not already supported
        // Assuming /api/catalog/items?categoryId=X works as per previous discussions
        state.items = await apiGet(`/api/catalog/items?categoryId=${catId}&limit=100`);
        renderItems();
    } catch (e) {
        alert("Failed to load items: " + e.message);
    }
}

// --- RENDERING ---
function renderCategories() {
    const container = document.getElementById('categoryList');
    container.innerHTML = state.categories.map(c => `
        <div onclick="selectCategory(${c.id})" 
             class="p-3 cursor-pointer hover:bg-indigo-50 flex justify-between items-center ${state.selectedCatId === c.id ? 'bg-indigo-100 border-l-4 border-indigo-600' : ''}">
            <div>
                <div class="font-bold text-sm text-slate-800">${c.name}</div>
                <div class="text-xs text-slate-500 font-mono">${c.categoryCode}</div>
            </div>
            <div class="flex items-center gap-2">
                 <span class="text-[10px] px-2 py-0.5 rounded-full ${c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}">
                    ${c.isActive ? 'Active' : 'Inactive'}
                 </span>
                 <button onclick="toggleCategory(event, ${c.id}, ${!c.isActive})" class="text-slate-400 hover:text-indigo-600 px-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
            </div>
        </div>
    `).join('');

    // We have to attach click handlers globally or use the window object for inline onclick
    window.selectCategory = async (id) => {
        state.selectedCatId = id;
        const cat = state.categories.find(c => c.id === id);

        // Update UI Selection
        renderCategories(); // Re-render to show active class

        // Update Header
        document.getElementById('selectedCategoryTitle').innerText = `${cat.name} (${cat.categoryCode})`;
        document.getElementById('btnAddItem').classList.remove('hidden');

        // Load Items
        await loadItems(id);
    };

    window.toggleCategory = async (e, id, newVal) => {
        e.stopPropagation(); // Don't trigger select
        if (!confirm(`Are you sure you want to ${newVal ? 'Activate' : 'Deactivate'} this category?`)) return;

        try {
            await apiPatch(`/api/catalog/categories/${id}/toggle`, { isActive: newVal });
            await loadCategories(); // Reload
            renderCategories();
        } catch (err) {
            alert(err.message); // Backend will throw error if active items exist
        }
    };
}

function renderItems() {
    const container = document.getElementById('itemListWrapper');
    if (state.items.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 mt-10">No items found in this category.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                    <th class="p-3">Code</th>
                    <th class="p-3">Name</th>
                    <th class="p-3 text-right">Price (Rs.)</th>
                    <th class="p-3 text-center">Status</th>
                    <th class="p-3 text-right">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                ${state.items.map(i => `
                    <tr class="hover:bg-slate-50">
                        <td class="p-3 font-mono text-slate-500">${i.itemCode}</td>
                        <td class="p-3 font-medium">${i.displayName}</td>
                        <td class="p-3 text-right">${i.basePrice.toFixed(2)}</td>
                        <td class="p-3 text-center">
                            <span class="text-xs px-2 py-1 rounded-full ${i.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                                ${i.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td class="p-3 text-right">
                            <button onclick="editItem(${i.id})" class="text-indigo-600 hover:underline mr-2">Edit</button>
                            <button onclick="toggleItem(${i.id}, ${!i.isActive})" class="text-slate-500 hover:text-red-600">
                                ${i.isActive ? 'Disable' : 'Enable'}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    window.toggleItem = async (id, newVal) => {
        try {
            await apiPatch(`/api/catalog/items/${id}/toggle`, { isActive: newVal });
            await loadItems(state.selectedCatId); // Reload items
        } catch (e) { alert(e.message); }
    };

    window.editItem = (id) => {
        const item = state.items.find(i => i.id === id);
        openModal('EDIT_ITEM', item);
    };
}

// --- MODAL LOGIC (Simplified for MVP) ---
function openModal(type, data = null) {
    const container = document.getElementById('modalContainer');
    let html = '';

    if (type === 'ADD_CATEGORY') {
        html = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-xl w-96">
                    <h2 class="font-bold text-lg mb-4">Add Category</h2>
                    <input id="newCatName" class="w-full border p-2 rounded mb-2" placeholder="Name (e.g. Wash & Dry)">
                    <input id="newCatCode" class="w-full border p-2 rounded mb-4" placeholder="Code (e.g. WDP)">
                    <div class="flex justify-end gap-2">
                        <button onclick="closeModal()" class="px-4 py-2 text-slate-500">Cancel</button>
                        <button onclick="submitAddCategory()" class="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                    </div>
                </div>
            </div>
        `;
    }
    else if (type === 'ADD_ITEM') {
        html = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-xl w-96">
                    <h2 class="font-bold text-lg mb-4">Add Item</h2>
                    <div class="space-y-3">
                        <input id="newItemName" class="w-full border p-2 rounded" placeholder="Item Name">
                        <input id="newItemCode" class="w-full border p-2 rounded" placeholder="Item Code (e.g. WDP/SHT)">
                        <input id="newItemPrice" type="number" class="w-full border p-2 rounded" placeholder="Price (Rs.)">
                        <div class="flex gap-2">
                            <select id="newItemUnit" class="border p-2 rounded w-1/2">
                                <option value="PCS">PCS</option>
                                <option value="KG">KG</option>
                            </select>
                            <input id="newItemDays" type="number" class="border p-2 rounded w-1/2" placeholder="TAT Days (e.g. 3)" value="3">
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-4">
                        <button onclick="closeModal()" class="px-4 py-2 text-slate-500">Cancel</button>
                        <button onclick="submitAddItem()" class="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                    </div>
                </div>
            </div>
        `;
    }
    else if (type === 'EDIT_ITEM') {
        html = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-xl w-96">
                    <h2 class="font-bold text-lg mb-4">Edit Item: ${data.itemCode}</h2>
                    <div class="space-y-3">
                        <label class="text-xs text-slate-500">Display Name</label>
                        <input id="editItemName" class="w-full border p-2 rounded" value="${data.displayName}">
                        
                        <label class="text-xs text-slate-500">Price (Rs.)</label>
                        <input id="editItemPrice" type="number" class="w-full border p-2 rounded" value="${data.basePrice}">
                    </div>
                    <div class="flex justify-end gap-2 mt-4">
                        <button onclick="closeModal()" class="px-4 py-2 text-slate-500">Cancel</button>
                        <button onclick="submitEditItem(${data.id})" class="px-4 py-2 bg-indigo-600 text-white rounded">Update</button>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

window.closeModal = () => { document.getElementById('modalContainer').innerHTML = ''; };

window.submitAddCategory = async () => {
    const name = document.getElementById('newCatName').value;
    const code = document.getElementById('newCatCode').value;
    if (!name || !code) return alert("All fields required");
    try {
        await apiPost('/api/catalog/categories', { name, code });
        closeModal();
        await loadCategories();
        renderCategories();
    } catch (e) { alert(e.message); }
};

window.submitAddItem = async () => {
    const payload = {
        categoryId: state.selectedCatId,
        displayName: document.getElementById('newItemName').value,
        itemCode: document.getElementById('newItemCode').value,
        basePrice: Number(document.getElementById('newItemPrice').value),
        unitType: document.getElementById('newItemUnit').value,
        defaultTatDays: Number(document.getElementById('newItemDays').value)
    };
    try {
        await apiPost('/api/catalog/items', payload);
        closeModal();
        await loadItems(state.selectedCatId);
    } catch (e) { alert(e.message); }
};

window.submitEditItem = async (id) => {
    const payload = {
        displayName: document.getElementById('editItemName').value,
        basePrice: Number(document.getElementById('editItemPrice').value)
    };
    try {
        await apiPatch(`/api/catalog/items/${id}`, payload);
        closeModal();
        await loadItems(state.selectedCatId);
    } catch (e) { alert(e.message); }
};

// Start
init();