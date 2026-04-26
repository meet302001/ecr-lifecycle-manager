import { useState } from "react";
import { Rocket, CheckCircle, XCircle, Loader, ShieldAlert } from "lucide-react";

export default function ApplyDashboard({ token, selectedRepos, policy, dryRunDone }) {
  const [status, setStatus] = useState("idle"); // idle | confirming | applying | done
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState("");

  async function applyPolicies() {
    setStatus("applying");
    setProgress([]);
    setError("");

    try {
      const res = await fetch("/api/ecr?action=apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repos: selectedRepos, policy }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const event = JSON.parse(line.replace("data: ", ""));
          if (event.done) {
            setStatus("done");
          } else {
            setProgress((p) => [...p, event]);
          }
        }
      }
    } catch (err) {
      setStatus("idle");
      setError(err.message);
    }
  }

  const succeeded = progress.filter((p) => p.status === "success").length;
  const failed = progress.filter((p) => p.status === "failed").length;
  const progressPct = selectedRepos.length > 0 ? Math.round((progress.length / selectedRepos.length) * 100) : 0;

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-500/20 p-2 rounded-lg">
          <Rocket className="text-red-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Apply Lifecycle Policies</h2>
          <p className="text-slate-400 text-sm">Deploy policy to {selectedRepos.length} selected repositories</p>
        </div>
      </div>

      {!dryRunDone && (
        <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm mb-4">
          <ShieldAlert size={16} /> Complete a dry run first before applying
        </div>
      )}

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {status === "idle" && dryRunDone && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4">
          <p className="text-red-300 font-medium mb-1">⚠ This action is irreversible</p>
          <p className="text-slate-400 text-sm">
            Lifecycle policies will be applied to <strong className="text-white">{selectedRepos.length} repositories</strong>. Images matching the expiry rules will be permanently deleted over time.
          </p>
        </div>
      )}

      {status === "idle" && (
        <button
          onClick={() => setStatus("confirming")}
          disabled={!dryRunDone || selectedRepos.length === 0}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Rocket size={16} /> Approve & Apply
        </button>
      )}

      {status === "confirming" && (
        <div className="bg-slate-900 border border-red-500/40 rounded-xl p-5 space-y-4">
          <p className="text-white font-medium">Are you absolutely sure?</p>
          <p className="text-slate-400 text-sm">This will write lifecycle policies to all {selectedRepos.length} selected ECR repositories.</p>
          <div className="flex gap-3">
            <button
              onClick={applyPolicies}
              className="bg-red-600 hover:bg-red-500 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Yes, Apply Now
            </button>
            <button
              onClick={() => setStatus("idle")}
              className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(status === "applying" || status === "done") && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">{progress.length}</p>
              <p className="text-slate-400 text-xs mt-1">Processed</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-green-400">{succeeded}</p>
              <p className="text-slate-400 text-xs mt-1">Succeeded</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-400">{failed}</p>
              <p className="text-slate-400 text-xs mt-1">Failed</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {progress.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${
                p.status === "success" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
              }`}>
                {p.status === "success"
                  ? <CheckCircle size={16} className="text-green-400 shrink-0" />
                  : <XCircle size={16} className="text-red-400 shrink-0" />}
                <span className={p.status === "success" ? "text-green-300" : "text-red-300"}>{p.repo}</span>
                {p.error && <span className="text-xs text-red-400 ml-auto">{p.error}</span>}
              </div>
            ))}
            {status === "applying" && progress.length < selectedRepos.length && (
              <div className="flex items-center gap-3 px-4 py-2.5 text-slate-400 text-sm">
                <Loader size={16} className="animate-spin" /> Applying...
              </div>
            )}
          </div>

          {status === "done" && (
            <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
              <CheckCircle size={16} /> All done! Policies applied successfully to {succeeded} repositories.
            </div>
          )}
        </>
      )}
    </div>
  );
}
