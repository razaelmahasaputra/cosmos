"use client";

import { useMemo, useState } from "react";
import { CHANGELOG, CHANGELOG_FILTERS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_SIZE = 5;

export default function Changelog() {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () =>
      CHANGELOG.filter(
        (e) => activeFilter === "All" || e.cats.includes(activeFilter)
      ),
    [activeFilter]
  );

  const visible = filtered.slice(0, shown);

  return (
    <section className="section section-alt" id="changelog">
      <div className="container narrow">
        <p className="section-label reveal">Changelog</p>
        <h2 className="reveal">What&apos;s New</h2>
        <p className="section-sub reveal">
          Cosmos is actively developed. Here&apos;s a running log of every
          update.
        </p>
        <div className="filters reveal" id="filters">
          {CHANGELOG_FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              variant={activeFilter === f ? "secondary" : "ghost"}
              size="sm"
              className={`chip${activeFilter === f ? " active" : ""}`}
              data-filter={f}
              onClick={() => {
                setActiveFilter(f);
                setShown(PAGE_SIZE);
              }}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="timeline" id="timeline">
          {visible.length === 0 ? (
            <p className="muted center">No updates in this category yet.</p>
          ) : (
            visible.map((e) => (
              <Card className="entry" key={`${e.ver}-${e.title}`}>
                <CardContent className="p-0">
                  <div className="entry-top">
                    <Badge variant="outline" className="date-badge">{e.date}</Badge>
                    <Badge variant="secondary" className="ver">{e.ver}</Badge>
                    {e.cats.map((c) => (
                      <Badge key={c} variant="outline" className={`tag ${c.replace(/ /g, "")}`}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.desc}</p>
                  <ul>
                    {e.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <div className="center">
          {filtered.length > shown && (
            <Button
              variant="outline"
              id="loadMore"
              type="button"
              onClick={() => setShown((s) => s + PAGE_SIZE)}
            >
              Load more updates
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
