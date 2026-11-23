import { Alert, confirmAlert, type Toast } from "@raycast/api";
import { listAbsences, removeAbsences, setAbsences } from "./api";
import { describeSkipped, nameOf, replacedAbsences } from "./absence-rules";
import { dayCount, formatDay } from "./format";
import type { Absence } from "./types";
import { perform, showError } from "./ui";

interface Request {
  from: string;
  to: string;
  /** A built-in key (vacation, sick, …) or a custom category's id, as list_absence_categories gives them. */
  category: string;
  categoryName: string;
  halfDay: boolean;
  /** Called after the absences were recorded, and again after an Undo. */
  onChange?: () => void;
}

/**
 * Record absences on every working day of a range, as set_absences does. That replaces
 * whatever absence is on a day already, so ask first when it would. Undo is offered only
 * when the range had no absences before, since remove_absences clears the whole range.
 */
export async function recordAbsences(request: Request): Promise<boolean> {
  const { from, to, category, categoryName, halfDay, onChange } = request;
  let existing: Absence[];
  try {
    existing = await listAbsences(from, to);
  } catch (error) {
    await showError(error);
    return false;
  }

  const replaced = replacedAbsences(existing, category, halfDay);
  if (replaced.length > 0) {
    const newName = `${categoryName}${halfDay ? " (half day)" : ""}`;
    const lines = replaced.map(
      (absence) =>
        `${formatDay(absence.date, "short")}: ${nameOf(absence)}${absence.half_day ? " (half day)" : ""} → ${newName}`,
    );
    const confirmed = await confirmAlert({
      title: `Replace ${replaced.length === 1 ? "an absence" : `${replaced.length} absences`}?`,
      message: `${lines.slice(0, 12).join("\n")}${lines.length > 12 ? `\n… and ${lines.length - 12} more` : ""}\n\nThis syncs to your other Macs.`,
      primaryAction: { title: "Replace", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return false;
  }

  const result = await perform(
    "Recording absence…",
    () => setAbsences(from, to, category, halfDay),
    (result): Toast.Options => ({
      title: `Recorded ${dayCount(result.days.length * (halfDay ? 0.5 : 1))} of ${categoryName}`,
      message: describeSkipped(result.skipped),
      primaryAction:
        existing.length === 0
          ? {
              title: "Undo",
              shortcut: { modifiers: ["cmd"], key: "z" },
              onAction: async (toast) => {
                await toast.hide();
                await perform(
                  "Removing absence…",
                  () => removeAbsences(from, to),
                  () => ({ title: "Absence removed" }),
                );
                onChange?.();
              },
            }
          : undefined,
    }),
  );
  if (!result) return false;
  onChange?.();
  return true;
}
