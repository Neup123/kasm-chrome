/*
 * Packaged DOM operations adapted from FoxMCP content-message dispatch.
 * Copyright (c) 2024 FoxMCP Project; MIT (see LICENSE).
 * All executable operations are in this file. Messages carry data only.
 */
(() => {
  "use strict";

  function createContentExecutor({ window: win, document: doc, protocol, extensionId, documentToken, now = Date.now }) {
    class ContentError extends Error {
      constructor(code, message) { super(message); this.code = code; }
    }
    const fail = (code, message) => { throw new ContentError(code, message); };

    function guard(message) {
      if (message.documentToken !== documentToken || message.expectedUrl !== win.location.href) {
        fail("TARGET_CHANGED", "The target document changed before the operation.");
      }
      if (!protocol.isAllowedUrl(win.location.href)) fail("URL_FORBIDDEN", "This origin is outside the allowed automation scope.");
      if (!Number.isFinite(message.command.deadline) || now() >= message.command.deadline) {
        fail("COMMAND_EXPIRED", "The command deadline has expired; inspect the page before retrying.");
      }
    }

    function selectOne(selector) {
      let elements;
      try { elements = doc.querySelectorAll(selector); }
      catch (_) { fail("INVALID_SELECTOR", "The CSS selector is invalid."); }
      if (elements.length === 0) fail("ELEMENT_NOT_FOUND", "The CSS selector did not match an element.");
      if (elements.length !== 1) fail("ELEMENT_AMBIGUOUS", "The CSS selector matched more than one element.");
      return elements[0];
    }

    function checkInteractable(element) {
      if (!element.isConnected) fail("ELEMENT_DETACHED", "The matched element is no longer in the document.");
      const style = win.getComputedStyle(element);
      if (!element.getClientRects().length || style.display === "none" || style.visibility === "hidden"
        || style.visibility === "collapse" || element.closest('[hidden],[inert],[aria-hidden="true"]')) {
        fail("ELEMENT_HIDDEN", "The matched element is not visible.");
      }
      if (element.disabled || element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") {
        fail("ELEMENT_DISABLED", "The matched element is disabled.");
      }
    }

    function sensitiveField(element) {
      return element.matches('input[type="password"],input[type="file"]')
        || /(^|\s)(current-password|new-password|one-time-code|username)(\s|$)/i.test(element.getAttribute("autocomplete") || "");
    }

    function editable(element) {
      if (sensitiveField(element)) fail("CREDENTIAL_INPUT_FORBIDDEN", "Credential and file inputs are outside this driver's automation scope.");
      if (element.readOnly) fail("ELEMENT_READ_ONLY", "The matched field is read-only.");
      if (element instanceof win.HTMLTextAreaElement) return "textarea";
      if (element instanceof win.HTMLInputElement && /^(text|search|url|email|tel|number)$/.test(element.type)) return "input";
      if (element.isContentEditable || element.getAttribute("contenteditable") === "true"
        || element.getAttribute("contenteditable") === "plaintext-only") return "contenteditable";
      fail("ELEMENT_NOT_EDITABLE", "The matched element is not an editable text field.");
    }

    function textOf(element) {
      return typeof element.innerText === "string" ? element.innerText : (element.textContent || "");
    }

    function describe(element) {
      const result = {
        tag: element.tagName.toLowerCase(), id: element.id || "",
        role: element.getAttribute("role"), type: element.getAttribute("type"),
        ariaLabel: (element.getAttribute("aria-label") || "").slice(0,1000),
        placeholder: (element.getAttribute("placeholder") || "").slice(0,1000),
        disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
        contentEditable: Boolean(element.isContentEditable || /^(true|plaintext-only)$/.test(element.getAttribute("contenteditable") || "")),
        text: textOf(element).slice(0,1000)
      };
      if (!sensitiveField(element) && (element instanceof win.HTMLInputElement || element instanceof win.HTMLTextAreaElement)) {
        result.value = element.value.slice(0, protocol.LIMITS.maxTextLength);
      }
      return result;
    }

    function readText(request) {
      const element = request.selector ? selectOne(request.selector) : doc.body;
      const text = element ? textOf(element) : "";
      const maximum = request.maxLength || protocol.LIMITS.maxReadTextLength;
      return { text: text.slice(0, maximum), truncated: text.length > maximum, totalLength: text.length, url: win.location.href };
    }

    function probe(request) {
      if ("code" in request || "script" in request || "expression" in request) {
        fail("REMOTE_CODE_FORBIDDEN", "Only packaged read-only probes are supported; arbitrary JavaScript is forbidden.");
      }
      switch (request.probe) {
        case "page":
          return { url: win.location.href, title: doc.title.slice(0,1024), readyState: doc.readyState, bodyTextLength: doc.body ? textOf(doc.body).length : 0 };
        case "elements":
          return describe(selectOne(request.selector));
        case "storage": {
          if (win.location.origin !== "http://driver:8080") fail("PROBE_FORBIDDEN", "Storage probes are limited to the internal placeholder pages.");
          const value = win.localStorage.getItem("kasm_probe");
          if (value !== null && value.length > 4096) fail("PROBE_VALUE_TOO_LONG", "A placeholder storage value exceeds the probe limit.");
          return { localStorage: { kasm_probe: value } };
        }
        default:
          fail("UNKNOWN_PROBE", "The requested packaged probe does not exist.");
      }
    }

    function click(request, message) {
      const element = selectOne(request.selector);
      checkInteractable(element);
      if (typeof element.click !== "function") fail("ELEMENT_NOT_CLICKABLE", "The matched element has no DOM click method.");
      const matched = describe(element);
      guard(message);
      element.click();
      return { clicked: true, matched };
    }

    async function type(request, message) {
      const element = selectOne(request.selector);
      checkInteractable(element);
      const kind = editable(element);
      const current = kind === "contenteditable" ? textOf(element) : element.value;
      const value = request.clear === false ? current + request.text : request.text;
      if (value.length > protocol.LIMITS.maxTextLength) fail("TEXT_TOO_LONG", "The resulting field content exceeds the configured limit.");
      element.focus({ preventScroll: true });
      guard(message);
      let method;
      if (kind === "contenteditable") {
        const selection = win.getSelection();
        const range = doc.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        let inserted = false;
        if (typeof doc.execCommand === "function") {
          // Native editing integrates with rich text editors and their history.
          // It does not synthesize mouse/keyboard or press Enter.
          try { inserted = doc.execCommand("insertText", false, value); }
          catch (_) { inserted = false; }
        }
        if (!inserted) element.textContent = value;
        method = inserted ? "contenteditable-insertText" : "contenteditable-dom-input";
      } else {
        const prototype = kind === "textarea" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) fail("VALUE_SETTER_UNAVAILABLE", "The browser's native field value setter is unavailable.");
        setter.call(element, value);
        method = "native-value-setter";
      }
      element.dispatchEvent(new win.InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: request.text }));
      element.dispatchEvent(new win.Event("change", { bubbles: true }));
      // Let editor MutationObservers settle, without retrying or resubmitting.
      await new Promise(resolve => win.setTimeout(resolve, 0));
      guard(message);
      const currentElement = selectOne(request.selector);
      const actual = kind === "contenteditable" ? textOf(currentElement) : currentElement.value;
      if (actual !== value) fail("TYPE_NOT_APPLIED", "The page did not retain the requested field text; no send action was performed.");
      return { value: actual, length: actual.length, method };
    }


    // ChatGPT-specific writes never run on the internal HTTP fixture.
    function chatOnly() {
      if (win.location.origin !== "https://chatgpt.com") fail("URL_FORBIDDEN", "This command is restricted to ChatGPT.");
    }
    const normalized = value => value.replace(/\s+/g, " ").trim();
    const visible = element => {
      try { checkInteractable(element); return true; } catch (_) { return false; }
    };
    const matches = (root, selector) => Array.from(root.querySelectorAll(selector)).filter(visible);
    function unique(items, code, detail) {
      if (items.length !== 1) fail(code, detail);
      return items[0];
    }
    async function waitFor(message, lookup, code, detail) {
      // Bound waits even when the caller requests the maximum transport timeout.
      const until = Math.min(message.command.deadline, now() + 1800);
      for (let attempt = 0; attempt < 36; attempt++) {
        guard(message);
        const value = lookup();
        if (value) return value;
        if (now() >= until) break;
        await new Promise(resolve => win.setTimeout(resolve, 50));
      }
      fail(code, detail);
    }
    const effortLabel = button => {
      // A word match would mistake "Extra High" for "High". Accept only
      // complete supported labels (with an optional explicit effort prefix).
      const labels = [textOf(button), button.getAttribute("aria-label") || ""]
        .map(normalized).filter(label => label && !/^(?:thinking )?effort$/i.test(label));
      const levels = labels.map(label => {
        const value = label.replace(/^(?:thinking )?effort(?:\s*:\s*|\s+)/i, "");
        return protocol.EFFORTS.find(level => level.toLowerCase() === value.toLowerCase());
      });
      return levels.length && levels.every(level => level && level === levels[0]) ? levels[0] : null;
    };
    // Only a genuinely generic trigger permits the associated-popup fallback.
    // A conflicting or unsupported explicit label is not an unknown default.
    const genericEffortLabel = button => {
      const labels = [textOf(button), button.getAttribute("aria-label") || ""].map(normalized).filter(Boolean);
      return labels.length > 0 && labels.every(label => /^(?:thinking )?effort$/i.test(label));
    };
    function controlledEffortId(trigger) {
      const id = normalized(trigger.getAttribute("aria-controls") || "");
      return id && !/\s/.test(id) ? id : null;
    }
    function associatedEffortPopup(trigger, id) {
      if (!trigger.isConnected || controlledEffortId(trigger) !== id) return null;
      const owners = Array.from(doc.querySelectorAll("[id]")).filter(el => el.id === id);
      if (owners.length !== 1 || !visible(owners[0])) return null;
      const popup = effortPopup();
      return popup && (owners[0] === popup || owners[0].contains(popup)) ? popup : null;
    }
    function explicitSliderLevel(popup) {
      const sliders = matches(popup, '[role="slider"],input[type="range"]');
      if (sliders.length !== 1) return null;
      const slider = sliders[0];
      if (!/^(?:thinking )?effort$/i.test(normalized(slider.getAttribute("aria-label") || ""))) return null;
      const value = normalized(slider.getAttribute("aria-valuetext") || "");
      const level = protocol.EFFORTS.find(item => item.toLowerCase() === value.toLowerCase());
      return level ? {slider,level} : null;
    }
    function effortButton() {
      // ChatGPT can expose its composer solely through an accessible label:
      // neither prompt-textarea nor a composer test ID is guaranteed.
      const anchorSelector = '#prompt-textarea,[contenteditable="true"][aria-label="Ask ChatGPT"],[contenteditable="plaintext-only"][aria-label="Ask ChatGPT"],[contenteditable=""][aria-label="Ask ChatGPT"]';
      const anchors = matches(doc, anchorSelector);
      if (!anchors.length) fail("EFFORT_COMPOSER_NOT_FOUND", "No visible ChatGPT composer anchor was found.");
      if (anchors.length !== 1) fail("EFFORT_COMPOSER_AMBIGUOUS", "Multiple visible ChatGPT composer anchors were found.");
      const composer = anchors[0];
      const explicitRoot = composer.closest('[data-testid="composer"],form');
      const boundary = 'html,body,main,article,nav,aside,header,footer,[role=main],[role=dialog],[role=log],[role=feed],[data-message-author-role]';
      const editorSelector = 'textarea,[contenteditable="true"],[contenteditable="plaintext-only"],[contenteditable=""]';
      function assertSingleEditor(root) {
        const otherEditors = matches(root,editorSelector).filter(el=>el!==composer && !composer.contains(el) && !el.contains(composer));
        if (otherEditors.length) fail("EFFORT_COMPOSER_AMBIGUOUS", "The local composer wrapper contains another visible editor.");
      }
      function candidates(root, siblingOnly=false) {
        const buttons = matches(root, "button,[role=button]");
        if (siblingOnly) {
          // A fresh composer may render its toolbar outside its explicit editor
          // form/test-ID wrapper. Outside that wrapper require an explicit
          // effort accessible label, not a bare Low/Medium/High text match.
          return buttons.filter(button => {
            if (explicitRoot.contains(button) || !/^(?:thinking )?effort(?:\s*:\s*(?:Low|Medium|High))?$/i.test(normalized(button.getAttribute("aria-label") || ""))) return false;
            if (button.form && !button.form.contains(composer)) return false;
            // Do not select controls belonging to another form, composer,
            // dialog, conversation landmark or editable subtree.
            for (let node=button; node && node!==root; node=node.parentElement) {
              if (node.matches(boundary+',form,[data-testid="composer"],'+editorSelector)) return false;
            }
            return true;
          });
        }
        const named = buttons.filter(button => {
          const name = normalized((button.getAttribute("aria-label") || "") + " " + (button.getAttribute("data-testid") || "") + " " + textOf(button));
          return /effort|thinking/i.test(name) && (effortLabel(button) || /effort/i.test(name));
        });
        const exact = buttons.filter(button =>
          protocol.EFFORTS.includes(normalized(textOf(button))) || protocol.EFFORTS.includes(button.getAttribute("aria-label")));
        return [...new Set([...named,...exact])];
      }
      if (explicitRoot) {
        assertSingleEditor(explicitRoot);
        const found = candidates(explicitRoot);
        if (found.length) return unique(found, "EFFORT_PICKER_NOT_UNIQUE", "No unique thinking-effort control was found in the composer.");
        // Only an empty explicit scope permits the stricter sibling fallback.
        // An ambiguous explicit scope must fail without widening the search.
      }
      // Walk at most six local composer ancestors, even with an explicit root.
      // Never search an entire conversation, main region, or document.
      let root = composer.parentElement;
      for (let depth = 0; root && depth < 6; depth++, root = root.parentElement) {
        if (root.matches(boundary)) break;
        if (explicitRoot && (root===explicitRoot || explicitRoot.contains(root))) continue;
        assertSingleEditor(root);
        const found = candidates(root,Boolean(explicitRoot));
        if (found.length) return unique(found, "EFFORT_PICKER_NOT_UNIQUE", "Multiple thinking-effort controls were found in the local composer wrapper.");
      }
      fail("EFFORT_PICKER_NOT_UNIQUE", "No unique thinking-effort control was found near the accessible composer anchor.");
    }
    function effortPopup() {
      const roots = matches(doc, '[data-state="open"],[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper]');
      const found = roots.filter(root => protocol.EFFORTS.every(level =>
        Array.from(root.querySelectorAll("*")).some(el => !el.children.length && normalized(textOf(el)) === level && visible(el))));
      const innermost = found.filter(root => !found.some(other => other !== root && root.contains(other)));
      if (innermost.length > 1) fail("EFFORT_PICKER_AMBIGUOUS", "Multiple open effort pickers matched.");
      return innermost[0];
    }
    function pointer(target, type, x, y, down) {
      const EventClass = win.PointerEvent;
      if (typeof EventClass !== "function") fail("POINTER_UNAVAILABLE", "This browser cannot dispatch packaged pointer events.");
      return target.dispatchEvent(new EventClass(type, {
        bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: down ? 1 : 0
      }));
    }

    // One recent, single-use inspection per document. A new inspection
    // supersedes the old one; never retain or expose a page value or credential.
    let lastInspection = null;
    const rectOf = el => {
      const r = el.getBoundingClientRect();
      return {x:r.left,y:r.top,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom};
    };
    const inside = (r,x,y) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
    const credentialAncestor = el => {
      for (let node=el; node; node=node.parentElement) if (sensitiveField(node)) return true;
      return false;
    };
    function viewportPoint(x,y) {
      if (x < 0 || y < 0 || x >= win.innerWidth || y >= win.innerHeight)
        fail("POINT_OUTSIDE_VIEWPORT","Coordinates must be inside the current CSS-pixel viewport.");
    }
    function pointTarget(x,y) {
      viewportPoint(x,y);
      if (typeof doc.elementFromPoint !== "function") fail("HIT_TEST_UNAVAILABLE","This document cannot hit-test viewport coordinates.");
      const el = doc.elementFromPoint(x,y);
      if (!el || !el.isConnected || !inside(rectOf(el),x,y)) fail("POINT_NOT_FOUND","No connected element contains the inspected point.");
      if (el.matches("iframe,frame,object,embed")) fail("FRAME_FORBIDDEN","Nested browsing contexts are not supported.");
      if (credentialAncestor(el)) fail("CREDENTIAL_INPUT_FORBIDDEN","Credential and file inputs are outside coordinate scope.");
      checkInteractable(el);
      return el;
    }
    function geometryDescription(el) {
      const tag=el.tagName.toLowerCase();
      const explicit=el.getAttribute("role");
      const implicit=tag==="button"?"button":tag==="a"&&el.hasAttribute("href")?"link":
        tag==="textarea"?"textbox":tag==="select"?"combobox":tag==="summary"?"button":
        tag==="input"?({checkbox:"checkbox",radio:"radio",range:"slider",button:"button",submit:"button",reset:"button",number:"spinbutton"}[el.type]||"textbox"):null;
      return {tag,role:explicit||implicit,ariaLabel:(el.getAttribute("aria-label")||"").slice(0,300),
        text:textOf(el).trim().slice(0,300),rect:rectOf(el)};
    }
    function chainOf(el) {
      const chain=[];
      for (let node=el; node && chain.length<64; node=node.parentElement) chain.push(geometryDescription(node));
      return chain;
    }
    function inspectAt(request) {
      chatOnly();
      lastInspection=null;
      const {x,y}=request, target=pointTarget(x,y), chain=chainOf(target);
      const id=Array.from(win.crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,"0")).join("");
      lastInspection={id,target,x,y,url:win.location.href,chain:JSON.stringify(chain),expires:now()+30000};
      return {inspectionId:id,x,y,viewport:{width:win.innerWidth,height:win.innerHeight},element:chain[0],ancestors:chain.slice(1),expiresInMs:30000};
    }
    function mapInteractive() {
      chatOnly();
      const selector='button,a[href],input:not([type="hidden"]),textarea,select,summary,[role="button"],[role="link"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="textbox"],[tabindex],[contenteditable="true"],[contenteditable="plaintext-only"],[aria-haspopup]';
      const elements=[];
      let truncated=false;
      // Include common role-less pointer/drag affordances, without emitting
      // every descendant that merely inherits its parent's cursor.
      let scanned=0;
      for (const el of doc.querySelectorAll("*")) {
        if (++scanned>10000) {truncated=true;break;}
        const style=win.getComputedStyle(el);
        if (style.pointerEvents==="none") continue;
        const pointerCursor=/^(pointer|grab|grabbing|move|ew-resize|col-resize|ns-resize|row-resize)$/.test(style.cursor);
        const custom=pointerCursor && (!el.parentElement || win.getComputedStyle(el.parentElement).cursor!==style.cursor);
        if (!el.matches(selector) && !custom) continue;
        if (credentialAncestor(el) || !visible(el)) continue;
        const r=rectOf(el);
        if (r.width<=0 || r.height<=0 || r.right<=0 || r.bottom<=0 || r.left>=win.innerWidth || r.top>=win.innerHeight) continue;
        if (elements.length===150) {truncated=true;break;}
        elements.push(geometryDescription(el));
      }
      return {viewport:{width:win.innerWidth,height:win.innerHeight},elements,truncated};
    }
    function inspectedTarget(expected,x,y) {
      const hit=pointTarget(x,y);
      if (hit!==expected && !expected.contains(hit)) fail("POINT_TARGET_CHANGED","The inspected coordinate is covered or targets a different element.");
      return hit;
    }
    function mouse(target,type,x,y,down) {
      return target.dispatchEvent(new win.MouseEvent(type,{bubbles:true,composed:true,cancelable:true,clientX:x,clientY:y,
        button:0,buttons:down?1:0,detail:type==="click"?1:0,view:win}));
    }
    function clickSequence(expected,x,y,message,openingEffect=null) {
      guard(message);
      const target=inspectedTarget(expected,x,y);
      // Honor a canceled pointerdown: browsers suppress compatibility mouse
      // events in that case, but still generate pointerup and click.
      pointer(target,"pointermove",x,y,false);
      guard(message);
      if (inspectedTarget(expected,x,y)!==target) fail("POINT_TARGET_CHANGED","The hit target changed before pointerdown.");
      const compatible=pointer(target,"pointerdown",x,y,true);
      // Release on the original target even on cancellation; never activate a
      // different element if the UI rerenders after the down event.
      try {
        guard(message);
        if (compatible && target.isConnected) mouse(target,"mousedown",x,y,true);
      } finally {
        pointer(target,"pointerup",x,y,false);
        if (compatible && target.isConnected) mouse(target,"mouseup",x,y,false);
      }
      guard(message);
      // Some menu primitives activate on pointerdown (and can hide the
      // trigger behind a modal overlay). Do not send a second activation
      // when the specifically expected popup has already appeared.
      if (openingEffect && openingEffect()) return {dispatched:true,synthetic:true,x,y};
      if (inspectedTarget(expected,x,y)!==target) fail("POINT_TARGET_CHANGED","The hit target changed during pointer dispatch; inspect before retrying.");
      mouse(target,"click",x,y,false);
      return {dispatched:true,synthetic:true,x,y};
    }
    function clickAt(request,message) {
      chatOnly();
      const saved=lastInspection;
      lastInspection=null;
      if (!saved || saved.id!==request.inspectionId || saved.url!==win.location.href || now()>=saved.expires)
        fail("INSPECTION_REQUIRED","Inspect the point again before clicking; inspections are single-use and expire after 30 seconds.");
      if (request.x!==saved.x || request.y!==saved.y) fail("POINT_NOT_INSPECTED","Click coordinates must exactly match the inspected point.");
      const target=pointTarget(request.x,request.y);
      if (target!==saved.target || JSON.stringify(chainOf(target))!==saved.chain)
        fail("POINT_TARGET_CHANGED","The inspected element, ancestry, text or geometry changed; inspect again.");
      return clickSequence(target,request.x,request.y,message);
    }
    function clickElementAt(element,message,rightEdge=false,openingEffect=null) {
      checkInteractable(element);
      const r=rectOf(element);
      const left=Math.max(0,r.left),right=Math.min(win.innerWidth,r.right);
      const top=Math.max(0,r.top),bottom=Math.min(win.innerHeight,r.bottom);
      if (!(right>left && bottom>top)) fail("POINT_OUTSIDE_VIEWPORT","The control is outside the visible viewport.");
      const x=rightEdge ? right-Math.min(5,(right-left)/2) : (left+right)/2;
      const y=(top+bottom)/2;
      inspectedTarget(element,x,y);
      return clickSequence(element,x,y,message,openingEffect);
    }

    function effortGeometry(root, current, desired) {
      const labels = protocol.EFFORTS.map(level => unique(Array.from(root.querySelectorAll("*")).filter(el =>
        !el.children.length && normalized(textOf(el)) === level && visible(el)), "EFFORT_TICKS_NOT_UNIQUE", "Supported effort ticks were not uniquely identified."));
      // The visible labels must establish one complete row. Extra labels are
      // geometry only: the protocol still permits exactly Low/Medium/High.
      const row = labels[0].parentElement;
      if (!row || labels.some(el => el.parentElement !== row))
        fail("EFFORT_GEOMETRY_UNVERIFIED", "Supported effort ticks do not share one identifiable label row.");
      const rowLabels = Array.from(row.children).filter(el => normalized(textOf(el)));
      if (![3,5].includes(rowLabels.length) || rowLabels.some(el => el.children.length || !visible(el)))
        fail("EFFORT_GEOMETRY_UNVERIFIED", "The complete effort row must have three or five visible leaf labels.");
      const names = rowLabels.map(el => normalized(textOf(el)));
      if (new Set(names.map(name => name.toLowerCase())).size !== names.length)
        fail("EFFORT_TICKS_NOT_UNIQUE", "The complete effort row contains duplicate labels.");
      const supported = labels.map(el => rowLabels.indexOf(el));
      if (supported[0] < 0 || !supported.every((index,i) => index === supported[0]+i))
        fail("EFFORT_GEOMETRY_UNVERIFIED", "Supported effort ticks are not contiguous and ordered; no unsupported tick may be crossed.");
      const rects = rowLabels.map(el => el.getBoundingClientRect());
      const xs = rects.map(r => r.left + r.width / 2);
      const ys = rects.map(r => r.top + r.height / 2);
      if (rects.some(r => !(r.width>0 && r.height>0)) || xs.some((x,i) => i>0 && !(xs[i-1]<x)) ||
          Math.max(...ys)-Math.min(...ys)>12 || rects.some((r,i) => i>0 && r.left<rects[i-1].right))
        fail("EFFORT_GEOMETRY_UNVERIFIED", "The complete effort ticks do not form one ordered horizontal row.");
      const labelTop = Math.min(...rects.map(r => r.top));
      const first=xs[0],last=xs[xs.length-1];
      // Require the track to span the entire row, not just the supported
      // subset. Keep the existing narrow-track geometry and hit-test path.
      const candidates = matches(root, 'div,span,input[type="range"],[role="slider"]').map(el => ({el,r:el.getBoundingClientRect()}))
        .filter(({r}) => r.width >= (last-first)*.8 && r.height > 0 && r.height <= 32 &&
          r.left <= first+12 && r.right >= last-12 && r.bottom <= labelTop+3 && labelTop-r.bottom <= 48);
      candidates.sort((a,b) => (labelTop-a.r.bottom)-(labelTop-b.r.bottom) || a.r.height-b.r.height);
      if (!candidates.length) fail("EFFORT_TRACK_NOT_FOUND", "No visible horizontal effort track spans the complete tick row.");
      const {el, r} = candidates[0];
      if (candidates.length > 1 && candidates[1].r.bottom === r.bottom && candidates[1].r.height === r.height &&
        !el.contains(candidates[1].el) && !candidates[1].el.contains(el))
        fail("EFFORT_TRACK_AMBIGUOUS", "Multiple unrelated tracks match the effort ticks.");
      const tickX = level => Math.max(r.left+1, Math.min(r.right-1, xs[supported[protocol.EFFORTS.indexOf(level)]]));
      return {el, y:r.top+r.height/2, from:tickX(current), to:tickX(desired)};
    }
    async function setEffort(request, message) {
      chatOnly();
      const trigger = effortButton();
      let previous = effortLabel(trigger);
      let popup, associatedId, initialSlider;
      if (!previous) {
        const unknown = () => fail("EFFORT_CURRENT_UNKNOWN", "No exact supported current effort was identified in the composer or its associated slider.");
        if (!genericEffortLabel(trigger)) unknown();
        associatedId = controlledEffortId(trigger);
        if (!associatedId) unknown();
        // Never reuse an unrelated already-open picker or open a second one.
        if (effortPopup()) {
          popup = associatedEffortPopup(trigger,associatedId);
          if (!popup) unknown();
        } else {
          const lookup = () => associatedEffortPopup(trigger,associatedId);
          clickElementAt(trigger,message,false,lookup);
          popup = await waitFor(message,lookup,"EFFORT_PICKER_NOT_OPEN","The explicitly associated effort popup did not open.");
        }
        guard(message);
        if (effortButton() !== trigger || !genericEffortLabel(trigger)) unknown();
        const observed = explicitSliderLevel(popup);
        if (!observed) unknown();
        previous = observed.level;
        initialSlider = observed.slider;
      }
      if (previous === request.effort) return {effort:previous, changed:false, verified:true};
      if (!popup) {
        popup = effortPopup();
        if (!popup) {
          clickElementAt(trigger,message,false,effortPopup);
          popup = await waitFor(message, effortPopup, "EFFORT_PICKER_NOT_OPEN", "The effort popup did not open.");
        }
      }
      const {el,y,from,to} = effortGeometry(popup, previous, request.effort);
      if (initialSlider && !(el === initialSlider || initialSlider.contains(el)))
        fail("EFFORT_GEOMETRY_UNVERIFIED","The identified effort track does not belong to the slider reporting the current value.");
      // Dispatch to the actual hit-tested child (usually the draggable thumb),
      // then to the same target for pointermove/up; no browser-wide input.
      const target = inspectedTarget(el,from,y);
      inspectedTarget(el,to,y);
      guard(message);
      let lastX=from;
      const compatible=pointer(target,"pointerdown",from,y,true);
      try {
        if (compatible && target.isConnected) mouse(target,"mousedown",from,y,true);
        for (let step=1; step<=4; step++) {
          guard(message);
          const x=from+(to-from)*step/4;
          inspectedTarget(el,x,y);
          if (!target.isConnected) fail("POINT_TARGET_CHANGED","The drag target detached before completion.");
          lastX=x;
          pointer(target,"pointermove",x,y,true);
          if (compatible) mouse(target,"mousemove",x,y,true);
        }
        guard(message);
      } catch (error) {
        pointer(target,"pointercancel",lastX,y,false);
        if (compatible && target.isConnected) mouse(target,"mouseup",lastX,y,false);
        throw error;
      }
      pointer(target,"pointerup",lastX,y,false);
      if (compatible && target.isConnected) mouse(target,"mouseup",lastX,y,false);
      await waitFor(message, () => {
        try {
          const currentTrigger = effortButton();
          const currentLabel = effortLabel(currentTrigger);
          if (currentLabel) return currentLabel === request.effort;
          if (!initialSlider || currentTrigger !== trigger || !genericEffortLabel(currentTrigger)) return false;
          const currentPopup = associatedEffortPopup(currentTrigger,associatedId);
          if (currentPopup !== popup) return false;
          const observed = explicitSliderLevel(currentPopup);
          return Boolean(observed && observed.slider === initialSlider && observed.level === request.effort);
        } catch (_) { return false; }
      }, "EFFORT_NOT_APPLIED", "Neither the composer nor its verified associated slider confirmed the requested effort; inspect before retrying.");
      return {effort:request.effort, previous, changed:true, verified:true};
    }
    function approval(expected=null) {
      // On revalidation after opening the exact menu, an accessibility focus
      // trap may mark the underlying alert/form aria-hidden. Re-read only the
      // original connected nodes in that case; never select a different form.
      const query=(root,selector)=>expected?Array.from(root.querySelectorAll(selector)):matches(root,selector);
      const forms = expected?(expected.form.isConnected?[expected.form]:[]):matches(doc, "form").filter(form => matches(form, 'button[aria-label="Approval options"]').length);
      if (!forms.length) return null;
      const form = unique(forms,"APPROVAL_AMBIGUOUS","Multiple approval forms are open.");
      const trigger = unique(query(form,'button[aria-label="Approval options"]'),"APPROVAL_AMBIGUOUS","Approval options are ambiguous.");
      if (expected && trigger!==expected.trigger) fail("APPROVAL_CHANGED","The approval trigger changed before the grant.");
      // The alert and form are siblings, not a dialog role. Walk only their
      // local ancestors and require exactly one preceding visible alert.
      let root = form.parentElement;
      let alert;
      while (root && root !== doc.body) {
        const candidates = query(root,'[role="alert"]').filter(el => el.compareDocumentPosition(form) & win.Node.DOCUMENT_POSITION_FOLLOWING);
        if (candidates.length > 1) fail("APPROVAL_AMBIGUOUS","Multiple preceding approval alerts matched.");
        if (candidates.length === 1) { alert = candidates[0]; break; }
        root = root.parentElement;
      }
      if (!alert) fail("APPROVAL_TEXT_NOT_FOUND","The approval form has no uniquely associated preceding alert.");
      if (expected && alert!==expected.alert) fail("APPROVAL_CHANGED","The approval alert changed before the grant.");
      const leaves = Array.from(alert.querySelectorAll("*")).filter(el => !el.children.length && (expected || visible(el)));
      const questionCandidates = leaves.filter(el => /^Allow ChatGPT to use .+\??$/i.test(normalized(textOf(el))));
      const q = questionCandidates.length === 1 ? questionCandidates[0] : (!alert.children.length && /^Allow ChatGPT to use .+\??$/i.test(normalized(textOf(alert))) ? alert : null);
      if (!q) fail("APPROVAL_TEXT_NOT_FOUND","The approval question could not be isolated.");
      const question = textOf(q).trim();
      const description = leaves.filter(el=>el!==q).map(el=>textOf(el).trim()).filter(Boolean).join("\n");
      if (!description) fail("APPROVAL_TEXT_NOT_FOUND","The approval description could not be isolated.");
      if (question.length + description.length > 16000) fail("APPROVAL_TEXT_TOO_LONG","Approval text exceeds the safe response limit.");
      return {form,trigger,alert,question,description};
    }
    async function approve(request,message) {
      chatOnly();
      const initial = approval();
      if (!initial) return {found:false,approved:false};
      const {question,description} = initial;
      // No service supplied: read the question, without opening or granting.
      if (!request.service) return {found:true,approved:false,question,description};
      const expected = "Allow ChatGPT to use " + request.service;
      if (![expected,expected+"?"].includes(normalized(question)))
        fail("APPROVAL_SERVICE_MISMATCH","The open question does not match the explicitly requested service.");
      const menus = () => matches(doc,'[role="menu"][data-state="open"]');
      if (menus().length) fail("APPROVAL_MENU_ALREADY_OPEN","Inspect and close the existing menu before authorizing.");
      clickElementAt(initial.trigger,message,true,()=>menus().length===1);
      const menu = await waitFor(message, () => {
        const items = menus();
        if (items.length > 1) fail("APPROVAL_MENU_AMBIGUOUS","Multiple menus are open.");
        return items[0];
      },"APPROVAL_MENU_NOT_OPEN","Approval options did not open.");
      const current = approval(initial);
      if (!current || current.form !== initial.form || current.question !== question || current.description !== description)
        fail("APPROVAL_CHANGED","The approval prompt changed before the grant.");
      const items = matches(menu,'[role="menuitem"]');
      const full = "Allow " + request.service + " for this conversation";
      // The expected item is second, but its label must independently match.
      if (items.length < 2 || normalized(textOf(items[1])) !== full ||
          items.filter(item=>normalized(textOf(item)) === full).length !== 1)
        fail("APPROVAL_OPTION_NOT_VERIFIED","The full-conversation menu item was not verified. No grant was activated.");
      clickElementAt(items[1],message);
      await waitFor(message, () => !initial.form.isConnected || (!menus().length && !visible(initial.trigger)), "APPROVAL_NOT_CONFIRMED",
        "The grant was activated but the approval form did not disappear; inspect before retrying.");
      return {found:true,approved:true,scope:"conversation",question,description,service:request.service};
    }
    function key(request,message) {
      // The internal fixture is allowed only for synthetic key-event smoke
      // tests; ChatGPT is the only external origin already permitted by guard.
      const target = doc.activeElement || doc.body;
      checkInteractable(target);
      if (sensitiveField(target)) fail("CREDENTIAL_INPUT_FORBIDDEN","Credential inputs are outside keyboard scope.");
      const parts = request.key.split("+");
      const raw = parts.pop();
      const letter = /^[A-Z]$/.test(raw);
      const keyValue = letter && !parts.includes("Shift") ? raw.toLowerCase() : raw;
      const code = letter ? "Key"+raw : /^[0-9]$/.test(raw) ? "Digit"+raw : raw;
      const options = {key:keyValue,code,ctrlKey:parts.includes("Ctrl"),shiftKey:parts.includes("Shift"),
        altKey:parts.includes("Alt"),metaKey:parts.includes("Meta"),bubbles:true,cancelable:true,composed:true};
      guard(message);
      const down = new win.KeyboardEvent("keydown",options);
      const accepted = target.dispatchEvent(down);
      // Always release on the same target; do not retarget after an event.
      target.dispatchEvent(new win.KeyboardEvent("keyup",options));
      return {dispatched:true,key:request.key,defaultPrevented:!accepted,synthetic:true};
    }

    async function handle(message, sender) {
      if (message?.kind !== "kasm-agent-dom-v1") return undefined;
      if (sender?.id !== extensionId || sender.tab) {
        return { ok: false, error: { code: "SENDER_FORBIDDEN", message: "Only this extension's background page may send DOM commands." } };
      }
      try {
        guard(message);
        const request = protocol.validateCommand(message.command);
        let result;
        switch (request.cmd) {
          case "tabs.readText": result = readText(request); break;
          case "tabs.eval": result = probe(request); break;
          case "tabs.click": result = click(request, message); break;
          case "tabs.type": result = await type(request, message); break;
          case "tabs.setEffort": result = await setEffort(request, message); break;
          case "tabs.approve": result = await approve(request, message); break;
          case "tabs.key": result = key(request, message); break;
          case "tabs.inspectAt": result = inspectAt(request); break;
          case "tabs.clickAt": result = clickAt(request,message); break;
          case "tabs.mapInteractive": result = mapInteractive(); break;
          default: fail("UNKNOWN_DOM_COMMAND", "This command is not a packaged DOM operation.");
        }
        return { ok: true, result };
      } catch (error) {
        return { ok: false, error: {
          code: typeof error?.code === "string" ? error.code : "DOM_ACTION_FAILED",
          message: typeof error?.code === "string" ? error.message : "The DOM operation failed; inspect the current page before retrying."
        } };
      }
    }

    return Object.freeze({ handle });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { createContentExecutor };
    return;
  }
  if (globalThis.__KASM_AGENT_DOCUMENT__) return {
    documentToken: globalThis.__KASM_AGENT_DOCUMENT__.binding.documentToken,
    url: window.location.href
  };
  // The private HTTP fixture is not a secure context in Firefox.
  // getRandomValues is supported there and keeps a 128-bit per-document token.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const documentToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const binding = Object.freeze({ documentToken, url: window.location.href });
  const executor = createContentExecutor({ window, document, protocol: globalThis.KasmProtocol, extensionId: browser.runtime.id, documentToken: binding.documentToken });
  browser.runtime.onMessage.addListener(executor.handle);
  Object.defineProperty(globalThis, "__KASM_AGENT_DOCUMENT__", { value: { binding }, configurable: false });
  return binding;
})();
