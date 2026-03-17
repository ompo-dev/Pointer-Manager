"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Header,
  type PaginationState,
  type Row,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  GripVerticalIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const inlineDetailsTransition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

interface DataTableProps<TData extends object, TValue = unknown> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  getRowId?: (row: TData, index: number) => UniqueIdentifier;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  emptyMessage?: string;
  enableSelection?: boolean;
  enableRowDrag?: boolean;
  enablePagination?: boolean;
  showColumnVisibilityToggle?: boolean;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onRowOrderChange?: (rows: TData[]) => void;
  onRowClick?: (row: TData) => void;
  isRowActive?: (row: TData) => boolean;
  expandedRowId?: UniqueIdentifier | null;
  renderInlineDetails?: (row: TData) => React.ReactNode;
  inlinePanel?: React.ReactNode;
  renderDetails?: (row: TData) => React.ReactNode;
  getDetailTitle?: (row: TData) => React.ReactNode;
  getDetailDescription?: (row: TData) => React.ReactNode;
  queryStateScope?: string;
  className?: string;
}

function humanizeColumnKey(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getColumnVisibilityLabel(column: {
  id: string;
  columnDef: {
    header?: unknown;
    accessorKey?: unknown;
    meta?: unknown;
  };
}) {
  const explicitLabel =
    typeof column.columnDef.meta === "object" &&
    column.columnDef.meta !== null &&
    "columnLabel" in column.columnDef.meta &&
    typeof (column.columnDef.meta as { columnLabel?: unknown }).columnLabel ===
      "string"
      ? (column.columnDef.meta as { columnLabel: string }).columnLabel
      : null;

  if (explicitLabel) {
    return explicitLabel;
  }

  if (typeof column.columnDef.header === "string") {
    return column.columnDef.header;
  }

  if (typeof column.columnDef.accessorKey === "string") {
    return humanizeColumnKey(column.columnDef.accessorKey);
  }

  return humanizeColumnKey(column.id);
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='button'], [role='checkbox'], [data-no-row-click='true']",
    ),
  );
}

function serializeSortingState(sorting: SortingState) {
  return sorting
    .map(({ id, desc }) => `${encodeURIComponent(id)}:${desc ? "desc" : "asc"}`)
    .join(",");
}

function deserializeSortingState(value: string) {
  if (!value) {
    return [] satisfies SortingState;
  }

  return value
    .split(",")
    .map((item) => {
      const [rawId, rawDirection] = item.split(":");

      if (!rawId) {
        return null;
      }

      return {
        id: decodeURIComponent(rawId),
        desc: rawDirection === "desc",
      };
    })
    .filter((item): item is SortingState[number] => item !== null);
}

function sortingStateEquals(left: SortingState, right: SortingState) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (item, index) =>
      item.id === right[index]?.id && item.desc === right[index]?.desc,
  );
}

function DragHandle({ id }: { id: UniqueIdentifier }) {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
      data-no-row-click="true"
    >
      <GripVerticalIcon className="size-3.5" />
      <span className="sr-only">Reordenar linha</span>
    </Button>
  );
}

function SortableTableRow<TData extends object>({
  row,
  onRowClick,
  isRowActive,
}: {
  row: Row<TData>;
  onRowClick?: (row: TData) => void;
  isRowActive?: (row: TData) => boolean;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.id,
  });

  return (
    <TableRow
      ref={setNodeRef}
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      className={cn(
        "relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80",
        isRowActive?.(row.original) ? "bg-muted/70" : undefined,
        onRowClick ? "cursor-pointer" : undefined,
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={(event) => {
        if (!onRowClick || isInteractiveElement(event.target)) {
          return;
        }

        onRowClick(row.original);
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function StaticTableRow<TData extends object>({
  row,
  onRowClick,
  isRowActive,
}: {
  row: Row<TData>;
  onRowClick?: (row: TData) => void;
  isRowActive?: (row: TData) => boolean;
}) {
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      className={cn(
        isRowActive?.(row.original) ? "bg-muted/70" : undefined,
        onRowClick ? "cursor-pointer" : undefined,
      )}
      onClick={(event) => {
        if (!onRowClick || isInteractiveElement(event.target)) {
          return;
        }

        onRowClick(row.original);
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function SortableTableHeader<TData extends object, TValue>({
  header,
}: {
  header: Header<TData, TValue>;
}) {
  const sortDirection = header.column.getIsSorted();
  const columnLabel = getColumnVisibilityLabel(header.column);
  const currentStateLabel =
    sortDirection === "asc"
      ? "Ordenacao crescente"
      : sortDirection === "desc"
        ? "Ordenacao decrescente"
        : "Sem ordenacao";
  const nextStateLabel =
    sortDirection === "asc"
      ? "ordem decrescente"
      : sortDirection === "desc"
        ? "remover a ordenacao"
        : "ordem crescente";

  function handleSortingToggle() {
    if (sortDirection === "asc") {
      header.column.toggleSorting(true, true);
      return;
    }

    if (sortDirection === "desc") {
      header.column.clearSorting();
      return;
    }

    header.column.toggleSorting(false, true);
  }

  const SortIcon =
    sortDirection === "asc"
      ? ArrowUpIcon
      : sortDirection === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon;

  return (
    <div className="inline-flex w-full items-center gap-2 px-1 py-1">
      <span className="min-w-0 flex-1">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      <button
        type="button"
        aria-label={`Ordenar por ${columnLabel}`}
        aria-pressed={sortDirection !== false}
        title={`${columnLabel}: ${currentStateLabel}. Clique para aplicar ${nextStateLabel}.`}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sortDirection === "asc"
            ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-700"
            : sortDirection === "desc"
              ? "border-red-600/30 bg-red-500/15 text-red-700"
              : "border-border/60 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/60",
        )}
        onClick={(event) => {
          event.stopPropagation();
          handleSortingToggle();
        }}
      >
        <SortIcon className="size-3.5" />
      </button>
    </div>
  );
}

function DataTableDetails<TData extends object>({
  row,
  open,
  onOpenChange,
  renderDetails,
  getDetailTitle,
  getDetailDescription,
}: {
  row: TData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderDetails?: (row: TData) => React.ReactNode;
  getDetailTitle?: (row: TData) => React.ReactNode;
  getDetailDescription?: (row: TData) => React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (!row || !renderDetails) {
    return null;
  }

  const title = getDetailTitle?.(row);
  const description = getDetailDescription?.(row);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent>
          {title || description ? (
            <DrawerHeader>
              {title ? <DrawerTitle>{title}</DrawerTitle> : null}
              {description ? (
                <DrawerDescription>{description}</DrawerDescription>
              ) : null}
            </DrawerHeader>
          ) : null}
          <div className="max-h-[75vh] overflow-y-auto px-4 pb-4">
            {renderDetails(row)}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl gap-0">
        {title || description ? (
          <SheetHeader>
            {title ? <SheetTitle>{title}</SheetTitle> : null}
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {renderDetails(row)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InlineDetailsRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={colSpan} className="p-0">
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={inlineDetailsTransition}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={inlineDetailsTransition}
          >
            {children}
          </motion.div>
        </motion.div>
      </TableCell>
    </TableRow>
  );
}

export function DataTable<TData extends object, TValue = unknown>({
  data,
  columns,
  getRowId,
  toolbar,
  actions,
  emptyMessage = "Nenhum resultado encontrado.",
  enableSelection = false,
  enableRowDrag = false,
  enablePagination = true,
  showColumnVisibilityToggle = true,
  initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onRowOrderChange,
  onRowClick,
  isRowActive,
  expandedRowId,
  renderInlineDetails,
  inlinePanel,
  renderDetails,
  getDetailTitle,
  getDetailDescription,
  queryStateScope,
  className,
}: DataTableProps<TData, TValue>) {
  const sortingQueryKey = queryStateScope ? `${queryStateScope}Sort` : "_tableSort";
  const [sortingQueryParam, setSortingQueryParam] = useQueryState(
    sortingQueryKey,
    parseAsString.withDefault(""),
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>(() =>
    queryStateScope ? deserializeSortingState(sortingQueryParam) : [],
  );
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [orderedData, setOrderedData] = React.useState(data);
  const [detailRow, setDetailRow] = React.useState<TData | null>(null);
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  React.useEffect(() => {
    setOrderedData(data);
  }, [data]);

  React.useEffect(() => {
    if (!queryStateScope) {
      return;
    }

    const nextSorting = deserializeSortingState(sortingQueryParam);
    setSorting((current) =>
      sortingStateEquals(current, nextSorting) ? current : nextSorting,
    );
  }, [queryStateScope, sortingQueryParam]);

  React.useEffect(() => {
    setPagination((current) =>
      current.pageSize === initialPageSize
        ? current
        : {
            ...current,
            pageSize: initialPageSize,
          },
    );
  }, [initialPageSize]);

  const resolveRowId = React.useCallback(
    (row: TData, index: number) => String(getRowId?.(row, index) ?? index),
    [getRowId],
  );

  const tableData = enableRowDrag ? orderedData : data;

  const enhancedColumns = React.useMemo(() => {
    const nextColumns = [...columns] as ColumnDef<TData, TValue>[];

    if (enableSelection) {
      nextColumns.unshift({
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Selecionar todas as linhas"
              data-no-row-click="true"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Selecionar linha"
              data-no-row-click="true"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData, TValue>);
    }

    if (enableRowDrag) {
      nextColumns.unshift({
        id: "drag",
        header: "",
        cell: ({ row }) => <DragHandle id={row.id} />,
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData, TValue>);
    }

    return nextColumns;
  }, [columns, enableRowDrag, enableSelection]);

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => tableData.map((row, index) => resolveRowId(row, index)),
    [resolveRowId, tableData],
  );

  const handleSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      setSorting((current) => {
        const nextSorting = functionalUpdate(updater, current);

        if (queryStateScope) {
          void setSortingQueryParam(
            nextSorting.length > 0 ? serializeSortingState(nextSorting) : null,
          );
        }

        return nextSorting;
      });
    },
    [queryStateScope, setSortingQueryParam],
  );

  const table = useReactTable({
    data: tableData,
    columns: enhancedColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row, index) => resolveRowId(row, index),
    enableRowSelection: enableSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    isMultiSortEvent: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
  });

  const visibleColumns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== "undefined" && column.getCanHide(),
    );
  const pageSizeComboboxOptions = pageSizeOptions.map((pageSize) => ({
    value: `${pageSize}`,
    label: `${pageSize}`,
  }));
  const expandedRowKey =
    expandedRowId !== null && expandedRowId !== undefined
      ? String(expandedRowId)
      : null;

  const handleRowActivate = React.useCallback(
    (row: TData) => {
      onRowClick?.(row);

      if (renderDetails && !renderInlineDetails) {
        setDetailRow(row);
      }
    },
    [onRowClick, renderDetails, renderInlineDetails],
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!enableRowDrag) {
      return;
    }

    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    setOrderedData((currentData) => {
      const currentIds = currentData.map((row, index) =>
        resolveRowId(row, index),
      );
      const oldIndex = currentIds.indexOf(String(active.id));
      const newIndex = currentIds.indexOf(String(over.id));

      if (oldIndex < 0 || newIndex < 0) {
        return currentData;
      }

      const nextData = arrayMove(currentData, oldIndex, newIndex);
      onRowOrderChange?.(nextData);
      return nextData;
    });
  }

  const rows = enablePagination
    ? table.getRowModel().rows
    : table.getPrePaginationRowModel().rows;

  return (
    <div className={cn("space-y-4", className)}>
      {toolbar ||
      actions ||
      (showColumnVisibilityToggle && visibleColumns.length > 0) ? (
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {showColumnVisibilityToggle && visibleColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="lg">
                    <Columns3Icon className="size-4" />
                    <span className="hidden sm:inline">Colunas</span>
                    <ChevronDownIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {visibleColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {getColumnVisibilityLabel(column)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {actions}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        <DndContext
          id={sortableId}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <SortableTableHeader header={header} />
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:align-top">
              <AnimatePresence initial={false}>
                {inlinePanel ? (
                  <InlineDetailsRow
                    key="inline-panel"
                    colSpan={enhancedColumns.length}
                  >
                    {inlinePanel}
                  </InlineDetailsRow>
                ) : null}
              </AnimatePresence>
              {rows.length ? (
                enableRowDrag ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <SortableTableRow
                          row={row}
                          onRowClick={
                            onRowClick || renderDetails || renderInlineDetails
                              ? handleRowActivate
                              : undefined
                          }
                          isRowActive={isRowActive}
                        />
                        <AnimatePresence initial={false}>
                          {renderInlineDetails && expandedRowKey === row.id ? (
                            <InlineDetailsRow
                              key={`${row.id}-details`}
                              colSpan={enhancedColumns.length}
                            >
                              {renderInlineDetails(row.original)}
                            </InlineDetailsRow>
                          ) : null}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                  </SortableContext>
                ) : (
                  rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <StaticTableRow
                        row={row}
                        onRowClick={
                          onRowClick || renderDetails || renderInlineDetails
                            ? handleRowActivate
                            : undefined
                        }
                        isRowActive={isRowActive}
                      />
                      <AnimatePresence initial={false}>
                        {renderInlineDetails && expandedRowKey === row.id ? (
                          <InlineDetailsRow
                            key={`${row.id}-details`}
                            colSpan={enhancedColumns.length}
                          >
                            {renderInlineDetails(row.original)}
                          </InlineDetailsRow>
                        ) : null}
                      </AnimatePresence>
                    </React.Fragment>
                  ))
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={enhancedColumns.length}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {enablePagination ? (
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {enableSelection
              ? `${table.getFilteredSelectedRowModel().rows.length} de ${table.getFilteredRowModel().rows.length} linha(s) selecionadas.`
              : `${table.getRowModel().rows.length} linha(s)`}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Linhas por pagina
              </Label>
              <div className="w-20">
                <SearchableCombobox
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                  options={pageSizeComboboxOptions}
                  placeholder={`${table.getState().pagination.pageSize}`}
                  searchPlaceholder="Linhas..."
                  emptyMessage="Nenhum tamanho."
                  className="h-9 rounded-md px-3"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium">
              <span>
                Pagina {table.getState().pagination.pageIndex + 1} de{" "}
                {table.getPageCount() || 1}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Primeira pagina</span>
                <ChevronsLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Pagina anterior</span>
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Proxima pagina</span>
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Ultima pagina</span>
                <ChevronsRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DataTableDetails
        row={detailRow}
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRow(null);
          }
        }}
        renderDetails={renderDetails}
        getDetailTitle={getDetailTitle}
        getDetailDescription={getDetailDescription}
      />
    </div>
  );
}
