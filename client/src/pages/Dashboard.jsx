import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, ShoppingBag } from 'lucide-react';
import { Card, Badge, Button } from '../components/common/UI';
import { ActiveOrder } from '../components/orders/ActiveOrder';
import { BUILDER_IMAGE } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import * as ordersApi from '../api/orders.api';

export function Dashboard() {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadActiveOrder() {
      try {
        const res = await ordersApi.getMyOrders();
        const ordersList = res?.data?.orders || (Array.isArray(res?.data) ? res.data : []);
        if (mounted && res?.success && ordersList.length > 0) {
          // Find most recent order that is active
          const active = ordersList.find(
            (o) => o.orderStatus === 'Order Received' || o.orderStatus === 'In Kitchen'
          );
          if (active) {
            const step = active.orderStatus === 'Order Received' ? 0 : 1;
            const items = active.items || {};
            const configParts = [
              items.base?.name,
              items.sauce?.name,
              items.cheese?.name,
              ...(items.vegetables?.map((v) => v.name) || []),
            ].filter(Boolean);

            setActiveOrder({
              id: active._id,
              status:
                active.orderStatus === 'In Kitchen'
                  ? 'Your pizza is in the oven'
                  : 'Order received by the kitchen',
              description: configParts.join(' · ') || 'Custom handcrafted pizza',
              eta: active.orderStatus === 'In Kitchen' ? '12–18 min' : '20–25 min',
              step,
            });
          }
        }
      } catch (err) {
        // graceful fallback if not logged in or network error
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadActiveOrder();
    return () => {
      mounted = false;
    };
  }, []);

  const userName = user?.name ? user.name.split(' ')[0] : 'Pizza Lover';

  return (
    <main className="bg-cream">
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-y-0 right-0 w-full opacity-25 lg:w-1/2">
          <img src={BUILDER_IMAGE} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-ink via-ink/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <Badge>Welcome back, {userName}</Badge>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-bold tracking-tight sm:text-6xl">
            What are we making tonight?
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-stone-300">
            Your next masterpiece starts with fresh dough and a craving. We’ll handle the rest.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/build">
              <Button className="w-full sm:w-auto">
                Build your pizza <ArrowRight size={17} />
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="secondary" className="w-full sm:w-auto">
                <ShoppingBag size={17} /> My orders
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-tomato">Live from the kitchen</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Your active order</h2>
          </div>
          <Link to="/orders" className="hidden text-sm font-bold text-tomato sm:block">
            View all orders
          </Link>
        </div>

        <ActiveOrder order={activeOrder} />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Card className="group relative min-h-64 overflow-hidden p-7 text-white lg:col-span-2">
            <img
              src="https://images.unsplash.com/photo-1649798964218-27a2f8abe4a1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200"
              alt="Vegetable pizza on a wooden board"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
            <div className="relative max-w-sm">
              <Badge>Make it yours</Badge>
              <h3 className="mt-5 font-display text-3xl font-bold">
                Start with fresh. Finish with unforgettable.
              </h3>
              <Link to="/build" className="mt-6 inline-block">
                <Button>Open pizza builder</Button>
              </Link>
            </div>
          </Card>
          <Card className="flex flex-col justify-between p-7">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green-100 text-green-700">
              <Leaf size={22} />
            </span>
            <div>
              <h3 className="mt-8 font-display text-2xl font-bold">Fresh today</h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Mushrooms, sweet bell peppers, olives and basil arrived from our local partners this morning.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
