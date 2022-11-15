import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useThrottledCallback } from "use-debounce";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  CellContext,
} from "@tanstack/react-table";
import {
  DragDropContext,
  DropResult,
  Droppable,
  Draggable,
} from "react-beautiful-dnd";
import { get } from "lodash-es";
import { ErrorBoundary } from "react-error-boundary";
import { DragVertical } from "@src/assets/icons";

import StyledTable from "./Styled/StyledTable";
import StyledRow from "./Styled/StyledRow";
import TableHeaderGroup from "./TableHeaderGroup";
import ColumnHeader from "./ColumnHeader";
import StyledResizer from "./Styled/StyledResizer";
import FinalColumnHeader from "./FinalColumn/FinalColumnHeader";
import FinalColumn from "./FinalColumn/FinalColumn";
import OutOfOrderIndicator from "./OutOfOrderIndicator";
import ContextMenu from "./ContextMenu";
import CellValidation from "./CellValidation";

import EmptyState from "@src/components/EmptyState";
import { InlineErrorFallback } from "@src/components/ErrorFallback";
// import BulkActions from "./BulkActions";

import {
  tableScope,
  tableSettingsAtom,
  tableSchemaAtom,
  tableColumnsOrderedAtom,
  tableRowsAtom,
  tableNextPageAtom,
  tablePageAtom,
  updateColumnAtom,
  updateFieldAtom,
  selectedCellAtom,
  contextMenuTargetAtom,
} from "@src/atoms/tableScope";

import { getFieldType, getFieldProp } from "@src/components/fields";
import { TableRow, ColumnConfig } from "@src/types/table";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { useSaveColumnSizing } from "./useSaveColumnSizing";
import useVirtualization from "./useVirtualization";

export const DEFAULT_ROW_HEIGHT = 41;
export const DEFAULT_COL_WIDTH = 150;
export const MIN_COL_WIDTH = 80;
export const TABLE_PADDING = 16;
export const OUT_OF_ORDER_MARGIN = 8;
export const DEBOUNCE_DELAY = 500;

declare module "@tanstack/table-core" {
  interface ColumnMeta<TData, TValue> extends ColumnConfig {}
}

const columnHelper = createColumnHelper<TableRow>();
const getRowId = (row: TableRow) => row._rowy_ref.path || row._rowy_ref.id;

export interface ITableProps {
  canAddColumns: boolean;
  canEditColumns: boolean;
  canEditCells: boolean;
  hiddenColumns?: string[];
  emptyState?: React.ReactNode;
}

export default function Table({
  canAddColumns,
  canEditColumns,
  canEditCells,
  hiddenColumns,
  emptyState,
}: ITableProps) {
  const [tableSchema] = useAtom(tableSchemaAtom, tableScope);
  const [tableColumnsOrdered] = useAtom(tableColumnsOrderedAtom, tableScope);
  const [tableRows] = useAtom(tableRowsAtom, tableScope);
  const [tableNextPage] = useAtom(tableNextPageAtom, tableScope);
  const [tablePage, setTablePage] = useAtom(tablePageAtom, tableScope);
  const [selectedCell, setSelectedCell] = useAtom(selectedCellAtom, tableScope);
  const setContextMenuTarget = useSetAtom(contextMenuTargetAtom, tableScope);
  const focusInsideCell = selectedCell?.focusInside ?? false;

  const updateColumn = useSetAtom(updateColumnAtom, tableScope);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Get column defs from table schema
  // Also add end column for admins
  const columns = useMemo(() => {
    const _columns = tableColumnsOrdered
      // Hide column for all users using table schema
      .filter((column) => !column.hidden)
      .map((columnConfig) =>
        columnHelper.accessor((row) => get(row, columnConfig.fieldName), {
          id: columnConfig.fieldName,
          meta: columnConfig,
          size: columnConfig.width,
          enableResizing: columnConfig.resizable !== false,
          minSize: MIN_COL_WIDTH,
          cell: getFieldProp("TableCell", getFieldType(columnConfig)),
        })
      );

    if (canAddColumns || canEditCells) {
      _columns.push(
        columnHelper.display({
          id: "_rowy_column_actions",
          cell: FinalColumn as any,
        })
      );
    }

    return _columns;
  }, [tableColumnsOrdered, canAddColumns, canEditCells]);

  // Get user’s hidden columns from props and memoize into a VisibilityState
  const columnVisibility = useMemo(() => {
    if (!Array.isArray(hiddenColumns)) return {};
    return hiddenColumns.reduce((a, c) => ({ ...a, [c]: false }), {});
  }, [hiddenColumns]);

  // Get frozen columns
  const columnPinning = useMemo(
    () => ({
      left: columns.filter((c) => c.meta?.fixed && c.id).map((c) => c.id!),
    }),
    [columns]
  );
  const lastFrozen: string | undefined =
    columnPinning.left[columnPinning.left.length - 1];

  // Call TanStack Table
  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    columnResizeMode: "onChange",
  });

  // Store local columnSizing state so we can save it to table schema
  // in `useSaveColumnSizing`. This could be generalized by storing the
  // entire table state.
  const [columnSizing, setColumnSizing] = useState(
    table.initialState.columnSizing
  );
  table.setOptions((prev) => ({
    ...prev,
    state: { ...prev.state, columnVisibility, columnPinning, columnSizing },
    onColumnSizingChange: setColumnSizing,
  }));

  const { rows } = table.getRowModel();
  const leafColumns = table.getVisibleLeafColumns();

  const { handleKeyDown } = useKeyboardNavigation({
    gridRef,
    tableRows,
    leafColumns,
  });
  const {
    virtualRows,
    virtualCols,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  } = useVirtualization(containerRef, leafColumns);
  useSaveColumnSizing(columnSizing, canEditColumns);

  const handleDropColumn = useCallback(
    (result: DropResult) => {
      if (result.destination?.index === undefined || !result.draggableId)
        return;

      console.log(result.draggableId, result.destination.index);

      updateColumn({
        key: result.draggableId,
        index: result.destination.index,
        config: {},
      });
    },
    [updateColumn]
  );

  const fetchMoreOnBottomReached = useThrottledCallback(
    (containerElement?: HTMLDivElement | null) => {
      if (!containerElement) return;

      const { scrollHeight, scrollTop, clientHeight } = containerElement;
      if (scrollHeight - scrollTop - clientHeight < 300) {
        setTablePage((p) => p + 1);
      }
    },
    DEBOUNCE_DELAY
  );
  // Check on mount and after fetch to see if the table is at the bottom
  // for large screen heights
  useEffect(() => {
    fetchMoreOnBottomReached(containerRef.current);
  }, [fetchMoreOnBottomReached, tablePage, tableNextPage.loading]);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      style={{ overflow: "auto", width: "100%", height: "100%" }}
    >
      <StyledTable
        ref={gridRef}
        role="grid"
        aria-readonly={!canEditCells}
        aria-colcount={columns.length}
        aria-rowcount={tableRows.length + 1}
        style={
          {
            width: table.getTotalSize(),
            userSelect: "none",
            "--row-height": `${tableSchema.rowHeight || DEFAULT_ROW_HEIGHT}px`,
          } as any
        }
        onKeyDown={handleKeyDown}
      >
        <div
          className="thead"
          role="rowgroup"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            padding: `0 ${TABLE_PADDING}px`,
          }}
        >
          <TableHeaderGroup
            headerGroups={table.getHeaderGroups()}
            handleDropColumn={handleDropColumn}
            canAddColumns={canAddColumns}
            canEditColumns={canEditColumns}
            lastFrozen={lastFrozen}
          />
        </div>

        <div className="tbody" role="rowgroup">
          {paddingTop > 0 && (
            <div role="presentation" style={{ height: `${paddingTop}px` }} />
          )}

          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const outOfOrder = row.original._rowy_outOfOrder;

            return (
              <StyledRow
                key={row.id}
                role="row"
                aria-rowindex={row.index + 2}
                style={{
                  height: "auto",
                  marginBottom: outOfOrder ? OUT_OF_ORDER_MARGIN : 0,
                }}
                data-out-of-order={outOfOrder || undefined}
              >
                {paddingLeft > 0 && (
                  <div
                    role="presentation"
                    style={{ width: `${paddingLeft}px` }}
                  />
                )}

                {outOfOrder && <OutOfOrderIndicator />}

                {virtualCols.map((virtualCell) => {
                  const cellIndex = virtualCell.index;
                  const cell = row.getVisibleCells()[cellIndex];

                  const isSelectedCell =
                    selectedCell?.path === row.original._rowy_ref.path &&
                    selectedCell?.columnKey === cell.column.id;

                  const fieldTypeGroup = getFieldProp(
                    "group",
                    cell.column.columnDef.meta?.type
                  );
                  const isReadOnlyCell =
                    fieldTypeGroup === "Auditing" ||
                    fieldTypeGroup === "Metadata";

                  return (
                    <CellValidation
                      key={cell.id}
                      row={row}
                      cell={cell}
                      index={cellIndex}
                      left={
                        cell.column.getIsPinned()
                          ? virtualCell.start - TABLE_PADDING
                          : undefined
                      }
                      isSelectedCell={isSelectedCell}
                      isReadOnlyCell={isReadOnlyCell}
                      canEditCells={canEditCells}
                      lastFrozen={lastFrozen}
                      rowHeight={tableSchema.rowHeight || DEFAULT_ROW_HEIGHT}
                    />
                  );
                })}

                {paddingRight > 0 && (
                  <div
                    role="presentation"
                    style={{ width: `${paddingRight}px` }}
                  />
                )}
              </StyledRow>
            );
          })}

          {paddingBottom > 0 && (
            <div role="presentation" style={{ height: `${paddingBottom}px` }} />
          )}

          {tableRows.length === 0 &&
            (emptyState ?? <EmptyState sx={{ py: 8 }} />)}
        </div>
      </StyledTable>

      <div
        id="rowy-table-editable-cell-description"
        style={{ display: "none" }}
      >
        Press Enter to edit.
      </div>

      <ContextMenu />
    </div>
  );
}
