import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CreditCard, Leaf, ShoppingBag } from 'lucide-react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { Card, StatusBadge, Loader, Button } from '../components/common/UI';
import * as adminApi from '../api/admin.api';

function inventoryStatus(item) {
  const stock = Number(item.stock ?? item.currentStock ?? 0);
  const threshold = Number(item.threshold ?? item.lowStockThreshold ?? 0);
  if (stock === 0) return { label: "Out of Stock", tone: "danger" };
  if (stock < threshold) return { label: "Low Stock", tone: "warning" };
  return { label: "Healthy", tone: "success" };
}

export function AdminOverview() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, invRes] = await Promise.all([
        adminApi.getAllOrders(),
        adminApi.getInventory(),
      ]);

      const ordersList = ordersRes?.data?.orders || (Array.isArray(ordersRes?.data) ? ordersRes.data : []);
      const inventoryList = invRes?.data?.items || invRes?.data?.inventory || (Array.isArray(invRes?.data) ? invRes.data : []);

      if (ordersRes?.success) {
        setOrders(ordersList);
      }
      if (invRes?.success) {
        setInventory(inventoryList);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load admin overview data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <AdminLayout
        title="Kitchen overview"
        subtitle="A clear view of today’s orders, revenue, and ingredients that need attention."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <div>
            <Loader />
            <h2 className="mt-5 font-display text-2xl font-bold">Loading dashboard</h2>
            <p className="mt-2 text-sm text-stone-500">Preparing the latest operational metrics…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout
        title="Kitchen overview"
        subtitle="A clear view of today’s orders, revenue, and ingredients that need attention."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <Card className="max-w-md p-8">
            <AlertCircle className="mx-auto text-red-600" size={44} />
            <h2 className="mt-5 font-display text-2xl font-bold">Couldn’t load overview</h2>
            <p className="mt-2 text-sm text-stone-500">{error}</p>
            <Button className="mt-6" onClick={fetchData}>
              Retry
            </Button>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // Calculate metrics
  const totalOrdersCount = orders.length;
  const paidOrders = orders.filter((o) => o.paymentStatus === 'Paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
  const lowStockItems = inventory.filter(
    (item) => Number(item.currentStock) < Number(item.lowStockThreshold)
  );

  const stats = [
    ["Total Orders", String(totalOrdersCount), ShoppingBag],
    ["Paid Revenue", `₹${totalRevenue.toFixed(2)}`, CreditCard],
    ["Inventory Items", String(inventory.length), Leaf],
    ["Low-Stock Items", String(lowStockItems.length), AlertCircle],
  ];

  const recentOrders = orders.slice(0, 5);

  return (
    <AdminLayout
      title="Kitchen overview"
      subtitle="A clear view of today’s orders, revenue, and ingredients that need attention."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  {label}
                </span>
                <div className="mt-3 font-display text-3xl font-bold">{value}</div>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-tomato">
                <Icon size={20} />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 p-6">
            <div>
              <h2 className="font-display text-2xl font-bold">Recent orders</h2>
              <p className="mt-1 text-sm text-stone-500">Latest activity across the kitchen.</p>
            </div>
            <Link to="/admin/orders" className="text-sm font-bold text-tomato">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-sm">No orders recorded yet.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {recentOrders.map((order) => {
                const items = order.items || {};
                const configParts = [
                  items.base?.name,
                  items.sauce?.name,
                  items.cheese?.name,
                  ...(items.vegetables?.map((v) => v.name) || []),
                ].filter(Boolean);
                const customerName = order.customer?.name || order.customer?.email || "Guest";

                return (
                  <div
                    key={order._id}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <b className="text-sm">
                        #{order._id} · {customerName}
                      </b>
                      <p className="mt-1 max-w-md truncate text-xs text-stone-500">
                        {configParts.join(' · ') || 'Custom pizza'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={order.paymentStatus === "Paid" ? "success" : "neutral"}>
                        {order.paymentStatus}
                      </StatusBadge>
                      <StatusBadge tone="warning">{order.orderStatus}</StatusBadge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Low-stock watchlist</h2>
              <p className="mt-1 text-sm text-stone-500">
                Ingredients at or below their low-stock threshold.
              </p>
            </div>
            <AlertCircle className="text-amber-600" />
          </div>
          {lowStockItems.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-green-50 p-4 text-xs font-semibold text-green-800">
              All inventory levels are currently healthy!
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {lowStockItems.map((item) => {
                const status = inventoryStatus(item);
                return (
                  <div key={item._id} className="rounded-2xl bg-stone-50 p-4">
                    <div className="flex justify-between gap-3">
                      <b className="text-sm">{item.name}</b>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      {item.currentStock} {item.unit || "units"} remaining · threshold{" "}
                      {item.lowStockThreshold}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
