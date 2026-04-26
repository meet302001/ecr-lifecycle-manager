import { Clock, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";

export default function DryRunHistory({ history, onClear }) {
  const [expanded, setExpanded] = useState({});

  if (history.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-600/50 p-2 rounded-lg">
            <Clock className="text-slate-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Dry Run History</h2>
            <p className="text-slate-400 text-sm">{history.length} session(s) this run</p>
          </div>
        </div>
        <button onClick={onClear} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={14} /> Clear
        </button>
      </div>

      <div className="space-y-3">
        {[...history].reverse().map((entry, i) => (
          <div key={i} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <button
              onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs font-mono">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-white text-sm">{entry.repos} repos scanned</span>
                {entry.totalExpire > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                    {entry.totalExpire} images to expire
                  </span>
                )}
                {entry.totalExpire === 0 && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Nothing to expire
                  </span>
                )}
              </div>
              {expanded[i] ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>

            {expanded[i] && (
              <div className="border-t border-slate-700 px-4 py-3 space-y-1">
                {entry.results.filter((r) => r.images?.length > 0).map((r) => (
                  <div key={r.repo} className="flex items-center justify-between text-sm py-1">
                    <span className="text-slate-300">{r.repo}</span>
                    <span className="text-red-400 text-xs">{r.images.length} to expire</span>
                  </div>
                ))}
                {entry.results.every((r) => !r.images?.length) && (
                  <p className="text-slate-500 text-sm">No images would be expired in this run.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
