# V0 + Vercel Integration Guide

## Complete Documentation for Automated App Generation and Deployment

This guide provides comprehensive documentation for integrating v0 API (AI-powered code generation) with Vercel API (deployment platform) to create a fully automated app generation and deployment pipeline.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [v0 API Integration](#v0-api-integration)
5. [Vercel API Integration](#vercel-api-integration)
6. [Complete Implementation](#complete-implementation)
7. [Frontend Integration](#frontend-integration)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Integration Does

1. **Code Generation**: Uses v0 AI to generate complete Next.js applications from natural language prompts
2. **Project Management**: Creates and manages v0 projects and chat sessions
3. **File Processing**: Extracts and processes generated files (React components, configs, etc.)
4. **Dependency Management**: Automatically adds missing essential files and dependencies
5. **Deployment**: Deploys generated code directly to Vercel hosting platform
6. **Redeployment**: Supports updating existing deployments with new code changes

### Architecture Flow

```
User Prompt → v0 API → Generated Files → File Processing → Vercel Deployment → Live URL
```

---

## Prerequisites

### Required Accounts & API Keys

1. **v0 Account**: Sign up at [v0.dev](https://v0.dev)
   - Get API key from v0 dashboard
   - Ensure sufficient API credits

2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
   - Generate API token from account settings
   - Ensure deployment limits are sufficient

### Technical Requirements

- Node.js 18+ (for Next.js compatibility)
- TypeScript support
- Environment variable management
- HTTP client capability (fetch/axios)

---

## Environment Setup

### Required Environment Variables

```bash
# v0 API Configuration
V0_API_KEY=your_v0_api_key_here

# Vercel API Configuration  
VERCEL_TOKEN=your_vercel_token_here

# Optional: For client-side usage (not recommended for production)
NEXT_PUBLIC_V0_API_KEY=your_v0_api_key_here
```

### Security Considerations

- **Never expose API keys in client-side code**
- Use server-side API routes for all external API calls
- Implement proper error handling to avoid key leakage
- Consider rate limiting for production usage

---

## v0 API Integration

### SDK Installation

```bash
npm install v0-sdk@0.2.3
```

### Basic SDK Setup

```typescript
import { v0 } from "v0-sdk";

// Initialize v0 client
const v0Client = v0; // Uses V0_API_KEY from environment

// Alternative: Explicit API key setting
process.env.V0_API_KEY = your_api_key;
```

### Core v0 API Operations

#### 1. Create Project

```typescript
const project = await v0.projects.create({
  name: "my-project",
  framework: 'next',
  description: 'Project created from chat interface'
} as any); // Type assertion needed due to SDK limitations

console.log('Project created:', project.id);
```

#### 2. Create Chat Session

```typescript
const chat = await v0.chats.create({
  message: "Create a todo app with React and TypeScript"
});

console.log('Chat created:', chat.id);
console.log('Generated files:', chat.files?.length || 0);
```

#### 3. Assign Chat to Project

```typescript
// Method 1: Using SDK (preferred)
await v0.projects.assign({
  projectId: project.id,
  chatId: chat.id
} as any);

// Method 2: Direct API call (fallback)
const response = await fetch('https://api.v0.dev/v1/projects/assign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${v0ApiKey}`
  },
  body: JSON.stringify({
    projectId: project.id,
    chatId: chat.id
  })
});
```

#### 4. Send Follow-up Messages

```typescript
const followUpResponse = await v0.chats.message({
  chatId: chat.id,
  message: "Add a dark mode toggle to the app"
});

console.log('Updated files:', followUpResponse.files?.length || 0);
```

### File Extraction from v0 Response

```typescript
// Extract files from chat response
const extractFiles = (chat: any) => {
  let files: Array<{file: string, data: string}> = [];
  
  // Primary source: chat.files
  if (chat.files && chat.files.length > 0) {
    files = chat.files.map((file: any) => ({
      file: file.meta?.file || file.name || 'app/page.tsx',
      data: file.source || file.content || ''
    }));
  }
  
  // Fallback: chat.latestVersion.files
  if (files.length === 0 && chat.latestVersion?.files) {
    files = chat.latestVersion.files.map((file: any) => ({
      file: file.meta?.file || file.name || 'app/page.tsx', 
      data: file.source || file.content || ''
    }));
  }
  
  return files;
};
```

---

## Vercel API Integration

### Core Vercel API Endpoints

#### 1. Create Vercel Project (via v0)

```typescript
const vercelProjectResponse = await fetch('https://api.v0.dev/v1/integrations/vercel/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${v0ApiKey}`
  },
  body: JSON.stringify({ 
    projectId: v0ProjectId,
    name: projectName,
    framework: 'next',
    description: 'Project created from chat interface' 
  })
});

const vercelProject = await vercelProjectResponse.json();
console.log('Vercel project ID:', vercelProject.id);
```

#### 2. Deploy Files to Vercel

```typescript
const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${vercelToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: projectName,
    project: vercelProjectId,
    target: 'production',
    files: files, // Array of {file: string, data: string}
    projectSettings: {
      framework: 'nextjs',
      installCommand: 'npm install',
      buildCommand: 'npm run build', 
      devCommand: 'npm run dev',
      outputDirectory: '.next'
    }
  })
});

const deployment = await deploymentResponse.json();
const deploymentUrl = `https://${deployment.url}`;
```

### File Format for Vercel Deployment

```typescript
interface VercelFile {
  file: string;  // File path (e.g., 'app/page.tsx', 'package.json')
  data: string;  // File content as string
}

// Example files array
const files: VercelFile[] = [
  {
    file: 'package.json',
    data: JSON.stringify(packageJsonContent, null, 2)
  },
  {
    file: 'app/page.tsx',
    data: reactComponentCode
  },
  {
    file: 'app/layout.tsx', 
    data: layoutComponentCode
  }
];
```

---

## Complete Implementation

### Full API Route Implementation

```typescript
// /api/generate/deploy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v0 } from "v0-sdk";

export async function POST(request: NextRequest) {
  try {
    // 1. Environment Setup
    const v0ApiKey = process.env.V0_API_KEY;
    const vercelToken = process.env.VERCEL_TOKEN;
    
    if (!v0ApiKey || !vercelToken) {
      return NextResponse.json(
        { error: "Missing required API keys" },
        { status: 500 }
      );
    }

    // 2. Parse Request
    const body = await request.json();
    const { chatId, name, message, vercelProjectId: existingVercelProjectId } = body;
    
    const isRedeployment = !!existingVercelProjectId;
    let actualChatId = chatId;

    // 3. Create or Use Existing Chat
    let chat;
    if (chatId) {
      // Use existing chat - get latest version
      chat = await v0.chats.get({ id: chatId });
    } else if (message) {
      // Create new chat
      chat = await v0.chats.create({ message });
      actualChatId = chat.id;
    }

    // 4. Create v0 Project (for new deployments)
    let project;
    if (!isRedeployment) {
      project = await v0.projects.create({
        name: name,
        framework: 'next',
        description: 'Project created from chat interface'
      } as any);

      // Assign chat to project
      await v0.projects.assign({
        projectId: project.id,
        chatId: actualChatId
      } as any);
    }

    // 5. Extract Files
    const extractedFiles = extractFiles(chat);
    
    // 6. Add Essential Files
    const files = await addEssentialFiles(extractedFiles, name);

    // 7. Handle Vercel Project
    let vercelProjectId, vercelProjectInfo;
    
    if (isRedeployment) {
      vercelProjectId = existingVercelProjectId;
      vercelProjectInfo = { id: vercelProjectId, name: name };
    } else {
      const vercelProjectResponse = await fetch('https://api.v0.dev/v1/integrations/vercel/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${v0ApiKey}`
        },
        body: JSON.stringify({ 
          projectId: project.id,
          name,
          framework: 'next',
          description: 'Project created from chat interface' 
        })
      });
      
      vercelProjectInfo = await vercelProjectResponse.json();
      vercelProjectId = vercelProjectInfo.id;
    }

    // 8. Deploy to Vercel
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: vercelProjectInfo.name,
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

    const deploymentData = await deploymentResponse.json();
    const deploymentUrl = `https://${deploymentData.url}`;

    // 9. Return Response
    return NextResponse.json({ 
      success: true,
      chatId: actualChatId,
      projectId: project?.id,
      vercelProjectId: vercelProjectId,
      projectName: name,
      url: deploymentUrl,
      deployUrl: deploymentUrl,
      filesDeployed: files.length,
      deploymentId: deploymentData.id,
      isRedeployment: isRedeployment
    });

  } catch (error) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deployment failed' },
      { status: 500 }
    );
  }
}
```

### Essential Files Management

```typescript
const addEssentialFiles = async (files: any[], projectName: string) => {
  const fileNames = files.map(f => f.file);
  
  // Check for missing essential files
  const hasPackageJson = fileNames.some(name => name === 'package.json');
  const hasNextConfig = fileNames.some(name => name.includes('next.config'));
  const hasTsConfig = fileNames.some(name => name === 'tsconfig.json');
  const hasAppLayout = fileNames.some(name => name === 'app/layout.tsx');
  const hasGlobalsCSS = fileNames.some(name => name.includes('globals.css'));

  // Add package.json if missing
  if (!hasPackageJson) {
    const packageJson = {
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
        "@radix-ui/react-slot": "^1.0.0"
      }
    };
    
    files.push({
      file: 'package.json',
      data: JSON.stringify(packageJson, null, 2)
    });
  }

  // Add other essential files...
  if (!hasAppLayout) {
    const layoutContent = `import './globals.css'

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
}`;
    
    files.push({
      file: 'app/layout.tsx',
      data: layoutContent
    });
  }

  // Add more essential files as needed...
  
  return files;
};
```

---

## Frontend Integration

### React Hook for Deployment

```typescript
const useV0Deployment = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentInfo, setDeploymentInfo] = useState(null);
  const [error, setError] = useState('');

  const deployToVercel = async (chatId: string, projectName: string, vercelProjectId?: string) => {
    setIsDeploying(true);
    setError('');

    try {
      const requestBody = {
        chatId,
        name: projectName,
        ...(vercelProjectId && { vercelProjectId })
      };

      const response = await fetch('/api/generate/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeploymentInfo(data);
      return data;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      throw err;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    deployToVercel,
    isDeploying,
    deploymentInfo,
    error
  };
};
```

### UI Components

```typescript
const DeploymentButton = ({ chatId, projectName, deploymentInfo, onDeploy }) => {
  const isRedeployment = !!deploymentInfo?.vercelProjectId;
  
  return (
    <button
      onClick={() => onDeploy(chatId, projectName, deploymentInfo?.vercelProjectId)}
      className={`px-4 py-2 rounded-lg font-medium text-white ${
        isRedeployment 
          ? 'bg-green-600 hover:bg-green-700' 
          : 'bg-black hover:bg-gray-800'
      }`}
    >
      {isRedeployment ? 'Redeploy' : 'Deploy to Vercel'}
    </button>
  );
};
```

---

## Error Handling

### Common Error Scenarios

1. **API Key Issues**
   ```typescript
   if (!v0ApiKey) {
     return NextResponse.json(
       { error: "V0_API_KEY not configured" },
       { status: 500 }
     );
   }
   ```

2. **v0 API Errors**
   ```typescript
   try {
     const chat = await v0.chats.create({ message });
   } catch (error) {
     console.error('v0 API error:', error);
     return NextResponse.json(
       { error: "Failed to generate code with v0" },
       { status: 500 }
     );
   }
   ```

3. **Vercel Deployment Errors**
   ```typescript
   if (!deploymentResponse.ok) {
     const errorText = await deploymentResponse.text();
     console.error('Vercel deployment error:', errorText);
     throw new Error(`Deployment failed: ${deploymentResponse.status}`);
   }
   ```

4. **File Processing Errors**
   ```typescript
   if (!files || files.length === 0) {
     throw new Error('No files generated by v0');
   }
   ```

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

// Example error responses
{
  "error": "V0_API_KEY not configured",
  "code": "MISSING_API_KEY"
}

{
  "error": "Failed to deploy to Vercel",
  "details": "Build failed: Missing dependency",
  "code": "DEPLOYMENT_FAILED"
}
```

---

## Best Practices

### 1. Security

- **Server-side only**: Keep all API keys on the server
- **Input validation**: Validate all user inputs
- **Rate limiting**: Implement rate limiting for API calls
- **Error sanitization**: Don't expose internal errors to clients

### 2. Performance

- **File size limits**: Limit generated file sizes
- **Timeout handling**: Set appropriate timeouts for API calls
- **Caching**: Cache project and chat data when possible
- **Async processing**: Use async/await properly

### 3. Reliability

- **Retry logic**: Implement retry for transient failures
- **Fallback mechanisms**: Have fallbacks for SDK failures
- **Monitoring**: Log all important operations
- **Graceful degradation**: Handle partial failures gracefully

### 4. Code Organization

```typescript
// Separate concerns into modules
import { V0Service } from './services/v0Service';
import { VercelService } from './services/vercelService';
import { FileProcessor } from './utils/fileProcessor';

// Use dependency injection
class DeploymentService {
  constructor(
    private v0Service: V0Service,
    private vercelService: VercelService,
    private fileProcessor: FileProcessor
  ) {}
  
  async deploy(params: DeploymentParams) {
    // Implementation
  }
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "No files generated by v0"
**Cause**: v0 didn't generate any files or files are in unexpected format
**Solution**: 
- Check chat response structure
- Verify prompt is clear and specific
- Try different file extraction methods

#### 2. "Build failed on Vercel"
**Cause**: Missing dependencies or incorrect file structure
**Solution**:
- Ensure package.json has all required dependencies
- Check file paths are correct
- Verify Next.js configuration files are present

#### 3. "Vercel project creation failed"
**Cause**: API limits, invalid project name, or authentication issues
**Solution**:
- Check Vercel API token permissions
- Ensure project name is unique and valid
- Verify API rate limits

#### 4. "Chat assignment failed"
**Cause**: v0 SDK issues or API changes
**Solution**:
- Use direct API call as fallback
- Check v0 API documentation for changes
- Verify project and chat IDs are valid

### Debug Logging

```typescript
// Enable comprehensive logging
const DEBUG = process.env.NODE_ENV === 'development';

const log = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

// Usage throughout the code
log('Creating v0 project', { name, framework });
log('Files extracted', { count: files.length, files: files.map(f => f.file) });
log('Deployment response', deploymentData);
```

---

## API Reference Summary

### v0 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/projects` | POST | Create project |
| `/v1/projects/assign` | POST | Assign chat to project |
| `/v1/chats` | POST | Create chat/generate code |
| `/v1/chats/{id}` | GET | Get chat details |
| `/v1/integrations/vercel/projects` | POST | Create Vercel project |

### Vercel API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v13/deployments` | POST | Deploy files |
| `/v9/projects` | GET | List projects |
| `/v9/projects/{id}` | GET | Get project details |

### Required Headers

```typescript
// v0 API
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${v0ApiKey}`
}

// Vercel API  
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${vercelToken}`
}
```

---

## Conclusion

This integration provides a powerful automated pipeline for:
- AI-powered code generation via v0
- Seamless deployment to Vercel
- Support for both initial deployment and redeployment
- Comprehensive error handling and debugging

The implementation is production-ready with proper security, error handling, and best practices. It can be easily adapted for different frameworks or deployment platforms by modifying the file processing and deployment logic.

For questions or issues, refer to:
- [v0 API Documentation](https://docs.v0.dev)
- [Vercel API Documentation](https://vercel.com/docs/rest-api)
- This implementation in `/api/generate/deploy/route.ts`
