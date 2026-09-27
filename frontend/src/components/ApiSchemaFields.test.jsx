import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import ApiSchemaFields from "./ApiSchemaFields";

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, latest;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
function render(schema, initial, spec = {}) {
  function Harness() { const [value, setValue] = useState(initial); latest = value; return <ApiSchemaFields spec={spec} schema={schema} value={value} onChange={setValue} lang="en" />; }
  act(() => root.render(<Harness />));
}
function change(element, value) {
  act(() => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); element.dispatchEvent(new Event("input", { bubbles: true })); });
}
test("renders enum and boolean selects, keeps numbers typed, omits optional fields", () => {
  render({ type: "object", required: ["status", "count", "enabled"], properties: { status: { type: "string", enum: ["active", "archived"] }, count: { type: "integer", minimum: 1 }, enabled: { type: "boolean" }, note: { type: "string" } } }, { status: "active", count: 1, enabled: true });
  change(container.querySelector('[data-field-name="status"] select'), '"archived"');
  change(container.querySelector('[data-field-name="enabled"] select'), 'false');
  change(container.querySelector('[data-field-name="count"] input[type=number]'), '5');
  expect(latest).toEqual({ status: "archived", count: 5, enabled: false });
  const include = container.querySelector('[data-field-name="note"] input[type=checkbox]');
  act(() => include.click()); expect(latest.note).toBe("");
  act(() => include.click()); expect(latest).not.toHaveProperty("note");
});
test("provider dropdown replaces credential fields and discards previous provider data", () => {
  const spec = { components: { schemas: {
    A: { type: "object", required: ["provider", "a_key"], properties: { provider: { type: "string", const: "a" }, a_key: { type: "string" } } },
    B: { type: "object", required: ["provider", "b_key"], properties: { provider: { type: "string", const: "b" }, b_key: { type: "string" } } },
  } } };
  render({ type: "object", required: ["config"], properties: { config: { oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }], discriminator: { propertyName: "provider", mapping: { a: "#/components/schemas/A", b: "#/components/schemas/B" } } } } }, { config: { provider: "a", a_key: "secret" } }, spec);
  change(container.querySelector("select"), "b");
  expect(latest.config).toEqual({ provider: "b", b_key: "" });
  expect(container.querySelector('[data-field-name="a_key"]')).toBeNull();
  expect(container.querySelector('[data-field-name="b_key"] input')).not.toBeNull();
});
test("invalid JSON cannot silently submit the previous valid object", () => {
  render({ type: "object", required: ["context"], properties: { context: { type: "object", additionalProperties: true } } }, { context: {} });
  const input = container.querySelector("textarea");
  change(input, "{bad");
  expect(input.checkValidity()).toBe(false);
  expect(latest.context).toEqual({});
  change(input, '{"x":2}');
  expect(input.checkValidity()).toBe(true);
  expect(latest.context).toEqual({ x: 2 });
});
