import React from 'react';

export function PizzaDetails({
  options = { base: [], sauce: [], cheese: [], vegetables: [] },
  selections = { base: null, sauce: null, cheese: null, vegetables: [] },
  showPrices = true,
}) {
  const groups = [
    ["Base", (options.base || []).find((item) => item.id === selections.base)],
    ["Sauce", (options.sauce || []).find((item) => item.id === selections.sauce)],
    ["Cheese", (options.cheese || []).find((item) => item.id === selections.cheese)],
  ];
  const vegetables = (options.vegetables || []).filter((item) =>
    (selections.vegetables || []).includes(item.id)
  );

  return (
    <div className="divide-y divide-stone-100">
      {groups.map(([label, item]) => (
        <div key={label} className="flex items-center justify-between gap-5 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</span>
            <p className="mt-1 font-semibold text-ink">{item?.name || "Not selected"}</p>
          </div>
          {showPrices && item && (
            <span className="font-bold text-stone-700">₹{Number(item.price).toFixed(2)}</span>
          )}
        </div>
      ))}
      <div className="flex items-start justify-between gap-5 py-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Vegetables</span>
          <p className="mt-1 font-semibold text-ink">
            {vegetables.length ? vegetables.map((item) => item.name).join(", ") : "None"}
          </p>
        </div>
        {showPrices && (
          <span className="font-bold text-stone-700">
            ₹{vegetables.reduce((sum, item) => sum + (Number(item.price) || 0), 0).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
