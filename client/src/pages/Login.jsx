import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Input, PasswordInput, Button, Alert } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const returnTo = location.state?.returnTo || "/dashboard";
  const [form, setForm] = useState({
    email: location.state?.email || "",
    password: "",
  });
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    const x = {};
    if (!/\S+@\S+\.\S+/.test(form.email)) x.email = "Enter a valid email address.";
    if (!form.password) x.password = "Please enter your password.";
    setErrors(x);

    if (!Object.keys(x).length) {
      setLoading(true);
      try {
        const res = await login({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (res?.success) {
          const userObj = res?.data?.user || res?.data?.data?.user || res?.user;
          const authRole = userObj?.role || res?.data?.role;
          if (authRole === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate(returnTo, {
              replace: true,
              state: {
                selections: location.state?.selections,
                options: location.state?.options,
              },
            });
          }
        } else {
          setServerError(res?.message || "Invalid credentials.");
        }
      } catch (err) {
        setServerError(
          err?.response?.data?.message || "Invalid email or password. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Your next custom creation is only a few clicks away."
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {serverError && (
          <div className="space-y-2">
            <Alert type="error">{serverError}</Alert>
            {serverError.toLowerCase().includes("verify") && (
              <div className="text-right text-xs">
                <Link
                  to="/verify-email"
                  state={{ email: form.email.trim().toLowerCase() }}
                  className="font-bold text-tomato hover:underline"
                >
                  Enter your 6-digit verification code →
                </Link>
              </div>
            )}
          </div>
        )}
        <Input
          label="Email address"
          placeholder="alex@example.com"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
        />
        <div className="flex justify-between items-center text-sm">
          <Link className="font-bold text-stone-500 hover:text-tomato" to="/admin/login">
            Admin sign in →
          </Link>
          <Link className="font-bold text-tomato hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Button className="w-full" loading={loading}>
          Log in <ArrowRight size={17} />
        </Button>
        <p className="text-center text-sm text-stone-600">
          New here?{" "}
          <Link className="font-bold text-tomato" to="/register">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
