import { useAsync } from "../lib/useAction";
import { api } from "../api/generated";
import { Button, Card, Page } from "../components/ui";
import StatsPanel from "../components/StatsPanel";

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => api.getStats(), "dashboard-stats");

  return (
    <Page
      title="Dashboard"
      subtitle="A quick view of your spending and budget."
      actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
    >
      <StatsPanel data={data} loading={loading} error={error} />
      <Card title="Quick actions">
        <div className="row">
          <a className="btn btn-primary" href="#/expenses">Add expense</a>
          <a className="btn btn-secondary" href="#/budget">Set daily budget</a>
          <a className="btn btn-secondary" href="#/stats">View statistics</a>
        </div>
      </Card>
    </Page>
  );
}
