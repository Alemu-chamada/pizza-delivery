import React from 'react';
import { Check } from 'lucide-react';

export function PizzaOptionCard({ option, selected, onSelect, multiple = false }) {
  return (
    <button
      type="button"
      onClick={() => option.available && onSelect(option.id)}
      disabled={!option.available}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-3xl border-2 bg-white text-left shadow-sm transition-all ${
        selected
          ? "border-tomato shadow-lg shadow-red-900/10"
          : "border-transparent hover:-translate-y-1 hover:border-stone-200 hover:shadow-lg"
      } ${!option.available ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={option.image}
          alt={option.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {selected && (
          <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-tomato text-white shadow-lg">
            <Check size={18} />
          </span>
        )}
        {!option.available && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">
            Out of Stock
          </span>
        )}
        {multiple && option.available && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-stone-700 backdrop-blur">
            Optional
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{option.name}</h3>
            <p className="mt-2 text-sm leading-5 text-stone-500">{option.description}</p>
          </div>
          <span className="whitespace-nowrap text-sm font-bold text-tomato">
            +₹{Number(option.price).toFixed(2)}
          </span>
        </div>
      </div>
    </button>
  );
}
