"use client";

import React from "react";
import SearchInput from "@/components/ui/search-input";
import { FileFilters } from "./file-filters";
import { BulkActions } from "./bulk-actions";
import { FileTable } from "./file-table";
import { Loader } from "lucide-react";
import { VaultFile } from "../types/vault";

interface TrashTabContentProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showAllFiles: boolean;
  activeFilters: string[];
  onFilterChange: (filterType: string, checked: boolean) => void;

  isRightSectionOpen?: boolean;

  selectedFiles: number[];
  isDeleting: boolean;
  onBulkDelete: () => void | Promise<void>;

  files: VaultFile[];
  draggedFiles: number[];
  dragOverFolderId: number | null;
  onSelectAll: (checked: boolean) => void;
  onSelectFile: (fileId: number, checked: boolean) => void;
  onFolderClick: (folder: VaultFile) => void;
  onFilePreview: (file: VaultFile) => void;
  onFileDownload: (file: VaultFile) => void;
  onFileRename: (file: VaultFile) => void;
  onFileDelete: (uuid: string) => void;
  onFileRestore?: (fileId: number) => void;
  onDragStart?: (e: React.DragEvent, fileId: number) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent, folderId?: number) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetFolderId: number) => void;

  hasNextPage: boolean;
  isLoadingMore?: boolean;
  loadMoreRef?: React.RefObject<HTMLDivElement | null>;
}

export function TrashTabContent(props: TrashTabContentProps) {
  return (
    <div className="mt-4 relative">
      <div className="space-y-4">
        <div className="mb-4">
          {/* Toolbar with search and actions */}
          <div className={`flex items-stretch gap-3 ${
            props.isRightSectionOpen
              ? 'flex-col' // Mobile layout when side panel is open
              : 'flex-col sm:flex-row sm:items-center' // Default responsive layout
          }`}>
            <SearchInput
              placeholder="Search trash..."
              value={props.searchQuery}
              onChange={props.onSearchChange}
              className={`flex-1 min-w-0 ${
                props.isRightSectionOpen
                  ? 'max-w-none' // Full width when side panel is open
                  : 'max-w-md sm:max-w-none' // Constrained on mobile, full width on desktop when panel is closed
              }`}
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <FileFilters
                searchQuery={props.searchQuery}
                showAllFiles={props.showAllFiles}
                activeFilters={props.activeFilters}
                onSearchChange={props.onSearchChange}
                onFilterChange={props.onFilterChange}
              />
              <BulkActions
                selectedFilesCount={props.selectedFiles.length}
                isDeleting={props.isDeleting}
                onBulkDelete={props.onBulkDelete}
              />
            </div>
          </div>
        </div>

        <FileTable
          files={props.files}
          selectedFiles={props.selectedFiles}
          draggedFiles={props.draggedFiles}
          dragOverFolderId={props.dragOverFolderId}
          onSelectAll={props.onSelectAll}
          onSelectFile={props.onSelectFile}
          onFolderClick={props.onFolderClick}
          onFilePreview={props.onFilePreview}
          onFileDownload={props.onFileDownload}
          onFileRename={props.onFileRename}
          onFileDelete={props.onFileDelete}
          onFileRestore={props.onFileRestore}
          isTrashMode={true}
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          onDragOver={props.onDragOver}
          onDragLeave={props.onDragLeave}
          onDrop={props.onDrop}
        />

        {/* Infinite scroll trigger */}
        {props.hasNextPage && props.loadMoreRef && (
          <div ref={props.loadMoreRef} className="flex justify-center py-4">
            {props.isLoadingMore ? (
              <div className="flex items-center space-x-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span>Loading more files...</span>
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

