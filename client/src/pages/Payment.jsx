import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, Badge, Button, Loader, StatusBadge } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';
import * as ordersApi from '../api/orders.api';

const paymentStates = {
  creating: ["Creating checkout", "Connecting to Chapa secure test gateway."],
  redirecting: ["Redirecting to Chapa", "Opening Chapa secure test checkout."],
  verifying: ["Verifying payment", "Authoritatively confirming payment with Chapa."],
};

export function Payment() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const selections = location.state?.selections;
  const initialTotal = location.state?.total || 0;

  const txRefParam = params.get("tx_ref") || params.get("trx_ref") || params.get("txRef");
  const statusParam = params.get("status");

  const [activeTxRef, setActiveTxRef] = useState(
    txRefParam || sessionStorage.getItem('last_chapa_tx_ref') || ''
  );
  const [paymentState, setPaymentState] = useState(
    txRefParam ? "verifying" : (params.get("state") || "creating")
  );
  const [orderData, setOrderData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [total, setTotal] = useState(initialTotal);
  const [checkoutUrl, setCheckoutUrl] = useState("");

  const initAttempted = useRef(false);
  const verifyAttempted = useRef(false);

  const verifyWithBackend = async (customRef) => {
    const ref = customRef || txRefParam || activeTxRef;
    if (!ref) {
      setErrorMessage("No transaction reference available to verify.");
      setPaymentState("failed");
      return;
    }

    if (statusParam === "cancelled") {
      setPaymentState("cancelled");
      setErrorMessage("Payment was cancelled on Chapa checkout.");
      return;
    }

    setPaymentState("verifying");
    try {
      const verifyRes = await ordersApi.verifyPayment({ txRef: ref });
      if (verifyRes?.success && verifyRes?.data) {
        sessionStorage.removeItem('last_chapa_tx_ref');
        setOrderData({
          id: verifyRes.data.orderId,
          total: verifyRes.data.total,
        });
        setTotal(verifyRes.data.total);
        setPaymentState("success");
      } else {
        setErrorMessage(verifyRes?.message || "Payment verification failed with Chapa.");
        setPaymentState("failed");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "";
      if (msg.toLowerCase().includes('pending')) {
        // Payment is still pending on Chapa, remain in redirecting/waiting state
        setPaymentState("redirecting");
        setErrorMessage("Payment has not been completed yet on Chapa. Please complete it on the checkout page.");
        return;
      }
      setErrorMessage(
        msg || "Could not verify transaction with Chapa payment gateway."
      );
      setPaymentState("failed");
    }
  };

  // 1. Handle return from Chapa with transaction reference
  useEffect(() => {
    if (!txRefParam) return;
    if (verifyAttempted.current) return;
    verifyAttempted.current = true;

    verifyWithBackend(txRefParam);
  }, [txRefParam, statusParam]);

  // 2. Handle initial checkout creation
  useEffect(() => {
    // If we're verifying a return, skip creation
    if (txRefParam) return;

    const queryState = params.get("state");
    if (queryState && queryState !== "creating") {
      setPaymentState(queryState);
      return;
    }

    if (!selections) {
      if (paymentState !== "success" && paymentState !== "failed" && paymentState !== "cancelled") {
        setErrorMessage("No active checkout session. Please build your pizza first.");
        setPaymentState("failed");
      }
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { state: { returnTo: "/checkout" } });
      return;
    }

    if (initAttempted.current) return;
    initAttempted.current = true;

    async function launchChapaCheckout() {
      try {
        setPaymentState("creating");
        const res = await ordersApi.createOrder({
          base: selections.base,
          sauce: selections.sauce,
          cheese: selections.cheese,
          vegetables: selections.vegetables || [],
        });

        if (!res?.success || !res?.data) {
          throw new Error(res?.message || "Failed to initialize order with Chapa");
        }

        const { amount, checkoutUrl: chapaUrl, orderId, txRef } = res.data;
        setTotal(amount || initialTotal);
        setCheckoutUrl(chapaUrl);
        if (txRef) {
          setActiveTxRef(txRef);
          sessionStorage.setItem('last_chapa_tx_ref', txRef);
        }

        if (chapaUrl) {
          setPaymentState("redirecting");
          // Try opening Chapa hosted checkout in a new window/tab to keep this verification page active
          const popup = window.open(chapaUrl, '_blank');
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            // If popup was blocked by browser, redirect in same window
            window.location.href = chapaUrl;
          }
        } else {
          throw new Error("No checkout URL returned by Chapa.");
        }
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.message
          || err?.message
          || "Could not initialize Chapa checkout."
        );
        setPaymentState("failed");
      }
    }

    launchChapaCheckout();
  }, [selections, isAuthenticated, params, txRefParam, navigate, initialTotal, paymentState]);

  // 3. Poll payment status while user completes payment on Chapa hosted page
  useEffect(() => {
    if (paymentState !== "redirecting" || !activeTxRef) return;

    const interval = setInterval(async () => {
      try {
        const verifyRes = await ordersApi.verifyPayment({ txRef: activeTxRef });
        if (verifyRes?.success && verifyRes?.data) {
          clearInterval(interval);
          sessionStorage.removeItem('last_chapa_tx_ref');
          setOrderData({
            id: verifyRes.data.orderId,
            total: verifyRes.data.total,
          });
          setTotal(verifyRes.data.total);
          setPaymentState("success");
        }
      } catch {
        // Still pending or network lag, continue polling
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [paymentState, activeTxRef]);

  if (paymentState === "success") {
    return (
      <PaymentResult
        success
        total={orderData?.total || total}
        orderReference={orderData?.id || "ORD-" + Date.now()}
      />
    );
  }

  if (paymentState === "failed" || paymentState === "cancelled") {
    return (
      <PaymentResult
        success={false}
        cancelled={paymentState === "cancelled"}
        total={total}
        errorMessage={errorMessage}
        selections={selections}
      />
    );
  }

  const content = paymentStates[paymentState] || paymentStates.creating;

  return (
    <main className="grid min-h-[75vh] place-items-center bg-cream px-5 py-16">
      <Card className="w-full max-w-lg p-7 text-center sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-tomato">
          <Loader />
        </span>
        <div className="mt-4">
          <Badge>Chapa Secure Checkout · Test Mode</Badge>
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold">{content[0]}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{content[1]}</p>

        {checkoutUrl && paymentState === "redirecting" && (
          <div className="mt-6 flex flex-col gap-3">
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2">
                Open Chapa Checkout <ExternalLink size={16} />
              </Button>
            </a>
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => verifyWithBackend(activeTxRef)}
            >
              <RefreshCw size={16} /> I have completed payment on Chapa
            </Button>
          </div>
        )}

        {errorMessage && paymentState === "redirecting" && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            {errorMessage}
          </p>
        )}

        <div className="mt-7 rounded-2xl bg-stone-50 p-4 text-left text-xs leading-5 text-stone-500">
          Payment is authoritatively processed in Ethiopian Birr (ETB) through Chapa Test Gateway.
          Please complete your simulation on the Chapa hosted page.
        </div>
      </Card>
    </main>
  );
}

function PaymentResult({ success, cancelled, total, orderReference, errorMessage, selections }) {
  return (
    <main className="grid min-h-[75vh] place-items-center bg-cream px-5 py-16">
      <Card className="w-full max-w-xl overflow-hidden text-center">
        <div className={`px-7 py-9 ${success ? "bg-green-50" : "bg-red-50"}`}>
          <span
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full bg-white shadow-sm ${
              success ? "text-green-600" : "text-red-600"
            }`}
          >
            {success ? <CheckCircle2 size={42} /> : <AlertCircle size={42} />}
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold">
            {success
              ? "Payment successful"
              : cancelled
              ? "Payment cancelled"
              : "Payment unsuccessful"}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {success
              ? "Your pizza order has been verified with Chapa and received by the kitchen."
              : cancelled
              ? "No charge was made. You can return whenever you’re ready."
              : errorMessage || "We couldn’t confirm your payment with Chapa. No order was placed."}
          </p>
        </div>

        {success ? (
          <div className="p-7 sm:p-8">
            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-stone-50 p-5 text-left">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Order reference
                </span>
                <b className="mt-1 block truncate">#{orderReference}</b>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Total
                </span>
                <b className="mt-1 block">{Number(total).toFixed(2)} ETB</b>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Payment
                </span>
                <div className="mt-2">
                  <StatusBadge tone="success">Paid via Chapa</StatusBadge>
                </div>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Order status
                </span>
                <div className="mt-2">
                  <StatusBadge tone="warning">Order Received</StatusBadge>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link className="flex-1" to={`/orders/${orderReference}`}>
                <Button className="w-full">Track order</Button>
              </Link>
              <Link className="flex-1" to="/orders">
                <Button variant="secondary" className="w-full">
                  My orders
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-7 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="flex-1"
                to="/payment?state=creating"
                state={{ selections, total }}
              >
                <Button className="w-full">Try again</Button>
              </Link>
              <Link className="flex-1" to="/checkout" state={{ selections }}>
                <Button variant="secondary" className="w-full">
                  Return to order summary
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
