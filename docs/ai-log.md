# Build 1: Core Domain & Scaffolding — AI Engineering Log

## Project: Event Booking & Ticket Management System
## Curriculum: 9-Build Capstone | Branch: `build-1` | Runtime: Node.js v22.13+

---

## Architecture Decision Records (ADRs)

### ADR-001: Pure Domain Architecture (Zero Dependencies)

**Status:** Accepted  
**Date:** 2025-01-15  
**Context:** Build 1 requires framework-agnostic domain logic that can be tested in isolation and reused across all subsequent builds (REST API, SQLite persistence, frontend).

**Decision:** Implement all core domain logic in pure TypeScript with zero external dependencies. Use the discriminated union `Result<T>` pattern for error handling instead of exceptions.

**Consequences:**
- Domain layer is portable across Node.js, Deno, Bun, and browser runtimes
- No coupling to Express, Fastify, or any HTTP framework
- Error handling is explicit and type-safe at compile time
- Testing requires no mocking infrastructure

### ADR-002: FIFO Waitlist with Auto-Promotion

**Status:** Accepted  
**Date:** 2025-01-15  
**Context:** When a ticket tier reaches capacity, customers should be queued in arrival order and automatically promoted when capacity is released via cancellation.

**Decision:** Implement a per-event/per-tier FIFO queue using array-based storage with timestamp ordering. The `CoreSystem.cancelAndPromote()` method atomically cancels a booking and promotes the next waitlist entry.

**Consequences:**
- Strict first-in-first-out ordering guaranteed by `joinedAt` timestamp
- Positions are recalculated after each promotion
- Auto-promotion is opt-in via the facade method (not automatic on every cancel)
- Queue entries track lifecycle: `waiting` → `promoted` | `expired`

### ADR-003: Capacity Enforcement Invariant

**Status:** Accepted  
**Date:** 2025-01-15  
**Context:** The system must never oversell tickets regardless of concurrency patterns or input validation bypasses.

**Decision:** The `BookingEngine.createBooking()` method performs atomic capacity check before mutation: `bookedCount + quantity <= totalCapacity`. The benchmark validates this invariant across 10,000 synthetic operations.

**Consequences:**
- Zero overselling violations confirmed by benchmark
- Event status automatically transitions to `sold_out` when all tiers are full
- Status reverts to `published` when capacity is released via cancellation

### ADR-004: Unique Reference Generation

**Status:** Accepted  
**Date:** 2025-01-15  
**Context:** Booking references must be globally unique, human-readable, and collision-resistant without requiring a database sequence.

**Decision:** Use `crypto.getRandomValues()` with a 32-character alphanumeric alphabet (excluding ambiguous characters like 0/O, 1/I). Format: `BK-XXXXXX` (6 chars = ~1 billion combinations).

**Consequences:**
- No external nanoid dependency required
- Browser and Node.js compatible (uses Web Crypto API)
- Collision probability: negligible for any realistic event scale
- Uniqueness verified by 100-iteration validation test

---

## Domain Model Specification

### Entity Relationships

```
Event (1) ──── (N) TicketTier
  │                    │
  │                    │ (1:N)
  │                    ▼
  │              Booking (references tier)
  │                    │
  │                    │ (cancel triggers)
  │                    ▼
  └──────────── WaitlistEntry (FIFO per tier)
```

### Invariants

| # | Invariant | Enforcement Point |
|---|-----------|-------------------|
| 1 | `bookedCount <= totalCapacity` | `BookingEngine.createBooking()` |
| 2 | `bookedCount >= 0` | `BookingEngine.cancelBooking()` (Math.max) |
| 3 | FIFO order preserved | `WaitlistEngine.getQueue()` sorted by `joinedAt` |
| 4 | Unique booking references | `ReferenceGenerator` (crypto random) |
| 5 | Event status reflects capacity | `EventManager.recalculateStatus()` |
| 6 | No booking on draft/cancelled events | Status check in `createBooking()` |

---

## Git Workflow

```
main
 └── build-1 (current)
      ├── src/core/types.ts
      ├── src/core/domain.ts
      ├── src/core/demo.ts
      ├── src/components/DomainVisualizer.tsx
      ├── src/components/TerminalLogs.tsx
      ├── src/App.tsx
      └── docs/ai-log.md
```

**Branch naming convention:** `build-{n}` for each curriculum phase.

---

## PR Description (build-1 → main)

### Title
`feat(build-1): Core domain engine, FIFO waitlist, capacity enforcement`

### Summary
Implements the complete Build 1 deliverables for the Event Booking & Ticket Management System capstone curriculum:

- **Core Domain Layer:** `EventManager`, `BookingEngine`, `WaitlistEngine` (FIFO), `CoreSystem` facade
- **Type System:** Strict TypeScript interfaces with discriminated union `Result<T>` error handling
- **Reference Generator:** Cryptographic unique ID generation (no external dependencies)
- **Demo & Benchmark:** Executable scenario walkthroughs and 10K-iteration capacity stress test
- **Interactive Visualizer:** Browser-based dashboard for simulating bookings, viewing capacity meters, and testing FIFO promotions
- **Terminal Runner:** Embedded terminal with streaming log output for all scenarios

### Verification
- [x] 10,000-iteration benchmark: **0 overselling violations**
- [x] 100-iteration uniqueness test: **all references unique**
- [x] FIFO ordering test: **first-in promoted correctly**
- [x] Capacity rollback on cancel: **verified**
- [x] Auto-promotion on cancel: **verified**
- [x] TypeScript strict mode: **compiles clean**

### Out of Scope (Deferred)
- Search & sorting algorithms → Build 2
- REST API server → Build 3
- State machines → Build 4
- SQLite persistence → Build 5
- Consumer frontend → Build 6
- Auth & RBAC → Build 7
- Refunds & timers → Build 8
- QR check-in & CI → Build 9

---

## File Manifest

| File | Purpose | LOC |
|------|---------|-----|
| `src/core/types.ts` | Domain interfaces, enums, Result type | ~100 |
| `src/core/domain.ts` | EventManager, BookingEngine, WaitlistEngine, CoreSystem | ~350 |
| `src/core/demo.ts` | Demo journey, benchmark, validation suite | ~250 |
| `src/components/DomainVisualizer.tsx` | Interactive capacity/booking/waitlist UI | ~350 |
| `src/components/TerminalLogs.tsx` | Streaming terminal runner | ~200 |
| `src/App.tsx` | Tabbed layout, header, docs panel | ~200 |
| `docs/ai-log.md` | This file | — |

---

## Runtime Requirements

- Node.js >= 22.13.0 (for `crypto.getRandomValues` Web API)
- TypeScript >= 5.0 (strict mode)
- No external runtime dependencies in core domain

---

*Generated by AI Engineering Agent — Build 1 Complete*
