import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  Keyboard,
  List,
  confirmAlert,
  showHUD,
  useNavigation,
} from "@raycast/api";
import { useForm } from "@raycast/utils";
import { discardTimer, getOverview, listProjects, startTimer, stopTimer } from "../lib/api";
import { formatDay, formatHours, nowRounded, parseTimeInput, relativeDay, zurichToday } from "../lib/format";
import type { Entry, Project } from "../lib/types";
import { CommonActions, ErrorEmptyView, perform, projectIcon, showError, useWorkTracker } from "../lib/ui";

async function load() {
  const [overview, projects] = await Promise.all([getOverview(), listProjects()]);
  // Most recently worked on first, like the projects WorkTracker suggests.
  projects.sort((a, b) => (b.last_worked ?? "").localeCompare(a.last_worked ?? "") || a.name.localeCompare(b.name));
  return { timer: overview.timer, projects };
}

function savedMessage(saved: Entry[], note?: string): string {
  if (saved.length === 0) return note ?? "Nothing to save";
  const hours = saved.reduce((sum, entry) => sum + entry.hours, 0);
  return `Saved ${formatHours(hours)}${saved.length > 1 ? ` in ${saved.length} entries` : ""}`;
}

/** Start WorkTracker's timer for a project, or stop it. */
export function TimerList() {
  const { data, isLoading, error, revalidate } = useWorkTracker(load, []);
  const timer = data?.timer;

  async function start(project: Project, at?: string) {
    try {
      const result = await startTimer(project.name, at);
      await showHUD(`⏱ ${result.message || `Timer started for ${project.name}`}`);
    } catch (error) {
      await showError(error);
    }
  }

  async function stop(at?: string) {
    try {
      const result = await stopTimer(at);
      await showHUD(`Timer stopped · ${savedMessage(result.saved, result.note)}`);
    } catch (error) {
      await showError(error);
    }
  }

  async function discard() {
    const confirmed = await confirmAlert({
      title: "Discard the timer?",
      message: "The time since it started isn't saved.",
      primaryAction: { title: "Discard", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    await perform(
      "Discarding timer…",
      () => discardTimer(),
      () => ({ title: "Timer discarded" }),
    );
    revalidate();
  }

  return (
    <List isLoading={isLoading} navigationTitle="Timer" searchBarPlaceholder="Start the timer for…">
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : (
        <>
          {timer?.running && (
            <List.Section title="Running">
              <List.Item
                icon={{ source: Icon.Stopwatch, tintColor: Color.Red }}
                title={timer.project ?? "No project"}
                subtitle={`since ${relativeStart(timer.started)}`}
                keywords={["stop", "running"]}
                accessories={[{ tag: { value: formatHours(timer.elapsed_hours), color: Color.Red } }]}
                actions={
                  <ActionPanel>
                    <Action title="Stop Timer" icon={Icon.Stop} onAction={() => stop()} />
                    <Action.Push
                      title="Stop at…"
                      icon={Icon.Clock}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      target={<TimeForm title="Stop Timer" onSubmit={(at) => stop(at)} />}
                    />
                    <Action
                      title="Discard Timer"
                      icon={Icon.XMarkCircle}
                      style={Action.Style.Destructive}
                      shortcut={Keyboard.Shortcut.Common.Remove}
                      onAction={discard}
                    />
                    <CommonActions onRefresh={revalidate} />
                  </ActionPanel>
                }
              />
            </List.Section>
          )}
          <List.Section title={timer?.running ? "Switch to" : "Start for"}>
            {data?.projects.map((project) => (
              <List.Item
                key={project.id}
                icon={projectIcon(project.color)}
                title={project.name}
                accessories={
                  project.timer_running
                    ? [{ tag: { value: "Running", color: Color.Red } }]
                    : project.last_worked
                      ? [{ text: relativeDay(project.last_worked), tooltip: "Last worked on" }]
                      : []
                }
                actions={
                  <ActionPanel>
                    <Action
                      title={timer?.running ? `Switch to ${project.name}` : "Start Timer"}
                      icon={Icon.Play}
                      onAction={() => start(project)}
                    />
                    <Action.Push
                      title="Start at…"
                      icon={Icon.Clock}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      target={
                        <TimeForm title={`Start Timer for ${project.name}`} onSubmit={(at) => start(project, at)} />
                      }
                    />
                    {timer?.running && <Action title="Stop Timer" icon={Icon.Stop} onAction={() => stop()} />}
                    <CommonActions onRefresh={revalidate} />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
          {data && data.projects.length === 0 && (
            <List.EmptyView icon={Icon.Folder} title="No projects yet" description="Create one in WorkTracker." />
          )}
        </>
      )}
    </List>
  );
}

function relativeStart(started: string): string {
  const day = started.slice(0, 10);
  const time = started.slice(11);
  return day === zurichToday() ? time : `${formatDay(day, "short")} ${time}`;
}

/** Ask for the time the timer started or stopped, when it wasn't now. */
function TimeForm({ title, onSubmit }: { title: string; onSubmit: (at: string) => Promise<void> }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ time: string }>({
    initialValues: { time: nowRounded(5) },
    validation: { time: (value) => (value && parseTimeInput(value) ? undefined : "Use HH:MM, e.g. 08:30") },
    async onSubmit(values) {
      await onSubmit(parseTimeInput(values.time)!);
      pop();
    },
  });
  return (
    <Form
      navigationTitle={title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={title} icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Time Today" placeholder="08:30" info="HH:MM today, in Zurich time" {...itemProps.time} />
    </Form>
  );
}
