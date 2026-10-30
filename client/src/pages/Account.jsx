import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Card, Badge, Button, ConfirmDialog } from '../components/common/UI';
import { AccessState } from './AccessState';
import { useAuth } from '../context/AuthContext';

export function Account() {
  const { user, logout, isAuthenticated } = useAuth();
  const [confirm, setConfirm] = useState(false);

  if (!isAuthenticated || !user) {
    return <AccessState type="login" />;
  }

  const initial = user.name ? user.name.slice(0, 1).toUpperCase() : "U";

  return (
    <main className="min-h-[70vh] bg-cream px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Badge>
          <User size={13} /> Account
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Your profile</h1>
        <p className="mt-3 text-stone-600">
          Account information supplied by your verified session.
        </p>

        <Card className="mt-8 overflow-hidden">
          <div className="flex flex-col gap-5 bg-ink p-6 text-white sm:flex-row sm:items-center sm:p-8">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-tomato text-xl font-bold">
              {initial}
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">{user.name}</h2>
              <p className="mt-1 text-sm text-stone-400">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Full name
              </span>
              <p className="mt-2 font-semibold">{user.name}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Email address
              </span>
              <p className="mt-2 break-all font-semibold">{user.email}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Account role
              </span>
              <p className="mt-2 font-semibold capitalize">{user.role}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Authentication
              </span>
              <p className="mt-2 font-semibold">Secure httpOnly cookie session</p>
            </div>
          </div>

          <div className="border-t border-stone-100 p-6 sm:px-8">
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              Log out
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Log out of your account?"
        message="You’ll need to sign in again to access saved orders and account details."
        confirmLabel="Log out"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          logout();
        }}
      />
    </main>
  );
}
