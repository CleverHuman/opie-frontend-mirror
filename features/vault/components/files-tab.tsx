"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FilesTabContent } from "./files-tab-content";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRightSection } from "@/hooks/use-right-section";
import { usePagination } from "@/hooks/use-pagination";
import { AiLayoutPanel } from "@/components/vault/ai-layout-panel";
import { isSafeUrl } from "@/lib/utils/url";
import { uploadFiles, getVaultFilesByProject, deleteVaultFile, createFolder, updateVaultFile, moveVaultFiles, VaultFilesResponse } from "@/api/vault";
import { VaultFile } from "../types/vault";
import { CreateFolderDialog } from "./create-folder-dialog";
import { RenameDialog } from "./rename-dialog";
import { FilePreviewDialog } from "./file-preview-dialog";

interface FilesTabProps {
  projectId: string;
  projectName?: string;
  teamId?: number;
  requestedNavigation?: number | null;
  onBreadcrumbChange?: () => void;
  onTrashTabRefresh?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export const FilesTab = React.forwardRef<{
  getBreadcrumbData: () => { currentFolderId: number; breadcrumbs: { id: number; name: string }[] };
  navigateToFolder: (folderId: number) => void;
  handleFilesDrop: (files: File[]) => Promise<void>;
  handleDrop: (e: React.DragEvent, targetFolderId: number) => Promise<void>;
  refreshFiles: () => void;
}, FilesTabProps>(({ projectId, projectName, teamId, requestedNavigation, onBreadcrumbChange, onTrashTabRefresh }, ref) => {
  const { toast } = useToast();
  const { user } = useAuth();

  // Ref to store the latest breadcrumb state for immediate access
  const breadcrumbRef = useRef<{ currentFolderId: number; breadcrumbs: { id: number; name: string }[] }>({
    currentFolderId: 0,
    breadcrumbs: []
  });

  // Initialize state variables first
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(0);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<{ id: number; name: string }[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<number[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const [renameFileOpen, setRenameFileOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<VaultFile | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
    fetchFn: async (page, pageSize, search, folderId) => {
      const response = await getVaultFilesByProject(
        projectId,
        page,
        pageSize,
        search,
        folderId
      );
      return response;
    },
    pageSize: 20,
    mode: 'infinite',
    getItemId: (file) => file.id,
    onError: (error) => {
      console.error('Error fetching vault files:', error);
      toast({ title: "Error", description: "Failed to load vault files", variant: "destructive" });
    },
    dependencies: [searchQuery, currentFolderId],
  });

  // Initialize context state with proper initial values
  const [currentContext, setCurrentContext] = useState({
    title: projectName || 'Root Folder',
    files: allFiles,
    folderId: currentFolderId,
    projectId: projectId
  });

  // AI Panel configuration using right section hook
  const { showRightSection, hideRightSection, rightSection } = useRightSection();

  // Initialize breadcrumb ref on mount
  useEffect(() => {
    breadcrumbRef.current = { currentFolderId, breadcrumbs: folderBreadcrumbs };
  }, []); // Only run once on mount

  // Update context when relevant data changes
  useEffect(() => {
    setCurrentContext({
      title: currentFolderId === 0 ? projectName || 'Root Folder' : folderBreadcrumbs[folderBreadcrumbs.length - 1]?.name || 'Current Folder',
      files: allFiles,
      folderId: currentFolderId,
      projectId: projectId
    });
  }, [projectName, allFiles, currentFolderId, projectId, folderBreadcrumbs]);

  // Process files to add file_type for filtering
  const processedFiles = useMemo(() => {
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
        const file = filteredFiles.find(f => f.id === fileId);
        if (file?.uuid) {
          try { await deleteVaultFile(file.uuid); successCount++; } catch (e) { errorCount++; }
        } else {
          errorCount++;
        }
      }
      if (successCount > 0) toast({ title: "Success", description: `${successCount} file${successCount !== 1 ? 's' : ''} deleted successfully` });
      if (errorCount > 0) toast({ title: "Error", description: `Failed to delete ${errorCount} file${errorCount !== 1 ? 's' : ''}`, variant: "destructive" });
      refreshFiles();
      onTrashTabRefresh?.();
      setSelectedFiles([]);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFiles, refreshFiles, onTrashTabRefresh]);

  const handleFolderClick = (folder: VaultFile) => {
    if (!folder.is_folder) return;
    const newBreadcrumbs = [...folderBreadcrumbs, { id: folder.id, name: folder.original_filename || 'New Folder' }];
    setCurrentFolderId(folder.id);
    setFolderBreadcrumbs(newBreadcrumbs);
    // Update ref
    breadcrumbRef.current = { currentFolderId: folder.id, breadcrumbs: newBreadcrumbs };
    onBreadcrumbChange?.();
  };

  const handleBreadcrumbClick = useCallback((folderId: number) => {
    let newBreadcrumbs: { id: number; name: string }[] = [];
    if (folderId === 0) {
      setCurrentFolderId(0);
      setFolderBreadcrumbs([]);
      newBreadcrumbs = [];
    } else {
      const folderIndex = folderBreadcrumbs.findIndex(f => f.id === folderId);
      if (folderIndex !== -1) {
        newBreadcrumbs = folderBreadcrumbs.slice(0, folderIndex + 1);
        setCurrentFolderId(folderId);
        setFolderBreadcrumbs(newBreadcrumbs);
      }
    }
    // Update ref
    breadcrumbRef.current = { currentFolderId: folderId, breadcrumbs: newBreadcrumbs };
    onBreadcrumbChange?.();
  }, [folderBreadcrumbs, onBreadcrumbChange]);

  // Process dropped files for upload
  const processFilesDrop = useCallback(async (droppedFiles: File[]) => {
    const supportedFileTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.png', '.jpg', '.jpeg'];
    const validFiles = droppedFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return supportedFileTypes.includes(extension);
    });

    if (validFiles.length === 0) {
      toast({ title: "File Upload Failed", description: "No supported file types selected." });
      return;
    }

    if (validFiles.length !== droppedFiles.length) {
      toast({
        title: "File Upload Failed",
        description: `${droppedFiles.length - validFiles.length} unsupported file(s) were skipped.`
      });
    }

    const updatedFiles = [...files, ...validFiles.map((file) => ({ file, progress: 0 }))];
    setFiles(updatedFiles);

    if (!user) {
      toast({ title: "File Upload Failed", description: "You must be logged in to upload files." });
      return;
    }

    const uploadedFiles: any[] = [];
    const failedFiles: { file: File; error: string }[] = [];

    for (const fileObj of updatedFiles) {
      try {
        const result = await uploadFiles({
          file: fileObj.file,
          project_uuid: projectId,
          uploaded_by: user?.id || 0,
          parent_id: currentFolderId,
          team: teamId || undefined
        });
        uploadedFiles.push(result);
      } catch (err: any) {
        console.error("Error uploading file:", fileObj.file.name, err);
        failedFiles.push({ file: fileObj.file, error: err?.message || 'Upload failed' });
        toast({
          title: "Upload Failed",
          description: `${fileObj.file.name}: ${err?.message || 'Upload failed'}`,
          variant: "destructive"
        });
      }
    }

    handleFileUpload(uploadedFiles, failedFiles);
  }, [files, user, projectId, currentFolderId, teamId, toast]);

  // Handle navigation requests from parent (breadcrumb clicks)
  useEffect(() => {
    if (requestedNavigation !== null && requestedNavigation !== undefined) {
      handleBreadcrumbClick(requestedNavigation);
    }
  }, [requestedNavigation]); // Removed handleBreadcrumbClick from dependencies to prevent infinite loop

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder({
        folderName: name,
        project_uuid: projectId,
        uploaded_by: user?.id,
        parent_id: currentFolderId,
        team: teamId || undefined
      });
      toast({ title: "Success", description: "Folder created successfully" });
      setCreateFolderOpen(false);
      refreshFiles();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create folder. Please try again later.", variant: "destructive" });
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, fileId: number) => {
    e.stopPropagation();
    const filesToDrag = selectedFiles.includes(fileId) ? selectedFiles : [fileId];
    setIsDragging(true);
    setDraggedFiles(filesToDrag);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag));
  }, [selectedFiles]);

  const handleDragEnd = useCallback(() => { setIsDragging(false); setDraggedFiles([]); setDragOverFolderId(null); }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId?: number) => {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (folderId !== undefined) setDragOverFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null); setIsDragging(false);
    const draggedFileIds = draggedFiles.length > 0 ? draggedFiles : JSON.parse(e.dataTransfer.getData('text/plain'));
    const draggedItems = allFiles.filter(f => draggedFileIds.includes(f.id));
    for (const item of draggedItems) {
      if (item.is_folder && item.id === targetFolderId) {
        toast({ title: "Invalid operation", description: "Cannot move a folder into itself", variant: "destructive" });
        return;
      }
    }
    try {
      await moveVaultFiles(draggedFileIds, targetFolderId);
      toast({ title: "Success", description: `Moved ${draggedFileIds.length} item(s) successfully` });
      refreshFiles(); setSelectedFiles([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to move files. Please try again.", variant: "destructive" });
    }
    setDraggedFiles([]);
  }, [draggedFiles, allFiles, toast, refreshFiles]);

  const handleFileUpload = useCallback(async (uploadedFiles: any[], failedFiles?: { file: File; error: string }[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      if (failedFiles && failedFiles.length > 0) {
        toast({
          title: "Upload Failed",
          description: `All ${failedFiles.length} file(s) failed to upload`,
          variant: "destructive"
        });
      }
      return;
    }

    setIsUploadDialogOpen(false);

    // Show success toast
    if (failedFiles && failedFiles.length > 0) {
      // Partial success - some files succeeded, some failed
      toast({
        title: "Upload Partially Successful",
        description: `${uploadedFiles.length} file(s) uploaded successfully, ${failedFiles.length} file(s) failed`,
        variant: "default"
      });
    } else {
      // All files succeeded
      toast({ title: "Success", description: `${uploadedFiles.length} file(s) uploaded successfully` });
    }

    refreshFiles();
  }, []);

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

  const handleFilePreview = (file: VaultFile) => {
    // FilePreviewDialog will fetch the signed URL internally, so we just need to check UUID exists
    if (file.uuid) {
      setPreviewFile(file);
      setIsPreviewOpen(true);
    } else {
      toast({ title: "Error", description: "File UUID not available.", variant: "destructive" });
    }
  };

  const handleFileDelete = useCallback(async (uuid: string) => {
    try { 
      await deleteVaultFile(uuid); 
      toast({ title: "Success", description: "File deleted successfully" }); 
      refreshFiles(); 
      onTrashTabRefresh?.();
      setSelectedFiles([]); 
    }
    catch (error) { 
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" }); 
    }
  }, [refreshFiles, onTrashTabRefresh]);

  const openRenameDialog = (file: VaultFile) => { setFileToRename(file); setNewFileName(file.original_filename || ''); setRenameFileOpen(true); };

  const handleFileRename = async () => {
    if (!fileToRename || !newFileName.trim()) return;
    setIsRenamingFile(true);
    try {
      await updateVaultFile(fileToRename.id, { original_filename: newFileName.trim() });
      toast({ title: "File renamed", description: `File renamed to '${newFileName.trim()}'.` });
      setRenameFileOpen(false); setFileToRename(null); setNewFileName(""); refreshFiles();
    } catch (error) {
      toast({ title: "Error renaming file", description: "Please try again.", variant: "destructive" });
    } finally { setIsRenamingFile(false); }
  };

  const handleReIngest = useCallback((file: VaultFile) => {
    // TODO: Implement re-ingest functionality
    toast({ title: "Re-ingest", description: "Re-ingest functionality coming soon" });
  }, [toast]);

  const handleFileAnalyze = useCallback((file: VaultFile) => {
    // This will be handled by the parent component (vault-manager) via a callback
    // For now, we'll emit a custom event that the parent can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault-file-analyse', { 
        detail: { 
          file, 
          fileUuid: file.uuid,
          projectId 
        } 
      }));
    }
  }, [projectId]);

  const handleBulkAnalyze = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    // Get selected files (filter out folders)
    const filesToAnalyse = filteredFiles.filter(
      file => selectedFiles.includes(file.id) && !file.is_folder
    );

    if (filesToAnalyse.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files (not folders) to analyse.",
        variant: "destructive",
      });
      return;
    }

    // Send each file to analyser
    for (const file of filesToAnalyse) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vault-file-analyse', { 
          detail: { 
            file, 
            fileUuid: file.uuid,
            projectId 
          } 
        }));
      }
    }

    // Switch to analyser tab after a short delay to allow files to be processed
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('switch-to-analyser-tab'));
      }
    }, 100);

    // Clear selection
    setSelectedFiles([]);
  }, [selectedFiles, filteredFiles, projectId, toast]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getBreadcrumbData: () => breadcrumbRef.current,
    navigateToFolder: handleBreadcrumbClick,
    handleFilesDrop: processFilesDrop,
    handleDrop: handleDrop,
    refreshFiles: refreshFiles,
  }), [handleBreadcrumbClick, processFilesDrop, handleDrop, refreshFiles]);

  return (
    <>
      <FilesTabContent
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        showAllFiles={showAllFiles}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        isRightSectionOpen={rightSection !== null}
        selectedFiles={selectedFiles}
        isDeleting={isDeleting}
        onBulkDelete={handleBulkDelete}
        onCreateFolder={() => setCreateFolderOpen(true)}
        onUploadFile={() => setIsUploadDialogOpen(true)}
        onGoogleDriveClick={() => toast({ title: "Google Drive Integration", description: "Google Drive integration coming soon!", duration: 3000 })}
        onBulkAnalyze={handleBulkAnalyze}
        files={filteredFiles}
        draggedFiles={draggedFiles}
        dragOverFolderId={dragOverFolderId}
        onSelectAll={toggleSelectAll}
        onSelectFile={toggleSelectFile}
        onFolderClick={handleFolderClick}
        onFilePreview={handleFilePreview}
        onFileDownload={handleFileDownload}
        onFileRename={openRenameDialog}
        onFileDelete={handleFileDelete}
        onReIngest={handleReIngest}
        onFileAnalyze={handleFileAnalyze}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        hasNextPage={hasNextPage}
        isLoadingMore={isLoadingMore}
        loadMoreRef={loadMoreRef}
        uploadDialogOpen={isUploadDialogOpen}
        setUploadDialogOpen={setIsUploadDialogOpen}
        projectId={projectId}
        onUploadComplete={handleFileUpload}
        onFilesDrop={processFilesDrop}
      />

      <RenameDialog
        open={renameFileOpen}
        onOpenChange={setRenameFileOpen}
        title="Rename File"
        description="Enter a new name for the file."
        currentName={fileToRename?.original_filename || ""}
        newName={newFileName}
        onNameChange={setNewFileName}
        onConfirm={handleFileRename}
        isLoading={isRenamingFile}
        placeholder="New file name"
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={handleCreateFolder}
      />

      <FilePreviewDialog
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        projectId={projectId}
        folderId={currentFolderId}
      />
    </>
  );
});

FilesTab.displayName = 'FilesTab';