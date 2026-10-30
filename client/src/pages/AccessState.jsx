import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Card, Button } from '../components/common/UI';

export function AccessState({ type = "login" }) {
  const states = {
    login: {
      title: "Sign in to continue",
      message: "Log in to view your account, orders and saved pizza activity.",
      action: "Go to login",
      to: "/login",
    },
    forbidden: {
      title: "Administrator access required",
      message: "This area is restricted to accounts with the administrator role.",
      action: "Admin sign in",
      to: "/admin/login",
    },
    expired: {
      title: "Your session has expired",
      message: "For your security, please log in again to continue.",
      action: "Login again",
      to: "/login",
    },
  };

  const state = states[type] || states.login;

  return (
    <main className="grid min-h-[65vh] place-items-center bg-cream px-5 py-16 text-center">
      <Card className="max-w-md p-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-tomato">
          <ShieldCheck size={30} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold">{state.title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{state.message}</p>
        <Link to={state.to}>
          <Button className="mt-6">{state.action}</Button>
        </Link>
      </Card>
    </main>
  );
}
