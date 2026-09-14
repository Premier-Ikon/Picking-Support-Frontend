"use client";

import type { BaggingPlan, BagItem, BagSize } from "./types";

function sizeLabel(size: BagSize) {
  return size === "large" ? "Large" : "Medium";
}

function itemLine(item: BagItem) {
  return `${item.quantity}× ${item.title}${item.sizeShort ? ` (${item.sizeShort})` : ""}`;
}

function packSummary(totals: BaggingPlan["totals"]) {
  const boxCount = totals.boxes || 0;
  const parts = [`${totals.totalBags} ${totals.totalBags === 1 ? "bag" : "bags"}`];
  if (boxCount) {
    parts.push(`${boxCount} ${boxCount === 1 ? "hat box" : "hat boxes"}`);
  }
  parts.push(
    `for ${totals.shipmentCount} ${totals.shipmentCount === 1 ? "order" : "orders"}`
  );
  return parts.join(" · ");
}

export default function BaggingView({
  batchNumber,
  bagging,
  onNewBatch,
}: {
  batchNumber: string;
  bagging?: BaggingPlan;
  onNewBatch: () => void;
}) {
  if (!bagging) {
    return (
      <div className="app-shell">
        <header className="list-header">
          <div className="list-toolbar">
            <button type="button" onClick={onNewBatch}>
              New batch
            </button>
            <span />
          </div>
          <h1>Batch #{batchNumber}</h1>
        </header>
        <section className="list-card empty-state">
          Bag plan is not available for this batch yet. Redeploy the batch API
          and try again.
        </section>
      </div>
    );
  }

  const { totals, shipments } = bagging;
  const boxes = totals.boxes || 0;
  const totalCards = [
    totals.large > 0
      ? {
          key: "large",
          label: "Large",
          count: totals.large,
          unit: "bags",
          className: "bag-total-large",
        }
      : null,
    totals.medium > 0
      ? {
          key: "medium",
          label: "Medium",
          count: totals.medium,
          unit: "bags",
          className: "bag-total-medium",
        }
      : null,
    boxes > 0
      ? {
          key: "boxes",
          label: "Boxes",
          count: boxes,
          unit: boxes === 1 ? "box" : "boxes",
          className: "bag-total-box",
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    count: number;
    unit: string;
    className: string;
  }[];

  return (
    <div className="app-shell">
      <header className="list-header">
        <div className="list-toolbar">
          <button type="button" onClick={onNewBatch}>
            New batch
          </button>
          <span />
        </div>
        <h1>Batch #{batchNumber}</h1>
        <p className="progress-copy">{packSummary(totals)}</p>
      </header>

      {totalCards.length ? (
        <section className={`bag-totals cols-${totalCards.length}`}>
          {totalCards.map((card) => (
            <div
              key={card.key}
              className={`bag-total-card ${card.className}`}
              aria-label={`${card.count} ${card.label.toLowerCase()} ${card.unit}`}
            >
              <span>{card.label}</span>
              <strong>{card.count}</strong>
              <em>{card.unit}</em>
            </div>
          ))}
        </section>
      ) : null}

      {shipments.length === 0 ? (
        <section className="list-card empty-state">
          No baggable items were found in this batch.
        </section>
      ) : (
        shipments.map((shipment, index) => (
          <section className="category" key={shipment.shipmentId || index}>
            <div className="category-title">
              <span>
                {shipment.orderNumber
                  ? `Order ${shipment.orderNumber}`
                  : `Shipment ${index + 1}`}
              </span>
              <span>
                {[
                  shipment.bagCount
                    ? `${shipment.bagCount} ${shipment.bagCount === 1 ? "bag" : "bags"}`
                    : null,
                  shipment.boxCount
                    ? `${shipment.boxCount} ${shipment.boxCount === 1 ? "box" : "boxes"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="item-list">
              {shipment.bags.map((bag, bagIndex) => (
                <div className="bag-row" key={`${shipment.shipmentId}-bag-${bagIndex}`}>
                  <div className={`bag-size-badge bag-size-${bag.size}`}>
                    {sizeLabel(bag.size)}
                  </div>
                  <div className="item-copy">
                    <h3>{bag.reason}</h3>
                    <p>{bag.items.map(itemLine).join(" · ")}</p>
                  </div>
                </div>
              ))}
              {shipment.boxCount ? (
                <div className="bag-row">
                  <div className="bag-size-badge bag-size-box">Box</div>
                  <div className="item-copy">
                    <h3>
                      {shipment.boxCount} {shipment.boxCount === 1 ? "hat box" : "hat boxes"}
                    </h3>
                    <p>{shipment.boxItems.map(itemLine).join(" · ")}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
