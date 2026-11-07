// Seeded demo catalog with fictional stores. Swap for Channel3 product search when a key is available.
export type Product = {
  id: string;
  name: string;
  merchant: string;
  category: string;
  price: number;
  rating: number;
  tags: string[];
};

export const CATALOG: Product[] = [
  { id: "p01", name: "Copy paper, 500 sheets, letter", merchant: "Northside Office", category: "office", price: 8.99, rating: 4.6, tags: ["paper", "printer"] },
  { id: "p02", name: "Copy paper, 5 reams, letter", merchant: "Northside Office", category: "office", price: 39.5, rating: 4.7, tags: ["paper", "printer", "bulk"] },
  { id: "p03", name: "Dry-erase markers, 12 colors", merchant: "Northside Office", category: "office", price: 11.49, rating: 4.4, tags: ["markers", "whiteboard"] },
  { id: "p04", name: "Dry-erase markers, black, 4 pack", merchant: "Kiddo Supply", category: "school", price: 5.29, rating: 4.2, tags: ["markers", "whiteboard"] },
  { id: "p05", name: "Composition notebooks, 6 pack", merchant: "Kiddo Supply", category: "school", price: 12.99, rating: 4.8, tags: ["notebook", "school"] },
  { id: "p06", name: "No. 2 pencils, 24 pack", merchant: "Kiddo Supply", category: "school", price: 4.79, rating: 4.5, tags: ["pencil", "school"] },
  { id: "p07", name: "Washable glue sticks, 12 pack", merchant: "Kiddo Supply", category: "school", price: 6.49, rating: 4.6, tags: ["glue", "school", "craft"] },
  { id: "p08", name: "Kids backpack, 16 inch", merchant: "Kiddo Supply", category: "school", price: 34.99, rating: 4.3, tags: ["backpack", "school"] },
  { id: "p09", name: "Printer ink, black, high yield", merchant: "Northside Office", category: "office", price: 29.99, rating: 4.1, tags: ["ink", "printer"] },
  { id: "p10", name: "Sticky notes, 12 pads", merchant: "Northside Office", category: "office", price: 7.99, rating: 4.7, tags: ["sticky", "notes"] },
  { id: "p11", name: "Paper towels, 6 rolls", merchant: "Greenleaf Market", category: "household", price: 9.49, rating: 4.5, tags: ["paper towels", "cleaning"] },
  { id: "p12", name: "Dish soap, 3 pack", merchant: "Greenleaf Market", category: "household", price: 8.29, rating: 4.6, tags: ["soap", "kitchen", "cleaning"] },
  { id: "p13", name: "Coffee beans, 2 lb, medium roast", merchant: "Greenleaf Market", category: "groceries", price: 18.99, rating: 4.7, tags: ["coffee", "kitchen"] },
  { id: "p14", name: "Oat milk, 6 cartons", merchant: "Greenleaf Market", category: "groceries", price: 21.49, rating: 4.4, tags: ["milk", "kitchen"] },
  { id: "p15", name: "Wireless mouse", merchant: "Volt Electronics", category: "electronics", price: 24.99, rating: 4.3, tags: ["mouse", "computer"] },
  { id: "p16", name: "Noise-cancelling headphones", merchant: "Volt Electronics", category: "electronics", price: 179.0, rating: 4.6, tags: ["headphones", "audio"] },
  { id: "p17", name: "Video game, open-world adventure", merchant: "Volt Electronics", category: "games", price: 59.99, rating: 4.8, tags: ["game", "toys"] },
  { id: "p18", name: "Desk lamp, LED", merchant: "Northside Office", category: "office", price: 27.5, rating: 4.4, tags: ["lamp", "desk"] },
  { id: "p19", name: "Highlighters, 10 pack", merchant: "Kiddo Supply", category: "school", price: 5.99, rating: 4.5, tags: ["highlighter", "school"] },
  { id: "p20", name: "Laundry detergent, 64 loads", merchant: "Greenleaf Market", category: "household", price: 15.99, rating: 4.6, tags: ["laundry", "cleaning"] },
];

export function searchProducts(query: string, limit = 6): Product[] {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const scored = CATALOG.map((p) => {
    const hay = `${p.name} ${p.category} ${p.tags.join(" ")} ${p.merchant}`.toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) || hay.includes(w.replace(/s$/, "")) ? 1 : 0), 0);
    return { p, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
  return scored.slice(0, limit).map((x) => x.p);
}

export const getProduct = (id: string) => CATALOG.find((p) => p.id === id);
