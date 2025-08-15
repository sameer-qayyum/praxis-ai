import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v0 } from 'v0-sdk';

// Define interfaces for clarity
interface VercelFile {
  file: string;  // File path (e.g., 'app/page.tsx', 'package.json')
  data: string;  // File content as string
}

interface V0ChatResponse {
  id: string;
  url?: string;
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
  latestVersion?: {
    files?: Array<{
      name?: string;
      meta?: {
        file?: string;
      };
      source?: string;
      content?: string;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    console.log('[DEPLOY] Starting deployment request');

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      console.log('[DEPLOY] Authentication failed:', authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log('[DEPLOY] User authenticated:', session.user.id);

    // Get API key from environment (v0 SDK will use this)
    const v0ApiKey = process.env.V0_API_KEY;
    if (!v0ApiKey) {
      return NextResponse.json(
        { error: "Missing V0_API_KEY in server configuration" },
        { status: 500 }
      );
    }
    // Note: v0 SDK is imported as `v0` and used directly; no manual initialization call is required.

    // Parse and validate request body
    const body = await request.json()
    console.log('[DEPLOY] Request body:', JSON.stringify(body, null, 2));
    
    const { name, chatId, versionId, projectId, appId, templateId, googleSheetId, vercelProjectId } = body

    // Validate required fields
    if (!name || !chatId || !versionId) {
      console.log('[DEPLOY] Missing required fields:', { name: !!name, chatId: !!chatId, versionId: !!versionId });
      return NextResponse.json(
        { error: "Missing required fields: name, chatId, and versionId are required" },
        { status: 400 }
      )
    }
    console.log('[DEPLOY] Required fields validated:', { name, chatId, versionId });

    // Locate or create app row
    console.log('[DEPLOY] Looking for existing app row with:', { appId, chatId });
    let appIdToUse: string | null = appId ?? null;
    let appRow: any = null;
    let appRowExisted = false;
    try {
      if (appIdToUse) {
        const { data, error } = await supabase
          .from('apps')
          .select('*')
          .eq('id', appIdToUse)
          .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116: No rows
        appRow = data ?? null;
        if (appRow) {
          appRowExisted = true;
          console.log('[DEPLOY] Found existing app by ID:', appRow.id);
        } else {
          console.log('[DEPLOY] No app found by ID:', appIdToUse);
        }
      } else {
        const { data, error } = await supabase
          .from('apps')
          .select('*')
          .eq('chat_id', chatId)
          .limit(1)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        appRow = data ?? null;
        if (appRow) {
          appRowExisted = true;
          console.log('[DEPLOY] Found existing app by chatId:', appRow.id);
        } else {
          console.log('[DEPLOY] No app found by chatId:', chatId);
        }
      }

      if (!appRow) {
        const { data: createdApp, error: createErr } = await supabase
          .from('apps')
          .insert({
            chat_id: chatId,
            v0_project_id: null,
            created_by: session.user.id,
            updated_by: session.user.id,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        appIdToUse = createdApp.id;
        appRow = createdApp;
        console.log('[DEPLOY] Created new app row:', createdApp.id);
      } else {
        appIdToUse = appRow.id;
      }
    } catch (e) {
      console.error('Error locating/creating app row:', e);
      return NextResponse.json(
        { error: 'Failed to locate or create app record' },
        { status: 500 }
      );
    }

    // Flag for redeployment (based on whether an existing app row was updated vs created)
    const isRedeployment = appRowExisted;
    
    // Resolve v0 project ID: request > app row > create
    console.log('[DEPLOY] Resolving v0 project ID. Request projectId:', projectId, 'App v0_project_id:', appRow?.v0_project_id);
    let v0ProjectId: string | undefined = projectId;
    if (!v0ProjectId) {
      if (appRow?.v0_project_id) {
        v0ProjectId = appRow.v0_project_id as string;
        console.log('[DEPLOY] Using existing v0 project ID from app:', v0ProjectId);
      } else {
        // Create a new v0 project using SDK
        console.log('[DEPLOY] Creating new v0 project with name:', name);
        const createdProject = await v0.projects.create({ name });
        v0ProjectId = createdProject.id as string;
        console.log('[DEPLOY] Created new v0 project:', v0ProjectId);
      }
    } else {
      console.log('[DEPLOY] Using v0 project ID from request:', v0ProjectId);
    }
    // Ensure chat is linked to project
    console.log('[DEPLOY] Assigning chat to project:', { projectId: v0ProjectId, chatId });
    await v0.projects.assign({ projectId: v0ProjectId as string, chatId });
    console.log('[DEPLOY] Chat assigned to project successfully');
    // Persist v0_project_id on app row if needed
    if (!appRow?.v0_project_id || appRow.v0_project_id !== v0ProjectId) {
      const { data: updatedAppRow, error: updV0ProjErr } = await supabase
        .from('apps')
        .update({
          v0_project_id: v0ProjectId,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appIdToUse as string)
        .select()
        .single();
      if (!updV0ProjErr && updatedAppRow) {
        appRow = updatedAppRow;
      }
    }
    
    // Create deployment via v0 (v0 handles Vercel integration)
    console.log('[DEPLOY] Creating deployment with:', { projectId: v0ProjectId, chatId, versionId });
    
    // Use direct API call since v0.deployments.create doesn't exist in current SDK version
    const deploymentResponse = await fetch('https://api.v0.dev/v1/deployments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${v0ApiKey}`
      },
      body: JSON.stringify({
        projectId: v0ProjectId,
        chatId,
        versionId,
      })
    });
    
    if (!deploymentResponse.ok) {
      const errorText = await deploymentResponse.text();
      console.error('[DEPLOY] Deployment API error:', deploymentResponse.status, errorText);
      throw new Error(`Deployment failed: ${deploymentResponse.status} ${errorText}`);
    }
    
    const deployment = await deploymentResponse.json();
    console.log('[DEPLOY] Deployment created:', JSON.stringify(deployment, null, 2));
    
    // Check all possible URL fields in the deployment response
    console.log('[DEPLOY] Available URL fields:', {
      webUrl: deployment.webUrl,
      url: deployment.url,
      productionUrl: deployment.productionUrl,
      previewUrl: deployment.previewUrl,
      inspectorUrl: deployment.inspectorUrl,
      apiUrl: deployment.apiUrl
    });
    
    const deploymentId = (deployment as any).id as string;
    
    // Extract production URL from inspector URL
    let deploymentUrl = '';
    if (deployment.inspectorUrl) {
      // Extract project name from inspector URL: https://vercel.com/{team}/{project-name}/{deployment-id}
      const inspectorMatch = deployment.inspectorUrl.match(/vercel\.com\/[^\/]+\/([^\/]+)\//);
      if (inspectorMatch) {
        const projectName = inspectorMatch[1];
        deploymentUrl = `https://${projectName}.vercel.app`;
        console.log('[DEPLOY] Extracted production URL from inspector:', deploymentUrl);
      }
    }
    
    // Fallback to webUrl if extraction failed
    if (!deploymentUrl) {
      deploymentUrl = ((deployment as any).webUrl || (deployment as any).url || '') as string;
      if (deploymentUrl && !/^https?:\/\//i.test(deploymentUrl)) {
        deploymentUrl = `https://${deploymentUrl}`;
      }
      console.log('[DEPLOY] Using fallback webUrl:', deploymentUrl);
    }
    // v0 deployments don't directly expose vercelProjectId, so we'll keep it null for now
    const vercelProjectIdFromDeployment = null;
    
    console.log('[DEPLOY] Extracted deployment data:', {
      deploymentId,
      deploymentUrl,
      vercelProjectIdFromDeployment
    });
    
    // Store or update app information in the database
    let appData;
    
    if (isRedeployment) {
      // Update existing app
      const { data: updatedApp, error: updateError } = await supabase
        .from('apps')
        .update({
          vercel_deployment_id: deploymentId,
          app_url: deploymentUrl,
          status: 'deployed',
          updated_by: session.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', appIdToUse as string)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating app information:", updateError);
      } else {
        appData = updatedApp;
      }
    } else {
      // Upsert app record: update existing minimal row if found/created earlier, else insert
      if (appIdToUse) {
        const { data: updatedExisting, error: updErr } = await supabase
          .from('apps')
          .update({
            chat_id: chatId,
            v0_project_id: v0ProjectId,
            vercel_project_id: vercelProjectIdFromDeployment,
            template_id: templateId || null,
            google_sheet: googleSheetId || null,
            app_url: deploymentUrl,
            vercel_deployment_id: deploymentId,
            status: 'deployed',
            updated_by: session.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', appIdToUse)
          .select()
          .single();
        if (updErr) {
          console.error('Error updating existing app:', updErr);
        } else {
          appData = updatedExisting;
        }
      } else {
        const { data: newApp, error: insertError } = await supabase
          .from('apps')
          .insert({
            chat_id: chatId,
            v0_project_id: v0ProjectId,
            vercel_project_id: vercelProjectIdFromDeployment,
            template_id: templateId || null,
            google_sheet: googleSheetId || null,
            app_url: deploymentUrl,
            vercel_deployment_id: deploymentId,
            status: 'deployed',
            created_by: session.user.id,
            updated_by: session.user.id
          })
          .select()
          .single();
        if (insertError) {
          console.error("Error storing app information:", insertError);
        } else {
          appData = newApp;
        }
      }
    }

    // Return Response
    const response = {
      success: true,
      appId: (appData?.id || appIdToUse),
      v0ProjectId: v0ProjectId,
      vercelProjectId: vercelProjectIdFromDeployment,
      url: deploymentUrl,
      deploymentId: deploymentId,
      isRedeployment,
    };
    console.log('[DEPLOY] Deployment completed successfully:', response);
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[DEPLOY] Deployment error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

// Extract files from v0 chat response
function extractFiles(chat: V0ChatResponse): VercelFile[] {
  let files: VercelFile[] = [];
  
  // Primary source: chat.files
  if (chat.files && chat.files.length > 0) {
    files = chat.files.map((file) => ({
      file: file.meta?.file || file.name || 'app/page.tsx',
      data: file.source || file.content || ''
    }));
  }
  
  // Fallback: chat.latestVersion.files
  if (files.length === 0 && chat.latestVersion?.files) {
    files = chat.latestVersion.files.map((file) => ({
      file: file.meta?.file || file.name || 'app/page.tsx', 
      data: file.source || file.content || ''
    }));
  }
  
  return files;
}

// Add essential files if they're missing
async function addEssentialFiles(files: VercelFile[], projectName: string): Promise<VercelFile[]> {
  const fileNames = files.map(f => f.file);
  
  // Check for missing essential files
  const hasPackageJson = fileNames.some(name => name === 'package.json');
  const hasNextConfig = fileNames.some(name => name.includes('next.config'));
  const hasTsConfig = fileNames.some(name => name === 'tsconfig.json');
  const hasAppLayout = fileNames.some(name => name === 'app/layout.tsx');
  const hasGlobalsCSS = fileNames.some(name => name.includes('globals.css'));
  
  // Create copies to avoid mutating the input
  const result = [...files];
  
  // Add package.json if missing
  if (!hasPackageJson) {
    result.push({
      file: 'package.json',
      data: JSON.stringify({
        name: projectName.toLowerCase().replace(/\s+/g, '-'),
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          next: '14.0.0',
          react: '18.2.0',
          'react-dom': '18.2.0',
          'tailwindcss': '^3.3.0',
          'autoprefixer': '^10.4.15',
          'postcss': '^8.4.29'
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.0.0',
          '@types/react-dom': '^18.0.0'
        }
      }, null, 2)
    });
  }
  
  // Add next.config.js if missing
  if (!hasNextConfig) {
    result.push({
      file: 'next.config.js',
      data: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig`
    });
  }
  
  // Add tsconfig.json if missing
  if (!hasTsConfig) {
    result.push({
      file: 'tsconfig.json',
      data: `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`
    });
  }
  
  // Add app layout
  if (!hasAppLayout) {
    result.push({
      file: 'app/layout.tsx',
      data: `import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated by Praxis AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`
    });
  }
  
  // Add global CSS
  if (!hasGlobalsCSS) {
    result.push({
      file: 'app/globals.css',
      data: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    });
  }

  // Add tailwind config
  if (!fileNames.includes('tailwind.config.js')) {
    result.push({
      file: 'tailwind.config.js',
      data: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
    });
  }

  // Add postcss config
  if (!fileNames.includes('postcss.config.js')) {
    result.push({
      file: 'postcss.config.js',
      data: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    });
  }
  
  return result;
}
