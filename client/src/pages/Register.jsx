import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, User } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Input, PasswordInput, Button, Alert } from '../components/common/UI';
import * as authApi from '../api/auth.api';

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    const x = {};
    if (!form.name.trim()) x.name = "Please enter your name.";
    if (!/\S+@\S+\.\S+/.test(form.email)) x.email = "Enter a valid email address.";
    if (form.password.length < 6) x.password = "Password must be at least 6 characters.";
    if (form.password !== form.confirm) x.confirm = "Passwords do not match.";
    setErrors(x);

    if (!Object.keys(x).length) {
      setLoading(true);
      try {
        const res = await authApi.register({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (res?.success) {
          navigate('/verify-email', {
            state: {
              email: form.email.trim().toLowerCase(),
              previewCode: res?.data?.previewCode,
              message: res?.message || "We sent a 6-digit verification code to your email. Enter it below to activate your account."
            }
          });
        } else {
          setServerError(res?.message || "Registration failed. Please try again.");
        }
      } catch (err) {
        setServerError(
          err?.response?.data?.message || "Could not register. This email may already be in use."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save your favorites and track every order in one place."
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {serverError && (
          <div className="space-y-2">
            <Alert type="error">{serverError}</Alert>
            <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold">
              <Link
                to="/verify-email"
                state={{ email: form.email.trim().toLowerCase() }}
                className="text-tomato hover:underline"
              >
                Unverified account? Enter code →
              </Link>
              <Link to="/login" className="text-stone-600 hover:underline">
                Sign in to existing account →
              </Link>
            </div>
          </div>
        )}
          <Input
            label="Full name"
            placeholder="Alex Morgan"
            icon={User}
            value={form.name}
            onChange={set("name")}
            error={errors.name}
          />
          <Input
            label="Email address"
            placeholder="alex@example.com"
            type="email"
            icon={Mail}
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <PasswordInput
            label="Password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
          />
          <PasswordInput
            label="Confirm password"
            value={form.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
            placeholder="Repeat your password"
          />
          <Button className="w-full" loading={loading}>
            Create account <ArrowRight size={17} />
          </Button>
          <p className="text-center text-sm text-stone-600">
            Already have an account?{" "}
            <Link className="font-bold text-tomato" to="/login">
              Log in
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
