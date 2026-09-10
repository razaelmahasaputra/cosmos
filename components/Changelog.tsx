"use client";

import { useMemo, useState } from "react";
import { CHANGELOG, CHANGELOG_FILTERS } from "@/lib/data";

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
            <button
              key={f}
              type="button"
              className={`chip${activeFilter === f ? " active" : ""}`}
              data-filter={f}
              onClick={() => {
                setActiveFilter(f);
                setShown(PAGE_SIZE);
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="timeline" id="timeline">
          {visible.length === 0 ? (
            <p className="muted center">No updates in this category yet.</p>
          ) : (
            visible.map((e) => (
              <article className="entry" key={`${e.ver}-${e.title}`}>
                <div className="entry-top">
                  <span className="date-badge">{e.date}</span>
                  <span className="ver">{e.ver}</span>
                  {e.cats.map((c) => (
                    <span key={c} className={`tag ${c.replace(/ /g, "")}`}>
                      {c}
                    </span>
                  ))}
                </div>
                <h3>{e.title}</h3>
                <p>{e.desc}</p>
                <ul>
                  {e.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
        <div className="center">
          {filtered.length > shown && (
            <button
              className="btn btn-ghost"
              id="loadMore"
              type="button"
              onClick={() => setShown((s) => s + PAGE_SIZE)}
            >
              Load more updates
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
