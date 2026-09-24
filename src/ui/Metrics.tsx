// 界面层：台顶指标条。

interface Metric {
  label: string;
  value: number;
  tone: "ok" | "watch" | "danger" | "neutral";
}

export function Metrics({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metrics-grid">
      {metrics.map((m) => (
        <article key={m.label} className={`metric-card tone-${m.tone}`}>
          <span>{m.label}</span>
          <strong>{m.value}</strong>
          <i className={`status-dot dot-${m.tone}`} />
        </article>
      ))}
    </section>
  );
}
