import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldX,
  Undo,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  async loader() {
    const pageSize = 20;

    const { data: users } = await authClient.admin.listUsers({
      query: {
        limit: pageSize,
        offset: 0, // Always fetch first page initially
      },
    });

    return {
      users,
      pageSize,
      error: null,
    };
  },
  component: UsersPage,
  pendingComponent: UsersPending,
});

function UsersPending() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersPage() {
  const { users, pageSize, error } = Route.useLoaderData();
  const [currentPage, setCurrentPage] = useState(1);
  const [userData, setUserData] = useState(users);
  const [userToBan, setUserToBan] = useState<(typeof userList)[0] | null>(null);
  const [userToChangeRole, setUserToChangeRole] = useState<
    (typeof userList)[0] | null
  >(null);
  const [userToImpersonate, setUserToImpersonate] = useState<
    (typeof userList)[0] | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const userList = userData?.users || [];
  const totalUsers = userData?.total || 0;
  const totalPages = Math.ceil(totalUsers / pageSize);

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);

    const { data: newUsers } = await authClient.admin.listUsers({
      query: {
        limit: pageSize,
        offset: (newPage - 1) * pageSize,
      },
    });

    setUserData(newUsers);
  };

  const handleBanUser = async () => {
    if (!userToBan) return;

    setIsProcessing(true);
    try {
      if (userToBan.banned) {
        // Unban the user
        await authClient.admin.unbanUser({
          userId: userToBan.id,
        });
        toast.success("User Unbanned", {
          description: `${userToBan.email} has been unbanned successfully.`,
        });
      } else {
        // Ban the user
        await authClient.admin.banUser({
          userId: userToBan.id,
          banReason: "Banned by administrator",
        });
        toast.success("User Banned", {
          description: `${userToBan.email} has been banned successfully.`,
        });
      }

      // Update the user list after ban/unban
      const { data: refreshedUsers } = await authClient.admin.listUsers({
        query: {
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
      });
      setUserData(refreshedUsers);
    } catch (error) {
      toast.error("Error", {
        description: `Failed to ${userToBan.banned ? "unban" : "ban"} user. Please try again.`,
      });
    } finally {
      setIsProcessing(false);
      setUserToBan(null);
    }
  };

  const handleChangeRole = async () => {
    if (!userToChangeRole) return;

    setIsProcessing(true);
    try {
      if (userToChangeRole.role === "admin") {
        // Remove admin role
        await authClient.admin.setRole({
          userId: userToChangeRole.id,
          role: "user",
        });
        toast.success("Role Updated", {
          description: `${userToChangeRole.email} is no longer an admin.`,
        });
      } else {
        // Make user an admin
        await authClient.admin.setRole({
          userId: userToChangeRole.id,
          role: "admin",
        });
        toast.success("Role Updated", {
          description: `${userToChangeRole.email} is now an admin.`,
        });
      }

      // Update the user list after role change
      const { data: refreshedUsers } = await authClient.admin.listUsers({
        query: {
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
      });
      setUserData(refreshedUsers);
    } catch (error) {
      toast.error("Error", {
        description: `Failed to update role for ${userToChangeRole.email}. Please try again.`,
      });
    } finally {
      setIsProcessing(false);
      setUserToChangeRole(null);
    }
  };

  const handleImpersonateUser = async () => {
    if (!userToImpersonate) return;

    setIsProcessing(true);
    try {
      // Impersonate the user
      await authClient.admin.impersonateUser({
        userId: userToImpersonate.id,
      });

      toast.success("User Impersonated", {
        description: `You are now impersonating ${userToImpersonate.email}. You will be redirected to the dashboard.`,
      });

      // Redirect to the home page as the impersonated user
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (error) {
      toast.error("Error", {
        description: `Failed to impersonate ${userToImpersonate.email}. Please try again.`,
      });
    } finally {
      setIsProcessing(false);
      setUserToImpersonate(null);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderUsersTable = () => {
    if (error) {
      return (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
          Error loading users: {error}
        </div>
      );
    }

    if (userList.length === 0) {
      return (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-center text-muted-foreground">
          No users found.
        </div>
      );
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.name || "—"}</TableCell>
                <TableCell>
                  {user.role ? (
                    <Badge
                      variant={user.role === "admin" ? "outline" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                  ) : (
                    "user"
                  )}
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : user.emailVerified ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setUserToChangeRole(user)}
                        disabled={isProcessing}
                      >
                        {user.role === "admin" ? (
                          <>
                            <ShieldX className="h-4 w-4 mr-2" />
                            Remove Admin
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Make Admin
                          </>
                        )}
                      </DropdownMenuItem>
                      {user.role !== "admin" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setUserToBan(user)}
                            disabled={isProcessing}
                          >
                            {user.banned ? (
                              <>
                                <Undo className="h-4 w-4 mr-2" />
                                Unban
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Ban
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setUserToImpersonate(user)}
                            disabled={isProcessing}
                          >
                            Impersonate
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers}{" "}
              users
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>{renderUsersTable()}</CardContent>
      </Card>

      {/* Ban User Confirmation Dialog */}
      <Dialog
        open={!!userToBan}
        onOpenChange={(open) => !open && setUserToBan(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userToBan?.banned ? "Unban" : "Ban"} User
            </DialogTitle>
            <DialogDescription>
              {userToBan?.banned
                ? `Are you sure you want to unban ${userToBan?.email}?`
                : `Are you sure you want to ban ${userToBan?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToBan(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={userToBan?.banned ? "default" : "destructive"}
              onClick={handleBanUser}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : userToBan?.banned ? (
                "Unban User"
              ) : (
                "Ban User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Confirmation Dialog */}
      <Dialog
        open={!!userToChangeRole}
        onOpenChange={(open) => !open && setUserToChangeRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userToChangeRole?.role === "admin"
                ? "Remove Admin Role"
                : "Make Admin"}
            </DialogTitle>
            <DialogDescription>
              {userToChangeRole?.role === "admin"
                ? `Are you sure you want to remove admin role from ${userToChangeRole?.email}?`
                : `Are you sure you want to make ${userToChangeRole?.email} an admin?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToChangeRole(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={
                userToChangeRole?.role === "admin" ? "destructive" : "default"
              }
              onClick={handleChangeRole}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : userToChangeRole?.role === "admin" ? (
                "Remove Admin Role"
              ) : (
                "Make Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonate User Confirmation Dialog */}
      <Dialog
        open={!!userToImpersonate}
        onOpenChange={(open) => !open && setUserToImpersonate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate User</DialogTitle>
            <DialogDescription>
              {`Are you sure you want to impersonate ${userToImpersonate?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToImpersonate(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleImpersonateUser}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Impersonate User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
