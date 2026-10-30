import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, PackageCheck } from 'lucide-react';
import { Card, Button, Badge } from '../common/UI';

export function ActiveOrder({ order }) {
  if (!order) {
    return (
      <Card className="flex flex-col items-center p-8 text-center sm:p-10">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-stone-100 text-stone-500">
          <PackageCheck size={25} />
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold">No active orders</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">
          When your next pizza is in the oven, its latest status will appear right here.
        </p>
        <Link to="/build" className="mt-6">
          <Button variant="secondary">Create a pizza</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-2">
            <Badge>
              <Clock size={13} /> Active order
            </Badge>
            <span className="text-xs font-semibold text-stone-500">#{order.id}</span>
          </div>
          <h3 className="mt-4 font-display text-2xl font-bold">{order.status || order.orderStatus}</h3>
          <p className="mt-2 text-sm text-stone-600">{order.description || order.config}</p>
        </div>
        <div className="rounded-2xl bg-cream px-5 py-4 text-center">
          <span className="block text-xs font-bold uppercase tracking-wider text-stone-500">
            Estimated arrival
          </span>
          <b className="mt-1 block font-display text-2xl text-ink">{order.eta || "20-30 min"}</b>
        </div>
      </div>
      <div className="border-t border-stone-100 bg-stone-50 px-6 py-5 sm:px-8">
        <div className="flex items-center">
          {["Order Received", "In Kitchen", "Sent to Delivery"].map((label, index) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${
                    index <= order.step
                      ? "border-tomato bg-tomato text-white"
                      : "border-stone-300 bg-white text-stone-400"
                  }`}
                >
                  {index < order.step ? <Check size={14} /> : index + 1}
                </span>
                <span className="hidden whitespace-nowrap text-[11px] font-bold text-stone-500 sm:block">
                  {label}
                </span>
              </div>
              {index < 2 && (
                <span
                  className={`mb-5 h-0.5 flex-1 ${index < order.step ? "bg-tomato" : "bg-stone-200"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
