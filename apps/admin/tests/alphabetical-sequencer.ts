import { BaseSequencer, type TestSpecification } from "vitest/node";
// The database tests share one database and some rely on what earlier files left behind, so run the files in a fixed (alphabetical) order, not failed-first.
export default class AlphabeticalSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) { return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)); }
}
