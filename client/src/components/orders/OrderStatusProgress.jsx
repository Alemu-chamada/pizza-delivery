import React from 'react';
import { Check } from 'lucide-react';

export function OrderStatusProgress({ currentStep = 0 }) {
  const stages = ["Order Received", "In Kitchen", "Sent to Delivery"];

  return (
    <div className="relative">
      <div className="absolute left-4 top-5 h-[calc(100%-2.5rem)] w-0.5 bg-stone-200 sm:left-0 sm:top-4 sm:h-0.5 sm:w-full" />
      <div className="relative flex flex-col gap-7 sm:flex-row sm:justify-between sm:gap-4">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className="flex items-center gap-4 bg-white sm:flex-col sm:gap-3 sm:bg-transparent"
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ring-4 ring-white ${
                index < currentStep
                  ? "border-green-600 bg-green-600 text-white"
                  : index === currentStep
                  ? "border-tomato bg-tomato text-white"
                  : "border-stone-300 bg-white text-stone-400"
              }`}
            >
              {index < currentStep ? <Check size={15} /> : index + 1}
            </span>
            <div className="sm:text-center">
              <b className={`block text-sm ${index <= currentStep ? "text-ink" : "text-stone-400"}`}>
                {stage}
              </b>
              <span className="text-xs text-stone-400">
                {index < currentStep
                  ? "Completed"
                  : index === currentStep
                  ? "Current stage"
                  : "Upcoming"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
