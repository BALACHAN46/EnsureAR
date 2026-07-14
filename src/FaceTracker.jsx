import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const FaceTracker = ({ onLandmarks }) => {
  const webcamRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let camera = null;
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      if (isLoading) {
        setIsLoading(false);
      }
      
      const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 
        ? results.multiFaceLandmarks[0] 
        : null;
        
      onLandmarks(landmarks, results.image);
    });

    if (typeof webcamRef.current !== "undefined" && webcamRef.current !== null) {
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video) {
            await faceMesh.send({ image: webcamRef.current.video });
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
      faceMesh.close();
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
          <p>Initializing Face Tracking Engine...</p>
        </div>
      )}
    </>
  );
};

export default FaceTracker;
