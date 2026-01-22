"use client";

import type {
  ColumnSort,
  Header,
  SortDirection,
  SortingState,
  Table,
} from "@tanstack/react-table";
import {
  BaselineIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  HashIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  PenIcon,
  PinIcon,
  PinOffIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CellOpts } from "../types/data-grid";

function getColumnVariant(variant?: CellOpts["variant"]): {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
} | null {
  switch (variant) {
    case "short-text":
      return { icon: BaselineIcon, label: "Short text" };
    case "long-text":
      return { icon: TypeIcon, label: "Long text" };
    case "number":
      return { icon: HashIcon, label: "Number" };
    case "url":
      return { icon: LinkIcon, label: "URL" };
    case "checkbox":
      return { icon: CheckSquareIcon, label: "Checkbox" };
    case "select":
      return { icon: ListIcon, label: "Select" };
    case "multi-select":
      return { icon: ListChecksIcon, label: "Multi-select" };
    case "date":
      return { icon: CalendarIcon, label: "Date" };
    case "file":
      return { icon: FileIcon, label: "File" };
    default:
      return null;
  }
}

interface DataGridColumnHeaderProps<TData, TValue>
  extends React.ComponentProps<typeof DropdownMenuTrigger> {
  header: Header<TData, TValue>;
  table: Table<TData>;
}

export function DataGridColumnHeader<TData, TValue>({
  header,
  table,
  className,
  onPointerDown,
  ...props
}: DataGridColumnHeaderProps<TData, TValue>) {
  const column = header.column;
  const label = column.columnDef.meta?.label
    ? column.columnDef.meta.label
    : typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.id;

  const isAnyColumnResizing =
    table.getState().columnSizingInfo.isResizingColumn;

  const cellVariant = column.columnDef.meta?.cell;
  const columnVariant = getColumnVariant(cellVariant?.variant);

  const pinnedPosition = column.getIsPinned();
  const isPinnedLeft = pinnedPosition === "left";
  const isPinnedRight = pinnedPosition === "right";

  const onSortingChange = React.useCallback(
    (direction: SortDirection) => {
      table.setSorting((prev: SortingState) => {
        const existingSortIndex = prev.findIndex(
          (sort) => sort.id === column.id,
        );
        const newSort: ColumnSort = {
          id: column.id,
          desc: direction === "desc",
        };

        if (existingSortIndex >= 0) {
          const updated = [...prev];
          updated[existingSortIndex] = newSort;
          return updated;
        } else {
          return [...prev, newSort];
        }
      });
    },
    [column.id, table],
  );

  const onSortRemove = React.useCallback(() => {
    table.setSorting((prev: SortingState) =>
      prev.filter((sort) => sort.id !== column.id),
    );
  }, [column.id, table]);

  const onLeftPin = React.useCallback(() => {
    column.pin("left");
  }, [column]);

  const onRightPin = React.useCallback(() => {
    column.pin("right");
  }, [column]);

  const onUnpin = React.useCallback(() => {
    column.pin(false);
  }, [column]);

  const onTriggerPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;

      if (event.button !== 0) {
        return;
      }
      table.options.meta?.onColumnClick?.(column.id);
    },
    [table.options.meta, column.id, onPointerDown],
  );

  const onEditColumn = React.useCallback((event: React.MouseEvent) => {
    // Find the header element for this specific column
    const headerElement = document.querySelector(`[data-column-id="${column.id}"][data-slot="grid-header-cell"]`);
    const rect = headerElement 
      ? headerElement.getBoundingClientRect()
      : (event.currentTarget.closest('[data-slot="grid-header-cell"]') as HTMLElement)?.getBoundingClientRect();
    
    if (rect) {
      (table.options.meta as any)?.onColumnEdit?.(column.id, rect);
    } else {
      (table.options.meta as any)?.onColumnEdit?.(column.id);
    }
  }, [table.options.meta, column.id]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex size-full items-center justify-between gap-2 p-2 text-sm hover:bg-accent/40 data-[state=open]:bg-accent/40 [&_svg]:size-4",
            isAnyColumnResizing && "pointer-events-none",
            className,
          )}
          onPointerDown={onTriggerPointerDown}
          {...props}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {columnVariant && (
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <columnVariant.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{columnVariant.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span className="truncate">{label}</span>
          </div>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0} className="w-60">
          {/* Show all columns menu - only show if there are hidden columns */}
          {table.getAllColumns().some(col => col.getCanHide() && !col.getIsVisible()) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Hidden columns
              </div>
              {table.getAllColumns()
                .filter(col => col.getCanHide() && !col.getIsVisible())
                .map((hiddenCol) => {
                  const hiddenLabel = hiddenCol.columnDef.meta?.label
                    ? hiddenCol.columnDef.meta.label
                    : typeof hiddenCol.columnDef.header === "string"
                      ? hiddenCol.columnDef.header
                      : hiddenCol.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={hiddenCol.id}
                      className="relative ps-2 pe-8 [&>span:first-child]:start-auto [&>span:first-child]:end-2 [&_svg]:text-muted-foreground"
                      checked={false}
                      onClick={() => hiddenCol.toggleVisibility()}
                    >
                      <EyeIcon />
                      {hiddenLabel}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              <DropdownMenuSeparator />
            </>
          )}
          {table.options.meta?.onColumnEdit && (
            <>
              <DropdownMenuItem
                className="[&_svg]:text-muted-foreground"
                onClick={(e) => onEditColumn(e as any)}
              >
                <PenIcon />
                Edit column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {column.getCanSort() && (
            <>
              <DropdownMenuCheckboxItem
                className="relative ps-2 pe-8 [&>span:first-child]:start-auto [&>span:first-child]:end-2 [&_svg]:text-muted-foreground"
                checked={column.getIsSorted() === "asc"}
                onClick={() => onSortingChange("asc")}
              >
                <ChevronUpIcon />
                Sort asc
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="relative ps-2 pe-8 [&>span:first-child]:start-auto [&>span:first-child]:end-2 [&_svg]:text-muted-foreground"
                checked={column.getIsSorted() === "desc"}
                onClick={() => onSortingChange("desc")}
              >
                <ChevronDownIcon />
                Sort desc
              </DropdownMenuCheckboxItem>
              {column.getIsSorted() && (
                <DropdownMenuItem onClick={onSortRemove}>
                  <XIcon />
                  Remove sort
                </DropdownMenuItem>
              )}
            </>
          )}
          {column.getCanPin() && (
            <>
              {column.getCanSort() && <DropdownMenuSeparator />}

              {isPinnedLeft ? (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onClick={onUnpin}
                >
                  <PinOffIcon />
                  Unpin from left
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onClick={onLeftPin}
                >
                  <PinIcon />
                  Pin to left
                </DropdownMenuItem>
              )}
              {isPinnedRight ? (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onClick={onUnpin}
                >
                  <PinOffIcon />
                  Unpin from right
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onClick={onRightPin}
                >
                  <PinIcon />
                  Pin to right
                </DropdownMenuItem>
              )}
            </>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                className="relative ps-2 pe-8 [&>span:first-child]:start-auto [&>span:first-child]:end-2 [&_svg]:text-muted-foreground"
                checked={!column.getIsVisible()}
                onClick={() => column.toggleVisibility()}
              >
                {column.getIsVisible() ? (
                  <>
                    <EyeOffIcon />
                    Hide column
                  </>
                ) : (
                  <>
                    <EyeIcon />
                    Show column
                  </>
                )}
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {header.column.getCanResize() && (
        <DataGridColumnResizer header={header} table={table} label={label} />
      )}
    </>
  );
}

const DataGridColumnResizer = React.memo(
  DataGridColumnResizerImpl,
  (prev, next) => {
    const prevColumn = prev.header.column;
    const nextColumn = next.header.column;

    if (
      prevColumn.getIsResizing() !== nextColumn.getIsResizing() ||
      prevColumn.getSize() !== nextColumn.getSize()
    ) {
      return false;
    }

    if (prev.label !== next.label) return false;

    return true;
  },
) as typeof DataGridColumnResizerImpl;

interface DataGridColumnResizerProps<TData, TValue>
  extends DataGridColumnHeaderProps<TData, TValue> {
  label: string;
}

function DataGridColumnResizerImpl<TData, TValue>({
  header,
  table,
  label,
}: DataGridColumnResizerProps<TData, TValue>) {
  const defaultColumnDef = table._getDefaultColumnDef();
  const hasDragged = React.useRef(false);
  const initialX = React.useRef(0);

  const onDoubleClick = React.useCallback((event: React.MouseEvent) => {
    // Only prevent default if a drag has occurred, otherwise allow double-click
    if (hasDragged.current) {
      event.preventDefault();
    }
  }, []);

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      hasDragged.current = false;
      initialX.current = event.clientX;
      
      const handleMouseMove = (e: MouseEvent) => {
        // Consider it a drag if moved more than 3px
        if (Math.abs(e.clientX - initialX.current) > 3) {
          hasDragged.current = true;
        }
      };
      
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        // Reset the drag flag after a short delay to allow double-click detection
        setTimeout(() => {
          hasDragged.current = false;
        }, 200);
      };
      
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      
      const resizeHandler = header.getResizeHandler();
      if (resizeHandler) {
        resizeHandler(event);
      }
    },
    [header],
  );

  const handleTouchStart = React.useCallback(
    (event: React.TouchEvent) => {
      event.stopPropagation();
      const resizeHandler = header.getResizeHandler();
      if (resizeHandler) {
        resizeHandler(event as any);
      }
    },
    [header],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={header.column.getSize()}
      aria-valuemin={defaultColumnDef.minSize}
      aria-valuemax={defaultColumnDef.maxSize}
      tabIndex={0}
      className={cn(
        "after:-translate-x-1/2 -end-px absolute top-0 z-50 h-full w-0.5 cursor-ew-resize touch-none select-none bg-border transition-opacity after:absolute after:inset-y-0 after:start-1/2 after:h-full after:w-[8px] after:content-[''] hover:bg-primary focus:bg-primary focus:outline-none",
        header.column.getIsResizing()
          ? "bg-primary pointer-events-auto"
          : "opacity-0 hover:opacity-100",
      )}
      onDoubleClick={onDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    />
  );
}
