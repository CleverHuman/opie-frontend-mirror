"use client";

import { useMemo, useCallback } from "react";
import type { DragEvent } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import {
  Folder,
  FileText,
  MoreHorizontal,
  Eye,
  Download,
  Link,
  Edit,
  Trash2,
  RotateCcw,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { isSafeUrl } from "@/lib/utils/url";

import { VaultFile } from "../types/vault";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

interface FileTableProps {
  files: VaultFile[];
  selectedFiles: number[];
  draggedFiles: number[];
  dragOverFolderId: number | null;
  onSelectAll: (checked: boolean) => void;
  onSelectFile: (fileId: number, checked: boolean) => void;
  onFolderClick: (folder: VaultFile) => void;
  onFilePreview: (file: VaultFile) => void;
  onFileDownload: (file: VaultFile) => void;
  onReIngest?: (file: VaultFile) => void;
  onFileRename: (file: VaultFile) => void;
  onFileDelete: (uuid: string) => void;
  onFileAnalyze?: (file: VaultFile) => void;
  onDragStart?: (event: DragEvent, fileId: number) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent, folderId?: number) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent, targetFolderId: number) => void;
  isTrashMode?: boolean;
  onFileRestore?: (fileId: number) => void;
}

const STATUS_STYLES: Record<
  string,
  { badgeClass: string; indicatorClass: string; label: string }
> = {
  pending: {
    badgeClass:
      "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800",
    indicatorClass: "bg-amber-400 dark:bg-amber-500",
    label: "pending",
  },
  completed: {
    badgeClass:
      "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
    indicatorClass: "bg-green-400 dark:bg-green-500",
    label: "completed",
  },
  processing: {
    badgeClass:
      "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
    indicatorClass: "bg-blue-400 dark:bg-blue-500",
    label: "processing",
  },
  failed: {
    badgeClass:
      "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
    indicatorClass: "bg-red-400 dark:bg-red-500",
    label: "Error",
  },
  error: {
    badgeClass:
      "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
    indicatorClass: "bg-red-400 dark:bg-red-500",
    label: "Error",
  },
};

function renderStatusBadge(status?: string | null) {
  if (!status) return null;

  const config = STATUS_STYLES[status.toLowerCase()];

  if (!config) return null;

  return (
    <Badge variant="outline" className={config.badgeClass}>
      <div className={cn("mr-1 h-3 w-3 rounded-full", config.indicatorClass)} />
      {config.label}
    </Badge>
  );
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "N/A";

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileTable({
  files,
  selectedFiles,
  draggedFiles,
  dragOverFolderId,
  onSelectAll,
  onSelectFile,
  onFolderClick,
  onFilePreview,
  onFileDownload,
  onFileRename,
  onFileDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isTrashMode = false,
  onFileRestore,
  onReIngest,
  onFileAnalyze,
}: FileTableProps) {
  const { toast } = useToast();

  const allSelected = files.length > 0 && selectedFiles.length === files.length;
  const partiallySelected =
    selectedFiles.length > 0 && selectedFiles.length < files.length;
  const selectAllState: boolean | "indeterminate" = allSelected
    ? true
    : partiallySelected
    ? "indeterminate"
    : false;

  const handleCopyLink = useCallback(
    async (file: VaultFile) => {
      if (!file.uuid) {
        toast({
          title: "Error",
          description: "File UUID not available.",
          variant: "destructive",
        });
        return;
      }

      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          throw new Error("Clipboard API unavailable");
        }

        // Fetch signed URL to copy
        const { getVaultFileDownloadUrl } = await import('@/api/vault');
        const response = await getVaultFileDownloadUrl(file.uuid, 15, 'inline');
        await navigator.clipboard.writeText(response.url);
        toast({
          title: "Link copied",
          description: "File link has been copied to your clipboard.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Unable to copy link. Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const columns = useMemo<ColumnDef<VaultFile>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        size: 48,
        meta: {
          headerClassName: "w-12",
          cellClassName: "w-12",
        } satisfies ColumnMeta,
        header: () => (
          <Checkbox
            checked={selectAllState}
            onCheckedChange={(value) => onSelectAll(!!value)}
            aria-label="Select all files"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedFiles.includes(row.original.id)}
            onCheckedChange={(value) => onSelectFile(row.original.id, !!value)}
            aria-label={`Select ${
              row.original.original_filename || "Unnamed File"
            }`}
            className="translate-y-[2px]"
          />
        ),
      },
      {
        accessorKey: "original_filename",
        header: "Name",
        meta: {
          headerClassName: "w-[260px]",
          cellClassName: "w-[260px]",
        } satisfies ColumnMeta,
        cell: ({ row }) => {
          const file = row.original;

          if (file.is_folder) {
            return (
              <button
                type="button"
                className="flex items-center gap-2 text-left font-medium text-foreground transition-colors hover:text-primary"
                onClick={() => onFolderClick(file)}
              >
                <Folder className="h-5 w-5 text-muted-foreground" />
                <span className="line-clamp-2 max-w-[200px] text-left">
                  {file.original_filename || "New Folder"}
                </span>
              </button>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="line-clamp-2 max-w-[200px] font-medium">
                {file.original_filename || "Unnamed File"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "file_type",
        header: "Type",
        meta: {
          headerClassName: "w-[120px]",
          cellClassName: "w-[120px]",
        } satisfies ColumnMeta,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="inline-flex  items-center overflow-hidden"
            >
              <span className="truncate max-w-[200px] font-medium">
                {row.original.is_folder
                  ? "FOLDER"
                  : row.original.file_type
                  ? row.original.file_type.toUpperCase()
                  : "UNKNOWN"}
              </span>
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "size",
        header: "Size",
        meta: {
          headerClassName: "w-32",
          cellClassName: "w-32",
        } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {formatFileSize(row.original.size)}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Last Modified",
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {row.original.created_at
              ? formatDistanceToNow(new Date(row.original.created_at), {
                  addSuffix: true,
                })
              : "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "embedding_status",
        header: "Status",
        meta: {
          headerClassName: "w-32",
          cellClassName: "w-32",
        } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.is_folder
            ? null
            : renderStatusBadge(row.original.embedding_status),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          headerClassName: "w-24",
          cellClassName: "w-24",
        } satisfies ColumnMeta,
        cell: ({ row }) => {
          const file = row.original;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isTrashMode ? (
                    <>
                      {onFileRestore && (
                        <DropdownMenuItem onClick={() => onFileRestore(file.id)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => file.uuid && onFileDelete(file.uuid)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Permanently
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => onFilePreview(file)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      {!file.is_folder && onFileAnalyze && (
                        <DropdownMenuItem onClick={() => onFileAnalyze(file)}>
                          <Zap className="mr-2 h-4 w-4" />
                          Analyse
                        </DropdownMenuItem>
                      )}
                      {onReIngest && (
                        <DropdownMenuItem onClick={() => onReIngest(file)}>
                          <FileText className="mr-2 h-4 w-4" />
                          ReIngest
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onFileDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyLink(file)}>
                        <Link className="mr-2 h-4 w-4" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onFileRename(file)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => file.uuid && onFileDelete(file.uuid)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      handleCopyLink,
      isTrashMode,
      onFileDelete,
      onFileDownload,
      onFileAnalyze,
      onReIngest,
      onFilePreview,
      onFileRename,
      onFileRestore,
      onFolderClick,
      onSelectAll,
      onSelectFile,
      selectAllState,
      selectedFiles,
    ]
  );

  const table = useReactTable({
    data: files,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id.toString(),
  });

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="max-h-[600px] overflow-y-auto">
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as
                        | ColumnMeta
                        | undefined;

                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            header.id === "actions" ? "text-right" : undefined,
                            meta?.headerClassName
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => {
                    const file = row.original;
                    const isDragged = draggedFiles.includes(file.id);
                    const isDragOverTarget =
                      dragOverFolderId === file.id && file.is_folder;

                    return (
                      <TableRow
                        key={row.id}
                        data-state={
                          selectedFiles.includes(file.id)
                            ? "selected"
                            : undefined
                        }
                        className={cn(
                          "group",
                          onDragStart ? "cursor-move" : undefined,
                          isDragged ? "opacity-50" : undefined,
                          isDragOverTarget ? "bg-primary/10" : undefined
                        )}
                        draggable={Boolean(onDragStart)}
                        onDragStart={
                          onDragStart
                            ? (event) => onDragStart(event, file.id)
                            : undefined
                        }
                        onDragEnd={onDragEnd}
                        onDragOver={
                          file.is_folder && onDragOver
                            ? (event) => onDragOver(event, file.id)
                            : undefined
                        }
                        onDragLeave={onDragLeave}
                        onDrop={
                          file.is_folder && onDrop
                            ? (event) => onDrop(event, file.id)
                            : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta as
                            | ColumnMeta
                            | undefined;

                          return (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                cell.column.id === "actions"
                                  ? "text-right"
                                  : undefined,
                                cell.column.id === "actions"
                                  ? "group/action"
                                  : undefined,
                                meta?.cellClassName
                              )}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No files found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Card>
  );
}
