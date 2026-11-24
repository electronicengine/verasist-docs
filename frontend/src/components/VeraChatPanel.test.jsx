import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { sendVeraMessage } from "@/lib/veraStream";
jest.mock("@/lib/veraStream", () => ({ sendVeraMessage: jest.fn() }));
import VeraChatPanel from "./VeraChatPanel";
import AdminVeraSettings from "./AdminVeraSettings";
import { api } from "@/lib/api";
jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }, formatApiError: () => "Connection failed" }));
jest.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "tr" }) }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
let host, root;
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); Element.prototype.scrollIntoView = jest.fn(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = async element => { await act(async () => { root.render(element); }); };
const button = text => [...document.querySelectorAll("button")].find(el => el.textContent.includes(text));
test("restored pending message retries with its original identity", async () => {
 sessionStorage.setItem("verasist-docs-vera:tr", "opaque-token");
 const pending = { request_id: "560d45e1-7ea0-4d68-afab-ebeaded5c633", text: "SDK nasıl kullanılır?" };
 api.get.mockImplementation(path => Promise.resolve({ data: path === "/vera/status" ? { enabled: true } : { messages: [], pending, closed: false } }));
 sendVeraMessage.mockResolvedValue({ messages: [{ id: "answer", role: "assistant", text: "Workflow üzerinden kullanabilirsiniz." }], pending: null, closed: false });
 await render(<VeraChatPanel open onOpenChange={() => {}} />);
 expect(api.post).not.toHaveBeenCalled();
 await act(async () => button("Mesajı yeniden dene").click());
 expect(sendVeraMessage).toHaveBeenCalledWith("opaque-token", pending, expect.any(Function), expect.any(AbortSignal), expect.any(Function));
 expect(document.body.textContent).toContain("Workflow üzerinden kullanabilirsiniz.");
 api.delete.mockResolvedValue({});
 await act(async () => button("Yeni sohbet").click());
 expect(sessionStorage.getItem("verasist-docs-vera:tr")).toBeNull();
 expect(api.delete).toHaveBeenCalledWith("/vera/session", expect.anything());
});
test("disabled assistant does not create a paid session", async () => {
 api.get.mockResolvedValue({ data: { enabled: false } });
 await render(<VeraChatPanel open onOpenChange={() => {}} />);
 expect(document.querySelector("textarea").disabled).toBe(true);
 expect(api.post).not.toHaveBeenCalled();
});
test("admin preserves existing key without receiving its value", async () => {
 const settings = { workflow_uuid: "560d45e1-7ea0-4d68-afab-ebeaded5c633", enabled: true, has_api_key: true };
 api.get.mockResolvedValue({ data: settings }); api.put.mockResolvedValue({ data: settings });
 await render(<AdminVeraSettings />);
 expect(document.querySelector('input[type="password"]').value).toBe("");
 await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
 expect(api.put).toHaveBeenCalledWith("/admin/vera", { workflow_uuid: settings.workflow_uuid, enabled: true, api_key: "" }, expect.anything());
 expect(host.textContent).toContain("Ayarlar kaydedildi");
});

test("streaming reply is visible before completion and reconciles once", async () => {
 sessionStorage.setItem("verasist-docs-vera:tr", "opaque-token");
 const pending = { request_id: "560d45e1-7ea0-4d68-afab-ebeaded5c633", text: "Merhaba" };
 api.get.mockImplementation(path => Promise.resolve({ data: path === "/vera/status" ? { enabled: true } : { messages: [], pending, closed: false } }));
 let emit, finish, tool;
 sendVeraMessage.mockImplementation((_token, _message, onDelta, _signal, onTool) => { tool = onTool; emit = onDelta; return new Promise(resolve => { finish = resolve; }); });
 await render(<VeraChatPanel open onOpenChange={() => {}} />);
 await act(async () => button("Mesajı yeniden dene").click());
 await act(async () => tool({ turn_id: "turn", tool_call_id: "one", function_name: "search_docs", status: "running" }));
 expect(document.querySelector('[aria-label="Araç çağrıları"]').textContent).toContain("search docs · Çalışıyor");
 await act(async () => tool({ turn_id: "turn", tool_call_id: "one", function_name: "search_docs", status: "completed" }));
 expect(document.querySelector('[aria-label="Araç çağrıları"]').textContent).toContain("Tamamlandı");
 await act(async () => emit("Türkçe 🌍"));
 expect(document.querySelector('[data-testid="vera-partial"]').textContent).toContain("Türkçe 🌍");
 expect(document.querySelector("textarea").disabled).toBe(true);
 await act(async () => emit("Türkçe 🌍 **yanıt**"));
 expect(document.querySelector('[data-testid="vera-partial"] strong').textContent).toBe("yanıt");
 const markdown = 'Türkçe 🌍 **yanıt**\n\n| Dil | Paket |\n| --- | --- |\n| Python | SDK |\n\n```python\nprint("Vera")\n```';
 await act(async () => emit(markdown));
 expect(document.querySelectorAll('[data-testid="vera-partial"] th')).toHaveLength(2);
 expect(document.querySelector('[data-testid="vera-partial"] .hljs-string').textContent).toBe('"Vera"');
 await act(async () => finish({ messages: [{ id: "answer", role: "assistant", text: markdown }], pending: null, closed: false }));
 expect(document.querySelector('[data-testid="vera-partial"]')).toBeNull();
 expect(document.querySelectorAll("strong")).toHaveLength(1);
 expect(document.querySelectorAll("table")).toHaveLength(1);
 expect(document.querySelectorAll(".vera-code-block")).toHaveLength(1);
});

test("restored assistant messages use Markdown while user text stays literal", async () => {
 sessionStorage.setItem("verasist-docs-vera:tr", "opaque-token");
 api.get.mockImplementation(path => Promise.resolve({ data: path === "/vera/status" ? { enabled: true } : {
  messages: [{ id: "user", role: "user", text: "**Sorum**" }, { id: "reply", role: "assistant", text: "## Yanıt\n\n> Not\n\n- [x] Hazır\n\n```json\n{\"ok\": true}\n```" }], pending: null, closed: false,
 } }));
 await render(<VeraChatPanel open onOpenChange={() => {}} />);
 expect([...document.querySelectorAll("h2")].some(el => el.textContent === "Yanıt")).toBe(true);
 expect(document.body.textContent).toContain("**Sorum**");
 expect(document.querySelector("blockquote").textContent.trim()).toBe("Not");
 expect(document.querySelector('input[type="checkbox"]').checked).toBe(true);
 expect(document.querySelector(".vera-code-language").textContent).toBe("json");
});
