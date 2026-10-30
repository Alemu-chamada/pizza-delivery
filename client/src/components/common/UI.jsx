import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Pizza,
  ShieldCheck,
  X,
} from 'lucide-react';

export function Logo({ light = false }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="Dough & Co home">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-tomato text-white shadow-sm transition-transform group-hover:-rotate-6">
        <Pizza size={21} />
      </span>
      <span className={`font-display text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Dough <i className="not-italic text-tomato">&</i> Co.
      </span>
    </Link>
  );
}

export function Button({ children, variant = "primary", className = "", loading, ...props }) {
  const styles = variant === "secondary"
    ? "border border-stone-300 bg-white text-ink hover:border-stone-400 hover:bg-cream"
    : variant === "ghost"
    ? "text-ink hover:bg-stone-100"
    : "bg-tomato text-white shadow-lg shadow-red-900/15 hover:-translate-y-0.5 hover:bg-red-700";
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${styles} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader small />}
      {children}
    </button>
  );
}

export function Input({ label, error, icon: Icon, className = "", ...props }) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-ink">
      {label}
      <span className="relative block">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />}
        <input
          className={`h-12 w-full rounded-xl border bg-white px-4 text-sm font-medium text-ink outline-none transition placeholder:text-stone-400 focus:border-tomato focus:ring-4 focus:ring-red-100 ${Icon ? "pl-11" : ""} ${error ? "border-red-400" : "border-stone-200"} ${className}`}
          {...props}
        />
      </span>
      {error && <span className="block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function PasswordInput({ label, value, onChange, error, placeholder = "Enter your password" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        value={value}
        onChange={onChange}
        error={error}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className="pr-12"
      />
      <button
        type="button"
        className="absolute right-3 top-9 p-1 text-stone-400 hover:text-ink"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-stone-200/80 bg-white shadow-soft ${className}`}>{children}</div>;
}

export function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-tomato">
      {children}
    </span>
  );
}

export function Alert({ children, type = "error" }) {
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {type === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
      <span>{children}</span>
    </div>
  );
}

export function Loader({ small = false }) {
  return (
    <span
      className={`${small ? "h-4 w-4" : "h-8 w-8"} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`}
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className = "" }) {
  return <span className={`block animate-pulse rounded-2xl bg-stone-200 ${className}`} aria-hidden="true" />;
}

export function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-2xl"
    >
      <CheckCircle2 size={18} className="text-green-400" />
      {message}
      <button onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel, loading = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <Card className="w-full max-w-md p-7 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700">
          <AlertCircle />
        </span>
        <h2 id="confirm-title" className="mt-5 font-display text-2xl font-bold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
        <div className="mt-7 flex justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Card>
    </div>
  );
}

export function StatusBadge({ children, tone = "neutral" }) {
  const tones = {
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-800",
    danger: "bg-red-100 text-red-700",
    neutral: "bg-stone-100 text-stone-700",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}
