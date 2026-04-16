/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `add-entry` command */
  export type AddEntry = ExtensionPreferences & {}
  /** Preferences accessible in the `view-today` command */
  export type ViewToday = ExtensionPreferences & {}
  /** Preferences accessible in the `menu-bar` command */
  export type MenuBar = ExtensionPreferences & {}
  /** Preferences accessible in the `daily-quote` command */
  export type DailyQuote = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `add-entry` command */
  export type AddEntry = {}
  /** Arguments passed to the `view-today` command */
  export type ViewToday = {}
  /** Arguments passed to the `menu-bar` command */
  export type MenuBar = {}
  /** Arguments passed to the `daily-quote` command */
  export type DailyQuote = {}
}

