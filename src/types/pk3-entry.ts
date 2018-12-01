
export interface Pk3Entry {
    // the name of the package file (e.g. "pak1-maps")
    pk3Name: string;
    // the name of the package file (e.g. "/games/openarena/baseoa/pak1-maps.pk3")
    pk3Path: string;
    // the path of the entry within the pk3 (e.g. "levelshots/oa_ctf1.tga")
    path: string;
}
