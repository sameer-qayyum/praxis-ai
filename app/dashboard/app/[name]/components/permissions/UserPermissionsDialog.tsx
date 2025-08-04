"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PermissionLevel, type AppPermission } from "@/types/permissions"
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// User interface
interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

interface UserWithPermission extends User {
  permission: PermissionLevel
}

interface UserPermissionsDialogProps {
  isOpen: boolean
  onClose: () => void
  appId: string
  currentUserId: string
}

export function UserPermissionsDialog({
  isOpen,
  onClose,
  appId,
  currentUserId,
}: UserPermissionsDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER)
  const [open, setOpen] = useState(false)

  // Fetch app permissions
  const {
    data: permissions,
    isLoading: isLoadingPermissions,
  } = useQuery({
    queryKey: ["app-permissions", appId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_permissions")
        .select("*, users(id, email, full_name, avatar_url)")
        .eq("app_id", appId)

      if (error) throw new Error(error.message)
      return data as (AppPermission & { users: User })[]
    },
  })

  // Fetch users for adding new permissions
  const {
    data: users,
    isLoading: isLoadingUsers,
  } = useQuery({
    queryKey: ["users", searchQuery],
    queryFn: async () => {
      // Only search if user is actively adding a new user and has typed something
      if (!isAddingUser || !searchQuery.trim()) return []

      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, avatar_url")
        .ilike("email", `%${searchQuery}%`)
        .limit(10)

      if (error) throw new Error(error.message)
      return data as User[]
    },
    enabled: isAddingUser && !!searchQuery.trim(),
  })

  // Add user permission mutation
  const addPermissionMutation = useMutation({
    mutationFn: async ({ userId, permissionLevel }: { userId: string; permissionLevel: PermissionLevel }) => {
      const { data, error } = await supabase.from("app_permissions").insert([
        {
          app_id: appId,
          user_id: userId,
          permission_level: permissionLevel,
          created_by: currentUserId,
        },
      ])

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-permissions", appId] })
      toast.success("User has been added to this app")
      setIsAddingUser(false)
      setSelectedUserId(null)
      setSearchQuery("")
    },
    onError: (error) => {
      toast.error(`Error adding permission: ${error.message}`)
    },
  })

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ permissionId, permissionLevel }: { permissionId: string; permissionLevel: PermissionLevel }) => {
      const { data, error } = await supabase
        .from("app_permissions")
        .update({ permission_level: permissionLevel })
        .eq("id", permissionId)

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-permissions", appId] })
      toast.success("User permission has been updated")
    },
    onError: (error) => {
      toast.error(`Error updating permission: ${error.message}`)
    },
  })

  // Delete permission mutation
  const deletePermissionMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const { data, error } = await supabase
        .from("app_permissions")
        .delete()
        .eq("id", permissionId)

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-permissions", appId] })
      toast.success("User has been removed from this app")
    },
    onError: (error) => {
      toast.error(`Error removing permission: ${error.message}`)
    },
  })

  const handleUpdatePermission = (permissionId: string, newLevel: PermissionLevel) => {
    updatePermissionMutation.mutate({ permissionId, permissionLevel: newLevel })
  }

  const handleDeletePermission = (permissionId: string) => {
    deletePermissionMutation.mutate(permissionId)
  }

  const handleAddUser = () => {
    if (!selectedUserId) {
      toast.error("Please select a user")
      return
    }

    addPermissionMutation.mutate({
      userId: selectedUserId,
      permissionLevel: selectedPermission,
    })
  }

  // Format permission data for display
  const formattedPermissions = permissions?.map((p) => ({
    id: p.id,
    user: {
      id: p.user_id,
      email: p.users?.email || "Unknown",
      full_name: p.users?.full_name || "",
      avatar_url: p.users?.avatar_url || "",
    },
    level: p.permission_level,
    isCurrentUser: p.user_id === currentUserId,
  })) || []

  // Get permission badge variant
  const getPermissionBadgeVariant = (level: PermissionLevel) => {
    switch (level) {
      case PermissionLevel.ADMIN:
        return "default"
      case PermissionLevel.EDITOR:
        return "secondary"
      case PermissionLevel.VIEWER:
      default:
        return "outline"
    }
  }

  // Get user initials for avatar fallback
  const getUserInitials = (email: string, fullName?: string) => {
    if (fullName) {
      return fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    }
    
    // Use first letter of email
    return email.substring(0, 2).toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage App Permissions</DialogTitle>
          <DialogDescription>
            Control who has access to this app and what they can do
          </DialogDescription>
        </DialogHeader>

        {isLoadingPermissions ? (
          <div className="py-8 flex justify-center items-center">
            <div className="animate-pulse text-gray-500">Loading user permissions...</div>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {/* User permissions table */}
              {formattedPermissions.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formattedPermissions.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {p.user.avatar_url && <AvatarImage src={p.user.avatar_url} />}
                                <AvatarFallback>{getUserInitials(p.user.email, p.user.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{p.user.full_name || p.user.email}</div>
                                {p.user.full_name && <div className="text-xs text-gray-500">{p.user.email}</div>}
                                {p.isCurrentUser && <Badge variant="outline" className="mt-1 text-xs">You</Badge>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p.level}
                              onValueChange={(value) => handleUpdatePermission(p.id, value as PermissionLevel)}
                              disabled={p.isCurrentUser}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge variant={getPermissionBadgeVariant(p.level as PermissionLevel)} className="font-normal">
                                    {p.level.charAt(0).toUpperCase() + p.level.slice(1)}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={PermissionLevel.VIEWER}>Viewer</SelectItem>
                                <SelectItem value={PermissionLevel.EDITOR}>Editor</SelectItem>
                                <SelectItem value={PermissionLevel.ADMIN}>Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                              disabled={p.isCurrentUser}
                              onClick={() => handleDeletePermission(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No users have been added to this app yet
                </div>
              )}

              {/* Add user form */}
              {isAddingUser ? (
                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Add New User</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setIsAddingUser(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="user">User</Label>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                          >
                            {selectedUserId
                              ? users?.find((user) => user.id === selectedUserId)?.email
                              : "Select user..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput 
                              placeholder="Search users..."
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                            />
                            {isLoadingUsers ? (
                              <div className="py-6 text-center text-sm">Searching...</div>
                            ) : (
                              <>
                                <CommandEmpty>No users found</CommandEmpty>
                                <CommandGroup>
                                  {users?.map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      value={user.id}
                                      onSelect={() => {
                                        setSelectedUserId(user.id === selectedUserId ? null : user.id)
                                        setOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedUserId === user.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                                          <AvatarFallback>{getUserInitials(user.email, user.full_name)}</AvatarFallback>
                                        </Avatar>
                                        <span>{user.email}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="permission">Permission Level</Label>
                      <Select
                        value={selectedPermission}
                        onValueChange={(value) => setSelectedPermission(value as PermissionLevel)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PermissionLevel.VIEWER}>Viewer</SelectItem>
                          <SelectItem value={PermissionLevel.EDITOR}>Editor</SelectItem>
                          <SelectItem value={PermissionLevel.ADMIN}>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleAddUser}
                    disabled={!selectedUserId || addPermissionMutation.isPending}
                  >
                    {addPermissionMutation.isPending && (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    Add User
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddingUser(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
