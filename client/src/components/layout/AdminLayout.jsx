import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '../common/UI';

export function AdminLayout({ children, title, subtitle }) {
  const location = useLocation();
  const tabs = [
    ["/admin", "Overview"],
    ["/admin/inventory", "Inventory"],
    ["/admin/orders", "Orders"],
  ];

  return (
    <main className="min-h-screen bg-stone-100">
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-5 pb-0 pt-10 sm:px-8 sm:pt-14">
          <Badge>Admin portal</Badge>
          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-display text-4xl font-bold sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">{subtitle}</p>
            </div>
          </div>
          <nav className="mt-9 flex gap-1 overflow-x-auto">
            {tabs.map(([to, label]) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`whitespace-nowrap rounded-t-xl px-5 py-3 text-sm font-bold ${
                    active ? "bg-stone-100 text-ink" : "text-stone-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</div>
    </main>
  );
}
