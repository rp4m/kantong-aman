import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import type {
  Transaction,
  Budget,
  Category,
  CategoryBudget,
  PIC,
  BudgetPeriod,
  BudgetItem,
  BudgetPeriodStatus,
} from "./budget-types";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PIC_NAME, MONTH_NAMES } from "./budget-types";
import { toISODate } from "./budget-format";

const TX_KEY = "dbt_transactions";
const BUDGET_KEY = "dbt_budgets";
const CATEGORY_KEY = "dbt_categories";
const CATEGORY_BUDGET_KEY = "dbt_category_budgets";
const PIC_KEY = "dbt_pics";
const PERIOD_KEY = "dbt_budget_periods";
const ITEM_KEY = "dbt_budget_items";
const MIGRATION_KEY = "dbt_migration_v4";
const THEME_KEY = "dbt_theme";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let txCache: Transaction[] | null = null;
let budgetCache: Budget[] | null = null;
let categoryCache: Category[] | null = null;
let categoryBudgetCache: CategoryBudget[] | null = null;
let picCache: PIC[] | null = null;
let periodCache: BudgetPeriod[] | null = null;
let itemCache: BudgetItem[] | null = null;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  if (key === TX_KEY) txCache = value as Transaction[];
  if (key === BUDGET_KEY) budgetCache = value as Budget[];
  if (key === CATEGORY_KEY) categoryCache = value as Category[];
  if (key === CATEGORY_BUDGET_KEY) categoryBudgetCache = value as CategoryBudget[];
  if (key === PIC_KEY) picCache = value as PIC[];
  if (key === PERIOD_KEY) periodCache = value as BudgetPeriod[];
  if (key === ITEM_KEY) itemCache = value as BudgetItem[];
  emit();
}

// ----- Transactions -----
export function getTransactions(): Transaction[] {
  if (txCache === null) txCache = readJSON<Transaction[]>(TX_KEY, []);
  return txCache;
}
export function saveTransactions(items: Transaction[]) {
  writeJSON(TX_KEY, items);
}
export function addTransaction(tx: Omit<Transaction, "id" | "createdAt">) {
  const all = getTransactions();
  const item: Transaction = {
    ...tx,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveTransactions([item, ...all]);
  return item;
}
export function updateTransaction(id: string, patch: Partial<Transaction>) {
  saveTransactions(getTransactions().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}
export function deleteTransaction(id: string) {
  saveTransactions(getTransactions().filter((t) => t.id !== id));
}

// ----- Legacy Budgets (import compat) -----
export function getBudgets(): Budget[] {
  if (budgetCache === null) budgetCache = readJSON<Budget[]>(BUDGET_KEY, []);
  return budgetCache;
}
export function saveBudgets(items: Budget[]) { writeJSON(BUDGET_KEY, items); }

// ----- PIC -----
function seedPICsIfEmpty(list: PIC[]): PIC[] {
  if (list.length > 0) return list;
  const now = new Date().toISOString();
  return [{
    id: crypto.randomUUID(),
    name: DEFAULT_PIC_NAME,
    email: "", phone: "",
    description: "PIC default — silakan tambah atau edit sesuai kebutuhan",
    isActive: true,
    createdAt: now,
  }];
}
export function getPICs(): PIC[] {
  if (picCache === null) {
    const raw = readJSON<PIC[]>(PIC_KEY, []);
    const seeded = seedPICsIfEmpty(raw);
    if (seeded !== raw && typeof window !== "undefined") {
      window.localStorage.setItem(PIC_KEY, JSON.stringify(seeded));
    }
    picCache = seeded;
  }
  return picCache;
}
export function savePICs(items: PIC[]) { writeJSON(PIC_KEY, items); }
export function addPIC(input: { name: string; email?: string; phone?: string; description?: string; isActive?: boolean }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama PIC wajib diisi");
  if (getPICs().some((p) => p.name.toLowerCase() === name.toLowerCase()))
    throw new Error("PIC dengan nama tersebut sudah ada");
  const pic: PIC = {
    id: crypto.randomUUID(), name,
    email: input.email?.trim() ?? "", phone: input.phone?.trim() ?? "",
    description: input.description?.trim() ?? "",
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };
  savePICs([pic, ...getPICs()]);
  return pic;
}
export function updatePIC(id: string, patch: Partial<PIC>) {
  if (patch.name) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nama PIC tidak boleh kosong");
    if (getPICs().some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase()))
      throw new Error("PIC dengan nama tersebut sudah ada");
    patch = { ...patch, name };
  }
  savePICs(getPICs().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
export function deletePIC(id: string) {
  const remaining = getPICs().filter((p) => p.id !== id);
  if (remaining.length === 0) throw new Error("Minimal harus ada 1 PIC");
  const fallbackId = remaining[0].id;
  saveBudgetItems(getBudgetItems().map((it) => it.picId === id ? { ...it, picId: fallbackId } : it));
  savePICs(remaining);
}
export function getPICById(id: string): PIC | undefined {
  return getPICs().find((p) => p.id === id);
}

// ----- Categories -----
function seedCategoriesIfEmpty(list: Category[]): Category[] {
  if (list.length > 0) return list;
  const now = new Date().toISOString();
  return DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(), name, description: "",
    isActive: true, createdAt: now,
  }));
}
export function getCategories(): Category[] {
  if (categoryCache === null) {
    getPICs();
    const raw = readJSON<Category[]>(CATEGORY_KEY, []);
    const seeded = seedCategoriesIfEmpty(raw);
    if (seeded !== raw && typeof window !== "undefined") {
      window.localStorage.setItem(CATEGORY_KEY, JSON.stringify(seeded));
    }
    categoryCache = seeded;
  }
  return categoryCache;
}
export function saveCategories(items: Category[]) { writeJSON(CATEGORY_KEY, items); }
export function addCategory(input: { name: string; description?: string; isActive?: boolean }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama kategori wajib diisi");
  if (getCategories().some((c) => c.name.toLowerCase() === name.toLowerCase()))
    throw new Error("Kategori sudah ada");
  const cat: Category = {
    id: crypto.randomUUID(), name,
    description: input.description?.trim() ?? "",
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };
  saveCategories([cat, ...getCategories()]);
  return cat;
}
export function updateCategory(id: string, patch: Partial<Category>) {
  const prev = getCategories().find((c) => c.id === id);
  if (!prev) return;
  if (patch.name) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nama kategori tidak boleh kosong");
    if (getCategories().some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Kategori sudah ada");
    // cascade rename in transactions
    saveTransactions(getTransactions().map((t) =>
      t.type === "expense" && t.category === prev.name ? { ...t, category: name } : t,
    ));
    patch = { ...patch, name };
  }
  saveCategories(getCategories().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}
export function deleteCategory(id: string) {
  saveBudgetItems(getBudgetItems().filter((b) => b.categoryId !== id));
  saveCategories(getCategories().filter((c) => c.id !== id));
}
export function getCategoryById(id: string): Category | undefined {
  return getCategories().find((c) => c.id === id);
}
export function getCategoryByName(name: string): Category | undefined {
  return getCategories().find((c) => c.name.toLowerCase() === name.toLowerCase());
}

// ----- Legacy CategoryBudgets (import compat) -----
export function getCategoryBudgets(): CategoryBudget[] {
  if (categoryBudgetCache === null) categoryBudgetCache = readJSON<CategoryBudget[]>(CATEGORY_BUDGET_KEY, []);
  return categoryBudgetCache;
}
export function saveCategoryBudgets(items: CategoryBudget[]) { writeJSON(CATEGORY_BUDGET_KEY, items); }

// ----- Budget Periods -----
export function getBudgetPeriods(): BudgetPeriod[] {
  if (periodCache === null) periodCache = readJSON<BudgetPeriod[]>(PERIOD_KEY, []);
  return periodCache;
}
export function saveBudgetPeriods(items: BudgetPeriod[]) { writeJSON(PERIOD_KEY, items); }
export function addBudgetPeriod(input: {
  name: string; description?: string; startDate: string; endDate: string; status?: BudgetPeriodStatus;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Nama budget wajib diisi");
  if (!input.startDate || !input.endDate) throw new Error("Tanggal mulai & selesai wajib diisi");
  if (input.startDate > input.endDate) throw new Error("Tanggal mulai harus sebelum tanggal selesai");
  const p: BudgetPeriod = {
    id: crypto.randomUUID(), name,
    description: input.description?.trim() ?? "",
    startDate: input.startDate, endDate: input.endDate,
    status: input.status ?? "active",
    createdAt: new Date().toISOString(),
  };
  saveBudgetPeriods([p, ...getBudgetPeriods()]);
  return p;
}
export function updateBudgetPeriod(id: string, patch: Partial<BudgetPeriod>) {
  saveBudgetPeriods(getBudgetPeriods().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
export function deleteBudgetPeriod(id: string) {
  saveBudgetItems(getBudgetItems().filter((b) => b.budgetPeriodId !== id));
  saveBudgetPeriods(getBudgetPeriods().filter((p) => p.id !== id));
}
export function getBudgetPeriodById(id: string): BudgetPeriod | undefined {
  return getBudgetPeriods().find((p) => p.id === id);
}

// ----- Budget Items -----
export function getBudgetItems(): BudgetItem[] {
  if (itemCache === null) itemCache = readJSON<BudgetItem[]>(ITEM_KEY, []);
  return itemCache;
}
export function saveBudgetItems(items: BudgetItem[]) { writeJSON(ITEM_KEY, items); }
export function addBudgetItem(input: {
  budgetPeriodId: string; categoryId: string; picId: string; amount: number; notes?: string;
}) {
  const item: BudgetItem = {
    id: crypto.randomUUID(),
    budgetPeriodId: input.budgetPeriodId,
    categoryId: input.categoryId,
    picId: input.picId,
    amount: input.amount,
    notes: input.notes?.trim() ?? "",
    createdAt: new Date().toISOString(),
  };
  saveBudgetItems([item, ...getBudgetItems()]);
  return item;
}
export function updateBudgetItem(id: string, patch: Partial<BudgetItem>) {
  saveBudgetItems(getBudgetItems().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}
export function deleteBudgetItem(id: string) {
  saveBudgetItems(getBudgetItems().filter((b) => b.id !== id));
}
export function getBudgetItemsByPeriod(periodId: string): BudgetItem[] {
  return getBudgetItems().filter((b) => b.budgetPeriodId === periodId);
}

/**
 * Find active budget items that match a transaction date (and optional categoryId).
 * "Active" = period is not closed AND date is in [startDate, endDate].
 */
export function getActiveBudgetItems(dateISO: string, categoryId?: string): BudgetItem[] {
  const periods = getBudgetPeriods().filter(
    (p) => p.status !== "closed" && p.startDate <= dateISO && p.endDate >= dateISO,
  );
  const periodIds = new Set(periods.map((p) => p.id));
  return getBudgetItems().filter(
    (it) => periodIds.has(it.budgetPeriodId) && (!categoryId || it.categoryId === categoryId),
  );
}

/** Sum of expense transactions for an item's category within its period range. */
export function getRealizationForItem(item: BudgetItem): number {
  const period = getBudgetPeriodById(item.budgetPeriodId);
  if (!period) return 0;
  const cat = getCategoryById(item.categoryId);
  if (!cat) return 0;
  return getTransactions()
    .filter((t) =>
      t.type === "expense" &&
      t.category === cat.name &&
      t.date >= period.startDate &&
      t.date <= period.endDate,
    )
    .reduce((a, b) => a + b.amount, 0);
}

// ----- Clone Budget Period -----
export interface CloneOptions {
  cloneCategories: boolean;
  cloneAssignments: boolean;
  cloneAmounts: boolean;
}
export function cloneBudgetPeriod(
  sourceId: string,
  target: { name: string; description?: string; startDate: string; endDate: string; status?: BudgetPeriodStatus },
  options: CloneOptions = { cloneCategories: true, cloneAssignments: true, cloneAmounts: true },
): BudgetPeriod {
  const source = getBudgetPeriodById(sourceId);
  if (!source) throw new Error("Budget sumber tidak ditemukan");
  const newPeriod = addBudgetPeriod(target);
  if (!options.cloneCategories) return newPeriod;

  const fallbackPicId = getPICs()[0]?.id ?? "";
  const sourceItems = getBudgetItemsByPeriod(sourceId);
  const cloned: BudgetItem[] = sourceItems.map((it) => ({
    id: crypto.randomUUID(),
    budgetPeriodId: newPeriod.id,
    categoryId: it.categoryId,
    picId: options.cloneAssignments ? it.picId : fallbackPicId,
    amount: options.cloneAmounts ? it.amount : 0,
    notes: it.notes,
    createdAt: new Date().toISOString(),
  }));
  saveBudgetItems([...cloned, ...getBudgetItems()]);
  return newPeriod;
}

// ----- One-time migration: legacy CategoryBudget → BudgetPeriod/BudgetItem -----
function runMigrationOnce() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATION_KEY)) return;
  try {
    const legacyCBs = getCategoryBudgets();
    const periods = getBudgetPeriods();
    const items = getBudgetItems();
    const cats = getCategories();
    const fallbackPicId = getPICs()[0]?.id ?? "";
    if (legacyCBs.length > 0 && periods.length === 0 && items.length === 0) {
      const groups = new Map<string, CategoryBudget[]>();
      legacyCBs.forEach((cb) => {
        const key = `${cb.year}-${cb.month}`;
        const arr = groups.get(key) ?? [];
        arr.push(cb);
        groups.set(key, arr);
      });
      const newPeriods: BudgetPeriod[] = [];
      const newItems: BudgetItem[] = [];
      for (const [key, list] of groups) {
        const [y, m] = key.split("-").map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        const period: BudgetPeriod = {
          id: crypto.randomUUID(),
          name: `Budget ${MONTH_NAMES[m - 1]} ${y}`,
          description: "Dimigrasi dari budget bulanan lama",
          startDate: toISODate(start),
          endDate: toISODate(end),
          status: "active",
          createdAt: new Date().toISOString(),
        };
        newPeriods.push(period);
        list.forEach((cb) => {
          const cat = cats.find((c) => c.id === cb.categoryId);
          newItems.push({
            id: crypto.randomUUID(),
            budgetPeriodId: period.id,
            categoryId: cb.categoryId,
            picId: cat?.picId || fallbackPicId,
            amount: cb.amount,
            notes: "",
            createdAt: new Date().toISOString(),
          });
        });
      }
      saveBudgetPeriods([...newPeriods, ...periods]);
      saveBudgetItems([...newItems, ...items]);
    }
  } finally {
    window.localStorage.setItem(MIGRATION_KEY, "1");
  }
}

// ----- React hooks -----
function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const EMPTY_TX: Transaction[] = [];
const EMPTY_CATS: Category[] = [];
const EMPTY_PICS: PIC[] = [];
const EMPTY_PERIODS: BudgetPeriod[] = [];
const EMPTY_ITEMS: BudgetItem[] = [];

export function useTransactions() {
  return useSyncExternalStore(subscribe, getTransactions, () => EMPTY_TX);
}
export function useCategories() {
  return useSyncExternalStore(subscribe, getCategories, () => EMPTY_CATS);
}
export function usePICs() {
  return useSyncExternalStore(subscribe, getPICs, () => EMPTY_PICS);
}
export function useBudgetPeriods() {
  return useSyncExternalStore(subscribe, getBudgetPeriods, () => EMPTY_PERIODS);
}
export function useBudgetItems() {
  return useSyncExternalStore(subscribe, getBudgetItems, () => EMPTY_ITEMS);
}

// Run migration on first store touch in the browser
if (typeof window !== "undefined") {
  // defer to next tick so caches initialize first
  Promise.resolve().then(() => {
    runMigrationOnce();
    emit();
  });
}

// ----- Theme -----
export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as "light" | "dark" | null) || "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);
  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);
  return { theme, setTheme };
}

// ----- Backup / Restore -----
export function exportAllData(): string {
  return JSON.stringify({
    version: 4,
    exportedAt: new Date().toISOString(),
    transactions: getTransactions(),
    budgets: getBudgets(),
    categories: getCategories(),
    categoryBudgets: getCategoryBudgets(),
    pics: getPICs(),
    budgetPeriods: getBudgetPeriods(),
    budgetItems: getBudgetItems(),
  }, null, 2);
}

export function importAllData(json: string) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Format tidak valid");
  if (Array.isArray(parsed.pics)) savePICs(parsed.pics);
  if (Array.isArray(parsed.transactions)) saveTransactions(parsed.transactions);
  if (Array.isArray(parsed.budgets)) saveBudgets(parsed.budgets);
  if (Array.isArray(parsed.categories)) saveCategories(parsed.categories);
  if (Array.isArray(parsed.categoryBudgets)) saveCategoryBudgets(parsed.categoryBudgets);
  if (Array.isArray(parsed.budgetPeriods)) saveBudgetPeriods(parsed.budgetPeriods);
  if (Array.isArray(parsed.budgetItems)) saveBudgetItems(parsed.budgetItems);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MIGRATION_KEY, "1");
  }
  emit();
}

// ----- Helpers -----
export function getBudgetUsageTone(pct: number): "primary" | "warning" | "expense" {
  if (pct >= 100) return "expense";
  if (pct >= 80) return "warning";
  return "primary";
}
