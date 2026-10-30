import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, Badge, StatusBadge } from '../components/common/UI';
import { OrderStatusProgress } from '../components/orders/OrderStatusProgress';
import { OrderScreenState } from '../components/orders/OrderScreenState';
import * as ordersApi from '../api/orders.api';

export function OrderTracking() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const view = params.get("view");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await ordersApi.getOrderStatus(id);
      if (res?.success && res.data) {
        const data = res.data;
        const step =
          data.orderStatus === 'Sent to Delivery'
            ? 2
            : data.orderStatus === 'In Kitchen'
            ? 1
            : 0;

        const items = data.items || {};
        const configParts = [
          items.base?.name,
          items.sauce?.name,
          items.cheese?.name,
          ...(items.vegetables?.map((v) => v.name) || []),
        ].filter(Boolean);

        setOrder({
          id: data.orderId || id,
          date: new Date(data.createdAt || Date.now()).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          config: configParts.join(' · ') || 'Custom handcrafted pizza',
          total: data.totalAmount || data.totalPrice || 0,
          paymentStatus: data.paymentStatus || 'Paid',
          orderStatus: data.orderStatus || 'Order Received',
          step,
        });
        setError(null);
      } else {
        if (isInitial) setError('Order not found');
      }
    } catch (err) {
      if (isInitial) {
        setError(err?.response?.data?.message || 'Error tracking order');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    if (view) return;
    fetchStatus(true);

    // 5-second polling interval for real-time tracking
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [id, view]);

  if (view) {
    return (
      <main className="bg-cream">
        <OrderScreenState type={view} onRetry={() => setParams({})} />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="loading" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="bg-cream">
        <OrderScreenState type="error" onRetry={() => fetchStatus(true)} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-tomato"
          >
            <ArrowLeft size={16} /> Back to orders
          </Link>
          <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <Badge>Live order status</Badge>
              <h1 className="mt-4 font-display text-4xl font-bold">Track order #{order.id}</h1>
              <p className="mt-3 text-stone-600">{order.date}</p>
            </div>
            <div className="flex gap-3">
              <div>
                <span className="text-xs font-bold text-stone-400">PAYMENT</span>
                <div className="mt-2">
                  <StatusBadge tone={order.paymentStatus === "Paid" ? "success" : "neutral"}>
                    {order.paymentStatus}
                  </StatusBadge>
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-stone-400">ORDER STATUS</span>
                <div className="mt-2">
                  <StatusBadge tone="warning">{order.orderStatus}</StatusBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_20rem] lg:py-14">
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-tomato">Order journey</p>
            <div className="mt-8">
              <OrderStatusProgress currentStep={order.step} />
            </div>
          </Card>
          <Card className="p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Pizza summary</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">{order.config}</p>
          </Card>
        </div>

        <Card className="h-fit p-6 lg:sticky lg:top-28">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Order total
          </span>
          <div className="mt-2 font-display text-4xl font-bold text-tomato">
            ₹{Number(order.total).toFixed(2)}
          </div>
          <div className="mt-6 border-t border-stone-200 pt-5 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Reference</span>
              <b className="truncate max-w-[10rem]">{order.id}</b>
            </div>
            <div className="mt-3 flex justify-between">
              <span className="text-stone-500">Payment</span>
              <b>{order.paymentStatus}</b>
            </div>
          </div>
          <p className="mt-6 rounded-xl bg-stone-50 p-4 text-xs leading-5 text-stone-500">
            This page automatically updates every 5 seconds as the kitchen prepares and dispatches your order.
          </p>
        </Card>
      </div>
    </main>
  );
}
