import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/orders/view";
import { Badge } from "@/components/ui/misc";

export type OrderListItem = {
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  payment_method: string;
  total_paise: number;
  created_at: string;
  order_items: { quantity: number }[];
};

export function OrderList({ orders }: { orders: OrderListItem[] }) {
  return (
    <ul className="divide-y divide-line rounded-[1.75rem] border border-line bg-paper">
      {orders.map((o) => {
        const status = orderStatusLabel(o);
        const count = o.order_items.reduce((s, i) => s + i.quantity, 0);
        return (
          <li key={o.order_number}>
            <Link href={`/account/orders/${o.order_number}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-forest/[0.03] sm:px-6">
              <span className="min-w-36">
                <span className="block font-semibold text-forest">{o.order_number}</span>
                <span className="text-[0.82rem] text-muted">{formatDate(o.created_at)}</span>
              </span>
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="ml-auto text-[0.9rem] text-muted">
                {count} item{count === 1 ? "" : "s"}
              </span>
              <span className="font-semibold tabular-nums">{formatINR(o.total_paise)}</span>
              <ChevronRight className="size-4 text-muted" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
