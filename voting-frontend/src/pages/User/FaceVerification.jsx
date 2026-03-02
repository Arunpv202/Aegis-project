import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as faceapi from "face-api.js";
import {
  ArrowLeft,
  Scan,
  ShieldCheck,
  Camera,
  RefreshCw,
  Info,
  Loader2,
  AlertCircle,
  MoveLeft,
  MoveRight,
  CheckCircle2,
  User
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function FaceVerification() {
  const navigate = useNavigate();
  const { electionId, commitment } = useAuthStore();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading face detection models...");
  const [faceCentered, setFaceCentered] = useState(false);
  const [turnedLeft, setTurnedLeft] = useState(false);
  const [turnedRight, setTurnedRight] = useState(false);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Phase tracking
  const phaseRef = useRef("centering"); // centering -> turn_left -> turn_right -> done
  const frontalDescriptorRef = useRef(null);
  const centerFrameCountRef = useRef(0);
  const capturedRef = useRef(false);

  const TURN_THRESHOLD = 0.12;
  const CENTER_THRESHOLD = 0.04;
  const REQUIRED_CENTER_FRAMES = 5;

  useEffect(() => {
    if (!electionId) {
      setError("No election selected. Please go back and select an election.");
      setStatus("error");
      return;
    }
    initFaceDetection();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const initFaceDetection = async () => {
    try {
      setStatus("loading");
      setMessage("Loading face detection models...");

      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

      setMessage("Starting camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("scanning");
      setMessage("Look straight at the camera.");
      phaseRef.current = "centering";
      frontalDescriptorRef.current = null;
      centerFrameCountRef.current = 0;
      capturedRef.current = false;
      setFaceCentered(false);
      setTurnedLeft(false);
      setTurnedRight(false);

      runDetection();
    } catch (err) {
      console.error("[FaceVerification] Init error:", err);
      setStatus("error");
      setMessage("Failed to start camera. Please allow camera access and try again.");
    }
  };

  const runDetection = () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const detect = async () => {
      if (!video || video.paused || video.ended || capturedRef.current) return;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setMessage("No face detected. Position your face in the frame.");
        centerFrameCountRef.current = 0;
      } else if (detections.length > 1) {
        setMessage("Multiple faces detected! Only one person allowed.");
        centerFrameCountRef.current = 0;
      } else {
        const detection = detections[0];
        const landmarks = detection.landmarks;
        const box = detection.detection.box;
        const noseTip = landmarks.positions[30];
        const faceCenterX = box.x + box.width / 2;
        const offset = (noseTip.x - faceCenterX) / box.width;

        if (phaseRef.current === "centering") {
          if (Math.abs(offset) < CENTER_THRESHOLD) {
            centerFrameCountRef.current += 1;
            if (centerFrameCountRef.current >= REQUIRED_CENTER_FRAMES) {
              frontalDescriptorRef.current = Array.from(detection.descriptor);
              setFaceCentered(true);
              phaseRef.current = "turn_left";
              setMessage("Face captured! Now turn your head LEFT.");
            } else {
              setMessage(`Hold still, looking straight... (${centerFrameCountRef.current}/${REQUIRED_CENTER_FRAMES})`);
            }
          } else {
            centerFrameCountRef.current = 0;
            setMessage("Look straight at the camera.");
          }
        } else if (phaseRef.current === "turn_left") {
          if (offset > TURN_THRESHOLD) {
            setTurnedLeft(true);
            phaseRef.current = "turn_right";
            setMessage("Good! Now turn your head RIGHT.");
          } else {
            setMessage("Turn your head LEFT slowly.");
          }
        } else if (phaseRef.current === "turn_right") {
          if (offset < -TURN_THRESHOLD) {
            setTurnedRight(true);
            capturedRef.current = true;
            phaseRef.current = "done";

            // Use FRONTAL descriptor (not turned face)
            setStatus("verifying");
            setMessage("Liveness confirmed! Verifying identity with server...");
            stopCamera();
            verifyWithBackend(frontalDescriptorRef.current);
            return;
          } else {
            setMessage("Now turn your head RIGHT slowly.");
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  };

  const verifyWithBackend = async (descriptor) => {
    try {
      const res = await fetch("/api/verify-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          election_id: electionId,
          descriptor: descriptor,
          commitment: commitment
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatus("done");
        setMessage("Identity verified! Redirecting to ballot...");
        setTimeout(() => {
          navigate(`/user/vote/${electionId}`);
        }, 1500);
      } else {
        setStatus("error");
        setError(data.message || "Face verification failed. Identity mismatch.");
        setMessage("Verification failed. You are not authorized to vote.");
      }
    } catch (err) {
      console.error("[FaceVerification] Backend error:", err);
      setStatus("error");
      setError("Server error during face verification. Please try again.");
      setMessage("Server error. Please try again.");
    }
  };

  const handleRetry = () => {
    setError(null);
    initFaceDetection();
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg relative z-10"
      >
        <button
          onClick={() => { stopCamera(); navigate("/user/existing-elections"); }}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Cancel & Return</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[3rem] shadow-2xl relative text-center">

          <div className="mb-6">
            <h2 className="text-3xl font-black tracking-tight mb-2">Biometric Scan</h2>
            <p className="text-gray-400 text-sm">Look straight, then turn left & right for liveness.</p>
          </div>

          {/* Scanner Viewport */}
          <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 mb-8 group">
            <div className="absolute inset-0 bg-black/60 rounded-[3rem] border-2 border-white/5 overflow-hidden flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline />

              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 size={48} className="text-emerald-400 animate-spin" />
                </div>
              )}

              {status === "done" && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                  <ShieldCheck size={64} className="text-emerald-400" />
                </div>
              )}
            </div>

            {status === "scanning" && (
              <motion.div initial={{ top: "0%" }} animate={{ top: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] z-20" />
            )}

            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl"></div>

            {status === "scanning" && (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <Scan size={120} className="text-emerald-500" strokeWidth={0.5} />
              </div>
            )}
          </div>

          {/* 3-Step Progress */}
          {(status === "scanning" || status === "verifying") && (
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${faceCentered ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-gray-600"
                }`}>
                {faceCentered ? <CheckCircle2 size={14} /> : <User size={14} />}
                <span>Center</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${turnedLeft ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-gray-600"
                }`}>
                {turnedLeft ? <CheckCircle2 size={14} /> : <MoveLeft size={14} />}
                <span>Left</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${turnedRight ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-gray-600"
                }`}>
                {turnedRight ? <CheckCircle2 size={14} /> : <MoveRight size={14} />}
                <span>Right</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2 justify-center">
              <AlertCircle size={16} />{error}
            </div>
          )}

          <div className="flex gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl items-center mb-8 text-left">
            <Info size={18} className="text-emerald-400 shrink-0" />
            <p className={`text-[11px] leading-tight ${status === "error" ? "text-red-400" : status === "done" ? "text-emerald-400" :
                status === "verifying" ? "text-indigo-400" : "text-gray-400"
              }`}>{message}</p>
          </div>

          <div className="space-y-4">
            {status === "done" && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold animate-pulse">
                <ShieldCheck size={20} /><span>Verified — Redirecting...</span>
              </div>
            )}
            {status === "verifying" && (
              <div className="flex items-center justify-center gap-2 text-indigo-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm font-bold">Verifying with server...</span>
              </div>
            )}
            {status === "error" && (
              <button onClick={handleRetry}
                className="flex items-center justify-center gap-2 text-sm text-white mx-auto transition-colors py-3 px-6 font-bold bg-indigo-600 hover:bg-indigo-500 rounded-xl">
                <RefreshCw size={16} />Retry Verification
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}