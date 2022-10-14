import React, { useMemo, useState, Suspense } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useDebouncedCallback, useThrottledCallback } from "use-debounce";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { findIndex } from "lodash-es";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { TOP_BAR_HEIGHT } from "@src/layouts/Navigation/TopBar";
import { TABLE_TOOLBAR_HEIGHT } from "@src/components/TableToolbar";
import { StyledTable } from "./Styled/StyledTable";
import { StyledRow } from "./Styled/StyledRow";
import ColumnHeaderComponent from "./Column";

import { LinearProgress } from "@mui/material";

import TableContainer, { OUT_OF_ORDER_MARGIN } from "./TableContainer";
import ColumnHeader, { COLUMN_HEADER_HEIGHT } from "./ColumnHeader";
import FinalColumnHeader from "./FinalColumnHeader";
import FinalColumn from "./formatters/FinalColumn";
// import TableRow from "./TableRow";
import EmptyState from "@src/components/EmptyState";
// import BulkActions from "./BulkActions";
import AddRow from "@src/components/TableToolbar/AddRow";
import { AddRow as AddRowIcon } from "@src/assets/icons";
import Loading from "@src/components/Loading";
import ContextMenu from "./ContextMenu";

import {
  projectScope,
  userRolesAtom,
  userSettingsAtom,
} from "@src/atoms/projectScope";
import {
  tableScope,
  tableIdAtom,
  tableSettingsAtom,
  tableSchemaAtom,
  tableColumnsOrderedAtom,
  tableRowsAtom,
  tableNextPageAtom,
  tablePageAtom,
  updateColumnAtom,
  updateFieldAtom,
  selectedCellAtom,
} from "@src/atoms/tableScope";

import { getFieldType, getFieldProp } from "@src/components/fields";
import { FieldType } from "@src/constants/fields";
import { formatSubTableName } from "@src/utils/table";
import { TableRow, ColumnConfig } from "@src/types/table";
import { StyledCell } from "./Styled/StyledCell";

export const DEFAULT_ROW_HEIGHT = 41;
export const DEFAULT_COL_WIDTH = 150;
export const MAX_COL_WIDTH = 380;

declare module "@tanstack/table-core" {
  interface ColumnMeta<TData, TValue> extends ColumnConfig {}
}

const columnHelper = createColumnHelper<TableRow>();
const getRowId = (row: TableRow) => row._rowy_ref.path || row._rowy_ref.id;

export default function TableComponent() {
  const [userRoles] = useAtom(userRolesAtom, projectScope);
  const [userSettings] = useAtom(userSettingsAtom, projectScope);

  const [tableId] = useAtom(tableIdAtom, tableScope);
  const [tableSettings] = useAtom(tableSettingsAtom, tableScope);
  const [tableSchema] = useAtom(tableSchemaAtom, tableScope);
  const [tableColumnsOrdered] = useAtom(tableColumnsOrderedAtom, tableScope);
  const [tableRows] = useAtom(tableRowsAtom, tableScope);
  const [tableNextPage] = useAtom(tableNextPageAtom, tableScope);
  const setTablePage = useSetAtom(tablePageAtom, tableScope);
  const [selectedCell, setSelectedCell] = useAtom(selectedCellAtom, tableScope);

  const updateColumn = useSetAtom(updateColumnAtom, tableScope);
  const updateField = useSetAtom(updateFieldAtom, tableScope);

  const canAddColumn = userRoles.includes("ADMIN");
  const userDocHiddenFields =
    userSettings.tables?.[formatSubTableName(tableId)]?.hiddenFields;

  // Get column defs from table schema
  // Also add end column for admins
  const columns = useMemo(() => {
    const _columns = tableColumnsOrdered
      // .filter((column) => {
      //   if (column.hidden) return false;
      //   if (
      //     Array.isArray(userDocHiddenFields) &&
      //     userDocHiddenFields.includes(column.key)
      //   )
      //     return false;
      //   return true;
      // })
      .map((columnConfig) =>
        columnHelper.accessor(columnConfig.fieldName, {
          meta: columnConfig,
          // draggable: true,
          // resizable: true,
          // frozen: columnConfig.fixed,
          // headerRenderer: ColumnHeader,
          // formatter:
          //   getFieldProp("TableCell", getFieldType(columnConfig)) ??
          //   function InDev() {
          //     return null;
          //   },
          // editor:
          //   getFieldProp("TableEditor", getFieldType(columnConfig)) ??
          //   function InDev() {
          //     return null;
          //   },
          // ...columnConfig,
          // editable:
          //   tableSettings.readOnly && !userRoles.includes("ADMIN")
          //     ? false
          //     : columnConfig.editable ?? true,
          // width: columnConfig.width ?? DEFAULT_COL_WIDTH,
        })
      );

    // if (canAddColumn || !tableSettings.readOnly) {
    //   _columns.push({
    //     isNew: true,
    //     key: "new",
    //     fieldName: "_rowy_new",
    //     name: "Add column",
    //     type: FieldType.last,
    //     index: _columns.length ?? 0,
    //     width: 154,
    //     headerRenderer: FinalColumnHeader,
    //     headerCellClass: "final-column-header",
    //     cellClass: "final-column-cell",
    //     formatter: FinalColumn,
    //     editable: false,
    //   });
    // }

    return _columns;
  }, [
    tableColumnsOrdered,
    // userDocHiddenFields,
    // tableSettings.readOnly,
    // canAddColumn,
  ]);

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    columnResizeMode: "onChange",
    // debugRows: true,
  });
  console.log(table);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {};

  return (
    <>
      <StyledTable
        role="grid"
        style={{ width: table.getTotalSize(), userSelect: "none" }}
        onKeyDown={handleKeyDown}
      >
        <div className="thead" style={{ position: "sticky", top: 0 }}>
          {table.getHeaderGroups().map((headerGroup) => (
            <StyledRow key={headerGroup.id} role="row">
              {headerGroup.headers.map((header) => (
                <ColumnHeaderComponent
                  key={header.id}
                  label={header.column.columnDef.meta?.name || header.id}
                  type={header.column.columnDef.meta?.type}
                  style={{ width: header.getSize() }}
                >
                  {/* <div
                    {...{
                      onMouseDown: header.getResizeHandler(),
                      onTouchStart: header.getResizeHandler(),
                      className: `resizer ${
                        header.column.getIsResizing() ? "isResizing" : ""
                      }`,
                      // style: {
                      //   transform:
                      //     columnResizeMode === 'onEnd' &&
                      //     header.column.getIsResizing()
                      //       ? `translateX(${
                      //           table.getState().columnSizingInfo.deltaOffset
                      //         }px)`
                      //       : '',
                      // },
                    }}
                  /> */}
                </ColumnHeaderComponent>
              ))}
            </StyledRow>
          ))}
        </div>

        <div className="tbody">
          {table.getRowModel().rows.map((row) => (
            <StyledRow key={row.id} role="row">
              {row.getVisibleCells().map((cell) => (
                <StyledCell
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  <button>f</button>
                </StyledCell>
              ))}
            </StyledRow>
          ))}
        </div>
      </StyledTable>
    </>
  );
}
