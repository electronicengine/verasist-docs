import { fieldSchema, fieldHint } from "./apiFieldSchema";
import { buildExampleFromSchema, getOperation } from "./apiReferenceSpec";
import { API_REFERENCE_GROUPS, flattenEntries, findEntry } from "./apiReferenceGroups";

test("resolves nullable enums and composed object schemas", () => {
  const spec = { components: { schemas: { Status: { type: "string", enum: ["active", "archived"] } } } };
  expect(fieldSchema(spec, { anyOf: [{ $ref: "#/components/schemas/Status" }, { type: "null" }] })).toMatchObject({ nullable: true, enum: ["active", "archived"] });
  expect(fieldSchema(spec, { allOf: [{ type: "object", properties: { a: { type: "string" } }, required: ["a"] }, { properties: { b: { type: "boolean" } }, required: ["b"] }] })).toMatchObject({ required: ["a", "b"], properties: { a: { type: "string" }, b: { type: "boolean" } } });
});
test("literal-only patterns become choices without treating general regexes as enums", () => {
  expect(fieldSchema({}, { type: "string", pattern: "^csv$" }).enum).toEqual(["csv"]);
  expect(fieldSchema({}, { type: "string", pattern: "^(asc|desc)$" }).enum).toEqual(["asc", "desc"]);
  expect(fieldSchema({}, { type: "string", pattern: "^[A-Z]{2}$" }).enum).toBeUndefined();
});

test("sample bodies omit absent optional values and honor minimum/default/enum", () => {
  expect(buildExampleFromSchema({}, { type: "object", required: ["count", "status"], properties: {
    count: { type: "integer", minimum: 1 }, status: { anyOf: [{ type: "string", enum: ["active"] }, { type: "null" }] }, optional: { type: "string" }, enabled: { type: "boolean", default: false },
  } })).toEqual({ count: 1, status: "active", enabled: false });
});
test("merges referenced shared parameters with operation overrides", () => {
  const spec = { components: { parameters: { id: { name: "id", in: "path", required: true } } }, paths: { "/x": { parameters: [{ $ref: "#/components/parameters/id" }], get: { parameters: [{ name: "id", in: "path", description: "override" }] } } } };
  expect(getOperation(spec, "GET", "/x").parameters).toEqual([{ name: "id", in: "path", description: "override" }]);
});
test("every endpoint has bilingual explanations and a resolvable navigation slug", () => {
  const leaves = API_REFERENCE_GROUPS.flatMap((group) => flattenEntries(group.entries).map((entry) => ({ group, entry })));
  expect(leaves.length).toBeGreaterThan(40);
  for (const { group, entry } of leaves) {
    expect(entry.description_tr.length).toBeGreaterThan(20);
    expect(entry.description_en.length).toBeGreaterThan(20);
    expect(findEntry(group.slug, entry.opSlug)?.path).toBe(entry.path);
  }
});
test("hints explain identity and expose actual schema constraints", () => {
  const hint = fieldHint("workflow_id", { type: "integer", minimum: 1 }, true, "tr");
  expect(hint).toContain("UUID"); expect(hint).toContain("Min: 1"); expect(hint).toContain("Zorunlu");
});
