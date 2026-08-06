(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.AI = global.EnsureAR.AI || {};

    /**
     * Handles dynamic semantic occlusion using a lightweight SAM model via Transformers.js.
     * Takes point prompts from MediaPipe landmarks to segment the target body part (e.g., wrist).
     */
    global.EnsureAR.AI.SamSegmenter = class SamSegmenter {
        constructor() {
            this.samPipeline = null;
            this.isInitializing = false;
            this.isReady = false;
            
            this.maskTexture = null;
            this.lastFrameTime = 0;
            this.fpsLimit = 5; // Cap to 5 FPS because SAM is very heavy
        }

        async initialize() {
            if (this.isInitializing || this.isReady) return;
            this.isInitializing = true;

            try {
                let retries = 0;
                while (!global.Transformers && retries < 20) {
                    await new Promise(r => setTimeout(r, 100));
                    retries++;
                }

                if (!global.Transformers) {
                    throw new Error("Transformers.js failed to load.");
                }

                console.log('[SamSegmenter] Loading SlimSAM...');
                
                // Using Xenova's SlimSAM for web performance
                this.samPipeline = await global.Transformers.pipeline(
                    'image-segmentation', 
                    'Xenova/slimsam-77-uniform',
                    {
                        device: 'webgpu',
                        dtype: 'fp16'
                    }
                );

                this.isReady = true;
                console.log('[SamSegmenter] Model loaded successfully.');
            } catch (err) {
                console.error('[SamSegmenter] Failed to load model:', err);
            } finally {
                this.isInitializing = false;
            }
        }

        /**
         * @param {HTMLVideoElement|HTMLCanvasElement} videoSource 
         * @param {Array<number>} inputPoints [x, y] in normalized coordinates
         */
        async segment(videoSource, inputPoints) {
            if (!this.isReady || !this.samPipeline || !inputPoints) return null;

            const now = performance.now();
            if (now - this.lastFrameTime < (1000 / this.fpsLimit)) {
                return this.maskTexture;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = videoSource.videoWidth || videoSource.width;
                canvas.height = videoSource.videoHeight || videoSource.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(videoSource, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const rawImg = new global.Transformers.RawImage(imageData.data, canvas.width, canvas.height, 4);

                // Convert normalized point to pixel point
                const px = Math.floor(inputPoints[0] * canvas.width);
                const py = Math.floor(inputPoints[1] * canvas.height);

                // Run inference with point prompt
                const result = await this.samPipeline(rawImg, {
                    points: [[[px, py]]], // Batch 1, Point 1
                    labels: [[1]] // Positive prompt
                });
                
                // result is an array of objects with .mask (RawImage) and .score
                if (result && result.length > 0) {
                    const bestMask = result.reduce((prev, current) => (prev.score > current.score) ? prev : current);
                    this._updateMaskTexture(bestMask.mask);
                    this.lastFrameTime = performance.now();
                }

                return this.maskTexture;
            } catch (err) {
                console.error('[SamSegmenter] Inference error:', err);
                return null;
            }
        }

        _updateMaskTexture(maskRawImage) {
            if (!global.THREE) return;

            const width = maskRawImage.width;
            const height = maskRawImage.height;
            const data = maskRawImage.data; // usually 1 channel, Uint8Array (0-255 or 0-1)

            // Convert to 255 if it's 0-1 binary mask
            const uint8Data = new Uint8Array(width * height);
            let needsMultiplier = false;
            if (data.length > 0 && data[0] <= 1) needsMultiplier = true;

            for (let i = 0; i < data.length; i++) {
                uint8Data[i] = needsMultiplier ? data[i] * 255 : data[i];
            }

            if (!this.maskTexture) {
                this.maskTexture = new global.THREE.DataTexture(
                    uint8Data,
                    width,
                    height,
                    global.THREE.RedFormat,
                    global.THREE.UnsignedByteType
                );
            } else {
                this.maskTexture.image.data = uint8Data;
                this.maskTexture.image.width = width;
                this.maskTexture.image.height = height;
            }

            this.maskTexture.needsUpdate = true;
        }
    };
})(window);
