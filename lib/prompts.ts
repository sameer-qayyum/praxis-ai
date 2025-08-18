export interface Prompt {
  id: number;
  type: string;
  system_prompt: string;
  user_prompt: string;
  short_code: string;
  created_at: string;
}

export interface AppRequirements {
  requiresAuthentication: boolean;
  apiAccess: 'read_only' | 'write_only' | 'read_write';
  siteUrl: string;
  appId: string;
  pathSecret: string;
}

export function buildSystemPrompts(
  prompts: Prompt[],
  requirements: AppRequirements
): string {
  let systemPrompts = '';

  console.log('🔨 Building system prompts for', prompts.length, 'prompts');

  prompts.forEach(prompt => {
    console.log(`🔧 Processing prompt: ${prompt.short_code} (${prompt.type})`);
    
    let processedPrompt = prompt.system_prompt;
    
    // Replace environment variables and app-specific data
    processedPrompt = processedPrompt.replace(
      /\$\{process\.env\.NEXT_PUBLIC_SITE_URL\}/g,
      requirements.siteUrl
    );
    processedPrompt = processedPrompt.replace(
      /\$\{app\.id\}/g,
      requirements.appId
    );
    processedPrompt = processedPrompt.replace(
      /\$\{app\.path_secret\}/g,
      requirements.pathSecret
    );

    console.log(`📏 Processed prompt length: ${processedPrompt.length} chars`);

    // Add short_code markers for frontend replacement
    const wrappedPrompt = `\n\n<${prompt.short_code}>\n${processedPrompt}\n</${prompt.short_code}>`;
    systemPrompts += wrappedPrompt;
    
    console.log(`🏷️ Added wrapped prompt with markers: <${prompt.short_code}>...</${prompt.short_code}>`);
  });

  console.log('✅ Final system prompts built:', {
    totalLength: systemPrompts.length,
    promptCount: prompts.length
  });

  return systemPrompts;
}

export function replaceSystemPromptsWithUserPrompts(
  content: string,
  prompts: Prompt[]
): string {
  let processedContent = content;

  prompts.forEach(prompt => {
    // Replace system prompt blocks with user-friendly descriptions
    const regex = new RegExp(`<${prompt.short_code}>([\\s\\S]*?)</${prompt.short_code}>`, 'gi');
    processedContent = processedContent.replace(regex, `**${prompt.user_prompt}**`);
  });

  return processedContent;
}

export function getRequiredPromptTypes(
  requiresAuthentication: boolean,
  apiAccess: string
): string[] {
  const types: string[] = [];

  console.log('🔍 Determining prompt types based on:', { requiresAuthentication, apiAccess });

  if (requiresAuthentication) {
    types.push('auth');
    console.log('✅ Added auth prompt');
  }

  if (apiAccess === 'write_only' || apiAccess === 'read_write') {
    types.push('api_write');
    console.log('✅ Added api_write prompt');
  }

  if (apiAccess === 'read_only' || apiAccess === 'read_write') {
    types.push('api_read');
    console.log('✅ Added api_read prompt');
  }

  // Always include base prompts
  types.push('base', 'sheet_handling');
  console.log('✅ Added base and sheet_handling prompts');

  console.log('🎯 Final prompt types:', types);
  return types;
}
