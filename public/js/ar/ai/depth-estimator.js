(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.AI = global.EnsureAR.AI || {};

    /**
     * Handles dynamic occlusion using a depth-estimation model via Transformers.js.
     * Generates a grayscale depth map texture from the video feed.
     */
    global.EnsureAR.AI.DepthEstimator = class DepthEstimator {
        constructor() {
            this.depthPipeline = null;
            this.isInitializing = false;
            this.isReady = false;
            
            // WebGL texture for the depth map
            this.depthTexture = null;
            this.lastFrameTime = 0;
            this.fpsLimit = 15; // Cap to 15 FPS to avoid freezing the browser
        }

        async initialize() {
            if (this.isInitializing || this.isReady) return;
            this.isInitializing = true;

            try {
                // Wait for the CDN script to load the Transformers object
                let retries = 0;
                while (!global.Transformers && retries < 20) {
                    await new Promise(r => setTimeout(r, 100));
                    retries++;
                }

                if (!global.Transformers) {
                    throw new Error("Transformers.js failed to load.");
                }

                console.log('[DepthEstimator] Loading Depth Anything V2...');
                
                // Load Xenova's Depth Anything V2 ONNX model
                this.depthPipeline = await global.Transformers.pipeline(
                    'depth-estimation', 
                    'Xenova/depth-anything-v2-small', // quantized web-friendly model
                    {
                        device: 'webgpu', // Attempt WebGPU for performance
                        dtype: 'fp16'
                    }
                );

                this.isReady = true;
                console.log('[DepthEstimator] Model loaded successfully.');
            } catch (err) {
                console.error('[DepthEstimator] Failed to load model:', err);
            } finally {
                this.isInitializing = false;
            }
        }

        /**
         * Processes the video frame and returns a Three.js DataTexture of the depth map.
         * @param {HTMLVideoElement|HTMLCanvasElement} videoSource 
         */
        async estimateDepth(videoSource) {
            if (!this.isReady || !this.depthPipeline) return null;

            const now = performance.now();
            if (now - this.lastFrameTime < (1000 / this.fpsLimit)) {
                return this.depthTexture; // Return cached texture if we are rate-limiting
            }

            try {
                // Extract image data
                const canvas = document.createElement('canvas');
                canvas.width = videoSource.videoWidth || videoSource.width;
                canvas.height = videoSource.videoHeight || videoSource.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(videoSource, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Use RawImage from transformers
                const rawImg = new global.Transformers.RawImage(imageData.data, canvas.width, canvas.height, 4);

                // Run inference
                const result = await this.depthPipeline(rawImg);
                
                // Result has .depth (tensor) and .image (RawImage)
                if (result && result.depth) {
                    this._updateDepthTexture(result.depth, result.depth.dims);
                    this.lastFrameTime = performance.now();
                }

                return this.depthTexture;
            } catch (err) {
                console.error('[DepthEstimator] Inference error:', err);
                return null;
            }
        }

        _updateDepthTexture(depthTensor, dims) {
            if (!global.THREE) return;

            const width = dims[1]; // height is [0], width is [1]
            const height = dims[0];
            
            // Normalize depths to 0-255 Uint8Array for DataTexture
            const data = depthTensor.data;
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                if (data[i] < min) min = data[i];
                if (data[i] > max) max = data[i];
            }

            const uint8Data = new Uint8Array(width * height);
            const range = max - min;
            
            for (let i = 0; i < data.length; i++) {
                // Invert depth if necessary so 255 = far, 0 = near
                uint8Data[i] = Math.floor(((data[i] - min) / range) * 255);
            }

            if (!this.depthTexture) {
                this.depthTexture = new global.THREE.DataTexture(
                    uint8Data,
                    width,
                    height,
                    global.THREE.RedFormat,
                    global.THREE.UnsignedByteType
                );
            } else {
                this.depthTexture.image.data = uint8Data;
                this.depthTexture.image.width = width;
                this.depthTexture.image.height = height;
            }

            this.depthTexture.needsUpdate = true;
        }
    };
})(window);
