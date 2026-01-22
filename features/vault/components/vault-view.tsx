"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import {
  Plus,
  Search,
  MoreHorizontal,
  FolderIcon,
  FileText,
  Settings,
  MessageSquare,
  ArrowLeft,
  Star,
  Loader,
  Filter,
  ChevronDown,
  Eye,
  Download,
  Link,
  Trash2
} from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { InstructionDialog } from "./instructions-dialog"
import { useRouter } from "next/navigation"
import { Project } from "@/types/api"
import { getProject } from "@/api/projects"
import { uploadFiles, getVaultFilesByProject } from "@/api/vault"
import { VaultFile } from "@/types/api"
import { handleApiError } from "@/lib/utils/handle-api-error"
import { useToast } from "@/components/ui/use-toast"
import { UploadFileModal } from "./upload-file-modal"
import SearchInput from "@/components/ui/search-input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { DeleteProjectDialog } from "./delete-project-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"

export default function ProjectView({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null)
  const router = useRouter()

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [pickedFiles, setPickedFiles] = useState<File[]>([])
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([])
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false);
  const [fileToPreview, setFileToPreview] = useState<VaultFile | null>(null);
  const [fileToLink, setFileToLink] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const { user } = useAuth();
  
  // TanStack column filters
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Using only list view
  const viewMode = 'list';
  
  // File type options extracted from file extensions
  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    vaultFiles.forEach(file => {
      const extension = file.filename?.split('.').pop();
      if (extension) {
        types.add(extension.toLowerCase());
        // Add file_type property to each file object for filtering
        (file as any).file_type = extension.toLowerCase();
      }
    });
    return Array.from(types).sort();
  }, [vaultFiles]);

  // Upload picked files when they change
  // Fetch vault files on mount and after upload

  async function fetchFiles() {
    try {
      const files = await getVaultFilesByProject(projectId);
      // Add file_type property to each file based on filename extension
      const filesWithType = files.map(file => ({
        ...file,
        file_type: file.filename?.split('.').pop()?.toLowerCase() || ''
      }));
      setVaultFiles(filesWithType);
    } catch (error) {
      console.error(error);
      // Optionally handle error
    }
  }
  useEffect(() => {
   
    fetchFiles();
  }, [projectId, pickedFiles]);

  useEffect(() => {
    async function doUpload() {
      if (pickedFiles.length > 0) {
        setUploading(true);
        const uploaded_by = user?.id || 0;
        try {
          for (const file of pickedFiles) {
            await uploadFiles({
              file,
              project: projectId,
              uploaded_by,
            });
          }
          toast({ title: "Upload successful" });
          fetchFiles();
        } catch (error) {
          const { message } = handleApiError(error);
          toast({
            title: message || "Upload failed",
            variant: "destructive",
          });
        }
        setPickedFiles([]);
        setUploading(false);
      }
    }
    doUpload();
  }, [pickedFiles]);

  function onBack() {
    router.back()
  }
  
  // Handler for file preview
  const handlePreviewFile = async (file: VaultFile) => {
    if (!file.uuid) {
      toast({
        title: "Error",
        description: "File UUID not available.",
        variant: "destructive",
      });
      return;
    }

    setFileToPreview(file);
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
  };
  
  // Handler for linking file to KB
  const handleOpenLinkModal = (fileId: string) => {
    setFileToLink(fileId);
    setIsLinkModalOpen(true);
  };
  
  // Handler for deleting a file
  const handleDeleteFile = async (fileId: string) => {
    try {
      // Add your delete API call here
      // await deleteVaultFile(fileId);
      toast({ title: "File deleted successfully" });
      // Refresh the file list
      fetchFiles();
    } catch (error) {
      const { message } = handleApiError(error);
      toast({
        title: message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  async function fetchProject() {
    try {
      const response = await getProject(projectId)
      setProject(response)
    } catch (error) {
      const { message } = handleApiError(error)
      if (message) {
        toast({
          title: message,
          description: "Failed to fetch project",
          variant: "destructive",
        })
      }
    }
  }

  useEffect(() => {
    fetchProject()
  }, [])

  // TanStack table setup
  const multiSelectFilter: ColumnDef<VaultFile>["filterFn"] = (row, id, value) => {
    if (!Array.isArray(value) || value.length === 0) return true;
    const cellValue = row.getValue<string>(id);
    return value.includes(cellValue);
  };

  const columns = useMemo<ColumnDef<VaultFile>[]>(
    () => [
      { accessorKey: 'filename' },
      { 
        accessorKey: 'file_type',
        filterFn: multiSelectFilter,
        accessorFn: (row) => row.file_type || ''
      },
    ],
    []
  );

  const table = useReactTable<VaultFile>({
    data: vaultFiles,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredFiles = table.getRowModel().rows.map((r) => r.original);

  return (
    <div className="flex flex-col min-h-screen w-full max-w-4xl mx-auto px-2 sm:px-6 py-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onBack}
          title="Back to projects"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
          <FolderIcon className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold truncate flex-1">{project?.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setUploadModalOpen(true)}>
            <FileText className="h-5 w-5" /> Upload File
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => setDeleteProjectOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* Search & Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 w-full max-w-md">
          <SearchInput
            value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
            onChange={(value) => table.getColumn('filename')?.setFilterValue(value)}
            placeholder="Search files..."
          />
          
          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" /> Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {/* File type filter */}
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">File Type</p>
                {typeOptions.map((type) => {
                  const current: string[] =
                    (table.getColumn('file_type')?.getFilterValue() as string[]) ?? [];
                  const checked = current.includes(type);
                  return (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={checked}
                      onCheckedChange={(chk) => {
                        const col = table.getColumn('file_type');
                        const prev: string[] = (col?.getFilterValue() as string[]) ?? [];
                        col?.setFilterValue(
                          chk ? [...prev, type] : prev.filter((t) => t !== type)
                        );
                      }}
                    >
                      {type.toUpperCase()}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  table.getColumn('file_type')?.setFilterValue(undefined);
                }}
              >
                Clear Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      <Card className="overflow-hidden border rounded-md">
        <div className="overflow-x-auto p-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.length > 0 ? (
                filteredFiles.map(file => (
                    <TableRow key={file.id}>
                      <TableCell className="max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{file.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50">
                          {file.filename?.split('.').pop()?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {file.uploaded_by ? `User #${file.uploaded_by}` : "-"}
                      </TableCell>
                      <TableCell>
                        {file.created_at ? new Date(file.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handlePreviewFile(file)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
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
                                    a.download = file.original_filename || response.filename || file.filename || 'download';
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
                                }}
                                className="flex items-center w-full cursor-pointer"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenLinkModal(file.id)}
                              >
                                <Link className="h-4 w-4 mr-2" />
                                Link to KB
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    {search ? 'No files match your search' : 'No files found in this vault'}
                  </TableCell>
                </TableRow>
              )}
              {/* Show uploading files at the bottom */}
              {uploading && pickedFiles.length > 0 && pickedFiles.map((file, idx) => (
                <TableRow key={file.name + idx} className="opacity-60 italic">
                  <TableCell className="max-w-[220px]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground animate-pulse flex-shrink-0" />
                      <span className="truncate">{file.name} (Uploading...)</span>
                      <Loader className="animate-spin h-4 w-4 ml-2 text-primary flex-shrink-0" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50 opacity-50">
                      {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                    </Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>


      <UploadFileModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onFilesSelected={setPickedFiles}
        supportedTypes={[".pdf", ".png", "image/jpeg"]}
        maxFiles={5}
        title="Upload files"
      />

      <DeleteProjectDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        project={project ? { id: project.id?.toString() || '', name: project.name || '' } : null}
      />
    </div>
  )
}
