import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import axios from "axios";
import ApiReferencePage from "./ApiReferencePage";
import { fetchOpenApiSpec } from "@/lib/apiReferenceSpec";

let mockRoute;
jest.mock("react-router-dom", () => ({
  useParams: () => mockRoute,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "en" }) }));
jest.mock("axios", () => ({ request: jest.fn() }));
jest.mock("@/lib/apiReferenceSpec", () => ({
  ...jest.requireActual("@/lib/apiReferenceSpec"), fetchOpenApiSpec: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
global.crypto = { randomUUID: () => "c68d3e25-58d9-4ee5-8329-2d4ab6d75746" };
let container, root;
beforeEach(() => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  localStorage.clear(); localStorage.setItem("verasist_api_key", "server-key");
  axios.request.mockResolvedValue({ status: 200, data: { session_token: "short-lived" } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

function change(input, value) {
  act(() => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function render(opSlug, path, method, schema) {
  mockRoute = { groupSlug: "runs", "*": opSlug };
  fetchOpenApiSpec.mockResolvedValue({ paths: { [`/api/v1${path}`]: { [method]: {
    parameters: [{ name: path.includes("workflow_uuid") ? "workflow_uuid" : "session_token", in: "path", required: true, schema: { type: "string" } }],
    ...(schema ? { requestBody: { content: { "application/json": { schema } } } } : {}),
  } } } });
  await act(async () => { root.render(<ApiReferencePage />); });
}

test("voice/video presets preserve context and send the selected mode as JSON", async () => {
  await render("trigger-workflow", "/public/agent/workflow/{workflow_uuid}", "post", {
    type: "object", properties: { run_type: { type: "string", enum: ["voice", "video", "text"] }, initial_context: { type: "object", additionalProperties: true } },
  });
  const body = container.querySelector('[data-testid="apiref-request-body"]');
  expect(JSON.parse(body.value)).toEqual({ run_type: "voice" });
  change(body, JSON.stringify({ run_type: "voice", initial_context: { locale: "en" } }));
  act(() => { [...container.querySelectorAll("button")].find(button => button.textContent === "Video").click(); });
  expect(JSON.parse(body.value)).toEqual({ run_type: "video", initial_context: { locale: "en" } });
  change(container.querySelector('[data-field-name="workflow_uuid"] input'), "workflow-uuid");
  await act(async () => { container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({
    data: { run_type: "video", initial_context: { locale: "en" } },
    headers: expect.objectContaining({ "X-API-Key": "server-key", Accept: "application/json" }),
  }));
});

test("TURN Try it uses the session token without sending the stored organization key", async () => {
  await render("turn-credentials", "/public/agent/runs/{session_token}/turn-credentials", "get");
  expect(container.querySelector("#api-secret").disabled).toBe(true);
  change(container.querySelector('[data-field-name="session_token"] input'), "short-lived");
  await act(async () => { container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(axios.request.mock.calls[0][0].headers["X-API-Key"]).toBeUndefined();
  expect(axios.request.mock.calls[0][0].url).toContain("/short-lived/turn-credentials");
});


test("text preset generates a UUID and removes telephone options", async () => {
  await render("trigger-workflow", "/public/agent/workflow/{workflow_uuid}", "post", { type: "object", properties: {run_type: {type: "string", enum: ["voice", "video", "text"]}} });
  const body = container.querySelector('[data-testid="apiref-request-body"]');
  change(body, JSON.stringify({phone_number: "+123", channel: "phone", initial_context: {locale: "tr"}}));
  act(() => { [...container.querySelectorAll("button")].find(button => button.textContent === "Text").click(); });
  const value = JSON.parse(body.value);
  expect(value.run_type).toBe("text");
  expect(value.request_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(value.initial_context).toEqual({locale: "tr"});
  expect(value.phone_number).toBeUndefined();
  expect(value.channel).toBeUndefined();
});


test("Try it blocks unified-run writes to an API awaiting rollout", async () => {
  await render("trigger-workflow", "/public/agent/workflow/{workflow_uuid}", "post", {type: "object"});
  const spec = await fetchOpenApiSpec.mock.results[0].value;
  spec.paths["/api/v1/public/agent/workflow/{workflow_uuid}"].post["x-requires-api-update"] = true;
  await act(async () => { root.unmount(); root = createRoot(container); root.render(<ApiReferencePage />); });
  expect(container.querySelector('[data-testid="apiref-send-btn"]').disabled).toBe(true);
  expect(container.textContent).toContain("does not yet support unified run startup");
  await act(async () => { container.querySelector("form").dispatchEvent(new Event("submit", {bubbles: true, cancelable: true})); });
  expect(axios.request).not.toHaveBeenCalled();
});
