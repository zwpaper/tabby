import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function SiteHeader({ title }: { title?: string }) {
  const isMobile = useIsMobile();

  const sidebarToggle = (
    <>
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-2 data-[orientation=vertical]:h-4"
      />
    </>
  );
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-2">
        {isMobile && sidebarToggle}
        <h1 className="font-medium text-base">{title}</h1>
      </div>
    </header>
  );
}
