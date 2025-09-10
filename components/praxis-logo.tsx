import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PraxisLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  disableLink?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8", 
  lg: "h-30 w-140"
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl"
};

export function PraxisLogo({ 
  className, 
  size = "md", 
  showText = true, 
  href = "/",
  disableLink = false
}: PraxisLogoProps) {
  const logoContent = (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="Praxis AI Logo"
        width={140}
        height={30}
        className={cn(sizeClasses[size], "object-contain")}
        priority
      />
     
    </div>
  );

  if (!disableLink) {
    return (
      <Link href={href} className="flex items-center">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
