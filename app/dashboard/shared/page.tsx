import { createClient } from "@/lib/supabase/server";

export default async function SharedPage() {
  const supabase = await createClient();

  return (
    <div className="w-full">
      <h1 className="text-3xl font-semibold mb-6">Shared Resources</h1>
      
      <div className="space-y-6">
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-medium mb-4">Shared with you</h2>
          
          {/* This would be populated from your database in a real app */}
          <div className="divide-y">
            <SharedItem 
              name="Market Analysis Report" 
              owner="alex@example.com"
              type="Document"
              sharedDate="Jul 15, 2025"
              icon="📄"
            />
            
            <SharedItem 
              name="Product Roadmap" 
              owner="taylor@example.com"
              type="Spreadsheet"
              sharedDate="Jul 10, 2025"
              icon="📊"
            />
            
            <SharedItem 
              name="Customer Feedback Analysis" 
              owner="jordan@example.com"
              type="Dashboard"
              sharedDate="Jul 5, 2025"
              icon="📈"
            />
          </div>
        </div>
        
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-medium mb-4">Your shared resources</h2>
          
          <div className="divide-y">
            <SharedItem 
              name="Q2 Performance Report" 
              sharedWith="team@example.com"
              type="Dashboard"
              sharedDate="Jul 18, 2025"
              icon="📊"
              isOwner={true}
            />
            
            <SharedItem 
              name="Project Proposal" 
              sharedWith="client@example.com"
              type="Document"
              sharedDate="Jul 12, 2025"
              icon="📄"
              isOwner={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedItem({ 
  name, 
  owner,
  sharedWith,
  type,
  sharedDate,
  icon,
  isOwner = false
}: { 
  name: string;
  owner?: string;
  sharedWith?: string;
  type: string;
  sharedDate: string;
  icon: string;
  isOwner?: boolean;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <h3 className="font-medium">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {isOwner 
              ? `Shared with ${sharedWith} on ${sharedDate}` 
              : `Shared by ${owner} on ${sharedDate}`}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
          {type}
        </div>
        <button className="text-sm text-primary hover:underline">
          Open
        </button>
        {isOwner && (
          <button className="text-sm text-muted-foreground hover:text-destructive">
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
