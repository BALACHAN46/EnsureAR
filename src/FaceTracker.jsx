import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const FaceTracker = ({ onLandmarks, onPoseLandmarks, category }) => {
  const webcamRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingFiredRef = useRef(false);
  const categoryRef = useRef(category);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  useEffect(() => {
    let camera = null;
    let poseInitialized = false;
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      // CRITICAL: refineLandmarks: true enables iris landmarks (468, 473)
      // which are essential for accurate IPD calculation in NecklaceMesh.computeCollarbone
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      if (!loadingFiredRef.current) {
        setIsLoading(false);
        loadingFiredRef.current = true;
      }
      
      const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 
        ? results.multiFaceLandmarks[0] 
        : null;
        
      onLandmarks(landmarks, results.image);
    });

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
      if (onPoseLandmarks) {
        onPoseLandmarks(results.poseLandmarks || null);
      }
    });

    const startCamera = async () => {
      try {
        // Initialize AI models sequentially to prevent WebAssembly global loader collisions.
        // Pose is only needed for the necklace flow — skip loading/initializing it
        // (a second ~3MB WASM model) on the eyewear/rings pages that never use it.
        await faceMesh.initialize();
        if (categoryRef.current === 'necklace') {
          await pose.initialize();
          poseInitialized = true;
        }

        if (typeof webcamRef.current !== "undefined" && webcamRef.current !== null) {
          camera = new Camera(webcamRef.current.video, {
            onFrame: async () => {
              if (webcamRef.current && webcamRef.current.video) {
                const video = webcamRef.current.video;
                const promises = [faceMesh.send({ image: video })];

                if (categoryRef.current === 'necklace' && poseInitialized) {
                  promises.push(pose.send({ image: video }));
                } else {
                  if (onPoseLandmarks) onPoseLandmarks(null);
                }

                await Promise.all(promises);
              }
            },
            width: 640,
            height: 480
          });
          camera.start();
        }
      } catch (error) {
        console.error("Error initializing AI models:", error);
      }
    };

    startCamera();

    return () => {
      if (camera) {
        camera.stop();
      }
      faceMesh.close();
      if (poseInitialized) {
        pose.close();
      }
    };
  }, []); // Run once on mount

  return (
    <>
      <Webcam
        ref={webcamRef}
        className="webcam-video"
        mirrored={true}
        videoConstraints={{
          
          facingMode: "user"
        }}
      />
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Initializing Face Tracking Engine...</p>
        </div>
      )}
    </>
  );
};

export default FaceTracker;

