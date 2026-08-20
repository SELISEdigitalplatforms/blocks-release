import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Button } from "@/components/ui-kits/button/button";
import { useRepoSecretAudit } from "@blocks-deployment/hooks/use-repo-secrets";
import type { IRepoSecretAuditRow } from "@blocks-deployment/models/repo-secrets.model";
import { useState } from "react";

type SecretAuditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
};

const PAGE_SIZE = 10;

/**
 * The three states of the audit list, kept as one component with early returns so the
 * loading/empty/populated branches stay readable instead of nesting as ternaries in JSX.
 */
const SecretAuditBody = ({
  isLoading,
  rows,
}: {
  isLoading: boolean;
  rows: IRepoSecretAuditRow[];
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" data-testid="audit-loading">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.auditId}>
              <TableCell>{row.action}</TableCell>
              <TableCell>
                {row.outcome}
                {row.reason ? ` (${row.reason})` : ""}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.actorUserId}
              </TableCell>
              <TableCell>
                {new Date(row.createdDate).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/**
 * The audit trail for this repository's secret.
 *
 * Paging is local state, not URL state: this is a modal reached from a tab, and a URL that
 * reopens someone else's dialog on page three is not a view anyone shares.
 */
export const SecretAuditModal = ({
  open,
  onOpenChange,
  repoId,
}: SecretAuditModalProps) => {
  const [pageNumber, setPageNumber] = useState(1);

  const { data, isLoading } = useRepoSecretAudit(
    repoId,
    pageNumber,
    PAGE_SIZE,
    open,
  );

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const hasNextPage = pageNumber * PAGE_SIZE < totalCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Secret activity</DialogTitle>
          <DialogDescription>
            Every action taken on this repository&apos;s secrets. Values are
            never recorded here.
          </DialogDescription>
        </DialogHeader>

        <SecretAuditBody isLoading={isLoading} rows={rows} />

        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Page {pageNumber} of {Math.ceil(totalCount / PAGE_SIZE)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNumber === 1}
              onClick={() => setPageNumber((page) => page - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => setPageNumber((page) => page + 1)}>
              Next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
