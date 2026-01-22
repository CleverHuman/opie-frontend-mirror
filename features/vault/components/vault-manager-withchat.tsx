"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProject } from "@/api/projects";
import { uploadFiles, getVaultFilesByProject, deleteVaultFile, VaultFilesResponse, generateVaultArtifacts } from "@/api/vault";
import { Project, VaultFile as BaseVaultFile } from "@/types/api";
import { handleApiError } from "@/lib/utils/handle-api-error";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Settings, Activity, ArrowLeft, Edit, Settings2 } from "lucide-react";
import { Plus, FileText, Filter, ChevronDown, Eye, Download, Link, Trash2, MoreHorizontal, UploadCloud, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/ui/search-input";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileUpload } from "./file-upload";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { isSafeUrl } from '@/lib/utils/url';
import { CustomChat } from "../../chats/components/chatcn";
import { ChatForm } from "@/components/ui/chat";
import { MessageInput } from "@/components/ui/message-input";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InstructionsDialog } from "./instructions-dialog";

// Extended VaultFile interface with additional properties from the API response
interface VaultFile extends BaseVaultFile {
  filename?: string;
  original_filename?: string;
  size?: number;
  // type is not included in the interface as we're accessing it with (file as any).type
  file_type?: string; // This is derived from the filename extension or MIME type for filtering
}

export function VaultManager() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filesCount, setFilesCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vault_active_tab') || 'files';
    }
    return 'files';
  });
  const projectId = params?.uuid as string;
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
  const [instructions, setInstructions] = useState("");

  // Memoize filtered files to prevent unnecessary re-computations
  const filteredFiles = useMemo(() => {
    return vaultFiles.filter(file => {
      // Apply file type filters
      const fileType = file.file_type || '';
      const matchesType = showAllFiles || 
        (activeFilters.length === 0) || 
        activeFilters.some((filter: string) => fileType.includes(filter));
      
      // Apply search filter
      const matchesSearch = file.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        file.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        false;
      
      return matchesType && matchesSearch;
    });
  }, [vaultFiles, showAllFiles, activeFilters, searchQuery]);

  // Memoize the select all checkbox state
  const selectAllChecked = useMemo(() => {
    return selectedFiles.length > 0 && selectedFiles.length === filteredFiles.length;
  }, [selectedFiles.length, filteredFiles.length]);

  // Memoize pagination calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filesCount / itemsPerPage));
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (currentPage <= 3) {
      endPage = Math.min(5, totalPages);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(1, totalPages - 4);
    }
    
    const pageNums = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNums.push(i);
    }
    
    return { totalPages, startPage, endPage, pageNums };
  }, [filesCount, itemsPerPage, currentPage]);

  // Define table columns for colspan calculation
  const columns = [
    { id: 'select', header: 'Select' },
    { id: 'name', header: 'Name' },
    { id: 'type', header: 'Type' },
    { id: 'size', header: 'Size' },
    { id: 'modified', header: 'Last Modified' },
    { id: 'actions', header: 'Actions' }
  ];

  useEffect(() => {
    fetchProject();
    fetchFiles();
  }, [projectId, currentPage, itemsPerPage]);

  // Reset to first page when search query or filters change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchFiles();
      }
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Persist activeTab in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vault_active_tab', activeTab);
    }
  }, [activeTab]);
  
  const fetchProject = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const data = await getProject(projectId);
      setProject(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await getVaultFilesByProject(
        projectId,
        currentPage,
        itemsPerPage,
        searchQuery
      );
      
      setFilesCount(response.count);
      setHasNextPage(!!response.next);
      setHasPreviousPage(!!response.previous);
      
      // Add file_type property based on filename extension or MIME type
      const filesWithType: VaultFile[] = response.results.map((file: VaultFile) => {
        // Use the MIME type if available (e.g., 'application/pdf' -> 'pdf')
        const mimeType = (file as any).type;
        const mimeExtension = mimeType ? mimeType.split('/')[1] : '';
                // Or extract extension from filename
        const fileExtension = file.original_filename?.split('.').pop()?.toLowerCase() || mimeExtension || '';
        
        return {
          ...file,
          file_type: fileExtension
        };
      });
      setVaultFiles(filesWithType);
    } catch (error) {
      console.error('Error fetching vault files:', error);
      toast({
        title: "Error",
        description: "Failed to load vault files",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = useCallback(async (uploadedFiles: any[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    
    // Close the upload dialog
    setIsUploadDialogOpen(false);
    
    toast({
      title: "Success",
      description: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
    fetchFiles(); // Refresh the file list
  }, [toast]);

  const handleGoogleDriveClick = () => {
    // TODO: Implement Google Drive integration
    toast({
      title: "Google Drive Integration",
      description: "Google Drive integration coming soon!",
      duration: 3000,
    });
  };

  // Memoized event handlers for pagination and interactions
  const handlePageChange = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => 
      Math.min(prev + 1, paginationData.totalPages)
    );
  }, [paginationData.totalPages]);

  const handleItemsPerPageChange = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  }, []);

  const handleFilePreview = useCallback(async (file: VaultFile) => {
    if (!file.uuid) {
      toast({
        title: "Error",
        description: "File UUID not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { getVaultFileDownloadUrl } = await import('@/api/vault');
      // Fetch signed URL for viewing (15 min expiry, inline disposition)
      const response = await getVaultFileDownloadUrl(file.uuid, 15, 'inline');
      window.open(response.url, '_blank');
    } catch (error) {
      console.error('Failed to preview file:', error);
      toast({
        title: "Error",
        description: "Failed to preview file. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileDownload = useCallback(async (file: VaultFile) => {
    if (!file.uuid) {
      toast({
        title: "Error",
        description: "File UUID not available.",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Failed to download file. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileDelete = useCallback(async (uuid: string) => {
    try {
      await deleteVaultFile(uuid);
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      fetchFiles(); // Refresh the file list
      // Clear selected files after deletion
      setSelectedFiles([]);
    } catch (error) {
      const { message } = handleApiError(error);
      toast({
        title: "Error",
        description: message || "Failed to delete file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleGenerateArtifacts = useCallback(
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
        const response = await generateVaultArtifacts(file.uuid);
        
        toast({
          title: "Artifact generation started",
          description: response.status === "processing" 
            ? "Artifacts are being generated. This may take a few moments."
            : `File status: ${response.status}`,
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to start artifact generation. Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );
  
  const handleBulkDelete = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    
    setIsDeleting(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Process deletion one by one
      for (const fileId of selectedFiles) {
        const file = filteredFiles.find(f => f.id === fileId);
        if (file?.uuid) {
          try {
            await deleteVaultFile(file.uuid);
            successCount++;
          } catch (error) {
            console.error(`Failed to delete file ID ${fileId}:`, error);
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }
      
      // Notify user about the results
      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} file${successCount !== 1 ? 's' : ''} deleted successfully`,
        });
      }
      
      if (errorCount > 0) {
        toast({
          title: "Error",
          description: `Failed to delete ${errorCount} file${errorCount !== 1 ? 's' : ''}`,
          variant: "destructive",
        });
      }
      
      // Refresh the file list
      fetchFiles();
      // Clear selected files
      setSelectedFiles([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during bulk deletion",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFiles, toast]);
  
  const toggleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedFiles(filteredFiles.map(file => file.id));
    } else {
      setSelectedFiles([]);
    }
  }, [filteredFiles]);

  const toggleSelectFile = useCallback((fileId: number, checked: boolean) => {
    setSelectedFiles(prev => 
      checked 
        ? [...prev, fileId] 
        : prev.filter(id => id !== fileId)
    );
  }, []);

  // Add a function to handle rename
  const handleRename = useCallback(async () => {
    if (!project || !project.id) return;
    setIsRenaming(true);
    try {
      await import("@/api/projects").then(({ updateProject }) => updateProject(project.id!, { ...project, name: newName }));
      toast({ title: "Project renamed", description: `Project renamed to '${newName}'.` });
      setRenameOpen(false);
      setNewName("");
      // Refresh project name
      fetchProject();
    } catch (e) {
      toast({ title: "Error renaming project", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsRenaming(false);
    }
  }, [project, newName, toast]);

  if (!project && !loading) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground mt-2">The requested project could not be found.</p>
        <Button className="mt-4" onClick={() => router.push("/vault")}>
          Back to Vault
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/vault")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-medium flex items-center gap-2">
            {loading ? "Loading project..." : project?.name}
            {!loading && project && (
              <>
                <button
                  type="button"
                  className="ml-2 p-1 rounded hover:bg-gray-200 focus:outline-none"
                  title="Edit project name"
                  onClick={() => { setRenameOpen(true); setNewName(project.name || ""); }}
                >
                  <Edit className="h-5 w-5 text-muted-foreground" />
                </button>

              </>
            )}
          </h1>
          {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </div>
      </div>

      {/* Chat input only (no chat content), above Tabs, only when project is loaded */}
      {!loading && project && (
        <>
          <ChatInputOnly sessionId={`vault/${projectId}`} agentId="vault-assistant" />
          <div className="max-w-2xl mx-auto w-full mt-4">
            <div
              className="border rounded-md bg-muted/40 p-4 flex flex-col gap-2 cursor-pointer transition hover:shadow-md focus:ring-2 focus:ring-ring outline-none"
              tabIndex={0}
              role="button"
              onClick={() => setShowInstructionsDialog(true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowInstructionsDialog(true); }}
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-md">Project Instructions</span>
              </div>
              <div className="text-muted-foreground text-xs">
                Grok will follow these instructions for all conversations in this project.
              </div>
            </div>
          </div>
          <InstructionsDialog
            open={showInstructionsDialog}
            onOpenChange={setShowInstructionsDialog}
            instructions={instructions}
            setInstructions={setInstructions}
          />
        </>
      )}

      <div className="flex-1 overflow-auto p-4 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs 
            defaultValue="files" 
            value={activeTab} 
            onValueChange={(value) => {
              setActiveTab(value);
            }}
          >
            <TabsList>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="files" className="mt-4">
              {/* Replace with custom file manager UI since shared component doesn't support our vault-specific API needs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-3 justify-between">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative w-full sm:max-w-sm">
                        <SearchInput 
                          placeholder="Search files..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full" 
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                              <Filter className="mr-2 h-4 w-4" />
                              Filter
                              <ChevronDown className="ml-1 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56">
                            <DropdownMenuCheckboxItem 
                              checked={showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(checked);
                                if (checked) setActiveFilters([]);
                              }}
                            >
                              All Files
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem 
                              checked={activeFilters.includes('pdf') || showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(false);
                                setActiveFilters(prev => checked 
                                  ? [...prev.filter(f => f !== 'pdf'), 'pdf'] 
                                  : prev.filter(f => f !== 'pdf'))
                              }}
                            >
                              PDF Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem 
                              checked={activeFilters.includes('doc') || activeFilters.includes('docx') || showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(false);
                                const docFilters = ['doc', 'docx'];
                                setActiveFilters(prev => 
                                  checked 
                                    ? [...prev.filter(f => !docFilters.includes(f)), ...docFilters] 
                                    : prev.filter(f => !docFilters.includes(f))
                                );
                              }}
                            >
                              Word Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem 
                              checked={activeFilters.includes('xls') || activeFilters.includes('xlsx') || showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(false);
                                const excelFilters = ['xls', 'xlsx'];
                                setActiveFilters(prev => 
                                  checked 
                                    ? [...prev.filter(f => !excelFilters.includes(f)), ...excelFilters] 
                                    : prev.filter(f => !excelFilters.includes(f))
                                );
                              }}
                            >
                              Excel Spreadsheets
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem 
                              checked={activeFilters.includes('txt') || activeFilters.includes('csv') || showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(false);
                                const textFilters = ['txt', 'csv'];
                                setActiveFilters(prev => 
                                  checked 
                                    ? [...prev.filter(f => !textFilters.includes(f)), ...textFilters] 
                                    : prev.filter(f => !textFilters.includes(f))
                                );
                              }}
                            >
                              Text Files
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem 
                              checked={activeFilters.includes('jpg') || activeFilters.includes('jpeg') || activeFilters.includes('png') || showAllFiles}
                              onCheckedChange={(checked) => {
                                setShowAllFiles(false);
                                const imageFilters = ['jpg', 'jpeg', 'png'];
                                setActiveFilters(prev => 
                                  checked 
                                    ? [...prev.filter(f => !imageFilters.includes(f)), ...imageFilters] 
                                    : prev.filter(f => !imageFilters.includes(f))
                                );
                              }}
                            >
                              Images
                            </DropdownMenuCheckboxItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedFiles.length > 0 && (
                        <Button 
                          variant="destructive" 
                          onClick={handleBulkDelete}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Selected ({selectedFiles.length})
                            </>
                          )}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button>
                            New
                            <Plus className="h-4 w-4 mr-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setIsUploadDialogOpen(true)}>
                            <FileText className="h-4 w-4 mr-2" />
                            File
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGoogleDriveClick()}>
                            <UploadCloud className="h-4 w-4 mr-2" />
                            Google Drive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox 
                            checked={selectAllChecked}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all files"
                          />
                        </TableHead>
                        <TableHead className="w-[350px]">Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFiles.length > 0 ? (
                        filteredFiles
                          .map((file) => (
                          <TableRow key={file.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedFiles.includes(file.id)}
                                onCheckedChange={(checked) => toggleSelectFile(file.id, !!checked)}
                                aria-label={`Select ${file.original_filename || 'Unnamed File'}`}
                              />
                            </TableCell>
                             <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <span>
                                  {/* Display original filename if available, otherwise the filename */}
                                  {file.original_filename || 'Unnamed File'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{file.file_type ? file.file_type.toUpperCase() : 'UNKNOWN'}</Badge>
                            </TableCell>
                            <TableCell>
                              {/* Display file size in KB or MB */}
                              {file.size 
                                ? file.size < 1024 * 1024 
                                  ? `${(file.size / 1024).toFixed(1)} KB` 
                                  : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {file.created_at ? 
                                formatDistanceToNow(new Date(file.created_at), { addSuffix: true }) : 
                                'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleFilePreview(file)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                  </DropdownMenuItem>
                                  {!file.is_folder && (
                                    <DropdownMenuItem onClick={() => handleGenerateArtifacts(file)}>
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Generate Artifacts
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleFileDownload(file)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Link className="mr-2 h-4 w-4" />
                                    Copy Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => file.uuid && handleFileDelete(file.uuid)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center">
                            No files found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {/* Pagination - moved outside the box */}
              <div className="flex items-center justify-between mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1 || !hasPreviousPage}
                      >
                        Previous
                      </Button>
                    </PaginationItem>
                    
                    {/* Show ellipsis before page numbers if needed */}
                    {paginationData.totalPages > 5 && currentPage > 3 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    {/* Page numbers */}
                    {paginationData.pageNums.map((pageNum) => (
                      <PaginationItem key={pageNum}>
                        <Button
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      </PaginationItem>
                    ))}
                    
                    {/* Show ellipsis after page numbers if needed */}
                    {paginationData.totalPages > 5 && currentPage < paginationData.totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage >= paginationData.totalPages || !hasNextPage}
                      >
                        Next
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Items per page:
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {itemsPerPage}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {[5, 10, 20, 50].map((value) => (
                        <DropdownMenuItem
                          key={value}
                          onClick={() => handleItemsPerPageChange(value)}
                        >
                          {value}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* File Upload Dialog */}
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Files to Vault</DialogTitle>
                    <DialogDescription>
                      Upload files to your vault. Supported formats include PDF, DOCX, XLSX, TXT, CSV, JPEG, and PNG.
                    </DialogDescription>
                  </DialogHeader>
                  <FileUpload
                    onUploadComplete={handleFileUpload}
                    projectId={projectId || ''}
                  />
                </DialogContent>
              </Dialog>
            </TabsContent>
            
            <TabsContent value="activity" className="mt-4">
              <div className="bg-white rounded-md border shadow-sm p-6">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Activity</h3>
                </div>
                <p className="text-muted-foreground mt-4">Activity feed will be displayed here.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="mt-4">
              <div className="bg-white rounded-md border shadow-sm p-6">
                <div className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Settings</h3>
                </div>
                
                {project?.description && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium">Description</h4>
                    <p className="text-muted-foreground mt-1">{project.description}</p>
                  </div>
                )}
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium">Project ID</h4>
                  <p className="text-muted-foreground mt-1 font-mono">{projectId}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New project name" />
          <DialogFooter>
            <Button onClick={() => setRenameOpen(false)} variant="outline">Cancel</Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>{isRenaming ? "Renaming..." : "Rename"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChatInputOnly({ agentId, sessionId }: { agentId: string; sessionId: string }) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const {
    handleSubmit,
    uploadFiles,
    isLoading,
    fileUploads,
    isUploadingFiles,
  } = useAgentChat({ agentId, sessionId });

  function onSubmit() {
    if (!input.trim()) return;
    handleSubmit(input, files);
    setInput("");
    setFiles([]);
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-4 border rounded-md mt-4 bg-white">
      <ChatForm
        isPending={isLoading}
        handleSubmit={e => {
          e?.preventDefault?.();
          onSubmit();
        }}
      >
        {({ setFiles: setFormFiles }) => (
          <MessageInput
            value={input}
            onChange={e => setInput(e.target.value)}
            allowAttachments
            files={files}
            setFiles={newFiles => {
              if (Array.isArray(newFiles)) {
                const currentFiles = files || [];
                const addedFiles = newFiles.filter(newFile =>
                  !currentFiles.some(existingFile =>
                    existingFile.name === newFile.name &&
                    existingFile.size === newFile.size
                  )
                );
                setFiles([...newFiles]);
                if (addedFiles.length > 0) {
                  uploadFiles(addedFiles);
                }
              } else {
                setFiles([]);
              }
              setFormFiles?.(newFiles);
            }}
            stop={() => {}}
            isGenerating={isLoading || isUploadingFiles}
            fileUploads={fileUploads}
            isUploadingFiles={isUploadingFiles}
          />
        )}
      </ChatForm>
    </div>
  );
}
