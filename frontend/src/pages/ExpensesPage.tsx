import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, type GetExpensesItem, type PostExpensesRequest } from "../api/generated";
import { useAsync, useAction, errorMessage } from "../lib/useAction";
import { Alert, Badge, Button, Card, DataTable, EmptyState, Field, Grid, Page, Skeleton, TextArea, Toolbar } from "../components/ui";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ExpensesPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => api.getExpenses({ start_date: start || undefined, end_date: end || undefined }),
    `expenses:${start}:${end}`
  );

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [formErrors, setFormErrors] = useState<{ amount?: string; category?: string; date?: string }>({});
  const create = useAction((body: PostExpensesRequest) => api.postExpenses(body));
  const remove = useAction(async (id: number) => {
    await api.deleteExpensesById(id);
    return true;
  });
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function validateForm() {
    const errors: { amount?: string; category?: string; date?: string } = {};
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      errors.amount = "Enter a positive amount.";
    }
    if (!category.trim()) {
      errors.category = "Category is required.";
    }
    if (!date) {
      errors.date = "Date is required.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    const result = await create.run({
      amount: Number(amount),
      category: category.trim(),
      description: description.trim() || undefined,
      date,
    });
    if (result) {
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(today());
      setFormErrors({});
      reload();
    }
  }

  async function handleDelete(id: number) {
    const result = await remove.run(id);
    if (result) {
      setConfirmId(null);
      reload();
    }
  }

  const rows = data ?? [];
  const unauthorized = error instanceof ApiError && error.status === 401;

  return (
    <Page
      title="Expenses"
      subtitle="Record, filter and remove your spending."
      actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
    >
      {unauthorized && <Alert tone="error">Your session expired. Please sign in again.</Alert>}
      {error && !unauthorized && <Alert tone="error">{errorMessage(error)}</Alert>}
      {remove.error && <Alert tone="error">{remove.error}</Alert>}

      <Card title="Add expense">
        {create.error && <Alert tone="error">{create.error}</Alert>}
        {create.done && <Alert tone="success">Expense added.</Alert>}
        <form onSubmit={handleSubmit} noValidate>
          <Grid min={220}>
            <Field
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                create.reset();
              }}
              error={formErrors.amount}
              required
            />
            <Field
              label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                create.reset();
              }}
              error={formErrors.category}
              required
            />
            <Field
              label="Date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                create.reset();
              }}
              error={formErrors.date}
              required
            />
          </Grid>
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            hint="Optional details about this expense."
          />
          <Button type="submit" loading={create.pending}>Add expense</Button>
        </form>
      </Card>

      <Card title="Expense history">
        <Toolbar>
          <Field label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Field label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Toolbar>
        {loading && !data ? (
          <Skeleton lines={6} />
        ) : (
          <DataTable<GetExpensesItem>
            columns={[
              { header: "Date", cell: (row) => row.date },
              { header: "Category", cell: (row) => <Badge tone="neutral">{row.category}</Badge> },
              { header: "Description", cell: (row) => row.description || "—" },
              { header: "Amount", cell: (row) => formatCurrency(row.amount) },
              {
                header: "Actions",
                cell: (row) =>
                  confirmId === row.id ? (
                    <div className="row">
                      <Button variant="danger" loading={remove.pending} onClick={() => handleDelete(row.id)}>Confirm</Button>
                      <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button variant="danger" onClick={() => setConfirmId(row.id)}>Delete</Button>
                  ),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No expenses yet" action={<a href="#/expenses">Add your first expense above</a>} />}
          />
        )}
      </Card>
    </Page>
  );
}
