import api from './axios';

export const createOrder = async ({ base, sauce, cheese, vegetables = [] }) => {
  const response = await api.post('/orders/create-order', {
    base,
    sauce,
    cheese,
    vegetables,
  });
  return response.data;
};

export const createChapaOrder = createOrder;

export const verifyPayment = async ({ txRef, orderId } = {}) => {
  const response = await api.post('/orders/verify-payment', {
    txRef,
    orderId,
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
