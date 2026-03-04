import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as faceapi from "face-api.js";

import CryptoJS from "crypto-js";
import { storeSecrets, storeCommitment } from "../../utils/zkStorage";
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X,
  Camera,
  MoveLeft,
  MoveRight,
  CheckCircle2,
  User
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";
import LoadingScreen from "../../components/UI/LoadingScreen";
import InlineMessage from "../../components/UI/InlineMessage";

export default function RegisterElection() {
  const navigate = useNavigate();
  const { username, token } = useAuthStore();

  const [formData, setFormData] = useState({
    election_id: "",
    token: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalPassword, setModalPassword] = useState("");

  // Face Capture State
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceStatus, setFaceStatus] = useState("loading");
  const [faceMessage, setFaceMessage] = useState("Loading face detection models...");
  const [faceCentered, setFaceCentered] = useState(false);
  const [turnedLeft, setTurnedLeft] = useState(false);
  const [turnedRight, setTurnedRight] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const pendingPasswordRef = useRef("");

  // Phase tracking refs
  const phaseRef = useRef("centering"); // centering -> turn_left -> turn_right -> done
  const frontalDescriptorRef = useRef(null);
  const centerFrameCountRef = useRef(0);

  const TURN_THRESHOLD = 0.12;
  const CENTER_THRESHOLD = 0.04; // nose must be within 4% of center for frontal
  const REQUIRED_CENTER_FRAMES = 5; // need 5 consecutive centered frames

  useEffect(() => {
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleInitialSubmit = () => {
    setError(null);
    if (!formData.election_id || !formData.token) {
      setError("Please fill in Election Reference ID and Access Token.");
      return;
    }
    setShowPasswordModal(true);
  };

  const handlePasswordConfirm = () => {
    if (!modalPassword) {
      setError("Encryption password is required.");
      setShowPasswordModal(false);
      return;
    }
    pendingPasswordRef.current = modalPassword;
    setShowPasswordModal(false);
    setShowFaceCapture(true);
    startFaceCapture();
  };

  const startFaceCapture = async () => {
    try {
      setFaceStatus("loading");
      setFaceMessage("Loading face detection models...");
      setFaceCentered(false);
      setTurnedLeft(false);
      setTurnedRight(false);
      phaseRef.current = "centering";
      frontalDescriptorRef.current = null;
      centerFrameCountRef.current = 0;

      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

      setFaceMessage("Starting camera...");

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch (camErr) {
        console.warn("[FaceCapture] Preferred constraints failed, retrying with basic constraints:", camErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        await videoRef.current.play();
      }

      setFaceStatus("scanning");
      setFaceMessage("Look straight at the camera.");

      detectFaces();
    } catch (err) {
      console.error("[FaceCapture] Error:", err);
      setFaceStatus("error");
      const isSecureContext = window.isSecureContext;
      setFaceMessage(
        !isSecureContext
          ? "Camera requires a secure connection (HTTPS). Please access the app over HTTPS."
          : "Failed to start camera. Please allow camera access in your browser settings."
      );
    }
  };

  const detectFaces = () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const runDetection = async () => {
      if (!video || video.paused || video.ended) return;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setFaceMessage("No face detected. Position your face in the frame.");
        centerFrameCountRef.current = 0;
      } else if (detections.length > 1) {
        setFaceMessage("Multiple faces detected! Only one person allowed.");
        centerFrameCountRef.current = 0;
      } else {
        const detection = detections[0];
        const landmarks = detection.landmarks;
        const box = detection.detection.box;
        const noseTip = landmarks.positions[30];
        const faceCenterX = box.x + box.width / 2;
        const offset = (noseTip.x - faceCenterX) / box.width;

        if (phaseRef.current === "centering") {
          // Phase 1: Capture frontal descriptor when face is centered
          if (Math.abs(offset) < CENTER_THRESHOLD) {
            centerFrameCountRef.current += 1;
            if (centerFrameCountRef.current >= REQUIRED_CENTER_FRAMES) {
              // Face is centered and stable — capture frontal descriptor
              frontalDescriptorRef.current = Array.from(detection.descriptor);
              setFaceCentered(true);
              phaseRef.current = "turn_left";
              setFaceMessage("Face captured! Now turn your head LEFT.");
            } else {
              setFaceMessage(`Hold still, looking straight... (${centerFrameCountRef.current}/${REQUIRED_CENTER_FRAMES})`);
            }
          } else {
            centerFrameCountRef.current = 0;
            setFaceMessage("Look straight at the camera.");
          }
        } else if (phaseRef.current === "turn_left") {
          // Phase 2: Detect left turn
          if (offset > TURN_THRESHOLD) {
            setTurnedLeft(true);
            phaseRef.current = "turn_right";
            setFaceMessage("Good! Now turn your head RIGHT.");
          } else {
            setFaceMessage("Turn your head LEFT slowly.");
          }
        } else if (phaseRef.current === "turn_right") {
          // Phase 3: Detect right turn
          if (offset < -TURN_THRESHOLD) {
            setTurnedRight(true);
            phaseRef.current = "done";

            // Use the FRONTAL descriptor captured earlier (not the turned face)
            setFaceStatus("done");
            setFaceMessage("Liveness confirmed! Capturing face data...");
            stopCamera();
            handleFinalRegister(frontalDescriptorRef.current);
            return;
          } else {
            setFaceMessage("Now turn your head RIGHT slowly.");
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(runDetection);
    };

    animFrameRef.current = requestAnimationFrame(runDetection);
  };

  const handleFinalRegister = async (descriptor) => {
    setError(null);
    const passwordToUse = pendingPasswordRef.current;

    if (!passwordToUse) {
      setError("Encryption password is required.");
      setShowFaceCapture(false);
      return;
    }

    setLoading(true);
    setShowFaceCapture(false);

    try {
      if (!username) throw new Error("User not logged in.");

      const saltInput = `${username}-${formData.election_id}-VOTING_APP_SCURE_SALT`;
      const encryptionKey = CryptoJS.PBKDF2(passwordToUse, saltInput, {
        keySize: 256 / 32,
        iterations: 10000
      }).toString();

      const zkSecret = CryptoJS.lib.WordArray.random(32).toString();

      const { generateCommitment } = await import("../../utils/cryptoVoting");
      const commitment = await generateCommitment(zkSecret);
      console.log("Generated Commitment (Poseidon):", commitment);

      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          election_id: formData.election_id.trim(),
          token: formData.token.trim(),
          commitment: commitment,
          face_descriptor: descriptor
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Registration failed");
      }

      await storeSecrets(formData.election_id, { zkSecret }, encryptionKey, username);
      await storeCommitment(formData.election_id, commitment, username);

      setSuccess("Registration Successful! Redirecting...");
      setTimeout(() => navigate("/user/dashboard"), 1500);

    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
      pendingPasswordRef.current = "";
      setModalPassword("");
    }
  };

  if (loading && !success) return <LoadingScreen text="Verifying Credentials & Generating Zero-Knowledge Proof..." />;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl relative z-10"
      >
        <button
          onClick={() => navigate("/user/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-all group px-4 py-2 hover:bg-white/5 rounded-lg w-fit"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-2xl relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="text-center mb-12">
            <div className="inline-flex p-5 bg-indigo-500/10 rounded-3xl text-indigo-400 mb-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Register for Election</h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
              Enter the specific election ID and your unique access token to securely link your digital wallet.
            </p>
          </div>

          <InlineMessage type="error" message={error} onClose={() => setError(null)} />
          <InlineMessage type="success" message={success} />

          <div className="space-y-8">
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 ml-2">Election Identifier</label>
              <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                <Fingerprint className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={24} />
                <input type="text" name="election_id" value={formData.election_id} onChange={handleChange} placeholder="e.g. ELEC-2024-X"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-lg text-white" />
              </div>
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 ml-2">Secure Access Token</label>
              <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                <KeyRound className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={24} />
                <input type="text" name="token" value={formData.token} onChange={handleChange} placeholder="Paste your token here..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-lg text-white" />
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-sm text-blue-300 leading-relaxed items-start">
            <ShieldAlert size={20} className="shrink-0 opacity-80 mt-0.5" />
            <p>Ensure your token is kept private. Do not share this token with anyone.</p>
          </div>

          <button onClick={handleInitialSubmit} disabled={loading || success}
            className="w-full mt-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <><span>Submit & Continue</span><ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
        </div>
      </motion.div>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full relative shadow-2xl">
              <button onClick={() => setShowPasswordModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                <X size={24} />
              </button>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
                  <KeyRound size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">Set Encryption Password</h3>
                <p className="text-gray-400 text-sm leading-relaxed px-2">
                  Create a secure password. You will need this to <strong>decrypt your ZK-Proof</strong> when voting.
                </p>
              </div>
              <div className="mb-8 relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input type="password" autoFocus
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg placeholder:text-gray-700"
                  placeholder="Enter secure password" value={modalPassword} onChange={(e) => setModalPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm()} />
              </div>
              <button onClick={handlePasswordConfirm}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                <span>Continue to Face Scan</span><Camera size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Face Capture Modal */}
      <AnimatePresence>
        {showFaceCapture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full relative shadow-2xl">
              <button onClick={() => { stopCamera(); setShowFaceCapture(false); }}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full z-10">
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                  <Camera size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Face Verification</h3>
                <p className="text-gray-400 text-sm">Look straight, then turn left & right</p>
              </div>

              <div className="relative mx-auto w-full max-w-sm aspect-[4/3] mb-6 rounded-2xl overflow-hidden border-2 border-white/10">
                <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline />
                {faceStatus === "scanning" && (
                  <motion.div initial={{ top: "0%" }} animate={{ top: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] z-10" />
                )}
              </div>

              {/* 3-Step Progress */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-3">
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

                <p className={`text-sm font-medium ${faceStatus === "error" ? "text-red-400" : faceStatus === "done" ? "text-emerald-400" : "text-gray-400"
                  }`}>{faceMessage}</p>

                {faceStatus === "loading" && <Loader2 className="animate-spin mx-auto text-indigo-400" size={24} />}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}