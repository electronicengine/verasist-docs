import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import VeraMarkdown from "./VeraMarkdown";

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = text => act(() => root.render(<VeraMarkdown>{text}</VeraMarkdown>));
test("renders headings, emphasis, lists, inline code, fenced code and GFM tables", () => {
  render('# SDK kurulumu\n\n**Önemli**: `API_KEY`\n\n1. Kur\n2. Bağlan\n\n```python\nprint("Vera")\n```\n\n| Dil | Paket |\n| --- | --- |\n| Python | verasist-sdk |');
  expect(container.querySelector("h1").textContent).toBe("SDK kurulumu");
  expect(container.querySelector("strong").textContent).toBe("Önemli");
  expect(container.querySelectorAll("ol li")).toHaveLength(2);
  expect(container.querySelector("p code").textContent).toBe("API_KEY");
  expect(container.querySelector("pre code").textContent).toBe('print("Vera")\n');
  expect(container.querySelectorAll("table th")).toHaveLength(2);
  expect(container.querySelector(".vera-table-scroll").tabIndex).toBe(0);
});
test("keeps generated HTML and unsafe URLs inert, renders code literally", () => {
  render('[unsafe](javascript:alert%281%29)\n\n[Docs](https://docs.verasist.ai)\n\n<img src=x onerror=alert(1)>\n\n![tracker](https://example.com/tracker)\n\n```html\n<script>alert(1)</script>\n```');
  expect(container.querySelector("script, img")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.querySelector('a[href="https://docs.verasist.ai"]').rel).toBe("noopener noreferrer");
  expect(container.querySelector("pre code").textContent).toContain("<script>alert(1)</script>");
});
