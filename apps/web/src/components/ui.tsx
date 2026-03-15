import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export const Sidebar = () => (
  <aside className="w-full max-w-xs space-y-3 rounded-3xl bg-ink p-6 text-white shadow-xl">
    <h1 className="text-2xl font-black tracking-tight">note Local Draft Studio</h1>
    <p className="text-sm text-stone-300">記事生成、販売導線、保存フォールバックをローカルで回す。</p>
    <nav className="space-y-2 text-sm font-semibold">
      <Link className="block rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20" to="/">ダッシュボード</Link>
      <Link className="block rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20" to="/references">参考資料</Link>
      <Link className="block rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20" to="/settings">設定 / 診断</Link>
    </nav>
  </aside>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
  </label>
);

export const Toggle = ({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    {label}
  </label>
);

export const InfoCard = ({ title, content }: { title: string; content: string }) => (
  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
    <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-gold">{title}</div>
    <pre className="whitespace-pre-wrap text-sm text-stone-700">{content || "まだ生成されていない"}</pre>
  </div>
);

export const LoadingCard = ({ message }: { message: string }) => <div className="card p-8">{message}</div>;
