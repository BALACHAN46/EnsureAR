import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const HandTracker = ({ onLandmarks }) => {
  const webcamRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let camera = null;
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      if (isLoading) {
        setIsLoading(false);
      }
      
      const landmarks = results.multiHandLandmarks && results.multiHandLandmarks.length > 0 
        ? results.multiHandLandmarks[0] 
        : null;
      
      const worldLandmarks = results.multiHandWorldLandmarks && results.multiHandWorldLandmarks.length > 0
        ? results.multiHandWorldLandmarks[0]
        : null;

      const handedness = results.multiHandedness && results.multiHandedness.length > 0
        ? results.multiHandedness[0]
        : null;
        
      onLandmarks(landmarks, results.image, worldLandmarks, handedness);
    });

    if (typeof webcamRef.current !== "undefined" && webcamRef.current !== null) {
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
            await hands.send({ image: webcamRef.current.video });
          }
        },
        width: 640,
        height: 480
      });
      camera.start();
    }

    return () => {
      if (camera) {
        camera.stop();
      }
      hands.close();
    };
  }, []); // Run once on mount

  return (
    <>
      <Webcam
        ref={webcamRef}
        className="webcam-video"
        mirrored={true}
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: "user"
        }}
      />
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Initializing Hand Tracking Engine...</p>
        </div>
      )}
    </>
  );
};

export default HandTracker;
