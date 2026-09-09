"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PickItem, PickListResponse } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_PICKING_API_URL ||
  "https://us-central1-premier-ikon-apps.cloudfunctions.net/pickingSupportBatch";

const STORAGE_PREFIX = "pi-picking-checked:";

function storageKey(batchNumber: string) {
  return `${STORAGE_PREFIX}${batchNumber}`;
}

function loadChecked(batchNumber: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(batchNumber));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveChecked(batchNumber: string, ids: string[]) {
  window.localStorage.setItem(storageKey(batchNumber), JSON.stringify(ids));
}

const SIZE_MATCHES = [
  { rank: 10, short: "XXS", pattern: /\b(xxs|2xs|extra\s*extra\s*small)\b/i },
  { rank: 20, short: "XS", pattern: /\b(xs|x-?\s*small|extra\s*small)\b/i },
  { rank: 30, short: "S", pattern: /\b(small)\b/i },
  { rank: 40, short: "M", pattern: /\b(medium|med)\b/i },
  { rank: 50, short: "L", pattern: /\b(large)\b/i },
  { rank: 80, short: "3XL", pattern: /\b(xxx-?l|3x-?l|3x|triple\s*extra\s*large)\b/i },
  { rank: 70, short: "2XL", pattern: /\b(xx-?l|2x-?l|2x|double\s*extra\s*large)\b/i },
  { rank: 60, short: "XL", pattern: /\b(x-?\s*large|xlarge|extra\s*large|xl)\b/i },
  { rank: 90, short: "4XL", pattern: /\b(4x-?l|4x)\b/i },
  { rank: 100, short: "5XL", pattern: /\b(5x-?l|5x)\b/i },
  { rank: 110, short: "6XL", pattern: /\b(6x-?l|6x)\b/i },
  { rank: 200, short: "OS", pattern: /\b(one\s*size|osfa|os)\b/i },
];

function sizeGroup(size: string | null) {
  const raw = String(size || "").toLowerCase();
  if (/\b(newborn|infant|baby|nb)\b/.test(raw)) return 0;
  if (/\b(toddler|2t|3t|4t|5t)\b/.test(raw)) return 1;
  if (/\b(youth|kids?|child)\b/.test(raw)) return 2;
  return 3;
}

function sizeInfo(size: string | null) {
  const raw = String(size || "").trim();
  if (!raw) return { rank: 999, short: null, group: 9 };
  const match = SIZE_MATCHES.find((entry) => entry.pattern.test(raw));
  return {
    rank: match ? match.rank : 500,
    short: match ? match.short : raw,
    group: sizeGroup(raw),
  };
}

function sortBySize(items: PickItem[]) {
  return [...items].sort((a, b) => {
    const sizeA = sizeInfo(a.size);
    const sizeB = sizeInfo(b.size);
    if (sizeA.group !== sizeB.group) return sizeA.group - sizeB.group;
    if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
    return a.title.localeCompare(b.title);
  });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M21 8l-9-5-9 5v8l9 5 9-5V8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.3 7.8L12 12.5l8.7-4.7M12 22V12.5" />
    </svg>
  );
}

function ItemImage({ item }: { item: PickItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.imageUrl || failed) {
    return <div className="item-image-fallback">PI</div>;
  }

  return (
    <img
      className="item-image"
      src={item.imageUrl}
      alt={item.title}
      onError={() => setFailed(true)}
    />
  );
}

export default function Home() {
  const [batchInput, setBatchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PickListResponse | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.batch.batchNumber) return;
    setCheckedIds(loadChecked(data.batch.batchNumber));
  }, [data?.batch.batchNumber]);

  const visibleCategories = useMemo(
    () =>
      (data?.categories || [])
        .filter((category) => category.items.length > 0)
        .map((category) => ({
          ...category,
          items: sortBySize(category.items),
        })),
    [data]
  );

  const pickedCount = useMemo(() => {
    if (!data) return 0;
    return data.categories
      .flatMap((category) => category.items)
      .filter((item) => checkedIds.includes(item.id))
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [checkedIds, data]);

  const totalCount = data?.summary.totalItems || 0;
  const progress = totalCount ? Math.round((pickedCount / totalCount) * 100) : 0;

  async function loadBatch(event?: FormEvent) {
    event?.preventDefault();
    const batchNumber = batchInput.trim().replace(/^#+/, "");
    if (!batchNumber) {
      setError("Enter a batch number to get started.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}?batchNumber=${encodeURIComponent(batchNumber)}`
      );
      const payload = (await response.json()) as PickListResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Could not load that batch.");
      }

      setData(payload);
      setCheckedIds(loadChecked(payload.batch.batchNumber));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load that batch.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(item: PickItem) {
    if (!data) return;
    const next = checkedIds.includes(item.id)
      ? checkedIds.filter((id) => id !== item.id)
      : [...checkedIds, item.id];
    setCheckedIds(next);
    saveChecked(data.batch.batchNumber, next);
  }

  function resetChecks() {
    if (!data) return;
    setCheckedIds([]);
    saveChecked(data.batch.batchNumber, []);
  }

  function startNewBatch() {
    setData(null);
    setBatchInput("");
    setError("");
    setCheckedIds([]);
  }

  if (!data) {
    return (
      <main className="app search-mode">
        <div className="app-shell">
          <section className="search-card">
            <div className="brand-mark">
              <BoxIcon />
            </div>
            <h1>Picking Support</h1>
            <p>Enter a ShipStation batch number to load the pick list.</p>
            <form className="search-form" onSubmit={loadBatch}>
              <label htmlFor="batchNumber">Batch number</label>
              <input
                id="batchNumber"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={batchInput}
                onChange={(event) => setBatchInput(event.target.value)}
                placeholder="######"
              />
              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? "Loading batch..." : "Load pick list"}
              </button>
            </form>
            {error ? <div className="error-banner">{error}</div> : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="app-shell">
        <header className="list-header">
          <div className="list-toolbar">
            <button type="button" onClick={startNewBatch}>
              New batch
            </button>
            <button type="button" onClick={resetChecks}>
              Reset
            </button>
          </div>
          <h1>Batch #{data.batch.batchNumber}</h1>
          <p className="progress-copy">
            {pickedCount} of {totalCount} items picked
          </p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </header>

        {visibleCategories.length === 0 ? (
          <section className="list-card empty-state">
            No pickable items were found in this batch.
          </section>
        ) : (
          visibleCategories.map((category) => (
            <section className="category" key={category.id}>
              <div className="category-title">
                <span>{category.label}</span>
                <span>{category.count}</span>
              </div>
              <div className="item-list">
                {category.items.map((item) => {
                  const checked = checkedIds.includes(item.id);
                  const sizeShort = item.sizeShort || sizeInfo(item.size).short;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`item-row${checked ? " checked" : ""}`}
                      onClick={() => toggleItem(item)}
                    >
                      <ItemImage item={item} />
                      <div className="item-copy">
                        <h3>{item.title}</h3>
                        {item.size ? (
                          <p className="item-size">{item.size}</p>
                        ) : (
                          <p>{item.productType || "Item"}</p>
                        )}
                      </div>
                      {sizeShort ? (
                        <div className="size-badge">{sizeShort}</div>
                      ) : null}
                      <div className="qty-pill">×{item.quantity}</div>
                      <div className={`checkbox${checked ? " checked" : ""}`}>
                        {checked ? <CheckIcon /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
