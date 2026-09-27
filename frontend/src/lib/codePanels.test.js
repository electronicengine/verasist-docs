import { enhanceCodePanels } from "./codePanels";
function fixture() {
  const root = document.createElement("div");
  root.innerHTML = '<pre><code class="language-python">print("&lt;device&gt;")\n</code></pre>\n<pre><code class="language-typescript">const online = true;\n</code></pre><p>Separate task</p><pre><code class="language-python">pass</code></pre><pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre>';
  document.body.append(root);
  return root;
}
afterEach(() => { document.body.innerHTML = ""; });
test("pairs languages, highlights safely and supports keyboard navigation", () => {
  const root = fixture();
  enhanceCodePanels(root, "tr");
  expect(root.querySelectorAll(".code-panel")).toHaveLength(2);
  expect(root.querySelector(".hljs-built_in")).not.toBeNull();
  expect(root.querySelector("device")).toBeNull();
  const tabs = root.querySelectorAll('[role="tab"]');
  expect(tabs).toHaveLength(2);
  tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(tabs[1]);
  expect(root.querySelectorAll('[role="tabpanel"]')[0].hidden).toBe(true);
  expect(root.querySelector("code.language-mermaid").closest(".code-panel")).toBeNull();
});
test("copies selected original code without line numbers or markup", async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const root = fixture();
  enhanceCodePanels(root);
  const button = root.querySelector(".code-panel-copy");
  await button.onclick();
  expect(writeText).toHaveBeenLastCalledWith('print("<device>")\n');
  root.querySelectorAll('[role="tab"]')[1].click();
  await button.onclick();
  expect(writeText).toHaveBeenLastCalledWith("const online = true;\n");
});
test("cleanup restores code and repeated enhancement does not nest panels", () => {
  const root = fixture();
  const texts = [...root.querySelectorAll("pre")].map((pre) => pre.textContent);
  const cleanup = enhanceCodePanels(root);
  enhanceCodePanels(root);
  expect(root.querySelectorAll(".code-panel")).toHaveLength(2);
  cleanup();
  expect(root.querySelector(".code-panel")).toBeNull();
  expect([...root.querySelectorAll("pre")].map((pre) => pre.textContent)).toEqual(texts);
});
