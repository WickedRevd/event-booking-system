// ─── Domain Visualizer Component ──────────────────────────────────────────────
// Interactive dashboard: events, bookings, capacity, FIFO waitlist

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Ticket, Users, ListOrdered, Plus, XCircle, ArrowUpCircle, MapPin, Clock, Tag } from "lucide-react";
import { CoreSystem, seedDemoEvents } from "@/core/domain";
import { isErr } from "@/core/types";
import type { Event, Booking, WaitlistEntry, LogEntry, LogLevel } from "@/core/types";

// Singleton system for the visualizer
let _system: CoreSystem | null = null;
function getSystem(): CoreSystem {
  if (!_system) {
    _system = new CoreSystem();
    seedDemoEvents(_system);
  }
  return _system;
}

type ActivityItem = { id: string; text: string; level: LogLevel; time: string };
let actId = 0;

export default function DomainVisualizer() {
  const system = getSystem();
  const [events, setEvents] = useState<Event[]>(() => system.events.getAllEvents());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(events[0] ?? null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [formTierId, setFormTierId] = useState("");

  const refresh = useCallback(() => {
    const evts = system.events.getAllEvents();
    setEvents([...evts]);
    if (selectedEvent) {
      const updated = evts.find((e) => e.id === selectedEvent.id) ?? null;
      setSelectedEvent(updated);
      setBookings(system.bookings.getBookingsByEvent(updated?.id ?? ""));
      setWaitlist(updated ? system.waitlist.getQueue(updated.id) : []);
    }
  }, [system, selectedEvent]);

  const addActivity = (text: string, level: LogLevel) => {
    setActivity((prev) => [{ id: `act-${++actId}`, text, level, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
  };

  const handleSelectEvent = (evt: Event) => {
    setSelectedEvent(evt);
    setShowBookingForm(false);
    setBookings(system.bookings.getBookingsByEvent(evt.id));
    setWaitlist(system.waitlist.getQueue(evt.id));
  };

  const handleCreateBooking = () => {
    if (!selectedEvent || !formTierId || !formName.trim()) return;
    const result = system.bookOrWaitlist({
      eventId: selectedEvent.id,
      tierId: formTierId,
      quantity: formQty,
      customerName: formName.trim(),
      customerEmail: formEmail.trim() || `${formName.toLowerCase().replace(/\s/g, ".")}@demo.io`,
    });

    if (isErr(result)) {
      addActivity(`Failed: ${result.error.message}`, "error");
    } else {
      if (result.value.type === "booking") {
        addActivity(`Booked: ${formName} → ${result.value.booking.bookingReference} (x${formQty})`, "success");
      } else {
        addActivity(`Waitlisted: ${formName} at position #${result.value.entry.priorityPosition}`, "warn");
      }
    }

    setFormName("");
    setFormEmail("");
    setFormQty(1);
    setShowBookingForm(false);
    refresh();
  };

  const handleCancelBooking = (bookingId: string) => {
    const result = system.cancelAndPromote(bookingId);
    if (result.ok) {
      const b = system.bookings.getBooking(bookingId);
      addActivity(`Cancelled: ${b?.bookingReference ?? bookingId}`, "warn");
      if (result.value.promoted) {
        addActivity(`Promoted: ${result.value.promoted.entry.customerName} from waitlist`, "success");
      }
    }
    refresh();
  };

  const handlePromoteWaitlist = () => {
    if (!selectedEvent || waitlist.length === 0) return;
    const entry = waitlist[0];
    const result = system.waitlist.promoteNext(selectedEvent.id, entry.tierId);
    if (isErr(result)) {
      addActivity(`Promotion failed: ${result.error.message}`, "error");
    } else {
      addActivity(`Promoted: ${result.value.entry.customerName} → ${result.value.booking.bookingReference}`, "success");
    }
    refresh();
  };

  const selectedTier = selectedEvent?.tiers.find((t) => t.id === formTierId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4 h-full min-h-0">
      {/* Event List */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Events</h3>
        {events.map((evt) => {
          const totalAvail = system.events.getEventTotalAvailable(evt.id);
          const totalCap = evt.tiers.reduce((s, t) => s + t.totalCapacity, 0);
          const pct = totalCap > 0 ? Math.round(((totalCap - totalAvail) / totalCap) * 100) : 0;
          return (
            <motion.button
              key={evt.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectEvent(evt)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selectedEvent?.id === evt.id
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={12} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-200 truncate">{evt.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{evt.category}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  evt.status === "sold_out" ? "bg-rose-500/20 text-rose-400" :
                  evt.status === "published" ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-slate-500/20 text-slate-400"
                }`}>{evt.status}</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{totalCap - totalAvail}/{totalCap} booked</div>
            </motion.button>
          );
        })}
      </div>

      {/* Main Panel */}
      <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
        {selectedEvent && (
          <>
            {/* Event Header */}
            <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedEvent.title}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{selectedEvent.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={11} />{selectedEvent.venue}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{new Date(selectedEvent.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Tag size={11} />{selectedEvent.category}</span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowBookingForm(!showBookingForm); if (!formTierId && selectedEvent.tiers[0]) setFormTierId(selectedEvent.tiers[0].id); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shrink-0"
                >
                  <Plus size={12} />
                  Book
                </motion.button>
              </div>
            </div>

            {/* Booking Form */}
            <AnimatePresence>
              {showBookingForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Customer name"
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="Email (optional)"
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <select
                        value={formTierId}
                        onChange={(e) => setFormTierId(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        {selectedEvent.tiers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} (${t.price})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formQty}
                        onChange={(e) => setFormQty(Math.max(1, Number(e.target.value)))}
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCreateBooking}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                      >
                        Confirm
                      </motion.button>
                    </div>
                    {selectedTier && (
                      <div className="text-xs text-slate-400">
                        Available: {selectedTier.totalCapacity - selectedTier.bookedCount} | Total: ${selectedTier.price * formQty}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tier Capacity Meters */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket Tiers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedEvent.tiers.map((tier) => {
                  const avail = tier.totalCapacity - tier.bookedCount;
                  const pct = Math.round((tier.bookedCount / tier.totalCapacity) * 100);
                  return (
                    <div key={tier.id} className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white flex items-center gap-1.5">
                          <Ticket size={12} className="text-slate-400" />{tier.name}
                        </span>
                        <span className="text-xs text-emerald-400 font-mono">${tier.price}</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1.5">
                        <motion.div
                          className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{tier.bookedCount} booked</span>
                        <span>{avail} available</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bookings Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Recent Bookings ({bookings.filter((b) => b.status === "confirmed").length} active)
              </h3>
              <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {bookings.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No bookings yet</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/80 sticky top-0">
                        <tr className="text-slate-400">
                          <th className="text-left px-3 py-2 font-medium">Ref</th>
                          <th className="text-left px-3 py-2 font-medium">Customer</th>
                          <th className="text-left px-3 py-2 font-medium">Qty</th>
                          <th className="text-left px-3 py-2 font-medium">Total</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {bookings.slice(0, 20).map((b) => (
                          <tr key={b.id} className="hover:bg-slate-800/40">
                            <td className="px-3 py-1.5 font-mono text-cyan-400">{b.bookingReference}</td>
                            <td className="px-3 py-1.5 text-slate-300">{b.customerName}</td>
                            <td className="px-3 py-1.5 text-slate-400">{b.quantity}</td>
                            <td className="px-3 py-1.5 text-slate-300">${b.totalPrice}</td>
                            <td className="px-3 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                                b.status === "cancelled" ? "bg-rose-500/20 text-rose-400" :
                                "bg-amber-500/20 text-amber-400"
                              }`}>{b.status}</span>
                            </td>
                            <td className="px-2 py-1.5">
                              {b.status === "confirmed" && (
                                <button
                                  onClick={() => handleCancelBooking(b.id)}
                                  className="text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Cancel booking"
                                >
                                  <XCircle size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Panel: Waitlist + Activity */}
      <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
        {/* FIFO Waitlist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListOrdered size={12} />FIFO Waitlist
            </h3>
            {waitlist.length > 0 && (
              <button
                onClick={handlePromoteWaitlist}
                className="text-[10px] px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors flex items-center gap-1"
              >
                <ArrowUpCircle size={10} />Promote Next
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {waitlist.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-slate-700 text-center text-xs text-slate-500">
                Queue empty
              </div>
            ) : (
              <AnimatePresence>
                {waitlist.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-700/50 bg-slate-800/40"
                  >
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                      #{entry.priorityPosition}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-white truncate">{entry.customerName}</div>
                      <div className="text-[10px] text-slate-500">qty: {entry.quantity}</div>
                    </div>
                    {idx === 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">NEXT</span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Activity Log */}
        <div className="flex-1 min-h-0 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={12} />Activity
          </h3>
          <div className="space-y-1 overflow-y-auto max-h-64">
            {activity.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">Interact to see activity</p>
            ) : (
              activity.map((a) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] py-1 px-2 rounded bg-slate-800/30 flex items-start gap-1.5"
                >
                  <span className="text-slate-600 shrink-0 font-mono">{a.time}</span>
                  <span className={LEVEL_COLORS[a.level] ?? "text-slate-300"}>{a.text}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  info: "text-slate-300",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-rose-400",
  system: "text-cyan-400",
};