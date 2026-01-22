export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // Base64 string for PDF/Images, or raw text for TXT
  mimeType: string;
  vaultFileUuid?: string; // Optional UUID for vault files to enable PDF preview
}

export type ColumnType = 'short-text' | 'long-text' | 'number' | 'date' | 'boolean' | 'list' | 'file';

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  prompt: string;
  status: 'idle' | 'extracting' | 'completed' | 'error';
  width?: number;
}

export interface ExtractionCell {
  value: string;
  confidence: 'High' | 'Medium' | 'Low';
  quote: string;
  page: number;
  reasoning: string;
  // UI State for review workflow
  status?: 'verified' | 'needs_review' | 'edited';
}

export interface ExtractionResult {
  [docId: string]: {
    [colId: string]: ExtractionCell | null;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ViewMode = 'grid' | 'chat';
export type SidebarMode = 'none' | 'verify' | 'chat';

// Preset types
export interface PresetColumn {
  name: string;
  type: ColumnType;
  prompt: string;
}

export interface AnalyserPreset {
  id: number;
  name: string;
  description?: string;
  columns: PresetColumn[];
  is_system: boolean;
  created_by?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Legacy field for compatibility (maps to is_system)
  isDefault?: boolean;
}