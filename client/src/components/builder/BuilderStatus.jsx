import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, RefreshCw, X } from 'lucide-react';
import { Card, Button, Loader, Skeleton } from '../common/UI';

export function BuilderStatus({ type, onRetry }) {
  if (type === "loading") {
    return (
      <div className="mx-auto min-h-[60vh] max-w-5xl px-5 py-14 text-center">
        <Loader />
        <h2 className="mt-5 font-display text-2xl font-bold">Preparing fresh options</h2>
        <p className="mt-2 text-sm text-stone-600">Checking today’s ingredients and availability…</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-3xl bg-white p-4 text-left">
              <Skeleton className="aspect-[16/10] w-full" />
              <Skeleton className="mt-4 h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="grid min-h-[60vh] place-items-center px-5 text-center">
        <Card className="max-w-md p-8">
          <X className="mx-auto rounded-full bg-red-100 p-3 text-red-600" size={52} />
          <h2 className="mt-5 font-display text-2xl font-bold">We couldn’t load ingredients</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Something interrupted the menu. Try again to reload today’s options.
          </p>
          <Button onClick={onRetry} className="mt-6">
            <RefreshCw size={16} /> Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-[60vh] place-items-center px-5 text-center">
      <Card className="max-w-md p-8">
        <Leaf className="mx-auto text-stone-400" size={44} />
        <h2 className="mt-5 font-display text-2xl font-bold">No options available today</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Our kitchen is refreshing the ingredient list. Please check back shortly.
        </p>
        <Link to="/dashboard">
          <Button variant="secondary" className="mt-6">Back to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
