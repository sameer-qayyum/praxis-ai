"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PermissionLevel, type AppPermission } from "@/types/permissions"
import { Check, ChevronsUpDown, Mail, Trash2, UserPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

export function UserPermissionsDialog({ isOpen, onClose, appId, currentUserId }: UserPermissionsDialogProps) {
  // State to track if current user is an admin
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [inviteMethod, setInviteMethod] = useState<"existing" | "email">("existing")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER)
  const [open, setOpen] = useState(false)

  // Form schema for email invitation
  const inviteFormSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    permission: z.nativeEnum(PermissionLevel),
  })

  type InviteFormValues = z.infer<typeof inviteFormSchema>

  // Form for email invitation
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      permission: PermissionLevel.VIEWER,
    },
  })

  // Fetch current user's permission level to check if they're admin
  const { data: currentUserPermission, isLoading: isLoadingCurrentUserPermission } = useQuery({
    queryKey: ["user-permission", appId, currentUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_permissions")
        .select("permission_level")
        .eq("app_id", appId)
        .eq("user_id", currentUserId)
        .single()

      if (error) return null
      return data
    },
  })

  // Set admin status when permission data changes
  useEffect(() => {
    if (currentUserPermission?.permission_level === PermissionLevel.ADMIN) {
      setIsCurrentUserAdmin(true)
    } else {
      setIsCurrentUserAdmin(false)
    }
  }, [currentUserPermission])

  // Fetch app permissions
  const { data: permissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["app-permissions", appId, currentUserId],
    queryFn: async () => {
      
      // First, get app permissions without join
      const { data: permissionsData, error: permissionsError } = await supabase
        .from("app_permissions")
        .select("id, app_id, user_id, permission_level, created_at, updated_at, created_by")
        .eq("app_id", appId)

      console.log('📊 [PERMISSIONS] Permissions query result:', { 
        permissionsData, 
        permissionsError, 
        dataLength: permissionsData?.length || 0,
        appId 
      })

      if (permissionsError) {
        console.error('❌ [PERMISSIONS] Permissions query error:', permissionsError)
        throw new Error(permissionsError.message)
      }

      if (!permissionsData || permissionsData.length === 0) {
        console.warn('⚠️ [PERMISSIONS] No permissions found for app:', appId)
        return []
      }

      // Get unique user IDs
      const userIds = [...new Set(permissionsData.map(p => p.user_id))]
      console.log('👥 [PERMISSIONS] User IDs to fetch:', userIds)

      // Fetch profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds)

      console.log('👤 [PERMISSIONS] Profiles query result:', { 
        profilesData, 
        profilesError, 
        profilesCount: profilesData?.length || 0 
      })

      if (profilesError) {
        console.error('❌ [PERMISSIONS] Profiles query error:', profilesError)
        // Continue without profiles data rather than failing
      }

      // Manually join the data
      const permissionsWithUserDetails = permissionsData.map((permission: any) => {
        const profile = profilesData?.find(p => p.id === permission.user_id)
        
        console.log('👤 [PERMISSIONS] Processing permission:', {
          id: permission.id,
          user_id: permission.user_id,
          permission_level: permission.permission_level,
          created_by: permission.created_by,
          profile: profile
        })
        
        return {
          ...permission,
          users: {
            id: permission.user_id,
            email: profile?.email || "Unknown",
            full_name: profile?.full_name || "",
            avatar_url: profile?.avatar_url || "",
          },
        }
      })

      console.log('✅ [PERMISSIONS] Final processed permissions:', {
        count: permissionsWithUserDetails.length,
        permissions: permissionsWithUserDetails.map(p => ({
          id: p.id,
          user_id: p.user_id,
          email: p.users.email,
          permission_level: p.permission_level
        }))
      })

      return permissionsWithUserDetails as (AppPermission & { users: User })[]
    },
  })

  // Fetch pending invitations for the app
  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ["app-invites", appId, currentUserId],
    queryFn: async () => {
      // Fetch pending invitations (those without accepted_at date)
      const { data, error } = await supabase
        .from("app_invites")
        .select("id, app_id, invited_email, permission_level, created_at, invitation_token")
        .eq("app_id", appId)
        .eq("created_by", currentUserId) // Only show invitations created by current user
        .is("accepted_at", null) // Only show pending invitations

      if (error) throw new Error(error.message)

      return data || []
    },
  })

  // Fetch users for adding new permissions - only search in organization or users with existing permissions
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", searchQuery, currentUserId],
    queryFn: async () => {
      // Only search if user is actively adding a new user and has typed something
      if (!isAddingUser || !searchQuery.trim() || searchQuery.length < 3) return []

      // First, get user IDs from app_permissions across all the user's apps
      // This gets all users the current user has previously shared any app with
      const { data: userPermissions, error: permError } = await supabase
        .from("app_permissions")
        .select("user_id")
        .eq("created_by", currentUserId)

      if (permError) {
        console.error("Error fetching user permissions:", permError)
        throw new Error(permError.message)
      }

      // Get user IDs that the current user has previously shared apps with
      const userIdsWithPermissions = userPermissions?.map((p) => p.user_id) || []

      // If no previously shared permissions, we can't suggest users yet
      // In a real app, you might integrate with an org directory here
      if (userIdsWithPermissions.length === 0) return []

      // Search for users that the current user has previously shared apps with
      // This is a privacy-friendly approach as it only shows users they've already interacted with
      // Get profiles that match search query - now including email
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIdsWithPermissions)
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10)

      if (profilesError) throw new Error(profilesError.message)

      // If no profiles found, return empty array
      if (!profilesData || profilesData.length === 0) return []

      // Return user objects directly from profiles data
      return profilesData.map((profile) => ({
        id: profile.id,
        email: profile.email || "",
        full_name: profile.full_name || "",
        avatar_url: profile.avatar_url || "",
      }))
    },
    enabled: isAddingUser && !!searchQuery.trim() && searchQuery.length >= 3,
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
    mutationFn: async ({
      permissionId,
      permissionLevel,
    }: { permissionId: string; permissionLevel: PermissionLevel }) => {
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
      const { data, error } = await supabase.from("app_permissions").delete().eq("id", permissionId)
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

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async ({ email, permissionLevel }: { email: string; permissionLevel: PermissionLevel }) => {
      // First check if the email already has a pending invitation
      const { data: existingInvites, error: checkError } = await supabase
        .from("app_invites")
        .select("id")
        .eq("app_id", appId)
        .eq("invited_email", email.toLowerCase())
        .is("accepted_at", null)

      if (checkError) throw new Error(checkError.message)

      if (existingInvites && existingInvites.length > 0) {
        throw new Error("This email already has a pending invitation")
      }

      // Check if the user already exists in profiles table
      const { data: existingUser, error: userError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email.toLowerCase())
        .limit(1)

      if (userError) throw new Error(userError.message)

      if (existingUser && existingUser.length > 0) {
        // Check if this user already has permission to this app
        const { data: existingPermissions, error: permissionsError } = await supabase
          .from("app_permissions")
          .select("id")
          .eq("app_id", appId)
          .eq("user_id", existingUser[0].id)
          .limit(1)

        if (permissionsError) throw new Error(permissionsError.message)

        if (existingPermissions && existingPermissions.length > 0) {
          throw new Error("This user already has access to this app")
        }

        // If existing user, add permission directly instead of invite
        const { error: addError } = await supabase.from("app_permissions").insert({
          app_id: appId,
          user_id: existingUser[0].id,
          permission_level: permissionLevel,
          created_by: currentUserId,
        })

        if (addError) throw new Error(addError.message)

        return { success: true, email, directAdd: true }
      }

      // Generate a unique token for accepting the invitation
      const invitationToken = crypto.randomUUID()

      // Create invitation in app_invites table
      const { error: inviteError } = await supabase.from("app_invites").insert({
        app_id: appId,
        invited_email: email.toLowerCase(),
        created_by: currentUserId,
        permission_level: permissionLevel,
        invitation_token: invitationToken,
      })

      if (inviteError) throw new Error(inviteError.message)

      // Send invitation email via API
      try {
        const response = await fetch("/api/invitations/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invitationToken,
            email: email.toLowerCase(),
            appId,
          }),
        })

        if (!response.ok) {
          console.error("Error sending invitation email:", await response.text())
        }
      } catch (emailError: any) {
        console.error("Error sending invitation email:", emailError)
      }

      // Return successful result
      return { success: true, email, invitationToken }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["app-invites", appId] })
      toast.success(`Invitation has been sent to ${result.email}`)
      inviteForm.reset()
      setIsAddingUser(false)
    },
    onError: (error) => {
      toast.error(`Error sending invitation: ${error.message}`)
    },
  })

  // Update invitation permission mutation
  const updateInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, permissionLevel }: { invitationId: string; permissionLevel: PermissionLevel }) => {
      const { data, error } = await supabase
        .from("app_invites")
        .update({ permission_level: permissionLevel })
        .eq("id", invitationId)

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-invites", appId] })
      toast.success("Invitation permission has been updated")
    },
    onError: (error) => {
      toast.error(`Error updating invitation permission: ${error.message}`)
    },
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.from("app_invites").delete().eq("id", invitationId)

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-invites", appId] })
      toast.success("Invitation has been canceled")
    },
    onError: (error) => {
      toast.error(`Error canceling invitation: ${error.message}`)
    },
  })

  const handleUpdatePermission = (permissionId: string, newLevel: PermissionLevel) => {
    updatePermissionMutation.mutate({ permissionId, permissionLevel: newLevel })
  }

  const handleDeletePermission = (permissionId: string) => {
    deletePermissionMutation.mutate(permissionId)
  }

  const handleUpdateInvitationPermission = (invitationId: string, permissionLevel: PermissionLevel) => {
    updateInvitationMutation.mutate({ invitationId, permissionLevel })
  }

  const handleCancelInvitation = (invitationId: string) => {
    cancelInvitationMutation.mutate(invitationId)
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

  const handleSendInvitation = (values: InviteFormValues) => {
    createInvitationMutation.mutate({
      email: values.email,
      permissionLevel: values.permission,
    })
  }

  // Format permission data for display
  const formattedPermissions =
    permissions?.map((p) => ({
      id: p.id,
      user: {
        id: p.user_id,
        email: p.users?.email || "Unknown",
        full_name: p.users?.full_name || "",
        avatar_url: p.users?.avatar_url || "",
      },
      level: p.permission_level,
      isCurrentUser: p.user_id === currentUserId,
      type: "permission" as const,
    })) || []

  // Format invitation data for display
  const formattedInvitations =
    invitations?.map((inv) => ({
      id: inv.id,
      email: inv.invited_email,
      level: inv.permission_level,
      type: "invitation" as const,
      createdAt: inv.created_at,
    })) || []

  // Combine permissions and invitations for display
  const allAccessItems = [...formattedPermissions, ...formattedInvitations]

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
          <DialogDescription>Control who has access to this app and what they can do</DialogDescription>
        </DialogHeader>
        {isLoadingPermissions || isLoadingInvitations ? (
          <div className="py-8 flex justify-center items-center">
            <div className="animate-pulse text-gray-500">Loading user permissions...</div>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {/* User permissions table */}
              {formattedPermissions.length > 0 ? (
                <div className="border rounded-md">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <h3 className="font-medium">Users</h3>
                  </div>
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
                                {p.user.avatar_url && <AvatarImage src={p.user.avatar_url || "/placeholder.svg"} />}
                                <AvatarFallback>{getUserInitials(p.user.email, p.user.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{p.user.full_name || p.user.email}</div>
                                {p.user.full_name && <div className="text-xs text-gray-500">{p.user.email}</div>}
                                {p.isCurrentUser && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    You
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p.level}
                              onValueChange={(value) => handleUpdatePermission(p.id, value as PermissionLevel)}
                              disabled={p.isCurrentUser || !isCurrentUserAdmin}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge
                                    variant={getPermissionBadgeVariant(p.level as PermissionLevel)}
                                    className="font-normal"
                                  >
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
                              disabled={p.isCurrentUser || !isCurrentUserAdmin}
                              onClick={() => handleDeletePermission(p.id)}
                              title={!isCurrentUserAdmin ? "Only admins can remove users" : "Remove user"}
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
                <div className="text-center py-8 text-gray-500">No users have been added to this app yet</div>
              )}

              {/* Invitations table */}
              {invitations && invitations.length > 0 && (
                <div className="border rounded-md mt-6">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <h3 className="font-medium">Pending Invitations</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{inv.invited_email.substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="font-medium">{inv.invited_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={inv.permission_level}
                              onValueChange={(value) => handleUpdateInvitationPermission(inv.id, value as PermissionLevel)}
                              disabled={!isCurrentUserAdmin}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge
                                    variant={getPermissionBadgeVariant(inv.permission_level as PermissionLevel)}
                                    className="font-normal"
                                  >
                                    {inv.permission_level.charAt(0).toUpperCase() + inv.permission_level.slice(1)}
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
                              disabled={!isCurrentUserAdmin}
                              onClick={() => handleCancelInvitation(inv.id)}
                              title={!isCurrentUserAdmin ? "Only admins can cancel invitations" : "Cancel invitation"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Add user or invitation section */}
              {!isAddingUser ? (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={() => setIsAddingUser(true)}
                    disabled={!isCurrentUserAdmin}
                  >
                    {!isCurrentUserAdmin && (
                      <span className="text-xs text-muted-foreground mr-2">Only admins can add users</span>
                    )}
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User or Send Invitation
                  </Button>
                </div>
              ) : (
                <div className="border rounded-md p-4 space-y-4 mt-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">
                      {inviteMethod === "existing" ? "Add Existing User" : "Invite New User"}
                    </h4>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsAddingUser(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Toggle between adding existing user and inviting by email */}
                  <div className="flex space-x-2 mb-4">
                    <Button
                      variant={inviteMethod === "existing" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInviteMethod("existing")}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Existing User
                    </Button>
                    <Button
                      variant={inviteMethod === "email" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInviteMethod("email")}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Invite by Email
                    </Button>
                  </div>

                  {inviteMethod === "existing" ? (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="user">User</Label>
                        <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className="w-full justify-between bg-transparent"
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
                                <CommandList>
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
                                            selectedUserId === user.id ? "opacity-100" : "opacity-0",
                                          )}
                                        />
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            {user.avatar_url && (
                                              <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                                            )}
                                            <AvatarFallback>
                                              {getUserInitials(user.email, user.full_name)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{user.email}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
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
                    <Form {...inviteForm}>
                      <form onSubmit={inviteForm.handleSubmit(handleSendInvitation)} className="space-y-4">
                        <FormField
                          control={inviteForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input placeholder="example@email.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={inviteForm.control}
                          name="permission"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Permission Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select permission level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={PermissionLevel.VIEWER}>Viewer</SelectItem>
                                  <SelectItem value={PermissionLevel.EDITOR}>Editor</SelectItem>
                                  <SelectItem value={PermissionLevel.ADMIN}>Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>Determines what actions they can take with this app</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit" className="w-full" disabled={createInvitationMutation.isPending}>
                          {createInvitationMutation.isPending && (
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          Send Invitation
                        </Button>
                      </form>
                    </Form>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
