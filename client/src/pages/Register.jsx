import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, User } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Input, PasswordInput, Button, Alert, GoogleIcon } from '../components/common/UI';
import * as authApi from '../api/auth.api';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errCode = searchParams.get('error');
    if (errCode) {
      const errorMap = {
        cancelled: 'Google sign-in was cancelled.',
        google_cancelled: 'Google sign-in was cancelled.',
        admin_oauth_prohibited: 'Admin accounts cannot sign in using Google. Please use the Admin portal.',
        google_oauth_not_configured: 'Google OAuth is not configured yet in server environment.',
        unverified_google_email: 'Your Google email is unverified. Please verify your email with Google first.',
        invalid_state: 'Security verification failed during Google sign-in. Please try again.',
        oauth_failed: 'Google authentication failed. Please try again or use your password.',
      };
      setServerError(errorMap[errCode] || 'Google authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleGoogleAuth = () => {
    window.location.href = authApi.getGoogleAuthUrl('/dashboard', '/register');
  };

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
      <div className="space-y-5">
        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 border border-stone-300 bg-white hover:bg-cream"
        >
          <GoogleIcon className="h-5 w-5" />
          <span>Continue with Google</span>
        </Button>

        <div className="relative my-2 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 font-semibold tracking-wider text-stone-400">
              or register with email
            </span>
          </div>
        </div>

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
      </div>
    </AuthShell>
  );
}
