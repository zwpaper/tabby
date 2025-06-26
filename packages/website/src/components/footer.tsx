export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-6xl px-2 py-6 md:px-6">
        <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} TabbyML, Inc. All rights reserved.
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <a
              href="https://www.getpochi.com/term-of-service"
              className="whitespace-nowrap text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
              Terms of Service
            </a>
            <a
              href="https://www.getpochi.com/privacy-policy"
              className="whitespace-nowrap text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
