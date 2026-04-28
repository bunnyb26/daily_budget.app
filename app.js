/* ========================================================
   Journey Budget Tracker — app.js
   ======================================================== */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  EXPENSES: 'jbt_expenses',
  TRIP:     'jbt_trip',
};

const CATEGORY_META = {
  food:          { label: 'Food & Drinks',  icon: '🍔', cssClass: 'cat-food'          },
  transport:     { label: 'Transport',       icon: '🚌', cssClass: 'cat-transport'     },
  accommodation: { label: 'Accommodation',   icon: '🏨', cssClass: 'cat-accommodation' },
  activities:    { label: 'Activities',      icon: '🎭', cssClass: 'cat-activities'    },
  shopping:      { label: 'Shopping',        icon: '🛍️', cssClass: 'cat-shopping'      },
  health:        { label: 'Health',          icon: '💊', cssClass: 'cat-health'        },
  communication: { label: 'Communication',   icon: '📱', cssClass: 'cat-communication' },
  other:         { label: 'Other',           icon: '📦', cssClass: 'cat-other'         },
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
  AUD: 'A$', CHF: 'CHF', INR: '₹', MXN: 'MX$', SGD: 'S$',
};

// ── State ──────────────────────────────────────────────────────────────────

let expenses = [];
let trip     = {
  name:        'My Trip',
  currency:    'USD',
  dailyBudget: null,
  startDate:   null,
  endDate:     null,
};

let pendingDeleteId = null;
let toastTimer      = null;

// ── Persistence ────────────────────────────────────────────────────────────

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    expenses = raw ? JSON.parse(raw) : [];
  } catch { expenses = []; }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIP);
    if (raw) trip = { ...trip, ...JSON.parse(raw) };
  } catch { /* keep defaults */ }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
}

function saveTrip() {
  localStorage.setItem(STORAGE_KEYS.TRIP, JSON.stringify(trip));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function currencySymbol() {
  return CURRENCY_SYMBOLS[trip.currency] || trip.currency;
}

function formatAmount(n) {
  return `${currencySymbol()}${Number(n).toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today     = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (iso === today)     return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Trip Settings ──────────────────────────────────────────────────────────

function openTripModal() {
  document.getElementById('tripName').value      = trip.name        || '';
  document.getElementById('tripCurrency').value  = trip.currency    || 'USD';
  document.getElementById('dailyBudget').value   = trip.dailyBudget != null ? trip.dailyBudget : '';
  document.getElementById('tripStartDate').value = trip.startDate   || '';
  document.getElementById('tripEndDate').value   = trip.endDate     || '';
  document.getElementById('tripModal').classList.add('open');
}

function closeTripModal() {
  document.getElementById('tripModal').classList.remove('open');
}

function saveTripSettings() {
  const name    = document.getElementById('tripName').value.trim();
  const budget  = parseFloat(document.getElementById('dailyBudget').value);

  trip.name        = name        || 'My Trip';
  trip.currency    = document.getElementById('tripCurrency').value;
  trip.dailyBudget = isNaN(budget) || budget <= 0 ? null : budget;
  trip.startDate   = document.getElementById('tripStartDate').value || null;
  trip.endDate     = document.getElementById('tripEndDate').value   || null;

  saveTrip();
  closeTripModal();
  applyTripToUI();
  renderAll();
  showToast('✅ Trip settings saved!');
}

function applyTripToUI() {
  document.getElementById('currencyPrefix').textContent = currencySymbol();

  const sym = currencySymbol();
  document.getElementById('dailyBudgetDisplay').textContent =
    trip.dailyBudget ? `${sym}${Number(trip.dailyBudget).toFixed(2)}` : '—';

  // Header trip name
  const info = document.getElementById('tripInfo');
  info.innerHTML = `
    <span class="trip-name-badge">🗺️ ${escHtml(trip.name)}</span>
    <button class="btn btn-outline" id="tripSettingsBtn">⚙️ Trip Settings</button>
  `;
  document.getElementById('tripSettingsBtn').addEventListener('click', openTripModal);

  // Today's date label
  const d = new Date();
  document.getElementById('todayDateLabel').textContent =
    d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Add Expense ────────────────────────────────────────────────────────────

function handleAddExpense(e) {
  e.preventDefault();

  const amount = parseFloat(document.getElementById('expAmount').value);
  if (isNaN(amount) || amount <= 0) { showToast('⚠️ Please enter a valid amount.'); return; }

  const category = document.getElementById('expCategory').value;
  if (!category) { showToast('⚠️ Please select a category.'); return; }

  const description = document.getElementById('expDescription').value.trim() || 'Expense';
  const date        = document.getElementById('expDate').value;
  if (!date) { showToast('⚠️ Please select a date.'); return; }

  const expense = { id: uid(), amount, category, description, date };
  expenses.unshift(expense);
  saveExpenses();
  renderAll();
  showToast('✅ Expense added!');

  // Reset form (keep date for convenience)
  document.getElementById('expAmount').value      = '';
  document.getElementById('expCategory').value    = '';
  document.getElementById('expDescription').value = '';
  document.getElementById('expAmount').focus();
}

// ── Delete Expense ─────────────────────────────────────────────────────────

function requestDelete(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModal').classList.add('open');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  expenses = expenses.filter(e => e.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveExpenses();
  document.getElementById('deleteModal').classList.remove('open');
  renderAll();
  showToast('🗑️ Expense deleted.');
}

function cancelDelete() {
  pendingDeleteId = null;
  document.getElementById('deleteModal').classList.remove('open');
}

function clearAllExpenses() {
  if (!expenses.length) return;
  expenses = [];
  saveExpenses();
  renderAll();
  showToast('🗑️ All expenses cleared.');
}

// ── Filters & Sort ─────────────────────────────────────────────────────────

function getFilteredExpenses() {
  const search   = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('filterCategory').value;
  const sort     = document.getElementById('filterSort').value;

  let list = expenses.filter(e => {
    const matchSearch   = !search   || e.description.toLowerCase().includes(search) || e.category.toLowerCase().includes(search);
    const matchCategory = !category || e.category === category;
    return matchSearch && matchCategory;
  });

  list.sort((a, b) => {
    if (sort === 'date-desc')    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    if (sort === 'date-asc')     return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (sort === 'amount-desc')  return b.amount - a.amount;
    if (sort === 'amount-asc')   return a.amount - b.amount;
    return 0;
  });

  return list;
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderSummary() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  document.getElementById('totalSpent').textContent = formatAmount(total);

  const days = new Set(expenses.map(e => e.date)).size;
  document.getElementById('daysTracked').textContent = days;
  document.getElementById('avgPerDay').textContent   = days ? formatAmount(total / days) : formatAmount(0);
}

function renderBudgetBar() {
  const today     = todayISO();
  const todayExp  = expenses.filter(e => e.date === today);
  const todaySum  = todayExp.reduce((s, e) => s + e.amount, 0);
  const sym       = currencySymbol();

  document.getElementById('todaySpent').textContent =
    `Spent: ${sym}${todaySum.toFixed(2)}`;

  if (trip.dailyBudget) {
    const pct  = Math.min((todaySum / trip.dailyBudget) * 100, 100);
    const rem  = trip.dailyBudget - todaySum;
    const fill = document.getElementById('budgetBarFill');
    fill.style.width = pct + '%';
    fill.className   = 'budget-bar-fill ' + (pct < 70 ? 'safe' : pct < 90 ? 'warn' : 'over');
    document.getElementById('todayRemaining').textContent =
      rem >= 0
        ? `Remaining: ${sym}${rem.toFixed(2)}`
        : `Over by: ${sym}${Math.abs(rem).toFixed(2)}`;
  } else {
    document.getElementById('budgetBarFill').style.width = '0%';
    document.getElementById('todayRemaining').textContent = 'Remaining: Set budget in settings';
  }
}

function renderCategoryBreakdown() {
  const container = document.getElementById('categoryBreakdown');
  if (!expenses.length) {
    container.innerHTML = '<p class="empty-state">No expenses yet.</p>';
    return;
  }

  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const grand  = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const sym    = currencySymbol();

  container.innerHTML = sorted.map(([cat, amt]) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
    const pct  = grand ? (amt / grand) * 100 : 0;
    return `
      <div class="cat-row">
        <span class="cat-row-icon">${meta.icon}</span>
        <div class="cat-row-info">
          <div class="cat-row-name">
            <span>${escHtml(meta.label)}</span>
            <span>${sym}${amt.toFixed(2)}</span>
          </div>
          <div class="cat-row-bar-wrap">
            <div class="cat-row-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderExpenseList() {
  const container = document.getElementById('expenseList');
  const list      = getFilteredExpenses();
  const sym       = currencySymbol();

  if (!list.length) {
    container.innerHTML = expenses.length
      ? '<p class="empty-state">No expenses match your filters.</p>'
      : '<p class="empty-state">No expenses recorded yet.<br>Add your first expense above!</p>';
    return;
  }

  // Group by date
  const groups = {};
  list.forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  // Sort dates depending on current sort
  const sort = document.getElementById('filterSort').value;
  const dates = Object.keys(groups).sort((a, b) =>
    sort === 'date-asc' ? a.localeCompare(b) : b.localeCompare(a)
  );

  container.innerHTML = dates.map(date => {
    const dayTotal = groups[date].reduce((s, e) => s + e.amount, 0);
    const items    = groups[date].map(e => {
      const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
      return `
        <div class="expense-item" data-id="${e.id}">
          <div class="expense-cat-icon ${meta.cssClass}">${meta.icon}</div>
          <div class="expense-meta">
            <div class="expense-desc">${escHtml(e.description)}</div>
            <div class="expense-cat-label">${escHtml(meta.label)}</div>
          </div>
          <div class="expense-amount">${sym}${Number(e.amount).toFixed(2)}</div>
          <button class="btn-icon delete-btn" data-id="${e.id}" title="Delete">🗑️</button>
        </div>`;
    }).join('');

    return `
      <div class="expense-group">
        <div class="expense-group-date">
          <span>${formatDateLabel(date)}</span>
          <span class="expense-group-total">${sym}${dayTotal.toFixed(2)}</span>
        </div>
        ${items}
      </div>`;
  }).join('');

  // Attach delete listeners
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => requestDelete(btn.dataset.id));
  });
}

function renderAll() {
  renderSummary();
  renderBudgetBar();
  renderCategoryBreakdown();
  renderExpenseList();
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  loadFromStorage();
  applyTripToUI();

  // Default date to today
  document.getElementById('expDate').value = todayISO();

  // Form submit
  document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);

  // Trip modal
  document.getElementById('tripSettingsBtn').addEventListener('click', openTripModal);
  document.getElementById('closeTripModal').addEventListener('click', closeTripModal);
  document.getElementById('cancelTripModal').addEventListener('click', closeTripModal);
  document.getElementById('saveTripSettings').addEventListener('click', saveTripSettings);

  // Close modal on overlay click
  document.getElementById('tripModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTripModal();
  });

  // Delete modal
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
  document.getElementById('cancelDelete').addEventListener('click', cancelDelete);
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) cancelDelete();
  });

  // Clear all
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (expenses.length && confirm('Clear all expenses? This cannot be undone.')) {
      clearAllExpenses();
    }
  });

  // Filters
  document.getElementById('searchInput').addEventListener('input', renderExpenseList);
  document.getElementById('filterCategory').addEventListener('change', renderExpenseList);
  document.getElementById('filterSort').addEventListener('change', renderExpenseList);

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
