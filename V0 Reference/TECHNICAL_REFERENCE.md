# Technical Reference: v0 + Vercel Integration

## API Schemas and Code Examples

### v0 API Response Schemas

#### Chat Creation Response
```typescript
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
    lang?: string;
  }>;
  latestVersion?: {
    files?: Array<{
      name?: string;
      meta?: {
        file?: string;
        lang?: string;
      };
      source?: string;
      content?: string;
      lang?: string;
    }>;
  };
  messages?: Array<{
    role: string;
    content: string;
  }>;
}
```

#### Project Creation Response
```typescript
interface V0ProjectResponse {
  id: string;
  name: string;
  framework: string;
  description?: string;
  createdAt: string;
}
```

### Vercel API Schemas

#### Deployment Request
```typescript
interface VercelDeploymentRequest {
  name: string;
  project: string;
  target: 'production' | 'preview';
  files: Array<{
    file: string;
    data: string;
  }>;
  projectSettings: {
    framework: 'nextjs' | 'react' | 'vue' | 'angular';
    installCommand: string;
    buildCommand: string;
    devCommand: string;
    outputDirectory: string;
  };
}
```

#### Deployment Response
```typescript
interface VercelDeploymentResponse {
  id: string;
  url: string;
  name: string;
  meta: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
  };
  plan: string;
  public: boolean;
  readyState: 'BUILDING' | 'READY' | 'ERROR';
  type: 'LAMBDAS';
  createdAt: number;
}
```

## Complete Working Examples

### 1. Basic Deployment Function

```typescript
import { v0 } from "v0-sdk";

async function deployV0ToVercel(prompt: string, projectName: string) {
  // Step 1: Generate code with v0
  const chat = await v0.chats.create({
    message: prompt
  });

  // Step 2: Create v0 project
  const project = await v0.projects.create({
    name: projectName,
    framework: 'next',
    description: 'Generated project'
  } as any);

  // Step 3: Assign chat to project
  await v0.projects.assign({
    projectId: project.id,
    chatId: chat.id
  } as any);

  // Step 4: Extract files
  const files = extractFilesFromChat(chat);

  // Step 5: Add essential files
  const completeFiles = await addEssentialNextJSFiles(files, projectName);

  // Step 6: Create Vercel project
  const vercelProject = await createVercelProject(project.id, projectName);

  // Step 7: Deploy to Vercel
  const deployment = await deployToVercel(vercelProject.id, completeFiles, projectName);

  return {
    chatId: chat.id,
    projectId: project.id,
    vercelProjectId: vercelProject.id,
    deploymentUrl: `https://${deployment.url}`,
    deploymentId: deployment.id
  };
}
```

### 2. File Processing Utilities

```typescript
// Extract files from v0 chat response
function extractFilesFromChat(chat: any): Array<{file: string, data: string}> {
  const files: Array<{file: string, data: string}> = [];
  
  // Try chat.files first
  if (chat.files && chat.files.length > 0) {
    chat.files.forEach((file: any) => {
      const filePath = file.meta?.file || file.name || 'app/page.tsx';
      const fileContent = file.source || file.content || '';
      
      if (fileContent) {
        files.push({
          file: filePath,
          data: fileContent
        });
      }
    });
  }
  
  // Fallback to latestVersion.files
  if (files.length === 0 && chat.latestVersion?.files) {
    chat.latestVersion.files.forEach((file: any) => {
      const filePath = file.meta?.file || file.name || 'app/page.tsx';
      const fileContent = file.source || file.content || '';
      
      if (fileContent) {
        files.push({
          file: filePath,
          data: fileContent
        });
      }
    });
  }
  
  return files;
}

// Add essential Next.js files
async function addEssentialNextJSFiles(
  files: Array<{file: string, data: string}>, 
  projectName: string
): Promise<Array<{file: string, data: string}>> {
  const fileNames = files.map(f => f.file);
  
  // Package.json
  if (!fileNames.includes('package.json')) {
    files.push({
      file: 'package.json',
      data: JSON.stringify({
        "name": projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        "version": "0.1.0",
        "private": true,
        "scripts": {
          "dev": "next dev",
          "build": "next build",
          "start": "next start",
          "lint": "next lint"
        },
        "dependencies": {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "next": "^14.0.0",
          "@types/node": "^20.0.0",
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "typescript": "^5.0.0",
          "tailwindcss": "^3.3.0",
          "autoprefixer": "^10.4.0",
          "postcss": "^8.4.0",
          "class-variance-authority": "^0.7.0",
          "clsx": "^2.0.0",
          "tailwind-merge": "^2.0.0",
          "@radix-ui/react-slot": "^1.0.0",
          "@radix-ui/react-checkbox": "^1.0.0"
        }
      }, null, 2)
    });
  }

  // Next.js config
  if (!fileNames.some(name => name.includes('next.config'))) {
    files.push({
      file: 'next.config.js',
      data: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`
    });
  }

  // TypeScript config
  if (!fileNames.includes('tsconfig.json')) {
    files.push({
      file: 'tsconfig.json',
      data: JSON.stringify({
        "compilerOptions": {
          "target": "es5",
          "lib": ["dom", "dom.iterable", "es6"],
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
      }, null, 2)
    });
  }

  // Tailwind config
  if (!fileNames.some(name => name.includes('tailwind.config'))) {
    files.push({
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

  // PostCSS config
  if (!fileNames.some(name => name.includes('postcss.config'))) {
    files.push({
      file: 'postcss.config.js',
      data: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    });
  }

  // App layout
  if (!fileNames.includes('app/layout.tsx')) {
    files.push({
      file: 'app/layout.tsx',
      data: `import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`
    });
  }

  // Global CSS
  if (!fileNames.some(name => name.includes('globals.css'))) {
    files.push({
      file: 'app/globals.css',
      data: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    });
  }

  return files;
}
```

### 3. Vercel Integration Functions

```typescript
// Create Vercel project via v0 integration
async function createVercelProject(v0ProjectId: string, projectName: string) {
  const response = await fetch('https://api.v0.dev/v1/integrations/vercel/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.V0_API_KEY}`
    },
    body: JSON.stringify({
      projectId: v0ProjectId,
      name: projectName,
      framework: 'next',
      description: 'Project created from v0 integration'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Vercel project: ${error}`);
  }

  return await response.json();
}

// Deploy files to Vercel
async function deployToVercel(
  vercelProjectId: string, 
  files: Array<{file: string, data: string}>, 
  projectName: string
) {
  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName,
      project: vercelProjectId,
      target: 'production',
      files: files,
      projectSettings: {
        framework: 'nextjs',
        installCommand: 'npm install',
        buildCommand: 'npm run build',
        devCommand: 'npm run dev',
        outputDirectory: '.next'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to deploy to Vercel: ${error}`);
  }

  return await response.json();
}
```

### 4. Redeployment Support

```typescript
async function redeployToVercel(
  chatId: string,
  vercelProjectId: string,
  projectName: string
) {
  // Get latest chat data
  const chat = await v0.chats.get({ id: chatId });
  
  // Extract updated files
  const files = extractFilesFromChat(chat);
  
  // Add essential files
  const completeFiles = await addEssentialNextJSFiles(files, projectName);
  
  // Deploy to existing Vercel project
  const deployment = await deployToVercel(vercelProjectId, completeFiles, projectName);
  
  return {
    deploymentUrl: `https://${deployment.url}`,
    deploymentId: deployment.id,
    filesDeployed: completeFiles.length
  };
}
```

## Error Handling Patterns

### 1. Comprehensive Error Wrapper

```typescript
class DeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

async function safeApiCall<T>(
  operation: () => Promise<T>,
  errorCode: string,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context || 'API call'}:`, error);
    
    if (error instanceof DeploymentError) {
      throw error;
    }
    
    throw new DeploymentError(
      error instanceof Error ? error.message : 'Unknown error',
      errorCode,
      { originalError: error, context }
    );
  }
}

// Usage
const chat = await safeApiCall(
  () => v0.chats.create({ message: prompt }),
  'V0_CHAT_CREATION_FAILED',
  'Creating v0 chat'
);
```

### 2. Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError!;
}

// Usage
const deployment = await withRetry(
  () => deployToVercel(projectId, files, name),
  3,
  1000
);
```

## Testing Utilities

### 1. Mock v0 Response

```typescript
const mockV0ChatResponse = {
  id: 'chat_123',
  url: 'https://v0.dev/chat/123',
  files: [
    {
      meta: { file: 'app/page.tsx' },
      source: `export default function Page() {
  return <div>Hello World</div>;
}`
    },
    {
      meta: { file: 'app/layout.tsx' },
      source: `export default function Layout({ children }) {
  return <html><body>{children}</body></html>;
}`
    }
  ]
};
```

### 2. Test Deployment Function

```typescript
async function testDeployment() {
  try {
    console.log('Testing v0 + Vercel deployment...');
    
    const result = await deployV0ToVercel(
      'Create a simple todo app with React',
      'test-todo-app'
    );
    
    console.log('Deployment successful!');
    console.log('Chat ID:', result.chatId);
    console.log('Project ID:', result.projectId);
    console.log('Deployment URL:', result.deploymentUrl);
    
    return result;
  } catch (error) {
    console.error('Deployment test failed:', error);
    throw error;
  }
}
```

## Performance Optimization

### 1. File Size Optimization

```typescript
function optimizeFiles(files: Array<{file: string, data: string}>) {
  return files.map(file => ({
    ...file,
    data: file.data
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Minimize whitespace
      .trim()
  }));
}
```

### 2. Concurrent Operations

```typescript
async function parallelDeployment(prompt: string, projectName: string) {
  // Start chat creation and project creation in parallel
  const [chat, project] = await Promise.all([
    v0.chats.create({ message: prompt }),
    v0.projects.create({
      name: projectName,
      framework: 'next',
      description: 'Generated project'
    } as any)
  ]);

  // Assign chat to project
  await v0.projects.assign({
    projectId: project.id,
    chatId: chat.id
  } as any);

  // Continue with deployment...
}
```

## Monitoring and Logging

### 1. Structured Logging

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  operation: string;
  data?: any;
  error?: string;
}

class Logger {
  static log(level: LogEntry['level'], operation: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      operation,
      data,
      error: error?.message
    };
    
    console.log(JSON.stringify(entry));
  }
  
  static info(operation: string, data?: any) {
    this.log('info', operation, data);
  }
  
  static error(operation: string, error: Error, data?: any) {
    this.log('error', operation, data, error);
  }
}

// Usage
Logger.info('deployment_started', { chatId, projectName });
Logger.error('deployment_failed', error, { chatId, step: 'vercel_deploy' });
```

### 2. Metrics Collection

```typescript
interface DeploymentMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  filesGenerated: number;
  filesDeployed: number;
  success: boolean;
  error?: string;
}

class MetricsCollector {
  private metrics: DeploymentMetrics[] = [];
  
  startDeployment(): DeploymentMetrics {
    const metric: DeploymentMetrics = {
      startTime: Date.now(),
      filesGenerated: 0,
      filesDeployed: 0,
      success: false
    };
    
    this.metrics.push(metric);
    return metric;
  }
  
  endDeployment(metric: DeploymentMetrics, success: boolean, error?: string) {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.error = error;
  }
  
  getAverageDeploymentTime(): number {
    const successful = this.metrics.filter(m => m.success && m.duration);
    return successful.reduce((sum, m) => sum + m.duration!, 0) / successful.length;
  }
}
```

This technical reference provides the detailed implementation patterns, schemas, and utilities needed to build a robust v0 + Vercel integration system.
