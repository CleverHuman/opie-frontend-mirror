"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { faker } from "@faker-js/faker";
import { COLUMN_SIZE } from "./lib/data-grid-constants";
import { DataGrid } from "./data-grid/data-grid";
import { useDataGrid } from "./hooks/use-data-grid";
import { AddColumnMenu } from "./AddColumnMenu";
import type { ColumnType, ExtractionCell } from "../types";
import type { FileCellData } from "./types/data-grid";
import { Upload, Loader2 } from "./Icons";
import { TabsContent } from "@/components/ui/tabs";

import { processDocumentFiles } from "./services/documentProcessingService";
import { extractColumnData } from "./services/geminiService";
import { uploadFiles, analyzeDocuments, generateVaultArtifacts, getVaultArtifact } from "@/api/vault";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/use-toast";
import { useParams } from "next/navigation";
import { VerificationSidebar } from "./verification-sidebar";
import type { DocumentFile, Column } from "../types";
import type { VaultFile as VaultFileType } from "@/types/api";

// Column type definition

// Row data interface
interface RowData {
  id: string;
  content?: FileCellData[];
  [key: string]: any;
}

const MIN_COLUMN_SIZE = 60;
const MAX_COLUMN_SIZE = 800;

// Analysis results with quotes and reasoning
type AnalysisResults = {
  [rowId: string]: {
    [columnId: string]: ExtractionCell;
  };
};
// Processing status for each row
type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

interface AnalyserTabContentProps {
  projectId?: string;
  teamId?: number;
}

export function AnalyserTabContent({ projectId, teamId }: AnalyserTabContentProps = {}) {
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentProjectId = projectId || (params?.uuid as string);
  const [data, setData] = React.useState<RowData[]>([{ id: crypto.randomUUID() }]);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isConverting, setIsConverting] = React.useState(false);
  const convertingToastRef = React.useRef<{ dismiss: () => void } | null>(null);

  // Show/dismiss toast when isConverting changes
  React.useEffect(() => {
    if (isConverting) {
      const { dismiss } = toast({
        title: "Processing Documents",
        description: (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Converting files to markdown...</span>
          </div>
        ),
        duration: Number.POSITIVE_INFINITY,
      });
      convertingToastRef.current = { dismiss };
    } else {
      convertingToastRef.current?.dismiss();
      convertingToastRef.current = null;
    }
    return () => {
      // Cleanup: dismiss toast if still present on unmount
      convertingToastRef.current?.dismiss();
      convertingToastRef.current = null;
    };
    return () => {
      // Cleanup: dismiss toast if still present on unmount
      convertingToastRef.current?.dismiss();
      convertingToastRef.current = null;
    };
  }, [isConverting, toast]);
  const [addColumnAnchor, setAddColumnAnchor] = React.useState<DOMRect | null>(null);
  const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  type SidebarMode = 'none' | 'document' | 'cell';
  const [sidebarMode, setSidebarMode] = React.useState<SidebarMode>('none');
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [selectedCell, setSelectedCell] = React.useState<{ rowIndex: number; columnId: string } | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);  // Analysis results with quotes and reasoning
  const [analysisResults, setAnalysisResults] = React.useState<AnalysisResults>({});
  const [columns, setColumns] = React.useState<ColumnDef<RowData>[]>([]);
  const [columnMetadata, setColumnMetadata] = React.useState<Record<string, { type: ColumnType; prompt: string }>>({
    content: { type: 'short-text', prompt: '' },
  });
  
  const selectedRow = React.useMemo(() => data.find(r => r.id === selectedRowId), [data, selectedRowId]);

  const encodeToBase64 = React.useCallback((content: string) => {
    return btoa(unescape(encodeURIComponent(content)));
  }, []);

  const convertVaultFileToMarkdown = React.useCallback(
    async (vaultFileId: number): Promise<string> => {
      try {
        await generateVaultArtifacts(vaultFileId);
      } catch (error) {
        console.warn("Failed to enqueue artifact generation", error);
      }

      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const artifact = await getVaultArtifact(vaultFileId, "markdown");
        if (artifact.status === "completed" && artifact.content) {
          return artifact.content;
        }

        if (artifact.status === "failed") {
          throw new Error(artifact.error || "Artifact generation failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error("Timed out waiting for document conversion");
    },
    [],
  );

  const processFileWithDocling = React.useCallback(
    async (file: File, vaultFileId?: number | null): Promise<string> => {
      if (vaultFileId) {
        const markdown = await convertVaultFileToMarkdown(vaultFileId);
        return encodeToBase64(markdown);
      }

      const result = await processDocumentFiles([file]);
      if (result.success.length > 0) {
        return result.success[0].content;
      }

      if (result.errors.length > 0) {
        throw new Error(result.errors[0].error);
      }

      throw new Error("Failed to process document");
    },
    [convertVaultFileToMarkdown, encodeToBase64],
  );

  // Helper function to download file from vault URL and convert to File object
  const downloadFileFromVault = React.useCallback(async (fileUrl: string, filename: string): Promise<File> => {
    try {
      const response = await fetch(fileUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      throw new Error(`Error downloading file from vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Helper function to upload file to vault
  const uploadFileToVault = React.useCallback(async (file: File): Promise<VaultFileType | null> => {
    if (!currentProjectId || !user) {
      console.warn('Cannot upload to vault: missing projectId or user');
      return null;
    }

    try {
      const uploaded = await uploadFiles({
        file,
        project_uuid: currentProjectId,
        uploaded_by: user.id,
        team: teamId,
        parent_id: 0, // Upload to root folder
      });
      return uploaded as VaultFileType;
    } catch (error) {
      console.error('Failed to upload file to vault:', error);
      toast({
        title: "Vault Upload Warning",
        description: "File added to analyser but failed to upload to vault. You can manually upload it later.",
        variant: "default",
      });
      return null;
    }
  }, [currentProjectId, user, teamId, toast]);

  // Handle CSV export
  const handleExportCSV = React.useCallback((projectName: string) => {
    if (data.length === 0) return;

    // Get non-content columns (columns that aren't the file/content column)
    const exportColumns = columns.filter(col => col.id !== 'content');
    
    // Headers: Document Name followed by column names
    const headerRow = ['Document Name', ...exportColumns.map(c => {
      const header = c.header;
      return typeof header === 'string' ? header : (c.id || '');
    })];
    
    // Rows
    const rows = data.map((doc, index) => {
      // Get document name from content field
      let docName: string = `Row ${index + 1}`;
      const content = doc.content as FileCellData[] | string | undefined;
      
      if (Array.isArray(content) && content.length > 0 && content[0]?.name) {
        // FileCellData array - use file name
        docName = content[0].name;
      } else if (typeof content === 'string' && content.trim()) {
        // Direct text content - use the text (truncated if too long)
        docName = content.length > 50 ? content.substring(0, 50) + '...' : content;
      }
      
      const rowData = [`"${docName.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`];
      
      exportColumns.forEach(col => {
        const colId = col.id || '';
        // Check analysisResults first, then fall back to direct row data
        const cellValue = analysisResults[doc.id]?.[colId]?.value || doc[colId] || '';
        // Escape double quotes with two double quotes and replace newlines/carriage returns
        const val = String(cellValue).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
        rowData.push(`"${val}"`);
      });
      return rowData.join(",");
    });

    const csvContent = [headerRow.map(h => `"${h.replace(/"/g, '""')}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${projectName.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Complete",
      description: `Exported ${data.length} rows to CSV`,
    });
  }, [data, columns, analysisResults, toast]);

  // Run analysis on all documents with all columns
  const runAnalysis = React.useCallback(async () => {
    const rowsWithFiles = data.filter((row) => {
      const files = row.content;
      return Array.isArray(files) && files.length > 0;
    });

    // Filter rows that have processed content (ready for analysis)
    const rowsToAnalyze = rowsWithFiles.filter((row) => {
      const content = row.processedContent;
      return typeof content === "string" && content.trim().length > 0;
    });

    // UX: distinguish between "no files added" vs "still processing/failed"
    if (rowsWithFiles.length === 0) {
      toast({
        title: "No Documents",
        description: "Please add documents to analyze first.",
        variant: "destructive",
      });
      return;
    }

    if (rowsToAnalyze.length === 0) {
      const processingCount = rowsWithFiles.filter(
        (row) =>
          row.processingStatus === ("pending" as ProcessingStatus) ||
          row.processingStatus === ("processing" as ProcessingStatus),
      ).length;
      const errorRows = rowsWithFiles.filter(
        (row) => row.processingStatus === ("error" as ProcessingStatus),
      );

      if (processingCount > 0 || isConverting) {
        toast({
          title: "Documents Still Processing",
          description:
            "Your document(s) are still being converted to text. Please wait until processing completes, then click Analyse again.",
          variant: "default",
        });
        return;
      }

      if (errorRows.length > 0) {
        const firstError = errorRows.find((r) => typeof r.errorMessage === "string" && r.errorMessage.trim());
        toast({
          title: "Document Processing Failed",
          description: firstError?.errorMessage || "One or more documents could not be converted for analysis.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "No Processed Documents",
        description:
          "Documents were added but no text could be extracted. Try re-uploading or use a different file format.",
        variant: "destructive",
      });
      return;
    }

    // Get columns that have prompts (excluding the content column)
    const columnsToExtract = columns
      .filter(col => col.id !== 'content' && columnMetadata[col.id || '']?.prompt)
      .map(col => ({
        id: col.id || '',
        name: typeof col.header === 'string' ? col.header : (col.id || ''),
        type: columnMetadata[col.id || '']?.type || 'short-text',
        prompt: columnMetadata[col.id || '']?.prompt || '',
      }));

    if (columnsToExtract.length === 0) {
      toast({
        title: "No Columns",
        description: "Please add columns with extraction prompts first.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare documents for API
      const documentsForApi = rowsToAnalyze.map(row => {
        const fileData = Array.isArray(row.content) ? row.content[0] : null;
        return {
          id: row.id,
          content: row.processedContent || '',
          name: fileData?.name || 'Untitled',
        };
      });

      // Call the analyze API
      const response = await analyzeDocuments(documentsForApi, columnsToExtract);

      // Update analysis results
      if (response.results) {
        const newResults: AnalysisResults = { ...analysisResults };
        
        for (const docResult of response.results) {
          newResults[docResult.document_id] = {};
          for (const [colId, cellResult] of Object.entries(docResult.results)) {
            newResults[docResult.document_id][colId] = {
              value: cellResult.value,
              confidence: cellResult.confidence,
              quote: cellResult.quote,
              page: cellResult.page || 1,
              reasoning: cellResult.reasoning,
              status: 'needs_review',
            };
          }
        }
        
        setAnalysisResults(newResults);
        
        // Also update the data rows with the extracted values for display
        setData(prev => prev.map(row => {
          const rowResults = newResults[row.id];
          if (rowResults) {
            const updates: Record<string, string> = {};
            for (const [colId, cell] of Object.entries(rowResults)) {
              updates[colId] = cell.value;
            }
            return { ...row, ...updates };
          }
          return row;
        }));
      }

      // Handle any errors
      if (response.errors && response.errors.length > 0) {
        toast({
          title: "Some Documents Failed",
          description: `${response.errors.length} document(s) could not be analyzed.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Successfully analyzed ${rowsToAnalyze.length} document(s) across ${columnsToExtract.length} column(s).`,
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'An error occurred during analysis.',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [data, columns, columnMetadata, analysisResults, toast]);

  // Listen for CSV export event from header button
  React.useEffect(() => {
    const handleExportEvent = (event: Event) => {
      // Ensure the event is a CustomEvent with the expected detail
      const customEvent = event as CustomEvent<{ projectName: string }>;
      if (customEvent.detail && typeof customEvent.detail.projectName === "string") {
        handleExportCSV(customEvent.detail.projectName);
      }
    };

    window.addEventListener('analyser-export-csv', handleExportEvent);
    return () => {
      window.removeEventListener('analyser-export-csv', handleExportEvent);
    };
  }, [handleExportCSV]);

  // Listen for run analysis event from header button
  React.useEffect(() => {
    const handleRunAnalysis = () => {
      runAnalysis();
    };

    window.addEventListener('analyser-run-analysis', handleRunAnalysis);
    return () => {
      window.removeEventListener('analyser-run-analysis', handleRunAnalysis);
    };
  }, [runAnalysis]);

  // Listen for files sent from vault
  React.useEffect(() => {
    const handleVaultFileAnalyse = async (event: CustomEvent<{ file: any; projectId: string }>) => {
      const { file } = event.detail;
      
      if (!file || !file.file) {
        toast({
          title: "Error",
          description: "Invalid file data",
          variant: "destructive",
        });
        return;
      }

      try {
        // Download the file from vault
        const downloadedFile = await downloadFileFromVault(file.file, file.original_filename || file.filename || 'document');
        
        // Add to analyser
        const fileData: FileCellData = {
          id: crypto.randomUUID(),
          name: downloadedFile.name,
          size: downloadedFile.size,
          type: downloadedFile.type,
          url: URL.createObjectURL(downloadedFile),
          vaultFileId: file.id,
        };

        const newRow: RowData = {
          id: faker.string.nanoid(),
          content: [fileData],
          processingStatus: 'pending' as ProcessingStatus,
        };

        setData((prev) => {
          const hasOnlyEmptyRows = prev.every(row => {
            const content = row.content;
            return !content || (Array.isArray(content) && content.length === 0);
          });
          if (hasOnlyEmptyRows) {
            return [newRow];
          }
          return [...prev, newRow];
        });

        // Process the file
        setIsConverting(true);
        setData((prev) => prev.map((row) => 
          row.id === newRow.id 
            ? { ...row, processingStatus: 'processing' as ProcessingStatus }
            : row
        ));

        try {
          const processedContent = await processFileWithDocling(downloadedFile, file.id);
          setData((prev) => prev.map((row) => 
            row.id === newRow.id 
              ? { 
                  ...row, 
                  processedContent,
                  processingStatus: 'completed' as ProcessingStatus,
                }
              : row
          ));
        } catch (error) {
          setData((prev) => prev.map((row) => 
            row.id === newRow.id 
              ? { 
                  ...row, 
                  processingStatus: 'error' as ProcessingStatus,
                  errorMessage: error instanceof Error ? error.message : 'Unknown error',
                }
              : row
          ));
        } finally {
          setIsConverting(false);
        }

        // Switch to analyser tab (triggered by parent)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('switch-to-analyser-tab'));
        }
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to load file from vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive",
        });
      }
    };

    const eventHandler = (event: Event) => {
      handleVaultFileAnalyse(event as CustomEvent<{ file: any; projectId: string }>);
    };
    window.addEventListener('vault-file-analyse', eventHandler);
    return () => {
      window.removeEventListener('vault-file-analyse', eventHandler);
    };
  }, [downloadFileFromVault, toast, currentProjectId, user, teamId]);
  
  const defaultColumns = React.useMemo<ColumnDef<Record<string, any>>[]>(
    () => [
      {
        id: "content",
        accessorKey: "content" as any,
        header: "Content",
        enableResizing: true,
        meta: {
          cell: {
            variant: "auto", // Auto-detects: shows file badge for files, text input for text
            multiple: false,
          },
        },
        size: 200, // Wider to fit file badge with view/delete icons
        minSize: COLUMN_SIZE.MIN,
        maxSize: COLUMN_SIZE.MAX,
      },
    ],
    [],
  );
  
  // Create DocumentFile for VerificationSidebar
  const documentForSidebar = React.useMemo<DocumentFile | null>(() => {
    if (!selectedRow) return null;
    
    const fileData = Array.isArray(selectedRow.content) ? selectedRow.content[0] : null;
    const fileName = fileData?.name || 'Untitled';
    const fileType = fileData?.type || 'text/plain';
    
    return {
      id: selectedRow.id,
      name: fileName,
      type: fileType,
      size: fileData?.size || 0,
      content: selectedRow.processedContent || '',
      mimeType: fileType,
    };
  }, [selectedRow]);

  // Create Column for VerificationSidebar
  const columnForSidebar = React.useMemo<Column | null>(() => {
    if (!selectedCell) return null;
    
    const colDef = columns.find(c => c.id === selectedCell.columnId);
    const metadata = columnMetadata[selectedCell.columnId];
    
    return {
      id: selectedCell.columnId,
      name: colDef && typeof colDef.header === 'string' ? colDef.header : selectedCell.columnId,
      type: metadata?.type || 'short-text',
      prompt: metadata?.prompt || '',
      status: 'idle',
    };
  }, [selectedCell, columns, columnMetadata]);

  // Create ExtractionCell for VerificationSidebar
  const cellForSidebar = React.useMemo(() => {
    if (!selectedCell || !selectedRowId) return null;
    return analysisResults[selectedRowId]?.[selectedCell.columnId] || null;
  }, [selectedCell, selectedRowId, analysisResults]);

  React.useEffect(() => {
    if (columns.length === 0) {
      setColumns(defaultColumns as ColumnDef<RowData>[]);
    }
  }, [columns.length, defaultColumns]);

  const onRowAdd = React.useCallback(() => {
    setData((prev) => [...prev, { id: crypto.randomUUID() }]);
    return {
      rowIndex: data.length,
      columnId: "content",
    };
  }, [data.length]);

  const onRowsDelete = React.useCallback(async (rows: RowData[], rowIndices: number[]) => {
    setData((prev) => prev.filter((_, index) => !rowIndices.includes(index)));
  }, []);

  // Handle file uploads within cells
  const onFilesUpload = React.useCallback(async ({ files, rowIndex, columnId }: {
    files: File[];
    rowIndex: number;
    columnId: string;
  }): Promise<FileCellData[]> => {
    // Upload files to vault first (if project context is available)
    let uploadedVaultFiles: (VaultFileType | null)[] = [];
    if (currentProjectId && user) {
      try {
        uploadedVaultFiles = await Promise.all(files.map(file => uploadFileToVault(file)));
      } catch (error) {
        // Continue processing even if vault upload fails
        console.warn('Some files failed to upload to vault:', error);
      }
    }

    // Create FileCellData objects for each file
    const uploadedFiles: FileCellData[] = files.map((file, idx) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      vaultFileId: uploadedVaultFiles[idx]?.id,
    }));

    // Update the row with uploaded files and set processing status
    setData((prev) => prev.map((row, idx) => 
      idx === rowIndex 
        ? { ...row, [columnId]: uploadedFiles, processingStatus: 'processing' as const }
        : row
    ));

    // Process the files to extract markdown content
    try {
      const processedContent = await processFileWithDocling(files[0], uploadedFiles[0]?.vaultFileId);
      setData((prev) => prev.map((row, idx) => 
        idx === rowIndex 
          ? { 
              ...row, 
              processedContent,
              processingStatus: 'completed' as const,
            }
          : row
      ));
    } catch (error) {
      setData((prev) => prev.map((row, idx) => 
        idx === rowIndex 
          ? { 
              ...row, 
              processingStatus: 'error' as const,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            }
          : row
      ));
    }

    return uploadedFiles;
  }, [currentProjectId, user, uploadFileToVault, processFileWithDocling]);

  const handleCellClick = React.useCallback((rowIndex: number, columnId: string) => {
    const row = data[rowIndex];
    setSelectedRowId(row.id);
    setSelectedCell({ rowIndex, columnId });
    if (columnId === 'content') {
      setSidebarMode('document');
    } else {
      setSidebarMode('cell');
    }
  }, [data]);

  const handleCellFocusChange = React.useCallback((rowIndex: number, columnId: string, focused: boolean) => {
    if (focused) {
      setSelectedRowId(data[rowIndex].id);
      setSelectedCell({ rowIndex, columnId });
    }
  }, [data]);
      
  const handleAnalysisResultsUpdate = React.useCallback((newResults: AnalysisResults) => {
    setAnalysisResults(newResults);
  }, []);

  const handleFilesDrop = React.useCallback(async (fileCells: FileCellData[], rowIndex: number, columnId: string) => {
    setIsDraggingOver(false);
    // Update the row immediately with the dropped files
    setData((prev) => prev.map((row, idx) => 
      idx === rowIndex 
        ? { ...row, [columnId]: fileCells, processingStatus: 'processing' as const }
        : row
    ));

    // Process the files (use first file for now)
    if (fileCells.length > 0 && fileCells[0].url) {
      try {
        const response = await fetch(fileCells[0].url);
        const blob = await response.blob();
        const file = new File([blob], fileCells[0].name, { type: blob.type });
        const processedContent = await processFileWithDocling(file, fileCells[0].vaultFileId);
        setData((prev) => prev.map((row, idx) => 
          idx === rowIndex 
            ? { 
                ...row, 
                processedContent,
                processingStatus: 'completed' as const,
              }
            : row
        ));
      } catch (error) {
        setData((prev) => prev.map((row, idx) => 
          idx === rowIndex 
            ? { 
                ...row, 
                processingStatus: 'error' as const,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
              }
            : row
        ));
      }
    }
  }, [processFileWithDocling]);

  // Handle file deletions within cells
  const onFilesDelete = React.useCallback(async ({ fileIds, rowIndex, columnId }: {
    fileIds: string[];
    rowIndex: number;
    columnId: string;
  }) => {
    setData((prev) => prev.map((row, idx) => {
      if (idx === rowIndex) {
        const currentFiles = row[columnId] as FileCellData[] | undefined;
        if (Array.isArray(currentFiles)) {
          const updatedFiles = currentFiles.filter(f => !fileIds.includes(f.id));
          return { ...row, [columnId]: updatedFiles.length > 0 ? updatedFiles : undefined };
        }
      }
      return row;
    }));
  }, []);

  const handleColumnAdd = () => {
    // Get the position of the + column header
    const addColumnButton = document.querySelector('[data-slot="grid-header-add-column"]');
    if (addColumnButton) {
      setEditingColumnId(null);
      setAddColumnAnchor(addColumnButton.getBoundingClientRect());
    }
  };

  const handleColumnEdit = React.useCallback((columnId: string, rect?: DOMRect) => {
    if (rect) {
      // Use the provided rect
      setEditingColumnId(columnId);
      setAddColumnAnchor(rect);
    } else {
      // Fallback: find the specific column header
      const columnHeader = document.querySelector(`[data-column-id="${columnId}"][data-slot="grid-header-cell"]`);
      if (columnHeader) {
        setEditingColumnId(columnId);
        setAddColumnAnchor(columnHeader.getBoundingClientRect());
      }
    }
  }, []);

  const handleSaveColumn = React.useCallback((colDef: { name: string; type: ColumnType; prompt: string }) => {
    const promptValue = colDef.prompt || '';
    const columnId = editingColumnId || colDef.name.toLowerCase().replace(/\s+/g, '-');

    // Map ColumnType to cell variant
    const variantMap: Record<ColumnType, string> = {
      'short-text': 'short-text',
      'long-text': 'long-text',
      'number': 'number',
      'date': 'date',
      'boolean': 'checkbox',
      'list': 'long-text',
      'file': 'file',
    };

    // Special handling for content column - preserve accessorKey
    const isContentColumn = editingColumnId === 'content';
    
    // Build the column definition - ensure it matches the structure of defaultColumns
    const newColumn: ColumnDef<RowData> = {
      id: columnId,
      accessorKey: columnId,
      header: isContentColumn ? 'Content' : colDef.name,
      enableHiding: true,
      enableSorting: true,
      enableResizing: true,
      meta: {
        cell: colDef.type === 'file' 
          ? {
              variant: "file" as const,
              multiple: isContentColumn ? false : true,
              maxFiles: isContentColumn ? 1 : 10,
              maxFileSize: 10 * 1024 * 1024, // 10MB
            }
          : {
              variant: variantMap[colDef.type] as any,
            },
      },
      size: 150,
      minSize: MIN_COLUMN_SIZE,
      maxSize: MAX_COLUMN_SIZE,
    };

    // Only add custom cell renderer for boolean type
    // For other types, let DataGridCell handle rendering based on meta.cell.variant
    if (colDef.type === 'boolean') {
      newColumn.cell = ({ getValue }: any) => (getValue() ? "✓" : "✗");
    }

    if (editingColumnId) {
      // Update existing column
      setColumns((prevColumns) => prevColumns.map(c => c.id === editingColumnId ? newColumn : c));
    } else {
      // Add new column - use functional update to ensure React recognizes the change
      setColumns((prevColumns) => [...prevColumns, newColumn]);
    }

    // Store metadata
    setColumnMetadata({
      ...columnMetadata,
      [columnId]: { type: colDef.type, prompt: promptValue }
    });

    setAddColumnAnchor(null);
    setEditingColumnId(null);
  }, [editingColumnId, columns, columnMetadata]);

  // Handle viewing a file from the grid
  const handleViewFile = React.useCallback(({ file, rowIndex, columnId, row }: {
    file: FileCellData;
    rowIndex: number;
    columnId: string;
    row: RowData;
  }) => {
    // Set the selected row and open document sidebar
    setSelectedRowId(row.id);
    setSidebarMode('document');
  }, []);

  const dataGridProps = useDataGrid({
    columns,
    data,
    onDataChange: setData,
    onRowAdd,
    onRowsDelete,
    onFilesUpload,
    onFilesDelete,
    enableSearch: true,
    enablePaste: true,
    meta: {
      onColumnEdit: handleColumnEdit,
      onViewFile: handleViewFile,
    } as any,
  });

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the main container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleCloseSidebar = React.useCallback(() => {
    setSidebarMode('none');
    setSelectedRowId(null);
    setSelectedCell(null);
    setIsSidebarExpanded(false);
  }, []);
    
  return (
    <TabsContent value="analyser" className="mt-4 flex flex-row min-h-[calc(100vh-8rem)] z-10">
      <div
        className={`flex-1 flex flex-col min-w-0 bg-white relative min-h-[calc(100vh-8rem)] ${isDraggingOver ? 'bg-indigo-50/30' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Only set to false if we're leaving the main container
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            setIsDraggingOver(false);
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          
          const fileList = e.dataTransfer.files;
          if (!fileList || fileList.length === 0) return;

          const files = Array.from(fileList) as File[];
          if (files.length === 0) return;

          // Note: "auto" variant auto-detects file vs text based on cell value
          // No need to switch column variant - just set the file data and it will render correctly

          // Clear sorting so new rows appear at the bottom
          if (dataGridProps.table.getState().sorting.length > 0) {
            dataGridProps.table.setSorting([]);
          }

          setIsConverting(true);

          let uploadedVaultFiles: (VaultFileType | null)[] = [];
          if (currentProjectId && user) {
            try {
              uploadedVaultFiles = await Promise.all(files.map(file => uploadFileToVault(file)));
            } catch (error) {
              console.warn('Some files failed to upload to vault:', error);
            }
          }

          // Create initial rows with pending status
          const initialRows: RowData[] = files.map((file: File, idx: number) => {
            const fileData: FileCellData = {
              id: crypto.randomUUID(),
              name: file.name,
              size: file.size,
              type: file.type,
              url: URL.createObjectURL(file),
              vaultFileId: uploadedVaultFiles[idx]?.id,
            };

            return {
              id: faker.string.nanoid(),
              content: [fileData],
              processingStatus: 'pending' as ProcessingStatus,
            };
          });

          // Add rows immediately so user sees them
          // If there's only empty rows (no content), replace them instead of appending
          setData((prev) => {
            const hasOnlyEmptyRows = prev.every(row => {
              const content = row.content;
              // Empty if: undefined, null, or empty array
              return !content || (Array.isArray(content) && content.length === 0);
            });
            if (hasOnlyEmptyRows) {
              return initialRows;
            }
            return [...prev, ...initialRows];
          });

          // Process each file individually for real-time updates
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const rowId = initialRows[i].id;
            const vaultFileId = uploadedVaultFiles[i]?.id;

            // Update status to processing
            setData((prev) => prev.map((row) => 
              row.id === rowId 
                ? { ...row, processingStatus: 'processing' as ProcessingStatus }
                : row
            ));

            try {
              const processedContent = await processFileWithDocling(file, vaultFileId);
              setData((prev) => prev.map((row) => 
                row.id === rowId 
                  ? { 
                      ...row, 
                      processedContent: processedContent,
                      processingStatus: 'completed' as ProcessingStatus,
                    }
                  : row
              ));
            } catch (error) {
              // Update row with error status
              setData((prev) => prev.map((row) => 
                row.id === rowId 
                  ? { 
                      ...row, 
                      processingStatus: 'error' as ProcessingStatus,
                      errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    }
                  : row
              ));
            }
          }

          setIsConverting(false);
        }}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-50/80 backdrop-blur-sm border-2 border-indigo-400 border-dashed m-4 rounded-xl pointer-events-none">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-indigo-600 mb-2" />
              <p className="text-lg font-bold text-indigo-800">Drop files to create new rows</p>
            </div>
          </div>
        )}
        {/* Analysis Progress Overlay */}
        {isProcessing && !isConverting && (
          <div className="absolute bottom-4 right-4 z-50 bg-white rounded-xl shadow-xl border border-emerald-100 p-4 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className="bg-emerald-50 p-2 rounded-lg">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Running Analysis</p>
              <p className="text-xs text-slate-500">Extracting data from documents...</p>
            </div>
          </div>
        )}
        <div>
          <div className={`transition-all duration-300`}>
            <DataGrid
              {...dataGridProps}
              height={600}
              onColumnAdd={handleColumnAdd}
            />
          </div>
        </div>
      </div>

      {/* Verification Sidebar */}
      {sidebarMode !== 'none' && documentForSidebar && (
        <div 
          className={`h-full transition-all duration-300 ease-in-out border-l border-slate-200 bg-white ${
            isSidebarExpanded ? 'w-[900px]' : 'w-[400px]'
          }`}
        >
          <VerificationSidebar
            cell={cellForSidebar}
            document={documentForSidebar}
            column={columnForSidebar}
            onClose={handleCloseSidebar}
            isExpanded={isSidebarExpanded}
            onExpand={setIsSidebarExpanded}
          />
        </div>
      )}

      {/* Add/Edit Column Menu */}
      {addColumnAnchor && (
        <AddColumnMenu
          triggerRect={addColumnAnchor}
          onClose={() => {
            setAddColumnAnchor(null);
            setEditingColumnId(null);
          }}
          onSave={handleSaveColumn}
          modelId="gemini-2.5-flash"
          initialData={editingColumnId ? {
            name: columns.find(c => c.id === editingColumnId)?.header as string || '',
            type: columnMetadata[editingColumnId]?.type || 'text',
            prompt: columnMetadata[editingColumnId]?.prompt || '',
          } : undefined}
        />
      )}
    </TabsContent>
  );
}


