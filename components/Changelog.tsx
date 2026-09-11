"use client";

import { useMemo, useState } from "react";
import { CHANGELOG, CHANGELOG_FILTERS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <Tabs
          value={activeFilter}
          onValueChange={(v) => {
            setActiveFilter(v);
            setShown(PAGE_SIZE);
          }}
          className="reveal"
        >
          <TabsList className="filters" id="filters">
            {CHANGELOG_FILTERS.map((f) => (
              <TabsTrigger
                key={f}
                value={f}
                className="chip data-[state=active]:border data-[state=active]:bg-background"
                data-filter={f}
              >
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
                  <CardTitle className="my-1 text-[0.92rem]">{e.title}</CardTitle>
                  <CardDescription>{e.desc}</CardDescription>
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
