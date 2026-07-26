/**
 * QML Renderer - Phase 1
 * Combines parser, element mappings, and layout engine to generate HTML
 */

import type { QMLNode } from './parser'
import { parseQML } from './parser'
import { ELEMENT_MAP, type StyleMap, escapeHTML, escapeAttr } from './elements'
import { computeLayoutStyles } from './layouts'

/**
 * Full element style computation:
 * element-specific styles + layout styles + common dimensions
 */
function computeAllStyles(node: QMLNode): StyleMap {
  const elemStyles = ELEMENT_MAP[node.type]
  const styles: StyleMap = {
    // Default position for non-absolute children
    'box-sizing': 'border-box',
  }

  // Element-specific visual styles
  if (elemStyles) {
    Object.assign(styles, elemStyles.computeStyles(node.properties))
  }

  // Layout styles (anchors, width, height, x, y, etc.)
  Object.assign(styles, computeLayoutStyles(node.properties))

  return styles
}

/**
 * Convert styles object to inline CSS string
 */
function stylesToString(styles: StyleMap): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

/**
 * Generate a CSS class id for node type reference
 */
function nodeClass(type: string): string {
  return `qml-${type.toLowerCase()}`
}

/**
 * Deep-clone a QML node with optional index substitution in property values.
 * Replaces "${index}" tokens with the given number.
 */
function cloneNodeWithIndex(node: QMLNode, idx: number): QMLNode {
  const props: Record<string, string> = {}
  for (const [k, v] of Object.entries(node.properties)) {
    props[k] = v.replace(/\$\{index\}/g, String(idx))
  }
  return {
    type: node.type,
    properties: props,
    children: node.children.map(c => cloneNodeWithIndex(c, idx)),
  }
}

/**
 * Expand ListView content: if blockProperties.delegate exists and model is numeric,
 * generate repeated children.
 */
function expandListView(node: QMLNode): QMLNode[] {
  if (!node.blockProperties?.delegate) return node.children

  const delegate = node.blockProperties.delegate
  const modelVal = node.properties.model

  // Integer model: model: 20
  const count = parseInt(modelVal || '', 10)
  if (!isNaN(count) && count > 0 && count < 1000) {
    const items: QMLNode[] = []
    for (let i = 0; i < count; i++) {
      items.push(cloneNodeWithIndex(delegate, i))
    }
    return items
  }

  return node.children
}

/**
 * Render a single QML node and its children to HTML string
 */
function renderNode(node: QMLNode, parentType?: string): string {
  const mapping = ELEMENT_MAP[node.type]
  const styles = computeAllStyles(node)

  // If this is a layout container with no explicit width, fill parent width
  if (!styles['width'] && (
    node.type === 'ColumnLayout' || node.type === 'Column' ||
    node.type === 'RowLayout' || node.type === 'Row'
  )) {
    styles['width'] = '100%'
  }

  // If parent is a flex layout (ColumnLayout/Column/RowLayout/Row),
  // force width:100% on children so they fill the layout
  const isFlexParent = parentType === 'ColumnLayout' || parentType === 'Column' ||
                       parentType === 'RowLayout' || parentType === 'Row'
  if (isFlexParent && !styles['width']) {
    styles['width'] = '100%'
  }
  const styleStr = stylesToString(styles)
  const cls = nodeClass(node.type)
  const idAttr = node.id ? ` id="${escapeHTML(node.id)}"` : ''

  // Build extra attributes from element mapping
  let extraAttrStr = ''
  if (mapping?.getAttributes) {
    const attrs = mapping.getAttributes(node.properties)
    extraAttrStr = ' ' + Object.entries(attrs)
      .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
      .join(' ')
  }

  // Determine tag to use
  const tag = mapping?.tag || 'div'
  const isInput = tag === 'input'
  const isTextarea = tag === 'textarea'

  // Start the element tag
  let html: string
  if (isInput) {
    // Self-closing tag
    html = `<${tag}${idAttr}${extraAttrStr} class="qml-node ${cls}" style="${styleStr}" />`
  } else {
    html = `<${tag}${idAttr}${extraAttrStr} class="qml-node ${cls}" style="${styleStr}">`
  }

  // Render inner content
  if (isTextarea) {
    // textarea uses text content, not HTML children
    html += escapeHTML(node.properties.text || '') + '</textarea>'
    return html
  }

  if (isInput) {
    // Self-closing, no content or children
    return html
  }

  // Normal content rendering
  if (mapping?.renderContent) {
    html += mapping.renderContent(node.properties)
  } else if (node.properties.text) {
    // Fallback: show text for unknown element types (Label, Button, etc.)
    html += escapeHTML(node.properties.text)
  }

  // Render children
  if (node.children.length > 0 || (node.type === 'ListView' && node.blockProperties?.delegate)) {
    // Determine if parent is a layout type — needed by children for auto-stretch
    const layoutParent = (
      node.type === 'ColumnLayout' || node.type === 'Column' ||
      node.type === 'RowLayout' || node.type === 'Row'
    ) ? node.type : undefined

    // For ListView, expand delegate+model into children
    const effectiveChildren = node.type === 'ListView'
      ? expandListView(node)
      : node.children

    for (const child of effectiveChildren) {
      html += renderNode(child, layoutParent)
    }
  }

  html += `</${tag}>`
  return html
}

/**
 * Convert QML dimension value to CSS pixel string (e.g. "900" → "900px").
 * Returns undefined if the value is empty or non-numeric.
 */
function winSize(v: string | undefined): string | undefined {
  if (!v) return undefined
  const n = parseFloat(v.replace(/px|pt|dp/gi, '').trim())
  return isNaN(n) ? undefined : `${n}px`
}

/**
 * Render a complete QML document to an HTML string.
 * Supports Window type by extracting its content and properties.
 */
export function renderQMLToHTML(nodes: QMLNode[], isLight: boolean = true): string {
  if (nodes.length === 0) {
    return emptyPreview(isLight)
  }

  const bgColor = isLight ? '#ffffff' : '#1e1e1e'
  const textColor = isLight ? '#000000' : '#cccccc'

  // If the root is a Window, extract its content
  let bodyStyles: StyleMap = {
    'margin': '0',
    'overflow': 'hidden',
    'width': '100%',
    'height': '100%',
    'background': bgColor,
    'color': textColor,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }

  let innerHTML = ''
  let windowTitle = 'QML Preview'

  for (const node of nodes) {
    if (node.type === 'Window' || node.type === 'ApplicationWindow') {
      windowTitle = node.properties.title || 'QML Preview'
      // Apply window background color if set
      if (node.properties.color) {
        bodyStyles['background'] = node.properties.color
      }

      // Use specified window dimensions for a centered window simulation
      const winW = winSize(node.properties.width)
      const winH = winSize(node.properties.height)

      // Body uses flexbox to center the window in the preview panel
      bodyStyles['display'] = 'flex'
      bodyStyles['justify-content'] = 'center'
      bodyStyles['align-items'] = 'center'

      // Allow body to scroll when the window is larger than the preview panel
      if (winW || winH) {
        bodyStyles['overflow'] = 'auto'
      }

      const wStyle = winW || '100%'
      const hStyle = winH || '100%'

      innerHTML += `<div class="qml-window" style="position:relative; width:${wStyle}; height:${hStyle}; overflow:hidden;">`

      // Render header block-property (MenuBar, ToolBar) at the top
      const hasHeader = !!node.blockProperties?.header
      if (hasHeader) {
        const headerNode = node.blockProperties!.header
        const headerHTML = renderNode(headerNode)
        innerHTML += headerHTML

        // Open a content container below the header, so children with
        // position:absolute (anchors.fill) do not overlap the header
        innerHTML += `<div style="position:absolute; top:32px; left:0; right:0; bottom:0; overflow:hidden;">`
      }

      // Get window's children
      for (const child of node.children) {
        innerHTML += renderNode(child)
      }

      // Close content container if we opened one
      if (hasHeader) {
        innerHTML += `</div>`
      }
      innerHTML += '</div>'
    } else {
      // Top-level non-Window element
      innerHTML += renderNode(node)
    }
  }

  const bodyStyleStr = stylesToString(bodyStyles)
  const escapedTitle = escapeHTML(windowTitle)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; }
  body { ${bodyStyleStr} }
  :root {
    --qml-control-bg: ${isLight ? '#ffffff' : '#2d2d2d'};
    --qml-control-text: ${isLight ? '#333333' : '#cccccc'};
    --qml-muted-text: ${isLight ? '#999999' : '#888888'};
    --qml-control-border: ${isLight ? '#cccccc' : '#555555'};
    --qml-btn-bg: ${isLight ? '#e0e0e0' : '#3a3a3a'};
    --qml-btn-hover-bg: ${isLight ? '#d0d0d0' : '#4a4a4a'};
    --qml-accent: ${isLight ? '#0078d4' : '#4da6ff'};
    --qml-progress-bg: ${isLight ? '#e0e0e0' : '#3a3a3a'};
    --qml-slider-track: ${isLight ? '#dddddd' : '#444444'};
    --qml-switch-off: ${isLight ? '#cccccc' : '#555555'};
    --qml-combo-dd-bg: ${isLight ? '#ffffff' : '#2d2d2d'};
    --qml-combo-dd-border: ${isLight ? '#cccccc' : '#555555'};
    --qml-combo-dd-shadow: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)'};
    --qml-combo-dd-hover-bg: ${isLight ? '#f0f0f0' : '#3a3a3a'};
    --qml-combo-dd-sel-bg: ${isLight ? '#e8e8e8' : '#3a3a3a'};
    --qml-menubar-bg: ${isLight ? '#f0f0f0' : '#252525'};
    --qml-text-color: ${isLight ? '#000000' : '#cccccc'};
    --qml-list-border: ${isLight ? '#e0e0e0' : '#444'};
    --qml-item-border: ${isLight ? '#f0f0f0' : '#333'};
    --qml-spinner-border: ${isLight ? '#e0e0e0' : '#444'};
    --qml-dialog-bg: ${isLight ? 'white' : '#2d2d2d'};
    --qml-dialog-shadow: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)'};
    --qml-menubar-border: ${isLight ? '#ddd' : '#444'};
  }
  .qml-node { position:relative; }
  @keyframes qml-spin { to { transform: rotate(360deg); } }
  [data-qml-type="button"]:hover { background:var(--qml-btn-hover-bg) !important; }
  [data-qml-type="roundbutton"]:hover { background:var(--qml-btn-hover-bg) !important; }
  [data-qml-type="toolbutton"]:hover { background:var(--qml-combo-dd-hover-bg) !important; }
  [data-qml-type="menu"]:hover { background:var(--qml-combo-dd-hover-bg) !important; }
  [data-qml-type="tabbutton"]:hover { background:var(--qml-combo-dd-hover-bg); }
  [data-qml-type="checkbox"]:hover span:first-child { color:var(--qml-accent); }
  [data-qml-type="radio"]:hover span:first-child { color:var(--qml-accent); }
</style>
</head>
<body>
${innerHTML}
<script>
try {
(function(){
var S={};
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-qml-type]');
  if(!t)return;
  var type=t.getAttribute('data-qml-type');
  switch(type){
    case'button':
    case'roundbutton':{
      t.style.transform='scale(0.93)';
      setTimeout(function(){t.style.transform='';},100);
      break;
    }
    case'toolbutton':{
      t.style.background='var(--qml-btn-hover-bg)';
      setTimeout(function(){t.style.background='';},150);
      break;
    }
    case'checkbox':{
      var checked=t.getAttribute('data-qml-checked')!=='true';
      t.setAttribute('data-qml-checked',String(checked));
      var marker=t.querySelector('.qml-cb-marker');
      if(marker)marker.textContent=checked?'✓':'☐';
      break;
    }
    case'radio':{
      var grp=t.getAttribute('data-qml-group')||'default';
      var txt=t.getAttribute('data-qml-text')||'';
      document.querySelectorAll('[data-qml-type="radio"][data-qml-group="'+grp+'"]').forEach(function(r){
        r.innerHTML='<span style="font-size:16px;line-height:1">○</span> '+(r.getAttribute('data-qml-text')||'');
      });
      t.innerHTML='<span style="font-size:16px;line-height:1">◉</span> '+txt;
      break;
    }
    case'switch':{
      var on=t.getAttribute('data-qml-checked')!=='true';
      t.setAttribute('data-qml-checked',String(on));
      var track=t.firstElementChild;
      if(track){
        track.style.background=on?'var(--qml-switch-on,#4cd964)':'var(--qml-switch-off)';
        var thumb=track.firstElementChild;
        if(thumb){thumb.style.right=on?'2px':'auto';thumb.style.left=on?'auto':'2px';}
      }
      break;
    }
    case'slider':{
      var rect=t.getBoundingClientRect();
      var x=e.clientX-rect.left;
      var pct=Math.max(0,Math.min(100,(x/rect.width)*100));
      var from=parseFloat(t.getAttribute('data-qml-from')||'0');
      var to=parseFloat(t.getAttribute('data-qml-to')||'100');
      t.setAttribute('data-qml-value',String(Math.round(from+(to-from)*(pct/100))));
      t.style.background='linear-gradient(to right, var(--qml-accent) '+pct+'%, var(--qml-slider-track) '+pct+'%)';
      break;
    }
    case'tabbutton':{
      var tb=t.parentElement;
      var kids=Array.prototype.filter.call(tb.children,function(c){return c.getAttribute('data-qml-type')==='tabbutton';});
      var idx=kids.indexOf(t);
      if(idx<0)return;
      kids.forEach(function(c,i){
        c.style.borderBottom=i===idx?'2px solid var(--qml-accent)':'2px solid transparent';
        c.style.color=i===idx?'var(--qml-text-color)':'var(--qml-muted-text)';
      });
      var stack=tb.nextElementSibling;
      while(stack&&!stack.classList.contains('qml-stacklayout')){stack=stack.nextElementSibling;}
      if(stack){
        var panels=Array.prototype.filter.call(stack.children,function(c){return c.classList.contains('qml-node');});
        panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
      }
      break;
    }
    case'combobox':{
      // Close any existing combobox dropdowns first
      document.querySelectorAll('.qml-combo-dd').forEach(function(d){d.remove();});
      var raw=t.getAttribute('data-qml-model')||'[]';
      var items;
      try{items=JSON.parse(raw);}catch(e){items=[];}
      if(!items.length)return;
      var currentIdx=parseInt(t.getAttribute('data-qml-currentindex')||'-1',10);
      var rect=t.getBoundingClientRect();
      var box=document.createElement('div');
      box.className='qml-combo-dd';
      box.style.cssText='position:fixed;top:'+(rect.bottom+2)+'px;left:'+rect.left+'px;width:'+rect.width+'px;background:var(--qml-combo-dd-bg);border:1px solid var(--qml-combo-dd-border);border-radius:4px;z-index:10000;box-shadow:0 4px 12px var(--qml-combo-dd-shadow);';
      items.forEach(function(item,i){
        var opt=document.createElement('div');
        opt.textContent=item;
        opt.style.cssText='padding:6px 10px;cursor:pointer;font-size:13px;color:var(--qml-control-text);'+(i===currentIdx?'background:var(--qml-combo-dd-sel-bg);font-weight:600;':'');
        opt.onmouseover=function(){opt.style.background='var(--qml-combo-dd-hover-bg)';};
        opt.onmouseout=function(){opt.style.background=i===currentIdx?'var(--qml-combo-dd-sel-bg)':'';};
        opt.onclick=function(e){
          e.stopPropagation();
          t.setAttribute('data-qml-currentindex',String(i));
          var lbl=t.querySelector('span:first-child');
          if(lbl){
            lbl.textContent=item;
            lbl.style.color='var(--qml-control-text)';
          }
          box.remove();
        };
        box.appendChild(opt);
      });
      document.body.appendChild(box);
      // Auto-close on outside click
      var closer=function(e){
        if(!box.contains(e.target)){
          box.remove();
          document.removeEventListener('click',closer,true);
        }
      };
      setTimeout(function(){document.addEventListener('click',closer,true);},0);
      break;
    }
    case'menu':{
      // convert children to dropdown on first click
      var dd=t.querySelector('.qml-menu-dd');
      if(!dd&&t.children.length){
        dd=document.createElement('div');
        dd.className='qml-menu-dd';
        dd.style.cssText='display:none;position:absolute;top:100%;left:0;background:var(--qml-combo-dd-bg);border:1px solid var(--qml-combo-dd-border);border-radius:4px;box-shadow:0 4px 12px var(--qml-combo-dd-shadow);z-index:200;min-width:120px;margin-top:2px;';
        while(t.children.length){
        var mc=t.children[0];
        mc.style.display='';
        dd.appendChild(mc);
      }
        t.appendChild(dd);
      }
      if(dd)dd.style.display=dd.style.display==='none'?'block':'none';
      break;
    }
  }
});
// close dropdowns on outside click
document.addEventListener('click',function(e){
  if(!e.target.closest('[data-qml-type="combobox"]')){
    document.querySelectorAll('.qml-combo-dd').forEach(function(d){d.remove();});
  }
  if(!e.target.closest('[data-qml-type="menu"]')){
    document.querySelectorAll('.qml-menu-dd').forEach(function(d){d.style.display='none';});
  }
});
// init: highlight first tab, show only first stack panel
(function init(){
  document.querySelectorAll('[data-qml-type="tabbutton"]').forEach(function(t,i){
    if(i===0){t.style.borderBottom='2px solid var(--qml-accent)';t.style.color='var(--qml-text-color)';}
  });
  document.querySelectorAll('.qml-stacklayout').forEach(function(s){
    var panels=Array.prototype.filter.call(s.children,function(c){return c.classList.contains('qml-node');});
    panels.forEach(function(p,i){p.style.display=i===0?'':'none';});
  });
})();
})();
}catch(e){document.body.innerHTML='<div style="color:red;padding:20px;font-family:monospace">Preview error: '+e.message+'</div>';}
</script>
</body>
</html>`
}

/**
 * Generate empty preview state
 */
export function emptyPreview(isLight: boolean = true): string {
  const bgColor = isLight ? '#f5f5f5' : '#1e1e1e'
  const textColor = isLight ? '#888' : '#666'
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Empty Preview</title>
<style>
  body { margin:0; display:flex; align-items:center; justify-content:center; 
         height:100vh; font-family:sans-serif; color:${textColor}; background:${bgColor}; }
</style>
</head>
<body>
<div>Click "Refresh Preview" to render QML content</div>
</body>
</html>`
}

/**
 * Parse and render QML source to HTML in one call
 */
export function parseAndRender(qmlSource: string, isLight: boolean = true): string {
  const nodes = parseQML(qmlSource)
  if (nodes.length === 0) return emptyPreview(isLight)
  return renderQMLToHTML(nodes, isLight)
}
