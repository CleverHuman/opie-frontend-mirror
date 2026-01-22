"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TabsContent } from "@/components/ui/tabs";
import SearchInput from "@/components/ui/search-input";
import { FileFilters } from "./file-filters";
import { BulkActions } from "./bulk-actions";
import { FolderActions } from "./folder-actions";
import { FileTable } from "./file-table";
import { Loader } from "lucide-react";
import { FileUploadDialog } from "./file-upload-dialog";
import { VaultFile } from "../types/vault";
import { Upload } from "./Icons";

interface FilesTabContentProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showAllFiles: boolean;
  activeFilters: string[];
  onFilterChange: (filterType: string, checked: boolean) => void;

  isRightSectionOpen?: boolean;

  selectedFiles: number[];
  isDeleting: boolean;
  onBulkDelete: () => void | Promise<void>;

  onCreateFolder: () => void;
  onUploadFile: () => void;
  onGoogleDriveClick: () => void;
  onBulkAnalyze?: () => void;

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
  onReIngest?: (file: VaultFile) => void;
  onFileAnalyze?: (file: VaultFile) => void;
  onDragStart?: (e: React.DragEvent, fileId: number) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent, folderId?: number) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetFolderId: number) => void;

  hasNextPage: boolean;
  isLoadingMore?: boolean;
  loadMoreRef?: React.RefObject<HTMLDivElement | null>;

  uploadDialogOpen: boolean;
  setUploadDialogOpen: (open: boolean) => void;
  projectId: string;
  onUploadComplete: (uploadedFiles: any[]) => void;
  onFilesDrop?: (files: File[]) => Promise<void>;
}

export function FilesTabContent(props: FilesTabContentProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = React.useRef(0);

  useEffect(() => {
    const hide = () => {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    };

    const handleWindowBlur = () => {
      hide();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Drag-cancel (Esc) doesn't reliably fire dragleave/drop on the drop target.
      if (e.key === "Escape") hide();
    };

    const handleWindowDrop = () => {
      // Dropping outside this container should still clear the overlay.
      hide();
    };

    const handleWindowDragEnd = () => {
      // Drag was cancelled or completed - always hide
      hide();
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      // When leaving the browser window during a drag, many browsers report 0/0.
      // This helps clear the overlay if the element never receives onDragLeave.
      if (e.clientX === 0 && e.clientY === 0) hide();
    };

    const handleMouseUp = () => {
      // Mouse up can indicate drag was cancelled
      setTimeout(hide, 100);
    };

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("drop", handleWindowDrop, true);
    window.addEventListener("dragend", handleWindowDragEnd, true);
    window.addEventListener("dragleave", handleWindowDragLeave, true);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("drop", handleWindowDrop, true);
      window.removeEventListener("dragend", handleWindowDragEnd, true);
      window.removeEventListener("dragleave", handleWindowDragLeave, true);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep dragCounter symmetric with handleDragEnter to avoid going negative
    // (e.g. dragging text/URLs over the container).
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    }
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList) as File[];
    if (files.length === 0) return;

    if (props.onFilesDrop) {
      await props.onFilesDrop(files);
    }
  }, [props]);

  return (
    <TabsContent
      value="files"
      className={`mt-4 relative min-h-[calc(100vh-8rem)] z-10 ${isDraggingOver ? 'bg-indigo-50/30' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-50/80 backdrop-blur-sm border-2 border-indigo-400 border-dashed rounded-xl pointer-events-none">
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-indigo-600 mb-2" />
            <p className="text-lg font-bold text-indigo-800">Drop files to upload</p>
          </div>
        </div>
      )}
      <div className="space-y-4">
        <div className="mb-4">
          {/* Toolbar with search and actions */}
          <div className={`flex items-stretch gap-3 ${
            props.isRightSectionOpen
              ? 'flex-col' // Mobile layout when side panel is open
              : 'flex-col sm:flex-row sm:items-center' // Default responsive layout
          }`}>
            <SearchInput
              placeholder="Search files..."
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
              <FolderActions
                onCreateFolder={props.onCreateFolder}
                onUploadFile={props.onUploadFile}
                onGoogleDriveClick={props.onGoogleDriveClick}
                onBulkAnalyze={props.onBulkAnalyze}
                selectedFilesCount={props.selectedFiles.length}
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
          onReIngest={props.onReIngest}
          onFileAnalyze={props.onFileAnalyze}
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

        <FileUploadDialog
          open={props.uploadDialogOpen}
          onOpenChange={props.setUploadDialogOpen}
          projectId={props.projectId}
          onUploadComplete={props.onUploadComplete}
        />
      </div>
    </TabsContent>
  );
}

