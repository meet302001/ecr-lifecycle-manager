import { useState } from "react";
import AwsConfig from "./components/AwsConfig";
import PolicyBuilder from "./components/PolicyBuilder";
import RepoSelector from "./components/RepoSelector";
import DryRunPanel from "./components/DryRunPanel";
import ApplyDashboard from "./components/ApplyDashboard";
import DryRunHistory from "./components/DryRunHistory";
import { Container } from "lucide-react";

const DEFAULT_POLICY = {
  rules: [
    { rulePriority: 1, description: "Expire untagged images after 1 day", selection: { tagStatus: "untagged", countType: "sinceImagePushed", countUnit: "days", countNumber: 1 }, action: { type: "expire" } },
    { rulePriority: 2, description: "Keep last 20 prod images", selection: { tagStatus: "tagged", tagPrefixList: ["prod"], countType: "imageCountMoreThan", countNumber: 20 }, action: { type: "expire" } },
    { rulePriority: 3, description: "Keep last 10 uat images", selection: { tagStatus: "tagged", tagPrefixList: ["uat"], countType: "imageCountMoreThan", countNumber: 10 }, action: { type: "expire" } },
    { rulePriority: 4, description: "Keep last 5 dev images", selection: { tagStatus: "tagged", tagPrefixList: ["dev"], countType: "imageCountMoreThan", countNumber: 5 }, action: { type: "expire" } },
    { rulePriority: 5, description: "Catch-all: keep last 5 of any other tagged images", selection: { tagStatus: "tagged", tagPatternList: ["*"], countType: "imageCountMoreThan", countNumber: 5 }, action: { type: "expire" } },
  ],
};

export default function App() {
  const [token, setToken] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [dryRunDone, setDryRunDone] = useState(false);
  const [history, setHistory] = useState([]);

  function handleConnected({ token, repos }) {
    setToken(token);
    setRepos(repos);
    setSelectedRepos(repos);
  }

  function handleDryRunComplete(results) {
    setDryRunDone(true);
  }

  function addHistoryEntry(entry) {
    setHistory((h) => [...h, entry]);
  }

  const steps = [
    { number: 1, label: "Configure AWS", done: !!token },
    { number: 2, label: "Build Policy", done: !!token },
    { number: 3, label: "Select Repos", done: selectedRepos.length > 0 },
    { number: 4, label: "Dry Run", done: dryRunDone },
    { number: 5, label: "Apply", done: false },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Container className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg leading-tight">ECR Lifecycle Manager</h1>
              <p className="text-slate-400 text-xs">AWS Elastic Container Registry</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="hidden md:flex items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  step.done ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${step.done ? "bg-green-500 text-white" : "bg-slate-600 text-slate-300"}`}>
                    {step.number}
                  </span>
                  {step.label}
                </div>
                {i < steps.length - 1 && <div className="w-4 h-px bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* AWS Config */}
        <AwsConfig onConnected={handleConnected} />

        {token && (
          <>
            {/* Policy Builder + Repo Selector side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PolicyBuilder onChange={setPolicy} />
              <RepoSelector repos={repos} selected={selectedRepos} onChange={setSelectedRepos} />
            </div>

            {/* Dry Run */}
            <DryRunPanel
              token={token}
              selectedRepos={selectedRepos}
              policy={policy}
              onComplete={handleDryRunComplete}
              onHistoryEntry={addHistoryEntry}
            />

            {/* Apply */}
            <ApplyDashboard
              token={token}
              selectedRepos={selectedRepos}
              policy={policy}
              dryRunDone={dryRunDone}
            />

            {/* History */}
            <DryRunHistory history={history} onClear={() => setHistory([])} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-700/50 mt-12 py-6">
        <p className="text-center text-slate-500 text-sm">ECR Lifecycle Manager — Open Source</p>
      </footer>
    </div>
  );
}
