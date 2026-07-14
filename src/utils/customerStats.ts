import { Customer, CompletedOrder, Order } from '../types';

type AnyOrder = Order | CompletedOrder;

export interface CustomerStats {
  totalSpent: number;
  orderCount: number;
  lastOrderDate?: Date;
}

const matchesCustomerIdentity = (order: AnyOrder, phone: string, name: string): boolean =>
  phone ? order.customerPhone === phone : order.customerName.trim().toLowerCase() === name;

// Live totals for every customer in one pass over the orders, indexed by phone/name.
// Nothing is stored: this replaces the old accumulate-on-rendir counters, which drifted
// whenever an order was later edited, reassigned, or deleted without being decremented.
export function computeAllCustomerStats(customers: Customer[], allOrders: AnyOrder[]): Map<string, CustomerStats> {
  const byPhone = new Map<string, AnyOrder[]>();
  const byName = new Map<string, AnyOrder[]>();

  allOrders.forEach(o => {
    if (o.status !== 'rendido') return;
    const phone = o.customerPhone.trim();
    if (phone) {
      const list = byPhone.get(phone);
      if (list) list.push(o); else byPhone.set(phone, [o]);
    } else {
      const name = o.customerName.trim().toLowerCase();
      const list = byName.get(name);
      if (list) list.push(o); else byName.set(name, [o]);
    }
  });

  const map = new Map<string, CustomerStats>();
  customers.forEach(c => {
    const phone = c.phone.trim();
    const name = c.name.trim().toLowerCase();
    const matched = phone ? (byPhone.get(phone) || []) : (byName.get(name) || []);
    const unique = Array.from(new Map(matched.map(o => [o.id, o])).values());
    map.set(c.id, {
      totalSpent: unique.reduce((sum, o) => sum + o.total, 0),
      orderCount: unique.length,
      lastOrderDate: unique.length > 0
        ? new Date(Math.max(...unique.map(o => new Date(o.createdAt).getTime())))
        : undefined,
    });
  });
  return map;
}

export function computeCustomerStats(customer: Customer, allOrders: AnyOrder[]): CustomerStats {
  return computeAllCustomerStats([customer], allOrders).get(customer.id)!;
}

// All orders belonging to a customer, any status — for listing in the detail view.
// Matches by identity OR by the recorded order id link, so a past order isn't orphaned
// from the list if the customer's own name/phone gets corrected later.
export function getCustomerOrders(customer: Customer, allOrders: AnyOrder[]): AnyOrder[] {
  const phone = customer.phone.trim();
  const name = customer.name.trim().toLowerCase();
  const historyIds = new Set(customer.orderHistory);
  const seen = new Set<string>();
  const result: AnyOrder[] = [];
  allOrders.forEach(o => {
    if ((matchesCustomerIdentity(o, phone, name) || historyIds.has(o.id)) && !seen.has(o.id)) {
      seen.add(o.id);
      result.push(o);
    }
  });
  return result;
}
