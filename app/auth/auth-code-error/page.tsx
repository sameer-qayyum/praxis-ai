import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuthCodeErrorProps {
  searchParams: { error?: string }
}

export default function AuthCodeError({ searchParams }: AuthCodeErrorProps) {
  const error = searchParams.error;
  
  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case 'access_denied':
        return 'You cancelled the authentication process.';
      case 'session_exchange_failed':
        return 'Failed to create your session. Please try again.';
      case 'no_session':
        return 'Authentication succeeded but no session was created.';
      case 'no_code':
        return 'No authorization code was received from Google.';
      case 'unexpected':
        return 'An unexpected error occurred during authentication.';
      default:
        return 'There was a problem with your authentication request.';
    }
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Authentication Error</CardTitle>
          <CardDescription>
            {getErrorMessage(error)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-mono text-muted-foreground">
                Error code: {error}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            The authentication process was interrupted or failed. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Network connectivity issues</li>
            <li>Browser security settings</li>
            <li>Session timeout</li>
            <li>Google OAuth configuration issues</li>
          </ul>
          <div className="flex flex-col gap-2 pt-4">
            <Button asChild>
              <Link href="/auth/login">Try Again</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
