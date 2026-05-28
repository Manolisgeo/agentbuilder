/** PostMessage types between design iframe and parent panel */

export interface DesignSelection {
  id: string;
  label: string;
  tagName: string;
  text: string;
  outerHTML: string;
}

export const DESIGN_SELECT_MESSAGE = "design-element-select" as const;
export const DESIGN_HIGHLIGHT_MESSAGE = "design-element-highlight" as const;

export function buildDesignInspectorScript(): string {
  return `
(function () {
  var STYLE_ID = "design-inspector-styles";
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "[data-design-id] { cursor: crosshair !important; }",
      "[data-design-id].design-selected { outline: 2px solid #22d3ee !important; outline-offset: 3px !important; }",
      "[data-design-id]:hover:not(.design-selected) { outline: 1px dashed rgba(34,211,238,0.55) !important; outline-offset: 2px !important; }"
    ].join("\\n");
    document.head.appendChild(s);
  }

  var EDITABLE =
    "h1,h2,h3,h4,h5,h6,p,button,a,label,span,li,header,footer,section,article,nav,main,form,input,textarea," +
    "[id=welcome],[id=chat-log],.welcome-text,.hero,.starters button,[data-starter]";

  function labelFor(el) {
    var t = (el.textContent || "").trim().replace(/\\s+/g, " ");
    if (t.length > 48) t = t.slice(0, 48) + "…";
    if (t) return t;
    if (el.id) return "#" + el.id;
    return el.tagName.toLowerCase();
  }

  function tagElements() {
    var n = 0;
    document.querySelectorAll(EDITABLE).forEach(function (el) {
      if (el.closest("script,style")) return;
      if (!el.getAttribute("data-design-id")) {
        var tag = el.tagName.toLowerCase();
        el.setAttribute("data-design-id", tag + "-" + n++);
        el.setAttribute("data-design-label", labelFor(el));
      }
    });
  }

  function selectEl(el) {
    document.querySelectorAll(".design-selected").forEach(function (n) {
      n.classList.remove("design-selected");
    });
    el.classList.add("design-selected");
    parent.postMessage({
      type: "${DESIGN_SELECT_MESSAGE}",
      selection: {
        id: el.getAttribute("data-design-id"),
        label: el.getAttribute("data-design-label") || el.getAttribute("data-design-id"),
        tagName: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 500),
        outerHTML: el.outerHTML.slice(0, 4000)
      }
    }, "*");
  }

  tagElements();

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-design-id]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    selectEl(el);
  }, true);

  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "${DESIGN_HIGHLIGHT_MESSAGE}") return;
    var target = document.querySelector('[data-design-id="' + e.data.id + '"]');
    if (target) selectEl(target);
  });
})();
`.trim();
}

export function injectDesignInspector(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const script = `<script id="design-inspector">${buildDesignInspectorScript()}</script>`;
  if (withoutScripts.includes("</body>")) {
    return withoutScripts.replace("</body>", `  ${script}\n</body>`);
  }
  return `${withoutScripts}\n${script}`;
}
