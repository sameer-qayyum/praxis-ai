"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface GoogleAuthButtonProps {
  mode?: "signin" | "signup";
  className?: string;
}

export function GoogleAuthButton({ 
  mode = "signin", 
  className 
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleAuth = async () => {
    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google auth error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={className}
      onClick={handleGoogleAuth}
      disabled={isLoading}
      type="button"
    >
      <svg
        className="mr-2 h-4 w-4"
        aria-hidden="true"
        focusable="false"
        data-prefix="fab"
        data-icon="google"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 488 512"
      >
        <path
          fill="currentColor"
          d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h240z"
        />
      </svg>
      {isLoading 
        ? "Connecting..." 
        : mode === "signup" 
          ? "Sign up with Google" 
          : "Sign in with Google"
      }
    </Button>
  );
}
