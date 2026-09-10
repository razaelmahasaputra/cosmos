export default function Docs() {
  return (
    <section className="section" id="docs">
      <div className="container narrow">
        <p className="section-label reveal">Docs</p>
        <h2 className="reveal">Command reference.</h2>
        <p className="section-sub reveal">
          Persisted with Prisma. All currency via <code>formatRupiah</code>,
          all replies in Formal English.
        </p>
        <div className="doc-card card reveal">
          <div className="doc-row">
            <code>.job list</code>
            <p>Displays available jobs, base salaries and cooldowns.</p>
          </div>
          <div className="doc-row">
            <code>.job join &lt;JobName|JobID&gt;</code>
            <p>
              Apply or switch jobs — e.g. <code>.job join 1</code> or{" "}
              <code>.job join Mining</code>. Switching may trigger a cooldown.
            </p>
          </div>
          <div className="doc-row">
            <code>.work</code>
            <p>
              Claim salary. Checks <code>lastWorkedAt</code> vs cooldown,
              applies <code>EconomyMultiplier</code>, updates{" "}
              <code>balance</code> + <code>lastWorkedAt</code>, replies
              formally.
            </p>
          </div>
          <div className="schema mono">
            {`model JobCatalog {
  id             Int
  name           String  // 'Mining', 'Office Work'
  baseSalary     BigInt
  cooldownMinutes Int
  requiredItemId String?
  isActive       Boolean
}`}
          </div>
        </div>
      </div>
    </section>
  );
}
