import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Pencil, ReceiptText, X } from 'lucide-react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { Card, Input, Button, StatusBadge, Badge, Toast, Loader } from '../components/common/UI';
import * as adminApi from '../api/admin.api';

function inventoryStatus(item) {
  const stock = Number(item.stock ?? item.currentStock ?? 0);
  const threshold = Number(item.threshold ?? item.lowStockThreshold ?? 0);
  if (stock === 0) return { label: "Out of Stock", tone: "danger" };
  if (stock < threshold) return { label: "Low Stock", tone: "warning" };
  return { label: "Healthy", tone: "success" };
}

function StockUpdateModal({ item, onClose, onSave }) {
  const [quantity, setQuantity] = useState(String(item.stock));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const value = Number(quantity);
    if (quantity === "" || Number.isNaN(value) || value < 0) {
      setError("Enter a quantity of zero or greater.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSave(item.id, value);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update stock quantity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <Badge>Update stock</Badge>
            <h2 className="mt-4 font-display text-2xl font-bold">{item.ingredient}</h2>
            <p className="mt-2 text-sm text-stone-500">
              Current quantity: <b>{item.stock} {item.unit}</b>
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 hover:bg-stone-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-6">
          <Input
            label={`New quantity (${item.unit})`}
            type="number"
            min="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={error}
          />
        </div>
        <div className="mt-7 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Save stock
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function AdminInventory() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getInventory();
      const rawList = res?.data?.items || res?.data?.inventory || (Array.isArray(res?.data) ? res.data : []);
      if (res?.success && rawList) {
        const formatted = rawList.map((item) => {
          const rawCat = (item.category || "General").toLowerCase();
          const capCat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
          return {
            id: item._id,
            ingredient: item.name,
            category: capCat,
            stock: item.currentStock,
            threshold: item.lowStockThreshold,
            unit: item.unit || "units",
          };
        });
        setItems(formatted);
      } else {
        setError("Failed to load inventory items.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view) return;
    fetchInventory();
  }, [view]);

  if (view === "loading" || (loading && !view)) {
    return (
      <AdminLayout
        title="Inventory"
        subtitle="Manage ingredient availability using item-specific stock thresholds."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <div>
            <Loader />
            <h2 className="mt-5 font-display text-2xl font-bold">Loading inventory items</h2>
            <p className="mt-2 text-sm text-stone-500">Preparing the latest stock levels…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (view === "error" || error) {
    return (
      <AdminLayout
        title="Inventory"
        subtitle="Manage ingredient availability using item-specific stock thresholds."
      >
        <div className="grid min-h-[45vh] place-items-center text-center">
          <Card className="max-w-md p-8">
            <AlertCircle className="mx-auto text-red-600" size={44} />
            <h2 className="mt-5 font-display text-2xl font-bold">Couldn’t load inventory</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {error || "The request was interrupted. Try loading this view again."}
            </p>
            <Button className="mt-6" onClick={() => (view ? setParams({}) : fetchInventory())}>
              Retry
            </Button>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const handleSaveStock = async (itemId, newStock) => {
    const res = await adminApi.updateInventoryItem(itemId, newStock);
    if (res?.success) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, stock: newStock } : it))
      );
      setEditing(null);
      setToast("Stock level updated successfully.");
    }
  };

  const filteredItems = items.filter(
    (item) =>
      (category === "All" || item.category.toLowerCase() === category.toLowerCase()) &&
      item.ingredient.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout
      title="Inventory"
      subtitle="Manage ingredient availability using item-specific stock thresholds."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Input
          label="Search ingredients"
          placeholder="Search by name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="block space-y-2 text-sm font-semibold">
          Category
          <select
            aria-label="Filter inventory by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="block h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold outline-none focus:border-tomato"
          >
            <option>All</option>
            <option>Base</option>
            <option>Sauce</option>
            <option>Cheese</option>
            <option>Vegetable</option>
          </select>
        </label>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
              <tr>
                {["Ingredient", "Category", "Current Stock", "Threshold", "Unit", "Status", ""].map(
                  (label) => (
                    <th key={label} className="px-5 py-4 font-bold">
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredItems.map((item) => {
                const status = inventoryStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-stone-50/70">
                    <td className="px-5 py-4 font-bold">{item.ingredient}</td>
                    <td className="px-5 py-4">{item.category}</td>
                    <td className="px-5 py-4 font-bold">{item.stock}</td>
                    <td className="px-5 py-4 text-stone-500">{item.threshold}</td>
                    <td className="px-5 py-4 text-stone-500">{item.unit}</td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="secondary" onClick={() => setEditing(item)}>
                        <Pencil size={14} /> Update
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-stone-100 md:hidden">
          {filteredItems.map((item) => {
            const status = inventoryStatus(item);
            return (
              <div key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b>{item.ingredient}</b>
                    <p className="mt-1 text-xs text-stone-500">{item.category}</p>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-stone-50 p-3 text-xs">
                  <div>
                    <span className="text-stone-400">Stock</span>
                    <b className="mt-1 block">{item.stock}</b>
                  </div>
                  <div>
                    <span className="text-stone-400">Threshold</span>
                    <b className="mt-1 block">{item.threshold}</b>
                  </div>
                  <div>
                    <span className="text-stone-400">Unit</span>
                    <b className="mt-1 block">{item.unit}</b>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => setEditing(item)}
                >
                  <Pencil size={14} /> Update stock
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {editing && (
        <StockUpdateModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveStock}
        />
      )}
      <Toast message={toast} onClose={() => setToast("")} />
    </AdminLayout>
  );
}
