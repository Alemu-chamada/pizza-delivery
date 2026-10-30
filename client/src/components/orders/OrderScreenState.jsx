import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Card, Button, Loader } from '../common/UI';

export function OrderScreenState({ type, onRetry }) {
  const content = {
    loading: ["Loading your orders", "Fetching your latest order history."],
    empty: ["No orders yet", "Your first custom pizza is only a few clicks away."],
    unauthorized: ["Please log in", "You need to be signed in to view your orders."],
    error: ["Orders couldn’t be loaded", "Something interrupted the request. Please try again."],
  }[type] || ["Loading", "Please wait..."];

  if (type === "loading") {
    return (
      <div className="grid min-h-[55vh] place-items-center text-center">
        <div>
          <Loader />
          <h2 className="mt-5 font-display text-2xl font-bold">{content[0]}</h2>
          <p className="mt-2 text-sm text-stone-600">{content[1]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[55vh] place-items-center px-5 text-center">
      <Card className="max-w-md p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stone-100 text-stone-500">
          {type === "unauthorized" ? (
            <ShieldCheck />
          ) : type === "error" ? (
            <AlertCircle />
          ) : (
            <ShoppingBag />
          )}
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">{content[0]}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{content[1]}</p>
        {type === "empty" ? (
          <Link to="/build">
            <Button className="mt-6">Build Your First Pizza</Button>
          </Link>
        ) : type === "unauthorized" ? (
          <Link to="/login">
            <Button className="mt-6">Log in</Button>
          </Link>
        ) : (
          <Button onClick={onRetry} className="mt-6">
            <RefreshCw size={16} /> Retry
          </Button>
        )}
      </Card>
    </div>
  );
}
