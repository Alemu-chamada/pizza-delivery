import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Pizza, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Toast } from '../components/common/UI';
import { PizzaOptionCard } from '../components/builder/PizzaOptionCard';
import { OrderSummary } from '../components/builder/OrderSummary';
import { BuilderStatus } from '../components/builder/BuilderStatus';
import { useAuth } from '../context/AuthContext';
import * as pizzaApi from '../api/pizza.api';

export function PizzaBuilder() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("view");
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({ base: [], sauce: [], cheese: [], vegetables: [] });

  const steps = ["Base", "Sauce", "Cheese", "Vegetables", "Summary"];
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [selections, setSelections] = useState({
    base: null,
    sauce: null,
    cheese: null,
    vegetables: [],
  });
  const [toast, setToast] = useState("");

  const loadOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pizzaApi.getAllPizzaOptions();
      const rawList = res?.data?.options || (Array.isArray(res?.data) ? res.data : []);
      if (res?.success && rawList.length > 0) {
        const grouped = {
          base: [],
          sauce: [],
          cheese: [],
          vegetables: [],
        };
        rawList.forEach((item) => {
          const category = item.category?.toLowerCase();
          const targetKey = category === 'vegetable' ? 'vegetables' : category;
          if (grouped[targetKey]) {
            grouped[targetKey].push({
              id: item._id,
              name: item.name,
              description: item.description,
              price: item.basePrice,
              image: item.imageUrl,
              available: item.isAvailable,
            });
          }
        });

        // Set default selection if none chosen yet
        setOptions(grouped);
        setSelections((prev) => ({
          base: prev.base || grouped.base.find((b) => b.available)?.id || null,
          sauce: prev.sauce || grouped.sauce.find((s) => s.available)?.id || null,
          cheese: prev.cheese || grouped.cheese.find((c) => c.available)?.id || null,
          vegetables: prev.vegetables || [],
        }));
      } else {
        setError("Failed to load pizza ingredients");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load pizza options");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode) return;
    if (!authLoading) {
      if (isAuthenticated) {
        loadOptions();
      } else {
        setLoading(false);
      }
    }
  }, [isAuthenticated, authLoading, mode]);

  if (mode) {
    return (
      <main className="bg-cream">
        <BuilderStatus type={mode} onRetry={() => setParams({})} />
      </main>
    );
  }

  if (authLoading || (loading && isAuthenticated)) {
    return (
      <main className="bg-cream">
        <BuilderStatus type="loading" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-[65vh] place-items-center bg-cream px-5 py-16 text-center">
        <Card className="max-w-md p-8">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-tomato">
            <Pizza size={30} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold">Sign in to customize</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Please log in or create an account to browse today’s ingredients and build your custom pizza.
          </p>
          <Link to="/login" state={{ returnTo: "/build" }}>
            <Button className="mt-6">Log in to continue</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-cream">
        <BuilderStatus type="error" onRetry={loadOptions} />
      </main>
    );
  }

  const hasAnyOptions =
    options.base.length > 0 ||
    options.sauce.length > 0 ||
    options.cheese.length > 0 ||
    options.vegetables.length > 0;

  if (!hasAnyOptions) {
    return (
      <main className="bg-cream">
        <BuilderStatus type="empty" />
      </main>
    );
  }

  const key = ["base", "sauce", "cheese", "vegetables"][step];
  const canContinue = step === 3 || step === 4 || Boolean(selections[key]);

  const select = (id) => {
    if (key === "vegetables") {
      setSelections({
        ...selections,
        vegetables: selections.vegetables.includes(id)
          ? selections.vegetables.filter((item) => item !== id)
          : [...selections.vegetables, id],
      });
    } else {
      setSelections({ ...selections, [key]: id });
    }
  };

  const next = () => {
    if (step < 4) {
      setStep(step + 1);
      setMaxStep(Math.max(maxStep, step + 1));
      window.scrollTo(0, 0);
    } else {
      navigate("/checkout", { state: { selections, options } });
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <Badge>
                <Sparkles size={13} /> Pizza studio
              </Badge>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
                Build your masterpiece.
              </h1>
              <p className="mt-3 text-sm text-stone-600">Choose each layer. Make every bite yours.</p>
            </div>
            <span className="text-sm font-bold text-stone-500">
              Step {step + 1} of {steps.length}
            </span>
          </div>

          <div className="mt-9 flex items-start">
            {steps.map((label, index) => (
              <div key={label} className="flex flex-1 items-start last:flex-none">
                <button
                  type="button"
                  disabled={index > maxStep}
                  onClick={() => index <= maxStep && setStep(index)}
                  className="group flex flex-col items-center gap-2"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold transition ${
                      index === step
                        ? "border-tomato bg-tomato text-white ring-4 ring-red-100"
                        : index < step
                        ? "border-tomato bg-white text-tomato"
                        : "border-stone-300 bg-white text-stone-400"
                    }`}
                  >
                    {index < step ? <Check size={15} /> : index + 1}
                  </span>
                  <span
                    className={`hidden whitespace-nowrap text-xs font-bold sm:block ${
                      index === step ? "text-tomato" : "text-stone-500"
                    }`}
                  >
                    {label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <span
                    className={`mt-4 h-0.5 flex-1 ${index < step ? "bg-tomato" : "bg-stone-200"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky top-20 z-20 border-b border-stone-200 bg-cream/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-2xl">
          <OrderSummary options={options} selections={selections} compact />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_21rem] lg:py-14">
        <section>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-tomato">
              {step === 3
                ? "Optional — choose any combination"
                : step === 4
                ? "Review your creation"
                : "Choose one option"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              {step === 4
                ? "Everything look delicious?"
                : `Select your ${steps[step].toLowerCase()}`}
            </h2>
            {step === 3 && (
              <p className="mt-2 text-sm text-stone-600">
                Add as many as you like, or skip this step entirely.{" "}
                <b className="ml-1 text-ink">{selections.vegetables.length} selected</b>
              </p>
            )}
          </div>

          {step < 4 ? (
            <div
              className={`grid gap-5 ${
                step === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"
              }`}
            >
              {(options[key] || []).map((option) => (
                <PizzaOptionCard
                  key={option.id}
                  option={option}
                  multiple={step === 3}
                  selected={
                    step === 3
                      ? selections.vegetables.includes(option.id)
                      : selections[key] === option.id
                  }
                  onSelect={select}
                />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1608424406467-ff8e17a1498e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200"
                alt="Finished vegetable pizza"
                className="h-64 w-full object-cover sm:h-80"
              />
              <div className="p-6 sm:p-8">
                <Badge>Creation complete</Badge>
                <h3 className="mt-4 font-display text-3xl font-bold">Your custom pizza</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  A one-of-a-kind combination, built exactly to your taste. Continue when you’re ready to review your order.
                </p>
              </div>
            </Card>
          )}

          <div className="mt-10 flex items-center justify-between gap-4">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(Math.max(0, step - 1));
                window.scrollTo(0, 0);
              }}
              disabled={step === 0}
            >
              <ArrowLeft size={17} /> Back
            </Button>
            <Button onClick={next} disabled={!canContinue}>
              {step === 3 ? "Review pizza" : step === 4 ? "Order summary" : "Continue"}{" "}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <OrderSummary options={options} selections={selections} />
          </div>
        </aside>
      </div>
      <Toast message={toast} onClose={() => setToast("")} />
    </main>
  );
}
