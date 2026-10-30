import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ReceiptText } from 'lucide-react';
import { Card, Button, StatusBadge } from '../common/UI';

export function OrderCard({ order }) {
  const getStatusTone = (status) => {
    switch (status) {
      case 'Paid':
        return 'success';
      case 'Sent to Delivery':
        return 'success';
      case 'In Kitchen':
        return 'warning';
      case 'Order Received':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-40 items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-tomato">
            <ReceiptText size={20} />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Order</span>
            <h3 className="font-bold">#{order.id}</h3>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <CalendarDays size={14} />
            {order.date}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-stone-700">{order.config}</p>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:w-[25rem]">
          <div>
            <span className="text-xs text-stone-400">Total</span>
            <b className="mt-1 block">₹{Number(order.total).toFixed(2)}</b>
          </div>
          <div>
            <span className="text-xs text-stone-400">Payment</span>
            <div className="mt-1">
              <StatusBadge tone={getStatusTone(order.paymentStatus)}>
                {order.paymentStatus}
              </StatusBadge>
            </div>
          </div>
          <div>
            <span className="text-xs text-stone-400">Order status</span>
            <div className="mt-1">
              <StatusBadge tone={getStatusTone(order.orderStatus)}>
                {order.orderStatus}
              </StatusBadge>
            </div>
          </div>
        </div>
        <Link to={`/orders/${order.id}`}>
          <Button variant="secondary" className="w-full lg:w-auto">
            Track order <ArrowRight size={15} />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
