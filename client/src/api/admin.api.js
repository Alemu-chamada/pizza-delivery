import api from './axios';

export const getInventory = async () => {
  const response = await api.get('/admin/inventory');
  return response.data;
};

export const updateInventoryItem = async (itemId, currentStock) => {
  const response = await api.patch(`/admin/inventory/${itemId}`, { currentStock: Number(currentStock) });
  return response.data;
};

export const getAllOrders = async () => {
  const response = await api.get('/admin/orders');
  return response.data;
};

export const updateOrderStatus = async (orderId, orderStatus) => {
  const response = await api.patch(`/admin/orders/${orderId}/status`, { orderStatus });
  return response.data;
};
