"use client";

import { useDirection } from "@radix-ui/react-direction";
import { flexRender } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import * as React from "react";
import { DataGridColumnHeader } from "./data-grid-column-header";
import { DataGridContextMenu } from "./data-grid-context-menu";
import { DataGridKeyboardShortcuts } from "./data-grid-keyboard-shortcuts";
import { DataGridPasteDialog } from "./data-grid-paste-dialog";
import { DataGridRow } from "./data-grid-row";
import { DataGridSearch } from "./data-grid-search";
import type { useDataGrid } from "../hooks/use-data-grid";
import { getCommonPinningStyles } from "../lib/data-grid";
import { COLUMN_SIZE } from "../lib/data-grid-constants";
import { cn } from "../lib/utils";

interface DataGridProps<TData>
  extends ReturnType<typeof useDataGrid<TData>>,
    React.ComponentProps<"div"> {
  height?: number;
  stretchColumns?: boolean;
  onColumnAdd?: () => void;
}

export function DataGrid<TData>({
  dataGridRef,
  headerRef,
  rowMapRef,
  footerRef,
  table,
  rowVirtualizer,
  height = 600,
  searchState,
  columnSizeVars,
  onRowAdd,
  onColumnAdd,
  stretchColumns = false,
  className,
  ...props
}: DataGridProps<TData>) {
  const dir = useDirection();
  const rows = table.getRowModel().rows;
  const columns = table.getAllColumns();

  const meta = table.options.meta;
  const rowHeight = meta?.rowHeight ?? "short";
  const focusedCell = meta?.focusedCell ?? null;

  const onGridContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = React.useState(false);

  const onAddRowKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onRowAdd) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowAdd();
      }
    },
    [onRowAdd],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Open keyboard shortcuts with ? or Ctrl+/
      if (
        event.key === "?" ||
        ((event.ctrlKey || event.metaKey) && event.key === "/")
      ) {
        // Don't trigger if user is typing in an input
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        setKeyboardShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      data-slot="grid-wrapper"
      dir={dir}
      className={cn("relative flex w-full flex-col", className)}
      {...props}
    >
      {searchState && <DataGridSearch {...searchState} />}
      <DataGridContextMenu table={table} />
      <DataGridPasteDialog table={table} />
      <DataGridKeyboardShortcuts
        open={keyboardShortcutsOpen}
        onOpenChange={setKeyboardShortcutsOpen}
      />
      <div
        role="grid"
        aria-label="Data grid"
        aria-rowcount={rows.length + (onRowAdd ? 1 : 0)}
        aria-colcount={columns.length}
        data-slot="grid"
        tabIndex={0}
        ref={(node) => {
          // Handle ref assignment
          if (typeof dataGridRef === 'function') {
            dataGridRef(node);
          } else if (dataGridRef) {
            (dataGridRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
          
          // When element becomes available, ensure virtualizer measures
          if (node && rowVirtualizer) {
            // Use a small delay to ensure element is fully mounted
            requestAnimationFrame(() => {
              if (node.offsetParent !== null) {
                rowVirtualizer.measure();
              }
            });
          }
        }}
        className="relative grid select-none overflow-auto rounded-md border focus:outline-none"
        style={{
          ...columnSizeVars,
          maxHeight: `${height}px`,
        }}
        onContextMenu={onGridContextMenu}
      >
        <div
          role="rowgroup"
          data-slot="grid-header"
          ref={headerRef}
          className="sticky top-0 z-10 grid border-b bg-background"
        >
          {table.getHeaderGroups().map((headerGroup, rowIndex) => (
            <div
              key={headerGroup.id}
              role="row"
              aria-rowindex={rowIndex + 1}
              data-slot="grid-header-row"
              tabIndex={-1}
              className="flex w-full"
            >
              {headerGroup.headers.map((header, colIndex) => {
                const sorting = table.getState().sorting;
                const currentSort = sorting.find(
                  (sort) => sort.id === header.column.id,
                );
                const isSortable = header.column.getCanSort();

                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-colindex={colIndex + 1}
                    aria-sort={
                      currentSort?.desc === false
                        ? "ascending"
                        : currentSort?.desc === true
                          ? "descending"
                          : isSortable
                            ? "none"
                            : undefined
                    }
                    data-slot="grid-header-cell"
                    data-column-id={header.column.id}
                    tabIndex={-1}
                    className={cn("relative", {
                      grow: stretchColumns && header.column.id !== "select",
                      "border-e": header.column.id !== "select",
                    })}
                    style={{
                      ...getCommonPinningStyles({ column: header.column, dir }),
                      width: `calc(var(--col-${header.column.id}-size, ${COLUMN_SIZE.DEFAULT}) * 1px)`,
                      minWidth: `calc(var(--col-${header.column.id}-size, ${COLUMN_SIZE.DEFAULT}) * 1px)`,
                      maxWidth: `calc(var(--col-${header.column.id}-size, ${COLUMN_SIZE.DEFAULT}) * 1px)`,
                    }}
                  >
                    {header.isPlaceholder ? null : typeof header.column
                        .columnDef.header === "function" ? (
                      <div className="size-full px-3 py-1.5">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </div>
                    ) : (
                      <DataGridColumnHeader header={header} table={table} />
                    )}
                  </div>
                );
              })}
              {onColumnAdd && (
                <div
                  role="columnheader"
                  aria-colindex={headerGroup.headers.length + 1}
                  data-slot="grid-header-add-column"
                  tabIndex={0}
                  className="relative flex items-center justify-center border-e bg-muted/30 transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none cursor-pointer"
                  style={{
                    width: '60px',
                    minWidth: '60px',
                  }}
                  onClick={onColumnAdd}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onColumnAdd();
                    }
                  }}
                >
                  <Plus className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          role="rowgroup"
          data-slot="grid-body"
          className="relative grid"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualIndexes().map((virtualRowIndex) => {
            const row = rows[virtualRowIndex];
            if (!row) return null;

            return (
              <DataGridRow
                key={row.id}
                row={row}
                rowMapRef={rowMapRef}
                virtualRowIndex={virtualRowIndex}
                rowVirtualizer={rowVirtualizer}
                rowHeight={rowHeight}
                focusedCell={focusedCell}
                stretchColumns={stretchColumns}
              />
            );
          })}
        </div>
        {onRowAdd && (
          <div
            role="rowgroup"
            data-slot="grid-footer"
            ref={footerRef}
            className="sticky bottom-0 z-10 grid border-t bg-background"
          >
            <div
              role="row"
              aria-rowindex={rows.length + 2}
              data-slot="grid-add-row"
              tabIndex={-1}
              className="flex w-full"
            >
              <div
                role="gridcell"
                tabIndex={0}
                className="relative flex h-9 grow items-center bg-muted/30 transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                style={{
                  width: table.getTotalSize(),
                  minWidth: table.getTotalSize(),
                }}
                onClick={onRowAdd}
                onKeyDown={onAddRowKeyDown}
              >
                <div className="sticky start-0 flex items-center gap-2 px-3 text-muted-foreground">
                  <Plus className="size-3.5" />
                  <span className="text-sm">Add row</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
