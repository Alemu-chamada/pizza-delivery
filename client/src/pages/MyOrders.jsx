import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Badge } from '../components/common/UI';
import { OrderCard } from '../components/orders/OrderCard';
import { OrderScreenState } from '../components/orders/OrderScreenState';
import { useAuth } from '../context/AuthContext';
import * as ordersApi from '../api/orders.api';

export function MyOrders() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view");
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ordersApi.getMyOrders();
      const rawOrders = res?.data?.orders || (Array.isArray(res?.data) ? res.data : []);
      if (res?.success && rawOrders) {
        const formatted = rawOrders.map((order) => {
          const items = order.items || {};
          const configParts = [
            items.base?.name,
            items.sauce?.name,
            items.cheese?.name,
            ...(items.vegetables?.map((v) => v.name) || []),
          ].filter(Boolean);

          return {
            id: order._id,
            date: new Date(order.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            config: configParts.join(' · ') || 'Custom handcrafted pizza',
            total: order.totalPrice,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
          };
        });
        setOrders(formatted);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view) return;
    if (!authLoading) {
      if (isAuthenticated) {
        fetchOrders();
      } else {
        setLoading(false);
      }
    }
  }, [isAuthenticated, authLoading, view]);

  if (view) {
    return (
      <main className="bg-cream">
        <OrderScreenState type={view} onRetry={() => setParams({})} />
      </main>
    );
  }

  if (authLoading || loading) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="loading" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="unauthorized" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="error" onRetry={fetchOrders} />
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="empty" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Badge>
            <ShoppingBag size={13} /> Order history
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">My orders</h1>
          <p className="mt-3 text-stone-600">Every pizza you’ve created, all in one place.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-4 px-5 py-10 sm:px-8 lg:py-14">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </main>
  );
}
