// ─── Build 1: Core Domain Engines ─────────────────────────────────────────────
// Pure, zero-dependency TypeScript domain logic for Event Booking System

import type {
  Event,
  TicketTier,
  Booking,
  WaitlistEntry,
  Result,
  DomainError,
  EventStatus,
} from "./types";
import { isErr } from "./types";

// ─── Reference Generator ──────────────────────────────────────────────────────

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join("");
}

export const ReferenceGenerator = {
  eventId(): string {
    return `EVT-${new Date().getFullYear()}-${generateRandomString(5)}`;
  },
  bookingId(): string {
    return generateRandomString(8);
  },
  bookingReference(): string {
    return `BK-${generateRandomString(6)}`;
  },
  tierId(): string {
    return `TIER-${generateRandomString(4)}`;
  },
  waitlistId(): string {
    return `WL-${generateRandomString(6)}`;
  },
};

// ─── Event Manager ────────────────────────────────────────────────────────────

export class EventManager {
  private events: Map<string, Event> = new Map();

  createEvent(params: {
    title: string;
    description: string;
    category: string;
    venue: string;
    date: string;
    maxCapacity: number;
  }): Event {
    const event: Event = {
      id: ReferenceGenerator.eventId(),
      ...params,
      tiers: [],
      status: "draft",
    };
    this.events.set(event.id, event);
    return event;
  }

  addTier(eventId: string, params: {
    name: string;
    price: number;
    totalCapacity: number;
  }): Result<TicketTier> {
    const event = this.events.get(eventId);
    if (!event) return { ok: false, error: { code: "EVENT_NOT_FOUND", message: `Event ${eventId} not found` } };

    const tier: TicketTier = {
      id: ReferenceGenerator.tierId(),
      ...params,
      bookedCount: 0,
      reservedCount: 0,
    };
    event.tiers.push(tier);
    this.recalculateStatus(eventId);
    return { ok: true, value: tier };
  }

  publishEvent(eventId: string): Result<Event> {
    const event = this.events.get(eventId);
    if (!event) return { ok: false, error: { code: "EVENT_NOT_FOUND", message: `Event ${eventId} not found` } };
    if (event.tiers.length === 0) return { ok: false, error: { code: "EVENT_NOT_PUBLISHED", message: "Cannot publish event with no tiers" } };
    event.status = "published";
    return { ok: true, value: event };
  }

  getEvent(eventId: string): Event | undefined {
    return this.events.get(eventId);
  }

  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }

  getAvailableCapacity(eventId: string, tierId: string): number {
    const event = this.events.get(eventId);
    if (!event) return 0;
    const tier = event.tiers.find((t) => t.id === tierId);
    if (!tier) return 0;
    return tier.totalCapacity - tier.bookedCount;
  }

  getEventTotalAvailable(eventId: string): number {
    const event = this.events.get(eventId);
    if (!event) return 0;
    return event.tiers.reduce((sum, t) => sum + (t.totalCapacity - t.bookedCount), 0);
  }

  recalculateStatus(eventId: string): EventStatus {
    const event = this.events.get(eventId);
    if (!event || event.status === "cancelled") return event?.status ?? "draft";
    const totalAvailable = this.getEventTotalAvailable(eventId);
    if (totalAvailable === 0) {
      event.status = "sold_out";
    } else if (event.status === "sold_out") {
      event.status = "published";
    }
    return event.status;
  }

  // Internal: get tier for mutation
  getTierForUpdate(eventId: string, tierId: string): TicketTier | undefined {
    const event = this.events.get(eventId);
    if (!event) return undefined;
    return event.tiers.find((t) => t.id === tierId);
  }

  getEventsList(): Event[] {
    return this.getAllEvents();
  }
}

// ─── Booking Engine ───────────────────────────────────────────────────────────

export class BookingEngine {
  private bookings: Map<string, Booking> = new Map();
  private eventManager: EventManager;

  constructor(eventManager: EventManager) {
    this.eventManager = eventManager;
  }

  createBooking(params: {
    eventId: string;
    tierId: string;
    quantity: number;
    customerName: string;
    customerEmail: string;
  }): Result<Booking> {
    const { eventId, tierId, quantity, customerName, customerEmail } = params;

    if (quantity <= 0) {
      return { ok: false, error: { code: "INVALID_QUANTITY", message: "Quantity must be greater than 0" } };
    }

    const event = this.eventManager.getEvent(eventId);
    if (!event) {
      return { ok: false, error: { code: "EVENT_NOT_FOUND", message: `Event ${eventId} not found` } };
    }
    if (event.status !== "published" && event.status !== "sold_out") {
      return { ok: false, error: { code: "EVENT_NOT_PUBLISHED", message: `Event status is '${event.status}', must be 'published'` } };
    }

    const tier = this.eventManager.getTierForUpdate(eventId, tierId);
    if (!tier) {
      return { ok: false, error: { code: "TIER_NOT_FOUND", message: `Tier ${tierId} not found in event ${eventId}` } };
    }

    // STRICT CAPACITY ENFORCEMENT - non-oversell invariant
    const available = tier.totalCapacity - tier.bookedCount;
    if (quantity > available) {
      return {
        ok: false,
        error: { code: "INSUFFICIENT_CAPACITY", message: `Only ${available} tickets available, requested ${quantity}`, available, requested: quantity },
      };
    }

    const booking: Booking = {
      id: ReferenceGenerator.bookingId(),
      bookingReference: ReferenceGenerator.bookingReference(),
      eventId,
      tierId,
      quantity,
      customerName,
      customerEmail,
      totalPrice: tier.price * quantity,
      createdAt: new Date().toISOString(),
      status: "confirmed",
    };

    tier.bookedCount += quantity;
    this.bookings.set(booking.id, booking);
    this.eventManager.recalculateStatus(eventId);

    return { ok: true, value: booking };
  }

  cancelBooking(bookingId: string): Result<Booking> {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      return { ok: false, error: { code: "BOOKING_NOT_FOUND", message: `Booking ${bookingId} not found` } };
    }
    if (booking.status === "cancelled") {
      return { ok: false, error: { code: "BOOKING_ALREADY_CANCELLED", message: "Booking is already cancelled" } };
    }

    // Rollback capacity
    const tier = this.eventManager.getTierForUpdate(booking.eventId, booking.tierId);
    if (tier) {
      tier.bookedCount = Math.max(0, tier.bookedCount - booking.quantity);
    }

    booking.status = "cancelled";
    this.eventManager.recalculateStatus(booking.eventId);

    return { ok: true, value: booking };
  }

  getBooking(bookingId: string): Booking | undefined {
    return this.bookings.get(bookingId);
  }

  getBookingsByEvent(eventId: string): Booking[] {
    return Array.from(this.bookings.values()).filter((b) => b.eventId === eventId);
  }

  getAllBookings(): Booking[] {
    return Array.from(this.bookings.values());
  }
}

// ─── Waitlist Engine (FIFO) ───────────────────────────────────────────────────

export class WaitlistEngine {
  private queue: WaitlistEntry[] = [];
  private eventManager: EventManager;
  private bookingEngine: BookingEngine;

  constructor(eventManager: EventManager, bookingEngine: BookingEngine) {
    this.eventManager = eventManager;
    this.bookingEngine = bookingEngine;
  }

  enqueue(params: {
    eventId: string;
    tierId: string;
    customerName: string;
    customerEmail: string;
    quantity: number;
  }): Result<WaitlistEntry> {
    const event = this.eventManager.getEvent(params.eventId);
    if (!event) {
      return { ok: false, error: { code: "EVENT_NOT_FOUND", message: `Event ${params.eventId} not found` } };
    }

    const entry: WaitlistEntry = {
      id: ReferenceGenerator.waitlistId(),
      ...params,
      joinedAt: new Date().toISOString(),
      priorityPosition: this.getQueue(params.eventId, params.tierId).length + 1,
      status: "waiting",
    };

    this.queue.push(entry);
    return { ok: true, value: entry };
  }

  peek(eventId: string, tierId: string): WaitlistEntry | undefined {
    return this.queue.find((e) => e.eventId === eventId && e.tierId === tierId && e.status === "waiting");
  }

  promoteNext(eventId: string, tierId: string): Result<{ entry: WaitlistEntry; booking: Booking }> {
    const next = this.peek(eventId, tierId);
    if (!next) {
      return { ok: false, error: { code: "WAITLIST_EMPTY", message: "No waiting entries in queue" } };
    }

    const available = this.eventManager.getAvailableCapacity(eventId, tierId);
    if (available < next.quantity) {
      return {
        ok: false,
        error: { code: "INSUFFICIENT_CAPACITY", message: `Not enough capacity: ${available} available, ${next.quantity} needed`, available, requested: next.quantity },
      };
    }

    // Create booking for the promoted entry
    const bookingResult = this.bookingEngine.createBooking({
      eventId,
      tierId,
      quantity: next.quantity,
      customerName: next.customerName,
      customerEmail: next.customerEmail,
    });

    if (isErr(bookingResult)) return { ok: false, error: bookingResult.error };

    next.status = "promoted";
    this.recalculatePositions(eventId, tierId);

    return { ok: true, value: { entry: next, booking: bookingResult.value } };
  }

  getQueue(eventId: string, tierId?: string): WaitlistEntry[] {
    return this.queue
      .filter((e) => e.eventId === eventId && (tierId ? e.tierId === tierId : true) && e.status === "waiting")
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  }

  getAllQueue(): WaitlistEntry[] {
    return this.queue;
  }

  getPosition(entryId: string): number {
    const entry = this.queue.find((e) => e.id === entryId);
    if (!entry) return -1;
    return this.getQueue(entry.eventId, entry.tierId).findIndex((e) => e.id === entryId) + 1;
  }

  private recalculatePositions(eventId: string, tierId: string): void {
    const waiting = this.getQueue(eventId, tierId);
    waiting.forEach((e, i) => { e.priorityPosition = i + 1; });
  }
}

// ─── Core System Facade ───────────────────────────────────────────────────────

export class CoreSystem {
  readonly events: EventManager;
  readonly bookings: BookingEngine;
  readonly waitlist: WaitlistEngine;

  constructor() {
    this.events = new EventManager();
    this.bookings = new BookingEngine(this.events);
    this.waitlist = new WaitlistEngine(this.events, this.bookings);
  }

  // Attempt booking, auto-enqueue to waitlist if sold out
  bookOrWaitlist(params: {
    eventId: string;
    tierId: string;
    quantity: number;
    customerName: string;
    customerEmail: string;
  }): Result<{ type: "booking"; booking: Booking } | { type: "waitlist"; entry: WaitlistEntry }> {
    const bookingResult = this.bookings.createBooking(params);
    if (!isErr(bookingResult)) {
      return { ok: true, value: { type: "booking", booking: bookingResult.value } };
    }

    // If capacity issue, add to waitlist
    if (bookingResult.error.code === "INSUFFICIENT_CAPACITY" || bookingResult.error.code === "EVENT_NOT_PUBLISHED") {
      const wlResult = this.waitlist.enqueue(params);
      if (!isErr(wlResult)) {
        return { ok: true, value: { type: "waitlist", entry: wlResult.value } };
      }
    }

    return { ok: false, error: bookingResult.error };
  }

  // Cancel booking and auto-promote from waitlist
  cancelAndPromote(bookingId: string): Result<{ booking: Booking; promoted?: { entry: WaitlistEntry; booking: Booking } }> {
    const cancelResult = this.bookings.cancelBooking(bookingId);
    if (isErr(cancelResult)) return { ok: false, error: cancelResult.error };

    const booking = cancelResult.value;
    const promoteResult = this.waitlist.promoteNext(booking.eventId, booking.tierId);

    if (!isErr(promoteResult)) {
      return { ok: true, value: { booking, promoted: promoteResult.value } };
    }

    return { ok: true, value: { booking } };
  }
}

// ─── Pre-seeded Demo Events ───────────────────────────────────────────────────

export function seedDemoEvents(system: CoreSystem): void {
  // Event 1: Tech Summit 2025
  const e1 = system.events.createEvent({
    title: "Tech Summit 2025",
    description: "Annual technology conference featuring keynotes, workshops, and networking.",
    category: "Technology",
    venue: "Convention Center Hall A",
    date: "2025-09-15T09:00:00Z",
    maxCapacity: 500,
  });
  system.events.addTier(e1.id, { name: "Early Bird", price: 99, totalCapacity: 100 });
  system.events.addTier(e1.id, { name: "General Admission", price: 199, totalCapacity: 300 });
  system.events.addTier(e1.id, { name: "VIP", price: 499, totalCapacity: 100 });
  system.events.publishEvent(e1.id);

  // Event 2: Indie Music Festival
  const e2 = system.events.createEvent({
    title: "Indie Music Festival",
    description: "Three days of independent artists across multiple stages.",
    category: "Music",
    venue: "Riverside Amphitheater",
    date: "2025-07-20T16:00:00Z",
    maxCapacity: 1000,
  });
  system.events.addTier(e2.id, { name: "Day Pass", price: 45, totalCapacity: 600 });
  system.events.addTier(e2.id, { name: "Weekend Pass", price: 120, totalCapacity: 300 });
  system.events.addTier(e2.id, { name: "Backstage", price: 250, totalCapacity: 100 });
  system.events.publishEvent(e2.id);

  // Event 3: AI Workshop
  const e3 = system.events.createEvent({
    title: "AI Workshop: Hands-On ML",
    description: "Intensive 2-day workshop on machine learning fundamentals and practice.",
    category: "Education",
    venue: "Innovation Lab, Room 301",
    date: "2025-08-05T10:00:00Z",
    maxCapacity: 30,
  });
  system.events.addTier(e3.id, { name: "Standard", price: 299, totalCapacity: 20 });
  system.events.addTier(e3.id, { name: "Premium (with lunch)", price: 399, totalCapacity: 10 });
  system.events.publishEvent(e3.id);
}