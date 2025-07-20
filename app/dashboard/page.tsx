import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageSquare,
  Upload,
  BarChart3,
  FileText,
  Users,
  Workflow,
  Search,
  Filter,
  Star,
  ArrowRight,
  Zap,
  Plus,
  FolderOpen,
  Settings,
  Clock,
  TrendingUp,
} from "lucide-react"

const templates = [
  {
    id: "feedback-form",
    title: "Customer Feedback Form",
    description: "Collect ratings, comments, and suggestions with automated follow-ups",
    category: "Forms",
    icon: MessageSquare,
    color: "bg-blue-500",
    popular: true,
    time: "2 min setup",
    features: ["Rating scales", "File uploads", "Email notifications", "Analytics dashboard"],
  },
  {
    id: "sales-dashboard",
    title: "Sales Dashboard",
    description: "Track revenue, leads, and team performance with real-time charts",
    category: "Dashboards",
    icon: BarChart3,
    color: "bg-green-500",
    popular: true,
    time: "3 min setup",
    features: ["Revenue tracking", "Lead pipeline", "Team metrics", "Goal tracking"],
  },
  {
    id: "client-intake",
    title: "Client Intake System",
    description: "Streamline onboarding with forms, document collection, and workflows",
    category: "Forms",
    icon: FileText,
    color: "bg-purple-500",
    popular: false,
    time: "4 min setup",
    features: ["Multi-step forms", "Document upload", "Auto workflows", "Client portal"],
  },
  {
    id: "employee-directory",
    title: "Employee Directory",
    description: "Manage team contacts, roles, and organizational structure",
    category: "Internal Tools",
    icon: Users,
    color: "bg-orange-500",
    popular: false,
    time: "2 min setup",
    features: ["Contact management", "Org chart", "Search & filter", "Role management"],
  },
  {
    id: "project-tracker",
    title: "Project Tracker",
    description: "Monitor project progress, tasks, and team collaboration",
    category: "Internal Tools",
    icon: Workflow,
    color: "bg-teal-500",
    popular: true,
    time: "5 min setup",
    features: ["Task management", "Progress tracking", "Team collaboration", "Deadline alerts"],
  },
  {
    id: "inventory-manager",
    title: "Inventory Manager",
    description: "Track stock levels, orders, and supplier information",
    category: "Internal Tools",
    icon: FolderOpen,
    color: "bg-indigo-500",
    popular: false,
    time: "3 min setup",
    features: ["Stock tracking", "Low stock alerts", "Supplier management", "Order history"],
  },
  {
    id: "event-registration",
    title: "Event Registration",
    description: "Manage event signups, payments, and attendee communication",
    category: "Forms",
    icon: Users,
    color: "bg-pink-500",
    popular: false,
    time: "3 min setup",
    features: ["Registration forms", "Payment processing", "Email confirmations", "Attendee list"],
  },
  {
    id: "expense-tracker",
    title: "Expense Tracker",
    description: "Track business expenses, receipts, and generate reports",
    category: "Internal Tools",
    icon: TrendingUp,
    color: "bg-red-500",
    popular: false,
    time: "2 min setup",
    features: ["Expense logging", "Receipt upload", "Category tracking", "Monthly reports"],
  },
]

export default async function Dashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="p-8">

      <Tabs defaultValue="templates" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="templates">Browse Templates</TabsTrigger>
            <TabsTrigger value="custom">Custom Build</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search templates..." className="pl-10 w-64" />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <TabsContent value="templates" className="space-y-8">
          {/* Popular Templates */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Star className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-semibold">Most Popular</h2>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Recommended</Badge>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {templates
                .filter((t) => t.popular)
                .map((template) => {
                  const IconComponent = template.icon
                  return (
                    <Card
                      key={template.id}
                      className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 hover:-translate-y-1"
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`p-3 rounded-xl ${template.color} text-white group-hover:scale-110 transition-transform duration-300`}
                          >
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            <Zap className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {template.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {template.category}
                          </Badge>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {template.time}
                          </span>
                        </div>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1 mb-4">
                          {template.features.slice(0, 3).map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                          {template.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.features.length - 3} more
                            </Badge>
                          )}
                        </div>
                        <Button className="w-full group-hover:shadow-lg transition-shadow duration-300">
                          Use This Template
                          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>

          {/* All Templates */}
          <div>
            <h2 className="text-2xl font-semibold mb-6">All Templates</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template) => {
                const IconComponent = template.icon
                return (
                  <Card
                    key={template.id}
                    className="group hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary/20"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${template.color} text-white`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm group-hover:text-primary transition-colors truncate">
                            {template.title}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {template.category}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-xs line-clamp-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.time}
                        </span>
                        <span>{template.features.length} features</span>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs bg-transparent">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card className="p-8">
            <div className="max-w-2xl mx-auto text-center">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold mb-3">Build Something Custom</h3>
              <p className="text-gray-600 mb-8">
                Describe exactly what you want to build, or upload your existing files to get started with a completely
                custom application.
              </p>

              <div className="space-y-6">
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Describe your app</label>
                  <Input
                    placeholder="e.g., 'I need a tool that tracks customer orders and sends automated emails...'"
                    className="text-left h-12"
                  />
                </div>

                <div className="flex gap-4">
                  <Button className="flex-1 h-12">
                    <Plus className="h-5 w-5 mr-2" />
                    Build Custom App
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 bg-transparent">
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Files First
                  </Button>
                </div>

                <p className="text-sm text-gray-500">💡 Tip: The more specific you are, the better your app will be!</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
