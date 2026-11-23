// Stands in for @raycast/api when the tests run outside Raycast. No preferences are set:
// the live tests pass their connection explicitly (setExplicitConnection).
export function getPreferenceValues() {
  return { serverKey: "", serverPort: "" };
}
