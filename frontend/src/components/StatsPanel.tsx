import { ApiError } from "../api/generated";
import type { GetStatsResponse } from "../api/generated";
import { errorMessage } from "../lib/useAction";
import { Alert, Card, EmptyState, Grid, Skeleton, Stat } from "../components/ui";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function categoryName(item: unknown, index: number): string {
  if (typeof item === "string") return item;
  if (Array.isArray(item) && typeof item[0] === "string") return item[0];
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["category", "name", "label"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return `Category ${index + 1}`;
}

function categoryAmount(item: unknown): number {
  if (typeof item === "number") return item;
  if (Array.isArray(item) && item.length >= 2 && typeof item[1] === "number") return item[1];
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["amount", "total", "value", "spent", "sum"]) {
      if (typeof record[key] === "number") return record[key] as number;
    }
  }
  return 0;
}

export default function StatsPanel({
  data,
  loading,
  error,
}: {
  data: GetStatsResponse | undefined;
  loading: boolean;
  error: Error | null;
}) {
  const unauthorized = error instanceof ApiError && error.status === 401;
  const items = (data?.by_category ?? []).map((item, index) => ({
    name: categoryName(item, index),
    amount: categoryAmount(item),
  }));
  const max = Math.max(...items.map((item) => item.amount), 1);

  return (
    <>
      {unauthorized && <Alert tone="error">Your session expired. Please sign in again.</Alert>}
      {error && !unauthorized && <Alert tone="error">{errorMessage(error)}</Alert>}
      {loading && !data ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <Grid min={200}>
            <Stat label="Spent today" value={formatCurrency(data?.total_today ?? 0)} hint="All of today's expenses" />
            <Stat label="Remaining today" value={formatCurrency(data?.remaining_today ?? 0)} hint="Based on your daily budget" />
            <Stat label="Spent this month" value={formatCurrency(data?.total_this_month ?? 0)} hint="Month to date" />
            <Stat label="Daily budget" value={formatCurrency(data?.daily_budget_limit ?? 0)} hint="Current daily limit" />
          </Grid>
          <Card title="Spending by category">
            {items.length === 0 ? (
              <EmptyState title="No category data yet" action={<a href="#/expenses">Add an expense</a>} />
            ) : (
              <ul className="list">
                {items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ width: `${(item.amount / max) * 100}%`, height: "100%", background: "var(--primary)", borderRadius: 999 }} />
                    </div>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
