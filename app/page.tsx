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

const SIZE_KEYS = [
  { rank: 10, short: "XXS", keys: ["xxs", "2xs", "extraextrasmall"] },
  { rank: 20, short: "XS", keys: ["xs", "xsmall", "extrasmall"] },
  { rank: 30, short: "S", keys: ["s", "small"] },
  { rank: 40, short: "M", keys: ["m", "med", "medium"] },
  { rank: 50, short: "L", keys: ["l", "lg", "large"] },
  { rank: 60, short: "XL", keys: ["xl", "xlarge", "extralarge"] },
  { rank: 70, short: "2XL", keys: ["2xl", "2x", "2xlarge", "xxl", "xxlarge"] },
  { rank: 80, short: "3XL", keys: ["3xl", "3x", "3xlarge", "xxxl", "xxxlarge"] },
  { rank: 90, short: "4XL", keys: ["4xl", "4x", "4xlarge", "xxxxl"] },
  { rank: 100, short: "5XL", keys: ["5xl", "5x", "5xlarge"] },
  { rank: 110, short: "6XL", keys: ["6xl", "6x", "6xlarge"] },
  { rank: 200, short: "OS", keys: ["os", "osfa", "onesize"] },
];

function sizeGroup(size: string | null) {
  const raw = String(size || "").toLowerCase();
  if (/\b(newborn|infant|baby|nb)\b/.test(raw)) return 0;
  if (/\b(toddler|2t|3t|4t|5t)\b/.test(raw)) return 1;
  if (/\b(youth|kids?|child)\b/.test(raw)) return 2;
  return 3;
}

function compactSize(size: string) {
  return size
    .toLowerCase()
    .replace(/\b(adult|youth|kids?|child(?:ren)?|toddler|infant|baby|newborn)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function sizeInfo(size: string | null) {
  const raw = String(size || "").trim();
  if (!raw) return { rank: 999, short: null, group: 9 };
  const compact = compactSize(raw);
  const match = SIZE_KEYS.find((entry) => entry.keys.includes(compact));
  return {
    rank: match ? match.rank : 500,
    short: match ? match.short : raw,
    group: sizeGroup(raw),
  };
}

function isIpadDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function shouldUseAppKeypad() {
  if (typeof window === "undefined") return false;
  if (isIpadDevice()) return true;
  return window.matchMedia("(pointer: coarse) and (min-width: 768px)").matches;
}

function sortByItem(items: PickItem[]) {
  return [...items].sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (titleCompare !== 0) return titleCompare;
    const sizeA = sizeInfo(a.size);
    const sizeB = sizeInfo(b.size);
    if (sizeA.group !== sizeB.group) return sizeA.group - sizeB.group;
    if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
    return (a.size || "").localeCompare(b.size || "");
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

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Go back
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
  const [useAppKeypad, setUseAppKeypad] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [quantityItem, setQuantityItem] = useState<PickItem | null>(null);

  useEffect(() => {
    setUseAppKeypad(shouldUseAppKeypad());
  }, []);

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
          items: sortByItem(category.items),
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
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ batchNumber }),
      });
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

  function applyCheck(item: PickItem) {
    if (!data) return;
    const next = checkedIds.includes(item.id)
      ? checkedIds.filter((id) => id !== item.id)
      : [...checkedIds, item.id];
    setCheckedIds(next);
    saveChecked(data.batch.batchNumber, next);
  }

  function toggleItem(item: PickItem) {
    const alreadyChecked = checkedIds.includes(item.id);
    if (!alreadyChecked && item.quantity > 1) {
      setQuantityItem(item);
      return;
    }
    applyCheck(item);
  }

  function resetChecks() {
    if (!data) return;
    setCheckedIds([]);
    saveChecked(data.batch.batchNumber, []);
  }

  function leaveBatch() {
    setLeaveConfirmOpen(false);
    setQuantityItem(null);
    setData(null);
    setBatchInput("");
    setError("");
    setCheckedIds([]);
  }

  function requestNewBatch() {
    if (pickedCount < totalCount) {
      setLeaveConfirmOpen(true);
      return;
    }
    leaveBatch();
  }

  function appendDigit(digit: string) {
    setBatchInput((current) => `${current}${digit}`.slice(0, 12));
  }

  function deleteDigit() {
    setBatchInput((current) => current.slice(0, -1));
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
            <form
              className={`search-form${useAppKeypad ? " search-form-pad" : ""}`}
              onSubmit={loadBatch}
            >
              <label htmlFor="batchNumber">Batch number</label>
              <input
                id="batchNumber"
                type={useAppKeypad ? "text" : "tel"}
                inputMode={useAppKeypad ? "none" : "numeric"}
                pattern="[0-9]*"
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus={!useAppKeypad}
                readOnly={useAppKeypad}
                value={batchInput}
                onChange={(event) =>
                  setBatchInput(event.target.value.replace(/\D/g, ""))
                }
                onFocus={(event) => {
                  if (useAppKeypad) event.currentTarget.blur();
                }}
                placeholder="######"
              />
              {useAppKeypad ? (
                <div className="number-pad" aria-label="Number pad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="pad-key"
                      onClick={() => appendDigit(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pad-key pad-key-action"
                    onClick={deleteDigit}
                    aria-label="Delete"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="pad-key"
                    onClick={() => appendDigit("0")}
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    className="pad-key pad-key-go"
                    disabled={loading}
                  >
                    Go
                  </button>
                </div>
              ) : null}
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
            <button type="button" onClick={requestNewBatch}>
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
                  const sizeShort = sizeInfo(item.size).short;
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
                        <p>{item.size || item.productType || "Item"}</p>
                      </div>
                      <div className="item-actions">
                        {sizeShort ? (
                          <div className="size-badge">{sizeShort}</div>
                        ) : (
                          <div className="size-badge size-badge-empty" aria-hidden="true" />
                        )}
                        <div className="qty-pill">×{item.quantity}</div>
                        <div className={`checkbox${checked ? " checked" : ""}`}>
                          {checked ? <CheckIcon /> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {leaveConfirmOpen ? (
        <ConfirmModal
          title="Missing items"
          message={`${totalCount - pickedCount} of ${totalCount} items still need to be picked. Start a new batch anyway?`}
          confirmLabel="Confirm"
          onCancel={() => setLeaveConfirmOpen(false)}
          onConfirm={leaveBatch}
        />
      ) : null}

      {quantityItem ? (
        <ConfirmModal
          title="Confirm quantity"
          message={`Did you pick all ${quantityItem.quantity} of ${quantityItem.title}${quantityItem.size ? ` (${quantityItem.size})` : ""}?`}
          confirmLabel="Yes, all picked"
          onCancel={() => setQuantityItem(null)}
          onConfirm={() => {
            applyCheck(quantityItem);
            setQuantityItem(null);
          }}
        />
      ) : null}
    </main>
  );
}
