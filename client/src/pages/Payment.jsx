import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Button, Loader, StatusBadge } from '../components/common/UI';
import { useAuth } from '../context/AuthContext';
import * as ordersApi from '../api/orders.api';

const paymentStates = {
  creating: ["Creating checkout", "Preparing your secure payment session."],
  opening: ["Opening payment window", "Razorpay will open in a secure window."],
  processing: ["Processing payment", "Your payment is being processed securely."],
  verifying: ["Verifying payment", "Confirming the payment with the order system."],
};

export function Payment() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const selections = location.state?.selections;
  const initialTotal = location.state?.total || 0;

  const [paymentState, setPaymentState] = useState(params.get("state") || "creating");
  const [orderData, setOrderData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [total, setTotal] = useState(initialTotal);

  const initAttempted = useRef(false);

  useEffect(() => {
    // If state was directly set in query param (for preview tests), respect it
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

    async function launchCheckout() {
      try {
        setPaymentState("creating");
        const res = await ordersApi.createRazorpayOrder({
          base: selections.base,
          sauce: selections.sauce,
          cheese: selections.cheese,
          vegetables: selections.vegetables || [],
        });

        if (!res?.success || !res?.data) {
          throw new Error(res?.message || "Failed to create order");
        }

        const { razorpayOrderId, amount, currency, orderId } = res.data;
        const keyId = res.data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder';
        setTotal(amount ? amount / 100 : initialTotal);

        if (!window.Razorpay) {
          throw new Error("Razorpay SDK not loaded. Please refresh and try again.");
        }

        setPaymentState("opening");

        const options = {
          key: keyId,
          amount: amount,
          currency: currency || "INR",
          name: "Dough & Co.",
          description: "Custom Handcrafted Pizza",
          order_id: razorpayOrderId,
          handler: async function (response) {
            setPaymentState("verifying");
            try {
              const verifyRes = await ordersApi.verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (verifyRes.success) {
                const verifiedOrder = verifyRes.data?.order;
                setOrderData({
                  id: verifiedOrder?._id || orderId,
                  total: verifiedOrder?.totalPrice || (amount / 100),
                });
                setPaymentState("success");
              } else {
                setErrorMessage(verifyRes.message || "Payment verification failed.");
                setPaymentState("failed");
              }
            } catch (err) {
              setErrorMessage(
                err?.response?.data?.message || "Error verifying payment signature."
              );
              setPaymentState("failed");
            }
          },
          modal: {
            ondismiss: function () {
              setPaymentState("cancelled");
            },
          },
          prefill: {
            name: user?.name || "Customer",
            email: user?.email || "",
          },
          theme: {
            color: "#c2410c",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (failResponse) {
          setErrorMessage(failResponse?.error?.description || "Payment failed");
          setPaymentState("failed");
        });
        rzp.open();
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.message || err?.message || "Could not initialize checkout"
        );
        setPaymentState("failed");
      }
    }

    launchCheckout();
  }, [selections, isAuthenticated, params]);

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
          <Badge>{paymentState === "opening" ? "Secure Razorpay" : "Secure checkout"}</Badge>
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold">{content[0]}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{content[1]}</p>
        <div className="mt-7 rounded-2xl bg-stone-50 p-4 text-left text-xs leading-5 text-stone-500">
          Keep this page open while your secure Razorpay payment session is prepared and verified.
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
              ? "Your pizza order has been received by the kitchen."
              : cancelled
              ? "No charge was made. You can return whenever you’re ready."
              : errorMessage || "We couldn’t confirm your payment. No order was placed."}
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
                <b className="mt-1 block">₹{Number(total).toFixed(2)}</b>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Payment
                </span>
                <div className="mt-2">
                  <StatusBadge tone="success">Paid</StatusBadge>
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
