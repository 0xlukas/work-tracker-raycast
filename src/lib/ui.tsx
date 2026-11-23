import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
  type Image,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WORKTRACKER_BUNDLE_ID } from "./config";
import { WorkTrackerError } from "./mcp";
import type { PaletteColor } from "./types";

const run = promisify(execFile);

/** Bring WorkTracker to the front (launching it if needed). */
export async function openWorkTracker() {
  try {
    await run("/usr/bin/open", ["-b", WORKTRACKER_BUNDLE_ID]);
  } catch {
    await showToast({ style: Toast.Style.Failure, title: "WorkTracker isn't installed" });
  }
}

/** Title and description for a failed call, written for the person using Raycast. */
export function describeError(error: unknown): { title: string; message: string } {
  if (error instanceof WorkTrackerError) {
    switch (error.kind) {
      case "off":
        return { title: "WorkTracker's assistant server is off", message: error.message };
      case "unreachable":
        return { title: "WorkTracker isn't answering", message: error.message };
      case "unauthorized":
        return { title: "WorkTracker refused the key", message: error.message };
      case "outdated":
        return { title: "Update WorkTracker", message: error.message };
      case "tool":
        return { title: "WorkTracker didn't do it", message: error.message };
      default:
        return { title: "Something went wrong", message: error.message };
    }
  }
  return { title: "Something went wrong", message: error instanceof Error ? error.message : String(error) };
}

/** A failure toast with the way out: open WorkTracker, or the extension's preferences. */
export async function showError(error: unknown, title?: string) {
  const description = describeError(error);
  const kind = error instanceof WorkTrackerError ? error.kind : undefined;
  const isConnection = kind !== undefined && kind !== "tool";
  return showToast({
    style: Toast.Style.Failure,
    title: title && !isConnection ? title : description.title,
    message: description.message,
    primaryAction: isConnection ? { title: "Open WorkTracker", onAction: () => openWorkTracker() } : undefined,
    secondaryAction:
      kind === "unauthorized" || kind === "server"
        ? { title: "Open Extension Preferences", onAction: () => openExtensionPreferences() }
        : undefined,
  });
}

/** Run a change with progress and result toasts. Returns the result, or undefined on failure. */
export async function perform<T>(
  progress: string,
  change: () => Promise<T>,
  success: (result: T) => Toast.Options,
): Promise<T | undefined> {
  const toast = await showToast({ style: Toast.Style.Animated, title: progress });
  try {
    const result = await change();
    Object.assign(toast, { style: Toast.Style.Success, message: undefined, ...success(result) });
    return result;
  } catch (error) {
    await toast.hide();
    await showError(error);
    return undefined;
  }
}

/**
 * Load something from WorkTracker; shows the last result at once and refreshes it.
 * `keepPreviousData` keeps showing the old result while new arguments load; turn it off
 * where the old result would be wrong under the new arguments (another day's entries).
 */
export function useWorkTracker<T, A extends unknown[]>(
  load: (...args: A) => Promise<T>,
  args: A,
  { keepPreviousData = true }: { keepPreviousData?: boolean } = {},
) {
  return useCachedPromise(load, args, {
    keepPreviousData,
    // The error is shown in the view (ErrorEmptyView), with what to do about it.
    onError: () => undefined,
  });
}

/** An empty list view explaining a failed load, with actions to fix it. */
export function ErrorEmptyView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { title, message } = describeError(error);
  const kind = error instanceof WorkTrackerError ? error.kind : undefined;
  return (
    <List.EmptyView
      icon={{ source: kind === "off" ? Icon.Plug : Icon.Warning, tintColor: Color.Orange }}
      title={title}
      description={message}
      actions={
        <ActionPanel>
          <Action title="Open WorkTracker" icon={Icon.AppWindow} onAction={openWorkTracker} />
          <Action
            title="Try Again"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={onRetry}
          />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}

/** Actions every view offers. */
export function CommonActions({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <ActionPanel.Section>
      {onRefresh && (
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={onRefresh}
        />
      )}
      <Action
        title="Open WorkTracker"
        icon={Icon.AppWindow}
        shortcut={Keyboard.Shortcut.Common.Open}
        onAction={openWorkTracker}
      />
    </ActionPanel.Section>
  );
}

const PALETTE: Record<PaletteColor, Color.ColorLike> = {
  blue: Color.Blue,
  green: Color.Green,
  orange: Color.Orange,
  purple: Color.Purple,
  pink: Color.Magenta,
  teal: { light: "#30B0C7", dark: "#40C8E0" },
  indigo: { light: "#5856D6", dark: "#5E5CE6" },
  red: Color.Red,
  mint: { light: "#00C7BE", dark: "#63E6E2" },
  cyan: { light: "#32ADE6", dark: "#64D2FF" },
};

/** A project's colour as WorkTracker shows it. */
export function projectIcon(
  color: PaletteColor | undefined,
  source: Image.Source = Icon.CircleFilled,
): Image.ImageLike {
  return { source, tintColor: color ? PALETTE[color] : Color.SecondaryText };
}

/** Green for overtime, orange for undertime, grey for none. */
export function balanceColor(balance: number): Color {
  const minutes = Math.round(balance * 60);
  return minutes > 0 ? Color.Green : minutes < 0 ? Color.Orange : Color.SecondaryText;
}
