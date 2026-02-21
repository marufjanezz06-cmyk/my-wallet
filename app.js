/* ========= Storage ========= */
const LS_KEY = "my_wallet_v1";

const DEFAULT_CATS = ["Еда", "Транспорт", "Дом", "Связь", "Развлечения", "Подарки", "Здоровье", "Другое"];

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const init = {
      cats: DEFAULT_CATS,
      tx: [],
      filterCat: "Все",
      month: monthKey(new Date()),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(init));
    return init;
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj.cats) obj.cats = DEFAULT_CATS;
    if (!obj.tx) obj.tx = [];
    if (!obj.filterCat) obj.filterCat = "Все";
    if (!obj.month) obj.month = monthKey(new Date());
    return obj;
  } catch {
    localStorage.removeItem(LS_KEY);
    return loadState();
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ========= Helpers ========= */
function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function humanMonth(key) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function toMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}
function parseAmount(s) {
  if (!s) return NaN;
  const clean = String(s).replace(",", ".").replace(/[^\d.]/g, "");
  return Number(clean);
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* ========= UI refs ========= */
const el = {
  monthLabel: document.getElementById("monthLabel"),
  balance: document.getElementById("balance"),
  incomeSum: document.getElementById("incomeSum"),
  expenseSum: document.getElementById("expenseSum"),
  txCount: document.getElementById("txCount"),
  hint: document.getElementById("hint"),

  catChips: document.getElementById("catChips"),
  txList: document.getElementById("txList"),
  search: document.getElementById("search"),

  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  pickToday: document.getElementById("pickToday"),

  addBtn: document.getElementById("addBtn"),
  resetDemo: document.getElementById("resetDemo"),

  btnExport: document.getElementById("btnExport"),
  btnImport: document.getElementById("btnImport"),
  fileImport: document.getElementById("fileImport"),

  // Modal Tx
  modalTx: document.getElementById("modalTx"),
  backdropTx: document.getElementById("backdropTx"),
  closeTx: document.getElementById("closeTx"),
  segExpense: document.getElementById("segExpense"),
  segIncome: document.getElementById("segIncome"),
  amount: document.getElementById("amount"),
  category: document.getElementById("category"),
  date: document.getElementById("date"),
  note: document.getElementById("note"),
  saveTx: document.getElementById("saveTx"),

  // Modal Cats
  manageCats: document.getElementById("manageCats"),
  modalCats: document.getElementById("modalCats"),
  backdropCats: document.getElementById("backdropCats"),
  closeCats: document.getElementById("closeCats"),
  newCat: document.getElementById("newCat"),
  addCat: document.getElementById("addCat"),
  catsList: document.getElementById("catsList"),
};

let state = loadState();
let txType = "expense";

/* ========= Render ========= */
function filteredTx() {
  const q = (el.search.value || "").trim().toLowerCase();
  return state.tx
    .filter(t => t.month === state.month)
    .filter(t => state.filterCat === "Все" ? true : t.category === state.filterCat)
    .filter(t => {
      if (!q) return true;
      return (t.note || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q);
    })
    .sort((a,b) => (b.date.localeCompare(a.date)));
}

function calcSums(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

function renderHeader() {
  el.monthLabel.textContent = humanMonth(state.month);
}

function renderChips() {
  const chips = ["Все", ...state.cats];
  el.catChips.innerHTML = "";
  for (const c of chips) {
    const b = document.createElement("button");
    b.className = "catChip" + (state.filterCat === c ? " active" : "");
    b.textContent = c;
    b.onclick = () => {
      state.filterCat = c;
      saveState();
      renderAll();
    };
    el.catChips.appendChild(b);
  }
}

function renderTxList() {
  const list = filteredTx();
  const sums = calcSums(list);

  // Header stats
  el.incomeSum.textContent = toMoney(sums.income);
  el.expenseSum.textContent = toMoney(sums.expense);
  el.txCount.textContent = String(list.length);
  el.balance.textContent = toMoney(sums.balance);

  // Hint (simple advice)
  el.hint.textContent = makeHint(list, sums);

  // List
  el.txList.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.style.padding = "10px 2px";
    empty.textContent = "Пока нет операций за этот месяц.";
    el.txList.appendChild(empty);
    return;
  }

  for (const t of list) {
    const row = document.createElement("div");
    row.className = "tx";

    const left = document.createElement("div");
    left.className = "txLeft";

    const top = document.createElement("div");
    top.className = "txTop";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = t.category;

    const date = document.createElement("span");
    date.className = "muted";
    date.textContent = formatDate(t.date);

    top.appendChild(badge);
    top.appendChild(date);

    const note = document.createElement("div");
    note.className = "txNote";
    note.textContent = t.note ? t.note : (t.type === "income" ? "Доход" : "Расход");

    left.appendChild(top);
    left.appendChild(note);

    const right = document.createElement("div");
    right.className = "txRight";

    const amt = document.createElement("div");
    amt.className = "txAmount " + (t.type === "income" ? "pos" : "neg");
    amt.textContent = (t.type === "income" ? "+" : "−") + toMoney(t.amount);

    const del = document.createElement("button");
    del.className = "delBtn";
    del.textContent = "Удалить";
    del.onclick = () => deleteTx(t.id);

    right.appendChild(amt);
    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);

    el.txList.appendChild(row);
  }
}

function formatDate(iso) {
  // iso YYYY-MM-DD
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString("ru-RU", { day:"2-digit", month:"short" });
}

function makeHint(list, sums) {
  if (list.length === 0) return "Добавь первую операцию — и я начну считать итоги.";
  const total = sums.income + sums.expense;
  if (total === 0) return "Заполни суммы — и будут подсказки.";

  // category share
  const byCat = new Map();
  for (const t of list) {
    if (t.type !== "expense") continue;
    byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  }
  let topCat = null, topVal = 0;
  for (const [k,v] of byCat.entries()) {
    if (v > topVal) { topVal = v; topCat = k; }
  }

  if (sums.balance < 0) {
    return "Баланс минус. Попробуй снизить расходы или добавь доходы, чтобы выйти в плюс.";
  }
  if (topCat && topVal > 0) {
    return `Больше всего расходов в категории “${topCat}”: ${toMoney(topVal)}. Если хочешь экономить — начни отсюда.`;
  }
  return "Ты молодец: баланс в плюсе. Продолжай фиксировать операции — будет точнее.";
}

function renderCategorySelect() {
  el.category.innerHTML = "";
  for (const c of state.cats) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    el.category.appendChild(opt);
  }
}

function renderCatsManager() {
  el.catsList.innerHTML = "";
  for (const c of state.cats) {
    const row = document.createElement("div");
    row.className = "catRow";

    const input = document.createElement("input");
    input.value = c;

    const btn = document.createElement("button");
    btn.className = "miniBtn";
    btn.textContent = "Сохранить";
    btn.onclick = () => {
      const newName = input.value.trim();
      if (!newName) return;
      renameCategory(c, newName);
    };

    row.appendChild(input);
    row.appendChild(btn);
    el.catsList.appendChild(row);
  }
}

function renderAll() {
  renderHeader();
  renderChips();
  renderCategorySelect();
  renderTxList();
}

/* ========= Actions ========= */
function openModal(modal) {
  document.body.classList.add("modalOpen");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");
}

function setType(type) {
  txType = type;
  el.segExpense.classList.toggle("active", type === "expense");
  el.segIncome.classList.toggle("active", type === "income");
}

function addTx() {
  const amount = parseAmount(el.amount.value);
  const cat = el.category.value;
  const date = el.date.value || todayISO();
  const note = (el.note.value || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Введите сумму больше нуля.");
    return;
  }
  const m = date.slice(0,7);
  const tx = { id: uid(), type: txType, amount, category: cat, date, month: m, note };
  state.tx.push(tx);
  saveState();

  el.amount.value = "";
  el.note.value = "";
  closeModal(el.modalTx);
  renderAll();
}

function deleteTx(id) {
  if (!confirm("Удалить операцию?")) return;
  state.tx = state.tx.filter(t => t.id !== id);
  saveState();
  renderAll();
}

function renameCategory(oldName, newName) {
  // prevent duplicates
  const lower = state.cats.map(x => x.toLowerCase());
  if (lower.includes(newName.toLowerCase()) && oldName.toLowerCase() !== newName.toLowerCase()) {
    alert("Такая категория уже есть.");
    return;
  }

  state.cats = state.cats.map(c => c === oldName ? newName : c);

  // update transactions
  state.tx = state.tx.map(t => t.category === oldName ? { ...t, category: newName } : t);

  // update filter
  if (state.filterCat === oldName) state.filterCat = newName;

  saveState();
  renderAll();
  renderCatsManager();
}

function addCategory() {
  const name = (el.newCat.value || "").trim();
  if (!name) return;

  const lower = state.cats.map(x => x.toLowerCase());
  if (lower.includes(name.toLowerCase())) {
    alert("Такая категория уже существует.");
    return;
  }
  state.cats.push(name);
  el.newCat.value = "";
  saveState();
  renderAll();
  renderCatsManager();
}

function shiftMonth(delta) {
  const [y,m] = state.month.split("-").map(Number);
  const dt = new Date(y, m-1 + delta, 1);
  state.month = monthKey(dt);
  saveState();
  renderAll();
}

function setThisMonth() {
  state.month = monthKey(new Date());
  saveState();
  renderAll();
}

function resetAll() {
  if (!confirm("Сбросить ВСЁ? Это удалит операции и категории.")) return;
  localStorage.removeItem(LS_KEY);
  state = loadState();
  renderAll();
}

/* ========= Export / Import ========= */
function exportJSON() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `my-wallet-backup-${state.month}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result || ""));
      if (!obj || typeof obj !== "object") throw new Error("bad");

      // small validation
      if (!Array.isArray(obj.cats) || !Array.isArray(obj.tx)) {
        alert("Файл не похож на бэкап кошелька.");
        return;
      }
      state = {
        cats: obj.cats,
        tx: obj.tx,
        filterCat: "Все",
        month: obj.month || monthKey(new Date()),
      };
      saveState();
      renderAll();
      alert("Импорт готов ✅");
    } catch {
      alert("Не удалось импортировать. Файл поврежден или не тот.");
    }
  };
  reader.readAsText(file);
}

/* ========= PWA ========= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ========= Events ========= */
el.addBtn.onclick = () => {
  setType("expense");
  el.date.value = todayISO();
  openModal(el.modalTx);
  el.amount.focus();
};
el.resetDemo.onclick = resetAll;

el.prevMonth.onclick = () => shiftMonth(-1);
el.nextMonth.onclick = () => shiftMonth(+1);
el.pickToday.onclick = setThisMonth;

el.manageCats.onclick = () => { renderCatsManager(); openModal(el.modalCats); };

el.backdropTx.onclick = () => closeModal(el.modalTx);
el.closeTx.onclick = () => closeModal(el.modalTx);
el.saveTx.onclick = addTx;

el.segExpense.onclick = () => setType("expense");
el.segIncome.onclick = () => setType("income");

el.backdropCats.onclick = () => closeModal(el.modalCats);
el.closeCats.onclick = () => closeModal(el.modalCats);
el.addCat.onclick = addCategory;

el.search.oninput = () => renderTxList();

el.btnExport.onclick = exportJSON;
el.btnImport.onclick = () => el.fileImport.click();
el.fileImport.onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) importJSONFile(f);
  el.fileImport.value = "";
};

/* ========= Init ========= */

renderAll();
