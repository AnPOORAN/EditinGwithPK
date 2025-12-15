/* 
  EditinGwithPK – Image Multi‑Tool Suite
  Features:
  - Upload (click or drag‑drop)
  - Resize by px / %
  - Approx target KB compression (JPG)
  - Crop by dragging on preview
  - Basic background remove (solid/light BG)
  - Format convert (JPG / PNG / WebP)
  - Auto light/dark mode + toggle
*/

/* ========== DOM references ========== */

// Upload / canvas
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const previewArea = document.getElementById("previewArea");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const previewTag = document.getElementById("previewTag");
const cropRect = document.getElementById("cropRect");

// Resize controls
const modeSelect = document.getElementById("mode");
const pixelsFields = document.getElementById("pixelsFields");
const percentField = document.getElementById("percentField");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const percentInput = document.getElementById("percentInput");
const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");
const formatSelect = document.getElementById("formatSelect");
const targetKbInput = document.getElementById("targetKbInput");
const lockRatio = document.getElementById("lockRatio");
const resizeBtn = document.getElementById("resizeBtn");
const downloadBtn = document.getElementById("downloadBtn");

// Tools sections
const toolSections = document.querySelectorAll(".tool-section");
const navLinks = document.querySelectorAll(".nav-link");
const tabs = document.querySelectorAll(".tab");
const applyCropBtn = document.getElementById("applyCropBtn");
const bgRemoveBtn = document.getElementById("bgRemoveBtn");
const convertFormatSelect = document.getElementById("convertFormatSelect");

// Info / errors
const origInfo = document.getElementById("origInfo");
const newInfo = document.getElementById("newInfo");
const errorMsg = document.getElementById("errorMsg");

// Theme
const themeToggle = document.getElementById("themeToggle");
const rootEl = document.documentElement;

/* ========== State ========== */

let originalImage = null;
let originalWidth = 0;
let originalHeight = 0;
let originalSizeKB = 0;

let currentTab = "view"; // view | crop | bg
let isMouseDown = false;
let cropStart = null;
let cropEnd = null;

/* ========== THEME HANDLING ========== */

function initTheme() {
  const stored = localStorage.getItem("pk-theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    rootEl.setAttribute("data-theme", stored);
  } else {
    rootEl.setAttribute("data-theme", "auto");
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const theme = rootEl.getAttribute("data-theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  let effective = theme;
  if (theme === "auto") {
    effective = prefersDark ? "dark" : "light";
  }

  // Button icon update
  themeToggle.textContent = effective === "dark" ? "☀️" : "🌙";
}

themeToggle.addEventListener("click", () => {
  const current = rootEl.getAttribute("data-theme");
  // Cycle: auto -> dark -> light -> auto
  let next = "auto";
  if (current === "auto") next = "dark";
  else if (current === "dark") next = "light";
  else next = "auto";

  rootEl.setAttribute("data-theme", next);
  localStorage.setItem("pk-theme", next);
  updateThemeIcon();
});

if (window.matchMedia) {
  // If system theme changes while on auto, update icon
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (rootEl.getAttribute("data-theme") === "auto") {
        updateThemeIcon();
      }
    });
}

initTheme();

/* ========== UPLOAD HANDLING ========== */

// Click = open file dialog
uploadArea.addEventListener("click", () => fileInput.click());

// Drag‑drop UX
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// File input
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

/**
 * Read uploaded file, load into Image object,
 * update original metadata and draw on canvas.
 */
function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showError("Please upload an image file (JPG, PNG, WebP…).");
    return;
  }
  errorMsg.textContent = "";

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      originalWidth = img.width;
      originalHeight = img.height;
      originalSizeKB = (file.size / 1024).toFixed(1);

      // Fill controls with original size
      widthInput.value = originalWidth;
      heightInput.value = originalHeight;
      percentInput.value = 100;

      origInfo.textContent = `Original: ${originalWidth} × ${originalHeight}px • ${originalSizeKB} KB`;
      previewTag.textContent = "Loaded";

      // Enable buttons
      downloadBtn.disabled = false;
      applyCropBtn.disabled = false;
      bgRemoveBtn.disabled = false;

      // Draw original on canvas
      drawToCanvas(originalWidth, originalHeight);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Draw current "source" image onto canvas with given width/height.
 * Here "source" is originalImage, which may change after crop/BG operations.
 */
function drawToCanvas(w, h) {
  if (!originalImage) return;
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(originalImage, 0, 0, w, h);

  canvas.style.display = "block";
  previewPlaceholder.style.display = "none";
  updateNewInfo();
}

/* ========== TOOL NAVIGATION (left buttons) ========== */

navLinks.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tool; // resize | crop | bg | convert

    navLinks.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    toolSections.forEach((section) => {
      section.classList.remove("active");
    });
    document.getElementById(`tool-${target}`).classList.add("active");
  });
});

/* ========== PREVIEW TABS (left side) ========== */

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    currentTab = tab.dataset.tab; // "view" | "crop" | "bg"

    // Crop / BG mode UX
    if (currentTab === "crop") {
      previewArea.style.cursor = "crosshair";
      previewTag.textContent = "Crop mode – drag on image to select";
    } else if (currentTab === "bg") {
      previewArea.style.cursor = "default";
      previewTag.textContent = "Background tools";
      cropRect.style.display = "none";
      cropStart = cropEnd = null;
    } else {
      previewArea.style.cursor = "default";
      previewTag.textContent = "View mode";
      cropRect.style.display = "none";
      cropStart = cropEnd = null;
    }
  });
});

/* ========== RESIZE CONTROLS ========== */

// Switch between pixels and percent mode
modeSelect.addEventListener("change", () => {
  const isPixels = modeSelect.value === "pixels";
  pixelsFields.style.display = isPixels ? "block" : "none";
  percentField.style.display = isPixels ? "none" : "block";
  widthInput.disabled = !isPixels;
  heightInput.disabled = !isPixels;
});

// Keep aspect ratio when one dimension changes
widthInput.addEventListener("input", () => {
  if (!originalImage || !lockRatio.checked) return;
  const w = parseInt(widthInput.value, 10);
  if (!w || w <= 0) return;
  const ratio = originalHeight / originalWidth;
  heightInput.value = Math.round(w * ratio);
});
heightInput.addEventListener("input", () => {
  if (!originalImage || !lockRatio.checked) return;
  const h = parseInt(heightInput.value, 10);
  if (!h || h <= 0) return;
  const ratio = originalWidth / originalHeight;
  widthInput.value = Math.round(h * ratio);
});

// Update label when quality slider moves
qualityRange.addEventListener("input", () => {
  qualityValue.textContent = qualityRange.value + "%";
});

/* Helper: approximate canvas output size in KB for given format + quality */
function getCanvasSizeKB(format, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        resolve(blob.size / 1024);
      },
      format,
      quality
    );
  });
}

/*
  Binary search on JPEG quality to approximate target KB.
  This runs after we have resized to the chosen width/height.
*/
async function adjustToTargetKB(targetKB) {
  if (formatSelect.value !== "image/jpeg") return;
  const currentKB = await getCanvasSizeKB(
    "image/jpeg",
    qualityRange.value / 100
  );
  if (!currentKB) return;

  // If already close enough, skip extra work
  if (Math.abs(currentKB - targetKB) < 10) {
    updateNewInfo();
    return;
  }

  let low = 0.1;
  let high = 1.0;
  let bestQuality = qualityRange.value / 100;
  let bestDiff = Infinity;

  // Binary search for ~12 iterations
  for (let i = 0; i < 12; i++) {
    const q = (low + high) / 2;
    const sizeKB = await getCanvasSizeKB("image/jpeg", q);
    if (!sizeKB) break;

    const diff = Math.abs(sizeKB - targetKB);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestQuality = q;
    }

    // Good enough tolerance (about ±12 KB)
    if (diff <= 12) break;

    if (sizeKB > targetKB) {
      high = q;
    } else {
      low = q;
    }
  }

  bestQuality = Math.max(0.1, Math.min(1.0, bestQuality));
  qualityRange.value = Math.round(bestQuality * 100);
  qualityValue.textContent = qualityRange.value + "%";
  updateNewInfo();
}

/* Main "Update preview" click */
resizeBtn.addEventListener("click", async () => {
  if (!originalImage) {
    showError("Please upload an image first.");
    return;
  }

  let targetW = originalWidth;
  let targetH = originalHeight;

  if (modeSelect.value === "pixels") {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);
    if (!w || !h || w <= 0 || h <= 0) {
      showError("Please enter valid width and height.");
      return;
    }
    targetW = w;
    targetH = h;
  } else {
    const p = parseInt(percentInput.value, 10);
    if (!p || p <= 0) {
      showError("Please enter a valid percentage.");
      return;
    }
    targetW = Math.round((originalWidth * p) / 100);
    targetH = Math.round((originalHeight * p) / 100);
  }

  errorMsg.textContent = "";
  drawToCanvas(targetW, targetH);
  previewTag.textContent = `${targetW} × ${targetH}px`;

  const targetKB = parseInt(targetKbInput.value, 10);
  if (targetKB && targetKB > 0 && formatSelect.value === "image/jpeg") {
    await adjustToTargetKB(targetKB);
  }
});

/* ========== INFO UPDATE / ERROR ========== */

function updateNewInfo() {
  const outFormat = convertFormatSelect?.value || formatSelect.value;
  const quality =
    outFormat === "image/jpeg" ? qualityRange.value / 100 : 1.0;
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const sizeKB = (blob.size / 1024).toFixed(1);
      newInfo.textContent = `Output: ${canvas.width} × ${canvas.height}px • ${sizeKB} KB`;
    },
    outFormat,
    quality
  );
}

function showError(msg) {
  errorMsg.textContent = msg;
}

/* ========== DOWNLOAD (respect format convert) ========== */

downloadBtn.addEventListener("click", () => {
  if (!originalImage) return;

  const outFormat = convertFormatSelect?.value || formatSelect.value;
  const quality = outFormat === "image/jpeg" ? qualityRange.value / 100 : 1.0;

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      let ext = "png";
      if (outFormat === "image/jpeg") ext = "jpg";
      else if (outFormat === "image/webp") ext = "webp";

      const a = document.createElement("a");
      a.href = url;
      a.download = `editingwithpk-image.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    outFormat,
    quality
  );
});

/* ========== CROP INTERACTION (drag rectangle on preview) ========== */

previewArea.addEventListener("mousedown", (e) => {
  if (currentTab !== "crop" || !originalImage) return;
  isMouseDown = true;
  const rect = previewArea.getBoundingClientRect();
  cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  cropEnd = { ...cropStart };
  updateCropRect();
});

previewArea.addEventListener("mousemove", (e) => {
  if (!isMouseDown || currentTab !== "crop" || !originalImage) return;
  const rect = previewArea.getBoundingClientRect();
  cropEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  updateCropRect();
});

previewArea.addEventListener("mouseup", () => {
  isMouseDown = false;
});
previewArea.addEventListener("mouseleave", () => {
  isMouseDown = false;
});

/**
 * Draw the selection rectangle overlay in preview coordinates.
 */
function updateCropRect() {
  if (!cropStart || !cropEnd) return;
  const x = Math.min(cropStart.x, cropEnd.x);
  const y = Math.min(cropStart.y, cropEnd.y);
  const w = Math.abs(cropEnd.x - cropStart.x);
  const h = Math.abs(cropEnd.y - cropStart.y);

  if (w < 10 || h < 10) {
    cropRect.style.display = "none";
    return;
  }

  cropRect.style.display = "block";
  cropRect.style.left = x + "px";
  cropRect.style.top = y + "px";
  cropRect.style.width = w + "px";
  cropRect.style.height = h + "px";
}

/**
 * Apply the crop selection:
 * - Convert preview selection (HTML px) to canvas coordinates
 * - Create a temp canvas with that area
 * - Replace originalImage with new cropped image
 */
applyCropBtn.addEventListener("click", () => {
  if (!originalImage || !cropStart || !cropEnd) return;

  const areaRect = previewArea.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;

  const x = parseFloat(cropRect.style.left) - (canvasRect.left - areaRect.left);
  const y = parseFloat(cropRect.style.top) - (canvasRect.top - areaRect.top);
  const w = parseFloat(cropRect.style.width);
  const h = parseFloat(cropRect.style.height);

  const sx = Math.max(0, x * scaleX);
  const sy = Math.max(0, y * scaleY);
  const sw = Math.min(canvas.width - sx, w * scaleX);
  const sh = Math.min(canvas.height - sy, h * scaleY);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tctx = tempCanvas.getContext("2d");
  tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const img = new Image();
  img.onload = () => {
    originalImage = img;
    originalWidth = img.width;
    originalHeight = img.height;
    widthInput.value = originalWidth;
    heightInput.value = originalHeight;

    drawToCanvas(originalWidth, originalHeight);
    previewTag.textContent = `Cropped ${originalWidth} × ${originalHeight}px`;

    cropRect.style.display = "none";
    cropStart = cropEnd = null;
  };
  img.src = tempCanvas.toDataURL();
});

/* ========== BASIC BACKGROUND REMOVAL ========== */

bgRemoveBtn.addEventListener("click", () => {
  if (!originalImage) return;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const r0 = data[0],
    g0 = data[1],
    b0 = data[2];
  const threshold = 60; // adjust if needed

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const diff = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);
    if (diff < threshold) {
      data[i + 3] = 0; // transparent
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Update "source" image so next operations use the cleaned version
  const img = new Image();
  img.onload = () => {
    originalImage = img;
    originalWidth = img.width;
    originalHeight = img.height;
    drawToCanvas(originalWidth, originalHeight);
    previewTag.textContent = "Background cleaned (basic)";
  };
  img.src = canvas.toDataURL();
});

/* ========== INITIAL UI STATE ========== */

// Default: pixels mode visible, percent hidden
pixelsFields.style.display = "block";
percentField.style.display = "none";
