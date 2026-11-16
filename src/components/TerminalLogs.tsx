// ─── Terminal Logs Component ──────────────────────────────────────────────────
// Interactive terminal runner for demo & benchmark execution

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Play, Zap, Copy, Check, Trash2, ShieldCheck } from "lucide-react";
import { runFullDemoJourney, runCapacityBenchmark, runQuickValidation } from "@/core/demo";
import type { LogEntry, LogLevel } from "@/core/types";

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-slate-300",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-rose-400",
  system: "text-cyan-400",
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  info: "→",
  success: "✓",
  warn: "!",
  error: "✗",
  system: "═",
};

export default function TerminalLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const streamLogs = useCallback((newLogs: LogEntry[]) => {
    // Clear any existing interval before starting a new stream
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(true);
    setLogs([]);
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < newLogs.length) {
        const entry = newLogs[i]; // Capture synchronously before dispatching state update
        setLogs((prev) => [...prev, entry]);
        i++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsRunning(false);
      }
    }, 40);
  }, []);

  const handleRunDemo = () => {
    const result = runFullDemoJourney();
    streamLogs(result);
  };

  const handleRunBenchmark = () => {
    const { logs: result } = runCapacityBenchmark(10000);
    streamLogs(result);
  };

  const handleRunValidation = () => {
    const result = runQuickValidation();
    streamLogs(result);
  };

  const handleCopy = async () => {
    const text = logs
      .filter(Boolean)
      .map((l) => `[${l?.timestamp ?? ""}] ${l?.message ?? ""}`)
      .join(String.fromCharCode(10));
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => setLogs([]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRunDemo}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Play size={14} />
          Run Demo Journey
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRunBenchmark}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Zap size={14} />
          Benchmark 10K
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRunValidation}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <ShieldCheck size={14} />
          Validate Invariants
        </motion.button>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          disabled={logs.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleClear}
          disabled={logs.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-700/50 bg-slate-950 overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-slate-700/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs text-slate-400 font-mono ml-2">
            core-domain@build-1:~
          </span>
          {isRunning && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-auto text-xs text-emerald-400 font-mono"
            >
              running...
            </motion.span>
          )}
        </div>

        {/* Log Output */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
              <Terminal size={32} className="opacity-40" />
              <p>Run a scenario to see output here</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {logs.filter(Boolean).map((log) => (
              <motion.div
                key={log?.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2 py-0.5"
              >
                <span className="text-slate-600 shrink-0">
                  {log?.timestamp ? log.timestamp.slice(11, 23) : ""}
                </span>
                <span className={`shrink-0 w-4 text-center ${LEVEL_COLORS[log?.level] ?? "text-slate-300"}`}>
                  {LEVEL_ICONS[log?.level] ?? "→"}
                </span>
                <span className={LEVEL_COLORS[log?.level] ?? "text-slate-300"}>{log?.message ?? ""}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {isRunning && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-emerald-400 ml-1"
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/60 border-t border-slate-700/50 text-[10px] text-slate-500 font-mono">
          <span>{logs.length} entries</span>
          <span>Node.js v22.13+ compatible | Zero external deps</span>
        </div>
      </div>
    </div>
  );
}