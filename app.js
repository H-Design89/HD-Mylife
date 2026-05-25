import { getData, addData, getSettings, updateSettings, updateRow, deleteData, createSheet } from './api.js';

// DOM Elements
const appContainer = document.getElementById('app-container');
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const loginPassword = document.getElementById('login-password');
const btnLogout = document.getElementById('btn-logout');

const dynamicNavLinks = document.getElementById('dynamic-nav-links');
const pageTitle = document.getElementById('page-title');
const contentArea = document.getElementById('content-area');
const btnAdd = document.getElementById('btn-add');
const btnToggleView = document.getElementById('btn-toggle-view');

const addModal = document.getElementById('add-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const addForm = document.getElementById('add-form');
const formFields = document.getElementById('form-fields');
const btnSubmit = document.getElementById('btn-submit');

// Quick Capture Elements
const btnQuickCapture = document.getElementById('btn-quick-capture');
const qcModal = document.getElementById('quick-capture-modal');
const btnCloseQc = document.getElementById('btn-close-quick-capture');
const qcForm = document.getElementById('quick-capture-form');
const qcContent = document.getElementById('qc-content');
const btnSubmitQc = document.getElementById('btn-submit-qc');

// Mobile UI Elements
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.querySelector('.sidebar');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// State
let currentTab = 'dashboard';
let currentData = [];
let appSettings = null; 
let projectsConfig = [];
let currentViewMode = 'table'; // 'kanban' or 'table'
let currentSortCol = null;
let currentSortAsc = true;

// Kanban Statuses
const KANBAN_STATUSES = ['Cần làm', 'Đang xử lý', 'Chờ duyệt', 'Hoàn thành'];

window.getStatusColor = function(status) {
    status = String(status || '').toLowerCase();
    if (status.includes('đang xử lý') || status.includes('in progress')) return 'var(--primary-color)';
    if (status.includes('chờ duyệt') || status.includes('review') || status.includes('pending')) return 'var(--warning-color)';
    if (status.includes('hoàn thành') || status.includes('done')) return 'var(--success-color)';
    return 'var(--text-color)'; // Default (Cần làm)
};

// Theme Initialization
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        if(themeIcon) themeIcon.setAttribute('name', 'sunny-outline');
    }
}
initTheme();

if(btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('light-mode');
        const isLight = document.documentElement.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeIcon.setAttribute('name', isLight ? 'sunny-outline' : 'moon-outline');
    });
}

// --- Init & Login Logic ---
async function init() {
    loginContainer.querySelector('.btn').innerHTML = '<span class="loader" style="width:20px; height:20px; border-width: 3px; margin:0"></span> Đang kết nối...';
    appSettings = await getSettings();
    loginContainer.querySelector('.btn').innerHTML = '<ion-icon name="log-in-outline"></ion-icon> Vào ứng dụng';
    
    if (!appSettings) {
        alert("Không thể kết nối đến Google Sheets. Vui lòng cập nhật đúng mã Google Apps Script mới và kiểm tra lại link.");
        return;
    }
    
    try { projectsConfig = JSON.parse(appSettings.Projects); } catch(e) { projectsConfig = []; }

    if (sessionStorage.getItem('isLoggedIn') === 'true') showApp();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (appSettings && loginPassword.value === appSettings.Password) {
        sessionStorage.setItem('isLoggedIn', 'true');
        showApp();
    } else alert("Mật khẩu không chính xác!");
});

btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('isLoggedIn');
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    loginPassword.value = '';
});

function showApp() {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    renderSidebar();
    loadPage('dashboard', 'Tổng quan');
}

// --- Sidebar & Mobile Menu ---
btnMobileMenu.addEventListener('click', () => {
    sidebar.classList.add('mobile-active');
    sidebarOverlay.classList.add('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-active');
    sidebarOverlay.classList.remove('active');
});

function renderSidebar() {
    let html = `<li class="nav-link active" data-target="dashboard"><ion-icon name="grid-outline"></ion-icon> Tổng quan</li>`;
    projectsConfig.forEach(proj => {
        html += `<li class="nav-link" data-target="${proj.id}"><ion-icon name="${proj.icon || 'folder-outline'}"></ion-icon> ${proj.name}</li>`;
    });
    dynamicNavLinks.innerHTML = html;
    
    const allLinks = document.querySelectorAll('.sidebar .nav-link:not(#btn-logout)');
    allLinks.forEach(link => {
        link.addEventListener('click', () => {
            allLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Đóng sidebar trên mobile
            sidebar.classList.remove('mobile-active');
            sidebarOverlay.classList.remove('active');
            
            loadPage(link.getAttribute('data-target'), link.textContent.trim());
        });
    });
}

// --- Main Navigation ---
async function loadPage(target, title) {
    currentTab = target;
    pageTitle.textContent = title;
    
    // Hide controls by default
    btnAdd.classList.add('hidden');
    btnToggleView.classList.add('hidden');
    
    if (target === 'dashboard') {
        renderDashboard();
    } else if (target === 'admin') {
        renderAdmin();
    } else {
        btnAdd.classList.remove('hidden');
        showLoader();
        
        // Reset filters khi chuyển trang
        activeFilters = {};
        
        try {
            const results = await Promise.all([
                getData(target),
                getData('LichSu')
            ]);
            currentData = results[0];
            window.globalHistoryData = results[1] && !results[1].error ? results[1] : [];
        } catch (e) {
            currentData = await getData(target);
            window.globalHistoryData = [];
        }
        
        if (target === 'TaiChinh' || title.toLowerCase().includes('tài chính')) {
            renderFinance(currentData, target);
        } else if (target === 'GhiChu' || title.toLowerCase().includes('ghi chú')) {
            renderNotes(currentData, target);
        } else {
            // Check if it should be a Kanban board
            const headers = getHeaders(currentData, target);
            const hasKanbanCols = headers.find(h => h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status') && headers.find(h => h.toLowerCase() === 'id');
            
            if (hasKanbanCols) {
                btnToggleView.classList.remove('hidden');
                if (currentViewMode === 'kanban') {
                    btnToggleView.innerHTML = '<ion-icon name="list-outline"></ion-icon> Dạng Bảng';
                    renderKanban(currentData, target, headers);
                } else {
                    btnToggleView.innerHTML = '<ion-icon name="albums-outline"></ion-icon> Dạng Kanban';
                    renderTable(currentData, target, true); // true = allow inline edit
                }
            } else {
                renderTable(currentData, target, true); // Enabled inline editing for non-Kanban boards
            }
        }
    }
}

btnToggleView.addEventListener('click', () => {
    currentViewMode = currentViewMode === 'kanban' ? 'table' : 'kanban';
    // Re-render without re-fetching
    const headers = getHeaders(currentData, currentTab);
    if (currentViewMode === 'kanban') {
        btnToggleView.innerHTML = '<ion-icon name="list-outline"></ion-icon> Dạng Bảng';
        renderKanban(currentData, currentTab, headers);
    } else {
        btnToggleView.innerHTML = '<ion-icon name="albums-outline"></ion-icon> Dạng Kanban';
        renderTable(currentData, currentTab, true);
    }
});

function showLoader() {
    contentArea.innerHTML = `<div class="loading-container"><span class="loader"></span><p class="mt-4">Đang tải dữ liệu...</p></div>`;
}

function getHeaders(data, sheetName) {
    // 1. Check custom configured columns
    const projConfig = projectsConfig.find(p => p.id === sheetName);
    if (projConfig && projConfig.columns) {
        // Parse columns from config and ensure ID is present
        const customCols = projConfig.columns.split(',').map(c => c.trim()).filter(c => c && c.toUpperCase() !== 'ID');
        if (customCols.length > 0) {
            return ['ID', ...customCols];
        }
    }
    
    // 2. Fallback to existing logic
    if (data && data.length > 0) return Object.keys(data[0]);
    if (sheetName === 'TaiChinh') return ['Ngày', 'Loại', 'Số tiền', 'Danh mục', 'Dự án', 'Ghi chú'];
    if (sheetName === 'GhiChu') return ['ID', 'Ngày tạo', 'Tiêu đề', 'Thẻ', 'Nội dung'];
    if (sheetName === 'Inbox') return ['ID', 'Ngày', 'Nội dung', 'Trạng thái'];
    if (sheetName === 'CongTy') return ['ID', 'Ngày', 'Trạng thái', 'Khách hàng/Nhà cung cấp', 'Phân loại', 'Người thực hiện', 'Người gặp', 'Địa điểm', 'Nội dung trao đổi', 'Nội dung xử lý', 'Phản hồi của khách/NCC', 'Loại'];
    return ['ID', 'Ngày', 'Trạng thái']; // Default with ID and Trạng thái for Kanban
}

// --- Render Functions ---

window.updateStatusInline = async function(selectEl, id) {
    const newStatus = selectEl.value;
    selectEl.disabled = true;
    const oldBg = selectEl.style.background;
    selectEl.style.background = 'rgba(255, 255, 255, 0.2)'; // Loading style
    
    const updateData = {};
    const statusColName = selectEl.getAttribute('data-col');
    updateData[statusColName] = newStatus;
    
    const res = await updateRow(currentTab, 'ID', id, updateData);
    if(res.error) {
        alert("Lỗi cập nhật: " + res.error);
        // revert select
        const row = currentData.find(r => r['ID'] === id);
        if(row) selectEl.value = row[statusColName];
    } else {
        // Update currentData array locally
        const row = currentData.find(r => r['ID'] === id);
        if(row) row[statusColName] = newStatus;
        selectEl.style.color = getStatusColor(newStatus);
        selectEl.style.borderColor = getStatusColor(newStatus);
    }
    selectEl.disabled = false;
    selectEl.style.background = oldBg;
};

window.updatePriorityInline = async function(selectEl, id) {
    const newValue = selectEl.value;
    selectEl.disabled = true;
    const oldBg = selectEl.style.background;
    selectEl.style.background = 'rgba(255, 255, 255, 0.2)'; // Loading style
    
    const updateData = {};
    const colName = selectEl.getAttribute('data-col');
    updateData[colName] = newValue;
    
    const res = await updateRow(currentTab, 'ID', id, updateData);
    if(res.error) {
        alert("Lỗi cập nhật: " + res.error);
        const row = currentData.find(r => r['ID'] === id);
        if(row) selectEl.value = row[colName];
    } else {
        const row = currentData.find(r => r['ID'] === id);
        if(row) row[colName] = newValue;
    }
    selectEl.disabled = false;
    selectEl.style.background = oldBg;
};

window.updateDateInline = async function(inputEl, id) {
    const newValue = inputEl.value;
    let formattedForSheet = newValue;
    if (newValue) {
        let parts = newValue.split('-');
        if (parts.length === 3) formattedForSheet = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    inputEl.disabled = true;
    const oldBg = inputEl.style.background;
    inputEl.style.background = 'rgba(255, 255, 255, 0.2)';
    
    const updateData = {};
    const colName = inputEl.getAttribute('data-col');
    updateData[colName] = formattedForSheet;
    
    const res = await updateRow(currentTab, 'ID', id, updateData);
    if(res.error) {
        alert("Lỗi cập nhật: " + res.error);
        const row = currentData.find(r => String(r['ID']) === String(id));
        if(row) {
            let oldVal = row[colName] || '';
            let p = String(oldVal).split('/');
            if(p.length === 3) inputEl.value = `${p[2]}-${p[1]}-${p[0]}`;
            else inputEl.value = oldVal;
        }
    } else {
        const row = currentData.find(r => String(r['ID']) === String(id));
        if(row) row[colName] = formattedForSheet;
        
        renderTable(currentData, currentTab, true); // Force UI refresh to apply sorting/colors accurately
    }
    inputEl.disabled = false;
    inputEl.style.background = oldBg;
};

window.editLinkPrompt = async function(id, colName, oldVal) {
    const newVal = prompt("Nhập đường link mới (bắt đầu bằng http:// hoặc https://):", oldVal);
    if (newVal === null || newVal.trim() === oldVal.trim()) return;
    
    document.body.style.cursor = 'wait';
    const updateData = {};
    updateData[colName] = newVal.trim();
    
    const res = await updateRow(currentTab, 'ID', id, updateData);
    document.body.style.cursor = 'default';
    
    if(res.error) {
        alert("Lỗi cập nhật: " + res.error);
    } else {
        const row = currentData.find(r => String(r['ID']) === String(id));
        if(row) row[colName] = newVal.trim();
        renderTable(currentData, currentTab, true);
    }
};

window.toggleId = function(cell) {
    const hiddenId = cell.querySelector('.hidden-id');
    if (hiddenId) {
        hiddenId.style.display = hiddenId.style.display === 'none' ? 'block' : 'none';
    }
};

window.updateCellInline = async function(cell, id, columnName) {
    const newValue = cell.innerText.trim();
    
    const row = currentData.find(r => String(r['ID']) === String(id));
    const oldValue = row ? (row[columnName] || '') : '';
    
    if (newValue === String(oldValue).trim()) return; // No change
    
    cell.contentEditable = "false";
    const oldBg = cell.style.background;
    cell.style.background = 'rgba(255, 255, 255, 0.2)'; // Loading
    
    const updateDataObj = {};
    updateDataObj[columnName] = newValue;
    
    const res = await updateRow(currentTab, 'ID', id, updateDataObj);
    if(res.error) {
        alert("Lỗi cập nhật: " + res.error);
        cell.innerText = oldValue; // Revert
    } else {
        if(row) row[columnName] = newValue;
    }
    
    cell.style.background = oldBg;
    cell.contentEditable = "true";
};

window.deleteRowData = async function(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa dữ liệu này?")) return;
    
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;margin:0"></span>';
    btn.disabled = true;
    
    const res = await deleteData(currentTab, 'ID', id);
    if(res.error) {
        alert("Lỗi khi xóa: " + res.error);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    } else {
        // Remove locally
        currentData = currentData.filter(r => String(r['ID']) !== String(id));
        
        // Re-render
        const headers = getHeaders(currentData, currentTab);
        if (currentViewMode === 'kanban') {
            renderKanban(currentData, currentTab, headers);
        } else {
            renderTable(currentData, currentTab, true);
        }
    }
};

window.sortData = function(colName) {
    if (currentSortCol === colName) {
        currentSortAsc = !currentSortAsc;
    } else {
        currentSortCol = colName;
        currentSortAsc = true;
    }
    
    currentData.sort((a, b) => {
        let valA = a[colName] || '';
        let valB = b[colName] || '';
        
        // Date parsing
        if (typeof valA === 'string' && valA.match(/^\d{4}-\d{2}-\d{2}/)) valA = new Date(valA).getTime();
        if (typeof valB === 'string' && valB.match(/^\d{4}-\d{2}-\d{2}/)) valB = new Date(valB).getTime();
        
        // Number parsing
        let numA = parseFloat(String(valA).replace(/[,.]/g, ''));
        let numB = parseFloat(String(valB).replace(/[,.]/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
            valA = numA; valB = numB;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        
        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
    });
    
    const headers = getHeaders(currentData, currentTab);
    renderTable(currentData, currentTab, true);
};

function formatCell(val, colName, statusVal, idVal) {
    if (!val) return '';
    const h = colName.toLowerCase();
    
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
        val = new Date(val).toLocaleDateString('vi-VN');
    }
    
    if (typeof val === 'string') {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(val)) {
            if (val.trim().match(/^https?:\/\/[^\s]+$/)) {
                let pureUrl = val.trim();
                if (idVal) {
                    return `<div style="display: flex; gap: 5px; align-items: center;">
                                <a href="${pureUrl}" target="_blank" class="btn-link" contenteditable="false" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><ion-icon name="link-outline"></ion-icon> Mở Link</a>
                                <button class="btn" style="padding: 2px 6px; font-size: 0.9rem; background: rgba(255,255,255,0.1); color: var(--text-color); border: 1px solid var(--glass-border); border-radius: 4px; display: flex; align-items: center; justify-content: center;" onclick="editLinkPrompt('${idVal}', '${colName}', '${pureUrl}')" title="Sửa link"><ion-icon name="pencil-outline"></ion-icon></button>
                            </div>`;
                }
                return `<a href="${pureUrl}" target="_blank" class="btn-link" contenteditable="false"><ion-icon name="link-outline"></ion-icon> Mở Link</a>`;
            } else {
                return val.replace(urlRegex, function(url) {
                    return `<a href="${url}" style="color: #3b82f6; text-decoration: underline; cursor: pointer;" contenteditable="false" onclick="window.open('${url}', '_blank'); event.stopPropagation(); return false;">${url}</a>`;
                });
            }
        }
    }
    
    if (h.includes('ưu tiên') || h.includes('priority')) {
        let v = String(val).toLowerCase();
        if (v.includes('cao') || v.includes('high')) return `🔴 ${val}`;
        if (v.includes('trung bình') || v.includes('medium')) return `🟡 ${val}`;
        if (v.includes('thấp') || v.includes('low')) return `🟢 ${val}`;
    }
    
    return val;
}

function renderTable(data, sheetName, allowInlineEdit = true, forceShowHeaders = false) {
    if ((!data || data.length === 0) && !forceShowHeaders) {
        contentArea.innerHTML = `<div class="glass-card text-center"><p class="mt-4">Chưa có dữ liệu. Hãy thêm bản ghi mới!</p><p style="color:var(--warning-color); font-size:0.8rem; margin-top:10px">Mẹo: Để dùng tính năng Kanban kéo thả, Sheet của bạn phải có cột 'ID' và cột 'Trạng thái'.</p></div>`;
        return;
    }
    const headers = getHeaders(data, sheetName);
    const idCol = headers.find(h => h.toLowerCase() === 'id');

    let html = `<div class="glass-card table-container"><table><thead><tr>`;
    const displayHeaders = headers.filter(h => h !== idCol);
    
    displayHeaders.forEach(h => {
        let sortIconHtml = '';
        if (h === currentSortCol) {
            sortIconHtml = currentSortAsc ? `<ion-icon name="caret-up-outline" class="sort-icon active"></ion-icon>` : `<ion-icon name="caret-down-outline" class="sort-icon active"></ion-icon>`;
        } else {
            sortIconHtml = `<ion-icon name="caret-up-outline" class="sort-icon"></ion-icon>`;
        }
        
        html += `<th style="position: relative;" class="sortable">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; cursor: pointer; flex: 1" onclick="sortData('${h}')">
                            ${h} ${sortIconHtml}
                        </div>
                        <ion-icon name="filter-outline" class="excel-filter-icon" id="icon-filter-${h.replace(/\s+/g, '-')}" onclick="toggleExcelFilter(event, '${h}')" title="Lọc dữ liệu"></ion-icon>
                    </div>
                </th>`;
    });
    if (allowInlineEdit && idCol) html += `<th style="width: 140px; text-align: center;">Thao tác</th>`;
    html += `</tr></thead><tbody>`;

    data.forEach((row, rowIndex) => {
        html += `<tr class="data-row" data-index="${rowIndex}">`;
        const idVal = idCol ? row[idCol] : '';
        headers.forEach(h => {
            if (h === idCol) return; // Hide ID column

            let rawVal = row[h];
            let statusCol = headers.find(col => col.toLowerCase() === 'trạng thái' || col.toLowerCase() === 'status');
            let statusVal = statusCol ? row[statusCol] : '';
            let val = formatCell(rawVal, h, statusVal, idVal);

            let isDateCol = h.toLowerCase().includes('ngày') || h.toLowerCase() === 'date';

            if (isDateCol) {
                html += `<td style="cursor: pointer;" onclick="toggleId(this)">
                            <div class="date-val">${val || ''}</div>
                            <div class="hidden-id" style="display: none; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">ID: ${idVal}</div>
                         </td>`;
            } else if (allowInlineEdit && idCol && (h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status')) {
                // Inline edit for status column
                const sColor = getStatusColor(val);
                let selectHtml = `<select class="form-control" style="padding: 0.25rem; font-size: 0.85rem; font-weight: 600; color: ${sColor}; border-color: ${sColor};" data-col="${h}" onchange="updateStatusInline(this, '${idVal}')">`;
                KANBAN_STATUSES.forEach(s => {
                    const selected = (val === s) ? 'selected' : '';
                    selectHtml += `<option value="${s}" style="color: var(--text-color);" ${selected}>${s}</option>`;
                });
                selectHtml += `</select>`;
                html += `<td>${selectHtml}</td>`;
            } else if (allowInlineEdit && idCol && (h.toLowerCase().includes('ưu tiên') || h.toLowerCase().includes('priority') || h.toLowerCase().includes('uu tien'))) {
                let options = ['Cao', 'Trung bình', 'Thấp'];
                let selectHtml = `<select class="form-control" style="padding: 0.25rem; font-size: 0.85rem; font-weight: 600; min-width: 110px;" data-col="${h}" onchange="updatePriorityInline(this, '${idVal}')">`;
                selectHtml += `<option value="">- Chọn -</option>`;
                options.forEach(s => {
                    const selected = (String(rawVal).toLowerCase().includes(s.toLowerCase())) ? 'selected' : '';
                    let icon = s === 'Cao' ? '🔴' : s === 'Trung bình' ? '🟡' : '🟢';
                    selectHtml += `<option value="${s}" ${selected}>${icon} ${s}</option>`;
                });
                selectHtml += `</select>`;
                html += `<td>${selectHtml}</td>`;
            } else if (allowInlineEdit && idCol && (h.toLowerCase().includes('hạn chót') || h.toLowerCase().includes('deadline') || h.toLowerCase().includes('han chot'))) {
                let dateInputVal = '';
                let parts = String(val).split('/');
                if (parts.length === 3) dateInputVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
                
                let inputClass = 'form-control';
                if (dateInputVal && String(statusVal).toLowerCase() !== 'hoàn thành' && String(statusVal).toLowerCase() !== 'done') {
                    let d = new Date(dateInputVal);
                    if (!isNaN(d.getTime())) {
                        let today = new Date();
                        today.setHours(0,0,0,0);
                        let diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) inputClass += ' deadline-overdue';
                        else if (diffDays <= 2) inputClass += ' deadline-warning';
                    }
                }
                
                let inputHtml = `<input type="date" class="${inputClass}" style="padding: 0.25rem; font-size: 0.85rem; max-width: 140px;" data-col="${h}" value="${dateInputVal}" onchange="updateDateInline(this, '${idVal}')">`;
                html += `<td>${inputHtml}</td>`;
            } else if (allowInlineEdit && idCol) {
                // Make cell content editable
                // Don't make links editable this way to avoid breaking the HTML if it's purely a link button
                if (String(rawVal).trim().match(/^https?:\/\/[^\s]+$/)) {
                    html += `<td>${val || ''}</td>`;
                } else {
                    html += `<td contenteditable="true" class="editable-cell" onblur="updateCellInline(this, '${idVal}', '${h}')">${val || ''}</td>`;
                }
            } else {
                if (h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status') {
                    const sColor = getStatusColor(rawVal);
                    html += `<td style="color: ${sColor}; font-weight: 600;">${val || ''}</td>`;
                } else {
                    html += `<td>${val || ''}</td>`;
                }
            }
        });
        
        if (allowInlineEdit && idCol) {
            // Find a suitable title to pass to history
            const titleCol = headers.find(h => h.toLowerCase().includes('tên') || h.toLowerCase().includes('khách hàng') || h.toLowerCase().includes('tiêu đề')) || headers[2] || headers[1];
            const titleVal = String(row[titleCol] || 'Không xác định').replace(/'/g, "\\'");
            
            let historyCount = 0;
            if (window.globalHistoryData && window.globalHistoryData.length > 0) {
                historyCount = window.globalHistoryData.filter(r => String(r.ParentID) === String(idVal)).length;
            }
            const badgeHtml = historyCount > 0 ? `<span style="position:absolute; top:-6px; right:-6px; background:var(--danger-color); color:white; font-size:0.65rem; font-weight:bold; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 0 2px var(--glass-bg);">${historyCount}</span>` : '';
            
            html += `<td style="text-align: center; white-space: nowrap;">
                        <button class="btn" style="position: relative; background: var(--primary-color); color: white; padding: 0.35rem 0.6rem; font-size: 1.1rem; border-radius: 6px; margin-right: 4px;" onclick="openHistory('${idVal}', '${titleVal}')" title="Xem lịch sử chăm sóc">
                            <ion-icon name="time-outline"></ion-icon>
                            ${badgeHtml}
                        </button>
                        <button class="btn" style="background: var(--warning-color); color: white; padding: 0.35rem 0.6rem; font-size: 1.1rem; border-radius: 6px; margin-right: 4px;" onclick="copyRowData('${idVal}')" title="Copy dòng này">
                            <ion-icon name="copy-outline"></ion-icon>
                        </button>
                        <button class="btn" style="background: var(--danger-color); color: white; padding: 0.35rem 0.6rem; font-size: 1.1rem; border-radius: 6px;" onclick="deleteRowData('${idVal}')" title="Xóa dòng này">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                     </td>`;
        }
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    contentArea.innerHTML = html;
}

function renderKanban(data, sheetName, headers) {
    let html = `<div class="kanban-board">`;
    const statusCol = headers.find(h => h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status');
    const titleCol = headers.find(h => h.toLowerCase().includes('tên') || h.toLowerCase().includes('tiêu đề')) || headers[2] || headers[1];
    
    // Create columns
    KANBAN_STATUSES.forEach(status => {
        html += `
            <div class="kanban-column" data-status="${status}">
                <div class="kanban-column-header">
                    <span>${status}</span>
                    <span class="badge" style="background:var(--primary-color); padding:2px 8px; border-radius:12px; font-size:0.8rem">
                        ${data.filter(row => (row[statusCol] || 'Cần làm') === status).length}
                    </span>
                </div>
                <div class="kanban-cards">
        `;
        
        data.filter(row => {
            const rowStatus = row[statusCol] || 'Cần làm';
            return rowStatus === status;
        }).forEach(row => {
            const id = row['ID'];
            const title = row[titleCol] || 'Không có tên';
            html += `
                <div class="kanban-card" draggable="true" data-id="${id}">
                    <div style="font-weight:600; margin-bottom:0.5rem">${title}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">ID: ${id}</div>
                </div>
            `;
        });
        
        html += `</div></div>`; // close cards, close column
    });
    html += `</div>`;
    contentArea.innerHTML = html;
    attachKanbanEvents(statusCol);
}

function attachKanbanEvents(statusCol) {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-column');
    let draggedCard = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            draggedCard = card;
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => {
            draggedCard = null;
            card.classList.remove('dragging');
        });
    });

    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
        column.addEventListener('drop', async e => {
            e.preventDefault();
            column.classList.remove('drag-over');
            if (draggedCard) {
                const newStatus = column.getAttribute('data-status');
                const id = draggedCard.getAttribute('data-id');
                const cardsContainer = column.querySelector('.kanban-cards');
                cardsContainer.appendChild(draggedCard); // Visually move it immediately
                
                const updateData = {};
                updateData[statusCol] = newStatus;
                
                // API Call
                const res = await updateRow(currentTab, 'ID', id, updateData);
                if(res.error) {
                    alert("Lỗi cập nhật: " + res.error);
                    loadPage(currentTab, pageTitle.textContent); // revert
                } else {
                    const row = currentData.find(r => r['ID'] === id);
                    if(row) row[statusCol] = newStatus;
                    // Update badges locally
                    document.querySelectorAll('.kanban-column').forEach(col => {
                        const stat = col.getAttribute('data-status');
                        col.querySelector('.badge').textContent = currentData.filter(r => (r[statusCol] || 'Cần làm') === stat).length;
                    });
                }
            }
        });
    });
}

function renderFinance(data, target) {
    if (!data || data.length === 0) {
        contentArea.innerHTML = `<div class="glass-card text-center"><p class="mt-4">Chưa có dữ liệu Tài chính.</p></div>`;
        return;
    }
    let totalThu = 0, totalChi = 0;
    const projectStats = {};

    data.forEach(row => {
        const type = String(row['Loại'] || row['Loại (Thu/Chi)'] || '').trim().toLowerCase();
        const amount = Number(row['Số tiền'] || 0);
        const project = String(row['Dự án'] || 'Khác').trim();

        if (type.includes('thu')) {
            totalThu += amount;
            if (!projectStats[project]) projectStats[project] = { thu: 0, chi: 0 };
            projectStats[project].thu += amount;
        } else if (type.includes('chi')) {
            totalChi += amount;
            if (!projectStats[project]) projectStats[project] = { thu: 0, chi: 0 };
            projectStats[project].chi += amount;
        }
    });
    
    const balance = totalThu - totalChi;
    const formatCurrency = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

    let html = `
        <h3 style="margin-bottom: 1rem;">Tổng quan Tài chính</h3>
        <div class="stats-grid">
            <div class="glass-card stat-card"><div class="stat-title">Tổng Thu</div><div class="stat-value success">${formatCurrency(totalThu)}</div></div>
            <div class="glass-card stat-card"><div class="stat-title">Tổng Chi</div><div class="stat-value danger">${formatCurrency(totalChi)}</div></div>
            <div class="glass-card stat-card"><div class="stat-title">Số dư</div><div class="stat-value ${balance >= 0 ? 'success' : 'danger'}">${formatCurrency(balance)}</div></div>
        </div>
    `;

    if (Object.keys(projectStats).length > 0) {
        html += `<h3 style="margin-bottom: 1rem; margin-top: 2rem;">Lợi nhuận theo Dự án</h3><div class="notes-grid" style="margin-bottom: 2rem;">`;
        for (const [proj, stats] of Object.entries(projectStats)) {
            const projBalance = stats.thu - stats.chi;
            html += `
                <div class="note-card" style="border-top: 4px solid ${projBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    <h4 style="margin-bottom: 0.5rem;">${proj}</h4>
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted)">
                        <span>Thu:</span> <span class="success">${formatCurrency(stats.thu)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted)">
                        <span>Chi:</span> <span class="danger">${formatCurrency(stats.chi)}</span>
                    </div>
                    <hr style="border: 0; border-top: 1px solid var(--glass-border); margin: 0.5rem 0;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold">
                        <span>Lãi/Lỗ:</span> <span class="${projBalance >= 0 ? 'success' : 'danger'}">${formatCurrency(projBalance)}</span>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    contentArea.innerHTML = html;
    
    const tableContainer = document.createElement('div');
    contentArea.appendChild(tableContainer);
    const tempArea = contentArea;
    contentArea = tableContainer;
    renderTable(data, target, true);
    contentArea = tempArea;
}

function renderNotes(data, target) {
    if (!data || data.length === 0) {
        contentArea.innerHTML = `<div class="glass-card text-center"><p class="mt-4">Chưa có ghi chú nào.</p></div>`;
        return;
    }
    
    const headers = getHeaders(data, target);
    const titleField = headers.find(h => h.toLowerCase().includes('tiêu đề')) || headers[1] || headers[0];
    const contentField = headers.find(h => h.toLowerCase().includes('nội dung')) || headers[2] || headers[1];
    const dateField = headers.find(h => h.toLowerCase().includes('ngày')) || headers[0];
    const tagField = headers.find(h => h.toLowerCase().includes('thẻ') || h.toLowerCase().includes('tag'));

    let uniqueTags = new Set();
    if (tagField) {
        data.forEach(row => {
            const tags = String(row[tagField] || '').split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(t => uniqueTags.add(t));
        });
    }

    let html = ``;
    
    if (uniqueTags.size > 0) {
        html += `
            <div style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-primary tag-filter active" data-tag="all" style="padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">Tất cả</button>
        `;
        uniqueTags.forEach(tag => {
            html += `<button class="btn tag-filter" data-tag="${tag}" style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">#${tag}</button>`;
        });
        html += `</div>`;
    }

    html += `<div class="notes-grid" id="notes-grid-container">`;

    data.forEach(row => {
        let dateVal = row[dateField] || '';
        if (typeof dateVal === 'string' && dateVal.match(/^\d{4}-\d{2}-\d{2}T/)) dateVal = new Date(dateVal).toLocaleDateString('vi-VN');
        
        let tagsArray = [];
        let tagsHtml = '';
        if (tagField && row[tagField]) {
            tagsArray = String(row[tagField]).split(',').map(t => t.trim()).filter(t => t);
            tagsHtml = `<div style="margin-bottom:0.5rem; color:var(--primary-color); font-size:0.8rem; font-weight:600; display:flex; gap:0.5rem;">`;
            tagsArray.forEach(t => tagsHtml += `<span>#${t}</span>`);
            tagsHtml += `</div>`;
        }
        
        let formattedContent = (row[contentField] || '').replace(/\n/g, '<br/>');

        html += `
            <div class="note-card note-item" data-tags="${tagsArray.join(',')}">
                <div class="note-date"><ion-icon name="calendar-outline"></ion-icon> ${dateVal}</div>
                ${tagsHtml}
                <h3 style="margin-bottom: 0.5rem; color: #fff;">${row[titleField] || 'Không tiêu đề'}</h3>
                <div class="note-content" style="color: var(--text-muted); font-size: 0.95rem;">${formattedContent}</div>
            </div>`;
    });
    html += `</div>`;
    contentArea.innerHTML = html;

    const filterBtns = document.querySelectorAll('.tag-filter');
    const noteItems = document.querySelectorAll('.note-item');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.style.background = 'rgba(255,255,255,0.1)';
            });
            btn.classList.add('btn-primary', 'active');
            btn.style.background = 'var(--primary-color)';
            
            const targetTag = btn.getAttribute('data-tag');
            noteItems.forEach(item => {
                if (targetTag === 'all') {
                    item.style.display = 'block';
                } else {
                    const itemTags = item.getAttribute('data-tags').split(',');
                    if (itemTags.includes(targetTag)) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });
    });
}

async function renderDashboard() {
    contentArea.innerHTML = `<div class="loading-container"><span class="loader"></span><p class="mt-4">Đang phân tích dữ liệu hệ thống...</p></div>`;
    
    const projectSheets = projectsConfig.filter(p => !['TaiChinh', 'GhiChu', 'Inbox'].includes(p.id));
    const fetchPromises = [getData('Inbox')];
    projectSheets.forEach(p => fetchPromises.push(getData(p.id)));
    
    const results = await Promise.all(fetchPromises);
    const inboxData = results[0];
    const projectsData = results.slice(1);
    
    let html = `
        <div class="glass-card" style="margin-bottom: 2rem; background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%);">
            <h2 style="margin-bottom: 0.5rem;">Bảng điều khiển Trung tâm</h2>
            <p style="color: var(--text-muted);">Sử dụng nút Quick Capture (Góc dưới bên phải) để ghi chú yêu cầu mới bất kỳ lúc nào.</p>
        </div>
    `;

    html += `
        <div class="glass-card">
            <div class="header" style="margin-bottom: 1rem;">
                <h3><ion-icon name="analytics-outline"></ion-icon> Tiến độ Dự án / Công việc</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    `;
    
    projectsData.forEach((data, index) => {
        const projConfig = projectSheets[index];
        if (!data || data.length === 0) return;
        
        const headers = getHeaders(data, projConfig.id);
        const statusCol = headers.find(h => h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status');
        
        if (!statusCol) return;
        
        let total = data.length;
        let done = data.filter(r => (r[statusCol] || '').toLowerCase().includes('hoàn thành')).length;
        let inProgress = data.filter(r => (r[statusCol] || '').toLowerCase().includes('đang')).length;
        
        let percent = total > 0 ? Math.round((done / total) * 100) : 0;
        
        html += `
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; font-weight: 500;">
                    <span>${projConfig.name}</span>
                    <span>${percent}%</span>
                </div>
                <div style="width: 100%; background: var(--glass-border); border-radius: 8px; height: 12px; overflow: hidden; display: flex;">
                    <div style="width: ${percent}%; background: var(--success-color); height: 100%;"></div>
                    <div style="width: ${total > 0 ? Math.round((inProgress/total)*100) : 0}%; background: var(--primary-color); height: 100%; opacity: 0.8;"></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Tổng: ${total} | Đang xử lý: ${inProgress} | Hoàn thành: ${done}
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    
    html += `
        <div class="glass-card">
            <div class="header" style="margin-bottom: 1rem;">
                <h3><ion-icon name="mail-unread-outline"></ion-icon> Hộp thư đến (Inbox)</h3>
            </div>
    `;
    
    if(!inboxData || inboxData.length === 0) {
        html += `<p style="color:var(--text-muted)">Chưa có ghi chú nhanh nào cần xử lý.</p>`;
    } else {
        html += `<div class="notes-grid">`;
        inboxData.forEach(item => {
            let d = item['Ngày'] || item['Date'] || '';
            if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}T/)) d = new Date(d).toLocaleDateString('vi-VN');
            html += `
                <div class="note-card" style="border-left: 4px solid var(--warning-color)">
                    <div class="note-date">${d}</div>
                    <div class="note-content">${item['Nội dung'] || item['Content'] || ''}</div>
                </div>
            `;
        });
        html += `</div>`;
    }
    html += `</div>`;
    
    contentArea.innerHTML = html;
}

// --- Quick Capture Logic ---
btnQuickCapture.addEventListener('click', () => {
    qcContent.value = '';
    qcModal.classList.add('active');
    qcContent.focus();
});
btnCloseQc.addEventListener('click', () => qcModal.classList.remove('active'));

qcForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = qcContent.value.trim();
    if(!content) return;
    
    btnSubmitQc.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;margin:0"></span> Đang gửi...';
    btnSubmitQc.disabled = true;
    
    const dataObj = {
        'Ngày': new Date().toISOString(),
        'Nội dung': content,
        'Trạng thái': 'Mới'
    };
    
    const res = await addData('Inbox', dataObj);
    
    btnSubmitQc.innerHTML = '<ion-icon name="send-outline"></ion-icon> Gửi vào Inbox';
    btnSubmitQc.disabled = false;
    
    if (res.error) alert("Lỗi: " + res.error);
    else {
        qcModal.classList.remove('active');
        if (currentTab === 'dashboard') loadPage('dashboard', 'Tổng quan');
    }
});


// --- Admin Panel ---
window.updatePassword = async function() {
    const newPass = document.getElementById('admin-new-pass').value;
    if(!newPass) return alert("Vui lòng nhập mật khẩu mới");
    const btn = document.getElementById('btn-save-pass');
    btn.innerText = 'Đang lưu...';
    appSettings.Password = newPass;
    const res = await updateSettings(appSettings);
    if(res.success) { alert("Đổi mật khẩu thành công!"); document.getElementById('admin-new-pass').value = ''; }
    else alert("Lỗi: " + res.error);
    btn.innerText = 'Lưu mật khẩu';
};

window.updateAdminEmail = async function() {
    const newEmail = document.getElementById('admin-email-input').value;
    const btn = document.getElementById('btn-save-email');
    btn.innerText = 'Đang lưu...';
    appSettings.OwnerEmail = newEmail;
    const res = await updateSettings(appSettings);
    if(res.success) { alert("Lưu thông tin thành công!"); }
    else alert("Lỗi: " + res.error);
    btn.innerHTML = '<ion-icon name="save-outline"></ion-icon> Lưu';
};

window.addProject = function() {
    const id = prompt("Nhập ID (Tên sheet trên Google, không dấu, viết liền):", "DuAnMoi");
    if(!id) return;
    const name = prompt("Nhập tên hiển thị trên menu:", "Dự án Mới");
    if(!name) return;
    projectsConfig.push({ id, name, icon: 'folder-outline' });
    renderAdminProjects();
};

window.deleteProject = function(index) {
    if(confirm("Bạn có chắc muốn ẩn dự án này khỏi menu?")) {
        projectsConfig.splice(index, 1);
        renderAdminProjects();
    }
};

window.moveProjectUp = function(index) {
    if (index === 0) return;
    const temp = projectsConfig[index - 1];
    projectsConfig[index - 1] = projectsConfig[index];
    projectsConfig[index] = temp;
    renderAdminProjects();
};

window.moveProjectDown = function(index) {
    if (index === projectsConfig.length - 1) return;
    const temp = projectsConfig[index + 1];
    projectsConfig[index + 1] = projectsConfig[index];
    projectsConfig[index] = temp;
    renderAdminProjects();
};

window.duplicateProject = async function(index, btn) {
    let oldText = "Copy";
    if (btn) {
        oldText = btn.innerHTML;
        btn.innerHTML = '<span class="loader" style="width:12px;height:12px;border-width:2px;margin:0"></span>';
        btn.disabled = true;
    }

    const proj = projectsConfig[index];
    const newId = proj.id + '_Copy';
    
    // Determine actual headers
    let actualColumns = proj.columns;
    if (!actualColumns) {
        // Try to fetch data from original sheet to get headers
        const data = await getData(proj.id);
        const headers = getHeaders(data, proj.id);
        // Exclude ID to save in config
        const displayHeaders = headers.filter(h => h.toUpperCase() !== 'ID');
        actualColumns = displayHeaders.join(', ');
    }
    
    // Copy the config in UI
    projectsConfig.push({
        id: newId,
        name: proj.name + ' (Copy)',
        icon: proj.icon,
        columns: actualColumns
    });
    
    // Auto-create on Google Sheets
    const colsArr = (actualColumns || '').split(',').map(c => c.trim()).filter(c => c);
    
    const res = await createSheet(newId, colsArr);
    
    renderAdminProjects();
    
    if(res.error && res.error !== "Trang tính đã tồn tại") {
        alert("Cấu hình giao diện đã sao chép. Tuy nhiên hệ thống không thể tự tạo Sheet trên Google: " + res.error + ". Bạn cần tự tạo 1 tab mới trên file Sheets.");
    } else {
        alert(`Đã nhân bản cấu hình và tự động tạo tab "${newId}" trên Google Sheets thành công!`);
    }
    
    if (btn) {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.saveProjects = async function() {
    const btn = document.getElementById('btn-save-projects');
    btn.innerText = 'Đang lưu...';
    appSettings.Projects = JSON.stringify(projectsConfig);
    const res = await updateSettings(appSettings);
    if(res.success) { alert("Cập nhật thành công!"); renderSidebar(); }
    else alert("Lỗi: " + res.error);
    btn.innerText = 'Lưu danh sách';
};

window.updateProjectConfig = function(index, field, value) {
    projectsConfig[index][field] = value;
};

function renderAdminProjects() {
    const tbody = document.getElementById('admin-projects-tbody');
    if(!tbody) return;
    let html = '';
    projectsConfig.forEach((proj, index) => {
        const cols = proj.columns || '';
        html += `<tr>
            <td><input type="text" class="form-control" style="padding: 0.25rem 0.5rem; width: 120px;" value="${proj.id}" onchange="updateProjectConfig(${index}, 'id', this.value)"></td>
            <td><input type="text" class="form-control" style="padding: 0.25rem 0.5rem" value="${proj.name}" onchange="updateProjectConfig(${index}, 'name', this.value)"></td>
            <td><input type="text" class="form-control" style="padding: 0.25rem 0.5rem" value="${cols}" placeholder="VD: Ngày, Tên CV, Trạng thái, Ghi chú" onchange="updateProjectConfig(${index}, 'columns', this.value)"></td>
            <td style="white-space: nowrap;">
                <button class="btn" style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; margin-right: 4px; ${index === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" onclick="moveProjectUp(${index})" title="Di chuyển lên trên" ${index === 0 ? 'disabled' : ''}><ion-icon name="arrow-up-outline"></ion-icon></button>
                <button class="btn" style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; margin-right: 4px; ${index === projectsConfig.length - 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" onclick="moveProjectDown(${index})" title="Di chuyển xuống dưới" ${index === projectsConfig.length - 1 ? 'disabled' : ''}><ion-icon name="arrow-down-outline"></ion-icon></button>
                <button class="btn" style="background: var(--warning-color); color: white; padding: 0.25rem 0.5rem; margin-right: 4px;" onclick="duplicateProject(${index}, this)" title="Nhân bản cấu hình (Copy)">Copy</button>
                <button class="btn btn-primary" style="background: var(--danger-color); padding: 0.25rem 0.5rem" onclick="deleteProject(${index})">Xóa</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function renderAdmin() {
    contentArea.innerHTML = `
        <div class="glass-card" style="margin-bottom: 2rem;">
            <h3>Thông tin Hệ thống</h3>
            <div class="mt-4" style="color: var(--text-muted); font-size: 1rem;">
                Tài khoản Google đang lưu trữ dữ liệu (Sheets):
                <div class="form-group" style="display: flex; gap: 1rem; align-items: center; max-width: 400px; margin-top: 0.5rem;">
                    <ion-icon name="mail-outline" style="font-size: 1.5rem; color: var(--primary-color);"></ion-icon>
                    <input type="email" id="admin-email-input" class="form-control" style="flex: 1; padding: 0.5rem;" value="${appSettings.OwnerEmail || ''}" placeholder="Nhập địa chỉ Gmail...">
                    <button class="btn btn-primary" id="btn-save-email" style="padding: 0.5rem 1rem;" onclick="updateAdminEmail()"><ion-icon name="save-outline"></ion-icon> Lưu</button>
                </div>
            </div>
        </div>
        <div class="glass-card" style="margin-bottom: 2rem;">
            <h3>Đổi mật khẩu</h3>
            <div class="form-group mt-4" style="max-width: 300px;"><label>Mật khẩu mới</label><input type="password" id="admin-new-pass" class="form-control"></div>
            <button class="btn btn-primary" id="btn-save-pass" onclick="updatePassword()">Lưu mật khẩu</button>
        </div>
        <div class="glass-card">
            <div class="header" style="margin-bottom: 1rem;">
                <h3>Quản lý Menu Dự án</h3>
                <button class="btn btn-primary" onclick="addProject()">+ Thêm dự án</button>
            </div>
            <div class="table-container">
                <table><thead><tr><th>ID (Tên Sheet)</th><th>Tên hiển thị</th><th>Các cột (cách nhau bởi dấu phẩy)</th><th>Thao tác</th></tr></thead>
                <tbody id="admin-projects-tbody"></tbody></table>
            </div>
            <div class="mt-4"><button class="btn btn-primary" id="btn-save-projects" onclick="saveProjects()">Lưu danh sách</button></div>
        </div>
    `;
    renderAdminProjects();
}

// --- CRM History Timeline ---
function initHistoryPanel() {
    if (document.getElementById('history-panel')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'history-overlay';
    overlay.id = 'history-overlay';
    overlay.onclick = closeHistory;
    
    const panel = document.createElement('div');
    panel.className = 'history-panel';
    panel.id = 'history-panel';
    
    panel.innerHTML = `
        <div class="history-header">
            <h2 id="history-title">Lịch sử tương tác</h2>
            <button class="close-btn" onclick="closeHistory()"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="history-body" id="history-timeline">
            <div style="text-align:center; margin-top:20px; color:var(--text-muted);">Đang tải dữ liệu...</div>
        </div>
        <div class="history-footer">
            <textarea id="history-new-content" class="form-control" rows="3" placeholder="Nhập nội dung tương tác mới (nhấn Lưu để cập nhật)..."></textarea>
            <div style="display: flex; gap: 10px; margin-top: 1rem;">
                <button class="btn btn-primary" style="flex: 1; justify-content: center;" onclick="saveHistory()" id="btn-save-history">
                    <ion-icon name="send-outline"></ion-icon> <span id="btn-save-history-text">Lưu cập nhật</span>
                </button>
                <button class="btn hidden" style="background: var(--glass-bg); color: var(--text-color);" onclick="cancelEditHistory()" id="btn-cancel-edit-history">
                    Hủy
                </button>
            </div>
            <input type="hidden" id="history-current-id">
            <input type="hidden" id="history-edit-id">
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
}

window.openHistory = async function(id, title) {
    initHistoryPanel();
    document.getElementById('history-title').innerText = title;
    document.getElementById('history-current-id').value = id;
    document.getElementById('history-new-content').value = '';
    
    document.getElementById('history-overlay').classList.add('active');
    document.getElementById('history-panel').classList.add('active');
    
    document.getElementById('history-timeline').innerHTML = `<div class="loader" style="width:24px;height:24px;border-width:3px;display:block;margin:2rem auto"></div>`;
    
    try {
        const historyData = await getData('LichSu');
        window.globalHistoryData = historyData; // Update cache
        renderHistoryTimeline(historyData, id);
    } catch (e) {
        document.getElementById('history-timeline').innerHTML = `<div style="text-align:center; color:var(--warning-color); padding: 1rem;">Lỗi kết nối hoặc bạn chưa tạo tab 'LichSu' trên Google Sheets. Hãy vào file Google Sheets và tạo một tab mới tên là <b>LichSu</b> để sử dụng tính năng này.</div>`;
    }
};

window.closeHistory = function() {
    const overlay = document.getElementById('history-overlay');
    const panel = document.getElementById('history-panel');
    if(overlay) overlay.classList.remove('active');
    if(panel) panel.classList.remove('active');
};

function renderHistoryTimeline(historyData, parentId) {
    const timelineDiv = document.getElementById('history-timeline');
    
    // Lọc theo ParentID
    const records = historyData.filter(r => String(r['ParentID']) === String(parentId));
    
    // Sắp xếp giảm dần theo ngày (mới nhất lên trên)
    records.sort((a, b) => {
        const dateA = new Date(a['Ngày giờ'] || 0);
        const dateB = new Date(b['Ngày giờ'] || 0);
        return dateB - dateA;
    });
    
    if (records.length === 0) {
        timelineDiv.innerHTML = `<div style="text-align:center; margin-top:2rem; color:var(--text-muted);">Chưa có lịch sử nào được ghi nhận.</div>`;
        return;
    }
    
    let html = `<div class="timeline">`;
    records.forEach(r => {
        let dateStr = r['Ngày giờ'] || '';
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
            const d = new Date(dateStr);
            dateStr = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        } else if (dateStr instanceof Date) {
            dateStr = dateStr.toLocaleDateString('vi-VN') + ' ' + dateStr.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        }
        
        let contentVal = r['Nội dung'] || '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(contentVal)) {
            contentVal = contentVal.replace(urlRegex, function(url) {
                return `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${url}</a>`;
            });
        }

        html += `
            <div class="timeline-item" id="history-item-${r.ID}">
                <div class="timeline-marker"></div>
                <div class="timeline-date" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${dateStr}</span>
                    <div>
                        <button onclick="editHistory('${r.ID}', '${String(r['Nội dung'] || '').replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" style="background:none; border:none; color:var(--warning-color); cursor:pointer; margin-right:5px; font-size: 1rem;" title="Sửa"><ion-icon name="create-outline"></ion-icon></button>
                        <button onclick="deleteHistory('${r.ID}')" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size: 1rem;" title="Xóa"><ion-icon name="trash-outline"></ion-icon></button>
                    </div>
                </div>
                <div class="timeline-content">${contentVal}</div>
            </div>
        `;
    });
    html += `</div>`;
    timelineDiv.innerHTML = html;
}

window.saveHistory = async function() {
    const parentId = document.getElementById('history-current-id').value;
    const editId = document.getElementById('history-edit-id').value;
    const content = document.getElementById('history-new-content').value.trim();
    if (!content) return alert('Vui lòng nhập nội dung!');
    
    const btn = document.getElementById('btn-save-history');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;margin:0"></span>';
    
    let res;
    if (editId) {
        // Mode: Cập nhật
        res = await updateRow('LichSu', 'ID', editId, { 'Nội dung': content });
    } else {
        // Mode: Thêm mới
        const now = new Date().toLocaleString('vi-VN');
        const dataObj = {
            'ID': '', 
            'ParentID': parentId,
            'Ngày giờ': now,
            'Nội dung': content
        };
        res = await addData('LichSu', dataObj);
    }
    
    if (res.error) {
        alert("Lỗi: " + res.error);
        btn.disabled = false;
        btn.innerHTML = '<ion-icon name="send-outline"></ion-icon> <span id="btn-save-history-text">Lưu cập nhật</span>';
    } else {
        document.getElementById('history-new-content').value = '';
        btn.disabled = false;
        btn.innerHTML = '<ion-icon name="send-outline"></ion-icon> <span id="btn-save-history-text">Lưu cập nhật</span>';
        cancelEditHistory(); // Reset về mode Thêm mới
        const historyData = await getData('LichSu');
        window.globalHistoryData = historyData; // Update cache
        renderHistoryTimeline(historyData, parentId);
        renderTable(currentData, currentTab, true); // Re-render table to update badge
    }
};

window.editHistory = function(historyId, content) {
    document.getElementById('history-edit-id').value = historyId;
    document.getElementById('history-new-content').value = content;
    document.getElementById('btn-save-history-text').innerText = 'Cập nhật lại';
    document.getElementById('btn-cancel-edit-history').classList.remove('hidden');
    document.getElementById('history-new-content').focus();
};

window.cancelEditHistory = function() {
    document.getElementById('history-edit-id').value = '';
    document.getElementById('history-new-content').value = '';
    document.getElementById('btn-save-history-text').innerText = 'Lưu cập nhật';
    document.getElementById('btn-cancel-edit-history').classList.add('hidden');
};

window.deleteHistory = async function(historyId) {
    if(!confirm("Bạn có chắc chắn muốn xóa lịch sử này?")) return;
    
    const btnContainer = event.currentTarget.parentNode;
    btnContainer.innerHTML = '<span class="loader" style="width:14px;height:14px;border-width:2px;margin:0"></span>';
    
    const res = await deleteData('LichSu', 'ID', historyId);
    if(res.error) {
        alert("Lỗi: " + res.error);
        // Trạng thái nút không cần phục hồi vì alert sẽ chặn, nếu muốn phục hồi thì cần giữ lại HTML cũ
    } else {
        const parentId = document.getElementById('history-current-id').value;
        const historyData = await getData('LichSu');
        window.globalHistoryData = historyData; // Update cache
        renderHistoryTimeline(historyData, parentId);
        renderTable(currentData, currentTab, true); // Re-render table to update badge
    }
};

// --- Copy Row ---
window.copyRowData = function(id) {
    const rowData = currentData.find(r => String(r['ID']) === String(id));
    if (!rowData) return;
    showInlineAddRow(rowData);
};

// --- Excel-like Filter Table ---
let activeFilters = {}; // Format: { "Khách hàng": ["A", "B"] }
let currentFilterColumn = "";

window.toggleExcelFilter = function(e, col) {
    e.stopPropagation();
    currentFilterColumn = col;
    
    // Tạo dropdown container nếu chưa có
    let dropdown = document.getElementById('excel-filter-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'excel-filter-dropdown';
        dropdown.className = 'glass-card';
        dropdown.style.cssText = 'position: absolute; z-index: 1000; width: 250px; padding: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; display: none;';
        dropdown.innerHTML = `
            <input type="text" id="excel-filter-search" class="form-control" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; margin-bottom: 8px;" placeholder="Tìm kiếm..." oninput="searchExcelFilterList()">
            <div style="display: flex; gap: 10px; margin-bottom: 8px; font-size: 0.85rem;">
                <a href="javascript:void(0)" onclick="selectAllExcelFilter()" style="color: var(--primary-color);">Chọn tất cả</a>
                <a href="javascript:void(0)" onclick="clearAllExcelFilter()" style="color: var(--danger-color);">Xóa</a>
            </div>
            <div id="excel-filter-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 8px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 5px;"></div>
            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                <button class="btn" onclick="closeExcelFilter()" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: rgba(255,255,255,0.1);">Hủy</button>
                <button class="btn btn-primary" onclick="applyExcelFilter()" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Lọc</button>
            </div>
        `;
        document.body.appendChild(dropdown);
        
        // Đóng dropdown khi click ra ngoài
        document.addEventListener('click', function(evt) {
            if (!dropdown.contains(evt.target) && !evt.target.closest('th')) {
                closeExcelFilter();
            }
        });
    }

    // Lấy danh sách giá trị độc nhất
    const uniqueVals = Array.from(new Set(currentData.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''))).sort();
    
    // Render list
    const listDiv = document.getElementById('excel-filter-list');
    let listHtml = '';
    
    const currentActive = activeFilters[col] || [];
    
    uniqueVals.forEach(val => {
        const isChecked = activeFilters[col] === undefined || currentActive.includes(val) ? 'checked' : '';
        listHtml += `
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" class="excel-filter-cb" value="${String(val).replace(/"/g, '&quot;')}" ${isChecked}>
                <span>${val}</span>
            </label>
        `;
    });
    // Thêm mục "(Trống)"
    const hasEmpty = currentData.some(r => r[col] === null || r[col] === undefined || String(r[col]).trim() === '');
    if (hasEmpty) {
        const isChecked = activeFilters[col] === undefined || currentActive.includes('') ? 'checked' : '';
        listHtml += `
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-muted);">
                <input type="checkbox" class="excel-filter-cb" value="" ${isChecked}>
                <span>(Trống)</span>
            </label>
        `;
    }
    
    listDiv.innerHTML = listHtml;
    document.getElementById('excel-filter-search').value = '';
    
    // Position dropdown
    const rect = e.currentTarget.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.display = 'flex';
};

window.searchExcelFilterList = function() {
    const term = document.getElementById('excel-filter-search').value.toLowerCase();
    const labels = document.getElementById('excel-filter-list').querySelectorAll('label');
    labels.forEach(lbl => {
        const span = lbl.querySelector('span');
        if (span && span.innerText.toLowerCase().includes(term)) {
            lbl.style.display = 'flex';
        } else {
            lbl.style.display = 'none';
        }
    });
};

window.selectAllExcelFilter = function() {
    document.querySelectorAll('.excel-filter-cb').forEach(cb => {
        if (cb.parentElement.style.display !== 'none') cb.checked = true;
    });
};

window.clearAllExcelFilter = function() {
    document.querySelectorAll('.excel-filter-cb').forEach(cb => {
        if (cb.parentElement.style.display !== 'none') cb.checked = false;
    });
};

window.closeExcelFilter = function() {
    const dropdown = document.getElementById('excel-filter-dropdown');
    if (dropdown) dropdown.style.display = 'none';
};

window.applyExcelFilter = function() {
    const checkboxes = Array.from(document.querySelectorAll('.excel-filter-cb'));
    const allChecked = checkboxes.every(cb => cb.checked);
    
    if (allChecked) {
        delete activeFilters[currentFilterColumn];
        document.getElementById(`icon-filter-${currentFilterColumn.replace(/\s+/g, '-')}`).style.color = '';
    } else {
        const selected = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
        activeFilters[currentFilterColumn] = selected;
        document.getElementById(`icon-filter-${currentFilterColumn.replace(/\s+/g, '-')}`).style.color = 'var(--primary-color)';
    }
    
    closeExcelFilter();
    executeTableFilter();
};

function executeTableFilter() {
    const rows = document.querySelectorAll('.data-row');
    rows.forEach(tr => {
        const index = tr.getAttribute('data-index');
        const rowData = currentData[index];
        let match = true;
        
        for (const col in activeFilters) {
            const cellVal = String(rowData[col] || '');
            if (!activeFilters[col].includes(cellVal)) {
                match = false;
                break;
            }
        }
        tr.style.display = match ? '' : 'none';
    });
}

// --- Custom Autocomplete ---
function autocomplete(inp, arr) {
    let currentFocus;
    inp.addEventListener("input", function(e) {
        let a, b, i, val = this.value;
        closeAllLists();
        if (!val) { return false;}
        currentFocus = -1;
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(a);
        let matchCount = 0;
        for (i = 0; i < arr.length; i++) {
            if (String(arr[i]).toLowerCase().includes(val.toLowerCase())) {
                matchCount++;
                b = document.createElement("DIV");
                b.setAttribute("class", "autocomplete-item");
                // Highlight matching text (simple bolding)
                const regex = new RegExp(`(${val})`, "gi");
                b.innerHTML = String(arr[i]).replace(regex, "<strong>$1</strong>");
                b.innerHTML += "<input type='hidden' value='" + String(arr[i]).replace(/'/g, "&apos;") + "'>";
                b.addEventListener("click", function(e) {
                    inp.value = this.getElementsByTagName("input")[0].value;
                    closeAllLists();
                });
                a.appendChild(b);
            }
        }
        if (matchCount === 0) closeAllLists();
    });
    inp.addEventListener("keydown", function(e) {
        let x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) { // Down
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) { // Up
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) { // Enter
            e.preventDefault();
            if (currentFocus > -1) {
                if (x) x[currentFocus].click();
            }
        }
    });
    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
    }
    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }
    function closeAllLists(elmnt) {
        let x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

// --- Inline Add Row ---
window.showInlineAddRow = function(prefilledData = null) {
    // Check if we are in notes view (which doesn't use table)
    if (!document.querySelector('.table-container')) {
        // Switch to table view if kanban
        if (currentViewMode === 'kanban') {
            currentViewMode = 'table';
            btnToggleView.innerHTML = '<ion-icon name="albums-outline"></ion-icon> Dạng Kanban';
            renderTable(currentData, currentTab, true);
        } else {
            // For views like GhiChu that don't have table at all, force render an empty table at top
            if (!document.querySelector('.table-container')) {
                // Let's fallback to modal if it's GhiChu and really no table
                if(currentTab === 'GhiChu') {
                    openAddModalFallback();
                    return;
                }
                renderTable(currentData, currentTab, true, true);
            }
        }
    }
    
    let tbody = document.querySelector('.table-container tbody');
    if (!tbody) {
        renderTable(currentData, currentTab, true, true);
        tbody = document.querySelector('.table-container tbody');
    }
    
    if (!tbody) return; // fail safe
    
    // Prevent multiple add rows
    if (document.getElementById('inline-add-row')) return;

    const headers = getHeaders(currentData, currentTab);
    const idCol = headers.find(h => h.toLowerCase() === 'id');
    const displayHeaders = headers.filter(h => h !== idCol);
    
    const tr = document.createElement('tr');
    tr.id = 'inline-add-row';
    tr.style.background = 'rgba(255,255,255,0.05)';
    
    let html = '';
    displayHeaders.forEach(h => {
        const type = h.toLowerCase().includes('ngày') ? 'date' : h.toLowerCase().includes('tiền') ? 'number' : 'text';
        
        // Extract unique suggestions for this column
        let suggestions = [];
        if (currentData && currentData.length > 0) {
            const uniqueVals = new Set(currentData.map(r => r[h]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''));
            suggestions = Array.from(uniqueVals);
        }
        
        if (h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status') {
            const defVal = prefilledData ? prefilledData[h] : 'Cần làm';
            html += `<td><select class="form-control inline-add-input" data-col="${h}" style="padding: 0.25rem;">`;
            KANBAN_STATUSES.forEach(s => {
                const selected = (defVal === s) ? 'selected' : '';
                html += `<option value="${s}" ${selected}>${s}</option>`;
            });
            html += `</select></td>`;
        } else if (currentTab === 'TaiChinh' && (h.toLowerCase() === 'loại' || h.toLowerCase().includes('thu/chi'))) {
            const defVal = prefilledData ? prefilledData[h] : 'Thu';
            html += `<td><select class="form-control inline-add-input" data-col="${h}" style="padding: 0.25rem;">
                        <option value="Thu" ${defVal === 'Thu' ? 'selected' : ''}>Thu</option>
                        <option value="Chi" ${defVal === 'Chi' ? 'selected' : ''}>Chi</option>
                     </select></td>`;
        } else if (h.toLowerCase().includes('nội dung') || h.toLowerCase().includes('ghi chú')) {
            const defVal = prefilledData ? prefilledData[h] : '';
            html += `<td><textarea class="form-control inline-add-input" data-col="${h}" style="padding: 0.25rem; min-height:30px; font-size: 0.85rem;" rows="1">${defVal || ''}</textarea></td>`;
        } else {
            let defVal = '';
            if (type === 'date') defVal = prefilledData ? prefilledData[h] : new Date().toISOString().split('T')[0];
            else if (prefilledData) defVal = prefilledData[h] || '';
            
            // Dùng div bọc lại cho Custom Autocomplete
            html += `<td>
                        <div class="autocomplete-wrapper">
                            <input type="${type}" id="inline-inp-${h.replace(/\s+/g, '-')}" class="form-control inline-add-input" data-col="${h}" style="padding: 0.25rem; font-size: 0.85rem;" value="${defVal}" autocomplete="off">
                        </div>
                     </td>`;
        }
    });
    
    if (idCol) {
        html += `<td style="text-align: center; white-space: nowrap;">
                    <button class="btn btn-primary" onclick="submitInlineAdd()" style="padding: 0.35rem 0.6rem; font-size: 1.1rem; border-radius: 6px; margin-right:4px;" title="Lưu">
                        <ion-icon name="checkmark-outline"></ion-icon>
                    </button>
                    <button class="btn" onclick="cancelInlineAdd()" style="background: var(--danger-color); color: white; padding: 0.35rem 0.6rem; font-size: 1.1rem; border-radius: 6px;" title="Hủy">
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                 </td>`;
    }
    
    tr.innerHTML = html;
    tbody.insertBefore(tr, tbody.firstChild);

    // Khởi tạo Custom Autocomplete sau khi input đã được chèn vào DOM
    displayHeaders.forEach(h => {
        const type = h.toLowerCase().includes('ngày') ? 'date' : h.toLowerCase().includes('tiền') ? 'number' : 'text';
        if (type === 'text' && !(h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status') && !(currentTab === 'TaiChinh' && (h.toLowerCase() === 'loại' || h.toLowerCase().includes('thu/chi'))) && !(h.toLowerCase().includes('nội dung') || h.toLowerCase().includes('ghi chú'))) {
            const inp = document.getElementById(`inline-inp-${h.replace(/\s+/g, '-')}`);
            if (inp) {
                let suggestions = [];
                if (currentData && currentData.length > 0) {
                    const uniqueVals = new Set(currentData.map(r => r[h]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''));
                    suggestions = Array.from(uniqueVals);
                }
                if (suggestions.length > 0) {
                    autocomplete(inp, suggestions);
                }
            }
        }
    });

    // Focus vào ô input text đầu tiên
    const firstInput = tr.querySelector('input[type="text"]');
    if (firstInput) firstInput.focus();
};

window.cancelInlineAdd = function() {
    const tr = document.getElementById('inline-add-row');
    if (tr) tr.remove();
    if (!currentData || currentData.length === 0) {
        renderTable([], currentTab, true);
    }
};

window.submitInlineAdd = async function() {
    const tr = document.getElementById('inline-add-row');
    if (!tr) return;
    
    const inputs = tr.querySelectorAll('.inline-add-input');
    const dataObj = {};
    inputs.forEach(input => {
        dataObj[input.getAttribute('data-col')] = input.value;
    });
    
    const btns = tr.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);
    
    const res = await addData(currentTab, dataObj);
    if (res.error) {
        alert("Lỗi: " + res.error);
        btns.forEach(b => b.disabled = false);
    } else {
        loadPage(currentTab, pageTitle.textContent);
    }
};

// --- Add Modal Fallback ---
function openAddModalFallback() {
    const headers = getHeaders(currentData, currentTab);
    let html = '';
    headers.forEach(h => {
        if(h.toLowerCase() === 'id') return;
        const type = h.toLowerCase().includes('ngày') ? 'date' : h.toLowerCase().includes('tiền') ? 'number' : 'text';
        
        let suggestions = [];
        if (currentData && currentData.length > 0) {
            const uniqueVals = new Set(currentData.map(r => r[h]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''));
            suggestions = Array.from(uniqueVals);
        }

        if (h.toLowerCase() === 'trạng thái' || h.toLowerCase() === 'status') {
            html += `<div class="form-group"><label>${h}</label><select name="${h}" class="form-control" required>`;
            KANBAN_STATUSES.forEach(s => html += `<option value="${s}">${s}</option>`);
            html += `</select></div>`;
            return;
        }

        if (currentTab === 'TaiChinh' && (h.toLowerCase() === 'loại' || h.toLowerCase().includes('thu/chi'))) {
            html += `<div class="form-group"><label>${h}</label><select name="${h}" class="form-control" required><option value="Thu">Thu</option><option value="Chi">Chi</option></select></div>`;
            return;
        }
        if (h.toLowerCase().includes('nội dung') || h.toLowerCase().includes('ghi chú')) {
            html += `<div class="form-group"><label>${h}</label><textarea name="${h}" class="form-control" rows="3"></textarea></div>`;
            return;
        }
        
        let datalistHtml = '';
        let listAttr = '';
        if (type === 'text' && suggestions.length > 0) {
            const listId = `modal-datalist-${h.replace(/\s+/g, '-')}`;
            listAttr = `list="${listId}"`;
            datalistHtml = `<datalist id="${listId}">`;
            suggestions.forEach(s => datalistHtml += `<option value="${s.replace(/"/g, '&quot;')}">`);
            datalistHtml += `</datalist>`;
        }
        
        html += `<div class="form-group">
                    <label>${h}</label>
                    <input type="${type}" name="${h}" class="form-control" ${listAttr} autocomplete="off">
                    ${datalistHtml}
                 </div>`;
    });
    formFields.innerHTML = html;
    addModal.classList.add('active');
}

btnAdd.addEventListener('click', () => {
    showInlineAddRow();
});

btnCloseModal.addEventListener('click', () => addModal.classList.remove('active'));

addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addForm);
    const dataObj = {};
    formData.forEach((value, key) => dataObj[key] = value);

    btnSubmit.innerHTML = 'Đang lưu...'; btnSubmit.disabled = true;
    const res = await addData(currentTab, dataObj);
    btnSubmit.innerHTML = 'Lưu dữ liệu'; btnSubmit.disabled = false;

    if (res.error) alert("Lỗi: " + res.error);
    else {
        addModal.classList.remove('active');
        loadPage(currentTab, pageTitle.textContent);
    }
});

// Start
init();
