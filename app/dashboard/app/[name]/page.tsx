'use client';

import React, { useEffect, useState, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';

interface AppData {
  id: string;
  chat_id: string;
  v0_project_id: string;
  vercel_project_id: string;
  preview_url: string;
  vercel_deployment_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  name: string;
  status: string;
  google_sheet: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  files?: Array<{
    name?: string;
    meta?: {
      file?: string;
      lang?: string;
    };
    source?: string;
    content?: string;
  }>;
}

interface ChatResponse {
  id: string;
  text?: string;
  files?: Array<{
    name?: string;
    meta?: {
      file?: string;
      lang?: string;
    };
    source?: string;
    content?: string;
  }>;
}

const AppPage = () => {
  const params = useParams();
  const { name } = params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState('preview');
  const [isDeploying, setIsDeploying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { toast } = useToast();


  // Fetch app data
  const { data: app, isLoading: isLoadingApp, error: appError } = useQuery({
    queryKey: ['app', name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('id', name)
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data as AppData;
    }
  });

  // Fetch chat messages
  const { data: chatData, isLoading: isLoadingChat, refetch: refetchChat } = useQuery({
    queryKey: ['chat', app?.chat_id],
    queryFn: async () => {
      if (!app?.chat_id) return null;

      const response = await fetch(`/api/v0/messages?chatId=${app.chat_id}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat messages');
      }
      
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!app?.chat_id
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (newMessage: string) => {
      if (!app?.chat_id) return null;

      const response = await fetch('/api/v0/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: app.chat_id,
          message: newMessage,
          isFollowUp: true,
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      refetchChat();
      setMessage('');
    },
    onError: (error: unknown) => {
      toast.error('Error', {
        description: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Deploy/redeploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!app) return null;

      setIsDeploying(true);
      const response = await fetch('/api/v0/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: app.chat_id,
          name: app.name || `App-${app.id}`,
          projectId: app.v0_project_id,
          vercelProjectId: app.vercel_project_id || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to deploy app');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast.success('Deployment Successful', {
        description: `Your app has been deployed to ${data.url}`
      });
      setIsDeploying(false);
    },
    onError: (error: unknown) => {
      toast.error('Deployment Failed', {
        description: `Failed to deploy app: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setIsDeploying(false);
    }
  });

  // Update messages when chat data changes
  useEffect(() => {
    if (chatData) {
      const formattedMessages = chatData.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        files: msg.files || []
      }));
      setMessages(formattedMessages);
    }
  }, [chatData]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message);
    }
  };

  const handleDeploy = () => {
    if (!isDeploying && !deployMutation.isPending) {
      deployMutation.mutate();
    }
  };

  if (isLoadingApp) {
    return (
      <div className="flex flex-col space-y-4 p-6">
        <Skeleton className="h-12 w-3/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (appError || !app) {
    return notFound();
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{app.name || `App ${app.id}`}</h1>
          <div className="flex items-center mt-1 space-x-2">
            <Badge variant={app.preview_url ? 'default' : 'secondary'}>
              {app.preview_url ? 'Deployed' : 'Not Deployed'}
            </Badge>
            {app.google_sheet && (
              <Badge variant="outline">Google Sheet Connected</Badge>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {app.preview_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={app.preview_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                Open App
              </a>
            </Button>
          )}
          <Button 
            onClick={handleDeploy} 
            disabled={isDeploying || deployMutation.isPending}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${isDeploying ? 'animate-spin' : ''}`} />
            {app.preview_url ? 'Redeploy' : 'Deploy'} App
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="preview">App Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* App Preview or Code */}
          <div className="order-2 md:order-1">
            <TabsContent value="preview" className="m-0">
              <Card className="border overflow-hidden" style={{ height: '700px' }}>
                {app.preview_url ? (
                  <iframe 
                    src={app.preview_url} 
                    title="App Preview" 
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="text-center p-6">
                      <h3 className="text-lg font-medium">App not deployed yet</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Deploy your app to see a preview here
                      </p>
                      <Button 
                        onClick={handleDeploy} 
                        className="mt-4"
                        disabled={isDeploying}
                      >
                        <RefreshCw className={`mr-1 h-4 w-4 ${isDeploying ? 'animate-spin' : ''}`} />
                        Deploy Now
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="code" className="m-0">
              <Card style={{ height: '700px' }}>
                <CardHeader>
                  <CardTitle>Generated Code</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px] p-4">
                    {messages.length > 0 ? (
                      <div className="space-y-6">
                        {messages.map((msg) => 
                          msg.files && msg.files.length > 0 ? (
                            <div key={`${msg.id}-files`} className="space-y-4">
                              {msg.files.map((file, index) => (
                                <div key={`${msg.id}-file-${index}`} className="border rounded-md overflow-hidden">
                                  <div className="bg-muted px-3 py-2 text-sm font-mono">
                                    {file.meta?.file || file.name || `File ${index + 1}`}
                                  </div>
                                  <pre className="p-4 overflow-auto text-sm">
                                    <code>{file.source || file.content || ''}</code>
                                  </pre>
                                </div>
                              ))}
                            </div>
                          ) : null
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No code files available</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
          
          {/* Chat Interface */}
          <Card className="order-1 md:order-2" style={{ height: '700px' }}>
            <CardHeader className="pb-3">
              <CardTitle>Chat with V0</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px] px-4">
                {isLoadingChat ? (
                  <div className="space-y-4 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    {messages.length > 0 ? (
                      messages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                        >
                          {msg.role === 'assistant' && (
                            <Avatar>
                              <AvatarImage src="/images/v0-logo.png" alt="V0 AI" />
                              <AvatarFallback>V0</AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                            msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground ml-auto' 
                              : 'bg-muted'
                          }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                          
                          {msg.role === 'user' && (
                            <Avatar>
                              <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No messages yet</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <Separator />
            <CardFooter className="pt-4">
              <form onSubmit={handleSendMessage} className="w-full flex gap-2">
                <Textarea
                  placeholder="Ask about your app or request changes..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 min-h-10 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={!message.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </Tabs>
    </div>
  );
};

export default AppPage;