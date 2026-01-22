"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { VaultFile } from '../types/vault';
import { getVaultFileDownloadUrl, getVaultFileContentUrl } from '@/api/vault';
import { useToast } from '@/components/ui/use-toast';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
}

interface FilePreviewDialogProps {
  file: VaultFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  folderId?: number;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function FilePreviewDialog({ file, open, onOpenChange }: FilePreviewDialogProps) {
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get proxied content URL (no CORS issues, signed URL stays server-side)
  const contentUrl = file?.uuid ? getVaultFileContentUrl(file.uuid) : null;

  const isPDF = file?.type === 'application/pdf' ||
    file?.filename?.toLowerCase().endsWith('.pdf') ||
    file?.original_filename?.toLowerCase().endsWith('.pdf');

  // Suppress TextLayer cancellation warnings (expected when pages change quickly)
  useEffect(() => {
    if (!open) return;

    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      if (message.includes('TextLayer task cancelled') || 
          message.includes('AbortException') && message.includes('TextLayer')) {
        return; // Suppress this specific warning
      }
      originalWarn.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, [open]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && file) {
      setPageNumber(1);
      setScale(1.0);
      setNumPages(null);
      setIsLoading(true);
      setError(null);
    }
  }, [open, file]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      } else if (e.key === 'ArrowLeft' && numPages && pageNumber > 1) {
        goToPage(pageNumber - 1);
      } else if (e.key === 'ArrowRight' && numPages && pageNumber < numPages) {
        goToPage(pageNumber + 1);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, pageNumber, numPages, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Update page number based on scroll position
  useEffect(() => {
    if (!numPages || !scrollContainerRef.current) return;

    const updatePageFromScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const viewportCenter = scrollTop + containerHeight / 2;

      let currentPage = 1;
      let minDistance = Infinity;

      for (let i = 1; i <= numPages; i++) {
        const pageElement = document.getElementById(`pdf-page-${i}`);
        if (pageElement) {
          const pageTop = pageElement.offsetTop;
          const pageHeight = pageElement.offsetHeight;
          const pageCenter = pageTop + pageHeight / 2;
          const distance = Math.abs(viewportCenter - pageCenter);

          if (distance < minDistance) {
            minDistance = distance;
            currentPage = i;
          }
        }
      }

      if (currentPage !== pageNumber) {
        setPageNumber(currentPage);
      }
    };

    const container = scrollContainerRef.current;
    container.addEventListener('scroll', updatePageFromScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', updatePageFromScroll);
    };
  }, [numPages, pageNumber]);

  const goToPage = useCallback((page: number) => {
    setPageNumber(page);
    const pageElement = document.getElementById(`pdf-page-${page}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => {
      const nextLevel = ZOOM_LEVELS.find(level => level > prev);
      return nextLevel || prev;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const nextLevel = [...ZOOM_LEVELS].reverse().find(level => level < prev);
      return nextLevel || prev;
    });
  }, []);

  const handleDocumentLoad = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const handleDocumentError = (error: Error) => {
    setError('Failed to load PDF');
    setIsLoading(false);
    console.error('PDF load error:', error);
  };

  const handlePageRenderError = (error: Error) => {
    // Suppress TextLayer cancellation warnings - these are expected when pages change quickly
    if (error.name === 'AbortException' && error.message?.includes('TextLayer')) {
      return;
    }
    console.error('Page render error:', error);
  };

  const handleDownload = async () => {
    if (!file?.uuid) {
      toast({
        title: "Error",
        description: "File UUID not available",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await getVaultFileDownloadUrl(file.uuid, 60, 'attachment');
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
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!open || !file) return null;

  const filename = file.original_filename || file.filename || 'File Preview';

  return (
    <TooltipProvider>
      <div 
        className="fixed inset-0 z-[100] flex flex-col" 
        style={{ 
          backgroundColor: 'rgba(30, 33, 35, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          isolation: 'isolate'
        }}
      >
        {/* Dark toolbar - Google Drive style */}
        <div 
          className="flex items-center h-14 px-4 text-white flex-shrink-0" 
          style={{ 
            backgroundColor: 'rgba(20, 23, 25, 0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)'
          }}
        >
          {/* Left section - Back button and filename */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white hover:bg-white/10 flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close (Esc)</TooltipContent>
            </Tooltip>

            <span className="text-sm font-medium truncate">
              {filename}
            </span>
          </div>

          {/* Center section - Page navigation (PDF only) */}
          {isPDF && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(Math.max(1, pageNumber - 1))}
                    disabled={!numPages || pageNumber <= 1}
                    className="text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Previous page</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-2 px-2">
                <input
                  type="number"
                  min="1"
                  max={numPages || 1}
                  value={pageNumber}
                  onChange={(e) => {
                    const page = parseInt(e.target.value, 10);
                    if (page >= 1 && page <= (numPages || 1)) {
                      goToPage(page);
                    }
                  }}
                  className="w-12 px-2 py-1 text-sm text-center text-white bg-black/20 border border-white/30 rounded focus:outline-none focus:ring-1 focus:ring-white/50"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                />
                <span className="text-sm text-white/70">/</span>
                <span className="text-sm text-white/70 min-w-[24px]">
                  {numPages || '—'}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToPage(Math.min(numPages || 1, pageNumber + 1))}
                    disabled={!numPages || pageNumber >= numPages}
                    className="text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Next page</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Right section - Zoom and actions */}
          <div className="flex items-center gap-1 flex-1 justify-end">
            {isPDF && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomOut}
                      disabled={scale <= ZOOM_LEVELS[0]}
                      className="text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      <ZoomOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Zoom out (-)</TooltipContent>
                </Tooltip>

                <span className="text-sm text-white/70 min-w-[50px] text-center">
                  {Math.round(scale * 100)}%
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomIn}
                      disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                      className="text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      <ZoomIn className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Zoom in (+)</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-white/20 mx-2" />
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/10"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
          style={{ 
            backgroundColor: 'rgba(30, 33, 35, 0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)'
          }}
        >
          {!contentUrl ? (
            <div className="flex flex-col items-center justify-center h-full text-white/70">
              <X className="h-16 w-16 mb-4" />
              <p>Failed to load file</p>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="mt-4 text-white border-white/30 hover:bg-white/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Try Download Instead
              </Button>
            </div>
          ) : isPDF ? (
            <div className="flex flex-col items-center py-8 px-4 min-h-full">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-white/50" />
                  <p className="mt-4 text-white/50">Loading PDF...</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-20 text-white/70">
                  <X className="h-12 w-12 mb-4" />
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="mt-4 text-white border-white/30 hover:bg-white/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Instead
                  </Button>
                </div>
              )}

              <Document
                file={contentUrl}
                onLoadSuccess={handleDocumentLoad}
                onLoadError={handleDocumentError}
                loading={null}
                className={`flex flex-col items-center gap-6 ${isLoading ? 'hidden' : ''}`}
              >
                {numPages && Array.from(new Array(numPages), (_, index) => (
                  <div
                    key={`page_${index + 1}`}
                    id={`pdf-page-${index + 1}`}
                    className="relative"
                  >
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="shadow-2xl"
                      onRenderError={handlePageRenderError}
                      loading={
                        <div
                          className="flex items-center justify-center bg-white"
                          style={{ width: 612 * scale, height: 792 * scale }}
                        >
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      }
                    />
                  </div>
                ))}
              </Document>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              {file.type?.startsWith('image/') ? (
                <img
                  src={contentUrl}
                  alt={filename}
                  className="max-w-full max-h-full object-contain shadow-2xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/70">
                  <X className="h-16 w-16 mb-4" />
                  <p>Preview not available for this file type</p>
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="mt-4 text-white border-white/30 hover:bg-white/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
