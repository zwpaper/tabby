import { UserButton } from "@/components/user-button";
import { cn } from "@/lib/utils";
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
        <div className="w-full max-w-md text-center">
          <h1 className="mb-6 font-bold text-3xl text-gray-900">
            Welcome to Pochi!
          </h1>

          <div className="mb-8">
            <p className="mb-2 text-gray-700">
              Thanks for your registration! Your account has been created and
              added to our waitlist.
            </p>
            <p className="text-gray-600">
              We're rolling out access gradually and will notify you once you're
              approved.
            </p>
          </div>

          {/* Social links with minimal styling */}
          <div className="mb-8 py-5">
            <p className="mb-4 text-gray-600">Connect with our community</p>
            <div className="flex justify-center gap-4">
              <a
                href="https://x.com/GetPochi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-white transition-colors hover:bg-gray-800"
                aria-label="Follow us on X (Twitter)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                  role="img"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>Follow on X</span>
              </a>
              <a
                href="https://discord.gg/J3bhtn4H"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                aria-label="Join our Discord server"
              >
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="icon icon-tabler icons-tabler-filled icon-tabler-brand-discord"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M14.983 3l.123 .006c2.014 .214 3.527 .672 4.966 1.673a1 1 0 0 1 .371 .488c1.876 5.315 2.373 9.987 1.451 12.28c-1.003 2.005 -2.606 3.553 -4.394 3.553c-.732 0 -1.693 -.968 -2.328 -2.045a21.512 21.512 0 0 0 2.103 -.493a1 1 0 1 0 -.55 -1.924c-3.32 .95 -6.13 .95 -9.45 0a1 1 0 0 0 -.55 1.924c.717 .204 1.416 .37 2.103 .494c-.635 1.075 -1.596 2.044 -2.328 2.044c-1.788 0 -3.391 -1.548 -4.428 -3.629c-.888 -2.217 -.39 -6.89 1.485 -12.204a1 1 0 0 1 .371 -.488c1.439 -1.001 2.952 -1.459 4.966 -1.673a1 1 0 0 1 .935 .435l.063 .107l.651 1.285l.137 -.016a12.97 12.97 0 0 1 2.643 0l.134 .016l.65 -1.284a1 1 0 0 1 .754 -.54l.122 -.009zm-5.983 7a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15zm6 0a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15z" />
                </svg>
                <span>Join Discord</span>
              </a>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Questions? Contact us at{" "}
              <a
                href="mailto:support@getpochi.com"
                className="text-blue-500 hover:underline"
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
