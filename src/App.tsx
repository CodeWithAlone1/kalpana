/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Power, Settings, Info, Volume2, VolumeX } from "lucide-react";
import { AudioStreamer } from "./lib/audio-streamer";
import { LiveSession } from "./lib/live-session";
import { Waveform } from "./components/Waveform";

type State = "disconnected" | "connecting" | "listening" | "speaking" | "error";

export default function App() {
  const [state, setState] = useState<State>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [lastToolCall, setLastToolCall] = useState<{ name: string; url?: string } | null>(null);
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const apiKey = process.env.GEMINI_API_KEY;

  const handleAudioData = useCallback((base64Data: string) => {
    if (liveSessionRef.current) {
      liveSessionRef.current.sendAudio(base64Data);
    }
  }, []);

  const handleModelAudio = useCallback((base64Data: string) => {
    if (audioStreamerRef.current && !isMuted) {
      audioStreamerRef.current.playAudioChunk(base64Data);
      setState("speaking");
    }
  }, [isMuted]);

  const startSession = async () => {
    if (!apiKey) {
      setError("API Key is missing. Check your environment.");
      setState("error");
      return;
    }

    try {
      setState("connecting");
      setError(null);

      if (!audioStreamerRef.current) {
        audioStreamerRef.current = new AudioStreamer();
      }
      if (!liveSessionRef.current) {
        liveSessionRef.current = new LiveSession(apiKey);
      }

      await liveSessionRef.current.connect({
        onOpen: () => {
          setState("listening");
          audioStreamerRef.current?.startRecording(handleAudioData);
        },
        onClose: () => {
          stopSession();
        },
        onError: (err) => {
          console.error("Live Session Error:", err);
          setError("Connection failed. Try again?");
          setState("error");
        },
        onAudioData: handleModelAudio,
        onInterrupted: () => {
          audioStreamerRef.current?.stopPlayback();
          setState("listening");
        },
        onToolCall: (name, args) => {
          if (name === 'openWebsite') {
            setLastToolCall({ name, url: args.url });
            setTimeout(() => setLastToolCall(null), 5000);
          }
        },
        onTranscription: (text, role) => {
          console.log(`[${role}] ${text}`);
        }
      });
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Microphone access or connection failed.");
      setState("error");
    }
  };

  const stopSession = () => {
    audioStreamerRef.current?.stopRecording();
    liveSessionRef.current?.disconnect();
    setState("disconnected");
  };

  const togglePower = () => {
    if (state === "disconnected" || state === "error") {
      startSession();
    } else {
      stopSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 bg-zoya-dark overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zoya-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zoya-secondary/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-lg flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h1 className="text-2xl font-display font-bold tracking-tight text-zoya-primary">
            KALPANA AI
          </h1>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
            AI Assistant • Live
          </span>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className="flex-1 w-full flex flex-col items-center justify-center gap-12 z-10">
        {/* Status Indicator */}
        <div className="flex flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm font-medium tracking-wide text-white/60"
            >
              {state === "disconnected" && "बात करने के लिए तैयार?"}
              {state === "connecting" && "Kalpana AI को जगा रहे हैं..."}
              {state === "listening" && "मैं सुन रही हूँ..."}
              {state === "speaking" && "Kalpana AI बोल रही है"}
              {state === "error" && error}
            </motion.div>
          </AnimatePresence>

          {/* Tool Call Notification */}
          <AnimatePresence>
            {lastToolCall && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-2 px-3 py-1 rounded-full bg-zoya-accent/20 border border-zoya-accent/40 text-[10px] text-zoya-accent uppercase tracking-widest"
              >
                Opening {lastToolCall.url}...
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="h-12 flex items-center">
            {(state === "listening" || state === "speaking") && (
              <Waveform 
                isActive={true} 
                color={state === "speaking" ? "#ec4899" : "#8b5cf6"} 
              />
            )}
          </div>
        </div>

        {/* Central Button */}
        <div className="relative group">
          {/* Outer Ring Animations */}
          <AnimatePresence>
            {(state === "listening" || state === "speaking") && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0.1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-zoya-primary"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 2, opacity: 0.05 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                  className="absolute inset-0 rounded-full bg-zoya-secondary"
                />
              </>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePower}
            className={`
              relative w-32 h-32 rounded-full flex items-center justify-center z-20
              transition-all duration-500
              ${state === "disconnected" ? "bg-white/10 border border-white/20" : ""}
              ${state === "connecting" ? "bg-zoya-secondary/20 border border-zoya-secondary/40 animate-pulse" : ""}
              ${state === "listening" ? "bg-zoya-secondary glow-purple border-none" : ""}
              ${state === "speaking" ? "bg-zoya-primary glow-pink border-none" : ""}
              ${state === "error" ? "bg-red-500/20 border border-red-500/40" : ""}
            `}
          >
            {state === "disconnected" || state === "error" ? (
              <Power size={48} className={state === "error" ? "text-red-500" : "text-white/80"} />
            ) : (
              <Mic size={48} className="text-white" />
            )}
          </motion.button>
        </div>

        {/* Personality Hint */}
        <div className="max-w-xs text-center">
          <p className="text-xs text-white/30 leading-relaxed italic">
            "मैं स्मार्ट हूँ, मैं सैसी हूँ, और मैं पूरी तरह से सुन रही हूँ। मुझे इंतज़ार मत करवाओ, जान।"
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg flex items-center justify-center z-10 py-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
          <Info size={14} className="text-zoya-primary" />
          <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">
            Powered by Gemini 3.1 Live
          </span>
        </div>
      </footer>
    </div>
  );
}
