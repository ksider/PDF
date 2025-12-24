const fileInput = document.getElementById('fileInput');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const fileNameInput = document.getElementById('fileNameInput');
const sortSelect = document.getElementById('sortSelect');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const addImagesLabel = document.getElementById('addImagesLabel');
const hintText = document.getElementById('hintText');
const grid = document.getElementById('imageGrid');
const emptyState = document.getElementById('emptyState');
const statusBar = document.getElementById('statusBar');
const langButtons = Array.from(document.querySelectorAll('.lang-btn'));
const { translations, defaultLang } = window.APP_CONFIG || {};
const { PDFDocument, PageSizes } = window.PDFLib || {};

let items = [];
let dragger;
let currentSort = 'manual';
let currentLang = defaultLang || 'ru';

const t = (key) => translations?.[currentLang]?.[key] || translations?.ru?.[key] || key;

const setActiveLangButton = (lang) => {
  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
};

const setStatus = (message, isError = false) => {
  statusBar.textContent = message;
  statusBar.classList.toggle('error', !!isError);
};

const applyLanguage = (lang) => {
  currentLang = lang;
  document.documentElement.lang = lang;
  setActiveLangButton(lang);
  headerTitle.textContent = t('title');
  headerSubtitle.textContent = t('subtitle');
  addImagesLabel.textContent = t('addImages');
  sortSelect.setAttribute('aria-label', t('sortLabel'));
  sortSelect.querySelectorAll('option').forEach((opt) => {
    const key = opt.dataset.key;
    if (key) opt.textContent = t(key);
  });
  clearBtn.textContent = t('clear');
  exportBtn.textContent = t('save');
  emptyState.textContent = t('empty');
  hintText.textContent = t('hint');
  fileNameInput.title = t('fileNameTitle');
  fileNameInput.setAttribute('aria-label', t('fileNameAria'));
  setStatus(t('statusReady'), false);
  render();
};

const detectFormat = (type) => type?.toLowerCase().includes('png') ? 'PNG' : 'JPEG';

const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const imgEl = new Image();
    imgEl.onload = () => resolve({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      kind: 'image',
      dataUrl,
      width: imgEl.naturalWidth,
      height: imgEl.naturalHeight,
      format: detectFormat(file.type),
      addedAt: Date.now()
    });
    imgEl.onerror = () => reject(new Error('image_read_error'));
    imgEl.src = dataUrl;
  };
  reader.onerror = () => reject(new Error('file_read_error'));
  reader.readAsDataURL(file);
});

const readPdfFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    kind: 'pdf',
    arrayBuffer,
    addedAt: Date.now()
  };
};

const readDocxFile = async (file) => {
  setStatus(t('convertingDocx').replace('{name}', file.name));
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.innerHTML = result.value;
  document.body.appendChild(container);
  const canvas = await window.html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
  document.body.removeChild(container);
  const dataUrl = canvas.toDataURL('image/png');
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    kind: 'docx',
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    format: 'PNG',
    addedAt: Date.now()
  };
};

const render = () => {
  exportBtn.disabled = items.length === 0;
  clearBtn.disabled = items.length === 0;
  grid.hidden = items.length === 0;
  emptyState.hidden = items.length !== 0;

  if (!items.length) {
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = items.map((item) => {
    const label = item.kind === 'pdf' ? t('typePdf') : item.kind === 'docx' ? t('typeDocx') : t('typeImage');
    const thumb = item.dataUrl
      ? `<img src="${item.dataUrl}" alt="${item.name}">`
      : `<div class="thumb-icon">${label}</div>`;

    return `
      <div class="card" data-id="${item.id}">
        <div class="thumb">
          ${thumb}
        </div>
        <div class="meta">
          <span class="name" title="${item.name}">${item.name}</span>
          <span class="pill">${label}</span>
        </div>
        <div class="meta">
          <div class="actions">
            <button class="icon-btn drag-handle" title="${t('drag')}" type="button">↕</button>
          </div>
          <button class="pill remove-btn" data-remove="${item.id}" type="button">${t('remove')}</button>
        </div>
      </div>
    `;
  }).join('');

  if (!dragger) {
    dragger = new Sortable(grid, {
      handle: '.card',
      animation: 180,
      ghostClass: 'dragging',
      filter: 'button, input, select',
      preventOnFilter: true,
      onEnd: () => {
        const orderedIds = Array.from(grid.children).map((el) => el.dataset.id);
        items = orderedIds
          .map((id) => items.find((i) => i.id === id))
          .filter(Boolean);
        currentSort = 'manual';
        sortSelect.value = 'manual';
      }
    });
  }
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const applySort = (mode, shouldRender = true) => {
  currentSort = mode;
  if (mode === 'name-asc') {
    items.sort((a, b) => collator.compare(a.name, b.name));
  } else if (mode === 'name-desc') {
    items.sort((a, b) => collator.compare(b.name, a.name));
  } else if (mode === 'time-asc') {
    items.sort((a, b) => a.addedAt - b.addedAt);
  } else if (mode === 'time-desc') {
    items.sort((a, b) => b.addedAt - a.addedAt);
  }

  if (shouldRender) render();
};

const addFiles = async (fileList) => {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  setStatus(t('statusUploading'));
  const loaded = [];
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      loaded.push(await readImageFile(file));
    } else if (file.type === 'application/pdf') {
      loaded.push(await readPdfFile(file));
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      loaded.push(await readDocxFile(file));
    }
  }
  items = items.concat(loaded);
  applySort(currentSort, false);
  setStatus(t('statusReady'));
  render();
};

const removeById = (id) => {
  items = items.filter((item) => item.id !== id);
  render();
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportToPdf = async () => {
  if (!items.length) return;
  const orderedIds = Array.from(grid.children).map((el) => el.dataset.id);
  const sorted = orderedIds
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);

  const desiredName = (fileNameInput.value || 'merged.pdf').trim();
  const finalName = desiredName.toLowerCase().endsWith('.pdf') ? desiredName : `${desiredName}.pdf`;
  const confirmMessage = t('confirm').replace('{name}', finalName);
  const shouldSave = window.confirm(confirmMessage);
  if (!shouldSave) return;

  setStatus(t('statusMerging'));
  const pdfDoc = await PDFDocument.create();

  for (const item of sorted) {
    if (item.kind === 'pdf') {
      try {
        const srcDoc = await PDFDocument.load(item.arrayBuffer);
        const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p) => pdfDoc.addPage(p));
      } catch (err) {
        const msg = t('pdfLocked').replace('{name}', item.name);
        setStatus(msg, true);
      }
      continue;
    }

    // images and docx (as image)
    const orientation = item.width >= item.height ? 'landscape' : 'portrait';
    const [pageWidth, pageHeight] = orientation === 'landscape' ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const scale = Math.min(maxWidth / item.width, maxHeight / item.height);
    const renderWidth = item.width * scale;
    const renderHeight = item.height * scale;
    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    if (item.format === 'PNG') {
      const png = await pdfDoc.embedPng(item.dataUrl);
      page.drawImage(png, { x, y, width: renderWidth, height: renderHeight });
    } else {
      const jpg = await pdfDoc.embedJpg(item.dataUrl);
      page.drawImage(jpg, { x, y, width: renderWidth, height: renderHeight });
    }
  }

  setStatus(t('statusDownloading'));
  const pdfBytes = await pdfDoc.save();
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), finalName);
  setStatus(t('statusReady'));
};

fileInput.addEventListener('change', (e) => addFiles(e.target.files));

grid.addEventListener('click', (e) => {
  const id = e.target.dataset.remove;
  if (id) removeById(id);
});

sortSelect.addEventListener('change', (e) => applySort(e.target.value));

exportBtn.addEventListener('click', exportToPdf);
clearBtn.addEventListener('click', () => {
  items = [];
  render();
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (lang !== currentLang) applyLanguage(lang);
  });
});

applyLanguage(currentLang);
