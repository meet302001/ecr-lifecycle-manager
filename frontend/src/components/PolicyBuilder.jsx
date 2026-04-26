import { useState } from "react";
import { Plus, Trash2, Settings } from "lucide-react";

const PRESETS = {
  conservative: {
    untaggedDays: 7,
    catchAllKeep: 10,
    rules: [
      { tag: "prod", keep: 30 },
      { tag: "uat", keep: 15 },
      { tag: "dev", keep: 10 },
    ],
  },
  standard: {
    untaggedDays: 1,
    catchAllKeep: 5,
    rules: [
      { tag: "prod", keep: 20 },
      { tag: "uat", keep: 10 },
      { tag: "dev", keep: 5 },
    ],
  },
  aggressive: {
    untaggedDays: 1,
    catchAllKeep: 3,
    rules: [
      { tag: "prod", keep: 10 },
      { tag: "uat", keep: 5 },
      { tag: "dev", keep: 3 },
    ],
  },
};

export default function PolicyBuilder({ onChange }) {
  const [untaggedDays, setUntaggedDays] = useState(1);
  const [catchAllKeep, setCatchAllKeep] = useState(5);
  const [rules, setRules] = useState([
    { tag: "prod", keep: 20 },
    { tag: "uat", keep: 10 },
    { tag: "dev", keep: 5 },
  ]);
  const [activePreset, setActivePreset] = useState("standard");
  const [showJson, setShowJson] = useState(false);

  function buildPolicy(r = rules, u = untaggedDays, c = catchAllKeep) {
    const statements = [
      {
        rulePriority: 1,
        description: `Expire untagged images after ${u} day(s)`,
        selection: { tagStatus: "untagged", countType: "sinceImagePushed", countUnit: "days", countNumber: u },
        action: { type: "expire" },
      },
      ...r.map((rule, i) => ({
        rulePriority: i + 2,
        description: `Keep last ${rule.keep} ${rule.tag} images`,
        selection: { tagStatus: "tagged", tagPrefixList: [rule.tag], countType: "imageCountMoreThan", countNumber: rule.keep },
        action: { type: "expire" },
      })),
      {
        rulePriority: r.length + 2,
        description: `Catch-all: keep last ${c} of any other tagged images`,
        selection: { tagStatus: "tagged", tagPatternList: ["*"], countType: "imageCountMoreThan", countNumber: c },
        action: { type: "expire" },
      },
    ];
    return { rules: statements };
  }

  function update(newRules, newU, newC) {
    const policy = buildPolicy(newRules, newU, newC);
    onChange(policy);
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    setUntaggedDays(p.untaggedDays);
    setCatchAllKeep(p.catchAllKeep);
    setRules(p.rules);
    setActivePreset(name);
    update(p.rules, p.untaggedDays, p.catchAllKeep);
  }

  function addRule() {
    const newRules = [...rules, { tag: "", keep: 5 }];
    setRules(newRules);
    update(newRules, untaggedDays, catchAllKeep);
  }

  function removeRule(i) {
    const newRules = rules.filter((_, idx) => idx !== i);
    setRules(newRules);
    update(newRules, untaggedDays, catchAllKeep);
  }

  function updateRule(i, field, value) {
    const newRules = rules.map((r, idx) => idx === i ? { ...r, [field]: field === "keep" ? Number(value) : value } : r);
    setRules(newRules);
    update(newRules, untaggedDays, catchAllKeep);
  }

  const policy = buildPolicy();

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/20 p-2 rounded-lg">
            <Settings className="text-purple-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Policy Builder</h2>
            <p className="text-slate-400 text-sm">Define image retention rules</p>
          </div>
        </div>
        <button onClick={() => setShowJson(!showJson)} className="text-xs text-slate-400 hover:text-white border border-slate-600 px-3 py-1.5 rounded-lg transition-colors">
          {showJson ? "Hide JSON" : "Preview JSON"}
        </button>
      </div>

      {/* Presets */}
      <div className="mb-6">
        <p className="text-sm text-slate-400 mb-2">Quick Presets</p>
        <div className="flex gap-2">
          {Object.keys(PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activePreset === p
                  ? "bg-purple-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Untagged rule */}
      <div className="mb-4 bg-slate-900 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Untagged Images</p>
            <p className="text-slate-400 text-xs">Delete untagged images after N days</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={untaggedDays}
              onChange={(e) => { setUntaggedDays(Number(e.target.value)); update(rules, Number(e.target.value), catchAllKeep); }}
              className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-purple-500"
            />
            <span className="text-slate-400 text-sm">days</span>
          </div>
        </div>
      </div>

      {/* Tag rules */}
      <div className="space-y-3 mb-4">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Tag Prefix</label>
              <input
                type="text"
                placeholder="e.g. prod"
                value={rule.tag}
                onChange={(e) => updateRule(i, "tag", e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-slate-400 mb-1">Keep last N</label>
              <input
                type="number"
                min={1}
                value={rule.keep}
                onChange={(e) => updateRule(i, "keep", e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-purple-500"
              />
            </div>
            <button onClick={() => removeRule(i)} className="mt-5 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRule} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 mb-6 transition-colors">
        <Plus size={16} /> Add Tag Rule
      </button>

      {/* Catch-all */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Catch-all (other tagged images)</p>
            <p className="text-slate-400 text-xs">Any image not matching above rules</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={catchAllKeep}
              onChange={(e) => { setCatchAllKeep(Number(e.target.value)); update(rules, untaggedDays, Number(e.target.value)); }}
              className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-purple-500"
            />
            <span className="text-slate-400 text-sm">images</span>
          </div>
        </div>
      </div>

      {showJson && (
        <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-green-400 overflow-auto max-h-64">
          {JSON.stringify(policy, null, 2)}
        </pre>
      )}
    </div>
  );
}
