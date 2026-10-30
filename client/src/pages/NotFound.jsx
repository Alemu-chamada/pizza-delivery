import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pizza } from 'lucide-react';
import { Button } from '../components/common/UI';

export function NotFound() {
  return (
    <main className="relative grid min-h-[70vh] place-items-center overflow-hidden bg-cream px-5 py-16 text-center">
      <span className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="relative max-w-xl">
        <span className="font-display text-8xl font-bold text-tomato/15 sm:text-9xl">404</span>
        <Pizza className="mx-auto -mt-10 text-tomato" size={52} />
        <h1 className="mt-5 font-display text-4xl font-bold sm:text-5xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-stone-600">
          This slice seems to have gone missing. Let’s get you back to something delicious.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button variant="secondary" className="w-full">
              Go home
            </Button>
          </Link>
          <Link to="/build">
            <Button className="w-full">
              Build a pizza <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
