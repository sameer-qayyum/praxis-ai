import { createClient } from "@/lib/supabase/server";

export default async function AppsPage() {
  const supabase = await createClient();

  return (
    <div className="w-full">
      <h1 className="text-3xl font-semibold mb-6">My Applications</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example app cards - these would come from your database in a real app */}
        <AppCard 
          name="Image Generator" 
          description="Create AI-generated images from text prompts" 
          lastUsed="2 days ago"
          icon="🖼️" 
        />
        
        <AppCard 
          name="Text Analyzer" 
          description="Natural language processing for text analysis" 
          lastUsed="1 week ago"
          icon="📊" 
        />
        
        <AppCard 
          name="Chat Assistant" 
          description="Interactive AI chat assistant for your tasks" 
          lastUsed="3 hours ago"
          icon="💬" 
        />
        
        <div className="border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-accent/5 cursor-pointer transition-colors">
          <div className="text-3xl mb-2">+</div>
          <p>Create New Application</p>
        </div>
      </div>
    </div>
  );
}

function AppCard({ 
  name, 
  description, 
  lastUsed,
  icon 
}: { 
  name: string; 
  description: string; 
  lastUsed: string;
  icon: string;
}) {
  return (
    <div className="border rounded-lg p-6 bg-card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="text-3xl">{icon}</div>
        <div className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
          {lastUsed}
        </div>
      </div>
      <h2 className="text-xl font-medium mb-2">{name}</h2>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>
      <div className="flex gap-2 mt-auto pt-2">
        <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:opacity-90 transition-opacity">
          Open
        </button>
        <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors">
          Settings
        </button>
      </div>
    </div>
  );
}
