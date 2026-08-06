(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    let isInitialized = false;

    // Helpers
    function _makeSphere(color, size) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true })
        );
        mesh.renderOrder = 999;
        return mesh;
    }

    function _makeLine(color) {
        const mat = new THREE.LineBasicMaterial({ color, depthTest: false, linewidth: 2 });
        const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 998;
        return line;
    }

    function _makeUI() {
        const ui = document.createElement('div');
        ui.id = 'ar-debug-eyewear';
        ui.style.cssText = `
            position: absolute; top: 10px; right: 10px;
            background: rgba(0,0,0,0.7); color: #fff; font-family: monospace; font-size: 11px;
            padding: 10px; border-radius: 6px; border: 1px solid #444;
            pointer-events: none; z-index: 1000; display: none; min-width: 160px;
            text-align: left;
        `;
        document.body.appendChild(ui);
        return ui;
    }

    global.EnsureAR.Eyewear.DebugRenderer = class DebugRenderer {
        constructor(scene) {
            this.scene = scene;
            this.init();
        }

        init() {
            if (isInitialized) return;
            isInitialized = true;

            this.meshAnchor = _makeSphere(0x88ddff, 7);  // sky blue
            this.meshEyeL = _makeSphere(0xffffff, 5);    // white
            this.meshEyeR = _makeSphere(0xffffff, 5);    // white
            this.meshBridge = _makeSphere(0xffff00, 5);  // yellow
            this.meshFaceL = _makeSphere(0xff00ff, 4);   // magenta
            this.meshFaceR = _makeSphere(0xff00ff, 4);   // magenta
            
            this.bridgeLine = _makeLine(0x88ddff);
            this.faceLine = _makeLine(0xff00ff);
            this.ui = _makeUI();

            this.scene.add(this.meshAnchor);
            this.scene.add(this.meshEyeL);
            this.scene.add(this.meshEyeR);
            this.scene.add(this.meshBridge);
            this.scene.add(this.meshFaceL);
            this.scene.add(this.meshFaceR);
            this.scene.add(this.bridgeLine);
            this.scene.add(this.faceLine);

            global._debugEyewearObj = this; // Hook for general teardown if needed
        }

        draw(landmarks, anchorPos, scale, W, H) {
            const videoEl = document.querySelector('video');
            let dW = W, dH = H;
            if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                const s = Math.max(W / videoEl.videoWidth, H / videoEl.videoHeight);
                dW = videoEl.videoWidth * s;
                dH = videoEl.videoHeight * s;
            }
            const toW = (lm) => new THREE.Vector3((1 - lm.x - 0.5) * dW, -(lm.y - 0.5) * dH, lm.z * -200);

            [this.meshAnchor, this.meshEyeL, this.meshEyeR, this.meshBridge, this.meshFaceL, this.meshFaceR, this.bridgeLine, this.faceLine].forEach(o => o.visible = true);

            this.meshAnchor.position.copy(anchorPos);
            this.meshEyeL.position.copy(toW(landmarks.leftEyeCenter));
            this.meshEyeR.position.copy(toW(landmarks.rightEyeCenter));
            this.meshBridge.position.copy(toW(landmarks.noseBridge));
            this.meshFaceL.position.copy(toW(landmarks.faceLeft));
            this.meshFaceR.position.copy(toW(landmarks.faceRight));

            this.bridgeLine.geometry.setFromPoints([toW(landmarks.leftEyeCenter), toW(landmarks.rightEyeCenter)]);
            this.faceLine.geometry.setFromPoints([toW(landmarks.faceLeft), toW(landmarks.faceRight)]);

            this.ui.style.display = 'block';
            this.ui.innerHTML = `
                <div style="color:#88ddff;font-weight:bold;margin-bottom:8px">👓 EYEWEAR DEBUG</div>
                <div style="margin-bottom:4px;color:${landmarks.isBlinking ? '#ff3333' : '#33ff33'}">
                    Status: ${landmarks.isBlinking ? 'BLINKING (Frozen)' : 'TRACKING'}
                </div>
                <div style="color:#33ff33;margin-top:10px">Anchor X: ${anchorPos.x.toFixed(1)}</div>
                <div style="color:#33ff33">Anchor Y: ${anchorPos.y.toFixed(1)}</div>
                <div style="color:#33ff33">Anchor Z: ${anchorPos.z.toFixed(1)}</div>
                <div style="color:#33ff33;margin-top:10px">Scale: ${scale.toFixed(1)} px</div>
            `;
        }

        hide() {
            [this.meshAnchor, this.meshEyeL, this.meshEyeR, this.meshBridge, this.meshFaceL, this.meshFaceR, this.bridgeLine, this.faceLine].forEach(o => o.visible = false);
            if (this.ui) this.ui.style.display = 'none';
        }

        teardown() {
            this.hide();
            [this.meshAnchor, this.meshEyeL, this.meshEyeR, this.meshBridge, this.meshFaceL, this.meshFaceR, this.bridgeLine, this.faceLine].forEach(o => {
                this.scene.remove(o);
                o.geometry?.dispose();
                o.material?.dispose();
            });
            if (this.ui?.parentNode) this.ui.parentNode.removeChild(this.ui);
            isInitialized = false;
        }
    };
})(window);
