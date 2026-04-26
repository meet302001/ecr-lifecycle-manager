import { useState } from "react";
import { Cloud, CheckCircle, XCircle, Loader } from "lucide-react";

export default function AwsConfig({ onConnected }) {
  const [form, setForm] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    accountId: "",
    region: "us-east-1",
  });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState("");

  const regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
    "eu-west-1", "eu-west-2", "eu-central-1", "ca-central-1",
  ];

  async function handleConnect(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/ecr?action=connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKeyId: form.accessKeyId,
          secretAccessKey: form.secretAccessKey,
          region: form.region,
        }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`); }
      if (!res.ok) throw new Error(data.error);
      setStatus("success");
      onConnected({ token: data.token, repos: data.repos });
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-500/20 p-2 rounded-lg">
          <Cloud className="text-blue-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">AWS Configuration</h2>
          <p className="text-slate-400 text-sm">Enter your credentials to connect to ECR</p>
        </div>
      </div>

      <form onSubmit={handleConnect} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">AWS Access Key ID</label>
            <input
              type="text"
              placeholder="AKIA..."
              value={form.accessKeyId}
              onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">AWS Secret Access Key</label>
            <input
              type="password"
              placeholder="••••••••••••••••••••"
              value={form.secretAccessKey}
              onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">AWS Account ID</label>
            <input
              type="text"
              placeholder="123456789012"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Region</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
            <XCircle size={16} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          {status === "loading" && <Loader size={16} className="animate-spin" />}
          {status === "success" && <CheckCircle size={16} />}
          {status === "success" ? "Connected" : status === "loading" ? "Connecting..." : "Connect to AWS"}
        </button>
      </form>
    </div>
  );
}
