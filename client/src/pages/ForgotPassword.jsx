import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Input, Button, Alert } from '../components/common/UI';
import * as authApi from '../api/auth.api';

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      // Backend contract might return 200 or an error, handle gracefully
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we’ll help you get back into your account."
    >
      {sent ? (
        <div className="space-y-5">
          <Alert type="success">
            If an account exists for that email, we’ve sent password reset instructions. For your privacy, we can’t confirm whether the address is registered.
          </Alert>
          <Link to="/login">
            <Button variant="secondary" className="mt-3 w-full">
              Back to login
            </Button>
          </Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <Input
            label="Email address"
            placeholder="alex@example.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button className="w-full" loading={loading}>
            Send reset link
          </Button>
          <Link className="block text-center text-sm font-bold text-tomato" to="/login">
            Back to login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
