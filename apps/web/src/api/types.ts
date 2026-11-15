// Mirrors server/src/lib/dto.ts and server/src/lib/orders.ts. Money is integer paise.
export type Role = 'student' | 'staff' | 'admin';
export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled'
  | 'rejected'
  | 'no_show';
export type PaymentMethod = 'cash' | 'upi_counter' | 'razorpay';

export interface User {
  id: number;
  phone: string | null;
  email: string | null;
  name: string | null;
  rollNo: string | null;
  role: Role;
  isBlocked: boolean;
  noShowCount: number;
}

export interface OrderItem {
  menuItemId: number | null;
  comboId: number | null;
  name: string;
  qty: number;
  unitPricePaise: number;
  note: string | null;
}

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  totalPaise: number;
  pickupCode: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: string;
  note: string | null;
  rejectReason: string | null;
  readyBy: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  closedAt: string | null;
  createdAt: string;
  items: OrderItem[];
  customer?: { name: string | null; rollNo: string | null; phone: string | null };
}

export interface MenuItem {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  pricePaise: number;
  imageUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  isPopular: boolean;
  prepMinutes: number;
}

export interface Combo {
  id: number;
  name: string;
  description: string | null;
  pricePaise: number;
  isAvailable: boolean;
  items: { menuItemId: number; name: string; qty: number }[];
}

/** Admin views include inactive (hidden) items. */
export interface AdminItem extends MenuItem {
  isActive: boolean;
}
export interface AdminCombo extends Combo {
  isActive: boolean;
}
export interface AdminCategory {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}
export interface Special {
  id: number;
  date: string;
  menuItemId: number | null;
  comboId: number | null;
  title: string | null;
}
export interface AppSettings {
  orders_paused: string;
  open_time: string;
  close_time: string;
  max_open_orders_per_student: string;
  max_orders_per_10_min: string;
  no_show_minutes: string;
  no_show_block_after: string;
}
export interface Report {
  from: string;
  to: string;
  totals: {
    orders: number;
    collected: number;
    cancelled: number;
    rejected: number;
    noShows: number;
    revenuePaise: number;
    cashPaise: number;
    upiPaise: number;
    avgMinutesToReady: number | null;
    avgMinutesReadyToPickup: number | null;
  };
  byDay: { day: string; orders: number; revenuePaise: number }[];
  byHour: { hour: number; orders: number }[];
  topItems: { name: string; qty: number; revenuePaise: number }[];
  feedback: { avgRating: number | null; ratings: number };
}

export interface Menu {
  date: string;
  ordering: { paused: boolean; isOpen: boolean; openTime: string; closeTime: string };
  categories: { id: number; name: string; icon: string | null; items: MenuItem[] }[];
  combos: Combo[];
}
