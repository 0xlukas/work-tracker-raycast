import { Action, ActionPanel, Form, Icon, Toast, popToRoot, showHUD, showToast, useNavigation } from "@raycast/api";
import { useForm, usePromise } from "@raycast/utils";
import { useEffect } from "react";
import { addEntry, deleteEntries, listEntries, listProjects, updateEntry } from "../lib/api";
import {
  dayFromPicker,
  formatDay,
  formatHours,
  minutesOf,
  nowRounded,
  parseTimeInput,
  pickerDate,
  timeOf,
  zurichToday,
} from "../lib/format";
import { freeSlot } from "../lib/entries";
import type { Entry, Project } from "../lib/types";
import { CommonActions, perform, projectIcon, showError } from "../lib/ui";

interface Props {
  /** The entry to change; a new entry when left out. */
  entry?: Entry;
  /** Day for a new entry; today by default. */
  date?: string;
  /**
   * Called after saving (and after an Undo). Set when the form was pushed from a view that
   * stays open: then the form goes back to it and the toast offers Undo. Without it (the
   * Add Work Entry command), the window closes, so there's no Undo to offer.
   */
  onSaved?: () => void;
}

/** Add or edit a time entry. Loads the projects and the day's entries for sensible defaults. */
export function EntryForm({ entry, date, onSaved }: Props) {
  const day = entry?.date ?? date ?? zurichToday();
  // Not cached: the defaults depend on the day's current entries.
  const { data, isLoading, error, revalidate } = usePromise(
    async (day: string) => {
      const [projects, entries] = await Promise.all([listProjects(true), listEntries(day)]);
      return { projects, entries: entries.entries };
    },
    [day],
    { onError: () => undefined },
  );
  useEffect(() => {
    if (error) showError(error);
  }, [error]);

  if (!data) {
    return (
      <Form
        isLoading={isLoading}
        navigationTitle={entry ? "Edit Entry" : "Add Work Entry"}
        actions={
          <ActionPanel>
            <CommonActions onRefresh={revalidate} />
          </ActionPanel>
        }
      >
        {error && !isLoading && <Form.Description title="Can't load" text={error.message} />}
      </Form>
    );
  }
  return (
    <LoadedEntryForm entry={entry} day={day} projects={data.projects} dayEntries={data.entries} onSaved={onSaved} />
  );
}

interface Values {
  date: Date | null;
  start: string;
  end: string;
  project: string;
  note: string;
}

function LoadedEntryForm({
  entry,
  day,
  projects,
  dayEntries,
  onSaved,
}: {
  entry?: Entry;
  day: string;
  projects: Project[];
  dayEntries: Entry[];
  onSaved?: () => void;
}) {
  const { pop } = useNavigation();
  // Archived projects take no new entries; an edited entry may keep its archived project.
  const choices = projects.filter((project) => !project.archived || project.name === entry?.project);
  const defaults = entry ? undefined : newEntryDefaults(day, dayEntries, choices);

  const { handleSubmit, itemProps, values } = useForm<Values>({
    initialValues: {
      date: pickerDate(day),
      start: entry?.start ?? defaults?.start ?? "",
      end: entry?.end ?? defaults?.end ?? "",
      project: entry?.project ?? defaults?.project ?? "",
      note: entry?.note ?? "",
    },
    validation: {
      date: (value) => (value ? undefined : "Pick a day"),
      start: (value) => (value && parseTimeInput(value) ? undefined : "Use HH:MM, e.g. 08:30"),
      end: (value) => {
        const end = value ? parseTimeInput(value, true) : undefined;
        if (!end) return "Use HH:MM, e.g. 17:00 (24:00 for midnight)";
        return undefined;
      },
      project: (value) => (value ? undefined : "Pick a project"),
    },
    async onSubmit(values) {
      const start = parseTimeInput(values.start)!;
      const end = parseTimeInput(values.end, true)!;
      if (minutesOf(end) <= minutesOf(start)) {
        await showError(new Error("The end must be after the start."), "Can't save");
        return false;
      }
      const fields = {
        date: dayFromPicker(values.date!),
        start,
        end,
        project: values.project,
        note: values.note.trim(),
      };
      if (entry) {
        const saved = await perform(
          "Saving entry…",
          () => updateEntry(entry.id, fields),
          (after) => ({ title: "Entry updated", message: describe(after) }),
        );
        if (!saved) return false;
      } else if (onSaved) {
        const added = await perform(
          "Adding entry…",
          () => addEntry(fields),
          (added): Toast.Options => ({
            title: "Entry added",
            message: describe(added),
            primaryAction: {
              title: "Undo",
              shortcut: { modifiers: ["cmd"], key: "z" },
              onAction: async (toast) => {
                await toast.hide();
                await perform(
                  "Removing entry…",
                  () => deleteEntries([added.id]),
                  () => ({ title: "Entry removed" }),
                );
                onSaved();
              },
            },
          }),
        );
        if (!added) return false;
      } else {
        const toast = await showToast({ style: Toast.Style.Animated, title: "Adding entry…" });
        try {
          const added = await addEntry(fields);
          await showHUD(`Entry added · ${describe(added)}`);
          await popToRoot({ clearSearchBar: true });
        } catch (error) {
          await toast.hide();
          await showError(error);
          return false;
        }
        return;
      }
      if (onSaved) {
        onSaved();
        pop();
      } else {
        await popToRoot({ clearSearchBar: true });
      }
    },
  });

  const startTime = parseTimeInput(values.start);
  const endTime = parseTimeInput(values.end, true);
  const duration =
    startTime && endTime && minutesOf(endTime) > minutesOf(startTime)
      ? formatHours((minutesOf(endTime) - minutesOf(startTime)) / 60)
      : "–";

  return (
    <Form
      navigationTitle={entry ? "Edit Entry" : "Add Work Entry"}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={entry ? "Save Entry" : "Add Entry"} icon={Icon.Check} onSubmit={handleSubmit} />
          <CommonActions />
        </ActionPanel>
      }
    >
      <Form.DatePicker title="Day" type={Form.DatePicker.Type.Date} {...itemProps.date} />
      <Form.TextField title="Start" placeholder="08:30" info="HH:MM, or just 830 or 8" {...itemProps.start} />
      <Form.TextField title="End" placeholder="17:00" info="HH:MM; 24:00 for midnight" {...itemProps.end} />
      <Form.Description title="Duration" text={duration} />
      <Form.Dropdown title="Project" {...itemProps.project}>
        {choices.map((project) => (
          <Form.Dropdown.Item
            key={project.id}
            value={project.name}
            title={project.archived ? `${project.name} (archived)` : project.name}
            icon={projectIcon(project.color)}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Note" placeholder="Optional" {...itemProps.note} />
      {!entry && dayEntries.length > 0 && (
        <Form.Description
          title={`Already on ${formatDay(day, "short")}`}
          text={dayEntries.map((e) => `${e.start}–${e.end}  ${e.project ?? ""}`).join("\n")}
        />
      )}
    </Form>
  );
}

function describe(entry: Entry): string {
  return `${formatDay(entry.date, "short")}, ${entry.start}–${entry.end} · ${formatHours(entry.hours)} · ${entry.project ?? "No project"}`;
}

/**
 * A new entry starts where the day's last entry ends (or 08:00, or in the first free gap
 * when the day is taken up to midnight) and, today, ends now; it never runs into the next
 * entry. The project is the one worked on most recently, as WorkTracker's timer picks it.
 */
function newEntryDefaults(day: string, dayEntries: Entry[], projects: Project[], now = new Date()) {
  const { start, end } = freeSlot(
    dayEntries.map((entry) => [minutesOf(entry.start), minutesOf(entry.end)] as [number, number]),
    day === zurichToday(now) ? minutesOf(nowRounded(5, now)) : undefined,
  );
  const active = projects.filter((project) => !project.archived);
  const recent = [...active].sort(
    (a, b) => (b.last_worked ?? "").localeCompare(a.last_worked ?? "") || b.entries - a.entries,
  )[0];
  return { start: timeOf(start), end: timeOf(end), project: recent?.name ?? active[0]?.name ?? "" };
}
