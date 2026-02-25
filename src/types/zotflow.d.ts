/** Subset of Obsidian's `TFile` without the `parent` and `vault` properties. */
export interface TFileWithoutParentAndVault {
    path: string;
    name: string;
    extension: string;
    basename: string;
}
