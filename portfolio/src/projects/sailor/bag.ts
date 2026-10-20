import { flavourById, formatById, roadTripBox } from "./data";

export interface BagLine {
  /** flavour id, or "road-trip" for the mixed box */
  product: string;
  /** format id; the mixed box has a single format "box" */
  format: string;
  qty: number;
}

export const FREE_SHIPPING_FROM = 40;
export const SHIPPING = 6;
export const MAX_QTY = 20;

export function lineKey(l: Pick<BagLine, "product" | "format">) {
  return `${l.product}:${l.format}`;
}

export function unitPrice(l: Pick<BagLine, "product" | "format">): number {
  if (l.product === roadTripBox.id) return roadTripBox.price;
  return formatById(l.format)?.price ?? 0;
}

export function lineName(l: Pick<BagLine, "product" | "format">) {
  if (l.product === roadTripBox.id) return { name: roadTripBox.name, detail: roadTripBox.detail };
  const f = flavourById(l.product);
  const fmt = formatById(l.format);
  return { name: f?.name ?? l.product, detail: fmt ? `${fmt.name} · ${fmt.detail}` : "" };
}

export function addLine(bag: BagLine[], add: BagLine): BagLine[] {
  const key = lineKey(add);
  const existing = bag.find((l) => lineKey(l) === key);
  if (existing) {
    return bag.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + add.qty) } : l));
  }
  return [...bag, { ...add, qty: Math.min(MAX_QTY, Math.max(1, add.qty)) }];
}

export function setQty(bag: BagLine[], key: string, qty: number): BagLine[] {
  if (qty <= 0) return bag.filter((l) => lineKey(l) !== key);
  return bag.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l));
}

export function totals(bag: BagLine[]) {
  const subtotal = bag.reduce((sum, l) => sum + unitPrice(l) * l.qty, 0);
  const items = bag.reduce((n, l) => n + l.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
  const toFree = subtotal > 0 && subtotal < FREE_SHIPPING_FROM ? FREE_SHIPPING_FROM - subtotal : 0;
  return { subtotal, items, shipping, total: subtotal + shipping, toFree };
}

export const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`;
