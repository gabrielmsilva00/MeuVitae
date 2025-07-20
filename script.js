/* UTILS */
const $id = (id) => document.getElementById(id);
const $json = (src) => {
  try { return JSON.parse(src); } catch { return null; }
}
const extractAllStyles = () => {
  let result = '';
  for (const sheet of document.styleSheets) {
    try {
      if (
        sheet.ownerNode.tagName === 'STYLE' ||
        (sheet.href && sheet.href.startsWith(location.origin))
      ) {
        for (const rule of sheet.cssRules) result += rule.cssText + '\n';
      }
    } catch {}
  }
  return result;
};
/* RESUME BLOCK CUSTOM ELEMENT */
class ResumeBlock extends HTMLElement {
  constructor() {
    super();
    this.#injectControls();
  }
  #injectControls() {
    const controls = document.createElement('div');
    controls.className = 'block-controls';
    controls.innerHTML = `
      <div class="drag-handle" draggable="true" title="Mover este bloco">↕️</div>
      <button class="delete-block-btn" title="Remover este bloco">❌</button>
    `;
    this.prepend(controls);
    controls.querySelector('.delete-block-btn').onclick = () => {
      this.remove();
      document.dispatchEvent(new CustomEvent('content-changed'));
    };
  }
}
customElements.define('resume-block', ResumeBlock);
/* THEME */
const THEME_KEYS = [
  '--custom-papel',
  '--custom-texto-de-bloco',
  '--custom-texto-comum',
  '--custom-destaque',
  '--custom-borda'
];
const defaultTheme = {
  '--custom-papel': '#FFFFFF',
  '--custom-texto-de-bloco': '#111827',
  '--custom-texto-comum': '#6B7280',
  '--custom-destaque': '#3B82F6',
  '--custom-borda': '#E5E7EB'
};
const ThemeEngine = (() => {
  let customColors = { ...defaultTheme };
  function setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('resume-theme', theme);
    updateSwatch(theme);
    if (theme === 'custom') applyCustomColors();
  }
  function updateSwatch(theme) {
    document.querySelectorAll('.theme-swatch').forEach(sw =>
      sw.classList.toggle('active', sw.dataset.theme === theme)
    );
  }
  function load() {
    const savedTheme = localStorage.getItem('resume-theme');
    const savedColors = $json(localStorage.getItem('resume-custom-colors')) || {};
    Object.assign(customColors, savedColors);
    setColorsOnRoot();
    setTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }
  function setColorsOnRoot() {
    for (const key of THEME_KEYS) {
      document.documentElement.style.setProperty(key, customColors[key]);
    }
    try {
      $id('custom-color-preview-foreground').style.backgroundColor = customColors['--custom-texto-de-bloco'];
      $id('custom-color-preview-background').style.backgroundColor = customColors['--custom-borda'];
    } catch {}
  }
  function applyCustomColors() {
    setColorsOnRoot();
    localStorage.setItem('resume-custom-colors', JSON.stringify(customColors));
  }
  function onCustomizerInput(e) {
    const { key, textInputKey } = e.target.dataset;
    if (e.target.type === 'color' && textInputKey && THEME_KEYS.includes(textInputKey)) {
      const txt = this.querySelector(`input[type="text"][data-key="${textInputKey}"]`);
      if (txt) txt.value = e.target.value;
      customColors[textInputKey] = e.target.value;
      applyCustomColors();
      setTheme('custom');
    } else if (e.target.type === 'text' && key && THEME_KEYS.includes(key)) {
      const clr = this.querySelector(`input[type="color"][data-text-input-key="${key}"]`);
      if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) {
        if (clr) clr.value = e.target.value;
        customColors[key] = e.target.value;
        applyCustomColors();
        setTheme('custom');
      }
    }
  }
  function openCustomizer() {
    const grid = $id('customizer-grid');
    grid.innerHTML = THEME_KEYS.map(
      (k) => `
        <div class="color-picker-wrapper">
          <label>${k.replace('--custom-', '').replace(/-/g, ' ')}</label>
          <input type="text" data-key="${k}" value="${customColors[k]}" maxlength="7">
          <input type="color" data-text-input-key="${k}" value="${customColors[k]}">
        </div>
      `
    ).join('');
    grid.removeEventListener('input', onCustomizerInput);
    grid.addEventListener('input', onCustomizerInput);
    $id('theme-customizer').classList.add('active');
  }
  return {
    init() {
      load();
      document.querySelectorAll('.theme-swatch').forEach(sw =>
        sw.addEventListener('click', () => setTheme(sw.dataset.theme))
      );
      document.querySelectorAll('#theme-customizer .close-modal-btn').forEach(el =>
        el.addEventListener('click', () => $id('theme-customizer').classList.remove('active'))
      );
    },
    open: openCustomizer
  };
})();
/* ACTIONS API */
export const actions = Object.create(null);
export const registerAction = (name, fn) => (actions[name] = fn);
/* EXPORTING */
async function exportPdf(filename) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const page = $id('page');
  const scale = 210 / page.getBoundingClientRect().width;
  const headers = page.querySelectorAll('h1, h2, h3, p, li');
  headers.forEach(el => {
    pdf.setFont('times');
    pdf.setFontSize(12);
    pdf.text(el.textContent.trim(), 10, pdf.internal.getNumberOfPages() * 10 + 10);
  });
  pdf.save(`${filename}.pdf`);
}
function exportHtml(filename) {
  const page = $id('page').cloneNode(true);
  page.querySelectorAll('.block-controls').forEach(e => e.remove());
  page.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${filename}</title><style>${extractAllStyles()}</style></head><body>${page.outerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function exportPng(filename) {
  $id('page').querySelectorAll('.block-controls').forEach(c => (c.style.visibility = 'hidden'));
  try {
    const canvas = await window.html2canvas($id('page'), { scale: 3, useCORS: true });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${filename}.png`;
    a.click();
  } finally {
    $id('page').querySelectorAll('.block-controls').forEach(c => (c.style.visibility = 'visible'));
  }
}
export const exporter = { pdf: exportPdf, html: exportHtml, png: exportPng };
/* TEMPLATING */
export function addBlock(templateId) {
  const newBlock = $id(templateId).content.cloneNode(true);
  $id('page').appendChild(newBlock);
  document.dispatchEvent(new CustomEvent('content-changed'));
}
/* FONT */
export function changeFontSize(block, dir) {
  if (!block) return;
  block.querySelectorAll('h1,h2,h3,p,li,strong,a').forEach(el => {
    const cur = parseFloat(getComputedStyle(el).fontSize);
    const next = dir === 'increase' ? cur + 1 : Math.max(8, cur - 1);
    el.style.fontSize = `${next}px`;
  });
  document.dispatchEvent(new CustomEvent('content-changed'));
}
/* CTX MENU */
const contextMenu = $id('context-menu');
const blockMenuItems = [
  { label: 'Aumentar Fonte', action: 'increaseFont' },
  { label: 'Diminuir Fonte', action: 'decreaseFont' },
  { label: 'Inserir Link', action: 'insertLink' }
];
const globalMenuItems = [
  { label: 'Adicionar Cabeçalho', action: 'addHeader' },
  { label: 'Adicionar Bloco de Texto', action: 'addText' },
  { label: 'Adicionar 2 Colunas', action: 'addColumns' },
  { type: 'separator' },
  { label: 'Personalizar Aparência...', action: 'customizeTheme' },
  { label: 'Editor de HTML Avançado...', action: 'editHtml' },
  { type: 'separator' },
  { label: 'Salvar Como...', action: 'openSaveMenu' }
];
let contextMenuTarget = null;
function openContextMenu(e) {
  e.preventDefault();
  contextMenu.innerHTML = '';
  contextMenu.classList.add('active');
  contextMenuTarget = e.target.closest('resume-block');
  const items = contextMenuTarget ? blockMenuItems : globalMenuItems;
  for (const item of items) {
    if (item.type === 'separator') {
      contextMenu.insertAdjacentHTML('beforeend', '<div class="menu-separator"></div>');
    } else {
      const btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.textContent = item.label;
      btn.onclick = () => {
        if (actions[item.action]) actions[item.action](contextMenuTarget);
        contextMenu.classList.remove('active');
      };
      contextMenu.appendChild(btn);
    }
  }
  const { clientX: x, clientY: y } = e;
  const menuW = contextMenu.offsetWidth, menuH = contextMenu.offsetHeight;
  contextMenu.style.left = `${Math.min(x, window.innerWidth - menuW - 5)}px`;
  contextMenu.style.top = `${Math.min(y, window.innerHeight - menuH - 5)}px`;
}
document.addEventListener('contextmenu', openContextMenu);
document.addEventListener('click', e => {
  if (!contextMenu.contains(e.target)) contextMenu.classList.remove('active');
});
/* HOOK */
export function hookActions() {
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act && actions[act]) actions[act](contextMenuTarget);
  });
}
/* INIT */
export function initApp() {
  ThemeEngine.init();
  // Drag & Drop
  (() => {
    let dragged = null;
    const page = $id('page');
    page.addEventListener('dragstart', (e) => {
      if (e.target.matches('.drag-handle')) {
        dragged = e.target.closest('resume-block');
        setTimeout(() => dragged.classList.add('dragging'), 0);
      }
    });
    page.addEventListener('dragend', () => {
      if (dragged) {
        dragged.classList.remove('dragging');
        dragged = null;
      }
    });
    page.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragged) return;
      const tgt = e.target.closest('resume-block');
      if (tgt && tgt !== dragged) {
        const rect = tgt.getBoundingClientRect();
        const after = (e.clientY - rect.top) / rect.height > 0.5;
        page.insertBefore(dragged, after ? tgt.nextSibling : tgt);
      }
    });
  })();
  // Content Overflow
  (() => {
    const warning = $id('page-overflow-warning');
    const page = $id('page');
    function overflowing() {
      return page.scrollHeight > page.clientHeight + 2;
    }
    function notify() {
      warning.style.display = 'block';
      warning.style.opacity = '1';
      setTimeout(() => warning.style.opacity = '0', 1800);
    }
    function revertInput(e) {
      if (overflowing()) {
        e.preventDefault();
        document.execCommand('undo');
        notify();
      }
    }
    page.addEventListener('input', revertInput, true);
    document.addEventListener('content-changed', () => { if (overflowing()) { document.execCommand('undo'); notify(); } });
  })();
  // Logo & Info Modal
  for (const id of ['logo-btn', 'mobile-logo-btn']) {
    const btn = $id(id);
    if (!btn) continue;
    btn.addEventListener('click', () => $id('info-modal').classList.add('active'));
  }
  $id('info-modal')?.querySelectorAll('.close-modal-btn').forEach(x =>
    x.addEventListener('click', () => $id('info-modal').classList.remove('active'))
  );
  $id('info-modal')?.querySelectorAll('button[data-action]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      $id('info-modal').classList.remove('active');
      const a = btn.dataset.action;
      if (actions[a]) actions[a]();
    })
  );
}
/* BINDINGS */
actions.openSaveMenu = () => $id('save-modal').classList.add('active');
actions.customizeTheme = () => ThemeEngine.open();
actions.editHtml = () => {
  const htmlModal = $id('html-editor-modal');
  $id('html-editor').value = $id('page').innerHTML.replace(/></g, '>\n<');
  htmlModal.classList.add('active');
  htmlModal.querySelectorAll('.close-modal-btn').forEach(btn =>
    btn.addEventListener('click', () => htmlModal.classList.remove('active'))
  );
  $id('save-html-btn').onclick = () => {
    if (confirm('Salvar o HTML diretamente pode quebrar funcionalidades. Prosseguir?')) {
      $id('page').innerHTML = $id('html-editor').value;
      document.dispatchEvent(new CustomEvent('content-changed'));
      htmlModal.classList.remove('active');
    }
  };
};
actions.addHeader = () => addBlock('template-block-header');
actions.addText = () => addBlock('template-block-text');
actions.addColumns = () => addBlock('template-block-columns');
actions.increaseFont = (target) => changeFontSize(target, 'increase');
actions.decreaseFont = (target) => changeFontSize(target, 'decrease');
actions.insertLink = () => {
  const url = prompt('Digite a URL:', '');
  if (url) document.execCommand('createLink', false, url);
};
actions.saveAll = async () => {
  const filename = ($id('filename-input')?.value || 'curriculo');
  const savePdf = $id('save-as-pdf')?.checked;
  const savePng = $id('save-as-png')?.checked;
  const saveHtml = $id('save-as-html')?.checked;
  $id('save-modal').classList.remove('active');
  if (savePdf) await exporter.pdf(filename);
  if (savePng) await exporter.png(filename);
  if (saveHtml) exporter.html(filename);
};