import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  matchDestinations,
  isDestinationQuery,
  SEARCH_DESTINATIONS,
  highlightMatch,
  findMatchRange,
} from "@/components/search/search-destinations";

describe("search destinations (search-as-navigation)", () => {
  it("exposes at least 15 navigational destinations", () => {
    expect(SEARCH_DESTINATIONS.length).toBeGreaterThanOrEqual(15);
    for (const d of SEARCH_DESTINATIONS) {
      expect(d.path.startsWith("/")).toBe(true);
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.keywords.length).toBeGreaterThan(0);
    }
  });

  it("matches exact destination titles first", () => {
    const r = matchDestinations("المستخدمون");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].path).toBe("/users");
  });

  it("matches Arabic with hamza/taa-marbuta tolerance", () => {
    // "المستخدمون" vs typed "المستخدمين" — keyword "مستخدمين" normalizes to "مستخدمين"
    expect(matchDestinations("المستخدمين").some((d) => d.path === "/users")).toBe(true);
    // "سلة المحذوفات" — typed "سله المحذوفة" (ة → ه tolerance)
    expect(matchDestinations("سله المحذوفه").some((d) => d.path === "/trash")).toBe(true);
    // "الإعدادات" — typed "الاعدادات" (إ → ا tolerance)
    expect(matchDestinations("الاعدادات").some((d) => d.path === "/settings")).toBe(true);
  });

  it("matches English keywords", () => {
    expect(matchDestinations("settings").some((d) => d.path === "/settings")).toBe(true);
    expect(matchDestinations("users").some((d) => d.path === "/users")).toBe(true);
    expect(matchDestinations("trash").some((d) => d.path === "/trash")).toBe(true);
  });

  it("matches partial prefixes", () => {
    const r = matchDestinations("مستند");
    expect(r.some((d) => d.path === "/documents")).toBe(true);
  });

  it("returns empty for short queries (<2 chars) and no matches", () => {
    expect(matchDestinations("ا")).toEqual([]);
    expect(matchDestinations("zzzznothing")).toEqual([]);
  });

  it("caps results at the requested limit", () => {
    expect(matchDestinations("ة", 6).length).toBeLessThanOrEqual(6);
  });

  it("isDestinationQuery resolves exact titles and keywords only", () => {
    expect(isDestinationQuery("المستخدمون")).toBe(true);
    expect(isDestinationQuery("trash")).toBe(true);
    // Exact keyword match counts as a destination ("مستند" is a keyword of /documents)
    expect(isDestinationQuery("مستند")).toBe(true);
    // Partial/plural form is NOT a unique destination
    expect(isDestinationQuery("مستندات")).toBe(false);
    expect(isDestinationQuery("مستند غامض")).toBe(false);
  });

  it("sorts better matches above weaker ones", () => {
    const r = matchDestinations("تقرير");
    if (r.length > 1) {
      // exact "التقارير"/keyword "تقرير" must beat substring hits
      expect(r[0].path).toBe("/reports");
    }
  });

  it("ranks popular destinations above non-popular ones on score ties", () => {
    // "الم" is a prefix of several Arabic titles → those score 70 (tie),
    // while /trash matches only as a substring (score 40).
    const r = matchDestinations("الم");
    const paths = r.map((d) => d.path);
    expect(paths).toEqual(["/documents", "/approvals", "/folders", "/users", "/trash"]);
    const idxOf = (p: string) => paths.indexOf(p);
    // Popular wins over non-popular within the same score tier (prefix=70):
    expect(idxOf("/documents")).toBeLessThan(idxOf("/folders"));
    expect(idxOf("/approvals")).toBeLessThan(idxOf("/users"));
    // A lower-score hit (substring) stays last even when popular:
    expect(idxOf("/trash")).toBeGreaterThan(idxOf("/users"));
  });

  it("marks at least 4 destinations as popular", () => {
    const popular = SEARCH_DESTINATIONS.filter((d) => d.popular);
    expect(popular.length).toBeGreaterThanOrEqual(4);
    for (const d of popular) {
      expect(d.path.startsWith("/")).toBe(true);
      expect(d.title.length).toBeGreaterThan(0);
    }
  });

  it("findMatchRange maps normalized offsets back to the original text", () => {
    expect(findMatchRange("سلة المحذوفات", "المحذوفات")).toEqual({ start: 4, end: 13 });
    expect(findMatchRange("المستخدمين", "مستخدم")).toEqual({ start: 2, end: 8 });
    expect(findMatchRange("التحليلات", "zzz")).toBeNull();
    expect(findMatchRange("التحليلات", "")).toBeNull();
  });

  it("highlightMatch wraps only the matched portion in <mark>", () => {
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null, highlightMatch("سلة المحذوفات", "المحذوفات"))
    );
    expect(html).toContain("<mark");
    expect(html).toContain(">المحذوفات</mark>");
    expect(html.replace(/<[^>]+>/g, "")).toBe("سلة المحذوفات");
  });

  it("highlightMatch is hamza/taa-marbuta tolerant and keeps original spelling", () => {
    // Query typed with taa-marbuta still highlights within a title written with haa
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null, highlightMatch("سلة المحذوفات", "المحذوفه"))
    );
    expect(html).toContain("<mark");
    expect(html.replace(/<[^>]+>/g, "")).toBe("سلة المحذوفات");
  });
});
