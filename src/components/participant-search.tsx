"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildSearchIndex,
  normaliseSearchText,
  searchEntries,
  type ChecklistSearchItem,
  type SearchEntry,
} from "@/lib/participant/search-index";

/**
 * Search box for the home page. Matching happens in the browser against static pages and
 * the participant's own checklist titles; the query is never sent, stored or put in the URL.
 * The result list is absolutely positioned against the nearest positioned ancestor, so the
 * host row decides its width.
 */
export function ParticipantSearch({
  checklistItems,
  className,
}: {
  checklistItems: readonly ChecklistSearchItem[];
  className?: string;
}) {
  const router = useRouter();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-results`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const index = useMemo(() => buildSearchIndex(checklistItems), [checklistItems]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = useMemo(() => searchEntries(index, query), [index, query]);

  const hasQuery = normaliseSearchText(query) !== "";
  const showPopup = open && hasQuery;
  const showList = showPopup && results.length > 0;

  useEffect(() => {
    if (showList && active >= 0) {
      document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [active, showList, baseId]);

  function go(entry: SearchEntry) {
    setOpen(false);
    setActive(-1);
    setQuery("");
    router.push(entry.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        if (results.length > 0) setActive((i) => (i + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        if (results.length > 0) setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        break;
      case "Enter":
        if (showList) {
          event.preventDefault();
          go(results[active >= 0 ? active : 0]);
        }
        break;
      case "Escape":
        if (showPopup) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (query) {
          event.preventDefault();
          setQuery("");
        }
        break;
    }
  }

  const status = !showPopup
    ? ""
    : results.length === 0
      ? "No matches"
      : `${results.length} result${results.length === 1 ? "" : "s"}, use up and down arrows to choose`;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-participant-primary",
        className
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-participant-muted" strokeWidth={1.5} aria-hidden="true" />
      <label htmlFor={inputId} className="sr-only">
        Search pages and checklist
      </label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
        placeholder="Search…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        className="h-11 w-full min-w-0 bg-transparent text-base text-participant-ink outline-none placeholder:text-participant-muted [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery("");
            setActive(-1);
            document.getElementById(inputId)?.focus();
          }}
          className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-participant-muted hover:bg-participant-surface-strong hover:text-participant-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-participant-primary"
        >
          <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-participant-primary/20 bg-participant-surface shadow-lg",
          !showPopup && "hidden"
        )}
        onMouseDown={(event) => event.preventDefault()}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          hidden={!showList}
          className="max-h-[min(50vh,20rem)] overflow-y-auto overscroll-contain py-1"
        >
          {results.map((entry, i) => (
            <li
              key={entry.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onClick={() => go(entry)}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm",
                i === active ? "bg-participant-surface-strong" : "hover:bg-participant-page/60"
              )}
            >
              <span className="min-w-0 text-participant-ink">{entry.label}</span>
              <span className="shrink-0 text-xs text-participant-muted">
                {entry.kind === "checklist" ? "Checklist item" : "Page"}
              </span>
            </li>
          ))}
        </ul>
        {showPopup && results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-participant-muted">
            No matches. Try a word like “scan”, “bloods” or “survey”.
          </p>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
