/**
 * Single source of truth for the application version.
 *
 * The backup manifest used to hardcode its own literal (`"1.0.0"`), which meant
 * a release bump had to be applied in two places and silently drifted: the
 * installer would report 1.0.1 while every backup claimed it came from 1.0.0.
 * A restore checks `manifest.app`, not the version, so the drift was invisible
 * until an operator tried to reason about provenance.
 *
 * `package.json` is the authority (electron-builder and npm both read it), so
 * this module re-exports from it rather than keeping a second copy.
 */
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
