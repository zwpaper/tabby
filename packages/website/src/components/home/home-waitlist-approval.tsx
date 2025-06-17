import { UserButton } from "@/components/user-button";
import { cn } from "@/lib/utils";
import { SocialLinks } from "@ragdoll/common";
import { HomeBackgroundGradient } from "./constants";
export function HomeWaitlistApproval() {
  return (
    <div className={cn("relative min-h-screen", HomeBackgroundGradient)}>
      {/* User button in top-right corner */}
      <div className="absolute top-6 right-6 z-10">
        <UserButton
          size="icon"
          disableDefaultLinks
          classNames={{
            content: {
              base: "mr-10",
            },
            base: "border",
            trigger: {
              avatar: {
                base: "transition-transform hover:scale-105",
              },
            },
          }}
        />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <h1 className="mb-6 font-bold text-3xl text-gray-900 dark:text-gray-100">
            🎉 You're In – Thanks for Signing Up!
          </h1>

          <div className="mb-8 space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              We are gradually opening up early access to a small group of
              developers who want to be part of our Research Preview.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              If you're excited to explore what we're building and help shape it
              with feedback, we'd love to have you in the first wave.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Join our Discord to connect with the team and other early users.
            </p>
            <p className="font-semibold text-gray-800 dark:text-gray-200">
              Just DM us{" "}
              <span className="rounded bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-gray-800">
                WAITLIST
              </span>{" "}
              once you are in to fast-track your access.
            </p>
            <p className="font-medium text-amber-600">
              ⚡ We are approving a limited batch every week - hope to see you
              there!
            </p>
          </div>

          {/* Discord focused call-to-action */}
          <div className="mb-8">
            <div className="flex justify-center">
              <a
                href={SocialLinks.Discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex transform items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-colors transition-transform hover:scale-105 hover:bg-indigo-700 hover:shadow-xl"
                aria-label="Join our Discord server"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="icon icon-tabler icons-tabler-filled icon-tabler-brand-discord"
                >
                  <title>Discord Logo</title>
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M14.983 3l.123 .006c2.014 .214 3.527 .672 4.966 1.673a1 1 0 0 1 .371 .488c1.876 5.315 2.373 9.987 1.451 12.28c-1.003 2.005 -2.606 3.553 -4.394 3.553c-.732 0 -1.693 -.968 -2.328 -2.045a21.512 21.512 0 0 0 2.103 -.493a1 1 0 1 0 -.55 -1.924c-3.32 .95 -6.13 .95 -9.45 0a1 1 0 0 0 -.55 1.924c.717 .204 1.416 .37 2.103 .494c-.635 1.075 -1.596 2.044 -2.328 2.044c-1.788 0 -3.391 -1.548 -4.428 -3.629c-.888 -2.217 -.39 -6.89 1.485 -12.204a1 1 0 0 1 .371 -.488c1.439 -1.001 2.952 -1.459 4.966 -1.673a1 1 0 0 1 .935 .435l.063 .107l.651 1.285l.137 -.016a12.97 12.97 0 0 1 2.643 0l.134 .016l.65 -1.284a1 1 0 0 1 .754 -.54l.122 -.009zm-5.983 7a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15zm6 0a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15z" />
                </svg>
                <span>Join Discord</span>
              </a>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-500 text-sm dark:text-gray-400">
              Questions? Contact us at{" "}
              <a
                href="mailto:support@getpochi.com"
                className="text-blue-500 hover:underline dark:text-blue-400"
              >
                support@getpochi.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
