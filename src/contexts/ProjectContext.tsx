import React, { useState, useContext, useEffect, useRef, useMemo } from "react";
import { useSnackbar } from "notistack";
import { DataGridHandle } from "react-data-grid";
import _sortBy from "lodash/sortBy";
import _find from "lodash/find";
import firebase from "firebase/app";

import useTable, { TableActions, TableState } from "@src/hooks/useTable";
import useSettings from "hooks/useSettings";
import { useAppContext } from "./AppContext";
import { SideDrawerRef } from "components/SideDrawer";
import { ColumnMenuRef } from "components/Table/ColumnMenu";
import { ImportWizardRef } from "components/Wizards/ImportWizard";

import { rowyRun, IRowyRunRequestProps } from "utils/rowyRun";
import { FieldType } from "constants/fields";
import { rowyUser } from "utils/fns";

export type Table = {
  id: string;
  collection: string;
  name: string;
  roles: string[];
  description: string;
  section: string;
  tableType: "primaryCollection" | "collectionGroup";
};

interface IProjectContext {
  tables: Table[];
  roles: string[];
  tableState: TableState;
  tableActions: TableActions;
  addRow: (data?: Record<string, any>, ignoreRequiredFields?: boolean) => void;
  updateCell: (
    ref: firebase.firestore.DocumentReference,
    fieldName: string,
    value: any,
    onSuccess?: (
      ref: firebase.firestore.DocumentReference,
      fieldName: string,
      value: any
    ) => void
  ) => void;
  settingsActions: {
    createTable: (data: {
      id: string;
      collection: string;
      name: string;
      description: string;
      roles: string[];
      section: string;
    }) => void;
    updateTable: (data: {
      id: string;
      collection: string;
      name: string;
      description: string;
      roles: string[];
      section: string;
    }) => Promise<any>;
    deleteTable: (id: string) => void;
  };

  // A ref to the data grid. Contains data grid functions
  dataGridRef: React.RefObject<DataGridHandle>;
  // A ref to the side drawer state. Prevents unnecessary re-renders
  sideDrawerRef: React.MutableRefObject<SideDrawerRef | undefined>;
  // A ref to the column menu. Prevents unnecessary re-renders
  columnMenuRef: React.MutableRefObject<ColumnMenuRef | undefined>;
  // A ref ot the import wizard. Prevents unnecessary re-renders
  importWizardRef: React.MutableRefObject<ImportWizardRef | undefined>;

  rowyRun: (
    args: Omit<IRowyRunRequestProps, "rowyRunUrl" | "authToken">
  ) => Promise<any>;
}

const ProjectContext = React.createContext<Partial<IProjectContext>>({});
export default ProjectContext;

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectContextProvider: React.FC = ({ children }) => {
  const { currentUser, userRoles, getAuthToken } = useAppContext();

  const { enqueueSnackbar } = useSnackbar();
  const { tableState, tableActions } = useTable();
  const [tables, setTables] = useState<IProjectContext["tables"]>();
  const [settings, settingsActions] = useSettings();

  useEffect(() => {
    const { tables } = settings;
    if (tables && userRoles) {
      const filteredTables = _sortBy(tables, "name")
        .filter(
          (table) =>
            userRoles.includes("ADMIN") ||
            table.roles.some((role) => userRoles.includes(role))
        )
        .map((table) => ({
          ...table,
          section: table.section ? table.section.trim() : "Other",
        }));

      setTables(
        filteredTables.map((table) => ({
          ...table,
          id: table.id || table.collection, // Ensure id exists
        }))
      );
    } else if (!settings.loading) {
      setTables([]);
    }
  }, [settings, userRoles]);

  const roles = useMemo(
    () =>
      Array.isArray(tables)
        ? Array.from(
            new Set(tables.reduce((a, c) => [...a, ...c.roles], ["ADMIN"]))
          )
        : [],
    [tables]
  );

  const addRow: IProjectContext["addRow"] = (data, ignoreRequiredFields) => {
    const valuesFromFilter = tableState.filters.reduce((acc, curr) => {
      if (curr.operator === "==") {
        return { ...acc, [curr.key]: curr.value };
      } else {
        return acc;
      }
    }, {});
    const initialData = Object.values(tableState.columns).reduce(
      (acc, column) => {
        if (column.config?.defaultValue?.type === "static") {
          return { ...acc, [column.key]: column.config.defaultValue.value };
        } else if (column.config?.defaultValue?.type === "null") {
          return { ...acc, [column.key]: null };
        } else {
          return acc;
        }
      },
      {}
    );

    const requiredFields = Object.values(tableState.columns)
      .filter((column) => column.config.required)
      .map((column) => column.key);

    const createdByColumn = _find(tableState.columns, [
      "type",
      FieldType.createdBy,
    ]);
    if (createdByColumn)
      initialData[createdByColumn.key] = rowyUser(currentUser!);

    const updatedByColumn = _find(tableState.columns, [
      "type",
      FieldType.updatedBy,
    ]);
    if (updatedByColumn)
      initialData[updatedByColumn.key] = rowyUser(currentUser!);

    tableActions.row.add(
      { ...valuesFromFilter, ...initialData, ...data },
      ignoreRequiredFields ? [] : requiredFields
    );
  };

  const updateCell: IProjectContext["updateCell"] = (
    ref,
    fieldName,
    value,
    onSuccess
  ) => {
    if (value === undefined) return;

    const update = { [fieldName]: value };

    const updatedByColumn = _find(tableState.columns, [
      "type",
      FieldType.updatedBy,
    ]);
    if (updatedByColumn)
      update[updatedByColumn.key] = rowyUser(currentUser!, {
        updatedField: fieldName,
      });

    tableActions.row.update(
      ref,
      update,
      () => {
        if (onSuccess) onSuccess(ref, fieldName, value);
      },
      (error) => {
        if (error.code === "permission-denied") {
          enqueueSnackbar(
            `You do not have the permissions to make this change.`,
            {
              variant: "error",
              anchorOrigin: { horizontal: "center", vertical: "top" },
            }
          );
        }
      }
    );
  };
  // rowyRun access
  const _rowyRun: IProjectContext["rowyRun"] = async (args) => {
    const authToken = await getAuthToken();
    return rowyRun({ rowyRunUrl: settings.doc.rowyRunUrl, authToken, ...args });
  };

  // A ref to the data grid. Contains data grid functions
  const dataGridRef = useRef<DataGridHandle>(null);
  const sideDrawerRef = useRef<SideDrawerRef>();
  const columnMenuRef = useRef<ColumnMenuRef>();
  const importWizardRef = useRef<ImportWizardRef>();

  return (
    <ProjectContext.Provider
      value={{
        tableState,
        tableActions,
        addRow,
        updateCell,
        settingsActions,
        roles,
        tables,
        dataGridRef,
        sideDrawerRef,
        columnMenuRef,
        importWizardRef,
        rowyRun: _rowyRun,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
