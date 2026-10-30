import React from 'react';
import { Card, Badge } from '../common/UI';

export function AuthShell({ title, subtitle, children, badgeText = "Welcome to Dough & Co." }) {
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-cream px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <Badge>{badgeText}</Badge>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">{subtitle}</p>
        </div>
        <Card className="mt-8 p-6 sm:p-8">{children}</Card>
      </div>
    </main>
  );
}
