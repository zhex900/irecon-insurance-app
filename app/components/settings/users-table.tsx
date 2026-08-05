import { Trash2Icon, UserCheckIcon, UsersIcon, UserXIcon } from "lucide-react";
import { ListSearchField } from "~/components/forms/list-search-field";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import { UserAvatar } from "~/components/ui/user-avatar";
import { formatRoleLabel } from "~/lib/auth/roles";
import type { AppUser } from "~/lib/db/types";
import { SearchHighlight } from "~/components/search/highlight-cell";

export function UsersTable({
  users,
  search,
  searchQuery,
  onSearchChange,
  onClearSearch,
  filteredHint,
  total,
  page,
  pageSize,
  pageHref,
  pageSizeHref,
  onEdit,
  onToggle,
  onDelete,
}: {
  users: AppUser[];
  search: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  filteredHint: string;
  total: number;
  page: number;
  pageSize: number;
  pageHref: (nextPage: number) => string;
  pageSizeHref: (nextPageSize: number) => string;
  onEdit: (user: AppUser) => void;
  onToggle: (user: AppUser) => void;
  onDelete: (user: AppUser) => void;
}) {
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchField
          value={search}
          onChange={onSearchChange}
          onClear={onClearSearch}
          placeholder="Search name, email, role…"
          aria-label="Search users"
        />
        <p className="text-sm text-muted-foreground">{filteredHint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UsersIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {searchQuery ? "No match" : "No users found"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {searchQuery
                          ? `No match for “${searchQuery}”.`
                          : "No users match the current search."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const roleLabel = formatRoleLabel(user.role);
                return (
                  <InteractiveTableRow
                    key={user.userId}
                    aria-label={`Edit ${user.fullName}`}
                    onActivate={() => onEdit(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          size="sm"
                          email={user.email}
                          fullName={user.fullName}
                          userId={user.userId}
                          avatarR2Key={user.avatarR2Key}
                        />
                        <span className="font-medium">
                          <SearchHighlight
                            text={user.fullName}
                            query={searchQuery}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <SearchHighlight text={user.email} query={searchQuery} />
                    </TableCell>
                    <TableCell>
                      <SearchHighlight text={roleLabel} query={searchQuery} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.disabled ? "destructive-light" : "success-light"
                        }
                        size="sm"
                        radius="full"
                      >
                        {user.disabled ? "Disabled" : "Active"}
                      </Badge>
                    </TableCell>
                    <InteractiveTableActionsCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={
                            user.disabled
                              ? `Enable ${user.fullName}`
                              : `Disable ${user.fullName}`
                          }
                          onClick={() => onToggle(user)}
                        >
                          {user.disabled ? <UserCheckIcon /> : <UserXIcon />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${user.fullName}`}
                          onClick={() => onDelete(user)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </InteractiveTableActionsCell>
                  </InteractiveTableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          pageHref={pageHref}
          pageSizeHref={pageSizeHref}
        />
      </div>
    </>
  );
}
