import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, RotateCw, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Button, Alert, Input, Loader } from '../components/common/UI';
import * as authApi from '../api/auth.api';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const tokenParam = params.get('token');
  const emailParam = params.get('email') || location.state?.email || '';
  const initialMessage = location.state?.message || '';
  const initialPreviewCode = location.state?.previewCode || '';

  const [email, setEmail] = useState(emailParam);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(initialMessage);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [previewCode, setPreviewCode] = useState(initialPreviewCode);

  const inputRefs = useRef([]);

  // Handle countdown timer for resend code
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Backward compatibility: If a legacy verification token is passed in query params
  useEffect(() => {
    if (!tokenParam) return;

    let isMounted = true;
    async function verifyToken() {
      setLoading(true);
      setError('');
      try {
        const res = await authApi.verifyEmail(tokenParam);
        if (isMounted) {
          if (res?.success) {
            setVerified(true);
          } else {
            setError(res?.message || 'Invalid or expired verification link.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message || 'This verification link is invalid or has expired.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [tokenParam]);

  // Handle single digit input
  const handleDigitChange = (index, value) => {
    // Only accept numeric characters
    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length > 1) {
      // Pasted multiple digits
      handlePaste(cleanValue);
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanValue;
    setDigits(newDigits);
    setError('');

    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all digits are filled, automatically submit
    if (cleanValue && index === 5 && newDigits.every((d) => d !== '')) {
      submitCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (pastedText) => {
    const numericChars = pastedText.replace(/\D/g, '').slice(0, 6).split('');
    if (!numericChars.length) return;

    const newDigits = [...digits];
    numericChars.forEach((ch, i) => {
      newDigits[i] = ch;
    });
    setDigits(newDigits);
    setError('');

    const nextIndex = Math.min(numericChars.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (newDigits.every((d) => d !== '')) {
      submitCode(newDigits.join(''));
    }
  };

  const submitCode = async (fullCode) => {
    const code = fullCode || digits.join('');
    if (!email.trim()) {
      setError('Please provide the email address used during registration.');
      return;
    }
    if (code.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await authApi.verifyCode({
        email: email.trim().toLowerCase(),
        code,
      });

      if (res?.success) {
        setVerified(true);
      } else {
        setError(res?.message || 'Verification failed. Please check the code.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Invalid or expired verification code. Please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address to resend the code.');
      return;
    }

    setResending(true);
    setError('');
    setInfo('');

    try {
      const res = await authApi.resendCode(email.trim().toLowerCase());
      if (res?.success) {
        setInfo('A new 6-digit verification code has been dispatched to your inbox.');
        if (res?.data?.previewCode) {
          setPreviewCode(res.data.previewCode);
        }
        setDigits(['', '', '', '', '', '']);
        setCooldown(60);
        inputRefs.current[0]?.focus();
      } else {
        setError(res?.message || 'Could not resend code. Please try again.');
      }
    } catch (err) {
      const remaining = err?.response?.data?.remainingSeconds;
      if (remaining) {
        setCooldown(remaining);
      }
      setError(
        err?.response?.data?.message || 'Could not resend verification code. Please try again later.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code sent to your email to activate your account."
    >
      {verified ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">Account Verified!</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Your email has been successfully verified. You are now ready to log in and order handcrafted pizza.
          </p>
          <div className="mt-6">
            <Button
              className="w-full"
              onClick={() => navigate('/login', { state: { email } })}
            >
              Continue to Login <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {error && <Alert type="error">{error}</Alert>}
          {info && <Alert type="info">{info}</Alert>}

          {previewCode && (
            <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold">Verification Code:</span>
                <span className="rounded bg-amber-200/90 px-2 py-0.5 font-mono text-sm font-extrabold tracking-widest text-amber-950">
                  {previewCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handlePaste(previewCode)}
                className="font-bold text-tomato hover:text-red-700 underline transition-colors"
              >
                Auto-fill
              </button>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder-stone-400 focus:border-tomato focus:outline-none focus:ring-2 focus:ring-tomato/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600 text-center">
              6-Digit Verification Code
            </label>
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={(e) => {
              e.preventDefault();
              handlePaste(e.clipboardData.getData('text'));
            }}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-13 w-11 sm:h-14 sm:w-12 rounded-xl border-2 border-stone-200 bg-stone-50/50 text-center font-display text-2xl font-bold text-ink transition-all focus:border-tomato focus:bg-white focus:outline-none focus:ring-4 focus:ring-tomato/10"
                  autoFocus={index === 0}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-stone-500">
              Valid for 15 minutes. Single-use numeric code.
            </p>
          </div>

          <Button
            className="w-full"
            loading={loading}
            onClick={() => submitCode()}
            disabled={digits.some((d) => !d) || loading}
          >
            <ShieldCheck size={18} className="mr-1.5" />
            Verify Account
          </Button>

          <div className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                cooldown > 0
                  ? 'text-stone-400 cursor-not-allowed'
                  : 'text-tomato hover:text-tomato-hover hover:underline'
              }`}
            >
              <RotateCw size={13} className={resending ? 'animate-spin' : ''} />
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'}
            </button>

            <Link to="/login" className="text-xs font-semibold text-stone-500 hover:text-ink">
              Back to Login
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
