import { useLiveAPIContext } from "@/hooks/live/use-live-api-context";
import type { UseMediaStreamResult } from "@/hooks/live/use-media-stream-mux";
import { useScreenCapture } from "@/hooks/live/use-screen-capture";
import { useWebcam } from "@/hooks/live/use-webcam";
import { AudioRecorder } from "@/lib/live/audio-recorder";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUp, Mic, Monitor, PauseIcon, Plus, Video } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export type MediaInputProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoStreamChange: (stream: MediaStream | null) => void;
  enableEditingSettings?: boolean;
};

export const MediaInput: React.FC<MediaInputProps> = ({
  videoRef,
  onVideoStreamChange,
}) => {
  const [prompt, setPrompt] = useState("");

  const videoStreams = [useWebcam(), useScreenCapture()];
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  const [webcam, screenCapture] = videoStreams;
  const [inVolume, setInVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect, volume } =
    useLiveAPIContext();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(5, Math.min(inVolume * 200, 8))}px`,
    );
  }, [inVolume]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on("data", onData);
      audioRecorder.on("volume", setInVolume);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off("data", onData);
      audioRecorder.off("volume", setInVolume);
    };
  }, [connected, client, muted, audioRecorder]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      if (canvas.width + canvas.height > 0) {
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 1.0);
        const data = base64.slice(
          base64.indexOf(",") + 1,
          Number.POSITIVE_INFINITY,
        );
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }
      if (connected) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
      }
    }
    if (connected && activeVideoStream !== null) {
      requestAnimationFrame(sendVideoFrame);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, activeVideoStream, client, videoRef.current]);

  //handler for swapping from one video-stream to the next
  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    if (next) {
      const mediaStream = await next.start();
      setActiveVideoStream(mediaStream);
      onVideoStreamChange(mediaStream);
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }
    // biome-ignore lint/complexity/noForEach: <explanation>
    videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
  };

  const handleSubmit = useCallback(async () => {
    setPrompt("");

    if (connected) {
      await disconnect();
    } else {
      await connect();
      if (prompt && prompt.trim().length > 0) {
        client.send([{ text: prompt }]);
      }
    }
  }, [connected, disconnect, client.send, prompt, connect]);

  return (
    <>
      <motion.div
        variants={itemVariants}
        className="mb-8 w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800"
      >
        <canvas style={{ display: "none" }} ref={renderCanvasRef} />
        {/* Input Area */}
        <div className="mb-6">
          <div className="relative flex items-center gap-3">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Start typing a prompt"
              className="border-none bg-transparent text-lg shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }
              }}
            />

            <div className="flex items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleSubmit}
                  size="icon"
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-full text-white transition-all disabled:opacity-50",
                    connected
                      ? "bg-orange-400 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600"
                      : "bg-orange-400 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600",
                  )}
                  style={
                    connected
                      ? {
                          boxShadow:
                            connected && volume > 0.02
                              ? "0 0 var(--volume, 5px) rgba(251, 146, 60, 0.6), 0 0 calc(var(--volume, 5px) * 2) rgba(251, 146, 60, 0.4), 0 0 calc(var(--volume, 5px) * 3) rgba(251, 146, 60, 0.2)"
                              : undefined,
                          transform:
                            connected && volume > 0.01
                              ? `scale(${1 + volume * 0.2})`
                              : undefined,
                          backgroundColor:
                            connected && volume > 0.01
                              ? `rgba(251, 146, 60, ${Math.max(0.8, 0.8 + volume * 0.3)})`
                              : undefined,
                          transition: connected
                            ? "all 0.1s ease-out"
                            : undefined,
                        }
                      : undefined
                  }
                >
                  {connected ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  {connected && volume > 0.02 && (
                    <>
                      <div
                        className="absolute inset-0 animate-ping rounded-full border-2 border-orange-300"
                        style={{
                          animationDuration: `${Math.max(0.4, 2 - volume * 3)}s`,
                          opacity: Math.max(0.2, volume * 2),
                        }}
                      />
                      <div
                        className="absolute inset-[-4px] animate-pulse rounded-full border border-orange-200"
                        style={{
                          animationDuration: `${Math.max(1, 3 - volume * 5)}s`,
                          opacity: Math.max(0.15, volume * 1.5),
                        }}
                      />
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Function Controls */}
        <div className="flex items-center gap-3">
          {/* Talk Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => setMuted(!muted)}
              className={cn(
                "relative overflow-hidden rounded-full border px-4 py-2 font-medium transition-all",
                !muted
                  ? "voice-animated border-blue-500 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                  : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
              style={{
                boxShadow:
                  !muted && inVolume > 0.02
                    ? "0 0 var(--volume, 5px) rgba(59, 130, 246, 0.6), 0 0 calc(var(--volume, 5px) * 2) rgba(59, 130, 246, 0.3), 0 0 calc(var(--volume, 5px) * 3) rgba(59, 130, 246, 0.1)"
                    : undefined,
                transform:
                  !muted && inVolume > 0.01
                    ? `scale(${1 + inVolume * 0.3})`
                    : undefined,
                backgroundColor:
                  !muted && inVolume > 0.01
                    ? `rgba(59, 130, 246, ${Math.max(0.1, 0.1 + inVolume * 0.5)})`
                    : !muted
                      ? "rgba(59, 130, 246, 0.05)"
                      : undefined,
                transition: !muted ? "all 0.1s ease-out" : undefined,
              }}
            >
              <Mic className="h-4 w-4" />
              Talk
              {!muted && inVolume > 0.02 && (
                <>
                  <div
                    className="absolute inset-0 animate-ping rounded-full border-2 border-blue-400"
                    style={{
                      animationDuration: `${Math.max(0.4, 2 - inVolume * 3)}s`,
                      opacity: Math.max(0.2, inVolume * 2),
                    }}
                  />
                  <div
                    className="absolute inset-[-4px] animate-pulse rounded-full border border-blue-300"
                    style={{
                      animationDuration: `${Math.max(1, 3 - inVolume * 5)}s`,
                      opacity: Math.max(0.15, inVolume * 1.5),
                    }}
                  />
                </>
              )}
            </Button>
          </motion.div>

          {/* Webcam Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => {
                console.log("webcam", webcam.isStreaming);
                webcam.isStreaming
                  ? changeStreams()()
                  : changeStreams(webcam)();
              }}
              className={cn(
                "rounded-full border px-4 py-2 font-medium transition-all",
                webcam.isStreaming
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              <Video className="h-4 w-4" />
              Webcam
            </Button>
          </motion.div>

          {/* Share Screen Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => {
                screenCapture.isStreaming
                  ? changeStreams()()
                  : changeStreams(screenCapture)();
              }}
              className={cn(
                "rounded-full border px-4 py-2 font-medium transition-all",
                screenCapture.isStreaming
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              <Monitor className="h-4 w-4" />
              Share Screen
            </Button>
          </motion.div>
        </div>
      </motion.div>
      {/* Suggestion Buttons */}
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-3"
      >
        <Button
          variant="outline"
          className="rounded-full border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setPrompt("Help me debug my React component")}
        >
          <Plus className="h-4 w-4" />
          Debug Code
        </Button>

        <Button
          variant="outline"
          className="rounded-full border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setPrompt("Explain this algorithm to me")}
        >
          <Plus className="h-4 w-4" />
          Explain Algorithm
        </Button>

        <Button
          variant="outline"
          className="rounded-full border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setPrompt("Review my code for best practices")}
        >
          <Plus className="h-4 w-4" />
          Code Review
        </Button>

        <Button
          variant="outline"
          className="rounded-full border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setPrompt("Help me optimize this database query")}
        >
          <Plus className="h-4 w-4" />
          Optimize Query
        </Button>
      </motion.div>
    </>
  );
};
