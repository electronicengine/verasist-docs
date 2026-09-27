import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

Object.entries({ python, typescript, javascript, bash, json, xml, yaml }).forEach(
  ([name, grammar]) => hljs.registerLanguage(name, grammar),
);
const aliases = { py: "python", ts: "typescript", js: "javascript", sh: "bash", shell: "bash", yml: "yaml", html: "xml" };
const names = { python: "Python", typescript: "TypeScript", javascript: "JavaScript", bash: "Terminal", json: "JSON", xml: "XML", yaml: "YAML" };
const languageOf = (pre) => {
  const name = pre.querySelector("code")?.className.match(/language-([\w-]+)/)?.[1] || "text";
  return aliases[name] || name;
};

/** Enhance stored HTML without changing the code copied by the reader. */
export function enhanceCodePanels(root, locale = "en") {
  const cleanups = [];
  const tr = locale === "tr";
  const candidates = [...root.querySelectorAll("pre")].filter(
    (pre) => pre.querySelector("code") && languageOf(pre) !== "mermaid" && !pre.closest(".code-panel"),
  );
  const used = new Set();
  candidates.forEach((pre, index) => {
    if (used.has(pre)) return;
    const blocks = [pre];
    const next = pre.nextElementSibling;
    const pair = new Set([languageOf(pre), next?.tagName === "PRE" ? languageOf(next) : ""]);
    if (next && candidates.includes(next) && pair.has("python") && pair.has("typescript")) blocks.push(next);
    blocks.forEach((block) => used.add(block));
    const doc = root.ownerDocument;
    const panel = doc.createElement("section");
    panel.className = "code-panel";
    const header = doc.createElement("div");
    header.className = "code-panel-header";
    const tabs = doc.createElement("div");
    tabs.className = "code-panel-tabs";
    if (blocks.length > 1) {
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", tr ? "Örnek dili" : "Example language");
    }
    const copy = doc.createElement("button");
    copy.type = "button";
    copy.className = "code-panel-copy";
    copy.textContent = tr ? "Kopyala" : "Copy";
    const status = doc.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    header.append(tabs, copy, status);
    panel.append(header);
    pre.before(panel);
    let selected = 0;
    let alive = true;
    const originals = blocks.map((block) => block.innerHTML);
    const raw = blocks.map((block) => block.querySelector("code").textContent);
    const buttons = [];
    const bodies = [];
    const select = (i, focus = false) => {
      selected = i;
      copy.textContent = tr ? "Kopyala" : "Copy";
      buttons.forEach((button, j) => {
        button.classList.toggle("active", j === i);
        if (blocks.length > 1) {
          button.setAttribute("aria-selected", String(j === i));
          button.tabIndex = j === i ? 0 : -1;
        }
        bodies[j].hidden = j !== i;
      });
      if (focus) buttons[i].focus();
    };
    blocks.forEach((block, i) => {
      const language = languageOf(block);
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = names[language] || language;
      button.id = `code-tab-${index}-${i}`;
      const body = doc.createElement("div");
      body.className = "code-panel-body";
      body.id = `code-body-${index}-${i}`;
      body.tabIndex = 0;
      if (blocks.length > 1) {
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", body.id);
        body.setAttribute("role", "tabpanel");
        body.setAttribute("aria-labelledby", button.id);
      } else body.setAttribute("aria-label", names[language] || language);
      button.onclick = () => select(i);
      button.onkeydown = (event) => {
        let target;
        if (event.key === "ArrowRight") target = (i + 1) % blocks.length;
        if (event.key === "ArrowLeft") target = (i + blocks.length - 1) % blocks.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = blocks.length - 1;
        if (target !== undefined) { event.preventDefault(); select(target, true); }
      };
      tabs.append(button);
      buttons.push(button);
      const gutter = doc.createElement("div");
      gutter.className = "code-panel-lines";
      gutter.setAttribute("aria-hidden", "true");
      gutter.textContent = raw[i].replace(/\n$/, "").split("\n").map((_, n) => n + 1).join("\n");
      const code = block.querySelector("code");
      if (hljs.getLanguage(language)) code.innerHTML = hljs.highlight(raw[i], { language }).value;
      code.classList.add("hljs");
      body.append(gutter, block);
      bodies.push(body);
      panel.append(body);
    });
    select(0);
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(raw[selected]);
        if (alive) {
          status.textContent = tr ? "Kod kopyalandı" : "Code copied";
          copy.textContent = tr ? "Kopyalandı" : "Copied";
        }
      } catch (_) {
        if (alive) status.textContent = tr ? "Kopyalanamadı; kodu seçerek kopyalayın" : "Copy failed; select the code to copy it";
      }
    };
    cleanups.push(() => {
      alive = false;
      blocks.forEach((block, i) => { block.innerHTML = originals[i]; panel.before(block); });
      panel.remove();
    });
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
