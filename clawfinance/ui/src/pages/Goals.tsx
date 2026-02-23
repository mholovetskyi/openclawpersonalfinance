import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { api } from "../lib/api.ts";

type Goal = {
  id: string;
  name: string;
  type: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  notes: string | null;
  is_active: boolean;
  progress_pct: number;
  created_at: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const GOAL_COLORS: Record<string, string> = {
  savings: "#22c55e",
  debt_payoff: "#ef4444",
  investment: "#6366f1",
  emergency_fund: "#f59e0b",
  custom: "#06b6d4",
};

const GOAL_LABELS: Record<string, string> = {
  savings: "Savings",
  debt_payoff: "Debt Payoff",
  investment: "Investment",
  emergency_fund: "Emergency Fund",
  custom: "Custom",
};

function GoalCard({ goal }: { goal: Goal }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(goal.current_amount));

  const updateMut = useMutation({
    mutationFn: (current_amount: number) =>
      api.put(`/api/goals/${goal.id}`, { current_amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/goals/${goal.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const color = GOAL_COLORS[goal.type] ?? GOAL_COLORS.custom;
  const pct = Math.min(100, goal.progress_pct);

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: color + "22", color }}
            >
              {GOAL_LABELS[goal.type] ?? goal.type}
            </span>
            {pct >= 100 && (
              <span className="text-xs text-green-400 font-medium">Completed!</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white mt-1">{goal.name}</h3>
          {goal.notes && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{goal.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => deleteMut.mutate()}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{fmt(goal.current_amount)}</span>
          <span className="text-gray-400">{fmt(goal.target_amount)}</span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span style={{ color }}>{pct.toFixed(0)}%</span>
          {goal.target_date && (
            <span className="text-gray-500">
              Target: {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-gray-400">$</span>
          <input
            className="flex-1 bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-600"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            autoFocus
          />
          <button
            onClick={() => updateMut.mutate(Number(amount))}
            disabled={updateMut.isPending}
            className="p-1.5 bg-claw-700 rounded text-white hover:bg-claw-600"
          >
            <Check size={12} />
          </button>
          <button onClick={() => setEditing(false)} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function AddGoalForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/api/goals", {
        name,
        type,
        target_amount: Number(targetAmount),
        current_amount: Number(currentAmount),
        target_date: targetDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      onClose();
    },
  });

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-claw-800 space-y-3">
      <h3 className="text-sm font-semibold text-white">New Financial Goal</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Goal Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Fund"
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          >
            {Object.entries(GOAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target Amount</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="50000"
            min="0"
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Amount</label>
          <input
            type="number"
            value={currentAmount}
            onChange={(e) => setCurrentAmount(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target Date (optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra context..."
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">
          Cancel
        </button>
        <button
          onClick={() => createMut.mutate()}
          disabled={!name || !targetAmount || createMut.isPending}
          className="px-4 py-1.5 bg-claw-700 hover:bg-claw-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {createMut.isPending ? "Creating..." : "Create Goal"}
        </button>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<{ data: Goal[] }>("/api/goals"),
  });

  const goals = data?.data ?? [];
  const activeGoals = goals.filter((g) => g.is_active);
  const completedGoals = goals.filter((g) => !g.is_active || g.progress_pct >= 100);

  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalCurrent = activeGoals.reduce((s, g) => s + g.current_amount, 0);
  const overallPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Goals", value: String(activeGoals.length) },
          { label: "Total Target", value: fmt(totalTarget) },
          { label: "Overall Progress", value: `${overallPct.toFixed(0)}%` },
        ].map((c) => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-white">{isLoading ? "--" : c.value}</p>
          </div>
        ))}
      </div>

      {/* Add button */}
      {showAdd ? (
        <AddGoalForm onClose={() => setShowAdd(false)} />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border border-dashed border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white hover:border-claw-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Financial Goal
        </button>
      )}

      {/* Active goals */}
      {isLoading ? (
        <p className="text-center text-gray-500 text-sm py-8">Loading goals...</p>
      ) : activeGoals.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Target className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 text-sm font-medium">No financial goals yet</p>
          <p className="text-gray-600 text-xs text-center max-w-xs">
            Set savings targets, debt payoff plans, or investment milestones to track your progress.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeGoals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60">
            {completedGoals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
