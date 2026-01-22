import { api } from '@/lib/api-client';
import { getCSRFToken } from '@/api';
import { VaultFile } from '../types/api';
import { handleApiError } from '@/lib/utils/handle-api-error';
import { BASE_URL } from '@/lib/api-client';

export interface UploadFileParams {
  file: File;
  project_uuid: string;
  uploaded_by: number;
  team?: number;
  parent_id?: number;
  shared_with_users?: number[];
  shared_with_teams?: number[];
}

export interface VaultFilesResponse {
  results: VaultFile[];
  count: number;
  next: string | null;
  previous: string | null;
}

export type ArtifactType = 'markdown' | 'text' | 'docling_json';

export interface GenerateArtifactsResponse {
  vault_file_id: number;
  status: string;
  task_id?: string;
  artifact_paths?: Record<string, string | null>;
  error?: string;
}

export interface ArtifactResponse {
  vault_file_id: number;
  artifact_type: ArtifactType;
  status: string;
  content?: string;
  error?: string | null;
}

export async function getVaultFilesByProject(
  projectId: string,
  page: number = 1,
  pageSize: number = 10,
  search: string = '',
  parentId: number = 0
): Promise<VaultFilesResponse> {
  let url = `/opie/api/v1/vault-files/by-project/?project_uuid=${projectId}&page=${page}&page_size=${pageSize}&parent_id=${parentId}`;
  
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  
  const response = await api.get(url);
  return response as VaultFilesResponse;
}

export async function getTrashFilesByProject(
  projectId: string,
  page: number = 1,
  pageSize: number = 10,
  search: string = ''
): Promise<VaultFilesResponse> {
  let url = `/opie/api/v1/vault-files/trash/?project_uuid=${projectId}&page=${page}&page_size=${pageSize}`;
  
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  
  const response = await api.get(url);
  return response as VaultFilesResponse;
}

export async function uploadFiles({
  file,
  project_uuid,
  uploaded_by,
  team,
  shared_with_users,
  shared_with_teams,
  parent_id,
}: UploadFileParams) {
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_uuid', project_uuid);
  formData.append('uploaded_by', String(uploaded_by));
  formData.append('parent_id', String(parent_id ?? 0));
  if (typeof team !== 'undefined') {
    formData.append('team', String(team));
  }
  if (shared_with_users) {
    shared_with_users.forEach((user) => formData.append('shared_with_users', String(user)));
  }
  if (shared_with_teams) {
    shared_with_teams.forEach((team) => formData.append('shared_with_teams', String(team)));
  }


  for (const [key, value] of formData.entries()) {
    console.log(key, value);
  }

  const csrfToken = getCSRFToken();

  try {
    const response = await fetch(`${BASE_URL}/opie/api/v1/vault-files/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        ...(csrfToken && { "X-CSRFToken": csrfToken }),
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.detail || 'Upload failed';
      throw new Error(message);
    }
    const data = await response.json();
    return data as VaultFile;
  } catch (error: any) {
    const message = error?.message || 'Upload failed';
    console.error(message);
    throw new Error(message);
  }
}

export async function deleteVaultFile(uuid: string): Promise<void> {
  try {
    await api.delete(`/opie/api/v1/vault-files/${uuid}/`);
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to delete file');
  }
}

export async function permanentDeleteVaultFile(uuid: string): Promise<void> {
  try {
    await api.delete(`/opie/api/v1/vault-files/${uuid}/permanent-delete/`);
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to permanently delete file');
  }
}

export async function restoreVaultFile(uuid: string): Promise<void> {
  try {
    await api.post(`/opie/api/v1/vault-files/${uuid}/restore/`);
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to restore file');
  }
}

export async function updateVaultFile(fileId: number, data: { original_filename?: string }): Promise<VaultFile> {
  try {
    const response = await api.patch(`/opie/api/v1/vault-files/${fileId}/`, data);
    return response as VaultFile;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to update file');
  }
}
export async function chatWithVaultAgent(params: {
  project_uuid: string;
  parent_id?: number;
  file_ids?: number[];
  message: string;
}) {
  // Use the existing ai-chat-stream endpoint which already handles vault queries
  const { BASE_URL, ensureCSRFToken } = await import('@/lib/api-client');
  const { getCSRFToken } = await import('@/api');
  
  
  // Ensure CSRF token exists for non-GET requests (like the API client does)
  await ensureCSRFToken();
  const csrfToken = getCSRFToken();
  
  // Use exactly the same authentication pattern as the main API client
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Include CSRF token if available  
    ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
  };
  const response = await fetch(`${BASE_URL}/opie/api/v1/vault-files/vault-agent-chat/`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
    credentials: 'include', // IMPORTANT: This was missing!
  });

  // Handle authentication errors like the main API client
  if (response.status === 401) {
    throw new Error('Authentication failed. Please log in again.');
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      // Use default error message if JSON parsing fails
    }
    throw new Error(errorMessage);
  }

  return response;
}
export async function createFolder({
  folderName,
  project_uuid,
  parent_id = 0,
  uploaded_by,
  team,
}: {
  folderName: string;
  project_uuid: string;
  uploaded_by?: number;
  parent_id?: number;
  team?: number;
}): Promise<VaultFile> {
  const payload = {
    folderName:folderName,
    original_filename:folderName,
    project_uuid :project_uuid,
    parent_id :parent_id,
    uploaded_by :uploaded_by,
    team : team,
    is_folder: true,
    type: "folder"
  }

  try {
    console.log("payload", payload);
    const response = await api.post('/opie/api/v1/vault-files/', payload);
    return response as VaultFile;
  } catch (error: any) {
    const message = error?.message || 'Failed to create folder';
    console.error(message);
    throw new Error(message);
  }
}

export async function moveVaultFiles(fileIds: number[], targetFolderId: number): Promise<void> {
  try {
    await api.post('/opie/api/v1/vault-files/move/', {
      file_ids: fileIds,
      target_folder_id: targetFolderId
    });
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to move files');
  }
}

export async function generateVaultArtifacts(vaultFileId: number): Promise<GenerateArtifactsResponse> {
  try {
    const response = await api.post(`/opie/api/v1/vault-files/${vaultFileId}/generate-artifacts/`, {});
    return response as GenerateArtifactsResponse;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to start artifact generation');
  }
}

export async function getVaultArtifact(
  vaultFileUuid: string,
  artifactType: ArtifactType = 'markdown',
  includeContent: boolean = true,
): Promise<ArtifactResponse> {
  try {
    const params = new URLSearchParams({
      type: artifactType,
      include_content: includeContent ? 'true' : 'false',
    });
    const response = await api.get(`/opie/api/v1/vault-files/${vaultFileUuid}/artifacts/?${params.toString()}`);
    return response as ArtifactResponse;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to fetch artifact');
  }
}

export interface VaultFileDownloadResponse {
  url: string;
  filename: string;
  content_type: string;
  size: number;
  expires_in_seconds: number;
}

/**
 * Get the proxied content URL for a vault file (for secure preview).
 * This URL goes through our Next.js API route, keeping signed URLs server-side.
 */
export function getVaultFileContentUrl(vaultFileUuid: string): string {
  return `/api/vault/files/${vaultFileUuid}/content`;
}

export async function getVaultFileDownloadUrl(
  vaultFileUuid: string,
  expires?: number,
  disposition?: 'inline' | 'attachment'
): Promise<VaultFileDownloadResponse> {
  try {
    const params = new URLSearchParams();
    if (expires !== undefined) {
      params.append('expires', expires.toString());
    }
    if (disposition) {
      params.append('disposition', disposition);
    }
    const queryString = params.toString();
    const url = `/opie/api/v1/vault-files/${vaultFileUuid}/download/${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response as VaultFileDownloadResponse;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to get download URL');
  }
}

// Analysis types
export interface AnalyzeDocumentRequest {
  document_id: string;
  document_content: string;
  document_name: string;
  columns: {
    id: string;
    name: string;
    type: string;
    prompt: string;
  }[];
  model_id?: string;
}

export interface AnalyzeColumnResult {
  value: string;
  confidence: 'High' | 'Medium' | 'Low';
  quote: string;
  page?: number;
  reasoning: string;
}

export interface AnalyzeDocumentResponse {
  document_id: string;
  results: {
    [columnId: string]: AnalyzeColumnResult;
  };
}

export interface AnalyzeBatchRequest {
  documents: AnalyzeDocumentRequest[];
  model_id?: string;
}

export interface AnalyzeBatchResponse {
  results: AnalyzeDocumentResponse[];
  errors?: {
    document_id: string;
    error: string;
  }[];
}

/**
 * Analyze documents using AI to extract column data
 */
export async function analyzeDocuments(
  documents: {
    id: string;
    content: string;
    name: string;
  }[],
  columns: {
    id: string;
    name: string;
    type: string;
    prompt: string;
  }[],
  modelId?: string
): Promise<AnalyzeBatchResponse> {
  try {
    const payload: AnalyzeBatchRequest = {
      documents: documents.map(doc => ({
        document_id: doc.id,
        document_content: doc.content,
        document_name: doc.name,
        columns: columns,
      })),
      model_id: modelId,
    };

    const response = await api.post('/opie/api/v1/analyze/', payload);
    return response as AnalyzeBatchResponse;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to analyze documents');
  }
}

// Preset types and API
export interface PresetColumn {
  name: string;
  type: string;
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
}

export interface AnalyserPresetsResponse {
  results: AnalyserPreset[];
  count: number;
  next: string | null;
  previous: string | null;
}

/**
 * Get all analyser presets (system + user's own)
 */
export async function getAnalyserPresets(): Promise<AnalyserPreset[]> {
  try {
    const response = await api.get('/opie/api/v1/analyser-presets/');
    // Handle paginated response
    if (response.results) {
      return response.results;
    }
    return Array.isArray(response) ? response : [];
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to fetch analyser presets');
  }
}

/**
 * Get a single analyser preset by ID
 */
export async function getAnalyserPreset(id: number): Promise<AnalyserPreset> {
  try {
    const response = await api.get(`/opie/api/v1/analyser-presets/${id}/`);
    return response as AnalyserPreset;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to fetch analyser preset');
  }
}

/**
 * Create a new analyser preset
 */
export async function createAnalyserPreset(
  preset: Omit<AnalyserPreset, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'created_by'>
): Promise<AnalyserPreset> {
  try {
    const response = await api.post('/opie/api/v1/analyser-presets/', preset);
    return response as AnalyserPreset;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to create analyser preset');
  }
}

/**
 * Update an analyser preset
 */
export async function updateAnalyserPreset(
  id: number,
  preset: Partial<Omit<AnalyserPreset, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'created_by'>>
): Promise<AnalyserPreset> {
  try {
    const response = await api.patch(`/opie/api/v1/analyser-presets/${id}/`, preset);
    return response as AnalyserPreset;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to update analyser preset');
  }
}

/**
 * Delete an analyser preset
 */
export async function deleteAnalyserPreset(id: number): Promise<void> {
  try {
    await api.delete(`/opie/api/v1/analyser-presets/${id}/`);
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message || 'Failed to delete analyser preset');
  }
}
