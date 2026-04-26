import { useState } from "react";
import { Eye, ChevronDown, ChevronRight, Loader, AlertTriangle, CheckCircle } from "lucide-react";

export default function DryRunPanel({ credentials, selectedRepos, policy, onComplete, onHistoryEntry }) {
  const [status, setStatus] = useState("idle"); // idle | running | polling | done | error
  const [results, setResults] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState("");

  async function runDryRun() {
    setStatus("running");
    setError("");
    setResults([]);

    try {
      // Start previews
      await fetch("/api/ecr/dry-run/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials, repos: selectedRepos, policy }),
      });

      // Poll until all complete
      setStatus("polling");
      let allDone = false;
      let pollResults = [];

      while (!allDone) {
        await new Promise((r) => setTimeout(r, 4000));
        const res = await fetch("/api/ecr/dry-run/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials, repos: selectedRepos }),
        });
        const data = await res.json();
        pollResults = data.results;
        setResults([...pollResults]);
        allDone = pollResults.every((r) => r.status === "COMPLETE" || r.status === "FAILED");
      }

      setStatus("done");
      const totalExpire = pollResults.reduce((acc, r) => acc + (r.images?.length || 0), 0);
      onHistoryEntry({ timestamp: new Date().toISOString(), repos: selectedRepos.length, totalExpire, results: pollResults });
      onComplete(pollResults);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  const totalExpire = results.reduce((acc, r) => acc + (r.images?.length || 0), 0);

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500/20 p-2 rounded-lg">
            <Eye className="text-yellow-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Dry Run Preview</h2>
            <p className="text-slate-400 text-sm">See what will be deleted before applying</p>
          </div>
        </div>
        <button
          onClick={runDryRun}
          disabled={status === "running" || status === "polling" || selectedRepos.length === 0}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          {(status === "running" || status === "polling") && <Loader size={16} className="animate-spin" />}
          {status === "running" || status === "polling" ? "Running..." : "Run Dry Run"}
        </button>
      </div>

      {selectedRepos.length === 0 && (
        <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={16} /> Select at least one repository first
        </div>
      )}

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">{selectedRepos.length}</p>
              <p className="text-slate-400 text-xs mt-1">Repos Scanned</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-400">{totalExpire}</p>
              <p className="text-slate-400 text-xs mt-1">Images to Expire</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-green-400">
                {results.filter((r) => r.status === "COMPLETE").length}
              </p>
              <p className="text-slate-400 text-xs mt-1">Completed</p>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {results.map((r) => (
              <div key={r.repo} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [r.repo]: !e[r.repo] }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {r.status === "COMPLETE" ? (
                      <CheckCircle size={16} className="text-green-400 shrink-0" />
                    ) : r.status === "FAILED" ? (
                      <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    ) : (
                      <Loader size={16} className="text-yellow-400 animate-spin shrink-0" />
                    )}
                    <span className="text-white text-sm font-medium">{r.repo}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.images?.length > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                        {r.images.length} to expire
                      </span>
                    )}
                    {expanded[r.repo] ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  </div>
                </button>

                {expanded[r.repo] && r.images?.length > 0 && (
                  <div className="border-t border-slate-700 px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="text-left py-1">Tags</th>
                          <th className="text-left py-1">Digest</th>
                          <th className="text-left py-1">Pushed At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.images.map((img, i) => (
                          <tr key={i} className="text-slate-300 border-t border-slate-800">
                            <td className="py-1.5">{img.tags?.join(", ") || <span className="text-slate-500">untagged</span>}</td>
                            <td className="py-1.5 font-mono text-slate-400">{img.digest?.slice(0, 20)}...</td>
                            <td className="py-1.5">{img.pushedAt ? new Date(img.pushedAt).toLocaleDateString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {expanded[r.repo] && r.images?.length === 0 && (
                  <div className="border-t border-slate-700 px-4 py-3 text-slate-500 text-xs">No images would be expired.</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
