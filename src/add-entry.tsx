import { Form, ActionPanel, Action, showToast, Toast, popToRoot, Icon } from "@raycast/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { getAllProjects, getSegmentsForDate } from "./lib/queries";
import { insertSegment } from "./lib/mutations";
import { startOfDayZurich } from "./lib/dates";
import { formatTimeOfDay, parseTimeInput } from "./lib/timeinput";
import { defaultStartFor, validateEntry } from "./lib/entry";
import { formatHours } from "./lib/calculator";
import type { Project, WorkSegment } from "./lib/types";

export default function AddEntry() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [date, setDate] = useState<Date>(() => startOfDayZurich(new Date()));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  // A ref, not state: the date effect reads it without re-running when times change.
  const timesEdited = useRef(false);
  const [daySegments, setDaySegments] = useState<WorkSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const allProjects = await getAllProjects();
        setProjects(allProjects);
        // Default to "Other" when it exists — projects themselves are only ever
        // created in the app's Projects screen.
        const other = allProjects.find((p) => p.name === "Other");
        setSelectedProject(String((other ?? allProjects[0])?.id ?? ""));
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to load projects", message: String(error) });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Load the selected day's segments (for the suggested start and overlap checks).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const segs = await getSegmentsForDate(date);
        if (cancelled) return;
        setDaySegments(segs);
        if (!timesEdited.current) {
          const suggested = defaultStartFor(date, segs);
          setStart(formatTimeOfDay(suggested));
          setEnd(formatTimeOfDay(new Date(suggested.getTime() + 3600000)));
        }
      } catch (error) {
        if (!cancelled) {
          showToast({ style: Toast.Style.Failure, title: "Failed to load the day's entries", message: String(error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const startTime = parseTimeInput(start, date);
  const endTime = parseTimeInput(end, date);

  const startError = submitted && !startTime ? "Enter a time like 0810 or 8:10." : undefined;
  const endError = submitted && !endTime ? "Enter a time like 1730 or 17:30." : undefined;

  const validationError = validateEntry({
    startTime,
    endTime,
    daySegments,
    hasProject: selectedProject !== "",
  });

  const durationHours =
    startTime && endTime && endTime.getTime() > startTime.getTime()
      ? (endTime.getTime() - startTime.getTime()) / 3600000
      : null;

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    if (validationError || !startTime || !endTime) {
      showToast({ style: Toast.Style.Failure, title: validationError ?? "Invalid entry" });
      return;
    }

    try {
      const projectId = parseInt(selectedProject, 10);
      insertSegment(date, startTime, endTime, projectId);

      const projectName = projects.find((p) => p.id === projectId)?.name ?? "";
      showToast({
        style: Toast.Style.Success,
        title: "Entry added",
        message: `${formatHours((endTime.getTime() - startTime.getTime()) / 3600000)}${projectName ? ` for ${projectName}` : ""}`,
      });
      popToRoot();
    } catch (error) {
      showToast({ style: Toast.Style.Failure, title: "Failed to add entry", message: String(error) });
    }
  }, [validationError, startTime, endTime, selectedProject, date, projects]);

  function onTimeChange(setter: (v: string) => void) {
    return (value: string) => {
      timesEdited.current = true;
      setter(value);
    };
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Add Work Entry"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Entry" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="start"
        title="Start"
        placeholder="0810"
        info="Type HHMM (0810), HMM (810), the hour alone (8), or with a separator (8:10)."
        value={start}
        error={startError}
        onChange={onTimeChange(setStart)}
      />
      <Form.TextField
        id="end"
        title="End"
        placeholder="0910"
        value={end}
        error={endError}
        onChange={onTimeChange(setEnd)}
      />

      <Form.Dropdown id="project" title="Project" value={selectedProject} onChange={setSelectedProject}>
        {projects.map((p) => (
          <Form.Dropdown.Item key={p.id} value={String(p.id)} title={p.name} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      {/* Date sits below the entry fields so quick time entry isn't blocked (cf. #3). */}
      <Form.DatePicker
        id="date"
        title="Date"
        type={Form.DatePicker.Type.Date}
        value={date}
        onChange={(newDate) => setDate(startOfDayZurich(newDate ?? new Date()))}
      />

      <Form.Description title="Duration" text={durationHours !== null ? formatHours(durationHours) : "—"} />
      {validationError && <Form.Description title="Not valid yet" text={validationError} />}
      {!isLoading && projects.length === 0 && (
        <Form.Description title="No projects" text="Create a project in the WorkTracker app's Projects screen first." />
      )}
    </Form>
  );
}
