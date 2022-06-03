import { Suspense } from "react";
import { useAtom } from "jotai";
import { ErrorBoundary } from "react-error-boundary";

import { Stack, InputLabel, Typography, IconButton } from "@mui/material";
import { DocumentPath as DocumentPathIcon } from "@src/assets/icons";
import LaunchIcon from "@mui/icons-material/Launch";
import LockIcon from "@mui/icons-material/LockOutlined";

import { InlineErrorFallback } from "@src/components/ErrorFallback";
import FieldSkeleton from "./FieldSkeleton";

import { globalScope, projectIdAtom } from "@src/atoms/globalScope";
import { FieldType } from "@src/constants/fields";
import { getFieldProp } from "@src/components/fields";

export interface IFieldWrapperProps {
  children?: React.ReactNode;
  type: FieldType | "debug";
  name?: string;
  label?: React.ReactNode;
  debugText?: React.ReactNode;
  disabled?: boolean;
}

export default function FieldWrapper({
  children,
  type,
  name,
  label,
  debugText,
  disabled,
}: IFieldWrapperProps) {
  const [projectId] = useAtom(projectIdAtom, globalScope);

  return (
    <div>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          color: "text.primary",
          height: 24,
          scrollMarginTop: 24,
          "& svg": {
            display: "block",
            color: "action.active",
            fontSize: `${18 / 16}rem`,
          },
        }}
      >
        {type === "debug" ? <DocumentPathIcon /> : getFieldProp("icon", type)}
        <InputLabel
          id={`sidedrawer-label-${name}`}
          htmlFor={`sidedrawer-field-${name}`}
          sx={{ flexGrow: 1, lineHeight: "18px", ml: 0.75 }}
        >
          {label}
        </InputLabel>
        {disabled && <LockIcon />}
      </Stack>

      <ErrorBoundary FallbackComponent={InlineErrorFallback}>
        <Suspense fallback={<FieldSkeleton />}>
          {children ??
            (!debugText && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ paddingLeft: 18 / 8 + 0.75 }}
              >
                This field cannot be edited here.
              </Typography>
            ))}
        </Suspense>
      </ErrorBoundary>

      {debugText && (
        <Stack direction="row" alignItems="center">
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flexGrow: 1,
              paddingLeft: 18 / 8 + 0.75,

              fontFamily: "mono",
              whiteSpace: "normal",
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {debugText}
          </Typography>

          <IconButton
            href={`https://console.firebase.google.com/project/${projectId}/firestore/data/~2F${(
              debugText as string
            ).replace(/\//g, "~2F")}`}
            target="_blank"
            rel="noopener"
            aria-label="Open in Firebase Console"
            size="small"
            edge="end"
            sx={{ ml: 1 }}
          >
            <LaunchIcon />
          </IconButton>
        </Stack>
      )}
    </div>
  );
}
