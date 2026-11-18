import { describe, expect, it } from "vitest";

import { Person, type PersonRecord } from "@/models/Person";
import {
  computeDiagramGenerationMap,
  computeGenerationMap,
  extractYear,
  formatDateLabel,
  getLifeSpanLabel,
  matchesPersonQuery,
  getPartnerComponents,
  getFamilyTreeIssues,
  validateFamilyTree,
} from "@/utils/familyTree";

function person(id: string, parentIds: string[] = [], partnerIds: string[] = []) {
  return new Person({ id, name: id, parentIds, partnerIds }).toRecord();
}

function warningsFor(people: PersonRecord[]) {
  return validateFamilyTree({
    version: 1,
    metadata: { title: "", familyName: "", description: "", updatedAt: "" },
    people,
  });
}

describe("family tree generations", () => {
  it("analyses 10,000 generations in descendant-first order", () => {
    const count = 10_000;
    const people = Array.from({ length: count }, (_, index) =>
      person(String(index), index + 1 === count ? [] : [String(index + 1)]),
    );
    expect(computeGenerationMap(people).get("0")).toBe(count - 1);
    expect(computeDiagramGenerationMap(people).get("9999")).toBe(0);
    expect(warningsFor(people)).not.toEqual(expect.arrayContaining([expect.stringContaining("circolari")]));

    people[count - 1].parentIds.push("0");
    expect(warningsFor(people)).toEqual(expect.arrayContaining([expect.stringContaining("circolari")]));
    expect(computeDiagramGenerationMap(people).size).toBe(count);
  });

  it("aligns transitive partners and carries the generation down to descendants", () => {
    const people = [
      person("a", [], ["b"]),
      person("b", [], ["c"]),
      person("c", ["parent"]),
      person("child", ["a"]),
      person("parent"),
    ];
    expect(getPartnerComponents(people)).toEqual([["a", "b", "c"], ["child"], ["parent"]]);
    expect([...computeDiagramGenerationMap(people).values()]).toEqual([1, 1, 1, 2, 0]);
  });

  it("gives ancestry precedence for contradictory partner components", () => {
    const people = [
      person("parentA", [], ["childB"]),
      person("parentB", [], ["childA"]),
      person("childA", ["parentA"]),
      person("childB", ["parentB"]),
      person("parentC", [], ["childC"]),
      person("childC", ["parentC"]),
      person("grandchild", ["childA"], ["unrelatedPartner"]),
      person("unrelatedPartner"),
    ];
    const expected = [0, 0, 1, 1, 0, 1, 2, 2];
    expect([...computeDiagramGenerationMap(people).values()]).toEqual(expected);
    expect([...computeDiagramGenerationMap([...people, person("other")]).values()])
      .toEqual([...expected, 0]);
  });

  it("formats calendar dates consistently even when a date string is invalid", () => {
    expect(formatDateLabel("2000-01-01")).toBe("01 gen 2000");
    expect(formatDateLabel("invalid")).toBe("Data sconosciuta");
  });

  it("displays year precision and leaves an undocumented death open", () => {
    expect(formatDateLabel("0042")).toBe("0042");
    expect(extractYear("1878")).toBe(1878);
    const born = new Person({ name: "Ada", birthDate: "1878" }).toRecord();
    expect(getLifeSpanLabel(born)).toBe("1878");
    expect(getLifeSpanLabel({ ...born, deathDate: "1954" })).toBe("1878 - 1954");
  });
});

describe("family tree coherence", () => {
  it("associates each failed criterion with its exact people", () => {
    const snapshot = {
      version: 1,
      metadata: { title: "", familyName: "", description: "", updatedAt: "" },
      people: [
        person("descendant", ["a"]),
        person("a", ["b"]),
        person("b", ["a"]),
        person("too-many", ["descendant", "a", "b"]),
        person("isolated"),
      ],
    };

    expect(getFamilyTreeIssues(snapshot).map(({ id, personIds }) => ({ id, personIds })))
      .toEqual([
        { id: "ancestry-cycle", personIds: ["a", "b"] },
        { id: "diagram-parents", personIds: ["too-many"] },
        { id: "isolated", personIds: ["isolated"] },
      ]);
    expect(getFamilyTreeIssues({ ...snapshot, people: [] }))
      .toEqual([expect.objectContaining({ id: "empty", personIds: [] })]);
  });
});


it("finds the full legal name when an archive also records a nickname", () => {
  const record = new Person({ name: "Simone", knownAs: "Simo", surname: "Verdi" }).toRecord();
  expect(matchesPersonQuery(record, "simone verdi")).toBe(true);
  expect(matchesPersonQuery(record, "simo verdi")).toBe(true);
});
