import { useState, useMemo } from "react";
import { Database, Search, CheckSquare, Square } from "lucide-react";

export default function RepoSelector({ repos, selected, onChange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => repos.filter((r) => r.toLowerCase().includes(search.toLowerCase())),
    [repos, search]
  );

  function toggleAll() {
    if (selected.length === repos.length) onChange([]);
    else onChange([...repos]);
  }

  function toggle(repo) {
    if (selected.includes(repo)) onChange(selected.filter((r) => r !== repo));
    else onChange([...selected, repo]);
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-500/20 p-2 rounded-lg">
          <Database className="text-green-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Repository Selection</h2>
          <p className="text-slate-400 text-sm">{selected.length} of {repos.length} repos selected</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 text-sm"
          />
        </div>
        <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white border border-slate-600 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap">
          {selected.length === repos.length ? <CheckSquare size={16} className="text-green-400" /> : <Square size={16} />}
          {selected.length === repos.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.map((repo) => {
          const isSelected = selected.includes(repo);
          return (
            <button
              key={repo}
              onClick={() => toggle(repo)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors text-left ${
                isSelected
                  ? "bg-green-500/10 border border-green-500/30 text-green-300"
                  : "bg-slate-900 border border-transparent text-slate-300 hover:border-slate-600"
              }`}
            >
              {isSelected ? <CheckSquare size={16} className="text-green-400 shrink-0" /> : <Square size={16} className="text-slate-500 shrink-0" />}
              {repo}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 py-6 text-sm">No repositories match your search</p>
        )}
      </div>
    </div>
  );
}
