import api from './axios';

export const getAllPizzaOptions = async () => {
  const response = await api.get('/pizza-options');
  return response.data;
};

export const getPizzaOptionsByCategory = async (category) => {
  const response = await api.get(`/pizza-options/${encodeURIComponent(category)}`);
  return response.data;
};
