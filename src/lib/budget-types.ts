export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: TransactionType;
  category: string; // expense → Category.name; income → INCOME_CATEGORIES
  amount: number;
  notes: string;
  budgetItemId?: string; // optional link to a BudgetItem (for expense)
  createdAt: string;
  createdBy?: string | null;
}

// ---- Legacy (kept for import) ----
export interface Budget {
  month: number;
  year: number;
  amount: number;
  createdAt: string;
}

export interface CategoryBudget {
  id: string;
  month: number;
  year: number;
  categoryId: string;
  amount: number;
  createdAt: string;
}

// ---- New core entities ----
export interface PIC {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  /** @deprecated PIC now belongs to BudgetItem */
  picId?: string;
  isActive: boolean;
  createdAt: string;
}

export type BudgetPeriodStatus = "draft" | "active" | "closed";

export interface BudgetPeriod {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  status: BudgetPeriodStatus;
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  budgetPeriodId: string;
  categoryId: string;
  picId: string;
  amount: number;
  notes: string;
  createdAt: string;
}

export const INCOME_CATEGORIES = [
  "Gaji",
  "Bonus",
  "Freelance",
  "Investasi",
  "Lainnya",
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Makan",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Kesehatan",
  "Hiburan",
  "Pendidikan",
  "Cicilan",
] as const;

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

export const DEFAULT_PIC_NAME = "Umum";

export const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
