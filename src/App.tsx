import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Terminal, FileText, GitBranch, Sun, Moon, ShieldCheck, Zap } from "lucide-react";
import DomainVisualizer from "@/components/DomainVisualizer";
import TerminalLogs from "@/components/TerminalLogs";

type Tab = "visualizer" | "terminal" | "docs";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "visualizer", label: "Domain Sandbox", icon: Activity },
  { id: "terminal", label: "Terminal Runner", icon: Terminal },
  { id: "docs", label: "Architecture", icon: FileText },
];

function DocsPanel() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/40">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <GitBranch size={18} className="text-emerald-400" />
          Build 1: Core Domain & Scaffolding
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Event Booking &amp; Ticket Management System — 9-Build Capstone Curriculum
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <ShieldCheck size={14} />ADR-001: Pure Domain Architecture
          </h3>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li>Zero external dependencies in core domain layer</li>
            <li>TypeScript strict mode with discriminated unions for Result type</li>
            <li>Event Manager, Booking Engine, Waitlist Engine as separate concerns</li>
            <li>CoreSystem facade binds engines with domain callbacks</li>
            <li>Non-oversell invariant enforced at BookingEngine level</li>
          </ul>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Zap size={14} />ADR-002: FIFO Waitlist Strategy
          </h3>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li>Array-based queue with timestamp ordering</li>
            <li>Auto-promotion on cancellation via CoreSystem.cancelAndPromote()</li>
            <li>Per-event/per-tier queue isolation</li>
            <li>Position recalculation on promotion</li>
            <li>Entries track: waiting, promoted, expired states</li>
          </ul>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Domain Contracts</h3>
          <div className="text-xs text-slate-400 font-mono space-y-1">
            <p className="text-emerald-400">bookedCount + qty &lt;= totalCapacity</p>
            <p className="text-cyan-400">waitlist[0].joinedAt &lt;= waitlist[n].joinedAt</p>
            <p className="text-amber-400">bookingRef = &quot;BK-&quot; + crypto_random(6)</p>
            <p className="text-violet-400">event.status = f(tier availability)</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
          <h3 className="text-sm font-semibold text-violet-400 mb-3">Git Workflow</h3>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li>Branch: <code className="text-emerald-400">build-1</code> (feature branch)</li>
            <li>Target: <code className="text-slate-300">main</code> via PR</li>
            <li>Node.js v22.13+ runtime requirement</li>
            <li>9 sequential build branches planned</li>
            <li>Each build adds one capability layer</li>
          </ul>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40">
        <h3 className="text-sm font-semibold text-white mb-3">Curriculum Roadmap</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          {[
            { n: 1, label: "Core Domain + Scaffolding", done: true },
            { n: 2, label: "Search & Sorting + Tests", done: false },
            { n: 3, label: "REST API Skeleton", done: false },
            { n: 4, label: "State Machines", done: false },
            { n: 5, label: "SQLite Persistence", done: false },
            { n: 6, label: "Consumer Frontend", done: false },
            { n: 7, label: "Auth & RBAC", done: false },
            { n: 8, label: "Refunds & Timers", done: false },
            { n: 9, label: "QR Check-in + CI", done: false },
          ].map((b) => (
            <div
              key={b.n}
              className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
                b.done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700/50 bg-slate-800/30 text-slate-500"
              }`}
            >
              <span className="font-bold">B{b.n}</span>
              <span className="truncate">{b.label}</span>
              {b.done && <span className="ml-auto">✓</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <h3 className="text-sm font-semibold text-emerald-400 mb-2">PR: build-1 → main</h3>
        <div className="text-xs text-slate-400 space-y-1.5">
          <p><strong className="text-white">Title:</strong> feat(build-1): Core domain engine, FIFO waitlist, capacity enforcement</p>
          <p><strong className="text-white">Summary:</strong> Implements pure TypeScript domain models for events, ticket tiers, bookings, and waitlist with strict non-oversell invariant. Includes interactive visualizer, terminal demo runner, and 10K-iteration benchmark.</p>
          <p><strong className="text-white">Verification:</strong> Benchmark reports 0 overselling violations across 10,000 synthetic operations. All domain invariants pass validation suite.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("visualizer");
  const [dark, setDark] = useState(true);

  return (
    <div className={`${dark ? "dark" : ""}`}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-800/80 px-5 py-3 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Activity size={14} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Event Booking System</h1>
              <p className="text-[10px] text-slate-500 leading-tight">Build 1 — Core Domain Engine</p>
            </div>
          </div>

          {/* Status Pills */}
          <div className="hidden md:flex items-center gap-2 ml-4">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Node v22.13+
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              branch: build-1
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              0 dependencies
            </span>
          </div>

          <div className="flex-1" />

          {/* Theme Toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="px-5 pt-3 shrink-0">
          <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1 w-fit border border-slate-800/50">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-slate-700/60 rounded-md"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={12} className="relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-h-0 p-5 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === "visualizer" && <DomainVisualizer />}
              {activeTab === "terminal" && <TerminalLogs />}
              {activeTab === "docs" && (
                <div className="overflow-y-auto h-full pr-2">
                  <DocsPanel />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="px-5 py-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-600 shrink-0">
          <span>Capstone Curriculum — Build 1 of 9</span>
          <span className="font-mono">src/core/domain.ts | EventManager + BookingEngine + WaitlistEngine</span>
        </footer>
      </div>
    </div>
  );
}
