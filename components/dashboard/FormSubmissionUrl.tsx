"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Copy, CheckCircle, RefreshCw } from "lucide-react";
import crypto from "crypto";

interface FormSubmissionUrlProps {
  appId: string;
}

export function FormSubmissionUrl({ appId }: FormSubmissionUrlProps) {
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  const supabase = createClientComponentClient();

  const fetchPathSecret = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Query the apps table to get the path_secret
      const { data, error } = await supabase
        .from('apps')
        .select('path_secret')
        .eq('id', appId)
        .single();
        
      if (error) throw error;
      
      if (!data?.path_secret) {
        // Path secret doesn't exist yet, generate it
        const { data: updatedData, error: updateError } = await supabase
          .rpc('regenerate_app_secret', { p_app_id: appId });
          
        if (updateError) throw updateError;
        
        // Re-fetch the app to get the newly generated secret
        const { data: refetchData, error: refetchError } = await supabase
          .from('apps')
          .select('path_secret')
          .eq('id', appId)
          .single();
          
        if (refetchError) throw refetchError;
        
        if (refetchData?.path_secret) {
          const url = `${window.location.protocol}//${window.location.host}/api/public/forms/${appId}/${refetchData.path_secret}/submit`;
          setFormUrl(url);
        } else {
          throw new Error("Failed to generate path secret");
        }
      } else {
        // Path secret already exists
        const url = `${window.location.protocol}//${window.location.host}/api/public/forms/${appId}/${data.path_secret}/submit`;
        setFormUrl(url);
      }
    } catch (err) {
      console.error("Error fetching form submission URL:", err);
      setError("Failed to get form submission URL");
    } finally {
      setLoading(false);
    }
  };

  const regenerateSecret = async () => {
    setRegenerating(true);
    
    try {
      // Generate a new secure random path_secret (32 character hex string)
      const newPathSecret = crypto.randomBytes(16).toString('hex');
      
      // Update the app's path_secret directly
      const { error } = await supabase
        .from('apps')
        .update({ path_secret: newPathSecret })
        .eq('id', appId);
        
      if (error) throw error;
      
      // Re-fetch to get the new URL
      await fetchPathSecret();
    } catch (err) {
      console.error("Error regenerating secret:", err);
      setError("Failed to regenerate secret");
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!formUrl) return;
    
    navigator.clipboard.writeText(formUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy URL:", err);
      });
  };

  useEffect(() => {
    if (appId) {
      fetchPathSecret();
    }
  }, [appId]);

  return (
    <Card className="w-full mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Form Submission URL
          <Button 
            variant="outline" 
            size="sm" 
            onClick={regenerateSecret} 
            disabled={regenerating || loading}
          >
            {regenerating ? "Regenerating..." : "Regenerate Secret"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <div className="h-5 w-5 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
            <span className="ml-2">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="flex space-x-2 items-center">
            <Input 
              value={formUrl || ""}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={copyToClipboard}
              className="h-10 px-3"
              aria-label="Copy URL"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-3">
          Use this URL for public form submissions. Anyone with this URL can submit data to your Google Sheet, 
          so keep it private or regenerate it if needed.
        </p>
      </CardContent>
    </Card>
  );
}
