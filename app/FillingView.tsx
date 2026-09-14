"use client";

import type { FillingHoldItem, FillingPlan } from "./types";

function itemLine(item: FillingHoldItem) {
  return `${item.quantity}× ${item.title}${item.sizeShort ? ` (${item.sizeShort})` : item.size ? ` (${item.size})` : ""}`;
}

export default function FillingView({
  batchNumber,
  filling,
  onNewBatch,
}: {
  batchNumber: string;
  filling?: FillingPlan;
  onNewBatch: () => void;
}) {
  const holdOrders = filling?.holdOrders || [];

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
        <p className="progress-copy">
          {holdOrders.length
            ? `${holdOrders.length} ${holdOrders.length === 1 ? "order" : "orders"} to set aside`
            : "No missing items"}
        </p>
      </header>

      {holdOrders.length === 0 ? (
        <section className="list-card empty-state">
          No missing items for this batch. Bag the orders as usual and close
          them.
        </section>
      ) : (
        holdOrders.map((order) => (
          <section className="hold-card" key={order.orderNumber || order.shipmentId}>
            <div className="hold-badge">Do not close</div>
            <h2>Order #{order.orderNumber || "Unknown"}</h2>
            <p className="hold-copy">
              Put these items in the bag and set aside. This order will not be
              closed.
            </p>

            <div className="hold-section-title">Missing</div>
            <ul className="hold-list">
              {order.missingItems.map((item, index) => (
                <li key={item.itemId || `${item.title}-${index}`}>
                  {itemLine(item)}
                </li>
              ))}
            </ul>

            {order.bagItems.length ? (
              <>
                <div className="hold-section-title">In the bag</div>
                <ul className="hold-list">
                  {order.bagItems.map((item, index) => (
                    <li key={`${item.title}-${item.size}-${index}`}>
                      {itemLine(item)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="hold-copy">No other items for this order.</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
