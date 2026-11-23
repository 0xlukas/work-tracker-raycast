// Stands in for @raycast/api when the tests run outside Raycast.
export function getPreferenceValues() {
  return {
    serverKey: process.env.WORKTRACKER_TEST_KEY ?? "",
    serverPort: process.env.WORKTRACKER_TEST_PORT ?? "",
  };
}
