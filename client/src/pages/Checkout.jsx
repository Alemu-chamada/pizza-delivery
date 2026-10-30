import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CreditCard, ReceiptText, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card } from '../components/common/UI';
import { PizzaDetails } from '../components/builder/PizzaDetails';
import { useAuth } from '../context/AuthContext';

export function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const selections = location.state?.selections;
  const options = location.state?.options || { base: [], sauce: [], cheese: [], vegetables: [] };

  if (!selections || !selections.base || !selections.sauce || !selections.cheese) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-cream px-5 py-16 text-center">
        <Card className="max-w-md p-8">
          <ReceiptText className="mx-auto text-stone-400" size={44} />
          <h2 className="mt-5 font-display text-2xl font-bold">No pizza selected</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Please choose your base, sauce, cheese, and vegetables first.
          </p>
          <Link to="/build">
            <Button className="mt-6">Open Pizza Builder</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const selectedPrimary = ["base", "sauce", "cheese"].map((k) =>
    (options[k] || []).find((item) => item.id === selections[k])
  ).filter(Boolean);

  const selectedVegetables = (options.vegetables || []).filter((item) =>
    (selections.vegetables || []).includes(item.id)
  );

  const total = [...selectedPrimary, ...selectedVegetables].reduce(
    (sum, item) => sum + (Number(item.price) || 0),
    0
  );

  const handleProceedToPayment = () => {
    if (!isAuthenticated) {
      // Redirect to login with return path
      navigate('/login', { state: { returnTo: '/checkout', selections, options } });
      return;
    }
    navigate('/payment?state=creating', { state: { selections, total, options } });
  };

  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Badge>
            <ReceiptText size={13} /> Order summary
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">One last look.</h1>
          <p className="mt-3 text-stone-600">Review your pizza before moving to secure payment.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_23rem] lg:py-14">
        <Card className="overflow-hidden">
          <div className="relative h-52 sm:h-64">
            <img
              src="https://images.unsplash.com/photo-1608424406467-ff8e17a1498e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200"
              alt="Your custom pizza"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <h2 className="absolute bottom-5 left-6 font-display text-2xl font-bold text-white">
              Your custom pizza
            </h2>
          </div>
          <div className="p-6 sm:p-8">
            <PizzaDetails options={options} selections={selections} />
            <Link
              to="/build"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-tomato"
            >
              <ArrowLeft size={16} /> Edit pizza
            </Link>
          </div>
        </Card>

        <aside>
          <Card className="p-6 lg:sticky lg:top-28">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-tomato">
                <CreditCard size={21} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Payment summary</p>
                <h2 className="font-display text-xl font-bold">Amount due</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-y border-stone-200 py-5 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Pizza subtotal</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery</span>
                <span className="font-bold text-green-700">Free</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-6">
              <span className="font-bold">Total</span>
              <span className="font-display text-3xl font-bold text-tomato">
                ₹{total.toFixed(2)}
              </span>
            </div>

            <Button className="w-full" onClick={handleProceedToPayment}>
              Proceed to payment <ArrowRight size={17} />
            </Button>

            <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-stone-500">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-700" />
              <span>Payment is securely handled by Razorpay. No card details are stored here.</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-stone-500">
              Authoritative pricing and inventory availability will be verified by the backend.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
