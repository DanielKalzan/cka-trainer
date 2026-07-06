import { describe, expect, it } from "vitest";
import { pickRandom, shuffle } from "./shuffle";

describe("shuffle", () => {
  it("returns all elements, never mutating the input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    const result = shuffle(input);
    expect(input).toEqual(copy);
    expect(result.slice().sort()).toEqual(copy.slice().sort());
  });

  it("produces different orders across repeated calls", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const orders = new Set(Array.from({ length: 50 }, () => shuffle(input).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("pickRandom", () => {
  const questions = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
    { id: "e" },
  ];

  it("returns exactly n items when n <= length", () => {
    const picked = pickRandom(questions, 3);
    expect(picked).toHaveLength(3);
  });

  it("has no duplicate ids in a single pick", () => {
    const picked = pickRandom(questions, 5);
    const ids = picked.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns all items (shuffled) when n exceeds length, never padding or crashing", () => {
    const picked = pickRandom(questions, 100);
    expect(picked).toHaveLength(questions.length);
    expect(picked.map((q) => q.id).sort()).toEqual(questions.map((q) => q.id).sort());
  });

  it("returns an empty array when n <= 0", () => {
    expect(pickRandom(questions, 0)).toEqual([]);
    expect(pickRandom(questions, -1)).toEqual([]);
  });

  it("varies the selected set across repeated calls", () => {
    const picks = new Set(
      Array.from({ length: 50 }, () => pickRandom(questions, 3).map((q) => q.id).join(","))
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
