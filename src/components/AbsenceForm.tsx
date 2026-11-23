import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { listAbsenceCategories, setAbsences } from "../lib/api";
import { dayCount, dayFromPicker, formatDay, pickerDate, zurichToday } from "../lib/format";
import { perform, showError, useWorkTracker } from "../lib/ui";

interface Values {
  from: Date | null;
  to: Date | null;
  category: string;
  halfDay: boolean;
}

/** Record an absence (vacation by default) on every working day of a range. */
export function AbsenceForm({ from, category, onSaved }: { from?: string; category?: string; onSaved?: () => void }) {
  const { pop } = useNavigation();
  const { data: categories, isLoading } = useWorkTracker(listAbsenceCategories, []);
  const start = from ?? zurichToday();
  const { handleSubmit, itemProps, values } = useForm<Values>({
    initialValues: { from: pickerDate(start), to: pickerDate(start), category: category ?? "vacation", halfDay: false },
    validation: {
      from: (value) => (value ? undefined : "Pick the first day"),
      to: (value) => (value ? undefined : "Pick the last day"),
    },
    async onSubmit(values) {
      const first = dayFromPicker(values.from!);
      const last = dayFromPicker(values.to!);
      if (last < first) {
        await showError(new Error("The last day is before the first."), "Can't record");
        return false;
      }
      const result = await perform(
        "Recording absence…",
        () => setAbsences(first, last, values.category, values.halfDay),
        (result) => ({
          title: `Recorded ${dayCount(result.days.length * (values.halfDay ? 0.5 : 1))}`,
          message: result.skipped?.length
            ? `Skipped ${result.skipped.map((s) => `${formatDay(s.date, "short")} (${s.reason})`).join(", ")}`
            : undefined,
        }),
      );
      if (!result) return false;
      onSaved?.();
      pop();
    },
  });
  const active = (categories ?? []).filter((c) => !c.archived);
  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Record Absence"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Record Absence" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown title="Category" {...itemProps.category}>
        {active.length === 0 && <Form.Dropdown.Item value="vacation" title="Vacation" />}
        {active.map((c) => (
          <Form.Dropdown.Item
            key={c.category_id ?? c.category}
            value={c.category_id ?? c.category}
            title={c.category_name ?? c.category}
          />
        ))}
      </Form.Dropdown>
      <Form.DatePicker title="From" type={Form.DatePicker.Type.Date} {...itemProps.from} />
      <Form.DatePicker title="To" type={Form.DatePicker.Type.Date} {...itemProps.to} />
      <Form.Checkbox label="Half days" {...itemProps.halfDay} />
      <Form.Description
        text={`Weekends, days without scheduled hours and full-day public holidays are skipped. An absence already on a day is replaced.${
          values.from && values.to && dayFromPicker(values.to) < dayFromPicker(values.from)
            ? "\n\nThe last day is before the first."
            : ""
        }`}
      />
    </Form>
  );
}
