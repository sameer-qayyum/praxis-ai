import { NextLogo } from "./next-logo";
import { SupabaseLogo } from "./supabase-logo";
import { PraxisLogo } from "./praxis-logo";

export function Hero() {
  return (
    <div className="flex flex-col gap-16 items-center">
      {/* Praxis AI Hero */}
      <div className="flex flex-col items-center gap-8">
        <PraxisLogo size="lg" showText={false} disableLink={true} className="animate-pulse" />
        <div className="text-center">
          <h1 className="text-5xl lg:text-6xl font-bold text-praxis-700 dark:text-praxis-200 mb-4">
            Praxis AI
          </h1>
          <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
            Advanced AI-powered platform for intelligent automation and insights
          </p>
        </div>
      </div>
      
      {/* Tech Stack */}
      <div className="flex gap-8 justify-center items-center opacity-60">
        <a
          href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
          target="_blank"
          rel="noreferrer"
          className="hover:opacity-100 transition-opacity"
        >
          <SupabaseLogo />
        </a>
        <span className="border-l rotate-45 h-6 border-border" />
        <a 
          href="https://nextjs.org/" 
          target="_blank" 
          rel="noreferrer"
          className="hover:opacity-100 transition-opacity"
        >
          <NextLogo />
        </a>
      </div>
      
      <p className="text-lg text-center text-muted-foreground max-w-2xl">
        Built with{" "}
        <a
          href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
          target="_blank"
          className="font-bold hover:underline text-praxis-700 hover:text-praxis-accent dark:text-praxis-300 dark:hover:text-praxis-accent transition-colors"
          rel="noreferrer"
        >
          Supabase
        </a>{" "}
        and{" "}
        <a
          href="https://nextjs.org/"
          target="_blank"
          className="font-bold hover:underline text-praxis-700 hover:text-praxis-accent dark:text-praxis-300 dark:hover:text-praxis-accent transition-colors"
          rel="noreferrer"
        >
          Next.js
        </a>
      </p>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
