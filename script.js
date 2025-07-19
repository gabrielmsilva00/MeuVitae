// script.js - Custom Web Resume Builder
// Utilizes modern ES2023 features for efficiency and modularity

const win = window;
const doc = win.document;
const gid = (id) => doc.getElementById(id);
const now = (fn) => fn();

// Utility function to extract all local styles as a string
function getAllStylesAsString() {
  let allStyles = '';
  for (const sheet of doc.styleSheets) {
    try {
      if (sheet.ownerNode.tagName === 'STYLE' ||
          (sheet.href && sheet.href.startsWith(win.location.origin))) {
        for (const rule of sheet.cssRules) {
          allStyles += rule.cssText + '\n';
        }
      }
    } catch (e) {
      console.warn('Could not access rules for stylesheet:', sheet.href || 'inline style', e);
    }
  }
  return allStyles;
}

// Custom Element: ResumeBlock
class ResumeBlock extends HTMLElement {
  constructor() {
    super();
    const controls = doc.createElement('div');
    controls.className = 'block-controls';
    const handle = doc.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '↕️';
    handle.title = 'Mover este bloco';
    handle.setAttribute('draggable', 'true');
    const deleteBtn = doc.createElement('button');
    deleteBtn.className = 'delete-block-btn';
    deleteBtn.innerHTML = '❌';
    deleteBtn.title = 'Remover este bloco';
    deleteBtn.onclick = () => {
      this.remove();
      doc.dispatchEvent(new CustomEvent('content-changed'));
    };
    controls.appendChild(handle);
    controls.appendChild(deleteBtn);
    this.prepend(controls);
  }
}
customElements.define('resume-block', ResumeBlock);

// Main Initialization
doc.addEventListener('DOMContentLoaded', () => {
  const page = gid('page');

  // Module: Drag-and-Drop Functionality
  (() => {
    let draggedElement = null;
    page.addEventListener('dragstart', (e) => {
      if (e.target.matches('.drag-handle')) {
        draggedElement = e.target.closest('resume-block');
        setTimeout(() => draggedElement.classList.add('dragging'), 0);
      }
    });
    page.addEventListener('dragend', () => {
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
      }
    });
    page.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedElement) return;
      const target = e.target.closest('resume-block');
      if (target && target !== draggedElement) {
        const rect = target.getBoundingClientRect();
        const next = (e.clientY - rect.top) / rect.height > 0.5;
        page.insertBefore(draggedElement, next ? target.nextSibling : target);
      }
    });
  })();

  // Module: Theme Management
  const themeModule = (() => {
    const themeCustomizer = gid('theme-customizer');
    const customizerGrid = gid('customizer-grid');
    const globalColors = {
      '--custom-papel': '#FFFFFF',
      '--custom-texto-de-bloco': '#111827',
      '--custom-texto-comum': '#6B7280',
      '--custom-destaque': '#3B82F6',
      '--custom-borda': '#E5E7EB',
    };

    const updateSwatchSelection = (theme) => {
      doc.querySelectorAll('.theme-swatch').forEach((sw) => sw.classList.remove('active'));
      const activeSwatch = doc.querySelector(`.theme-swatch[data-theme="${theme}"]`);
      if (activeSwatch) activeSwatch.classList.add('active');
    };

    const setTheme = (theme) => {
      doc.body.className = `theme-${theme}`;
      localStorage.setItem('resume-theme', theme);
      updateSwatchSelection(theme);
      if (theme === 'custom') {
        doc.documentElement.style.cssText = '';
        Object.entries(globalColors).forEach(([key, value]) => {
          doc.documentElement.style.setProperty(key, value);
        });
        gid('custom-color-preview-foreground').style.backgroundColor = globalColors['--custom-texto-de-bloco'];
        gid('custom-color-preview-background').style.backgroundColor = globalColors['--custom-borda'];
      }
    };

    const applyCustomColors = () => {
      localStorage.setItem('resume-custom-colors', JSON.stringify(globalColors));
      setTheme('custom');
    };

    const init = () => {
      let savedTheme = localStorage.getItem('resume-theme');
      const prefersDark = win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedColors = JSON.parse(localStorage.getItem('resume-custom-colors'));
      if (!savedTheme) savedTheme = prefersDark ? 'dark' : 'light';
      if (savedColors) Object.assign(globalColors, savedColors);
      setTheme(savedTheme);

      customizerGrid.innerHTML = Object.entries(globalColors).map(([key, value]) => `
        <div class="color-picker-wrapper">
          <label>${key.replace('--custom-', '').replace(/-/g, ' ')}</label>
          <input type="text" data-key="${key}" value="${value}" maxlength="7">
          <input type="color" value="${value}" data-text-input-key="${key}">
        </div>
      `).join('');
    };

    customizerGrid.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const textInputKey = e.target.dataset.textInputKey;
      if (e.target.type === 'color' && textInputKey) {
        const textInput = customizerGrid.querySelector(`input[type="text"][data-key="${textInputKey}"]`);
        textInput.value = e.target.value;
        globalColors[textInputKey] = e.target.value;
        applyCustomColors();
      } else if (e.target.type === 'text' && key) {
        const colorInput = customizerGrid.querySelector(`input[type="color"][data-text-input-key="${key}"]`);
        if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) {
          colorInput.value = e.target.value;
          globalColors[key] = e.target.value;
          applyCustomColors();
        }
      }
    });

    doc.querySelectorAll('.theme-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => setTheme(swatch.dataset.theme));
    });

    doc.querySelectorAll('#theme-customizer .close-modal-btn').forEach((el) => {
      el.addEventListener('click', () => themeCustomizer.classList.toggle('active'));
    });

    init();

    return { open: () => themeCustomizer.classList.add('active') };
  })();

  // Module: Prevent Content Overflow
  (() => {
    let timeoutId = null;
    const warningEl = gid('page-overflow-warning');
    const isOverflowing = () => page.scrollHeight > page.clientHeight + 2;
    const showWarning = () => {
      clearTimeout(timeoutId);
      warningEl.style.display = 'block';
      warningEl.style.opacity = '1';
      timeoutId = setTimeout(() => {
        warningEl.style.opacity = '0';
        setTimeout(() => warningEl.style.display = 'none', 300);
      }, 2000);
    };
    const checkAndRevert = (e) => {
      if (isOverflowing()) {
        e.preventDefault();
        doc.execCommand('undo');
        showWarning();
      }
    };
    page.addEventListener('input', checkAndRevert, true);
    doc.addEventListener('content-changed', () => {
      if (isOverflowing()) {
        doc.execCommand('undo');
        showWarning();
      }
    });
  })();

  // Module: Actions and Menus
  (() => {
    const contextMenu = gid('context-menu');
    const saveModal = gid('save-modal');
    let contextMenuTarget = null;

    // Export: Generate PDF
    const generatePdf = async (filename) => {
      const { jsPDF } = win.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const sourceElement = gid('page');
      const sourceRect = sourceElement.getBoundingClientRect();
      const scale = 210 / sourceRect.width;

      const renderElement = (el) => {
        const styles = win.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const x = (rect.left - sourceRect.left) * scale;
        let y = (rect.top - sourceRect.top) * scale;
        const w = rect.width * scale;
        const fontSizeInPt = parseFloat(styles.fontSize) * 0.75;
        const lineHeight = (parseFloat(styles.lineHeight) || (parseFloat(styles.fontSize) * 1.5)) * scale;
        y += fontSizeInPt * 0.35;

        if (el.tagName === 'LI') {
          pdf.setFont('times', 'normal');
          pdf.setTextColor(styles.color);
          pdf.text('', x + fontSizeInPt * 0.35, y);
        }

        const segments = [];
        Array.from(el.childNodes).forEach((child) => {
          if (child.textContent) {
            segments.push({
              text: child.textContent.replace(/\s+/g, ' ').trim(),
              styles: win.getComputedStyle(child.nodeType === 1 ? child : el),
              isLink: child.nodeType === 1 && child.tagName === 'A',
              href: child.nodeType === 1 ? child.href : null,
            });
          }
        });

        let currentLine = [];
        let currentLineWidth = 0;
        const lines = [];
        const spaceWidth = pdf.getStringUnitWidth(' ') * fontSizeInPt / pdf.internal.scaleFactor;

        segments.forEach((segment) => {
          const words = segment.text.split(' ');
          words.forEach((word) => {
            if (!word) return;
            const segmentFontSize = parseFloat(segment.styles.fontSize) * 0.75;
            const fontWeight = parseInt(segment.styles.fontWeight) || 400;
            const wordWidth = pdf.getStringUnitWidth(word) * segmentFontSize / pdf.internal.scaleFactor;
            pdf.setFontSize(segmentFontSize);
            pdf.setFont('times', fontWeight > 500 ? 'bold' : 'normal');

            if (currentLineWidth + (currentLine.length > 0 ? spaceWidth : 0) + wordWidth > w) {
              lines.push({ segments: currentLine, width: currentLineWidth });
              currentLine = [{ ...segment, text: word }];
              currentLineWidth = wordWidth;
            } else {
              currentLine.push({ ...segment, text: word });
              currentLineWidth += (currentLine.length > 1 ? spaceWidth : 0) + wordWidth;
            }
          });
        });
        if (currentLine.length > 0) lines.push({ segments: currentLine, width: currentLineWidth });

        let align = styles.textAlign;
        if (align === 'start') align = 'left';
        if (align === 'end') align = 'right';
        if (!['left', 'center', 'right', 'justify'].includes(align)) align = 'left';

        lines.forEach((line, lineIndex) => {
          let currentX = x;
          const lineY = y + (lineIndex * lineHeight);
          if (align === 'center') currentX = x + (w - line.width) / 2;
          if (align === 'right') currentX = x + w - line.width;

          line.segments.forEach((segment, segIndex) => {
            const segmentFontSize = parseFloat(segment.styles.fontSize) * 0.75;
            const fontWeight = parseInt(segment.styles.fontWeight) || 400;
            pdf.setFontSize(segmentFontSize);
            pdf.setFont('times', fontWeight > 500 ? 'bold' : 'normal');
            pdf.setTextColor(segment.styles.color);

            if (segment.isLink) {
              pdf.textWithLink(segment.text, currentX, lineY, { url: segment.href });
            } else {
              pdf.text(segment.text, currentX, lineY);
            }
            currentX += pdf.getStringUnitWidth(segment.text) * segmentFontSize / pdf.internal.scaleFactor;
            if (segIndex < line.segments.length - 1) currentX += spaceWidth;
          });
        });
      };

      sourceElement.querySelectorAll('h1, h2, h3, p, li').forEach(renderElement);

      sourceElement.querySelectorAll('header, h2').forEach((el) => {
        const styles = win.getComputedStyle(el);
        if (styles.borderBottomStyle !== 'none') {
          const rect = el.getBoundingClientRect();
          const x = (rect.left - sourceRect.left) * scale;
          const w = rect.width * scale;
          const borderY = (rect.bottom - sourceRect.top) * scale;
          pdf.setDrawColor(styles.borderBottomColor);
          pdf.setLineWidth(parseFloat(styles.borderBottomWidth) * scale);
          pdf.line(x, borderY, x + w, borderY);
        }
      });

      pdf.save(`${filename}.pdf`);
    };

    // Export: Generate HTML
    const generateHtml = (filename) => {
      const clone = page.cloneNode(true);
      clone.querySelectorAll('.block-controls, [contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
        if (el.classList.contains('block-controls')) el.remove();
      });
      const fullHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${filename}</title><style>${getAllStylesAsString()}</style></head><body>${clone.outerHTML}</body></html>`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const link = doc.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
    };

    // Export: Generate PNG
    const generatePng = async (filename) => {
      const controls = page.querySelectorAll('.block-controls');
      controls.forEach((c) => c.style.visibility = 'hidden');
      try {
        const canvas = await win.html2canvas(page, { scale: 3, useCORS: true });
        const link = doc.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${filename}.png`;
        link.click();
      } catch (err) {
        console.error("Falha ao gerar PNG:", err);
      } finally {
        controls.forEach((c) => c.style.visibility = 'visible');
      }
    };

    // Save Modal Handlers
    const openSaveMenu = () => saveModal.classList.add('active');
    const closeSaveMenu = () => saveModal.classList.remove('active');
    gid('execute-save-btn').addEventListener('click', async () => {
      const filename = gid('filename-input').value || 'curriculo';
      const savePdf = gid('save-as-pdf').checked;
      const savePng = gid('save-as-png').checked;
      const saveHtml = gid('save-as-html').checked;
      closeSaveMenu();
      if (savePdf) await generatePdf(filename);
      if (savePng) await generatePng(filename);
      if (saveHtml) generateHtml(filename);
    });
    saveModal.querySelectorAll('.close-modal-btn').forEach((btn) => btn.addEventListener('click', closeSaveMenu));

    // HTML Editor Modal Handlers
    const htmlEditorModal = gid('html-editor-modal');
    const openHtmlEditor = () => {
      const formattedHtml = page.innerHTML.replace(/></g, '>\n<');
      gid('html-editor').value = formattedHtml;
      htmlEditorModal.classList.add('active');
    };
    const closeHtmlEditor = () => htmlEditorModal.classList.remove('active');
    gid('save-html-btn').addEventListener('click', () => {
      if (confirm("Atenção: Salvar o HTML diretamente pode quebrar funcionalidades do editor. Deseja continuar?")) {
        page.innerHTML = gid('html-editor').value;
        doc.dispatchEvent(new CustomEvent('content-changed'));
        closeHtmlEditor();
      }
    });
    htmlEditorModal.querySelectorAll('.close-modal-btn').forEach((btn) => btn.addEventListener('click', closeHtmlEditor));

    // Action Handlers
    const menuActions = {
      addHeader: () => createBlock('template-block-header'),
      addText: () => createBlock('template-block-text'),
      addColumns: () => createBlock('template-block-columns'),
      increaseFont: () => modifyFontSize(contextMenuTarget, 'increase'),
      decreaseFont: () => modifyFontSize(contextMenuTarget, 'decrease'),
      insertLink: () => {
        const url = prompt("Digite a URL:", "https://");
        if (url) doc.execCommand('createLink', false, url);
      },
      customizeTheme: () => themeModule.open(),
      openSaveMenu,
      editHtml: openHtmlEditor,
    };

    const createBlock = (templateId) => {
      const newBlock = gid(templateId).content.cloneNode(true);
      page.appendChild(newBlock);
      doc.dispatchEvent(new CustomEvent('content-changed'));
    };

    const modifyFontSize = (block, direction) => {
      if (!block) return;
      const elements = block.querySelectorAll('h1, h2, h3, p, li, strong, a');
      elements.forEach((el) => {
        const currentSize = parseFloat(win.getComputedStyle(el).fontSize);
        const newSize = direction === 'increase' ? currentSize + 1 : currentSize - 1;
        if (newSize > 8) el.style.fontSize = `${newSize}px`;
      });
      doc.dispatchEvent(new CustomEvent('content-changed'));
    };

    // Context Menu
    const globalMenuItems = [
      { label: 'Adicionar Cabeçalho', action: 'addHeader' },
      { label: 'Adicionar Bloco de Texto', action: 'addText' },
      { label: 'Adicionar 2 Colunas', action: 'addColumns' },
      { type: 'separator' },
      { label: 'Personalizar Aparência...', action: 'customizeTheme' },
      { label: 'Editor de HTML Avançado...', action: 'editHtml' },
      { type: 'separator' },
      { label: 'Salvar Como...', action: 'openSaveMenu' },
    ];
    const blockMenuItems = [
      { label: 'Aumentar Fonte', action: 'increaseFont' },
      { label: 'Diminuir Fonte', action: 'decreaseFont' },
      { label: 'Inserir Link', action: 'insertLink' },
    ];

    doc.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu.innerHTML = '';
      contextMenu.classList.add('active');
      contextMenuTarget = e.target.closest('resume-block');
      const items = contextMenuTarget ? blockMenuItems : globalMenuItems;
      items.forEach((item) => {
        if (item.type === 'separator') {
          contextMenu.insertAdjacentHTML('beforeend', '<div class="menu-separator"></div>');
        } else {
          const button = doc.createElement('button');
          button.className = 'menu-item';
          button.textContent = item.label;
          button.onclick = () => {
            menuActions[item.action]();
            contextMenu.classList.remove('active');
          };
          contextMenu.appendChild(button);
        }
      });
      const { clientX: mouseX, clientY: mouseY } = e;
      const { offsetWidth: menuW, offsetHeight: menuH } = contextMenu;
      const x = mouseX + menuW > win.innerWidth ? win.innerWidth - menuW - 5 : mouseX;
      const y = mouseY + menuH > win.innerHeight ? win.innerHeight - menuH - 5 : mouseY;
      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
    });

    // Sidebar and Mobile Actions
    const actionButtons = [
      {
        label: 'Salvar',
        action: 'openSaveMenu',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`,
      },
      {
        label: 'Personalizar Aparência',
        action: 'customizeTheme',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>`,
      },
      {
        label: 'Editor de HTML',
        action: 'editHtml',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>`,
      },
    ];

    const sidebarContainer = gid('sidebar-actions');
    const mobileContainer = gid('mobile-actions');
    actionButtons.forEach((item) => {
      const buttonHTML = `<li><button title="${item.label}" data-action="${item.action}">${item.icon}</button></li>`;
      sidebarContainer.insertAdjacentHTML('beforeend', buttonHTML);
      mobileContainer.insertAdjacentHTML('beforeend', `<button title="${item.label}" data-action="${item.action}">${item.icon}</button>`);
    });

    doc.body.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (button && menuActions[button.dataset.action]) {
        menuActions[button.dataset.action]();
      }
    });

    doc.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target)) contextMenu.classList.remove('active');
    });

    doc.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        openSaveMenu();
      }
    });
  })();
});