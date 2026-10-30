export const HERO_IMAGE = "https://images.unsplash.com/photo-1513104890138-7c749659a591?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXp6YXxlbnwxfHx8fDE3OTI3NTI0MjV8MA&ixlib=rb-4.1.0&q=85&w=1600";

export const BUILDER_IMAGE = "https://images.unsplash.com/photo-1594007654729-407eedc4be65?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200";
export const VEGGIE_IMAGE = "https://images.unsplash.com/photo-1579150877125-53b49ce88315?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900";

export const builderOptions = {
  base: [
    { id: "classic", name: "Classic Hand-Tossed", description: "Airy edges, soft center, golden finish.", price: 8, image: HERO_IMAGE, available: true },
    { id: "thin", name: "Crispy Thin", description: "Light, crisp and made for topping lovers.", price: 9, image: "https://images.unsplash.com/photo-1581873372796-635b67ca2008?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900", available: true },
    { id: "sourdough", name: "Artisan Sourdough", description: "48-hour fermented with a tangy, chewy crumb.", price: 11, image: BUILDER_IMAGE, available: false },
  ],
  sauce: [
    { id: "marinara", name: "Slow-Roasted Marinara", description: "San Marzano tomatoes, garlic and oregano.", price: 2, image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900", available: true },
    { id: "bbq", name: "Smoky BBQ", description: "Sweet, smoky and gently spiced.", price: 2.5, image: "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900", available: true },
    { id: "pesto", name: "Basil Pesto", description: "Fresh basil, parmesan and toasted pine nuts.", price: 3, image: "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900", available: true },
  ],
  cheese: [
    { id: "mozzarella", name: "Fresh Mozzarella", description: "Milky, delicate and beautifully melty.", price: 3.5, image: HERO_IMAGE, available: true },
    { id: "cheddar", name: "Mature Cheddar", description: "Sharp, rich and deeply golden.", price: 3, image: BUILDER_IMAGE, available: true },
    { id: "vegan", name: "Plant-Based Melt", description: "Creamy dairy-free cheese alternative.", price: 4, image: "https://images.unsplash.com/photo-1581873372796-635b67ca2008?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900", available: false },
  ],
  vegetables: [
    { id: "mushrooms", name: "Mushrooms", description: "Earthy and oven-roasted.", price: 1.5, image: "https://images.unsplash.com/photo-1624633431700-b0912297c13a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=700", available: true },
    { id: "peppers", name: "Sweet Peppers", description: "Colorful, crisp and sweet.", price: 1.5, image: VEGGIE_IMAGE, available: true },
    { id: "onions", name: "Red Onions", description: "Thinly sliced with a sweet bite.", price: 1, image: VEGGIE_IMAGE, available: true },
    { id: "olives", name: "Black Olives", description: "Briny and full of flavor.", price: 1.25, image: "https://images.unsplash.com/photo-1608424406467-ff8e17a1498e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=700", available: true },
    { id: "jalapenos", name: "Jalapeños", description: "Bright heat with a tangy finish.", price: 1.25, image: VEGGIE_IMAGE, available: false },
  ],
};


export const defaultSelections = { base: "classic", sauce: "marinara", cheese: "mozzarella", vegetables: ["mushrooms", "peppers"] };
export const mockOrders = [
  { id: "DC-2841", date: "May 24, 2025 · 7:42 PM", config: "Classic Hand-Tossed · Slow-Roasted Marinara · Fresh Mozzarella · Mushrooms, Sweet Peppers", total: 16.5, paymentStatus: "Paid", orderStatus: "In Kitchen", step: 1 },
  { id: "DC-2719", date: "May 18, 2025 · 6:15 PM", config: "Crispy Thin · Basil Pesto · Mature Cheddar · Black Olives", total: 16.25, paymentStatus: "Paid", orderStatus: "Sent to Delivery", step: 2 },
  { id: "DC-2598", date: "May 02, 2025 · 8:03 PM", config: "Classic Hand-Tossed · Smoky BBQ · Fresh Mozzarella", total: 14, paymentStatus: "Refunded", orderStatus: "Order Received", step: 0 },
];


export const initialInventory = [
  { id: 1, ingredient: "Classic Hand-Tossed", category: "Base", stock: 42, threshold: 12, unit: "portions" },
  { id: 2, ingredient: "Artisan Sourdough", category: "Base", stock: 0, threshold: 8, unit: "portions" },
  { id: 3, ingredient: "Slow-Roasted Marinara", category: "Sauce", stock: 18, threshold: 20, unit: "litres" },
  { id: 4, ingredient: "Basil Pesto", category: "Sauce", stock: 26, threshold: 10, unit: "litres" },
  { id: 5, ingredient: "Fresh Mozzarella", category: "Cheese", stock: 15, threshold: 18, unit: "kg" },
  { id: 6, ingredient: "Mature Cheddar", category: "Cheese", stock: 31, threshold: 10, unit: "kg" },
  { id: 7, ingredient: "Mushrooms", category: "Vegetable", stock: 24, threshold: 12, unit: "kg" },
  { id: 8, ingredient: "Sweet Peppers", category: "Vegetable", stock: 8, threshold: 10, unit: "kg" },
];

export const adminOrdersSeed = [
  { ...mockOrders[0], customer: "Alex Morgan" },
  { ...mockOrders[1], customer: "Jamie Patel" },
  { ...mockOrders[2], customer: "Sam Rivera" },
];
