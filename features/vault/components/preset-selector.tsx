"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { FileText, Sparkles, Loader2 } from "lucide-react";
import { getPresets } from "../lib/preset-storage";
import type { AnalyserPreset } from "../types";

interface PresetSelectorProps {
  onPresetSelect: (preset: AnalyserPreset) => void;
}

export function PresetSelector({ onPresetSelect }: PresetSelectorProps) {
  const [presets, setPresets] = React.useState<AnalyserPreset[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Load presets from API when component mounts
    const loadPresets = async () => {
      try {
        setIsLoading(true);
        const loadedPresets = await getPresets();
        setPresets(loadedPresets);
      } catch (error) {
        console.error('Failed to load presets:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPresets();
  }, []);

  const handlePresetSelect = (preset: AnalyserPreset) => {
    onPresetSelect(preset);
    setIsOpen(false);
  };

  const defaultPresets = presets.filter(p => p.isDefault || p.is_system);
  const userPresets = presets.filter(p => !p.isDefault && !p.is_system);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Presets
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Apply Preset</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {defaultPresets.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Default Presets
            </DropdownMenuLabel>
            {defaultPresets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{preset.name}</span>
                </div>
                {preset.description && (
                  <span className="text-xs text-muted-foreground pl-6">
                    {preset.description}
                  </span>
                )}
                <span className="text-xs text-muted-foreground pl-6">
                  {preset.columns.length} column{preset.columns.length !== 1 ? 's' : ''}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {userPresets.length > 0 && (
          <>
            {defaultPresets.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your Presets
            </DropdownMenuLabel>
            {userPresets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{preset.name}</span>
                </div>
                {preset.description && (
                  <span className="text-xs text-muted-foreground pl-6">
                    {preset.description}
                  </span>
                )}
                <span className="text-xs text-muted-foreground pl-6">
                  {preset.columns.length} column{preset.columns.length !== 1 ? 's' : ''}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {isLoading && (
          <DropdownMenuItem disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading presets...
          </DropdownMenuItem>
        )}

        {!isLoading && presets.length === 0 && (
          <DropdownMenuItem disabled>
            No presets available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
