import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { Card, Input, Button, StatusBadge, Toast, Loader } from '../components/common/UI';
import * as adminApi from '../api/admin.api';

export function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirming, setConfirming] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const statuses = ["Order Received", "In Kitchen", "Sent to Delivery"];

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAllOrders();
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

          const step =
            order.orderStatus === 'Sent to Delivery'
              ? 2
              : order.orderStatus === 'In Kitchen'
              ? 1
              : 0;

          return {
            id: order._id,
            customer: order.customer?.name || order.customer?.email || "Customer",
            date: new Date(order.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            config: configParts.join(' · ') || 'Custom pizza',
            total: order.totalPrice,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            step,
          };
        });
        setOrders(formatted);
      } else {
        setError("Failed to load orders.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching admin orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view) return;
    fetchOrders();
  }, [view]);

  if (view === "loading" || (loading && !view)) {
    return (
      <AdminLayout
        title="Orders"
        subtitle="Monitor paid orders and move them through the kitchen workflow."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <div>
            <Loader />
            <h2 className="mt-5 font-display text-2xl font-bold">Loading orders</h2>
            <p className="mt-2 text-sm text-stone-500">Retrieving operational order queue…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (view === "error" || error) {
    return (
      <AdminLayout
        title="Orders"
        subtitle="Monitor paid orders and move them through the kitchen workflow."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <Card className="max-w-md p-8">
            <AlertCircle className="mx-auto text-red-600" size={44} />
            <h2 className="mt-5 font-display text-2xl font-bold">Couldn’t load orders</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {error || "The request was interrupted. Try loading this view again."}
            </p>
            <Button className="mt-6" onClick={() => (view ? setParams({}) : fetchOrders())}>
              Retry
            </Button>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const advance = async () => {
    if (!confirming || confirming.step >= 2) return;
    const nextStatus = statuses[confirming.step + 1];
    setUpdating(true);
    try {
      const res = await adminApi.updateOrderStatus(confirming.id, nextStatus);
      if (res?.success) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === confirming.id
              ? { ...order, step: confirming.step + 1, orderStatus: nextStatus }
              : order
          )
        );
        setConfirming(null);
        setToast(`Order #${confirming.id} updated to ${nextStatus}.`);
      } else {
        setToast("Failed to update order status.");
      }
    } catch (err) {
      setToast(err?.response?.data?.message || "Error updating order status.");
    } finally {
      setUpdating(false);
    }
  };

  const filteredOrders = orders.filter(
    (order) =>
      (status === "All" || order.orderStatus === status) &&
      `${order.customer} ${order.id}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout
      title="Orders"
      subtitle="Monitor paid orders and move them through the kitchen workflow."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input
          label="Search orders"
          placeholder="Customer or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="block space-y-2 text-sm font-semibold">
          Order status
          <select
            aria-label="Filter orders by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="block h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold outline-none focus:border-tomato"
          >
            <option>All</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card className="p-8 text-center text-stone-500">
            No orders found matching the filter criteria.
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr_auto] xl:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    #{order.id}
                  </span>
                  <h3 className="mt-1 font-display text-xl font-bold">{order.customer}</h3>
                  <p className="mt-1 text-xs text-stone-500">{order.date}</p>
                </div>
                <div>
                  <p className="text-sm leading-6 text-stone-600">{order.config}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mr-2 font-bold">₹{Number(order.total).toFixed(2)}</span>
                    <span className="text-xs text-stone-400">Payment</span>
                    <StatusBadge tone={order.paymentStatus === "Paid" ? "success" : "neutral"}>
                      {order.paymentStatus}
                    </StatusBadge>
                    <span className="ml-2 text-xs text-stone-400">Order</span>
                    <StatusBadge tone="warning">{order.orderStatus}</StatusBadge>
                  </div>
                </div>
                <Button
                  disabled={order.step >= 2}
                  onClick={() => setConfirming(order)}
                >
                  {order.step >= 2 ? "Final stage" : "Advance status"}
                  {order.step < 2 && <ArrowRight size={15} />}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm">
          <Card className="w-full max-w-md p-7 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">Confirm status update</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Move order <b>#{confirming.id}</b> from <b>{confirming.orderStatus}</b> to{" "}
              <b>{statuses[confirming.step + 1]}</b>?
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirming(null)} disabled={updating}>
                Cancel
              </Button>
              <Button loading={updating} onClick={advance}>
                Confirm update
              </Button>
            </div>
          </Card>
        </div>
      )}
      <Toast message={toast} onClose={() => setToast("")} />
    </AdminLayout>
  );
}
