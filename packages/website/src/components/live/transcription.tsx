import { useLiveAPIContext } from "@/hooks/live/use-live-api-context";
import { AnimatePresence, motion } from "framer-motion";

export const Transcription = () => {
  const { transcription } = useLiveAPIContext();
  return (
    <AnimatePresence>
      {transcription && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-4 text-center text-gray-700 text-lg dark:text-gray-300"
        >
          {transcription}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
