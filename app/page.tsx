"use client";

import { useState } from "react";
import { PraxisLogo } from "@/components/praxis-logo";
import { Button } from "@/components/ui/button";
import { AppPreview } from "@/components/AppPreview";
import { AppSlideshow } from "@/components/AppSlideshow";
import { AppRequirementsDialog } from "@/components/AppRequirementsDialog";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <main className="min-h-screen flex flex-col items-center bg-background">
      <div className="flex-1 w-full flex flex-col items-center">
        {/* Simple Top Nav */}
        <nav className="w-full border-b border-border h-20 bg-card">
          <div className="w-full flex items-center px-5 text-sm h-full">
            <div className="flex gap-5 items-center font-semibold">
              <PraxisLogo size="lg" />
            </div>
          </div>
        </nav>

        <div className="flex-1 flex flex-col w-full max-w-6xl p-5">
          {/* Hero + Template Preview Split */}
          <section className="w-full pt-8 pb-12">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left: Compact Hero */}
              <div className="max-w-2xl">
                <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight mb-6">
                  Hi there 👋
                </h1>

                <div className="space-y-4 text-foreground/90 leading-relaxed">
                  <p className="text-lg font-semibold text-foreground">
                    Praxis is in <u>early stage</u> — and we want to <b>build it with you</b>.
                  </p>

                  <p>
                    You probably have a Google Sheet running part of your business. It works, but it's <i>messy</i>. 
                    What if you could wrap it in a proper interface?
                  </p>

                  <p className="text-foreground font-medium">
                    That's what <span className="underline decoration-2 decoration-praxis-700 dark:decoration-praxis-400">Praxis</span> does. 
                    Praxis turns your Google Sheet into a real app using plain english — no code, no changing how you work and in some cases no prompts.
                  </p>

                  <p className="font-medium">
                  Since Praxis is just getting started, we’ll personally build your first app <b className="text-praxis-700 dark:text-praxis-400">completely free</b>. 
                  No trial, no card, no catch. Plus <u>6 months free</u> if you decide to use Praxis.
                  </p>
                </div>
                
                <div className="mt-8">
                  <Button 
                    size="lg" 
                    className="text-base px-6 py-4 bg-praxis-700 hover:bg-praxis-800 dark:bg-praxis-500 dark:hover:bg-praxis-600"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    Build My App with Praxis →
                  </Button>
                </div>
              </div>

              {/* Right: Live Template Preview */}
              <AppSlideshow apps={[
                {
                  title: "Job Board",
                  url: "https://demo-kzmk15nwpqxtphogylpu.vusercontent.net",
                  description: "Complete job posting and application system"
                },
                {
                  title: "Waitlist Page", 
                  url: "https://v0-collab-match-waitlist-app.vercel.app",
                  description: "Beautiful waitlist with email collection"
                },
                {
                  title: "Product Management App",
                  url: "https://v0-product-management-tracker-app.vercel.app", 
                  description: "Track features, bugs, and product roadmap"
                },
                {
                  title: "Youtube Video Viral Potential Calculator",
                  url: "https://v0-yt-viral-potential-calculator-a.vercel.app",
                  description: "Analyze and predict video viral potential"
                },
                {
                  title: "WebPage Status Checker", 
                  url: "https://v0-webpages-status-app.vercel.app",
                  description: "Monitor website uptime and performance"
                },
                {
                  title: "Facebook Marketing Campaigns Metrics Dashboard",
                  url: "https://v0-facebook-campaigns-metric-track.vercel.app", 
                  description: "Track and analyze Facebook ad performance"
                }
              ]} />
            </div>
          </section>

          {/* Scroll Motivation: More Examples Teaser */}
          <section className="w-full py-8 border-t border-border/50">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Praxis has built apps for inventory tracking, customer CRMs, event management, and more...
              </p>
              <div className="flex justify-center items-center gap-2 text-sm text-praxis-700 dark:text-praxis-400 font-medium">
                <span>See more examples</span>
                <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </section>

          {/* Section 2 — Social Proof / Examples */}
          <section className="w-full">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Look what Praxis has already built for others</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Real apps, built from real Google Sheets, for real businesses. Each one took Praxis less than 24 hours to create.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Job Board",
                  url: "https://demo-kzmk15nwpqxtphogylpu.vusercontent.net",
                  description: "Complete job posting and application system"
                },
                {
                  title: "Waitlist Page", 
                  url: "https://v0-collab-match-waitlist-app.vercel.app",
                  description: "Beautiful waitlist with email collection"
                },
                {
                  title: "Product Management App",
                  url: "https://v0-product-management-tracker-app.vercel.app", 
                  description: "Track features, bugs, and product roadmap"
                }
              ].map((app, i) => (
                <AppPreview
                  key={i}
                  title={app.title}
                  url={app.url}
                  description={app.description}
                />
              ))}
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Each app connects directly to a Google Sheet • Built in under 24 hours • Click any preview to explore
              </p>
            </div>

            {/* More Examples Section */}
            <details className="mt-12">
              <summary className="cursor-pointer text-center text-praxis-700 dark:text-praxis-300 hover:underline font-medium text-lg mb-8">
                See more examples →
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Youtube Video Viral Potential Calculator",
                    url: "https://v0-yt-viral-potential-calculator-a.vercel.app",
                    description: "Analyze and predict video viral potential"
                  },
                  {
                    title: "WebPage Status Checker", 
                    url: "https://v0-webpages-status-app.vercel.app",
                    description: "Monitor website uptime and performance"
                  },
                  {
                    title: "Facebook Marketing Campaigns Metrics Dashboard",
                    url: "https://v0-facebook-campaigns-metric-track.vercel.app", 
                    description: "Track and analyze Facebook ad performance"
                  }
                ].map((app, i) => (
                  <AppPreview
                    key={i}
                    title={app.title}
                    url={app.url}
                    description={app.description}
                  />
                ))}
              </div>
            </details>
          </section>

          {/* Section 3 — Early Adopter Offer */}
          <section className="w-full flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Here's the deal</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                You have a Google Sheet that's running part of your business. Praxis will turn it into a proper app in 24 hours. 
                No waiting list, no "coming soon" — Praxis will actually build it.
              </p>
            </div>
            
            <div className="max-w-3xl w-full">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="space-y-3">
                  <div className="text-3xl">📋</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">1. Share your use case</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Share details about your Google Sheet and/or describe what you need. Praxis will figure out the rest.</p>
                </div>
                <div className="space-y-3">
                  <div className="text-3xl">⚡</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">2. Praxis builds it fast</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Within 24 hours, you'll have a real app with forms, dashboards, and everything connected to your sheet.</p>
                </div>
                <div className="space-y-3">
                  <div className="text-3xl">🎉</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">3. You can own it</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Full access to edit, customize. Free for 6 months because you're helping Praxis get better.</p>
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <Button 
                size="lg" 
                className="text-base md:text-lg px-8 py-6 bg-praxis-700 hover:bg-praxis-800 dark:bg-praxis-500 dark:hover:bg-praxis-600"
                onClick={() => setIsDialogOpen(true)}
              >
                Build My App with Praxis →
              </Button>
            </div>
          </section>

          {/* Section 4 — Personal Note */}
          <section className="w-full py-16">
            <div className="w-full max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 border-2 border-praxis-200 dark:border-praxis-700">
                  <Image
                    src="/sameer.jpg"
                    alt="Sameer, Founder of Praxis"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">A personal note from Sameer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Founder of Praxis</p>
              </div>
              <blockquote className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed text-center italic">
                "Look, I know you've probably seen a hundred 'revolutionary' tools that promise to change everything. 
                Most of them ask you to wait months, learn new systems, or completely change how you work.
              </blockquote>
              <blockquote className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed text-center italic mt-4">
                Praxis is different. We'll literally build your app this week. For free. Because we believe the best way to build something great 
                is to build it with real people who have real problems to solve.
              </blockquote>
              <blockquote className="text-lg text-gray-900 dark:text-gray-100 leading-relaxed text-center font-medium mt-4">
                Your feedback shapes what we build next. That's worth way more to us than any payment."
              </blockquote>
            </div>
            </div>
          </section>
        </div>

        {/* Section 5 — Footer */}
        <footer className="w-full border-t border-border bg-card">
          <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 p-5 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">© {new Date().getFullYear()} Praxis</span>
            </div>
            <nav className="flex items-center gap-6 text-muted-foreground">
              <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </nav>
          </div>
        </footer>
      </div>

      {/* App Requirements Dialog */}
      <AppRequirementsDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
      />
    </main>
  );
}
