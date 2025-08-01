"use client"
import { HideFooterWrapper } from "@/components/dashboard/HideFooterWrapper";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout doesn't include the footer, but will inherit everything else from the parent dashboard layout
  return (
    <HideFooterWrapper>
      {/* Render the children directly without a footer */}
      {children}
    </HideFooterWrapper>
  );
}
