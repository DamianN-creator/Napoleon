import { CashShift, CompletedOrder, Order, OrderType, PaymentMethod } from '../types';

export type HistoryOrder = Order | CompletedOrder;

export interface OrderEditForm {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  total: number;
}

export interface ShiftWindow {
  date: string; // shift's open date (YYYY-MM-DD), used as the history grouping key
  openedAt: Date;
  closedAt: Date | null;
}

const toLocalDateKey = (date: Date | string): string => {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function buildShiftWindowMap(cashShifts: CashShift[]): Record<string, ShiftWindow> {
  const map: Record<string, ShiftWindow> = {};
  cashShifts.forEach(s => {
    map[s.id] = {
      date: new Date(s.openedAt).toISOString().split('T')[0],
      openedAt: new Date(s.openedAt),
      closedAt: s.closedAt ? new Date(s.closedAt) : null,
    };
  });
  return map;
}

export function getActiveShiftWindow(cashShifts: CashShift[]): ShiftWindow | null {
  const active = cashShifts.find(s => s.status === 'open');
  if (!active) return null;
  return {
    date: new Date(active.openedAt).toISOString().split('T')[0],
    openedAt: new Date(active.openedAt),
    closedAt: null,
  };
}

// An order's createdAt is only trusted as "genuinely from this shift" if it falls
// inside the shift's open/close window — orders created right after midnight (before
// the shift closes) legitimately belong to the previous day's shift despite the date
// rollover. A createdAt outside that window means the date was edited after the fact.
const isWithinShiftWindow = (createdAt: Date, window: ShiftWindow): boolean => {
  if (createdAt.getTime() < window.openedAt.getTime()) return false;
  if (window.closedAt && createdAt.getTime() > window.closedAt.getTime()) return false;
  return true;
};

// Returns the history grouping date for an order: the shift's open date when createdAt
// falls within that shift's window, otherwise createdAt's own calendar date (covers both
// explicit superadmin edits and orders edited before the manualDateEdit flag existed).
export function getOrderShiftDate(
  order: HistoryOrder,
  shiftWindowMap: Record<string, ShiftWindow>,
  activeShiftWindow: ShiftWindow | null
): string {
  const created = new Date(order.createdAt);

  if (order.manualDateEdit) {
    return toLocalDateKey(created);
  }

  if ('shiftId' in order && order.shiftId) {
    const window = shiftWindowMap[order.shiftId];
    if (!window) return toLocalDateKey(created);
    return isWithinShiftWindow(created, window) ? window.date : toLocalDateKey(created);
  }

  // Active session orders normally belong to the current shift
  if (activeShiftWindow) {
    return isWithinShiftWindow(created, activeShiftWindow) ? activeShiftWindow.date : toLocalDateKey(created);
  }

  return toLocalDateKey(created);
}

export function applyOrderEdit<T extends HistoryOrder>(order: T, form: OrderEditForm): T {
  const [year, month, day] = form.date.split('-').map(Number);
  const [hours, minutes] = form.time.split(':').map(Number);
  const newCreatedAt = new Date(year, month - 1, day, hours, minutes);

  return {
    ...order,
    createdAt: newCreatedAt,
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    customerAddress: form.customerAddress.trim() || undefined,
    orderType: form.orderType,
    paymentMethod: form.paymentMethod,
    total: form.total,
    manualDateEdit: true,
  };
}
