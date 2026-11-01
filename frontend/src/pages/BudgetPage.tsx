import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, type PostBudgetRequest } from "../api/generated";
import { useAsync, useAction, errorMessage } from "../lib/useAction";
import { Alert, Button, Card, Field, Page, Skeleton, Stat } from "../components/ui";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function BudgetPage() {
  const { data, error, loading, reload } = useAsync(() => api.getBudget(), "budget");
  const save = useAction((body: PostBudgetRequest) => api.postBudget(body));
  const [limit, setLimit] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  useEffect(() => {
    if (data) setLimit(String(data.daily_limit));
  }, [data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(limit);
    if (!limit.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setFormError("Enter a positive daily limit.");
      return;
    }
    setFormError(undefined);
    const result = await save.run({ daily_limit: parsed });
    if (result) reload();
  }

  const unauthorized = error instanceof ApiError && error.status === 401;

  return (
    <Page
      title="Budget"
      subtitle="Set the amount you can spend each day."
      actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
    >
      {unauthorized && <Alert tone="error">Your session expired. Please sign in again.</Alert>}
      {error && !unauthorized && <Alert tone="error">{errorMessage(error)}</Alert>}
      {save.error && <Alert tone="error">{save.error}</Alert>}
      {save.done && <Alert tone="success">Daily budget updated.</Alert>}

      {loading && !data ? (
        <Skeleton lines={3} />
      ) : (
        <Stat label="Current daily budget" value={formatCurrency(data?.daily_limit ?? 0)} hint="Used for today's remaining balance" />
      )}

      <Card title="Set daily budget">
        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="Daily limit"
            type="number"
            step="0.01"
            min="0.01"
            value={limit}
            onChange={(e) => {
              setLimit(e.target.value);
              setFormError(undefined);
              save.reset();
            }}
            error={formError}
            required
          />
          <Button type="submit" loading={save.pending}>Save budget</Button>
        </form>
      </Card>
    </Page>
  );
}
