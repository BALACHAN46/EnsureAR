(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Shared = global.EnsureAR.Shared || {};

    // Shared DOM panel — only one debug overlay is needed on screen at a time.
    // This is reused across all HandDebugRenderer instances.
    let _sharedUI = null;

    function _getOrCreateUI() {
        if (_sharedUI) return _sharedUI;
        let ui = document.getElementById('ar-debug-hand');
        if (!ui) {
            ui = document.createElement('div');
            ui.id = 'ar-debug-hand';
            ui.style.cssText = `
                position: absolute; top: 10px; left: 10px;
                background: rgba(0,0,0,0.7); color: #fff; font-family: monospace; font-size: 11px;
                padding: 10px; border-radius: 6px; border: 1px solid #444;
                pointer-events: none; z-index: 1000; display: none; min-width: 160px;
                text-align: left;
            `;
            document.body.appendChild(ui);
        }
        _sharedUI = ui;
        return ui;
    }

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

    global.EnsureAR.Shared.HandDebugRenderer = class HandDebugRenderer {
        constructor(scene) {
            this.scene = scene;
            // Each instance gets its own Three.js scene objects (spheres/lines).
            // The DOM panel is shared across instances via _sharedUI.
            this._initSceneObjects();
        }

        _initSceneObjects() {
            // Lazily access the shared UI — DOM may not be ready at construction time.
            this._getUI = () => _getOrCreateUI();

            this.spheres = {
                wrist:  _makeSphere(0xff0000, 5),   // Red
                mid:    _makeSphere(0x00ff00, 5),   // Green
                idx:    _makeSphere(0x0000ff, 5),   // Blue
                pky:    _makeSphere(0xffff00, 5),   // Yellow
                mcp:    _makeSphere(0xff00ff, 5),   // Magenta
                pip:    _makeSphere(0x00ffff, 5),   // Cyan
                anchor: _makeSphere(0xffffff, 7),   // White
            };

            this.lines = {
                arm:    _makeLine(0xffaa00),         // Orange
                finger: _makeLine(0x00ffff),         // Cyan
            };

            Object.values(this.spheres).forEach(m => this.scene.add(m));
            Object.values(this.lines).forEach(l => this.scene.add(l));
        }

        draw(mapData, anchorPos, category) {
            if (!mapData) {
                this.hide();
                return;
            }

            Object.values(this.spheres).forEach(o => o.visible = false);
            Object.values(this.lines).forEach(o => o.visible = false);

            if (mapData.wristW) {
                this.spheres.wrist.position.copy(mapData.wristW);
                this.spheres.wrist.visible = true;
            }
            if (mapData.idxW) {
                this.spheres.idx.position.copy(mapData.idxW);
                this.spheres.idx.visible = true;
            }
            if (mapData.pkyW) {
                this.spheres.pky.position.copy(mapData.pkyW);
                this.spheres.pky.visible = true;
            }

            if (category === 'watch' || category === 'bracelets') {
                if (mapData.midW) {
                    this.spheres.mid.position.copy(mapData.midW);
                    this.spheres.mid.visible = true;
                    this.lines.arm.geometry.setFromPoints([mapData.wristW, mapData.midW]);
                    this.lines.arm.visible = true;
                }
            } else if (category === 'rings') {
                if (mapData.mcpW && mapData.pipW) {
                    this.spheres.mcp.position.copy(mapData.mcpW);
                    this.spheres.mcp.visible = true;
                    this.spheres.pip.position.copy(mapData.pipW);
                    this.spheres.pip.visible = true;
                    this.lines.finger.geometry.setFromPoints([mapData.mcpW, mapData.pipW]);
                    this.lines.finger.visible = true;
                }
            }

            if (anchorPos) {
                this.spheres.anchor.position.copy(anchorPos);
                this.spheres.anchor.visible = true;
            }

            const ui = this._getUI();
            ui.style.display = 'block';
            ui.innerHTML = `
                <div style="color:#ffaa00;font-weight:bold;margin-bottom:8px">✋ HAND DEBUG (${category.toUpperCase()})</div>
                <div style="margin-bottom:4px;color:#33ff33">Status: TRACKING</div>
                <div style="color:#aaa">Anchor X: ${anchorPos ? anchorPos.x.toFixed(1) : 'N/A'}</div>
                <div style="color:#aaa">Anchor Y: ${anchorPos ? anchorPos.y.toFixed(1) : 'N/A'}</div>
                <div style="color:#aaa">Anchor Z: ${anchorPos ? anchorPos.z.toFixed(1) : 'N/A'}</div>
            `;
        }

        hide() {
            if (this.spheres) Object.values(this.spheres).forEach(o => o.visible = false);
            if (this.lines)   Object.values(this.lines).forEach(o => o.visible = false);
            const ui = this._getUI?.();
            if (ui) ui.style.display = 'none';
        }
    };
})(window);
