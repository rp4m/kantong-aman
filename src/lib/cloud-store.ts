import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  Transaction,
  Category,
  PIC,
  BudgetPeriod,
  BudgetItem,
  BudgetPeriodStatus,
} from "./budget-types";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PIC_NAME } from "./budget-types";

// =================== Shared store (sync hook signatures) ===================

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }

let txCache: Transaction[] = [];
let categoryCache: Category[] = [];
let picCache: PIC[] = [];
let periodCache: BudgetPeriod[] = [];
let itemCache: BudgetItem[] = [];
let collaboratorCache: Collaborator[] = [];
let currentUserId: string | null = null;
let currentUserEmail: string | null = null;

export interface Collaborator {
  id: string;
  budgetPeriodId: string;
  userId: string | null;
  invitedEmail: string;
  role: "owner" | "collaborator" | "viewer";
  status: "pending" | "accepted" | "rejected";
  invitedAt: string;
  acceptedAt: string | null;
}

// =================== Adapters ===================

const toTx = (r: any): Transaction => ({
  id: r.id, date: r.date, type: r.type, category: r.category ?? "",
  amount: Number(r.amount), notes: r.notes ?? "",
  budgetItemId: r.budget_item_id ?? undefined,
  createdAt: r.created_at,
  // @ts-expect-error extra fields
  createdBy: r.created_by, updatedBy: r.updated_by, updatedAt: r.updated_at,
  budgetPeriodId: r.budget_period_id,
});

const toCat = (r: any): Category => ({
  id: r.id, name: r.name, description: r.description ?? "",
  isActive: r.is_active, createdAt: r.created_at,
});

const toPic = (r: any): PIC => ({
  id: r.id, name: r.name, email: r.email ?? "", phone: r.phone ?? "",
  description: r.description ?? "", isActive: r.is_active, createdAt: r.created_at,
});

const toPeriod = (r: any): BudgetPeriod => ({
  id: r.id, name: r.name, description: r.description ?? "",
  startDate: r.start_date, endDate: r.end_date,
  status: r.status, createdAt: r.created_at,
  // @ts-expect-error extra
  ownerUserId: r.owner_user_id,
});

const toItem = (r: any): BudgetItem => ({
  id: r.id, budgetPeriodId: r.budget_period_id,
  categoryId: r.category_id, picId: r.pic_id,
  amount: Number(r.amount), notes: r.notes ?? "",
  createdAt: r.created_at,
});

const toCollab = (r: any): Collaborator => ({
  id: r.id, budgetPeriodId: r.budget_period_id,
  userId: r.user_id, invitedEmail: r.invited_email,
  role: r.role, status: r.status, invitedAt: r.invited_at,
  acceptedAt: r.accepted_at,
});

// =================== Fetch all ===================

async function fetchAll(userId: string) {
  const [tx, cat, pic, periods, items, collab] = await Promise.all([
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("categories").select("*").order("created_at", { ascending: false }),
    supabase.from("pics").select("*").order("created_at", { ascending: false }),
    supabase.from("budget_periods").select("*").order("created_at", { ascending: false }),
    supabase.from("budget_items").select("*").order("created_at", { ascending: false }),
    supabase.from("budget_collaborators").select("*"),
  ]);
  txCache = (tx.data ?? []).map(toTx);
  categoryCache = (cat.data ?? []).map(toCat);
  picCache = (pic.data ?? []).map(toPic);
  periodCache = (periods.data ?? []).map(toPeriod);
  itemCache = (items.data ?? []).map(toItem);
  collaboratorCache = (collab.data ?? []).map(toCollab);

  // Seed defaults if first time
  if (picCache.length === 0) {
    const { data } = await supabase.from("pics").insert({
      owner_user_id: userId, name: DEFAULT_PIC_NAME,
      description: "PIC default — silakan tambah atau edit sesuai kebutuhan",
    }).select("*").single();
    if (data) picCache = [toPic(data)];
  }
  if (categoryCache.length === 0) {
    const rows = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      owner_user_id: userId, name, description: "",
    }));
    const { data } = await supabase.from("categories").insert(rows).select("*");
    if (data) categoryCache = data.map(toCat);
  }
  emit();
}

// =================== Provider ===================

const Ctx = createContext<{ userId: string; userEmail: string } | null>(null);
export function useCurrentUser() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CloudDataProvider missing");
  return c;
}

export function CloudDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ userId: string; userEmail: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      currentUserId = data.user.id;
      currentUserEmail = data.user.email ?? null;
      setMe({ userId: data.user.id, userEmail: data.user.email ?? "" });
      await fetchAll(data.user.id);
      setReady(true);
    })();

    // Realtime: refresh on any change in user-relevant tables
    const channel = supabase.channel("cloud-store")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, async () => {
        if (currentUserId) { await refreshSlice("transactions"); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_periods" }, async () => {
        if (currentUserId) await refreshSlice("budget_periods");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, async () => {
        if (currentUserId) await refreshSlice("budget_items");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_collaborators" }, async () => {
        if (currentUserId) await refreshSlice("collaborators");
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  if (!ready || !me) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Memuat data…</div>;
  }
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}

async function refreshSlice(slice: "transactions" | "categories" | "pics" | "budget_periods" | "budget_items" | "collaborators") {
  if (slice === "transactions") {
    const { data } = await supabase.from("transactions").select("*").order("date", { ascending: false });
    txCache = (data ?? []).map(toTx);
  } else if (slice === "categories") {
    const { data } = await supabase.from("categories").select("*").order("created_at", { ascending: false });
    categoryCache = (data ?? []).map(toCat);
  } else if (slice === "pics") {
    const { data } = await supabase.from("pics").select("*").order("created_at", { ascending: false });
    picCache = (data ?? []).map(toPic);
  } else if (slice === "budget_periods") {
    const { data } = await supabase.from("budget_periods").select("*").order("created_at", { ascending: false });
    periodCache = (data ?? []).map(toPeriod);
  } else if (slice === "budget_items") {
    const { data } = await supabase.from("budget_items").select("*").order("created_at", { ascending: false });
    itemCache = (data ?? []).map(toItem);
  } else if (slice === "collaborators") {
    const { data } = await supabase.from("budget_collaborators").select("*");
    collaboratorCache = (data ?? []).map(toCollab);
  }
  emit();
}

// =================== Hooks ===================

const EMPTY = Object.freeze([]) as unknown as never[];

export function useTransactions(): Transaction[] {
  return useSyncExternalStore(subscribe, () => txCache, () => EMPTY);
}
export function useCategories(): Category[] {
  return useSyncExternalStore(subscribe, () => categoryCache, () => EMPTY);
}
export function usePICs(): PIC[] {
  return useSyncExternalStore(subscribe, () => picCache, () => EMPTY);
}
export function useBudgetPeriods(): BudgetPeriod[] {
  return useSyncExternalStore(subscribe, () => periodCache, () => EMPTY);
}
export function useBudgetItems(): BudgetItem[] {
  return useSyncExternalStore(subscribe, () => itemCache, () => EMPTY);
}
export function useCollaborators(): Collaborator[] {
  return useSyncExternalStore(subscribe, () => collaboratorCache, () => EMPTY);
}

// =================== Read helpers ===================

export const getCategories = () => categoryCache;
export const getPICs = () => picCache;
export const getBudgetPeriods = () => periodCache;
export const getBudgetItems = () => itemCache;
export const getTransactions = () => txCache;

export const getCategoryById = (id: string) => categoryCache.find((c) => c.id === id);
export const getCategoryByName = (name: string) => categoryCache.find((c) => c.name.toLowerCase() === name.toLowerCase());
export const getPICById = (id: string) => picCache.find((p) => p.id === id);
export const getBudgetPeriodById = (id: string) => periodCache.find((p) => p.id === id);
export const getBudgetItemsByPeriod = (id: string) => itemCache.filter((it) => it.budgetPeriodId === id);

export function getActiveBudgetItems(dateISO: string, categoryId?: string): BudgetItem[] {
  const periods = periodCache.filter((p) => p.status !== "closed" && p.startDate <= dateISO && p.endDate >= dateISO);
  const ids = new Set(periods.map((p) => p.id));
  return itemCache.filter((it) => ids.has(it.budgetPeriodId) && (!categoryId || it.categoryId === categoryId));
}

export function getRealizationForItem(item: BudgetItem): number {
  const period = getBudgetPeriodById(item.budgetPeriodId);
  if (!period) return 0;
  const cat = getCategoryById(item.categoryId);
  if (!cat) return 0;
  return txCache
    .filter((t) => t.type === "expense" && t.category === cat.name && t.date >= period.startDate && t.date <= period.endDate)
    .reduce((a, b) => a + b.amount, 0);
}

export function getBudgetUsageTone(pct: number): "primary" | "warning" | "expense" {
  if (pct >= 100) return "expense";
  if (pct >= 80) return "warning";
  return "primary";
}

// =================== Roles ===================

export function getBudgetRole(periodId: string): "owner" | "collaborator" | "viewer" | null {
  if (!currentUserId) return null;
  const p = periodCache.find((x) => x.id === periodId) as any;
  if (p && p.ownerUserId === currentUserId) return "owner";
  const c = collaboratorCache.find((x) => x.budgetPeriodId === periodId && x.userId === currentUserId && x.status === "accepted");
  return c ? c.role : null;
}

export function canEditBudget(periodId: string): boolean {
  const r = getBudgetRole(periodId);
  return r === "owner";
}
export function canAddTransaction(periodId: string): boolean {
  const r = getBudgetRole(periodId);
  return r === "owner" || r === "collaborator";
}

// =================== Mutations ===================

function ensureUser() {
  if (!currentUserId) throw new Error("Belum login");
  return currentUserId;
}

// --- Transactions ---
export async function addTransaction(tx: Omit<Transaction, "id" | "createdAt"> & { budgetPeriodId?: string }) {
  const uid = ensureUser();
  let periodId = (tx as any).budgetPeriodId as string | undefined;
  if (!periodId && tx.budgetItemId) {
    const it = itemCache.find((x) => x.id === tx.budgetItemId);
    periodId = it?.budgetPeriodId;
  }
  if (!periodId) {
    // try infer from active items by date+category
    const cat = getCategoryByName(tx.category);
    if (cat) {
      const it = getActiveBudgetItems(tx.date, cat.id)[0];
      periodId = it?.budgetPeriodId;
    }
  }
  if (!periodId) throw new Error("Pilih budget periode terlebih dahulu (buat budget aktif).");
  const { data, error } = await supabase.from("transactions").insert({
    budget_period_id: periodId,
    budget_item_id: tx.budgetItemId ?? null,
    category: tx.category,
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    notes: tx.notes ?? "",
    created_by: uid,
  }).select("*").single();
  if (error) throw error;
  txCache = [toTx(data), ...txCache];
  emit();
  return toTx(data);
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const u: any = {};
  if (patch.date !== undefined) u.date = patch.date;
  if (patch.type !== undefined) u.type = patch.type;
  if (patch.category !== undefined) u.category = patch.category;
  if (patch.amount !== undefined) u.amount = patch.amount;
  if (patch.notes !== undefined) u.notes = patch.notes;
  if (patch.budgetItemId !== undefined) u.budget_item_id = patch.budgetItemId ?? null;
  const { data, error } = await supabase.from("transactions").update(u).eq("id", id).select("*").single();
  if (error) throw error;
  txCache = txCache.map((t) => (t.id === id ? toTx(data) : t));
  emit();
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
  txCache = txCache.filter((t) => t.id !== id);
  emit();
}

// --- Categories ---
export async function addCategory(input: { name: string; description?: string; isActive?: boolean }) {
  const uid = ensureUser();
  const name = input.name.trim();
  if (!name) throw new Error("Nama kategori wajib diisi");
  if (categoryCache.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new Error("Kategori sudah ada");
  const { data, error } = await supabase.from("categories").insert({
    owner_user_id: uid, name, description: input.description ?? "", is_active: input.isActive ?? true,
  }).select("*").single();
  if (error) throw error;
  categoryCache = [toCat(data), ...categoryCache];
  emit();
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const prev = categoryCache.find((c) => c.id === id);
  if (!prev) return;
  const u: any = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nama kategori tidak boleh kosong");
    if (categoryCache.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) throw new Error("Kategori sudah ada");
    u.name = name;
    // cascade rename in transactions (best-effort, RLS-aware)
    if (name !== prev.name) {
      await supabase.from("transactions").update({ category: name }).eq("category", prev.name).eq("type", "expense");
    }
  }
  if (patch.description !== undefined) u.description = patch.description;
  if (patch.isActive !== undefined) u.is_active = patch.isActive;
  const { data, error } = await supabase.from("categories").update(u).eq("id", id).select("*").single();
  if (error) throw error;
  categoryCache = categoryCache.map((c) => (c.id === id ? toCat(data) : c));
  await refreshSlice("transactions");
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  categoryCache = categoryCache.filter((c) => c.id !== id);
  await refreshSlice("budget_items");
}

// --- PICs ---
export async function addPIC(input: { name: string; email?: string; phone?: string; description?: string; isActive?: boolean }) {
  const uid = ensureUser();
  const name = input.name.trim();
  if (!name) throw new Error("Nama PIC wajib diisi");
  if (picCache.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error("PIC sudah ada");
  const { data, error } = await supabase.from("pics").insert({
    owner_user_id: uid, name, email: input.email ?? "", phone: input.phone ?? "",
    description: input.description ?? "", is_active: input.isActive ?? true,
  }).select("*").single();
  if (error) throw error;
  picCache = [toPic(data), ...picCache];
  emit();
}

export async function updatePIC(id: string, patch: Partial<PIC>) {
  const u: any = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Nama PIC tidak boleh kosong");
    if (picCache.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) throw new Error("PIC sudah ada");
    u.name = name;
  }
  if (patch.email !== undefined) u.email = patch.email;
  if (patch.phone !== undefined) u.phone = patch.phone;
  if (patch.description !== undefined) u.description = patch.description;
  if (patch.isActive !== undefined) u.is_active = patch.isActive;
  const { data, error } = await supabase.from("pics").update(u).eq("id", id).select("*").single();
  if (error) throw error;
  picCache = picCache.map((p) => (p.id === id ? toPic(data) : p));
  emit();
}

export async function deletePIC(id: string) {
  if (picCache.length <= 1) throw new Error("Minimal harus ada 1 PIC");
  const { error } = await supabase.from("pics").delete().eq("id", id);
  if (error) throw error;
  picCache = picCache.filter((p) => p.id !== id);
  await refreshSlice("budget_items");
}

// --- Budget Periods ---
export async function addBudgetPeriod(input: { name: string; description?: string; startDate: string; endDate: string; status?: BudgetPeriodStatus }) {
  const uid = ensureUser();
  const name = input.name.trim();
  if (!name) throw new Error("Nama budget wajib diisi");
  if (!input.startDate || !input.endDate) throw new Error("Tanggal mulai & selesai wajib diisi");
  if (input.startDate > input.endDate) throw new Error("Tanggal mulai harus sebelum tanggal selesai");
  const { data, error } = await supabase.from("budget_periods").insert({
    owner_user_id: uid, name, description: input.description ?? "",
    start_date: input.startDate, end_date: input.endDate, status: input.status ?? "active",
  }).select("*").single();
  if (error) throw error;
  periodCache = [toPeriod(data), ...periodCache];
  emit();
  return toPeriod(data);
}

export async function updateBudgetPeriod(id: string, patch: Partial<BudgetPeriod>) {
  const u: any = {};
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.description !== undefined) u.description = patch.description;
  if (patch.startDate !== undefined) u.start_date = patch.startDate;
  if (patch.endDate !== undefined) u.end_date = patch.endDate;
  if (patch.status !== undefined) u.status = patch.status;
  const { data, error } = await supabase.from("budget_periods").update(u).eq("id", id).select("*").single();
  if (error) throw error;
  periodCache = periodCache.map((p) => (p.id === id ? toPeriod(data) : p));
  emit();
}

export async function deleteBudgetPeriod(id: string) {
  const { error } = await supabase.from("budget_periods").delete().eq("id", id);
  if (error) throw error;
  periodCache = periodCache.filter((p) => p.id !== id);
  itemCache = itemCache.filter((it) => it.budgetPeriodId !== id);
  emit();
}

// --- Budget Items ---
export async function addBudgetItem(input: { budgetPeriodId: string; categoryId: string; picId: string; amount: number; notes?: string }) {
  const { data, error } = await supabase.from("budget_items").insert({
    budget_period_id: input.budgetPeriodId, category_id: input.categoryId, pic_id: input.picId,
    amount: input.amount, notes: input.notes ?? "",
  }).select("*").single();
  if (error) throw error;
  itemCache = [toItem(data), ...itemCache];
  emit();
  return toItem(data);
}

export async function updateBudgetItem(id: string, patch: Partial<BudgetItem>) {
  const u: any = {};
  if (patch.budgetPeriodId !== undefined) u.budget_period_id = patch.budgetPeriodId;
  if (patch.categoryId !== undefined) u.category_id = patch.categoryId;
  if (patch.picId !== undefined) u.pic_id = patch.picId;
  if (patch.amount !== undefined) u.amount = patch.amount;
  if (patch.notes !== undefined) u.notes = patch.notes;
  const { data, error } = await supabase.from("budget_items").update(u).eq("id", id).select("*").single();
  if (error) throw error;
  itemCache = itemCache.map((b) => (b.id === id ? toItem(data) : b));
  emit();
}

export async function deleteBudgetItem(id: string) {
  const { error } = await supabase.from("budget_items").delete().eq("id", id);
  if (error) throw error;
  itemCache = itemCache.filter((b) => b.id !== id);
  emit();
}

// --- Clone Period ---
export interface CloneOptions { cloneCategories: boolean; cloneAssignments: boolean; cloneAmounts: boolean; }
export async function cloneBudgetPeriod(
  sourceId: string,
  target: { name: string; description?: string; startDate: string; endDate: string; status?: BudgetPeriodStatus },
  options: CloneOptions = { cloneCategories: true, cloneAssignments: true, cloneAmounts: true },
) {
  const np = await addBudgetPeriod(target);
  if (!options.cloneCategories) return np;
  const fallbackPic = picCache[0]?.id ?? "";
  const src = getBudgetItemsByPeriod(sourceId);
  if (src.length === 0) return np;
  const rows = src.map((it) => ({
    budget_period_id: np.id, category_id: it.categoryId,
    pic_id: options.cloneAssignments ? it.picId : fallbackPic,
    amount: options.cloneAmounts ? it.amount : 0, notes: it.notes,
  }));
  const { data } = await supabase.from("budget_items").insert(rows).select("*");
  if (data) itemCache = [...data.map(toItem), ...itemCache];
  emit();
  return np;
}

// --- Collaborators ---
export async function inviteCollaborator(budgetPeriodId: string, email: string, role: "collaborator" | "viewer") {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Email tidak valid");
  // Try lookup existing user
  const { data: prof } = await supabase.from("profiles").select("id").eq("email", e).maybeSingle();
  const { data, error } = await supabase.from("budget_collaborators").insert({
    budget_period_id: budgetPeriodId,
    invited_email: e,
    user_id: prof?.id ?? null,
    role,
    status: prof?.id ? "accepted" : "pending",
    accepted_at: prof?.id ? new Date().toISOString() : null,
  }).select("*").single();
  if (error) throw error;
  collaboratorCache = [toCollab(data), ...collaboratorCache];
  emit();
}

export async function updateCollaboratorRole(id: string, role: "collaborator" | "viewer") {
  const { data, error } = await supabase.from("budget_collaborators").update({ role }).eq("id", id).select("*").single();
  if (error) throw error;
  collaboratorCache = collaboratorCache.map((c) => (c.id === id ? toCollab(data) : c));
  emit();
}

export async function removeCollaborator(id: string) {
  const { error } = await supabase.from("budget_collaborators").delete().eq("id", id);
  if (error) throw error;
  collaboratorCache = collaboratorCache.filter((c) => c.id !== id);
  emit();
}

// =================== Theme (still localStorage) ===================
export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = (localStorage.getItem("dbt_theme") as "light" | "dark" | null) || "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);
  const setTheme = (t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem("dbt_theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };
  return { theme, setTheme };
}

// =================== Export/Import (JSON, cloud-aware) ===================
export function exportAllData(): string {
  return JSON.stringify({
    version: 5,
    exportedAt: new Date().toISOString(),
    transactions: txCache, categories: categoryCache, pics: picCache,
    budgetPeriods: periodCache, budgetItems: itemCache,
  }, null, 2);
}

export async function signOut() {
  await supabase.auth.signOut();
}
