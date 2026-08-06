/**
 * mediapipe-landmarker.js  v5.0
 * ─────────────────────────────────────────────────────────────────────────────
 * EnsureAR — MediaPipe Tasks Vision wrapper
 *
 * v5.0 changes:
 *   • Pose landmarker only runs in 'face' mode (necklace/earrings) — skipped
 *     entirely in 'hand' mode (rings/bracelets) to save mobile GPU time.
 *   • getNeckCenter()  — virtual landmark: weighted blend of chin + mid-shoulder
 *   • getShoulderAngle() — signed horizontal angle of the shoulder line (body yaw)
 *   • getBodyYaw()       — shoulder-to-shoulder direction in radians (for rotation)
 *
 * Landmark indices verified against official MediaPipe topologies:
 *   • Face: 478-point mesh
 *   • Hand: 21-point skeleton
 *   • Pose: 33-point body skeleton
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
    'use strict';

    // ── MediaPipe Face landmark indices ───────────────────────────────────────

    const FACE_LM = {
        FOREHEAD: 10,   // top of head
        CHIN: 152,   // chin bottom
        LEFT_EAR: 234,   // left ear tragus (face left edge)
        RIGHT_EAR: 454,   // right ear tragus (face right edge)
        NOSE_TIP: 1,
        NOSE_BRIDGE: 6,
        LEFT_EYE: 33,
        RIGHT_EYE: 263,
        LEFT_JAW: 172,   // lower-left jaw edge
        RIGHT_JAW: 397,   // lower-right jaw edge
        CHIN_L: 177,   // left chin edge
        CHIN_R: 400,   // right chin edge
        LEFT_TEMPLE: 127,   // left temple (stable face-width ref)
        RIGHT_TEMPLE: 356,   // right temple
    };

    // ── MediaPipe Hand landmark indices ───────────────────────────────────────

    const HAND_LM = {
        WRIST: 0,
        THUMB_CMC: 1,
        THUMB_MCP: 2,
        THUMB_IP: 3,
        THUMB_TIP: 4,
        INDEX_MCP: 5,
        INDEX_PIP: 6,
        INDEX_DIP: 7,
        INDEX_TIP: 8,
        MIDDLE_MCP: 9,
        MIDDLE_PIP: 10,
        MIDDLE_DIP: 11,
        MIDDLE_TIP: 12,
        RING_MCP: 13,
        RING_PIP: 14,
        RING_DIP: 15,
        RING_TIP: 16,
        PINKY_MCP: 17,
        PINKY_PIP: 18,
        PINKY_DIP: 19,
        PINKY_TIP: 20,
    };

    // ── MediaPipe Pose landmark indices ───────────────────────────────────────
    //
    //  Full 33-point skeleton:
    //   0  NOSE
    //   1  LEFT_EYE_INNER   2  LEFT_EYE   3  LEFT_EYE_OUTER
    //   4  RIGHT_EYE_INNER  5  RIGHT_EYE  6  RIGHT_EYE_OUTER
    //   7  LEFT_EAR         8  RIGHT_EAR
    //   9  MOUTH_LEFT      10  MOUTH_RIGHT
    //  11  LEFT_SHOULDER   12  RIGHT_SHOULDER
    //  13  LEFT_ELBOW      14  RIGHT_ELBOW
    //  15  LEFT_WRIST      16  RIGHT_WRIST
    //  17  LEFT_PINKY      18  RIGHT_PINKY
    //  19  LEFT_INDEX      20  RIGHT_INDEX
    //  21  LEFT_THUMB      22  RIGHT_THUMB
    //  23  LEFT_HIP        24  RIGHT_HIP
    //
    const POSE_LM = {
        NOSE: 0,
        LEFT_EAR: 7,
        RIGHT_EAR: 8,
        LEFT_SHOULDER: 11,  // KEY — shoulder anchor for necklace
        RIGHT_SHOULDER: 12,  // KEY — shoulder anchor for necklace
        LEFT_ELBOW: 13,
        RIGHT_ELBOW: 14,
        LEFT_WRIST: 15,
        RIGHT_WRIST: 16,
        LEFT_HIP: 23,
        RIGHT_HIP: 24,
    };

    // ── CDN ───────────────────────────────────────────────────────────────────

    const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

    // ── State ─────────────────────────────────────────────────────────────────

    let faceLandmarker = null;
    let handLandmarker = null;
    let poseLandmarker = null;
    let isInitialized = false;
    let initPromise = null;

    let lastFaceResult = null;
    let lastHandResult = null;
    let lastPoseResult = null;

    // active tracking mode — drives which detectors run each frame
    // 'face' → runs face + pose (shoulder anchor for necklace/earrings)
    // 'hand' → runs hand only  (ring/bracelet, skip pose to save GPU)
    // 'both' → runs all three
    let activeMode = 'face';

    const callbacks = { onFace: [], onHand: [], onPose: [], onReady: [] };

    // ── Initialiser ───────────────────────────────────────────────────────────

    async function initialize() {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            console.log('[EnsureAR Landmarker] Initialising MediaPipe Tasks Vision v5.0…');

            try {
                const { FaceLandmarker, HandLandmarker, PoseLandmarker, FilesetResolver } =
                    await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');

                const vision = await FilesetResolver.forVisionTasks(VISION_CDN);

                // ── Face Landmarker ─────────────────────────────────────────────
                faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minFacePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: true,
                });

                // ── Hand Landmarker ─────────────────────────────────────────────
                handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                // ── Pose Landmarker ─────────────────────────────────────────────
                poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    outputSegmentationMasks: false,
                });

                isInitialized = true;
                console.log('[EnsureAR Landmarker] ✓ Face, Hand, and Pose landmarkers ready (v5.0).');
                callbacks.onReady.forEach(cb => cb());

            } catch (err) {
                console.error('[EnsureAR Landmarker] Init failed:', err);
                throw err;
            }
        })();

        return initPromise;
    }

    // ── Per-frame detection ───────────────────────────────────────────────────

    function detect(video, timestampMs) {
        if (!isInitialized) return { face: null, hands: null, pose: null };

        let faceResult = null;
        let handResult = null;
        let poseResult = null;

        try {
            // Face runs for face/both modes
            if ((activeMode === 'face' || activeMode === 'both') && faceLandmarker) {
                faceResult = faceLandmarker.detectForVideo(video, timestampMs);
                lastFaceResult = faceResult;
                if (faceResult?.faceLandmarks?.length > 0) {
                    callbacks.onFace.forEach(cb => cb(faceResult));
                }
            }

            // Hand runs for hand/both modes
            if ((activeMode === 'hand' || activeMode === 'both') && handLandmarker) {
                handResult = handLandmarker.detectForVideo(video, timestampMs);
                lastHandResult = handResult;
                if (handResult?.landmarks?.length > 0) {
                    callbacks.onHand.forEach(cb => cb(handResult));
                }
            }

            // Pose runs ONLY in face/both modes — necklace/earrings need shoulder anchors.
            // Skipped in hand mode to reduce GPU load on mobile.
            if ((activeMode === 'face' || activeMode === 'both') && poseLandmarker) {
                poseResult = poseLandmarker.detectForVideo(video, timestampMs);
                lastPoseResult = poseResult;
                if (poseResult?.landmarks?.length > 0) {
                    callbacks.onPose.forEach(cb => cb(poseResult));
                }
            } else if (activeMode === 'hand') {
                // Return the last known pose (may be stale or null) — hand mapper ignores it anyway
                poseResult = lastPoseResult;
            }

        } catch (e) {
            // Silent per-frame fail — return last known results to avoid flickering
        }

        return { face: faceResult, hands: handResult, pose: poseResult };
    }

    // ── Landmark extraction helpers ───────────────────────────────────────────

    function getFaceLandmark(faceResult, index) {
        if (!faceResult?.faceLandmarks?.[0]) return null;
        return faceResult.faceLandmarks[0][index] ?? null;
    }

    function getHandLandmark(handResult, landmarkIndex, handIndex = 0) {
        if (!handResult?.landmarks?.[handIndex]) return null;
        return handResult.landmarks[handIndex][landmarkIndex] ?? null;
    }

    /**
     * Get a Pose landmark by index.
     * poseResult.landmarks[0][i] gives { x, y, z } normalised to image dimensions.
     * poseResult.worldLandmarks[0][i] gives metric-space (metres) coordinates.
     *
     * We use NORMALISED landmarks (same space as face/hand) so coordinate
     * conversion is consistent.
     */
    function getPoseLandmark(poseResult, index, poseIndex = 0) {
        if (!poseResult?.landmarks?.[poseIndex]) return null;
        return poseResult.landmarks[poseIndex][index] ?? null;
    }

    /**
     * Face width: 3D distance between temples (127 ↔ 356).
     * Temple-to-temple is stable under head rotation.
     */
    function getFaceWidth(faceResult) {
        const lt = getFaceLandmark(faceResult, FACE_LM.LEFT_TEMPLE);
        const rt = getFaceLandmark(faceResult, FACE_LM.RIGHT_TEMPLE);
        if (lt && rt) {
            return Math.sqrt(
                (lt.x - rt.x) ** 2 +
                (lt.y - rt.y) ** 2 +
                (lt.z - rt.z) ** 2
            );
        }
        // Fallback: 75% of forehead→chin distance
        const top = getFaceLandmark(faceResult, FACE_LM.FOREHEAD);
        const chin = getFaceLandmark(faceResult, FACE_LM.CHIN);
        if (!top || !chin) return null;
        return Math.sqrt(
            (top.x - chin.x) ** 2 +
            (top.y - chin.y) ** 2 +
            (top.z - chin.z) ** 2
        ) * 0.75;
    }

    /**
     * Shoulder width: 3D distance between LEFT_SHOULDER and RIGHT_SHOULDER.
     * Returns null if pose is not detected.
     */
    function getShoulderWidth(poseResult) {
        const ls = getPoseLandmark(poseResult, POSE_LM.LEFT_SHOULDER);
        const rs = getPoseLandmark(poseResult, POSE_LM.RIGHT_SHOULDER);
        if (!ls || !rs) return null;
        return Math.sqrt(
            (ls.x - rs.x) ** 2 +
            (ls.y - rs.y) ** 2 +
            (ls.z - rs.z) ** 2
        );
    }

    /**
     * Shoulder angle: horizontal angle of the shoulder line relative to camera.
     * Returns signed angle in radians (positive = left shoulder forward).
     * Used to compute body yaw for necklace rotation.
     */
    function getShoulderAngle(poseResult) {
        const ls = getPoseLandmark(poseResult, POSE_LM.LEFT_SHOULDER);
        const rs = getPoseLandmark(poseResult, POSE_LM.RIGHT_SHOULDER);
        if (!ls || !rs) return 0;
        // dx: horizontal distance (normalised image coords)
        // dz: depth difference — positive if left shoulder is closer to camera
        const dx = ls.x - rs.x;
        const dz = ls.z - rs.z;
        return Math.atan2(dz, dx);  // body yaw in radians
    }

    /**
     * Body yaw: rotation of the torso around the vertical axis.
     * Returns angle in radians. 0 = facing camera directly.
     * Derived from the depth (z) component of the shoulder vector.
     */
    function getBodyYaw(poseResult) {
        const ls = getPoseLandmark(poseResult, POSE_LM.LEFT_SHOULDER);
        const rs = getPoseLandmark(poseResult, POSE_LM.RIGHT_SHOULDER);
        if (!ls || !rs) return 0;
        // In normalised pose coordinates, z is relative depth.
        // When facing camera: z ≈ 0 for both shoulders.
        // When turning left:  left shoulder z < right shoulder z.
        const dz = rs.z - ls.z;  // negative when turning right, positive when turning left
        const dx = ls.x - rs.x;  // approx shoulder width on screen
        return Math.atan2(dz, Math.abs(dx) + 0.001);
    }

    /**
     * Virtual neck-center landmark: blends chin (face) and mid-shoulder (pose).
     *
     * When both face and pose are available:
     *   neckCenter = lerp(chin, midShoulder, 0.30)
     *   This places the anchor at ~30% of the way from chin to shoulders,
     *   which corresponds to the base-of-neck / collarbone region.
     *
     * When only pose is available:
     *   Returns midShoulder with a small upward Y offset.
     *
     * When only face is available:
     *   Returns chin + downward offset estimated from face height.
     *
     * Returns null if neither is available.
     */
    function getNeckCenter(faceResult, poseResult) {
        const ls = getPoseLandmark(poseResult, POSE_LM.LEFT_SHOULDER);
        const rs = getPoseLandmark(poseResult, POSE_LM.RIGHT_SHOULDER);
        const chin = getFaceLandmark(faceResult, FACE_LM.CHIN);

        const hasPose = ls && rs;
        const hasFace = !!chin;

        if (hasPose && hasFace) {
            // Calculate the neck center using the midpoint of the left and right shoulders.
            // Place the necklace slightly below the chin and centered between both shoulders.
            // Apply a small downward offset so the necklace rests naturally on the collarbone.
            const midX = (ls.x + rs.x) / 2;
            const midY = (ls.y + rs.y) / 2;
            const midZ = (ls.z + rs.z) / 2;

            const yDist = Math.abs(midY - chin.y);

            // User requested: "no need move the model based chin"
            // The necklace should sit on the body, so it should not move when the head moves.
            // We base the anchor entirely on the shoulders.
            const shoulderWidth = Math.abs(rs.x - ls.x);
            return {
                x: midX,
                y: midY - (shoulderWidth * 0.15), // Lift slightly above shoulder line
                z: midZ,
                source: 'fused',
            };
        }

        if (hasPose) {
            // Pose-only (face left frame): lift anchor well above mid-shoulder
            // so necklace still appears around the throat, not on the chest.
            // In MediaPipe y↓ coords: subtracting moves the point UPWARD.
            // 0.45 × shoulder-width brings the anchor from mid-shoulder up to ~throat level.
            const sw = getShoulderWidth(poseResult) ?? 0.30;
            return {
                x: (ls.x + rs.x) / 2,
                y: (ls.y + rs.y) / 2 - sw * 0.45,
                z: (ls.z + rs.z) / 2,
                source: 'pose-only',
            };
        }

        if (hasFace) {
            // Face-only fallback: place anchor just below the chin (6% of face height).
            // (0.55 was placing it nearly a full face-height below the chin = chest.)
            const forehead = getFaceLandmark(faceResult, FACE_LM.FOREHEAD);
            const faceH = forehead
                ? Math.abs(chin.y - forehead.y)
                : (getFaceWidth(faceResult) ?? 0.28) * 1.3;
            return {
                x: chin.x,
                y: chin.y + faceH * 0.06,  // just below chin = throat
                z: chin.z,
                source: 'face-only',
            };
        }

        return null;
    }

    /**
     * Head pose from the facial transformation matrix.
     * Returns { yaw, pitch, roll } in degrees.
     */
    function getHeadPose(faceResult) {
        if (!faceResult?.facialTransformationMatrixes?.[0]) return { yaw: 0, pitch: 0, roll: 0 };
        const m = faceResult.facialTransformationMatrixes[0].data;
        const sy = Math.sqrt(m[0] ** 2 + m[4] ** 2);
        const singular = sy < 1e-6;

        const pitch = Math.atan2(-m[8], sy);
        const yaw = singular ? 0 : Math.atan2(m[4], m[0]);
        const roll = singular ? Math.atan2(-m[9], m[10]) : Math.atan2(-m[9], m[10]);

        return {
            pitch: pitch * (180 / Math.PI),
            yaw: yaw * (180 / Math.PI),
            roll: roll * (180 / Math.PI),
        };
    }

    /**
     * v6.0 — Inter-eye distance in normalised image coordinates.
     * Returns the 2-D Euclidean distance between LEFT_EYE (33) and RIGHT_EYE (263).
     * A value > ~0.11 indicates the user's face is very close to the camera.
     * Returns null if face landmarks are unavailable.
     */
    function getInterEyeDistance(faceResult) {
        const le = getFaceLandmark(faceResult, FACE_LM.LEFT_EYE);
        const re = getFaceLandmark(faceResult, FACE_LM.RIGHT_EYE);
        if (!le || !re) return null;
        return Math.hypot(le.x - re.x, le.y - re.y);
    }

    /**
     * v6.0 — Safe landmark visibility accessor.
     * MediaPipe landmarks include an optional `visibility` score [0..1].
     * Returns the score or a default value of 1.0 when the field is absent
     * (face landmarks don't carry visibility; pose landmarks do).
     *
     * @param {Object} landmark  — raw MediaPipe landmark object
     * @param {number} [fallback=1.0] — value to return when visibility is absent
     */
    function getLandmarkVisibility(landmark, fallback = 1.0) {
        if (!landmark) return 0;
        return (landmark.visibility !== undefined && landmark.visibility !== null)
            ? landmark.visibility
            : fallback;
    }

    /**
     * Hand scale: 3D distance wrist → middle-MCP.
     */
    function getHandWidth(handResult, handIndex = 0) {
        const wrist = getHandLandmark(handResult, HAND_LM.WRIST, handIndex);
        const middle = getHandLandmark(handResult, HAND_LM.MIDDLE_MCP, handIndex);
        if (!wrist || !middle) return null;
        return Math.sqrt(
            (middle.x - wrist.x) ** 2 +
            (middle.y - wrist.y) ** 2 +
            (middle.z - wrist.z) ** 2
        );
    }

    /**
     * Ring-finger proximal segment: MCP → PIP.
     */
    function getRingFingerSegmentLength(handResult, handIndex = 0) {
        const mcp = getHandLandmark(handResult, HAND_LM.RING_MCP, handIndex);
        const pip = getHandLandmark(handResult, HAND_LM.RING_PIP, handIndex);
        if (!mcp || !pip) return null;
        return Math.sqrt(
            (mcp.x - pip.x) ** 2 +
            (mcp.y - pip.y) ** 2 +
            (mcp.z - pip.z) ** 2
        );
    }

    // ── Public API ────────────────────────────────────────────────────────────

    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Landmarker = {
        initialize,
        get isReady() { return isInitialized; },

        detect,

        setMode(mode) {
            activeMode = mode;
            console.log('[EnsureAR Landmarker] Mode →', mode);
        },
        get mode() { return activeMode; },

        // Landmark getters
        getFaceLandmark,
        getHandLandmark,
        getPoseLandmark,

        // Scale / pose helpers
        getFaceWidth,
        getShoulderWidth,
        getShoulderAngle,
        getBodyYaw,
        getNeckCenter,            // v5.0 — virtual fused neck landmark
        getHeadPose,
        getHandWidth,
        getRingFingerSegmentLength,
        getInterEyeDistance,      // v6.0 — for TooCloseGuard
        getLandmarkVisibility,    // v6.0 — for ProxyNeckEstimator

        // Index tables
        FACE: FACE_LM,
        HAND: HAND_LM,
        POSE: POSE_LM,

        // Callbacks
        onReady(cb) { callbacks.onReady.push(cb); if (isInitialized) cb(); },
        onFace(cb) { callbacks.onFace.push(cb); },
        onHand(cb) { callbacks.onHand.push(cb); },
        onPose(cb) { callbacks.onPose.push(cb); },

        // Last results
        get lastFace() { return lastFaceResult; },
        get lastHands() { return lastHandResult; },
        get lastPose() { return lastPoseResult; },
    };

    console.log('[EnsureAR Landmarker] Module loaded (v6.0 — +InterEyeDistance +LandmarkVisibility).');

})(window);
