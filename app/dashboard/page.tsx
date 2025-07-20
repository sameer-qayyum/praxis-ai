import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="w-full">
      <h1 className="text-3xl font-semibold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-medium mb-4">Welcome back, {user?.email}</h2>
          <p className="text-muted-foreground">This is your personal dashboard where you can access all your Praxis AI tools and resources.</p>
        </div>
        
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-medium mb-4">Quick Access</h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="rounded-full bg-primary w-2 h-2"></span>
              <a href="/dashboard/apps" className="hover:underline">My Applications</a>
            </li>
            <li className="flex items-center gap-2">
              <span className="rounded-full bg-primary w-2 h-2"></span>
              <a href="/dashboard/shared" className="hover:underline">Shared Resources</a>
            </li>
          </ul>
        </div>
        
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-medium mb-4">Recent Activity</h2>
          <p className="text-muted-foreground">No recent activity to show.</p>
        </div>
      </div>
    </div>
  );
}
