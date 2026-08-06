/**
 * model-loader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EnsureAR — Dynamic Model Loader
 *
 * Replaces all hardcoded data-lens-id product carousels in TryOn.cshtml.
 *
 * Responsibilities:
 *   1. Fetches /api/models to get the full jewelry catalog
 *   2. Dynamically renders product cards in the correct category carousel
 *   3. On card click → tells EnsureAR.Renderer to load the selected GLB
 *   4. Manages active selection state (visual highlight)
 *   5. Handles empty state gracefully
 *   6. Initialises the full AR pipeline (camera + landmarker + renderer)
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
    'use strict';

    // ── Configuration ─────────────────────────────────────────────────────────

    const API_ENDPOINT = '/api/models';

    // Maps category name → which EnsureAR.Landmarker mode to activate
    const CATEGORY_TRACKING = {
        necklace: 'face',
        earrings: 'face',
        rings: 'hand',
        bracelets: 'hand',
        watch: 'hand',
        eyewear: 'face',
    };

    // Maps category → carousel container ID (defined in TryOn.cshtml)
    const CAROUSEL_IDS = {
        necklace: 'carousel-necklace',
        earrings: 'carousel-earrings',
        rings: 'carousel-rings',
        bracelets: 'carousel-bracelets',
        watch: 'carousel-watch',
        eyewear: 'carousel-eyewear',
    };

    // ── State ─────────────────────────────────────────────────────────────────

    let catalog = [];          // full model list from API
    let activeModel = null;        // currently selected model object
    let activeCategory = 'necklace'; // currently visible category

    // ── Fetch catalog ─────────────────────────────────────────────────────────

    async function fetchCatalog() {
        try {
            const resp = await fetch(API_ENDPOINT + '?t=' + Date.now());
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            catalog = await resp.json();
            console.log(`[EnsureAR ModelLoader] Catalog loaded: ${catalog.length} model(s)`);
        } catch (err) {
            console.error('[EnsureAR ModelLoader] Failed to load catalog:', err);
            catalog = [];
        }
        return catalog;
    }

    // ── Render carousels ──────────────────────────────────────────────────────

    function renderAllCarousels() {
        const categories = Object.keys(CAROUSEL_IDS);
        categories.forEach(cat => renderCarousel(cat));
    }

    function renderCarousel(category) {
        const containerId = CAROUSEL_IDS[category];
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = catalog.filter(m =>
            m.category.toLowerCase() === category.toLowerCase()
        );

        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = `
                <div class="ens-empty-state">
                    <span class="ens-empty-icon">${getCategoryEmoji(category)}</span>
                    <span class="ens-empty-text">No ${category} models yet.<br>Upload from Admin panel.</span>
                </div>
            `;
            return;
        }

        items.forEach(model => {
            const card = createModelCard(model);
            container.appendChild(card);
        });
    }

    function createModelCard(model) {
        const card = document.createElement('div');
        card.className = 'ur-product-card ens-model-card';
        card.dataset.modelId = model.id;
        card.dataset.modelPath = model.modelPath || model.glbPath;
        card.dataset.category = model.category;

        const thumbSrc = model.thumbnailPath || '/img/placeholder-jewelry.png';

        card.innerHTML = `
            <div class="feature-image category-image option-image ens-card-inner">
                <img src="${thumbSrc}" alt="${escapeHtml(model.name)}" class="img-fluid ens-thumb"
                     onerror="this.src='/img/placeholder-jewelry.png'">
                <div class="ens-card-overlay">
                    <span class="ens-try-label">Try On</span>
                </div>
            </div>
            <div class="ens-card-name">${escapeHtml(model.name)}</div>
        `;

        card.addEventListener('click', () => selectModel(model, card));
        return card;
    }

    // ── Model selection ───────────────────────────────────────────────────────

    async function selectModel(model, cardEl) {
        if (activeModel?.id === model.id) return; // already selected
        activeModel = model;

        // Visual highlight
        document.querySelectorAll('.ens-model-card').forEach(c => c.classList.remove('ens-active'));
        if (cardEl) cardEl.classList.add('ens-active');

        // Show loading indicator
        showLoadingState(true);

        // Switch tracking mode
        const trackingMode = CATEGORY_TRACKING[model.category] ?? 'face';
        global.EnsureAR?.Landmarker?.setMode(trackingMode);

        // Update camera CSS class (face = portrait, hand = wrist landscape)
        updateCameraClass(trackingMode);

        // Load Model into renderer
        try {
            const assetPath = model.modelPath || model.glbPath;
            await global.EnsureAR?.Renderer?.loadModel(assetPath, model, model.category);
            console.log('[EnsureAR ModelLoader] Active model:', model.name);
        } catch (err) {
            console.error('[EnsureAR ModelLoader] Failed to load model:', err);
            showError('Could not load the 3D model. Please try another.');
        } finally {
            showLoadingState(false);
        }

        // Hint for necklace adjustment
        if (['necklace'].includes(model.category)) {
            triggerNecklaceHint();
        } else {
            global.window.hideHint?.();
        }
    }

    // ── Category switching (called by existing handleCategoryClick) ───────────

    function switchCategory(category) {
        activeCategory = category.toLowerCase();

        // Hide all carousels
        Object.values(CAROUSEL_IDS).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.closest('.ens-carousel-wrapper')?.classList.remove('active');
        });

        // Show selected
        const targetId = CAROUSEL_IDS[activeCategory];
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            const wrapper = targetEl.closest('.ens-carousel-wrapper');
            if (wrapper) wrapper.classList.add('active');
        }

        // Camera mode
        const mode = CATEGORY_TRACKING[activeCategory] ?? 'face';
        global.EnsureAR?.Landmarker?.setMode(mode);
        updateCameraClass(mode);

        // Auto-select first model in this category if available
        const firstModel = catalog.find(m => m.category === activeCategory);
        if (firstModel) {
            const firstCard = document.querySelector(`[data-model-id="${firstModel.id}"]`);
            selectModel(firstModel, firstCard);
        } else {
            global.EnsureAR?.Renderer?.clear();
        }

        console.log('[EnsureAR ModelLoader] Category switched to:', activeCategory);
    }

    // ── Camera / pipeline initialisation ─────────────────────────────────────

    async function initARPipeline() {
        const video = document.getElementById('input-video');
        const arCanvas = document.getElementById('ar-canvas');

        if (!video || !arCanvas) {
            console.error('[EnsureAR ModelLoader] Missing video or ar-canvas elements.');
            return;
        }

        showOverlay(true, 'Initialising AR Engine…', 'face');

        try {
            // 1. Start webcam
            await startCamera(video);

            // 2. Init Three.js renderer
            await global.EnsureAR.Renderer.init(video, arCanvas);

            // 3. Init MediaPipe landmarker
            await global.EnsureAR.Landmarker.initialize();

            // 4. Hide overlay
            showOverlay(false);
            showCameraButton(true);

            console.log('[EnsureAR ModelLoader] AR pipeline ready.');

        } catch (err) {
            console.error('[EnsureAR ModelLoader] Pipeline init error:', err);
            showOverlay(true, 'Camera access denied. Please allow camera permission.', 'face');
        }
    }

    async function startCamera(video) {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30 },
            },
            audio: false,
        });

        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.muted = true;

        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                video.play().then(resolve).catch(reject);
            };
            video.onerror = reject;
        });
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    function showOverlay(visible, message, iconMode) {
        const overlay = document.getElementById('overlay-container');
        const canvas = document.getElementById('canvas') || document.getElementById('ar-canvas');
        const statusText = document.getElementById('status-text');
        const statusIcon = document.getElementById('status-icon');

        if (!overlay) return;

        if (visible) {
            overlay.style.display = 'block';
            if (canvas) canvas.classList.add('canvas-blurred');
            if (statusText && message) statusText.textContent = message;
            if (statusIcon) {
                statusIcon.src = iconMode === 'hand'
                    ? (global.siteConfig?.images?.handIcon ?? '/img/icon-hand-detect.png')
                    : (global.siteConfig?.images?.faceIcon ?? '/img/icon-face-detect.png');
            }
        } else {
            overlay.style.display = 'none';
            if (canvas) canvas.classList.remove('canvas-blurred');
        }
    }

    function showLoadingState(loading) {
        const btn = document.getElementById('btn-snapshot');
        if (btn) btn.style.opacity = loading ? '0.4' : '1';
    }

    function showCameraButton(visible) {
        const btn = document.getElementById('btn-snapshot');
        if (btn) btn.style.display = visible ? 'block' : 'none';
    }

    function updateCameraClass(mode) {
        const canvas = document.getElementById('ar-canvas');
        const container = document.getElementById('camera-container');
        const newClass = mode === 'hand' ? 'camera-wrist' : 'camera-default';

        [canvas, container].forEach(el => {
            if (!el) return;
            el.classList.remove('camera-default', 'camera-wrist');
            el.classList.add(newClass);
        });
    }

    function showError(msg) {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = msg;
            showOverlay(true, msg, 'face');
            setTimeout(() => showOverlay(false), 3000);
        }
    }

    function triggerNecklaceHint() {
        global.window.activeHintCategory = true;
        global.window.showHintIfDetected?.();
    }

    // ── Snapshot (save photo) ─────────────────────────────────────────────────

    function takeSnapshot() {
        const video = document.getElementById('input-video');
        const arCanvas = document.getElementById('ar-canvas');
        if (!video || !arCanvas) return;

        // Composite video frame + AR overlay into a temp canvas
        const snap = document.createElement('canvas');
        snap.width = video.videoWidth || arCanvas.width;
        snap.height = video.videoHeight || arCanvas.height;

        const ctx = snap.getContext('2d');

        // Draw mirrored video
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -snap.width, 0, snap.width, snap.height);
        ctx.restore();

        // Draw AR overlay
        ctx.drawImage(arCanvas, 0, 0, snap.width, snap.height);

        // Download
        const link = document.createElement('a');
        link.download = `EnsureAR_TryOn_${Date.now()}.png`;
        link.href = snap.toDataURL('image/png');
        link.click();
    }

    // ── Utility ────────────────────────────────────────────────────────────────

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCategoryEmoji(cat) {
        const map = { necklace: '📿', earrings: '💍', rings: '💎', bracelets: '⛓️', watch: '⌚', eyewear: '🕶️' };
        return map[cat] ?? '✨';
    }

    // ── Boot sequence ─────────────────────────────────────────────────────────

    async function boot(initialCategory = 'necklace') {
        console.log('[EnsureAR ModelLoader] Booting…');

        // 1. Fetch catalog
        await fetchCatalog();

        // 2. Render carousels from catalog data
        renderAllCarousels();

        // 3. Init AR pipeline (camera + landmarker + renderer)
        await initARPipeline();

        // 4. Snapshot button
        const snapBtn = document.getElementById('btn-snapshot');
        if (snapBtn) snapBtn.addEventListener('click', takeSnapshot);

        // 5. Auto-select initial category now that pipeline is ready
        if (typeof global.handleCategoryClick === 'function') {
            global.handleCategoryClick(initialCategory);
        } else {
            switchCategory(initialCategory);
        }

        console.log('[EnsureAR ModelLoader] Boot complete.');
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.ModelLoader = {
        boot,
        switchCategory,
        selectModel,
        fetchCatalog,
        renderAllCarousels,
        get catalog() { return catalog; },
        get activeModel() { return activeModel; },
    };

    // Also expose switchCategory globally so existing handleCategoryClick can call it
    global.switchARCategory = switchCategory;

    console.log('[EnsureAR ModelLoader] Module loaded.');

})(window);
