import { LiveAPIProvider } from "@/hooks/live/use-live-api-context";
import type { LiveClientOptions } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { MediaInput, itemVariants } from "./media-input";
import { ToolCallComponnet } from "./tool-call";

const apiOptions: LiveClientOptions = {
  apiKey: "", // set to empty to make it work on browser
};

export const LivePage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <LiveAPIProvider options={apiOptions}>
      <div className="flex min-h-screen flex-col items-center bg-gray-50 p-6 pt-12 dark:bg-gray-900">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-4xl"
        >
          <motion.h1
            variants={itemVariants}
            className="mb-8 text-center font-bold text-4xl text-gray-900 sm:text-5xl md:text-6xl dark:text-gray-100"
          >
            Talk to Pochi live
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 text-sm dark:bg-gray-700 dark:text-gray-300">
              Beta
            </span>
          </motion.h1>

          <div className="h-fit w-full">
            <ToolCallComponnet />
            <video
              className={cn(
                "my-8 h-full w-full rounded-lg border-2 border-gray-300 shadow-lg dark:border-gray-600",
                {
                  hidden: !videoRef.current || !videoStream,
                },
              )}
              ref={videoRef}
              autoPlay
              playsInline
              muted
            />
            {/* <Transcription /> */}
          </div>
        </motion.div>
        <MediaInput videoRef={videoRef} onVideoStreamChange={setVideoStream} />
      </div>
    </LiveAPIProvider>
  );
};
