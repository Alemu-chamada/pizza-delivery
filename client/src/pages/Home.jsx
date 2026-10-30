import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Flame, Leaf, PackageCheck, Pizza, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, Badge, Button } from '../components/common/UI';
import { HERO_IMAGE } from '../data/mockData';

const benefits = [
  [Leaf, "Fresh ingredients", "Garden-fresh produce and premium toppings, prepared daily."],
  [Pizza, "Made entirely yours", "Every layer, from the base to the finish, is your decision."],
  [ShieldCheck, "Secure checkout", "A smooth, protected checkout built for peace of mind."],
  [PackageCheck, "Easy tracking", "Follow your pizza from our oven all the way to your door."],
];

export function Home() {
  return (
    <main>
      <section className="relative overflow-hidden bg-cream">
        <div className="absolute -left-24 top-36 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
          <div className="relative z-10">
            <Badge>
              <Flame size={14} /> Made fresh, delivered hot
            </Badge>
            <h1 className="mt-7 max-w-2xl font-display text-5xl font-bold leading-[.98] tracking-tight text-ink sm:text-6xl xl:text-7xl">
              Your pizza.<br />
              <span className="text-tomato">Your masterpiece.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
              Choose every layer, add every craving, and we’ll handcraft a pizza that’s unmistakably yours.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/build">
                <Button className="w-full sm:w-auto">
                  Build your pizza <ArrowRight size={17} />
                </Button>
              </Link>
              <a href="#how">
                <Button variant="secondary" className="w-full sm:w-auto">
                  See how it works
                </Button>
              </a>
            </div>
            <div className="mt-10 flex items-center gap-4 text-sm text-stone-600">
              <div className="flex -space-x-2">
                {["AM", "JP", "SK"].map((x) => (
                  <span
                    key={x}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-cream bg-stone-800 text-[10px] font-bold text-white"
                  >
                    {x}
                  </span>
                ))}
              </div>
              <span>
                <b className="text-ink">4.9/5</b> from 2,000+ pizza lovers
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-8 rounded-full bg-tomato/10 blur-2xl" />
            <img
              className="relative aspect-square w-full rotate-2 rounded-[3rem] object-cover shadow-2xl shadow-stone-900/20 transition duration-700 hover:rotate-0"
              src={HERO_IMAGE}
              alt="Fresh margherita pizza with tomatoes and rosemary"
            />
            <Card className="absolute -bottom-5 left-2 flex items-center gap-3 p-3.5 sm:left-[-1rem]">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-green-100 text-green-700">
                <Check size={20} />
              </span>
              <span className="pr-3 text-sm">
                <b className="block text-ink">Ready in 20 min</b>
                <span className="text-stone-500">Fresh from the oven</span>
              </span>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge>Why Dough & Co.</Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              Better pizza starts with better choices.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([Icon, title, text]) => (
              <Card key={title} className="group p-6 transition hover:-translate-y-1 hover:shadow-xl">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-tomato transition group-hover:bg-tomato group-hover:text-white">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <Badge>Built layer by layer</Badge>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Make it yours,<br />
              one delicious choice at a time.
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-stone-400">
              Start with the foundations. Then stack flavors, textures and all your favorites until it feels just right.
            </p>
            <Link to="/build" className="mt-8 inline-block">
              <Button>
                Start creating <ArrowRight size={17} />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              ["01", "Base", "Classic hand-tossed crust"],
              ["02", "Sauce", "Slow-roasted tomato sauce"],
              ["03", "Cheese", "Fresh creamy mozzarella"],
              ["04", "Vegetables", "Basil, mushroom, olives & peppers"],
            ].map(([n, t, d], i) => (
              <div
                key={t}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:translate-x-1 ${
                  i === 3 ? "border-tomato bg-tomato/10" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="font-display text-sm font-bold text-tomato">{n}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                  <Pizza size={20} />
                </span>
                <span className="flex-1">
                  <b className="block">{t}</b>
                  <small className="text-stone-400">{d}</small>
                </span>
                <CheckCircle2 className={i === 3 ? "text-tomato" : "text-stone-600"} size={20} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <Badge>Simple by design</Badge>
            <h2 className="mt-5 font-display text-4xl font-bold text-ink sm:text-5xl">From craving to doorstep.</h2>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              ["1", "Create your pizza", "Pick your base, sauce, cheese and toppings."],
              ["2", "Place your order", "Review your masterpiece and check out securely."],
              ["3", "Follow the journey", "Track it live from our oven to your front door."],
            ].map(([n, t, d]) => (
              <div key={n} className="text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-tomato font-display text-xl font-bold text-white shadow-lg shadow-red-900/20">
                  {n}
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-ink">{t}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-stone-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-tomato px-5 py-20 text-center text-white">
        <Sparkles className="mx-auto" />
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-bold sm:text-5xl">
          Your perfect pizza is waiting.
        </h2>
        <p className="mt-4 text-red-100">Big flavor. Your rules. Let’s make something delicious.</p>
        <Link to="/build" className="mt-8 inline-block">
          <Button variant="secondary">
            Build your pizza <ArrowRight size={17} />
          </Button>
        </Link>
      </section>
    </main>
  );
}
