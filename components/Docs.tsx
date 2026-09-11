import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const COMMANDS = [
  {
    cmd: ".job list",
    desc: "Displays available jobs, base salaries and cooldowns.",
  },
  {
    cmd: ".job join <JobName|JobID>",
    desc: "Apply or switch jobs — e.g. `.job join 1` or `.job join Mining`. Switching may trigger a cooldown.",
  },
  {
    cmd: ".work",
    desc: "Claim salary. Checks `lastWorkedAt` vs cooldown, applies `EconomyMultiplier`, updates `balance` + `lastWorkedAt`, replies formally.",
  },
];

function renderInlineCode(text: string) {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>
  );
}

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
        <Card className="doc-card card reveal overflow-hidden p-0">
          {COMMANDS.map((c, i) => (
            <div key={c.cmd}>
              <CardContent className="doc-row p-0">
                <code>{c.cmd}</code>
                <CardDescription className="mt-1">{renderInlineCode(c.desc)}</CardDescription>
              </CardContent>
              {i < COMMANDS.length - 1 && <Separator />}
            </div>
          ))}
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
        </Card>
      </div>
    </section>
  );
}
