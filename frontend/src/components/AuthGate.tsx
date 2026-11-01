import { useState } from "react";
import type { FormEvent } from "react";
import { setToken } from "../api/generated";
import { useAction, errorMessage } from "../lib/useAction";
import { AuthLayout, Field, Button, Alert } from "../components/ui";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [token, setTokenValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const action = useAction(async (value: string) => {
    setToken(value);
    return true;
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setFieldError("Access token is required.");
      return;
    }
    setFieldError(undefined);
    const out = await action.run(token.trim());
    if (out) onAuthed();
  }

  return (
    <AuthLayout
      brand="Expense Tracker"
      title={mode === "login" ? "Sign in" : "Create account"}
      subtitle="Track daily spending, budgets and statistics."
      footer={
        mode === "login" ? (
          <>Need an account? <button type="button" className="btn btn-ghost" onClick={() => setMode("signup")}>Sign up</button></>
        ) : (
          <>Already have an account? <button type="button" className="btn btn-ghost" onClick={() => setMode("login")}>Sign in</button></>
        )
      }
    >
      {action.error && <Alert tone="error">{errorMessage(action.error)}</Alert>}
      <form onSubmit={handleSubmit}>
        <Field
          label="Access token"
          value={token}
          onChange={(e) => {
            setTokenValue(e.target.value);
            setFieldError(undefined);
            action.reset();
          }}
          error={fieldError}
          hint="Paste the token issued for your account."
          required
        />
        <Button type="submit" className="btn-block" loading={action.pending}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
