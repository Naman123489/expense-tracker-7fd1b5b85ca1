export interface Expense {
  id: number;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface ExpenseCreate {
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface Budget {
  daily_limit: number;
}

export interface BudgetUpdate {
  daily_limit: number;
}

export interface CategoryStat {
  category: string;
  total: number;
}

export interface StatsResponse {
  total_today: number;
  remaining_today: number;
  total_this_month: number;
  by_category: Array<CategoryStat>;
  daily_budget_limit: number;
}

export interface ErrorResponse {
  detail: string;
}
