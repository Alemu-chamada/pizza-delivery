import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { PasswordInput, Button, Alert } from '../components/common/UI';
import * as authApi from '../api/auth.api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const expiredParam = params.get("expired") === "1";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(expiredParam || !token);

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    const x = {};
    if (form.password.length < 8) x.password = "Use at least 8 characters.";
    if (form.password !== form.confirm) x.confirm = "Passwords do not match.";
    setErrors(x);

    if (!Object.keys(x).length) {
      if (!token) {
        setExpired(true);
        return;
      }
      setLoading(true);
      try {
        const res = await authApi.resetPassword({
          token,
          password: form.password,
        });
        if (res?.success) {
          setDone(true);
        } else {
          setServerError(res?.message || "Password reset failed.");
        }
      } catch (err) {
        if (err?.response?.status === 400 || err?.response?.status === 401) {
          setExpired(true);
        } else {
          setServerError(
            err?.response?.data?.message || "Reset link is invalid or has expired."
          );
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use something memorable and at least 8 characters long."
    >
      {expired ? (
        <div className="space-y-5">
          <Alert>This reset link has expired or has already been used.</Alert>
          <Link to="/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto text-green-600" size={52} />
          <h2 className="font-display text-2xl font-bold">Password updated</h2>
          <p className="text-sm text-stone-600">You can now log in with your new password.</p>
          <Link to="/login">
            <Button className="w-full">Continue to login</Button>
          </Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          {serverError && <Alert type="error">{serverError}</Alert>}
          <PasswordInput
            label="New password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
          <PasswordInput
            label="Confirm new password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            error={errors.confirm}
          />
          <Button className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
