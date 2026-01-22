"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { TrashTabContent } from "./trash-tab-content";
import { useToast } from "@/components/ui/use-toast";
import { useRightSection } from "@/hooks/use-right-section";
import { usePagination } from "@/hooks/use-pagination";
import { isSafeUrl } from "@/lib/utils/url";
import { getTrashFilesByProject, permanentDeleteVaultFile, restoreVaultFile, VaultFilesResponse } from "@/api/vault";
import { VaultFile } from "../types/vault";

interface TrashTabProps {
  projectId: string;
  projectName?: string;
  onFilesTabRefresh?: () => void;
}

export const TrashTab = React.forwardRef<{
  refreshFiles: () => void;
}, TrashTabProps>(({ projectId, projectName, onFilesTabRefresh }, ref) => {
  const { toast } = useToast();

  // Initialize state variables
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<number[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  // Pagination hook
  const {
    data: allFiles,
    isLoading,
    isLoadingMore,
    hasNextPage,
    loadMoreRef,
    refresh: refreshFiles,
    reset: resetPagination,
  } = usePagination<VaultFile>({
    fetchFn: async (page, pageSize, search) => {
      const response = await getTrashFilesByProject(
        projectId,
        page,
        pageSize,
        search || ''
      );
      return response;
    },
    pageSize: 20,
    mode: 'infinite',
    getItemId: (file) => file.id,
    onError: (error) => {
      console.error('Error fetching trash files:', error);
      toast({ title: "Error", description: "Failed to load trash files", variant: "destructive" });
    },
    dependencies: [searchQuery],
  });

  // AI Panel configuration using right section hook
  const { showRightSection, hideRightSection, rightSection } = useRightSection();

  // Process files to add file_type for filtering
  const processedFiles = useMemo(() => {
    if(!allFiles) return [];
    return allFiles.map((file: VaultFile) => {
      if (file.is_folder) return { ...file, file_type: 'folder' } as VaultFile;
      const mimeType = file.type;
      const mimeExtension = mimeType ? mimeType : '';
      const fileExtension = mimeExtension || file.filename || 'unknown';
      return { ...file, file_type: fileExtension } as VaultFile;
    });
  }, [allFiles]);

  const filteredFiles = useMemo(() => {
    return processedFiles.filter(file => {
      const fileType = file.file_type || '';
      const matchesType = showAllFiles || (activeFilters.length === 0) || activeFilters.some((filter: string) => fileType.includes(filter));
      const matchesSearch = file.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      return matchesType && matchesSearch;
    });
  }, [processedFiles, showAllFiles, activeFilters, searchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFilterChange = useCallback((filterType: string, checked: boolean) => {
    if (filterType === 'all') {
      setShowAllFiles(checked);
      if (checked) setActiveFilters([]);
    } else if (filterType === 'doc') {
      setShowAllFiles(false);
      const docFilters = ['doc', 'docx'];
      setActiveFilters(prev => checked ? [...prev.filter(f => !docFilters.includes(f)), ...docFilters] : prev.filter(f => !docFilters.includes(f)));
    } else if (filterType === 'xls') {
      setShowAllFiles(false);
      const excelFilters = ['xls', 'xlsx'];
      setActiveFilters(prev => checked ? [...prev.filter(f => !excelFilters.includes(f)), ...excelFilters] : prev.filter(f => !excelFilters.includes(f)));
    } else if (filterType === 'txt') {
      setShowAllFiles(false);
      const textFilters = ['txt', 'csv'];
      setActiveFilters(prev => checked ? [...prev.filter(f => !textFilters.includes(f)), ...textFilters] : prev.filter(f => !textFilters.includes(f)));
    } else if (filterType === 'jpg') {
      setShowAllFiles(false);
      const imageFilters = ['jpg', 'jpeg', 'png'];
      setActiveFilters(prev => checked ? [...prev.filter(f => !imageFilters.includes(f)), ...imageFilters] : prev.filter(f => !imageFilters.includes(f)));
    } else {
      setShowAllFiles(false);
      setActiveFilters(prev => checked ? [...prev.filter(f => f !== filterType), filterType] : prev.filter(f => f !== filterType));
    }
  }, []);

  const toggleSelectAll = useCallback((checked: boolean) => {
    if (checked) setSelectedFiles(filteredFiles.map(file => file.id)); else setSelectedFiles([]);
  }, [filteredFiles]);

  const toggleSelectFile = useCallback((fileId: number, checked: boolean) => {
    setSelectedFiles(prev => checked ? [...prev, fileId] : prev.filter(id => id !== fileId));
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setIsDeleting(true);
    try {
      let successCount = 0; let errorCount = 0;
      for (const fileId of selectedFiles) {
        // Use allFiles instead of filteredFiles to ensure we can find the file even if it's filtered out
        const file = allFiles?.find(f => f.id === fileId);
        if (!file || !file.uuid) {
          console.error('File not found or missing UUID in bulk delete:', { fileId, file });
          errorCount++;
          continue;
        }
        try { await permanentDeleteVaultFile(file.uuid); successCount++; } catch (e) { 
          console.error('Bulk delete error for file:', fileId, e);
          errorCount++; 
        }
      }
      if (successCount > 0) toast({ title: "Success", description: `${successCount} file${successCount !== 1 ? 's' : ''} permanently deleted` });
      if (errorCount > 0) toast({ title: "Error", description: `Failed to delete ${errorCount} file${errorCount !== 1 ? 's' : ''}`, variant: "destructive" });
      refreshFiles();
      onFilesTabRefresh?.();
      setSelectedFiles([]);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFiles, allFiles, refreshFiles, toast, onFilesTabRefresh]);

  const handleDragStart = useCallback((e: React.DragEvent, fileId: number) => {
    e.stopPropagation();
    const filesToDrag = selectedFiles.includes(fileId) ? selectedFiles : [fileId];
    setDraggedFiles(filesToDrag);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag));
  }, [selectedFiles]);

  const handleDragEnd = useCallback(() => { setDraggedFiles([]); setDragOverFolderId(null); }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId?: number) => {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (folderId !== undefined) setDragOverFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null);
    // Trash tab doesn't support moving files - they're already deleted
    toast({ title: "Invalid operation", description: "Cannot move files in trash", variant: "destructive" });
    setDraggedFiles([]);
  }, [toast]);

  const handleFileDownload = async (file: VaultFile) => {
    if (!file.uuid) {
      toast({ title: "Error", description: "File UUID not available.", variant: "destructive" });
      return;
    }

    try {
      const { getVaultFileDownloadUrl } = await import('@/api/vault');
      // Fetch signed URL for download (30 min expiry, attachment disposition)
      const response = await getVaultFileDownloadUrl(file.uuid, 30, 'attachment');
      const a = document.createElement('a');
      a.href = response.url;
      a.download = file.original_filename || response.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download file:', error);
      toast({ title: "Error", description: "Failed to download file. Please try again.", variant: "destructive" });
    }
  };

  const handleFilePreview = async (file: VaultFile) => {
    if (!file.uuid) {
      toast({ title: "Error", description: "File UUID not available.", variant: "destructive" });
      return;
    }

    try {
      const { getVaultFileDownloadUrl } = await import('@/api/vault');
      // Fetch signed URL for viewing (15 min expiry, inline disposition)
      const response = await getVaultFileDownloadUrl(file.uuid, 15, 'inline');
      window.open(response.url, '_blank');
    } catch (error) {
      console.error('Failed to preview file:', error);
      toast({ title: "Error", description: "Failed to preview file. Please try again.", variant: "destructive" });
    }
  };

  const handleFileDelete = useCallback(async (fileId: number) => {
    // Use allFiles instead of filteredFiles to ensure we can find the file even if it's filtered out
    const file = allFiles?.find(f => f.id === fileId);
    if (!file || !file.uuid) {
      console.error('File not found or missing UUID:', { fileId, file, allFilesLength: allFiles?.length });
      toast({ title: "Error", description: "File UUID not found", variant: "destructive" });
      return;
    }
    try { 
      await permanentDeleteVaultFile(file.uuid); 
      toast({ title: "Success", description: "File permanently deleted" }); 
      refreshFiles(); 
      onFilesTabRefresh?.();
      setSelectedFiles([]); 
    }
    catch (error) { 
      console.error('Delete error:', error);
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" }); 
    }
  }, [allFiles, refreshFiles, toast, onFilesTabRefresh]);

  const handleFileRestore = useCallback(async (fileId: number) => {
    // Use allFiles instead of filteredFiles to ensure we can find the file even if it's filtered out
    const file = allFiles?.find(f => f.id === fileId);
    if (!file || !file.uuid) {
      console.error('File not found or missing UUID:', { fileId, file, allFilesLength: allFiles?.length });
      toast({ title: "Error", description: "File UUID not found", variant: "destructive" });
      return;
    }
    try { 
      await restoreVaultFile(file.uuid); 
      toast({ title: "Success", description: "File restored successfully" }); 
      refreshFiles(); 
      onFilesTabRefresh?.();
      setSelectedFiles([]); 
    }
    catch (error) { 
      console.error('Restore error:', error);
      toast({ title: "Error", description: "Failed to restore file", variant: "destructive" }); 
    }
  }, [allFiles, refreshFiles, toast, onFilesTabRefresh]);

  const handleFolderClick = useCallback((folder: VaultFile) => {
    // Trash files don't support folder navigation
    toast({ title: "Info", description: "Cannot navigate folders in trash", duration: 2000 });
  }, [toast]);

  const handleFileRename = useCallback((file: VaultFile) => {
    // Trash files cannot be renamed
    toast({ title: "Info", description: "Cannot rename files in trash", duration: 2000 });
  }, [toast]);

  // Expose refreshFiles method to parent component
  useImperativeHandle(ref, () => ({
    refreshFiles: refreshFiles,
  }), [refreshFiles]);

  return (
    <TrashTabContent
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      showAllFiles={showAllFiles}
      activeFilters={activeFilters}
      onFilterChange={handleFilterChange}
      isRightSectionOpen={rightSection !== null}
      selectedFiles={selectedFiles}
      isDeleting={isDeleting}
      onBulkDelete={handleBulkDelete}
      files={filteredFiles}
      draggedFiles={draggedFiles}
      dragOverFolderId={dragOverFolderId}
      onSelectAll={toggleSelectAll}
      onSelectFile={toggleSelectFile}
      onFolderClick={handleFolderClick}
      onFilePreview={handleFilePreview}
      onFileDownload={handleFileDownload}
      onFileRename={handleFileRename}
      onFileDelete={handleFileDelete}
      onFileRestore={handleFileRestore}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      hasNextPage={hasNextPage}
      isLoadingMore={isLoadingMore}
      loadMoreRef={loadMoreRef}
    />
  );
});

TrashTab.displayName = 'TrashTab';

