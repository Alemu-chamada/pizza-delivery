import api from './axios';

export const createRazorpayOrder = async ({ base, sauce, cheese, vegetables = [] }) => {
  const response = await api.post('/orders/create-razorpay-order', {
    base,
    sauce,
    cheese,
    vegetables,
  });
  return response.data;
};

export const verifyPayment = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const response = await api.post('/orders/verify-payment', {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return response.data;
};

export const getMyOrders = async () => {
  const response = await api.get('/orders/my-orders');
  return response.data;
};

export const getOrderStatus = async (orderId) => {
  const response = await api.get(`/orders/${orderId}/status`);
  return response.data;
};
