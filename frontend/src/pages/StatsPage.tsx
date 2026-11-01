import { useAsync } from "../lib/useAction";
import { api } from "../api/generated";
import { Button, Page } from "../components/ui";
import StatsPanel from "../components/StatsPanel";

export default function StatsPage() {
  const { data, error, loading, reload } = useAsync(() => api.getStats(), "stats");

  return (
    <Page
      title="Statistics"
      subtitle="Totals, remaining budget and spending by category."
      actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
    >
      <StatsPanel data={data} loading={loading} error={error} />
    </Page>
  );
}
