import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { classifyCodeError, cleanCode, safeReturnTo } from "../../domain/student-screens";
import { ApiError, getJson, postRaw } from "../api";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { signInMessages, type SignInProblem } from "./sign-in-messages";
import { PageHeading, Shell } from "./Shell";

const optionsSchema = z.object({ google: z.boolean() });

export function SignIn() {
  const [params] = useSearchParams();
  const next = safeReturnTo(params.get("next"));
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(
    params.get("error") ? "google_failed" : null,
  );
  // Focus the email field only when coming back to it; on first load the h1 has focus.
  const [returned, setReturned] = useState(false);
  const [google, setGoogle] = useState(false);

  // The Google button shows only when the server has the keys (plan 03, Q5).
  useEffect(() => {
    getJson("/api/sign-in-options", optionsSchema).then(
      (o) => setGoogle(o.google),
      () => setGoogle(false),
    );
  }, []);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await postRaw("/api/auth/email-otp/send-verification-otp", {
        email: email.trim(),
        type: "sign-in",
      });
      setCode("");
      setStep("code");
    } catch (err) {
      setProblem(
        err instanceof ApiError && err.status === 429 ? "send_rate_limited" : "send_failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await postRaw("/api/auth/sign-in/email-otp", { email: email.trim(), otp: code });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const kind = classifyCodeError(status, err instanceof ApiError ? err.code : undefined);
      setProblem(
        kind === "wrong_code"
          ? "wrong_code"
          : kind === "too_many_attempts"
            ? "too_many_attempts"
            : kind === "rate_limited"
              ? "code_rate_limited"
              : "check_failed",
      );
      setBusy(false);
      return;
    }
    // Signed in. /api/me tells us if the account still needs its email confirmed.
    try {
      await getJson("/api/me", z.object({ email: z.string() }));
      navigate(next, { replace: true });
    } catch (err) {
      setProblem(
        err instanceof ApiError && err.code === "email_not_verified"
          ? "unverified"
          : "check_failed",
      );
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setProblem(null);
    try {
      const out = (await postRaw("/api/auth/sign-in/social", {
        provider: "google",
        callbackURL: next,
        errorCallbackURL: "/sign-in?error=google",
      })) as { url?: unknown } | null;
      if (typeof out?.url !== "string") throw new Error("no url");
      window.location.assign(out.url);
    } catch {
      setProblem("google_failed");
      setBusy(false);
    }
  }

  return (
    <Shell signedIn={false}>
      <div className="mx-auto grid max-w-md gap-6">
        <PageHeading>Sign in</PageHeading>

        {step === "email" ? (
          <form onSubmit={sendCode} className="grid gap-6">
            <p className="m-0 max-w-measure text-body text-fg">
              Enter your email address. We'll send you a 6-digit code.
            </p>
            <TextField
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus={returned}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {problem ? <Problem problem={problem} /> : null}
            <Button type="submit" loading={busy} loadingLabel="Sending code">
              Email me a code
            </Button>
          </form>
        ) : (
          <form onSubmit={checkCode} className="grid gap-6">
            <p className="m-0 max-w-measure text-body text-fg">
              We sent a 6-digit code to <strong className="text-fg-strong">{email.trim()}</strong>.
              It works for 5 minutes.
            </p>
            <TextField
              label="6-digit code"
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={7}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
            />
            {problem ? <Problem problem={problem} /> : null}
            <Button
              type="submit"
              loading={busy}
              loadingLabel="Checking"
              disabled={code.length !== 6}
            >
              Sign in
            </Button>
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary" onClick={() => void sendCode()} disabled={busy}>
                Send a new code
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep("email");
                  setReturned(true);
                  setProblem(null);
                }}
              >
                Use a different email
              </Button>
            </div>
          </form>
        )}

        {google && step === "email" ? (
          <div className="grid gap-4">
            <p className="m-0 text-base text-fg-muted">Or use your Google account.</p>
            <Button variant="secondary" outline onClick={signInWithGoogle} disabled={busy}>
              Continue with Google
            </Button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Problem({ problem }: { problem: SignInProblem }) {
  return (
    <p className="ew-notice" role="alert">
      {signInMessages[problem]}
    </p>
  );
}
