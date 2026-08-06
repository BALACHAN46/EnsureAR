/**
 * threejs-renderer.js  v6.0
 * ─────────────────────────────────────────────────────────────────────────────
 * EnsureAR — Three.js AR Renderer
 *
 * Architecture:
 *   - Separate <canvas id="ar-canvas"> overlaid on top of the <video> element
 *   - WebGLRenderer with alpha:true for transparent background
 *   - OrthographicCamera maps 1:1 to video pixel dimensions
 *   - Renders jewelry models positioned by JewelryMapper
 *   - Models cached in memory to avoid re-fetching on category switch
 *   - Supports GLB/GLTF, OBJ, OBJ+MTL, and transparent PNG
 *
 * v5.0 fixes vs v4.x:
 *
 *  FIX 1 — `glbPath` undefined ReferenceError (line 409 old code):
 *    Changed to `assetPath` which is in scope.
 *
 *  FIX 2 — Necklace hides when face leaves frame:
 *    Necklace now renders from pose-only data if faceResult is absent.
 *    The guard in updateFrame now requires EITHER face OR pose to be present.
 *
 *  FIX 3 — normalizeAndWrap Y centering:
 *    For necklaces the TOP of the bounding box (max Y) is aligned to Y=0 (the
 *    anchor point). For rings/bracelets the centroid alignment is retained.
 *    This prevents the necklace from sitting half its height below the anchor.
 *
 *  FIX 4 — PNG skipped normalizeAndWrap:
 *    PNG path now calls normalizeAndWrap after creating the PlaneGeometry.
 *    The PlaneGeometry size is set to 1.0 so the mapper scale is correct.
 *
 *  FIX 5 — MTLLoader setPath() missing:
 *    mtlLoader.setPath() is now set to the directory of the MTL file so that
 *    relative texture references in the MTL resolve correctly.
 *
 *  FIX 6 — Per-category lerp alpha table:
 *    Necklace: pos=0.20, rot=0.25, scale=0.18 (smooth, hide pose noise)
 *    Rings:    pos=0.65, rot=0.60, scale=0.50 (tight, finger must track fast)
 *    Earrings: pos=0.30, rot=0.30, scale=0.25
 *    Bracelets:pos=0.50, rot=0.45, scale=0.35
 *
 *  FIX 7 — Front-clipping plane for closed necklaces:
 *    After model load, detectNecklaceType() is called. If 'closed', a
 *    THREE.Plane clipping plane is added to the renderer that clips everything
 *    behind the neck center (Z < neckCenter.z). The plane is updated each
 *    frame from the mapper's neckCenter output.
 *
 *  FIX 8 — Improved lighting:
 *    Added HemisphereLight (sky/ground) for environment fill.
 *    Enabled toneMapping (ACESFilmic) and physicallyCorrectLights for
 *    realistic PBR metal rendering on GLB jewelry.
 *
 *  FIX 9 — Debug mode:
 *    window.DEBUG_AR = true enables FPS counter, landmark dots, anchor
 *    crosshair, and bounding box wireframe overlay.
 *    window.DEBUG_OCCLUSION = true makes occluder cylinders visible (red).
 *
 *  FIX 10 — mapNecklace now receives performance.now() timestamp:
 *    Passed to JewelryMapper so One-Euro filters can compute dt correctly.
 *
 * Usage:
 *   EnsureAR.Renderer.init(videoEl, arCanvasEl)
 *   EnsureAR.Renderer.loadModel(assetPath, modelMeta, category) → Promise
 *   EnsureAR.Renderer.updateFrame(faceResult, handResult, poseResult)
 *   EnsureAR.Renderer.setCategory(category)
 *   EnsureAR.Renderer.clear()
 * ─────────────────────────────────────────────────────────────────────────────
 */
window.DEBUG_AR = true;
(function (global) {
    'use strict';

    // ── Three.js is loaded via import map in TryOn.cshtml ────────────────────────

    // ── Module state ──────────────────────────────────────────────────────────

    let THREE, GLTFLoader, DRACOLoader, OBJLoader, MTLLoader;
    let renderer, scene, camera;
    let videoEl, canvasEl;
    let animationId = null;

    // GLB/OBJ/PNG cache: Map<assetPath, THREE.Group>
    const modelCache = new Map();

    // Active scene nodes — cleared on every model switch
    let activeNodes = [];

    // Occluder meshes (invisible depth masks)
    const occluders = { neck: null, finger: null, wrist: null };

    // Current category drives mapping function
    let activeCategory = 'necklace';

    // Current loaded model metadata (scale, offset, etc.)
    let activeModelMeta = null;

    // Earring: we need two instances (left + right)
    let earringLeft = null;
    let earringRight = null;

    // Tracking controllers
    let eyewearController = null;
    let necklaceController = null;
    let wristController = null;
    let braceletController = null;
    let ringController = null;
    let earringController = null;

    // Lights
    let lights = [];

    // Clipping plane for closed necklace models (updated each frame)
    let neckClipPlane = null;
    let useClipPlane = false;
    let currentNecklaceType = 'open';

    // ── Per-category lerp alpha table ──────────────────────────────────────────
    //   pos:   position interpolation factor (higher = tighter tracking)
    //   rot:   rotation slerp factor
    //   scale: scale lerp factor
    const LERP_ALPHA = {
        necklace: { pos: 0.20, rot: 0.22, scale: 0.18 },
        earrings: { pos: 0.30, rot: 0.30, scale: 0.25 },
        rings: { pos: 0.65, rot: 0.60, scale: 0.50 },
        bracelets: { pos: 0.50, rot: 0.45, scale: 0.38 },
        watch: { pos: 0.50, rot: 0.45, scale: 0.38 }, // same as bracelets — wrist-anchored
        eyewear: { pos: 0.70, rot: 0.70, scale: 0.50 }, // fast face-locked tracking
    };

    // ── Debug state ───────────────────────────────────────────────────────────

    let debugHelpers = [];    // scene objects added in debug mode
    let fpsLastTime = 0;
    let fpsFrames = 0;
    let fpsDisplay = null;  // DOM element
    // ── Tracking Warning UI ────────────────────────────────────────────────
    let trackingWarningMsg = null; // DOM element for "Face not detected"

    // ── Opacity Lerp (Fade on tracking loss) ─────────────────────────────────
    let targetOpacity = 1.0;
    let currentOpacity = 1.0;

    // ── IMPROVEMENT 3 — Too-Close Overlay (v6.0) ─────────────────────────────
    // Separate from trackingWarningMsg: this overlay freezes the necklace and
    // shows a user-facing message asking them to step back.
    let tooCloseOverlay = null;  // DOM element injected by init()
    let isFrozenByTooClose = false; // freeze flag read by applyTransform

    // ── IMPROVEMENT 4 — Sparkle system state (v6.0) ───────────────────────────
    // A single THREE.Clock drives all sparkle uTime uniforms.
    // All sparkle materials share the same uniform object reference, so we
    // only pay one JS property write per frame (not one per mesh).
    let sparkleClock = null;          // lazy-initialised after THREE is ready
    let sparkleUniforms = null;       // shared { uTime, uHeadYaw, uSparkleIntensity }
    const sparkleMaterials = [];      // list of materials that received the shader patch

    // ── IMPROVEMENT 6 — Last-known velocity for adaptive lerp ────────────────
    // Stored per-node in node.userData.velocity (pixels/frame).

    // ── Dynamic import of Three.js (ESM) ─────────────────────────────────────

    async function importThree() {
        if (THREE) return;

        const threeModule = await import('three');
        THREE = threeModule;
        global.THREE = THREE; // Expose globally for Eyewear modules

        const { GLTFLoader: GL } = await import('three/addons/loaders/GLTFLoader.js');
        const { DRACOLoader: DL } = await import('three/addons/loaders/DRACOLoader.js');
        const { OBJLoader: OL } = await import('three/addons/loaders/OBJLoader.js');
        const { MTLLoader: ML } = await import('three/addons/loaders/MTLLoader.js');
        GLTFLoader = GL;
        DRACOLoader = DL;
        OBJLoader = OL;
        MTLLoader = ML;

        // Configure DRACO decoder path
        DRACOLoader.decoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

        console.log('[EnsureAR Renderer] Three.js r165 loaded.');
    }

    // ── Initialise scene ──────────────────────────────────────────────────────

    async function init(video, arCanvas) {
        videoEl = video;
        canvasEl = arCanvas;

        await importThree();

        const w = videoEl.clientWidth || videoEl.videoWidth || 640;
        const h = videoEl.clientHeight || videoEl.videoHeight || 480;

        // ── Renderer ───────────────────────────────────────────────────────────
        renderer = new THREE.WebGLRenderer({
            canvas: canvasEl,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = false;

        // FIX 8 — Physically correct lighting + ACES tone mapping for metallic PBR
        renderer.useLegacyLights = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        // Clipping planes array — populated when a closed necklace is loaded
        neckClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        renderer.clippingPlanes = [];    // starts empty (no clipping)
        renderer.localClippingEnabled = true;

        // ── Scene ──────────────────────────────────────────────────────────────
        scene = new THREE.Scene();

        if (global.EnsureAR?.Eyewear?.EyewearController) {
            eyewearController = new global.EnsureAR.Eyewear.EyewearController(scene);
        }
        if (global.EnsureAR?.Necklace?.NecklaceController) {
            necklaceController = new global.EnsureAR.Necklace.NecklaceController(scene);
        }
        if (global.EnsureAR?.Bracelet?.BraceletController && !braceletController) {
            braceletController = new global.EnsureAR.Bracelet.BraceletController(scene);
        }
        if (global.EnsureAR?.Wrist?.WristController && !wristController) {
            wristController = new global.EnsureAR.Wrist.WristController(scene);
        }
        if (global.EnsureAR?.Ring?.RingController) {
            ringController = new global.EnsureAR.Ring.RingController(scene);
        }
        if (global.EnsureAR?.Earring?.EarringController) {
            earringController = new global.EnsureAR.Earring.EarringController(scene);
        }

        // Initialize dynamic occlusion AI
        if (global.EnsureAR?.AI?.DepthEstimator) {
            global.depthEstimator = new global.EnsureAR.AI.DepthEstimator();
            global.depthEstimator.initialize();
        }
        if (global.EnsureAR?.AI?.SamSegmenter) {
            global.samSegmenter = new global.EnsureAR.AI.SamSegmenter();
            global.samSegmenter.initialize();
        }

        initOccluders();

        // Pass screen size to occlusion shader
        aiOcclusionUniforms.uScreenSize.value = new THREE.Vector2(w, h);

        // Initialize Eyewear Fade Uniforms
        eyewearFadeUniforms.uHeadPos.value = new THREE.Vector3();
        eyewearFadeUniforms.uHeadForward.value = new THREE.Vector3(0, 0, 1);

        // ── Orthographic camera: pixel-space maps 1:1 to world-space ──────────
        // left, right, top, bottom, near, far
        camera = new THREE.OrthographicCamera(
            -w / 2, w / 2,
            h / 2, -h / 2,
            -2000, 2000
        );
        camera.position.set(0, 0, 1000);

        // ── Lighting ───────────────────────────────────────────────────────────
        setupLights(w, h);

        // ── Resize handler ─────────────────────────────────────────────────────
        const resizeObs = new ResizeObserver(onResize);
        resizeObs.observe(videoEl);

        // ── Debug FPS display ──────────────────────────────────────────────────
        fpsDisplay = document.createElement('div');
        fpsDisplay.id = 'ens-fps-display';
        Object.assign(fpsDisplay.style, {
            position: 'absolute', top: '8px', left: '8px',
            color: '#00ff88', fontFamily: 'monospace', fontSize: '12px',
            fontWeight: 'bold', pointerEvents: 'none', display: 'none',
            background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px',
            zIndex: '9999',
        });
        fpsDisplay.textContent = 'FPS: --';
        (document.getElementById('camera-container') || document.body).appendChild(fpsDisplay);

        // ── Tracking Warning UI (existing — missing face/pose) ────────────────
        trackingWarningMsg = document.createElement('div');
        trackingWarningMsg.id = 'ens-tracking-warning';
        Object.assign(trackingWarningMsg.style, {
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)', color: '#ff6b6b',
            padding: '16px 24px', borderRadius: '8px',
            fontFamily: 'sans-serif', fontSize: '18px', fontWeight: 'bold',
            textAlign: 'center', backdropFilter: 'blur(4px)',
            pointerEvents: 'none', display: 'none', zIndex: '9999',
            border: '1px solid rgba(255,100,100,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        });
        (document.getElementById('camera-container') || document.body).appendChild(trackingWarningMsg);

        // ── IMPROVEMENT 3 — Too-Close Overlay (v6.0) ─────────────────────────
        // Injected alongside trackingWarningMsg. Shown when TooCloseGuard fires.
        // Uses a distinct visual style (amber / warm) so users don't confuse it
        // with the red "face not detected" warning.
        tooCloseOverlay = document.createElement('div');
        tooCloseOverlay.id = 'ens-too-close-overlay';
        Object.assign(tooCloseOverlay.style, {
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(10, 10, 10, 0.85)',
            color: '#ffd580',
            padding: '25px', borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'none', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'sans-serif', fontSize: '18px', fontWeight: '600',
            textAlign: 'center',
            pointerEvents: 'none', zIndex: '10000',
            transition: 'opacity 0.25s ease',
        });
        tooCloseOverlay.innerHTML =
            '<div style="font-size:54px; margin-bottom: 16px;">&#128247;</div>' +
            '<div style="margin-bottom: 12px; font-size: 20px;">You\'re too close to the camera.</div>' +
            '<div style="font-size:15px;font-weight:400;color:#ffe4a0;max-width:320px;line-height:1.5;">' +
            'Please move farther away to continue the virtual try-on.</div>';
        (document.getElementById('camera-container') || document.body).appendChild(tooCloseOverlay);

        // ── IMPROVEMENT 4 — Sparkle system (v6.0) ────────────────────────────
        sparkleClock = new THREE.Clock();
        sparkleUniforms = {
            uTime: { value: 0.0 },
            uHeadYaw: { value: 0.0 },
            uSparkleIntensity: { value: 0.28 },  // subtle — max glint contribution
        };

        console.log('[EnsureAR Renderer] Scene initialised', w, 'x', h);
    }

    function setupLights(w, h) {
        // Remove old lights
        lights.forEach(l => scene.remove(l));
        lights = [];

        // ── Procedural Environment Map (PMREM) ─────────────────────────────────
        if (renderer && scene && !scene.environment) {
            const pmremGenerator = new THREE.PMREMGenerator(renderer);
            pmremGenerator.compileEquirectangularShader();

            // Create a simple procedural sky/ground texture
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, '#fff8e7'); // warm sky
            grad.addColorStop(0.4, '#e0d0b0'); // horizon
            grad.addColorStop(0.6, '#303050'); // ground
            grad.addColorStop(1, '#101020'); // deep ground
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            const envTexture = new THREE.CanvasTexture(canvas);
            envTexture.colorSpace = THREE.SRGBColorSpace;
            const envTarget = pmremGenerator.fromEquirectangular(envTexture);
            scene.environment = envTarget.texture;

            envTexture.dispose();
            pmremGenerator.dispose();
        }

        // ── PBR Lights ────────────────────────────────────────────────────────
        const hemi = new THREE.HemisphereLight(
            0xfff8e7,  // sky color  — warm white
            0x303050,  // ground color — cool dark
            2.0        // intensity
        );

        // Key light — warm daylight from upper-right
        const dirLight = new THREE.DirectionalLight(0xfff0d0, 3.5);
        dirLight.position.set(w * 0.3, h * 0.5, 600);

        // Fill light — soft cool from left
        const fillLight = new THREE.DirectionalLight(0xd0e8ff, 1.5);
        fillLight.position.set(-w * 0.5, h * 0.2, 400);

        // Crown sparkle — top point light for jewel highlights
        const topLight = new THREE.PointLight(0xffd97a, 3.0, 2000);
        topLight.position.set(0, h * 0.5, 500);

        // Rim light for metallic depth
        const rimLight = new THREE.PointLight(0xc0d8ff, 2.0, 1500);
        rimLight.position.set(-w * 0.4, -h * 0.2, 200);

        // Back rim light
        const backLight = new THREE.PointLight(0xffe0b0, 1.5, 1500);
        backLight.position.set(0, 0, -500);

        lights = [hemi, dirLight, fillLight, topLight, rimLight, backLight];
        lights.forEach(l => scene.add(l));
    }

    function onResize() {
        if (!renderer || !videoEl) return;
        const w = videoEl.clientWidth || 640;
        const h = videoEl.clientHeight || 480;

        renderer.setSize(w, h);

        camera.left = -w / 2;
        camera.right = w / 2;
        camera.top = h / 2;
        camera.bottom = -h / 2;
        camera.updateProjectionMatrix();

        setupLights(w, h);
    }

    // ── Model Normalisation ───────────────────────────────────────────────────

    /**
     * normalizeAndWrap — wraps a loaded model in a Group and scales it so its
     * largest horizontal dimension is exactly 1.0 Three.js unit.
     *
     * FIX 3 — Necklace Y alignment:
     *   For necklaces (and earrings) the TOP of the bounding box should sit at
     *   origin Y=0, because the anchor point (neck/earlobe) is the attachment
     *   point at the TOP of the jewelry, not the centroid.
     *
     *   For rings and bracelets the centroid alignment is correct because the
     *   ring is placed at the MCP joint (center of the ring, not its top).
     *
     * @param {THREE.Object3D} model
     * @param {string} [anchorMode='top'] — 'top' | 'center'
     */
    function normalizeAndWrap(model, anchorMode = 'top') {
        const wrapper = new THREE.Group();
        wrapper.add(model);

        if (activeCategory === 'rings' && typeof global.EnsureAR.RingScaleNormalizer !== 'undefined') {
            // Let the RingScaleNormalizer handle all bounds, scaling, and precise pivot centering
            // directly on the model so the wrapper remains untouched for tracking scale.
            global.EnsureAR.RingScaleNormalizer.normalize(model);
            return wrapper;
        }

        // -------------------------------------------------------
        // Apply rotationOffset early for Eyewear so bounding box is correct
        // -------------------------------------------------------
        if (activeCategory === 'eyewear' && typeof activeModelMeta !== 'undefined' && activeModelMeta?.rotationOffset) {
            const ro = activeModelMeta.rotationOffset;
            if (ro[0] || ro[1] || ro[2]) {
                const extra = new THREE.Euler(
                    THREE.MathUtils.degToRad(ro[0]),
                    THREE.MathUtils.degToRad(ro[1]),
                    THREE.MathUtils.degToRad(ro[2]),
                    'XYZ'
                );
                model.rotation.setFromVector3(extra);
                model.updateMatrixWorld(true);
            }
        }

        // -------------------------------------------------------
        // Calculate original bounding box
        // -------------------------------------------------------
        let box = new THREE.Box3().setFromObject(wrapper);
        let size = box.getSize(new THREE.Vector3());

        const width = Math.max(size.x, 0.001);
        const height = Math.max(size.y, 0.001);
        const depth = Math.max(size.z, 0.001);

        // -------------------------------------------------------
        // Normalize scale
        // -------------------------------------------------------
        let scaleFactor;

        if (anchorMode === "center") {
            // Eyewear
            scaleFactor = 1.30 / width;
        }
        else if (anchorMode === "wrist") {
            // Watches and Bracelets (can be oriented in any direction)
            const maxDim = Math.max(width, height, depth);
            scaleFactor = 1.0 / maxDim;
        }
        else {
            // Necklace / Earrings / etc.
            scaleFactor = 1.0 / width;
        }

        model.scale.setScalar(scaleFactor);
        model.updateMatrixWorld(true);

        // -------------------------------------------------------
        // Recalculate bounding box AFTER scaling
        // -------------------------------------------------------
        box = new THREE.Box3().setFromObject(wrapper);

        size = box.getSize(new THREE.Vector3());

        const center = box.getCenter(new THREE.Vector3());

        // -------------------------------------------------------
        // Pivot correction
        // -------------------------------------------------------
        if (anchorMode === "top") {

            // Necklace
            model.position.x -= center.x;
            model.position.y -= box.max.y;
            model.position.z -= center.z;

        }
        else if (anchorMode === "center") {

            // Eyewear and Rings (Base centering)
            model.position.x -= center.x;
            model.position.y -= center.y;
            model.position.z -= center.z;

            // Apply Eyewear-specific offsets ONLY for eyewear
            if (activeCategory === 'eyewear') {
                // Push glasses slightly toward the face
                model.position.z -= size.z * 0.45;
                // Small downward adjustment so bridge rests on nose
                model.position.y -= size.y * 0.02;
            }
        }
        else if (anchorMode === "wrist") {

            // Wrist/Bracelets (just center it)

            model.position.x -= center.x;
            model.position.y -= center.y;
            model.position.z -= center.z;
        }

        model.updateMatrixWorld(true);

        return wrapper;
    }

    const aiOcclusionUniforms = {
        uDepthMap: { value: null },
        uMaskMap: { value: null },
        uScreenSize: { value: null },
        uEnableDepth: { value: false },
        uEnableMask: { value: false },
        uCenterWorld: { value: [0, 0, 0] }
    };
    const aiOcclusionMaterials = [];

    function applyDynamicOcclusionShader(m) {
        if (!m) return;
        m.needsUpdate = true;
        m.transparent = true; // Required for discard or alpha blending

        const originalOnBeforeCompile = m.onBeforeCompile;

        m.onBeforeCompile = function (shader) {
            // Apply original compiler if it exists (e.g. sparkle)
            if (originalOnBeforeCompile) originalOnBeforeCompile(shader);

            shader.uniforms.uDepthMap = aiOcclusionUniforms.uDepthMap;
            shader.uniforms.uMaskMap = aiOcclusionUniforms.uMaskMap;
            shader.uniforms.uScreenSize = aiOcclusionUniforms.uScreenSize;
            shader.uniforms.uEnableDepth = aiOcclusionUniforms.uEnableDepth;
            shader.uniforms.uEnableMask = aiOcclusionUniforms.uEnableMask;
            shader.uniforms.uCenterWorld = aiOcclusionUniforms.uCenterWorld;

            shader.vertexShader = 'varying vec3 vWorldPosOut;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                '#include <project_vertex>\n                vWorldPosOut = (modelMatrix * vec4(position, 1.0)).xyz;'
            );

            shader.fragmentShader = 'uniform sampler2D uDepthMap;\n' +
                'uniform sampler2D uMaskMap;\n' +
                'uniform vec2 uScreenSize;\n' +
                'uniform bool uEnableDepth;\n' +
                'uniform bool uEnableMask;\n' +
                'uniform vec3 uCenterWorld;\n' +
                'varying vec3 vWorldPosOut;\n' +
                shader.fragmentShader;

            // Inject occlusion check before final color assignment
            const occlusionCode = `
                vec2 screenUV = gl_FragCoord.xy / uScreenSize;
                
                if (uEnableMask) {
                    float maskVal = texture2D(uMaskMap, screenUV).r;
                    if (maskVal > 0.5) {
                        // The mask represents the body part (e.g. the finger/wrist).
                        // Since the camera looks down the -Z axis, a smaller Z means it's further away.
                        // If the pixel is behind the center of the body part, it's occluded!
                        if (vWorldPosOut.z < uCenterWorld.z) {
                            discard;
                        }
                    }
                }

                if (uEnableDepth) {
                    float bgDepth = texture2D(uDepthMap, screenUV).r;
                    // bgDepth from Depth Anything: closer = brighter (usually)
                    // This requires calibration, but as a placeholder:
                    if (bgDepth > 0.8) discard; 
                }
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                occlusionCode + '\n#include <dithering_fragment>'
            );

            aiOcclusionMaterials.push(m);
        };
    }

    // Eyewear Temple Fade Uniforms
    const eyewearFadeUniforms = {
        uHeadPos: { value: null }, // Initialized in init()
        uHeadForward: { value: null }, // Initialized in init()
        uFadeStart: { value: -0.2 }, // Adjust these thresholds to control the fade length
        uFadeEnd: { value: -0.8 }
    };
    const eyewearFadeMaterials = [];

    function applyEyewearFadeShader(m) {
        if (!m) return;
        if (m.userData.fadeShaderApplied) return; // Prevent multiple injections on shared materials
        m.userData.fadeShaderApplied = true;

        m.needsUpdate = true;
        m.transparent = true; // Required for alpha fading

        const originalOnBeforeCompile = m.onBeforeCompile;

        m.onBeforeCompile = function (shader) {
            if (originalOnBeforeCompile) originalOnBeforeCompile(shader);

            shader.uniforms.uHeadPos = eyewearFadeUniforms.uHeadPos;
            shader.uniforms.uHeadForward = eyewearFadeUniforms.uHeadForward;
            shader.uniforms.uFadeStart = eyewearFadeUniforms.uFadeStart;
            shader.uniforms.uFadeEnd = eyewearFadeUniforms.uFadeEnd;

            // Add varying for world position to the vertex shader
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                '#include <common>\nvarying vec3 vFadeWorldPos;\n'
            );

            // We must inject vFadeWorldPos after the worldPosition is calculated.
            // In Three.js, worldPosition is available after `#include <worldpos_vertex>` or `#include <project_vertex>`.
            // `#include <project_vertex>` defines `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );`
            // and `gl_Position = projectionMatrix * mvPosition;`.
            // But we need world position. `#include <worldpos_vertex>` calculates `vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );`
            // It's safer to just compute it ourselves at the end.
            const vWorldPosCode = `
                vec4 fadeWorldPosTemp = modelMatrix * vec4( transformed, 1.0 );
                vFadeWorldPos = fadeWorldPosTemp.xyz;
            `;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                '#include <project_vertex>\n' + vWorldPosCode
            );

            // Fragment shader
            shader.fragmentShader = 'uniform vec3 uHeadPos;\n' +
                'uniform vec3 uHeadForward;\n' +
                'uniform float uFadeStart;\n' +
                'uniform float uFadeEnd;\n' +
                'varying vec3 vFadeWorldPos;\n' +
                shader.fragmentShader;

            // Calculate distance along the head's Z axis (forward is +Z, so temples go towards -Z)
            const fadeCode = `
                vec3 toVertex = vFadeWorldPos - uHeadPos;
                // Dot product with forward vector gives local Z distance
                float localZ = dot(toVertex, uHeadForward);
                
                // If localZ is less than uFadeStart, it starts fading.
                // At uFadeEnd, alpha is 0.
                float fadeAlpha = smoothstep(uFadeEnd, uFadeStart, localZ);
                
                gl_FragColor.a *= fadeAlpha;
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                fadeCode + '\n#include <dithering_fragment>'
            );

            eyewearFadeMaterials.push(m);
        };
    }

    function applySparkleShader(m) {
        m.needsUpdate = true;
        if (m.metalness === undefined) m.metalness = 0.7;
        if (m.roughness === undefined) m.roughness = 0.3;
        m.transparent = true;
        m.alphaTest = 0.01;

        // Detect metallic or gem-like surface
        var isSparkle = ((m.metalness || 0) >= 0.5 || (m.roughness !== undefined ? m.roughness : 1) <= 0.35);

        m.onBeforeCompile = function (shader) {
            var fresnelCode = [
                '#include <dithering_fragment>',
                'float fresnel=pow(1.0-abs(dot(normalize(vNormal),vec3(0,0,1))),2.5);',
                'gl_FragColor.a*=(1.0-fresnel*0.65);'
            ].join('\n');

            if (isSparkle && sparkleUniforms) {
                shader.uniforms.uTime = sparkleUniforms.uTime;
                shader.uniforms.uHeadYaw = sparkleUniforms.uHeadYaw;
                shader.uniforms.uSparkleIntensity = sparkleUniforms.uSparkleIntensity;
                shader.fragmentShader = 'uniform float uTime;\nuniform float uHeadYaw;\nuniform float uSparkleIntensity;\n' + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', [
                    fresnelCode,
                    // Hash noise per facet - no texture lookup needed, GPU-friendly
                    'vec2 sp=vNormal.xy*18.53+vNormal.yz*7.41;',
                    'float h1=fract(sin(dot(sp,         vec2(12.9898,78.233)))*43758.5453);',
                    'float h2=fract(sin(dot(sp+vec2(1.0),vec2(93.9898,67.345)))*23421.631);',
                    'float h3=fract(sin(dot(sp+vec2(2.0),vec2(45.234,12.678)))*13421.318);',
                    // Each facet blinks at its own frequency - avoids synchronised flash
                    'float g1=pow(max(0.0,sin(uTime*(2.7+h1*3.1)+h1*6.28)),12.0);',
                    'float g2=pow(max(0.0,sin(uTime*(1.9+h2*2.4)+h2*6.28)),16.0);',
                    'float g3=pow(max(0.0,sin(uTime*(3.5+h3*1.8)+h3*6.28)), 8.0);',
                    // View-angle: sharpest at grazing (physically correct Fresnel sparkle)
                    'float NdotV=abs(dot(normalize(vNormal),vec3(0,0,1)));',
                    'float viewWt=smoothstep(0.0,0.6,NdotV);',
                    // Head-yaw: facing side catches more key light - +30% bias
                    'float yawBias=1.0+uHeadYaw*vNormal.x*0.30;',
                    'float glint=(g1*0.5+g2*0.3+g3*0.2)*viewWt*max(yawBias,0.0);',
                    'float sparkle=glint*uSparkleIntensity;',
                    // Warm gold tint on sparkle highlights
                    'gl_FragColor.rgb+=vec3(sparkle*1.0,sparkle*0.95,sparkle*0.85);'
                ].join('\n'));
                sparkleMaterials.push(m);
            } else {
                shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', fresnelCode);
            }
        };
    }

    // ── IMPROVEMENT 8: Eyewear Model Auto-Fixer (v6.1) ──────────────────────
    const EyewearModelFixer = {
        lastReport: null,
        analyzeAndFix: function (wrapper) {
            if (activeCategory !== 'eyewear') return;

            // 1. Compute global bounding box (after model is fully scaled by normalizeAndWrap)
            const globalBox = new THREE.Box3().setFromObject(wrapper);
            const globalMinZ = globalBox.min.z;
            const globalMaxZ = globalBox.max.z;
            const depth = globalMaxZ - globalMinZ;

            const report = {
                depth: depth.toFixed(2),
                meshes: []
            };

            console.groupCollapsed("[EyewearModelFixer] Model Analysis & Auto-Fix Report");
            console.log(`Global Bounds: Depth=${depth.toFixed(2)} units`);

            const meshes = [];
            wrapper.traverse(node => {
                if (node.isMesh) meshes.push(node);
            });

            console.log(`Total Meshes: ${meshes.length}`);

            meshes.forEach(mesh => {
                const meshBox = new THREE.Box3().setFromObject(mesh);
                const normMin = (meshBox.min.z - globalMinZ) / depth;
                const normMax = (meshBox.max.z - globalMinZ) / depth;

                let classification = 'Temple';
                if (normMin > 0.70) {
                    classification = 'Frame';
                    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                    const isTransparent = mat && (mat.transparent || mat.opacity < 1.0 || mat.transmission > 0);
                    const isLensName = mesh.name.toLowerCase().includes('lens') || mesh.name.toLowerCase().includes('glass');

                    if (isTransparent || isLensName) {
                        classification = 'Lens';
                    }
                }

                const meshReport = {
                    name: mesh.name || 'Unnamed',
                    zSpan: `[${normMin.toFixed(2)} to ${normMax.toFixed(2)}]`,
                    type: classification,
                    fixes: []
                };

                console.log(`Mesh: "${meshReport.name}" | Z-Span: ${meshReport.zSpan} | Auto-Classified: ${classification}`);

                if (mesh.material) {
                    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    mats.forEach(m => {
                        m.depthWrite = true;
                        m.depthTest = true;
                        m.side = THREE.DoubleSide;

                        if (classification === 'Lens') {
                            m.transparent = true;
                            mesh.renderOrder = 3;
                            meshReport.fixes.push("transparent=true, renderOrder=3");
                        } else if (classification === 'Frame') {
                            if (m.opacity === 1.0 && !m.map?.transparent) {
                                m.transparent = false;
                                meshReport.fixes.push("Forced transparent=false, renderOrder=1");
                            } else {
                                meshReport.fixes.push("renderOrder=1");
                            }
                            mesh.renderOrder = 1;
                        } else if (classification === 'Temple') {
                            m.transparent = true;
                            mesh.renderOrder = 2;
                            meshReport.fixes.push("transparent=true, renderOrder=2, fadeShader applied");
                            applyEyewearFadeShader(m);
                        }
                        m.needsUpdate = true;
                    });
                }
                report.meshes.push(meshReport);
            });
            console.groupEnd();
            this.lastReport = report;
        }
    };

    // 'D' Key Debug UI Toggle
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'd') {
            let panel = document.getElementById('eyewear-debug-panel');
            if (panel) {
                panel.remove();
                return;
            }
            if (!EyewearModelFixer.lastReport) return;

            panel = document.createElement('div');
            panel.id = 'eyewear-debug-panel';
            panel.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.85);color:#0f0;padding:15px;font-family:monospace;z-index:99999;max-width:400px;border:1px solid #0f0;border-radius:5px;font-size:12px;overflow-y:auto;max-height:90vh;';

            let html = `<h3 style="margin-top:0;color:#fff;">Eyewear Auto-Fixer Report</h3>`;
            html += `<b>Global Depth:</b> ${EyewearModelFixer.lastReport.depth} units<br><br>`;

            EyewearModelFixer.lastReport.meshes.forEach(m => {
                html += `<div style="border-bottom:1px solid #333;margin-bottom:8px;padding-bottom:8px;">`;
                html += `<b>Mesh:</b> ${m.name}<br>`;
                html += `<b>Type:</b> <span style="color:${m.type === 'Frame' ? '#f88' : (m.type === 'Lens' ? '#88f' : '#ff8')}">${m.type}</span><br>`;
                html += `<b>Z-Span:</b> ${m.zSpan}<br>`;
                html += `<b>Fixes:</b><ul>`;
                m.fixes.forEach(f => html += `<li>${f}</li>`);
                html += `</ul></div>`;
            });

            panel.innerHTML = html;
            document.body.appendChild(panel);
        }
    });

    // ── GLB / GLTF loading ────────────────────────────────────────────────────

    async function loadGLTF(glbPath) {
        if (modelCache.has(glbPath)) {
            return modelCache.get(glbPath).clone(true);
        }

        const loader = new GLTFLoader();

        const draco = new DRACOLoader();
        draco.setDecoderPath(DRACOLoader.decoderPath);
        loader.setDRACOLoader(draco);

        return new Promise((resolve, reject) => {
            loader.load(
                glbPath,
                (gltf) => {
                    const model = gltf.scene;

                    model.traverse(node => {
                        if (node.isMesh) {
                            node.castShadow = false;
                            node.receiveShadow = false;
                            if (node.material) {
                                const mats = Array.isArray(node.material)
                                    ? node.material
                                    : [node.material];
                                // IMPROVEMENT 4 - sparkle shader applied per material
                                // Skip sparkle shader for watches as their complex PBR materials fail compilation with it
                                if (activeCategory === 'necklace') {
                                    mats.forEach(m => applySparkleShader(m));
                                }

                                // Apply dynamic AI occlusion
                                if (activeCategory !== 'eyewear') {
                                    mats.forEach(m => applyDynamicOcclusionShader(m));
                                } else {
                                    // Apply temple fade shader for eyewear
                                    mats.forEach(m => applyEyewearFadeShader(m));
                                }
                            }
                        }
                    });
                    const anchorMode =
                        activeCategory === 'eyewear'
                            ? 'center'
                            : (activeCategory === 'watch' || activeCategory === 'bracelets')
                                ? 'wrist'
                                : (activeCategory === 'earrings' || activeCategory === 'rings')
                                    ? 'center'
                                    : 'top';

                    const wrapper = normalizeAndWrap(model, anchorMode);

                    if (typeof EyewearModelFixer !== 'undefined') {
                        EyewearModelFixer.analyzeAndFix(wrapper);
                    }

                    modelCache.set(glbPath, wrapper.clone(true));
                    console.log('[EnsureAR Renderer] Loaded GLB:', glbPath, model);
                    resolve(wrapper);
                },
                undefined,
                (err) => {
                    console.error('[EnsureAR Renderer] GLB load error:', glbPath, err);
                    reject(err);
                }
            );
        });
    }

    // ── OBJ / OBJ+MTL loading ─────────────────────────────────────────────────

    async function loadOBJ(modelPath, mtlPath, texturePath) {
        if (modelCache.has(modelPath)) {
            return modelCache.get(modelPath).clone(true);
        }

        const objLoader = new OBJLoader();

        // Default shiny gold material if no MTL is provided
        const defaultMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.85,
            roughness: 0.15,
            envMapIntensity: 1.0,
        });

        const loadGeometry = () => new Promise((resolve, reject) => {
            let customTexture = null;
            if (texturePath) {
                const texLoader = new THREE.TextureLoader();
                customTexture = texLoader.load(texturePath);
                customTexture.colorSpace = THREE.SRGBColorSpace;
            }

            objLoader.load(
                modelPath,
                (object) => {
                    object.traverse(node => {
                        if (node.isMesh) {
                            if (!mtlPath) {
                                node.material = defaultMaterial.clone();
                            }

                            // Apply uploaded custom diffuse texture ONLY if there is no MTL file.
                            // If an MTL is provided, it will handle mapping multiple textures correctly!
                            if (customTexture && !mtlPath) {
                                const applyTex = (m) => { m.map = customTexture; m.needsUpdate = true; };
                                if (Array.isArray(node.material)) node.material.forEach(applyTex);
                                else applyTex(node.material);
                            }

                            node.castShadow = false;
                            node.receiveShadow = false;

                            // Apply dynamic AI occlusion
                            const mats = Array.isArray(node.material) ? node.material : [node.material];
                            if (activeCategory !== 'eyewear') {
                                mats.forEach(m => applyDynamicOcclusionShader(m));
                            }
                        }
                    });

                    const anchorMode =
                        activeCategory === 'eyewear'
                            ? 'center'
                            : (activeCategory === 'watch' || activeCategory === 'bracelets')
                                ? 'wrist'
                                : (activeCategory === 'earrings' || activeCategory === 'rings')
                                    ? 'center'
                                    : 'top';
                    const wrapper = normalizeAndWrap(object, anchorMode);

                    if (typeof EyewearModelFixer !== 'undefined') {
                        EyewearModelFixer.analyzeAndFix(wrapper);
                    }
                    modelCache.set(modelPath, wrapper.clone(true));
                    console.log('[EnsureAR Renderer] Loaded OBJ:', modelPath);
                    resolve(wrapper);
                },
                undefined,
                (err) => {
                    console.error('[EnsureAR Renderer] OBJ load error:', modelPath, err);
                    reject(err);
                }
            );
        });

        if (mtlPath) {
            const mtlLoader = new MTLLoader();

            // FIX 5 — Set resource path to the MTL file's directory so relative
            // texture paths (e.g. "texture.jpg") resolve from the correct location.
            const mtlDir = mtlPath.substring(0, mtlPath.lastIndexOf('/') + 1);
            mtlLoader.setPath(mtlDir);

            return new Promise((resolve, reject) => {
                // Load the MTL from its full path, not just the basename
                const mtlFile = mtlPath.substring(mtlPath.lastIndexOf('/') + 1);
                mtlLoader.load(
                    mtlFile,
                    (materials) => {
                        materials.preload();
                        objLoader.setMaterials(materials);
                        loadGeometry().then(resolve).catch(reject);
                    },
                    undefined,
                    (err) => {
                        // MTL failed — fall back to default gold material
                        console.warn('[EnsureAR Renderer] MTL load failed, using default material:', err);
                        loadGeometry().then(resolve).catch(reject);
                    }
                );
            });
        }

        return loadGeometry();
    }

    // ── PNG necklace overlay loading ──────────────────────────────────────────

    // async function loadPNG(modelPath) {
    //     if (modelCache.has(modelPath)) {
    //         return modelCache.get(modelPath).clone(true);
    //     }

    //     const loader = new THREE.TextureLoader();

    //     return new Promise((resolve, reject) => {
    //         loader.load(
    //             modelPath,
    //             (texture) => {
    //                 texture.colorSpace = THREE.SRGBColorSpace;

    //                 // --- Auto Background Removal ---
    //                 // If the user uploads a PNG/JPG with a solid background (e.g. white),
    //                 // we dynamically make it transparent by sampling the corners.
    //                 let finalTexture = texture;
    //                 try {
    //                     const canvas = document.createElement('canvas');
    //                     canvas.width = texture.image.width;
    //                     canvas.height = texture.image.height;
    //                     const ctx = canvas.getContext('2d');
    //                     ctx.drawImage(texture.image, 0, 0);
    //                     const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    //                     const data = imgData.data;

    //                     // Sample the 4 corners
    //                     const corners = [
    //                         [0, 0],
    //                         [canvas.width - 1, 0],
    //                         [0, canvas.height - 1],
    //                         [canvas.width - 1, canvas.height - 1]
    //                     ];

    //                     let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
    //                     for (const [cx, cy] of corners) {
    //                         const idx = (cy * canvas.width + cx) * 4;
    //                         bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; bgA += data[idx + 3];
    //                     }
    //                     bgR /= 4; bgG /= 4; bgB /= 4; bgA /= 4;

    //                     // If background is mostly opaque, run removal
    //                     if (bgA > 200) {
    //                         const tolerance = 25;
    //                         for (let i = 0; i < data.length; i += 4) {
    //                             const r = data[i], g = data[i + 1], b = data[i + 2];
    //                             // Euclidean distance is better, but Max diff is faster
    //                             const diff = Math.max(Math.abs(r - bgR), Math.abs(g - bgG), Math.abs(b - bgB));

    //                             if (diff <= tolerance) {
    //                                 // Make transparent
    //                                 data[i + 3] = 0;
    //                             }
    //                         }
    //                         ctx.putImageData(imgData, 0, 0);
    //                         finalTexture = new THREE.CanvasTexture(canvas);
    //                         finalTexture.colorSpace = THREE.SRGBColorSpace;
    //                     }
    //                 } catch (e) {
    //                     console.warn('[EnsureAR Renderer] Auto-bg removal failed (CORS?):', e);
    //                 }
    //                 // --------------------------------

    //                 const aspect = texture.image.width / texture.image.height;
    //                 const geometry = new THREE.PlaneGeometry(1.0 * aspect, 1.0);
    //                 const material = new THREE.MeshBasicMaterial({
    //                     map: finalTexture,
    //                     transparent: true,
    //                     side: THREE.DoubleSide,
    //                     depthWrite: false,
    //                     alphaTest: 0.05 // Discard tiny transparent artifacts
    //                 });

    //                 // Add an alpha fade to blur the top edge of the 2D model
    //                 material.onBeforeCompile = function (shader) {
    //                     shader.fragmentShader = shader.fragmentShader.replace(
    //                         '#include <dithering_fragment>',
    //                         [
    //                             '#include <dithering_fragment>',
    //                             '#ifdef USE_UV',
    //                             '  // Fade out alpha as UV y approaches 1.0 (top edge)',
    //                             '  gl_FragColor.a *= smoothstep(1.0, 0.85, vUv.y);',
    //                             '#endif'
    //                         ].join('\n')
    //                     );
    //                 };

    //                 const mesh = new THREE.Mesh(geometry, material);
    //                 const group = new THREE.Group();
    //                 group.add(mesh);

    //                 // FIX 4 — Now call normalizeAndWrap for consistent scale reference
    //                 const wrapper = normalizeAndWrap(group, 'top');

    //                 modelCache.set(modelPath, wrapper.clone(true));
    //                 console.log('[EnsureAR Renderer] Loaded PNG overlay:', modelPath);
    //                 resolve(wrapper);
    //             },
    //             undefined,
    //             (err) => {
    //                 console.error('[EnsureAR Renderer] PNG load error:', modelPath, err);
    //                 reject(err);
    //             }
    //         );
    //     });
    // }

    async function loadPNG(modelPath) {
        if (modelCache.has(modelPath)) {
            return modelCache.get(modelPath).clone(true);
        }
        console.log(THREE.REVISION, "sdzd");

        const loader = new THREE.TextureLoader();

        return new Promise((resolve, reject) => {

            loader.load(
                modelPath,

                (texture) => {

                    texture.colorSpace = THREE.SRGBColorSpace;

                    // Better texture quality
                    texture.generateMipmaps = true;
                    texture.minFilter = THREE.LinearMipmapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                    texture.needsUpdate = true;

                    let finalTexture = texture;

                    try {

                        const canvas = document.createElement("canvas");
                        canvas.width = texture.image.width;
                        canvas.height = texture.image.height;

                        const ctx = canvas.getContext("2d", {
                            willReadFrequently: true
                        });

                        ctx.drawImage(texture.image, 0, 0);

                        const img = ctx.getImageData(
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );

                        const d = img.data;

                        //--------------------------------------------------
                        // Sample 4 corners
                        //--------------------------------------------------

                        const corners = [
                            [0, 0],
                            [canvas.width - 1, 0],
                            [0, canvas.height - 1],
                            [canvas.width - 1, canvas.height - 1]
                        ];

                        let r = 0,
                            g = 0,
                            b = 0;

                        corners.forEach(([x, y]) => {
                            const i = (y * canvas.width + x) * 4;
                            r += d[i];
                            g += d[i + 1];
                            b += d[i + 2];
                        });

                        r /= 4;
                        g /= 4;
                        b /= 4;

                        //--------------------------------------------------
                        // Better background removal
                        //--------------------------------------------------

                        const tolerance = 32;
                        const feather = 20;

                        for (let i = 0; i < d.length; i += 4) {

                            const dr = d[i] - r;
                            const dg = d[i + 1] - g;
                            const db = d[i + 2] - b;

                            const dist = Math.sqrt(
                                dr * dr +
                                dg * dg +
                                db * db
                            );

                            if (dist < tolerance) {

                                d[i + 3] = 0;

                            } else if (dist < tolerance + feather) {

                                const alpha =
                                    (dist - tolerance) / feather;

                                d[i + 3] *= alpha;
                            }
                        }

                        ctx.putImageData(img, 0, 0);

                        finalTexture = new THREE.CanvasTexture(canvas);

                        finalTexture.colorSpace = THREE.SRGBColorSpace;
                        finalTexture.minFilter = THREE.LinearMipmapLinearFilter;
                        finalTexture.magFilter = THREE.LinearFilter;
                        finalTexture.generateMipmaps = true;

                    } catch (e) {

                        console.warn(e);

                    }

                    //------------------------------------------------------
                    // Geometry
                    //------------------------------------------------------

                    const aspect =
                        texture.image.width /
                        texture.image.height;

                    const geometry =
                        new THREE.PlaneGeometry(
                            aspect,
                            1,
                            1,
                            1
                        );

                    //------------------------------------------------------
                    // Material
                    //------------------------------------------------------

                    const material =
                        new THREE.MeshBasicMaterial({

                            map: finalTexture,

                            transparent: true,

                            side: THREE.DoubleSide,

                            depthWrite: false,

                            depthTest: true,

                            alphaTest: 0.02,

                            premultipliedAlpha: true

                        });

                    //------------------------------------------------------
                    // Soft neck fade
                    //------------------------------------------------------

                    material.onBeforeCompile = (shader) => {

                        shader.fragmentShader = shader.fragmentShader.replace(
                            '#include <dithering_fragment>',
                            `
        #ifdef USE_UV
            float fadeTop = smoothstep(1.0, 0.90, vUv.y);
            diffuseColor.a *= fadeTop;
        #endif

        #include <dithering_fragment>
        `
                        );

                    };

                    //------------------------------------------------------
                    // Mesh
                    //------------------------------------------------------

                    const mesh =
                        new THREE.Mesh(
                            geometry,
                            material
                        );

                    mesh.frustumCulled = false;

                    const group =
                        new THREE.Group();

                    group.add(mesh);

                    const wrapper =
                        normalizeAndWrap(
                            group,
                            "top"
                        );

                    modelCache.set(
                        modelPath,
                        wrapper.clone(true)
                    );

                    resolve(wrapper);

                },

                undefined,

                reject

            );

        });

    }
    /**
     * Load and activate a jewelry model for AR rendering.
     * Clears the previous model from the scene.
     *
     * @param {string} assetPath — web-relative path e.g. /models/necklace/abc.glb
     * @param {Object} modelMeta — catalog entry with scale, offset, rotationOffset
     * @param {string} category  — 'necklace' | 'earrings' | 'rings' | 'bracelets'
     */
    async function loadModel(assetPath, modelMeta, category) {
        if (!renderer) throw new Error('Renderer not initialised. Call init() first.');

        activeCategory = category ?? activeCategory;
        activeModelMeta = modelMeta;

        // Clear previous nodes
        clearNodes();
        Object.values(occluders).forEach(o => { if (o) o.visible = false; });
        earringLeft = null;
        earringRight = null;

        // Reset controllers so new model doesn't lerp from old position
        if (eyewearController) eyewearController.reset();
        if (necklaceController) necklaceController.reset();
        if (wristController) wristController.reset();
        if (ringController) ringController.reset();
        if (earringController) earringController.reset();

        // Reset clipping
        useClipPlane = false;
        currentNecklaceType = 'open';
        if (renderer) renderer.clippingPlanes = [];

        const ext = assetPath.toLowerCase().split('?')[0].split('.').pop();

        async function fetchModel() {
            if (ext === 'obj') return loadOBJ(assetPath, modelMeta?.mtlPath || null, modelMeta?.texturePath || null);
            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
                return loadPNG(assetPath);
            }
            return loadGLTF(assetPath); // Default: GLB / GLTF
        }

        if (category === 'earrings') {
            const [left, right] = await Promise.all([fetchModel(), fetchModel()]);
            earringLeft = left;
            earringRight = right;
            scene.add(earringLeft);
            scene.add(earringRight);
            activeNodes = [earringLeft, earringRight];
        } else {
            const model = await fetchModel();
            scene.add(model);
            activeNodes = [model];

            // FIX 7 — Detect necklace type and enable clipping for closed loops
            if (category === 'necklace') {
                currentNecklaceType = modelMeta?.necklaceType === 'closed' ? 'closed' : 'open';
                if (currentNecklaceType === 'closed') {
                    useClipPlane = true;
                    renderer.clippingPlanes = [neckClipPlane];
                    console.log('[EnsureAR Renderer] Closed necklace tagged in catalog — front clipping enabled.');
                }
            }
        }

        // Start the render loop if not already running
        if (!animationId) startLoop();

        // FIX 1 — was `glbPath` (undefined) — now uses correct variable name
        console.log('[EnsureAR Renderer] Model activated:', assetPath, category);
    }

    // ── Per-frame update ──────────────────────────────────────────────────────

    /**
     * Called every animation frame with latest landmark detection results.
     * Updates model position/rotation/scale, then renders.
     *
     * @param {Object|null} faceResult — FaceLandmarker result
     * @param {Object|null} handResult — HandLandmarker result
     * @param {Object|null} poseResult — PoseLandmarker result (for shoulder anchoring)
     * @param {number}      ts         — performance.now() timestamp
     */
    function updateFrame(faceResult, handResult, poseResult, ts) {
        if (!renderer || !scene || !camera) return;
        if (activeNodes.length === 0) {
            renderer.clear();
            return;
        }



        const w = videoEl.clientWidth || 640;
        const h = videoEl.clientHeight || 480;

        let missingTrackingMsg = null;
        let trackingIconMode = 'face';

        switch (activeCategory) {
            case 'necklace': {
                if (necklaceController && activeNodes[0]) {
                    const res = necklaceController.update(faceResult, poseResult, activeNodes[0], occluders.neck, activeModelMeta, w, h);
                    isFrozenByTooClose = res.tooClose;

                    if (!res.isTracking) {
                        missingTrackingMsg = res.missingMsg;
                        trackingIconMode = 'face';
                    }
                    if (useClipPlane && activeNodes[0].userData.neckCenter) {
                        neckClipPlane.normal.set(0, 0, 1);
                        neckClipPlane.constant = -(activeNodes[0].userData.neckCenter.z - activeNodes[0].userData.neckW * 0.10);
                    }
                }
                break;
            }
            case 'earrings': {
                if (earringController && (earringLeft || earringRight)) {
                    const res = earringController.update(faceResult, earringLeft, earringRight, activeModelMeta, w, h);
                    if (!res.isTracking) {
                        missingTrackingMsg = res.missingMsg;
                        trackingIconMode = 'face';
                    }
                }
                break;
            }
            case 'rings': {
                if (ringController && activeNodes[0]) {
                    const res = ringController.update(handResult, activeNodes[0], occluders.finger, activeModelMeta, w, h);
                    if (!res.isTracking) {
                        missingTrackingMsg = res.missingMsg || '✋ Show your hand to the camera';
                        trackingIconMode = 'hand';
                        hideNodes();
                    } else {
                        targetOpacity = 1.0;
                        if (occluders.finger) occluders.finger.visible = true; // Hide physical cylinder, rely on SAM2!
                        if (aiOcclusionUniforms) {
                            aiOcclusionUniforms.uCenterWorld.value = activeNodes[0].position.clone();
                        }
                    }
                }
                break;
            }
            case 'bracelets': {
                if (braceletController && activeNodes[0]) {
                    const res = braceletController.update(handResult, activeNodes[0], occluders.wrist, activeModelMeta, w, h);
                    if (!res.isTracking) {
                        missingTrackingMsg = res.missingMsg || '✋ Show your hand to the camera';
                        trackingIconMode = 'hand';
                        hideNodes();
                    } else {
                        targetOpacity = 1.0;
                    }
                }
                break;
            }
            case 'watch': {
                if (wristController && activeNodes[0]) {
                    const res = wristController.update(handResult, activeNodes[0], occluders.wrist, activeModelMeta, w, h);
                    if (!res.isTracking) {
                        missingTrackingMsg = res.missingMsg || '✋ Show your hand to the camera';
                        trackingIconMode = 'hand';
                        hideNodes();
                    } else {
                        targetOpacity = 1.0;
                    }
                }
                break;
            }
            case 'eyewear': {
                if (!faceResult?.faceLandmarks?.length) {
                    missingTrackingMsg = 'Face is not detected';
                    trackingIconMode = 'face';
                    hideNodes();
                    if (eyewearController) eyewearController.reset();
                    break;
                }

                if (eyewearController && activeNodes[0]) {
                    const isTracking = eyewearController.update(faceResult, activeNodes[0], occluders.head, activeModelMeta, w, h);

                    // Disable the geometric hard-cut occluder so our smooth temple fade shader can work
                    if (occluders.head) occluders.head.visible = false;

                    if (isTracking) {
                        targetOpacity = 1.0;
                    } else {
                        missingTrackingMsg = 'Face is too far or tracking lost';
                        trackingIconMode = 'face';
                        hideNodes();
                    }
                }
                break;
            }
        }

        // Apply unified overlay logic for all categories
        if (missingTrackingMsg) {
            showOverlay(true, missingTrackingMsg, trackingIconMode);

            // Hide the old text banner if it still exists
            if (trackingWarningMsg) trackingWarningMsg.style.display = 'none';
        } else {
            showOverlay(false);
            targetOpacity = 1.0; // Tracking restored
        }
    }

    function initOccluders() {
        // Occluder material — invisible but writes to the depth buffer.
        // Set window.DEBUG_OCCLUSION = true in the browser console to see them as red.
        function makeOccluderMat() {
            const dbg = !!global.DEBUG_OCCLUSION;
            return new THREE.MeshBasicMaterial({
                color: 0xff0000,
                opacity: 0.45,
                transparent: dbg,
                colorWrite: dbg,
                depthWrite: true,
            });
        }

        // IMPROVEMENT 8: tapered cylinder (narrower top, wider base) better
        // matches the anatomical neck shape vs the old uniform cylinder.
        // The mapper still applies the exact scale per-frame.
        const cylGeo = new THREE.CylinderGeometry(0.45, 0.55, 1, 32);

        // Head occluder for eyewear (ellipsoid)
        const headGeo = new THREE.SphereGeometry(1, 32, 32);
        // Make the head narrower (X scale) and deeper (Z scale)
        // so the temples extend naturally towards the ear before being occluded.
        headGeo.scale(0.85, 1.4, 1.2);
        // Push the occluder significantly back so it doesn't block the front frame
        headGeo.translate(0, 0.2, -1.4);


        // Finger occluder for rings (Ellipsoid)
        // 1 unit radius allows precise mathematical scaling in the mapper.
        // A sphere is used instead of a cylinder so the top/bottom cuts remain perfectly round 
        // and don't slice the ring with flat, sharp edges when the finger bends.
        const fingerGeo = new THREE.SphereGeometry(1, 32, 32);

        occluders.neck = new THREE.Mesh(cylGeo, makeOccluderMat());
        occluders.finger = new THREE.Mesh(fingerGeo, makeOccluderMat());
        occluders.wrist = new THREE.Mesh(cylGeo, makeOccluderMat());
        occluders.head = new THREE.Mesh(headGeo, makeOccluderMat());

        Object.values(occluders).forEach(o => {
            o.renderOrder = -1; // GUARANTEE occluders render before everything else
            o.depthTest = true;
            o.visible = false;
            scene.add(o);
        });
    }

    /** Toggle debug visualisation of occluder cylinders at runtime. */
    function setOcclusionDebug(enable) {
        global.DEBUG_OCCLUSION = enable;
        Object.values(occluders).forEach(o => {
            if (!o?.material) return;
            o.material.colorWrite = enable;
            o.material.transparent = enable;
            o.material.needsUpdate = true;
        });
        console.log('[EnsureAR Renderer] Occlusion debug:', enable ? 'ON (red cylinders)' : 'OFF');
    }

    // ── Debug helpers ──────────────────────────────────────────────────────────

    function setDebugMode(enable = true) {
        global.DEBUG_AR = enable;

        // Show/hide FPS display
        if (fpsDisplay) fpsDisplay.style.display = enable ? 'block' : 'none';

        // Remove any existing scene debug helpers
        debugHelpers.forEach(h => scene.remove(h));
        debugHelpers = [];

        // Tear down all category-specific debug UIs
        _teardownAllDebugSuites();

        if (enable) {
            // Add axis helper at scene center
            const axes = new THREE.AxesHelper(50);
            scene.add(axes);
            debugHelpers.push(axes);
            console.log('[EnsureAR Renderer] DEBUG_AR ON — FPS + axes + per-category landmark overlays active.');
        } else {
            console.log('[EnsureAR Renderer] DEBUG_AR OFF.');
        }
    }

    let debugObjects = [];
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
    // ── Debug: shared helper to hide all DOM debug objects when debug is off ────
    function hideDebugObjects() {
        debugObjects.forEach(o => {
            if (o instanceof HTMLElement) o.style.display = 'none';
            else if (o && 'visible' in o) o.visible = false;
        });
    }

    // ── Debug: teardown — removes all category UI overlays (called on disable) ──
    function _teardownAllDebugSuites() {
        ['_debugObjs', '_debugEarrings', '_debugRing', '_debugWrist'].forEach(key => {
            const suite = global[key];
            if (!suite) return;
            if (suite.ui?.parentNode) suite.ui.parentNode.removeChild(suite.ui);
            // Remove Three.js scene meshes/lines belonging to this suite
            Object.values(suite).forEach(obj => {
                if (obj && obj.isObject3D) {
                    scene.remove(obj);
                    obj.geometry?.dispose();
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material?.dispose();
                }
            });
            global[key] = null;
        });

        if (eyewearController) {
            eyewearController.teardown();
        }

        global._debugSuiteInited = false;
        global._debugEarringsInited = false;
        global._debugRingInited = false;
        global._debugWristInited = false;
        global._debugEyewearInited = false;
        debugObjects = [];
    }

    // ── Shared debug UI factory ────────────────────────────────────────────────
    function _makeDebugUI(id, pos = 'right') {
        const ui = document.createElement('div');
        ui.id = id;
        const side = pos === 'left' ? 'left:10px' : 'right:10px';
        ui.style.cssText = `position:absolute;top:10px;${side};background:rgba(0,0,0,0.75);color:#0f0;padding:8px 10px;font-family:monospace;font-size:11px;z-index:9999;pointer-events:none;border:1px solid #0f04;border-radius:4px;min-width:180px;`;
        (document.getElementById('camera-container') || document.body).appendChild(ui);
        debugObjects.push(ui);
        return ui;
    }

    // ── Shared debug sphere factory ────────────────────────────────────────────
    function _makeDebugSphere(color, r = 6) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(r, 8, 8),
            new THREE.MeshBasicMaterial({ color, depthTest: false })
        );
        mesh.renderOrder = 999;
        scene.add(mesh);
        debugHelpers.push(mesh);
        return mesh;
    }

    // ── Shared debug line factory ──────────────────────────────────────────────
    function _makeDebugLine(color) {
        const line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color, depthTest: false })
        );
        line.renderOrder = 999;
        scene.add(line);
        debugHelpers.push(line);
        return line;
    }

    // ── NECKLACE debug ─────────────────────────────────────────────────────────

    function drawAdvancedDebugHelpers(t, poseResult, w, h) {
        if (!global.DEBUG_AR || !t || !t.debugData) return;
        const d = t.debugData;

        // Lazy-init debug geometry/materials
        if (!global._debugSuiteInited) {
            global._debugSuiteInited = true;

            const meshLNeck = _makeDebugSphere(0xff0000);
            const meshRNeck = _makeDebugSphere(0xff0000);
            const meshAnchor = _makeDebugSphere(0x00ff00);
            const meshBase = _makeDebugSphere(0xffff00);

            const shoulderLine = _makeDebugLine(0xffffff);
            const splineLine = _makeDebugLine(0xaa00ff);

            const chestArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 100, 0x00aaff, 20, 10);
            chestArrow.line.material.depthTest = false;
            chestArrow.cone.material.depthTest = false;
            chestArrow.renderOrder = 999;
            scene.add(chestArrow);
            debugHelpers.push(chestArrow);

            const boxHelper = new THREE.BoxHelper(new THREE.Group(), 0xffaa00);
            boxHelper.material.depthTest = false;
            boxHelper.renderOrder = 999;
            scene.add(boxHelper);
            debugHelpers.push(boxHelper);

            const ui = _makeDebugUI('ar-debug-necklace');

            global._debugObjs = { meshLNeck, meshRNeck, meshAnchor, meshBase, shoulderLine, splineLine, chestArrow, boxHelper, ui };
        }

        const objs = global._debugObjs;
        if (!objs) return;

        // Show all scene objects
        [objs.meshLNeck, objs.meshRNeck, objs.meshAnchor, objs.meshBase,
        objs.shoulderLine, objs.splineLine, objs.chestArrow, objs.boxHelper].forEach(o => o.visible = true);

        // Position Spheres
        objs.meshLNeck.position.copy(d.leftNeckSide);
        objs.meshRNeck.position.copy(d.rightNeckSide);
        objs.meshAnchor.position.copy(t.model.position);
        objs.meshBase.position.copy(d.neckBase);

        // Shoulder Line
        const leftS = d.midShoulder.clone().sub(new THREE.Vector3(200, 0, 0));
        const rightS = d.midShoulder.clone().add(new THREE.Vector3(200, 0, 0));
        objs.shoulderLine.geometry.setFromPoints([leftS, rightS]);

        // Chest Normal Arrow
        objs.chestArrow.position.copy(d.midShoulder);
        objs.chestArrow.setDirection(d.chestNormal);

        // Neck Curve Spline
        const curve = new THREE.CatmullRomCurve3([d.leftNeckSide, d.neckBase, d.rightNeckSide]);
        objs.splineLine.geometry.setFromPoints(curve.getPoints(20));

        // Bounding Box
        if (activeNodes[0]) {
            objs.boxHelper.setFromObject(activeNodes[0]);
            objs.boxHelper.update();
        }

        // UI Overlay
        const anchorPos = t.model.position;
        objs.ui.style.display = 'block';
        objs.ui.innerHTML = `
            <div style="color:#ff0;font-weight:bold;margin-bottom:4px">🔴 NECKLACE DEBUG</div>
            <div>Anchor  X: ${anchorPos.x.toFixed(1)}</div>
            <div>Anchor  Y: ${anchorPos.y.toFixed(1)}</div>
            <div>Anchor  Z: ${anchorPos.z.toFixed(1)}</div>
            <div>Scale X:  ${t.model.scale.x.toFixed(1)}</div>
            <div>Velocity:  ${(t.velocity ?? 0).toFixed(2)} px/f</div>
            <div>Proxy:     ${t.usingProxy ? '<span style="color:#fa0">YES</span>' : 'no'}</div>
            <div>TooClose:  ${t.tooClose ? '<span style="color:#f00">YES</span>' : 'no'}</div>
            <div>CatalogScale: ${typeof d.catalogScale === 'number' ? d.catalogScale.toFixed(3) : 'N/A'}</div>
        `;
    }

    // ── EARRINGS debug ─────────────────────────────────────────────────────────

    function drawDebugEarrings(pairs, faceResult, w, h) {
        if (!global.DEBUG_AR || !pairs) return;

        if (!global._debugEarringsInited) {
            global._debugEarringsInited = true;

            const meshL = _makeDebugSphere(0xff66cc);   // pink — left ear
            const meshR = _makeDebugSphere(0xff66cc);   // pink — right ear
            const meshAnchorL = _makeDebugSphere(0x00ff88, 5);
            const meshAnchorR = _makeDebugSphere(0x00ff88, 5);
            const ui = _makeDebugUI('ar-debug-earrings');

            global._debugEarrings = { meshL, meshR, meshAnchorL, meshAnchorR, ui };
        }

        const objs = global._debugEarrings;
        if (!objs) return;

        // Show all
        [objs.meshL, objs.meshR, objs.meshAnchorL, objs.meshAnchorR].forEach(o => o.visible = true);

        if (pairs.left?.model?.position) objs.meshAnchorL.position.copy(pairs.left.model.position);
        if (pairs.right?.model?.position) objs.meshAnchorR.position.copy(pairs.right.model.position);

        // Raw earlobe landmarks mapped to world
        const LM = global.EnsureAR?.Landmarker;
        const FACE = LM?.FACE;
        if (LM && FACE && faceResult?.faceLandmarks?.length) {
            const lEar = LM.getFaceLandmark(faceResult, FACE.LEFT_EAR);
            const rEar = LM.getFaceLandmark(faceResult, FACE.RIGHT_EAR);
            if (lEar) objs.meshL.position.set((1 - lEar.x - 0.5) * w, -(lEar.y - 0.5) * h, lEar.z * 200);
            if (rEar) objs.meshR.position.set((1 - rEar.x - 0.5) * w, -(rEar.y - 0.5) * h, rEar.z * 200);
        }

        const lPos = pairs.left?.model?.position;
        const scl = pairs.left?.model?.scale?.x;
        objs.ui.style.display = 'block';
        objs.ui.innerHTML = `
            <div style="color:#ff66cc;font-weight:bold;margin-bottom:4px">💎 EARRINGS DEBUG</div>
            <div>L Anchor X: ${lPos ? lPos.x.toFixed(1) : 'N/A'}</div>
            <div>L Anchor Y: ${lPos ? lPos.y.toFixed(1) : 'N/A'}</div>
            <div>R Anchor X: ${pairs.right?.model?.position ? pairs.right.model.position.x.toFixed(1) : 'N/A'}</div>
            <div>R Anchor Y: ${pairs.right?.model?.position ? pairs.right.model.position.y.toFixed(1) : 'N/A'}</div>
            <div>Scale:      ${scl != null ? scl.toFixed(1) : 'N/A'} px</div>
        `;
    }

    // ── RING debug ─────────────────────────────────────────────────────────────

    function drawDebugRing(t, handResult, w, h) {
        if (!global.DEBUG_AR || !t) return;

        if (!global._debugRingInited) {
            global._debugRingInited = true;

            const meshAnchor = _makeDebugSphere(0x00ffff, 7);  // cyan — ring anchor
            const meshMCP = _makeDebugSphere(0xff8800, 5);  // orange — MCP joint
            const meshPIP = _makeDebugSphere(0xff8800, 5);  // orange — PIP joint
            const fingerLine = _makeDebugLine(0xffffff);
            const ui = _makeDebugUI('ar-debug-ring', 'left');

            global._debugRing = { meshAnchor, meshMCP, meshPIP, fingerLine, ui };
        }

        const objs = global._debugRing;
        if (!objs) return;

        [objs.meshAnchor, objs.meshMCP, objs.meshPIP, objs.fingerLine].forEach(o => o.visible = true);

        objs.meshAnchor.position.copy(t.model.position);

        // Draw MCP and PIP joint positions from raw landmarks
        const LM = global.EnsureAR?.Landmarker;
        const HAND = LM?.HAND;
        if (LM && HAND && handResult?.landmarks?.length) {
            const toW = (lm) => new THREE.Vector3((1 - lm.x - 0.5) * w, -(lm.y - 0.5) * h, lm.z * 200);
            const mcpRaw = LM.getHandLandmark(handResult, HAND.RING_MCP, 0);
            const pipRaw = LM.getHandLandmark(handResult, HAND.RING_PIP, 0);
            if (mcpRaw) { const p = toW(mcpRaw); objs.meshMCP.position.copy(p); }
            if (pipRaw) { const p = toW(pipRaw); objs.meshPIP.position.copy(p); }
            if (mcpRaw && pipRaw) {
                objs.fingerLine.geometry.setFromPoints([toW(mcpRaw), toW(pipRaw)]);
            }
        }

        const pos = t.model.position;
        const scl = t.model.scale;
        objs.ui.style.display = 'block';
        objs.ui.innerHTML = `
            <div style="color:#00ffff;font-weight:bold;margin-bottom:4px">💍 RING DEBUG</div>
            <div>Anchor X: ${pos.x.toFixed(1)}</div>
            <div>Anchor Y: ${pos.y.toFixed(1)}</div>
            <div>Anchor Z: ${pos.z.toFixed(1)}</div>
            <div>Scale:    ${scl.x.toFixed(1)} px</div>
            <div>Hand: ${handResult?.handedness?.[0]?.[0]?.categoryName ?? 'N/A'}</div>
        `;
    }

    // ── BRACELET / WATCH debug ─────────────────────────────────────────────────

    function drawDebugWrist(t, handResult, w, h, label = 'Bracelet') {
        if (!global.DEBUG_AR || !t) return;

        if (!global._debugWristInited) {
            global._debugWristInited = true;

            const meshWrist = _makeDebugSphere(0xffaa00, 9);  // amber — wrist
            const meshAnchor = _makeDebugSphere(0x00ff44, 6); // green — final anchor
            const meshMid = _makeDebugSphere(0xffffff, 4);  // white — middle MCP
            const wristLine = _makeDebugLine(0xffaa00);
            const ui = _makeDebugUI('ar-debug-wrist', 'left');

            global._debugWrist = { meshWrist, meshAnchor, meshMid, wristLine, ui };
        }

        const objs = global._debugWrist;
        if (!objs) return;

        [objs.meshWrist, objs.meshAnchor, objs.meshMid, objs.wristLine].forEach(o => o.visible = true);

        objs.meshAnchor.position.copy(t.model.position);

        const LM = global.EnsureAR?.Landmarker;
        const HAND = LM?.HAND;
        if (LM && HAND && handResult?.landmarks?.length) {
            const toW = (lm) => new THREE.Vector3((1 - lm.x - 0.5) * w, -(lm.y - 0.5) * h, lm.z * 200);
            const wristRaw = LM.getHandLandmark(handResult, HAND.WRIST, 0);
            const midRaw = LM.getHandLandmark(handResult, HAND.MIDDLE_MCP, 0);
            if (wristRaw) { const p = toW(wristRaw); objs.meshWrist.position.copy(p); }
            if (midRaw) { const p = toW(midRaw); objs.meshMid.position.copy(p); }
            if (wristRaw && midRaw) {
                objs.wristLine.geometry.setFromPoints([toW(wristRaw), toW(midRaw)]);
            }
        }

        const pos = t.model.position;
        const scl = t.model.scale;
        objs.ui.style.display = 'block';
        objs.ui.innerHTML = `
            <div style="color:#ffaa00;font-weight:bold;margin-bottom:4px">⌚ ${label.toUpperCase()} DEBUG</div>
            <div>Anchor X: ${pos.x.toFixed(1)}</div>
            <div>Anchor Y: ${pos.y.toFixed(1)}</div>
            <div>Anchor Z: ${pos.z.toFixed(1)}</div>
            <div>Scale:    ${scl.x.toFixed(1)} px</div>
            <div>Hand: ${handResult?.handedness?.[0]?.[0]?.categoryName ?? 'N/A'}</div>
        `;
    }

    /**
     * Registers a new target transform on a Three.js Object3D.
     * On the very first call the node snaps to target to avoid initial glide.
     * Subsequent frames smoothly lerp/slerp toward the target using per-category
     * alpha values — rings track tightly, necklaces track smoothly.
     */
    /**
     * applyTransform v6.0
     *
     * IMPROVEMENT 3 — Freeze support:
     *   When isFrozenByTooClose is true the function does NOT update the target
     *   transform.  The node stays at its last known good position so the
     *   necklace appears frozen while the too-close overlay is shown.
     *   We always store a frozenTransform on every valid (non-frozen) frame
     *   so recovery is instant — no lerp-from-zero on resume.
     *
     * IMPROVEMENT 6 — Velocity stored per-node:
     *   node.userData.velocity is written here so the animation loop can use it
     *   to compute an adaptive lerp alpha (tight tracking during fast movement,
     *   smooth during slow movement).
     */
    function applyTransform(node, t, category) {
        if (!node || !t?.position || !t?.quaternion || !t?.scale) return;

        const alpha = LERP_ALPHA[category] ?? LERP_ALPHA.necklace;

        if (isFrozenByTooClose) {
            // IMPROVEMENT 3: frozen — use last good transform, do not update target
            if (node.userData.frozenTransform && node.userData.target) {
                node.userData.target.position.copy(node.userData.frozenTransform.position);
                node.userData.target.quaternion.copy(node.userData.frozenTransform.quaternion);
                node.userData.target.scale.copy(node.userData.frozenTransform.scale);
            }
            node.visible = true;
            return;
        }

        if (!node.userData.target) {
            // First frame: snap to prevent the model flying in from (0,0,0)
            node.position.copy(t.position);
            node.quaternion.copy(t.quaternion);
            node.scale.copy(t.scale);
            node.userData.target = {
                position: t.position.clone(),
                quaternion: t.quaternion.clone(),
                scale: t.scale.clone(),
                alpha,
            };
        } else {
            node.userData.target.position.copy(t.position);
            node.userData.target.quaternion.copy(t.quaternion);
            node.userData.target.scale.copy(t.scale);
            node.userData.target.alpha = alpha;
        }

        // Store frozen transform (last good frame) so we can restore it on freeze
        if (!node.userData.frozenTransform) {
            node.userData.frozenTransform = {
                position: t.position.clone(),
                quaternion: t.quaternion.clone(),
                scale: t.scale.clone(),
            };
        } else {
            node.userData.frozenTransform.position.copy(t.position);
            node.userData.frozenTransform.quaternion.copy(t.quaternion);
            node.userData.frozenTransform.scale.copy(t.scale);
        }

        node.visible = true;
    }


    function hideNodes() {
        targetOpacity = 0.0;
    }

    // ── Animation loop ────────────────────────────────────────────────────────

    function startLoop() {
        if (animationId) return;

        let frameCount = 0;
        const LM = global.EnsureAR?.Landmarker;

        function loop() {
            animationId = requestAnimationFrame(loop);
            frameCount++;

            const ts = performance.now();

            if (!LM?.isReady || !videoEl) return;

            // Detect every 2nd frame (30 fps detection @ 60 fps render)
            if (frameCount % 2 === 0) {
                const { face, hands, pose } = LM.detect(videoEl, ts);
                updateFrame(face, hands, pose, ts);
            }

            // Part 5: Opacity lerp (Fade on tracking loss)
            currentOpacity += (targetOpacity - currentOpacity) * 0.15;
            if (Math.abs(targetOpacity - currentOpacity) < 0.01) {
                currentOpacity = targetOpacity;
            }

            // IMPROVEMENT 1/6: Adaptive lerp alpha based on velocity.
            // When the necklace needs to travel a large distance (fast head move),
            // we temporarily raise the lerp alpha so it catches up without lag.
            // When it's nearly stationary we use the smooth baseline alpha.
            function adaptiveAlpha(baseAlpha, velocityPx) {
                // velocityPx: pixels/frame from mapper
                // Ramp: 0px => base, 20px => 2x base, capped at 0.80
                const boost = Math.min(velocityPx / 20.0, 1.0);
                return Math.min(baseAlpha + boost * (0.80 - baseAlpha), 0.80);
            }

            // IMPROVEMENT 4: advance sparkle clock once per frame
            if (sparkleClock && sparkleUniforms) {
                sparkleUniforms.uTime.value = sparkleClock.getElapsedTime();
            }

            // Per-category lerp/slerp using stored alpha values (now only opacity)
            const allNodes = activeNodes;
            for (var ni = 0; ni < allNodes.length; ni++) {
                var node = allNodes[ni];
                if (!node) continue;

                if (currentOpacity === 0 && targetOpacity === 0) {
                    node.visible = false;
                    continue;
                }

                // Node visibility is managed by controllers, but we force it true if fading
                if (currentOpacity > 0) node.visible = true;

                // Apply opacity fade
                node.traverse(child => {
                    if (child.isMesh && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            if (m.userData.origTrans === undefined) m.userData.origTrans = !!m.transparent;
                            m.transparent = currentOpacity < 1.0 ? true : m.userData.origTrans;
                            m.opacity = currentOpacity;
                        });
                    }
                });

                // IMPROVEMENT 5: apply neck warp AFTER filters (for necklace only)
                if (node.userData.warpParams && activeNodes[0] === node) {
                    var wp = node.userData.warpParams;
                    node.scale.x *= wp.sideStretch;
                    node.scale.z *= wp.curvature;
                }
            }

            // --- Dynamic AI Occlusion Updates ---
            if (global.depthEstimator && activeCategory !== 'eyewear') {
                global.depthEstimator.estimateDepth(videoEl).then(tex => {
                    if (tex && aiOcclusionUniforms) {
                        aiOcclusionUniforms.uDepthMap.value = tex;
                        aiOcclusionUniforms.uEnableDepth.value = true;
                    }
                });
            }
            if (global.samSegmenter && activeNodes[0] && activeNodes[0].visible && activeCategory !== 'eyewear') {
                // Convert 3D world position to normalized 2D screen coordinate for SAM prompt
                const pos = activeNodes[0].position.clone();
                pos.project(camera);
                const px = (pos.x + 1) / 2;
                const py = 1 - (pos.y + 1) / 2;

                global.samSegmenter.segment(videoEl, [px, py]).then(tex => {
                    if (tex && aiOcclusionUniforms) {
                        aiOcclusionUniforms.uMaskMap.value = tex;
                        aiOcclusionUniforms.uEnableMask.value = true;
                    }
                });
            }

            // --- Update Eyewear Temple Fade ---
            if (activeCategory === 'eyewear' && activeNodes[0]) {
                eyewearFadeUniforms.uHeadPos.value.copy(activeNodes[0].position);
                // Three.js object +Z is "forward" (out of the screen). 
                // The temples go backward (into the screen), which is -Z.
                activeNodes[0].getWorldDirection(eyewearFadeUniforms.uHeadForward.value);

                // Scale the fade thresholds based on the actual face size on screen.
                // activeNodes[0].scale.x represents the estimated face width in pixels.
                // We start fading at 60% of face width behind the nose, and completely disappear at 150%.
                const faceWidth = activeNodes[0].scale.x;
                eyewearFadeUniforms.uFadeStart.value = -0.20 * faceWidth;
                eyewearFadeUniforms.uFadeEnd.value = -0.60 * faceWidth;
            }

            if (renderer && scene && camera) renderer.render(scene, camera);

            // Debug FPS counter
            if (global.DEBUG_AR && fpsDisplay) {
                fpsFrames++;
                if (ts - fpsLastTime >= 1000) {
                    fpsDisplay.textContent = `FPS: ${fpsFrames}`;
                    fpsFrames = 0;
                    fpsLastTime = ts;
                }
            }
        }

        loop();
        console.log('[EnsureAR Renderer] Animation loop started.');
    }

    function stopLoop() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // ── Clear / cleanup ───────────────────────────────────────────────────────

    function clearNodes() {
        activeNodes.forEach(n => { if (n) scene.remove(n); });
        activeNodes = [];
        earringLeft = null;
        earringRight = null;
        if (renderer && scene && camera) renderer.clear();
    }

    function clear() {
        clearNodes();
        activeModelMeta = null;
        useClipPlane = false;
        if (renderer) renderer.clippingPlanes = [];
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Renderer = {
        init,
        loadModel,
        updateFrame,
        setCategory(cat) { activeCategory = cat; },
        clear,
        stopLoop,
        startLoop,
        setOcclusionDebug,    // setOcclusionDebug(true/false) in browser console
        setDebugMode,         // setDebugMode(true) — FPS + anchor + axes
        get isReady() { return !!renderer; },
        get scene() { return scene; },
        get necklaceType() { return currentNecklaceType; },
    };

    console.log('[EnsureAR Renderer] Module loaded (v6.0 - Sparkle+TooClose+AdaptiveLerp+NeckWarp).');

})(window);
