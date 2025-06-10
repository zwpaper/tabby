import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { HomeBackgroundGradient } from "./constants";

export function HomeWaitlist() {
  const { navigate } = useRouter();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center text-black",
        HomeBackgroundGradient,
      )}
    >
      {/* Grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:50px_50px] opacity-20" />

      {/* Animated gradient orbs in background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1.5 }}
        className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-blue-100 blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-amber-100 blur-3xl"
      />

      {/* Main content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex max-w-3xl flex-col items-center px-4 sm:px-6"
      >
        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          className="mb-6 whitespace-normal font-bold text-[28px] text-gray-800 sm:whitespace-nowrap sm:text-4xl md:text-5xl lg:text-6xl"
        >
          🤖 Your AI Teammate That Actually Gets It
        </motion.h1>

        {/* Subheading */}
        <motion.h2
          variants={itemVariants}
          className="mb-8 whitespace-normal font-semibold text-gray-700 text-xl sm:whitespace-nowrap sm:text-2xl md:text-3xl"
        >
          Pochi works like your best full-stack engineering buddy{" "}
          <motion.span
            animate={{
              y: [0, -8, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="inline-block"
          >
            ✨
          </motion.span>
        </motion.h2>

        {/* Features List */}
        <motion.div
          variants={itemVariants}
          className="mb-8 max-w-2xl space-y-4 text-left"
        >
          <div className="flex items-start gap-3 text-gray-700 text-lg">
            <span className="text-2xl">🔧</span>
            <span>Reads your full codebase and remembers your patterns</span>
          </div>
          <div className="flex items-start gap-3 text-gray-700 text-lg">
            <span className="text-2xl">🎨</span>
            <span>Turns Figma screenshots into real React components</span>
          </div>
          <div className="flex items-start gap-3 text-gray-700 text-lg">
            <span className="text-2xl">🐛</span>
            <span>Traces bugs with full project context</span>
          </div>
          <div className="flex items-start gap-3 text-gray-700 text-lg">
            <span className="text-2xl">📱</span>
            <span>
              Builds full features so you can focus on the core architecture
            </span>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.p
          variants={itemVariants}
          className="mb-10 max-w-2xl text-center font-medium text-gray-700 text-xl"
        >
          Upgrade from AI assistant to a real teammate. Start building with
          Pochi!
        </motion.p>

        {/* Waitlist Button */}
        <motion.div
          variants={itemVariants}
          className="mb-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row"
        >
          <motion.div
            whileHover={{
              scale: 1.05,
              boxShadow:
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <Button
              onClick={() =>
                navigate({
                  to: "/auth/$pathname",
                  params: { pathname: "sign-up" },
                })
              }
              size="lg"
              className="w-full bg-amber-600 px-8 py-6 font-medium text-lg text-white transition-all hover:bg-amber-700"
            >
              Join the Waitlist 🚀
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
