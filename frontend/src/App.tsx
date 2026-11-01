import { useEffect, useState } from "react";
import { useHashRoute } from "./lib/useHashRoute";
import { getToken, setToken } from "./api/generated";
import { Button, AppShell } from "./components/ui";
import AuthGate from "./components/AuthGate";
import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import BudgetPage from "./pages/BudgetPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  const [route, navigate] = useHashRoute("dashboard");
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    const allowed = new Set(["dashboard", "expenses", "budget", "stats"]);
    if (!allowed.has(route)) navigate("dashboard");
  }, [route, navigate]);

  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  const nav = [
    { href: "#/dashboard", label: "Dashboard" },
    { href: "#/expenses", label: "Expenses" },
    { href: "#/budget", label: "Budget" },
    { href: "#/stats", label: "Stats" },
  ];

  return (
    <AppShell
      brand="Expense Tracker"
      nav={nav}
      current={route}
      right={<Button variant="ghost" onClick={() => { setToken(""); setAuthed(false); }}>Sign out</Button>}
    >
      {route === "dashboard" && <DashboardPage />}
      {route === "expenses" && <ExpensesPage />}
      {route === "budget" && <BudgetPage />}
      {route === "stats" && <StatsPage />}
    </AppShell>
  );
}
