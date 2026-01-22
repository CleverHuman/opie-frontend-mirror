import type { AnalyserPreset } from '../types';
import { 
  getAnalyserPresets, 
  createAnalyserPreset, 
  updateAnalyserPreset, 
  deleteAnalyserPreset 
} from '@/api/vault';

/**
 * Get all presets from the backend (system + user's own)
 */
export async function getPresets(): Promise<AnalyserPreset[]> {
  try {
    const presets = await getAnalyserPresets();
    // Map is_system to isDefault for backward compatibility
    return presets.map(preset => ({
      ...preset,
      isDefault: preset.is_system,
    }));
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
}

/**
 * Save a user-created preset to the backend
 */
export async function savePreset(
  preset: Omit<AnalyserPreset, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'created_by' | 'isDefault'>
): Promise<AnalyserPreset> {
  try {
    const saved = await createAnalyserPreset(preset);
    return {
      ...saved,
      isDefault: saved.is_system,
    };
  } catch (error) {
    console.error('Failed to save preset:', error);
    throw error;
  }
}

/**
 * Update a user-created preset
 */
export async function updatePreset(
  id: number,
  preset: Partial<Omit<AnalyserPreset, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'created_by' | 'isDefault'>>
): Promise<AnalyserPreset> {
  try {
    const updated = await updateAnalyserPreset(id, preset);
    return {
      ...updated,
      isDefault: updated.is_system,
    };
  } catch (error) {
    console.error('Failed to update preset:', error);
    throw error;
  }
}

/**
 * Delete a user-created preset
 */
export async function deletePreset(presetId: number): Promise<void> {
  try {
    await deleteAnalyserPreset(presetId);
  } catch (error) {
    console.error('Failed to delete preset:', error);
    throw error;
  }
}
