/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Assistant Key - Leave empty: the extension reads the key from WorkTracker. Only for another WorkTracker build (for example a test build); set Port too. */
  "serverKey"?: string,
  /** Port - Leave empty: the extension reads the port from WorkTracker (47615 by default). Only with Assistant Key, for another WorkTracker build. */
  "serverPort"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `view-today` command */
  export type ViewToday = ExtensionPreferences & {}
  /** Preferences accessible in the `add-entry` command */
  export type AddEntry = ExtensionPreferences & {}
  /** Preferences accessible in the `timer` command */
  export type Timer = ExtensionPreferences & {}
  /** Preferences accessible in the `balance` command */
  export type Balance = ExtensionPreferences & {}
  /** Preferences accessible in the `log-call` command */
  export type LogCall = ExtensionPreferences & {}
  /** Preferences accessible in the `vacation` command */
  export type Vacation = ExtensionPreferences & {}
  /** Preferences accessible in the `days-without-entries` command */
  export type DaysWithoutEntries = ExtensionPreferences & {}
  /** Preferences accessible in the `daily-quote` command */
  export type DailyQuote = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `view-today` command */
  export type ViewToday = {}
  /** Arguments passed to the `add-entry` command */
  export type AddEntry = {}
  /** Arguments passed to the `timer` command */
  export type Timer = {}
  /** Arguments passed to the `balance` command */
  export type Balance = {}
  /** Arguments passed to the `log-call` command */
  export type LogCall = {}
  /** Arguments passed to the `vacation` command */
  export type Vacation = {}
  /** Arguments passed to the `days-without-entries` command */
  export type DaysWithoutEntries = {}
  /** Arguments passed to the `daily-quote` command */
  export type DailyQuote = {}
}

