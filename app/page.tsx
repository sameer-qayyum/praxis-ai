import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { Hero } from "@/components/hero";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PraxisLogo } from "@/components/praxis-logo";
import { ConnectSupabaseSteps } from "@/components/tutorial/connect-supabase-steps";
import { SignUpUserSteps } from "@/components/tutorial/sign-up-user-steps";
import { hasEnvVars } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-background">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-border h-16 bg-card">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <PraxisLogo size="lg" />
              <div className="flex items-center gap-2">
                <DeployButton />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <Hero />
          
          {/* Design System Showcase */}
          <section className="w-full">
            <h2 className="text-3xl font-bold text-praxis-700 dark:text-praxis-300 mb-8 text-center">Praxis Design System</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {/* Brand Colors Card */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-praxis-700 dark:text-praxis-300">Brand Colors</CardTitle>
                  <CardDescription>Praxis color palette</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-praxis"></div>
                    <span className="text-sm font-mono">#364F6B</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-praxis-light"></div>
                    <span className="text-sm font-mono">#EEDAD1</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-praxis-accent"></div>
                    <span className="text-sm font-mono">#F9B17A</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-praxis-dark"></div>
                    <span className="text-sm font-mono">#1B1F24</span>
                  </div>
                </CardContent>
              </Card>

              {/* Typography Card */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-praxis-700 dark:text-praxis-300">Typography</CardTitle>
                  <CardDescription>Geist font family</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-3xl font-bold text-praxis-700 dark:text-praxis-300">Heading</div>
                  <div className="text-lg font-semibold text-foreground">Subheading</div>
                  <div className="text-base text-muted-foreground">Body text with excellent readability and modern styling.</div>
                  <div className="text-sm text-muted-foreground">Small text for captions</div>
                </CardContent>
              </Card>

              {/* Components Card */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-praxis-700 dark:text-praxis-300">Components</CardTitle>
                  <CardDescription>UI component examples</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full bg-praxis-700 hover:bg-praxis-800 dark:bg-praxis-500 dark:hover:bg-praxis-600">Primary Button</Button>
                  <Button variant="secondary" className="w-full">Secondary Button</Button>
                  <Button variant="outline" className="w-full border-praxis-700 text-praxis-700 hover:bg-praxis-700 hover:text-white dark:border-praxis-400 dark:text-praxis-400 dark:hover:bg-praxis-500 dark:hover:text-white">Outline Button</Button>
                </CardContent>
              </Card>
            </div>
          </section>
          
          <main className="flex-1 flex flex-col gap-6 px-4">
            <h2 className="font-medium text-xl mb-4 text-praxis-700 dark:text-praxis-300">Next steps</h2>
            {hasEnvVars ? <SignUpUserSteps /> : <ConnectSupabaseSteps />}
          </main>
        </div>

        <footer className="w-full flex items-center justify-center border-t border-border bg-card mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">
            Powered by{" "}
            <a
              href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
              target="_blank"
              className="font-bold hover:underline text-praxis-700 hover:text-praxis-accent dark:text-praxis-300 dark:hover:text-praxis-accent transition-colors"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Theme:</span>
            <ThemeSwitcher />
          </div>
        </footer>
      </div>
    </main>
  );
}
