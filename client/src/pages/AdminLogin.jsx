import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Input, PasswordInput, Button, Alert } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';

export function AdminLogin() {
  const navigate = useNavigate();
  const { adminLogin } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    const x = {};
    if (!/\S+@\S+\.\S+/.test(form.email)) x.email = "Enter a valid administrator email.";
    if (!form.password) x.password = "Please enter your administrator password.";
    setErrors(x);

    if (!Object.keys(x).length) {
      setLoading(true);
      try {
        const res = await adminLogin({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (res?.success) {
          navigate("/admin");
        } else {
          setServerError(res?.message || "Invalid administrative credentials.");
        }
      } catch (err) {
        setServerError(
          err?.response?.data?.message || "Invalid administrator credentials or unauthorized role."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthShell
      title="Admin Portal"
      subtitle="Sign in with your administrative credentials to manage kitchen operations."
      badgeText="Administrative Access"
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {serverError && <Alert type="error">{serverError}</Alert>}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-center gap-2">
          <ShieldCheck size={16} className="shrink-0 text-amber-600" />
          <span>Restricted to authorized kitchen managers and inventory administrators.</span>
        </div>
        <Input
          label="Admin email address"
          placeholder="admin@example.com"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />
        <PasswordInput
          label="Admin password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          placeholder="Enter administrator password"
        />
        <Button className="w-full" loading={loading}>
          Sign in to Admin <ArrowRight size={17} />
        </Button>
        <p className="text-center text-sm text-stone-600">
          Not an administrator?{" "}
          <Link className="font-bold text-tomato" to="/login">
            Customer login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
