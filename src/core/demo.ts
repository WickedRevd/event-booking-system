// ─── Build 1: Demo Scenarios & Benchmark Runner ───────────────────────────────
// Executable domain validation and throughput measurement

import { CoreSystem, seedDemoEvents } from "./domain";
import { isErr } from "./types";
import type { LogEntry, BenchmarkResult, LogLevel } from "./types";

let logCounter = 0;

function createLog(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    id: `log-${++logCounter}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
}

// ─── Full Demo Journey ────────────────────────────────────────────────────────

export function runFullDemoJourney(): LogEntry[] {
  const logs: LogEntry[] = [];
  const system = new CoreSystem();

  logs.push(createLog("system", "═══ BUILD 1 DEMO JOURNEY ═══"));
  logs.push(createLog("info", "Initializing CoreSystem with EventManager, BookingEngine, WaitlistEngine..."));

  // Seed events
  seedDemoEvents(system);
  const events = system.events.getAllEvents();
  logs.push(createLog("success", `Seeded ${events.length} demo events`));
  events.forEach((e) => {
    logs.push(createLog("info", `  → ${e.title} [${e.status}] | ${e.tiers.length} tiers | cap: ${e.maxCapacity}`));
  });

  // Pick the AI Workshop (small capacity for sold-out demo)
  const workshop = events[2];
  const standardTier = workshop.tiers[0];
  logs.push(createLog("system", `── Target: "${workshop.title}" / "${standardTier.name}" (cap: ${standardTier.totalCapacity}) ──`));

  // Book tickets one by one until sold out
  logs.push(createLog("info", "Booking tickets sequentially until tier is sold out..."));
  const names = ["Alice Chen", "Bob Park", "Carol Diaz", "Dan Lee", "Eve Novak", "Frank Osei", "Grace Kim", "Hiro Tanaka", "Ivy Torres", "Jack Wu", "Kira Patel", "Leo Zhang", "Mia Scott", "Noor Ali", "Omar Farah", "Pia Rossi", "Quinn Brooks", "Raj Mehta", "Sara Lund", "Tom Nash"];

  let booked = 0;
  for (let i = 0; i < standardTier.totalCapacity + 5; i++) {
    const name = names[i % names.length];
    const result = system.bookings.createBooking({
      eventId: workshop.id,
      tierId: standardTier.id,
      quantity: 1,
      customerName: name,
      customerEmail: `${name.toLowerCase().replace(" ", ".")}@example.com`,
    });

    if (isErr(result)) {
      logs.push(createLog("warn", `  ✗ Rejected: ${name} → ${result.error.message}`));
    } else {
      booked++;
      if (booked <= 3 || booked === standardTier.totalCapacity) {
        logs.push(createLog("success", `  ✓ Booking #${booked}: ${name} → ${result.value.bookingReference} ($${result.value.totalPrice})`));
      } else if (booked === 4) {
        logs.push(createLog("info", `  ... (${standardTier.totalCapacity - 4} more bookings)`));
      }
    }
  }

  logs.push(createLog("success", `Tier "${standardTier.name}" fully booked: ${booked}/${standardTier.totalCapacity}`));
  logs.push(createLog("info", `Event status: "${system.events.getEvent(workshop.id)?.status}"`));

  // Waitlist demo
  logs.push(createLog("system", "── FIFO Waitlist Demo ──"));
  const waitlistNames = ["Uma Shah", "Vic Torres", "Wen Liu", "Xena Park"];
  const waitlistIds: string[] = [];

  for (const name of waitlistNames) {
    const result = system.waitlist.enqueue({
      eventId: workshop.id,
      tierId: standardTier.id,
      customerName: name,
      customerEmail: `${name.toLowerCase().replace(" ", ".")}@example.com`,
      quantity: 1,
    });
    if (result.ok) {
      waitlistIds.push(result.value.id);
      logs.push(createLog("info", `  → ${name} joined waitlist at position #${result.value.priorityPosition}`));
    }
  }

  // Cancel a booking and auto-promote
  logs.push(createLog("system", "── Cancellation & Auto-Promotion ──"));
  const bookings = system.bookings.getBookingsByEvent(workshop.id);
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");

  if (confirmedBookings.length > 0) {
    const toCancel = confirmedBookings[0];
    logs.push(createLog("info", `  Cancelling booking: ${toCancel.bookingReference} (${toCancel.customerName})`));
    const cancelResult = system.cancelAndPromote(toCancel.id);
    if (cancelResult.ok && cancelResult.value.promoted) {
      logs.push(createLog("success", `  ✓ Promoted: ${cancelResult.value.promoted.entry.customerName} → ${cancelResult.value.promoted.booking.bookingReference}`));
    }
  }

  // Cancel another to promote more
  if (confirmedBookings.length > 1) {
    const toCancel2 = confirmedBookings[1];
    logs.push(createLog("info", `  Cancelling booking: ${toCancel2.bookingReference} (${toCancel2.customerName})`));
    const cancelResult2 = system.cancelAndPromote(toCancel2.id);
    if (cancelResult2.ok && cancelResult2.value.promoted) {
      logs.push(createLog("success", `  ✓ Promoted: ${cancelResult2.value.promoted.entry.customerName} → ${cancelResult2.value.promoted.booking.bookingReference}`));
    }
  }

  // Final state
  logs.push(createLog("system", "── Final State ──"));
  const finalQueue = system.waitlist.getQueue(workshop.id, standardTier.id);
  logs.push(createLog("info", `  Waitlist remaining: ${finalQueue.length} entries`));
  finalQueue.forEach((e) => {
    logs.push(createLog("info", `    Position #${e.priorityPosition}: ${e.customerName}`));
  });
  logs.push(createLog("success", "═══ DEMO JOURNEY COMPLETE ═══"));

  return logs;
}

// ─── Capacity Benchmark ───────────────────────────────────────────────────────

export function runCapacityBenchmark(iterations: number = 10000): { logs: LogEntry[]; result: BenchmarkResult } {
  const logs: LogEntry[] = [];
  const system = new CoreSystem();

  logs.push(createLog("system", `═══ CAPACITY BENCHMARK: ${iterations.toLocaleString()} iterations ═══`));
  logs.push(createLog("info", "Setting up stress test environment..."));

  // Create a small event to force contention
  const event = system.events.createEvent({
    title: "Stress Test Event",
    description: "High-concurrency booking test",
    category: "Test",
    venue: "Virtual",
    date: "2025-12-31T23:59:00Z",
    maxCapacity: 100,
  });
  system.events.addTier(event.id, { name: "General", price: 50, totalCapacity: 50 });
  system.events.addTier(event.id, { name: "VIP", price: 150, totalCapacity: 50 });
  system.events.publishEvent(event.id);

  const tier = event.tiers[0];
  const totalCapacity = tier.totalCapacity;

  logs.push(createLog("info", `Target: "${tier.name}" tier with capacity ${totalCapacity}`));
  logs.push(createLog("info", `Simulating ${iterations.toLocaleString()} booking attempts (mixed quantities 1-5)...`));

  const startTime = performance.now();
  let successCount = 0;
  let failCount = 0;
  let oversellCount = 0;
  let waitlistPromotions = 0;

  for (let i = 0; i < iterations; i++) {
    const quantity = Math.floor(Math.random() * 5) + 1;
    const result = system.bookOrWaitlist({
      eventId: event.id,
      tierId: tier.id,
      quantity,
      customerName: `User-${i}`,
      customerEmail: `user${i}@bench.test`,
    });

    if (result.ok) {
      successCount++;
    } else {
      failCount++;
    }

    // Verify invariant: bookedCount never exceeds totalCapacity
    const currentTier = system.events.getTierForUpdate(event.id, tier.id);
    if (currentTier && currentTier.bookedCount > currentTier.totalCapacity) {
      oversellCount++;
    }
  }

  // Test waitlist promotion cycle
  logs.push(createLog("info", "Running waitlist promotion cycle..."));
  const cancelBookings = system.bookings.getBookingsByEvent(event.id).filter((b) => b.status === "confirmed");
  const toCancelCount = Math.min(cancelBookings.length, 10);

  for (let i = 0; i < toCancelCount; i++) {
    const result = system.cancelAndPromote(cancelBookings[i].id);
    if (result.ok && result.value.promoted) {
      waitlistPromotions++;
    }
  }

  const endTime = performance.now();
  const totalDurationMs = endTime - startTime;
  const avgLatencyMs = totalDurationMs / iterations;

  const benchmarkResult: BenchmarkResult = {
    iterations,
    successCount,
    failCount,
    oversellCount,
    avgLatencyMs: Math.round(avgLatencyMs * 1000) / 1000,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    waitlistPromotions,
    peakMemoryEstimate: `${Math.round(iterations * 0.5)}KB (estimated)`,
  };

  logs.push(createLog("system", "── Benchmark Results ──"));
  logs.push(createLog("info", `  Total iterations:    ${benchmarkResult.iterations.toLocaleString()}`));
  logs.push(createLog("success", `  Successful ops:    ${benchmarkResult.successCount.toLocaleString()}`));
  logs.push(createLog("warn", `  Rejected ops:      ${benchmarkResult.failCount.toLocaleString()}`));
  logs.push(createLog(benchmarkResult.oversellCount === 0 ? "success" : "error", `  Oversell violations: ${benchmarkResult.oversellCount}`));
  logs.push(createLog("info", `  Waitlist promotions: ${benchmarkResult.waitlistPromotions}`));
  logs.push(createLog("info", `  Avg latency/op:    ${benchmarkResult.avgLatencyMs}ms`));
  logs.push(createLog("info", `  Total duration:    ${benchmarkResult.totalDurationMs}ms`));
  logs.push(createLog("info", `  Throughput:        ${Math.round(iterations / (totalDurationMs / 1000)).toLocaleString()} ops/sec`));

  if (benchmarkResult.oversellCount === 0) {
    logs.push(createLog("success", "  ✓ INVARIANT VERIFIED: Zero overselling detected"));
  } else {
    logs.push(createLog("error", `  ✗ INVARIANT VIOLATED: ${benchmarkResult.oversellCount} overselling events!`));
  }

  logs.push(createLog("system", "═══ BENCHMARK COMPLETE ═══"));

  return { logs, result: benchmarkResult };
}

// ─── Quick Validation ─────────────────────────────────────────────────────────

export function runQuickValidation(): LogEntry[] {
  const logs: LogEntry[] = [];
  const system = new CoreSystem();

  logs.push(createLog("system", "═══ DOMAIN INVARIANT CHECKS ═══"));

  // Test 1: Unique references
  logs.push(createLog("info", "Test 1: Booking reference uniqueness..."));
  const event = system.events.createEvent({
    title: "Validation Event",
    description: "Test",
    category: "Test",
    venue: "Test",
    date: "2025-01-01",
    maxCapacity: 1000,
  });
  system.events.addTier(event.id, { name: "GA", price: 10, totalCapacity: 1000 });
  system.events.publishEvent(event.id);

  const refs = new Set<string>();
  let uniquePass = true;
  for (let i = 0; i < 100; i++) {
    const r = system.bookings.createBooking({
      eventId: event.id,
      tierId: event.tiers[0].id,
      quantity: 1,
      customerName: `Test-${i}`,
      customerEmail: `t${i}@test.com`,
    });
    if (r.ok) {
      if (refs.has(r.value.bookingReference)) {
        uniquePass = false;
        break;
      }
      refs.add(r.value.bookingReference);
    }
  }
  logs.push(createLog(uniquePass ? "success" : "error", `  ${uniquePass ? "✓" : "✗"} 100 references: all unique`));

  // Test 2: Capacity enforcement
  logs.push(createLog("info", "Test 2: Capacity enforcement (oversell prevention)..."));
  const smallEvent = system.events.createEvent({
    title: "Small Event",
    description: "Capacity test",
    category: "Test",
    venue: "Test",
    date: "2025-01-01",
    maxCapacity: 5,
  });
  system.events.addTier(smallEvent.id, { name: "GA", price: 10, totalCapacity: 5 });
  system.events.publishEvent(smallEvent.id);

  let capPass = true;
  for (let i = 0; i < 10; i++) {
    const r = system.bookings.createBooking({
      eventId: smallEvent.id,
      tierId: smallEvent.tiers[0].id,
      quantity: 1,
      customerName: `Cap-${i}`,
      customerEmail: `c${i}@test.com`,
    });
    if (isErr(r) && r.error.code !== "INSUFFICIENT_CAPACITY") {
      capPass = false;
    }
  }
  const finalTier = system.events.getTierForUpdate(smallEvent.id, smallEvent.tiers[0].id);
  if (finalTier && finalTier.bookedCount > finalTier.totalCapacity) capPass = false;
  logs.push(createLog(capPass ? "success" : "error", `  ${capPass ? "✓" : "✗"} Booked ${finalTier?.bookedCount}/${finalTier?.totalCapacity} (never exceeded)`));

  // Test 3: FIFO ordering
  logs.push(createLog("info", "Test 3: FIFO waitlist ordering..."));
  const wlEvent = system.events.createEvent({
    title: "FIFO Test",
    description: "Queue test",
    category: "Test",
    venue: "Test",
    date: "2025-01-01",
    maxCapacity: 2,
  });
  system.events.addTier(wlEvent.id, { name: "GA", price: 10, totalCapacity: 2 });
  system.events.publishEvent(wlEvent.id);

  // Fill capacity
  system.bookings.createBooking({ eventId: wlEvent.id, tierId: wlEvent.tiers[0].id, quantity: 2, customerName: "Filler", customerEmail: "f@t.com" });

  // Add to waitlist in order
  const wlNames = ["First", "Second", "Third"];
  for (const name of wlNames) {
    system.waitlist.enqueue({ eventId: wlEvent.id, tierId: wlEvent.tiers[0].id, customerName: name, customerEmail: `${name}@t.com`, quantity: 1 });
  }

  // Cancel and promote - should get "First"
  const bookings = system.bookings.getBookingsByEvent(wlEvent.id);
  const cancelResult = system.cancelAndPromote(bookings[0].id);
  let fifoPass = false;
  if (cancelResult.ok && cancelResult.value.promoted) {
    fifoPass = cancelResult.value.promoted.entry.customerName === "First";
  }
  logs.push(createLog(fifoPass ? "success" : "error", `  ${fifoPass ? "✓" : "✗"} First-in promoted correctly (expected "First")`));

  logs.push(createLog("system", "═══ ALL CHECKS COMPLETE ═══"));
  return logs;
}