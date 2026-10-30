import React from 'react';
import { ChevronDown, Pizza } from 'lucide-react';
import { Card } from '../common/UI';

export function OrderSummary({ options = { base: [], sauce: [], cheese: [], vegetables: [] }, selections, compact = false }) {
  const selectedItems = ["base", "sauce", "cheese"].map((key) =>
    (options[key] || []).find((item) => item.id === selections[key])
  ).filter(Boolean);

  const selectedVegetables = (options.vegetables || []).filter((item) =>
    (selections.vegetables || []).includes(item.id)
  );

  const total = [...selectedItems, ...selectedVegetables].reduce(
    (sum, item) => sum + (Number(item.price) || 0),
    0
  );

  const content = (
    <>
      <div className="space-y-4">
        {[
          ["Base", selectedItems[0]],
          ["Sauce", selectedItems[1]],
          ["Cheese", selectedItems[2]],
        ].map(([label, item]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-stone-500">{label}</span>
            <span className="text-right font-bold text-ink">{item?.name || "Not selected"}</span>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 text-sm">
          <span className="text-stone-500">Vegetables</span>
          <span className="max-w-[11rem] text-right font-bold text-ink">
            {selectedVegetables.length
              ? selectedVegetables.map((item) => item.name).join(", ")
              : "None"}
          </span>
        </div>
      </div>
      <div className="mt-6 border-t border-stone-200 pt-5">
        <div className="flex items-center justify-between">
          <span className="font-bold">Estimated price</span>
          <span className="font-display text-2xl font-bold text-tomato">₹{total.toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          Final pricing and availability will be confirmed by the kitchen.
        </p>
      </div>
    </>
  );

  if (compact) {
    return (
      <details className="group rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
          Your pizza so far <ChevronDown className="transition group-open:rotate-180" size={18} />
        </summary>
        <div className="mt-5">{content}</div>
      </details>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-tomato">
          <Pizza size={20} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Live summary</p>
          <h2 className="font-display text-xl font-bold">Your pizza</h2>
        </div>
      </div>
      {content}
    </Card>
  );
}
