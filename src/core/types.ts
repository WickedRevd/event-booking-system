// ─── Build 1: Core Domain Types ───────────────────────────────────────────────
// Event Booking & Ticket Management System - Pure TypeScript contracts

// ─── Status Enums ─────────────────────────────────────────────────────────────

export type EventStatus = "draft" | "published" | "sold_out" | "cancelled";
export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";
export type WaitlistStatus = "waiting" | "promoted" | "expired";

// ─── Core Domain Entities ─────────────────────────────────────────────────────

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  totalCapacity: number;
  bookedCount: number;
  reservedCount: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  date: string;
  tiers: TicketTier[];
  maxCapacity: number;
  status: EventStatus;
}

export interface Booking {
  id: string;
  bookingReference: string;
  eventId: string;
  tierId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  createdAt: string;
  status: BookingStatus;
}

export interface WaitlistEntry {
  id: string;
  eventId: string;
  tierId: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  joinedAt: string;
  priorityPosition: number;
  status: WaitlistStatus;
}

// ─── Domain Result Type ───────────────────────────────────────────────────────

export type DomainError =
  | { code: "EVENT_NOT_FOUND"; message: string }
  | { code: "TIER_NOT_FOUND"; message: string }
  | { code: "INSUFFICIENT_CAPACITY"; message: string; available: number; requested: number }
  | { code: "EVENT_NOT_PUBLISHED"; message: string }
  | { code: "BOOKING_NOT_FOUND"; message: string }
  | { code: "BOOKING_ALREADY_CANCELLED"; message: string }
  | { code: "WAITLIST_EMPTY"; message: string }
  | { code: "INVALID_QUANTITY"; message: string }
  | { code: "TIER_SOLD_OUT"; message: string }
  | { code: "EVENT_SOLD_OUT"; message: string };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok === true;
}

export function isErr<T>(r: Result<T>): r is { ok: false; error: DomainError } {
  return r.ok === false;
}

// ─── Log Entry for Terminal ───────────────────────────────────────────────────

export type LogLevel = "info" | "success" | "warn" | "error" | "system";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Benchmark Types ──────────────────────────────────────────────────────────

export interface BenchmarkResult {
  iterations: number;
  successCount: number;
  failCount: number;
  oversellCount: number;
  avgLatencyMs: number;
  totalDurationMs: number;
  waitlistPromotions: number;
  peakMemoryEstimate: string;
}