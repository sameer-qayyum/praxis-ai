import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserDropdown } from "@/components/dashboard/user-dropdown";
import { FeedbackButton } from "@/components/dashboard/feedback-button";
import { GoogleSheetsClientProvider } from "@/components/providers/GoogleSheetsClientProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  // If not authenticated, redirect to home page
  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block h-screen bg-background">
        <DashboardSidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 h-screen overflow-y-auto">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 h-14 bg-background">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <MobileNav />
              </div>
              <div className="md:block hidden">
                {/* Title shown on larger screens */}
               
              </div>
            </div>
            <div className="flex items-center gap-4">
              <FeedbackButton />
              <UserDropdown user={session?.user} />
            </div>
          </div>
        </header>
        
        {/* Main content area */}
        <main className="flex-1 p-6 bg-white dark:bg-slate-900 m-4 rounded-lg shadow-sm overflow-y-auto">
          <GoogleSheetsClientProvider>
            {children}
          </GoogleSheetsClientProvider>
        </main>

        {/* Footer */}
        <footer className="py-3 bg-white dark:bg-slate-900 mx-4 mb-4 rounded-lg text-center text-sm text-muted-foreground">
          <div className="flex justify-center items-center gap-6">
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</a>
            <a href="/faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/legal" className="hover:text-foreground transition-colors">Legal</a>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/community" className="hover:text-foreground transition-colors">Praxis Community</a>
            <a href="https://praxis.ai" className="hover:text-foreground transition-colors flex items-center gap-1">
              Praxis
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
