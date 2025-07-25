import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }

    // Get API keys from environment
    const v0ApiKey = process.env.V0_API_KEY;
    const vercelToken = process.env.VERCEL_TOKEN;
    
    if (!v0ApiKey || !vercelToken) {
      return NextResponse.json(
        { error: "Missing required API keys in server configuration" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      chatId, 
      name,
      projectId,  // The v0 project ID
      googleSheetId,
      templateId,
      vercelProjectId  // For redeployment
    } = body;
    
    if (!chatId || !name) {
      return NextResponse.json(
        { error: "Chat ID and name are required" },
        { status: 400 }
      );
    }

    // Flag for redeployment
    const isRedeployment = !!vercelProjectId;
    
    // Get chat details from v0 to extract files
    const chatResponse = await fetch(`https://api.v0.dev/v1/chats/${chatId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${v0ApiKey}`
      }
    });
    
    if (!chatResponse.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve chat details", details: await chatResponse.text() },
        { status: chatResponse.status }
      );
    }
    
    const chat = await chatResponse.json();
    
    // Extract files from chat response
    const files = extractFiles(chat);
    
    // Add essential files
    const processedFiles = await addEssentialFiles(files, name);
    
    let v0ProjectId = projectId;
    
    // If project ID was not provided, try to get it from the database
    if (!v0ProjectId) {
      const { data: projectData } = await supabase
        .from('v0_projects')
        .select('v0_project_id')
        .eq('chat_id', chatId)
        .single();
      
      if (projectData) {
        v0ProjectId = projectData.v0_project_id;
      } else {
        return NextResponse.json(
          { error: "No project ID found for this chat" },
          { status: 400 }
        );
      }
    }
    
    // Handle Vercel project creation or use existing
    let vercelProjectInfo;
    
    if (isRedeployment) {
      // Use existing Vercel project
      vercelProjectInfo = { id: vercelProjectId, name };
    } else {
      // Create a new Vercel project via v0 integration
      const vercelProjectResponse = await fetch('https://api.v0.dev/v1/integrations/vercel/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${v0ApiKey}`
        },
        body: JSON.stringify({ 
          projectId: v0ProjectId,
          name,
          framework: 'next',
          description: 'Project created from Praxis AI'
        })
      });
      
      if (!vercelProjectResponse.ok) {
        return NextResponse.json(
          { error: "Failed to create Vercel project", details: await vercelProjectResponse.text() },
          { status: vercelProjectResponse.status }
        );
      }
      
      vercelProjectInfo = await vercelProjectResponse.json();
    }

    // Deploy to Vercel
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: vercelProjectInfo.name,
        project: vercelProjectInfo.id,
        target: 'production',
        files: processedFiles,
        projectSettings: {
          framework: 'nextjs',
          installCommand: 'npm install',
          buildCommand: 'npm run build',
          devCommand: 'npm run dev',
          outputDirectory: '.next'
        }
      })
    });
    
    if (!deploymentResponse.ok) {
      return NextResponse.json(
        { error: "Failed to deploy to Vercel", details: await deploymentResponse.text() },
        { status: deploymentResponse.status }
      );
    }

    const deploymentData = await deploymentResponse.json();
    const deploymentUrl = `https://${deploymentData.url}`;
    
    // Store or update app information in the database
    let appData;
    
    if (isRedeployment) {
      // Update existing app
      const { data: updatedApp, error: updateError } = await supabase
        .from('apps')
        .update({
          vercel_deployment_id: deploymentData.id,
          app_url: deploymentUrl,
          updated_by: session.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('vercel_project_id', vercelProjectInfo.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating app information:", updateError);
      } else {
        appData = updatedApp;
      }
    } else {
      // Create new app record
      const { data: newApp, error: insertError } = await supabase
        .from('apps')
        .insert({
          chat_id: chatId,
          v0_project_id: v0ProjectId,
          vercel_project_id: vercelProjectInfo.id,
          template_id: templateId || null,
          google_sheet: googleSheetId || null,
          app_url: deploymentUrl,
          vercel_deployment_id: deploymentData.id,
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

    // Return Response
    return NextResponse.json({ 
      success: true,
      appId: appData?.id,
      chatId: chatId,
      v0ProjectId: v0ProjectId,
      vercelProjectId: vercelProjectInfo.id,
      projectName: name,
      url: deploymentUrl,
      filesDeployed: processedFiles.length,
      deploymentId: deploymentData.id,
      isRedeployment: isRedeployment
    });
    
  } catch (error: any) {
    console.error('Vercel deployment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deployment failed' },
      { status: 500 }
    );
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
