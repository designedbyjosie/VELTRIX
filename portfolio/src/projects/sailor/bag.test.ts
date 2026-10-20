import { describe, expect, it } from "vitest";
import { addLine, setQty, totals, lineKey, MAX_QTY } from "./bag";

describe("Sailor Springs bag", () => {
  it("merges the same flavour and format into one line", () => {
    let bag = addLine([], { product: "low-tide", format: "4", qty: 1 });
    bag = addLine(bag, { product: "low-tide", format: "4", qty: 2 });
    expect(bag).toHaveLength(1);
    expect(bag[0].qty).toBe(3);
  });

  it("keeps different formats as separate lines", () => {
    let bag = addLine([], { product: "low-tide", format: "4", qty: 1 });
    bag = addLine(bag, { product: "low-tide", format: "12", qty: 1 });
    expect(bag).toHaveLength(2);
  });

  it("removes a line when quantity drops to zero and caps quantity", () => {
    let bag = addLine([], { product: "fog-line", format: "12", qty: 1 });
    bag = setQty(bag, lineKey(bag[0]), 99);
    expect(bag[0].qty).toBe(MAX_QTY);
    bag = setQty(bag, lineKey(bag[0]), 0);
    expect(bag).toHaveLength(0);
  });

  it("charges shipping under the free threshold and not above it", () => {
    const small = totals([{ product: "low-tide", format: "4", qty: 2 }]);
    expect(small.subtotal).toBe(18);
    expect(small.shipping).toBe(6);
    expect(small.toFree).toBe(22);
    const big = totals([{ product: "low-tide", format: "24", qty: 1 }]);
    expect(big.shipping).toBe(0);
    expect(totals([]).total).toBe(0);
  });

  it("prices the mixed box", () => {
    expect(totals([{ product: "road-trip", format: "box", qty: 2 }]).subtotal).toBe(52);
  });
});
