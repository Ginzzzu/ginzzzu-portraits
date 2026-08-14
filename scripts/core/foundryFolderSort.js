export const FOUNDRY_FOLDER_SORT_MODE = "folder-foundry";

const ALPHABETICAL_SORTING = "a";
const MANUAL_SORTING = "m";

function getDocumentId(document) {
  return String(document?.id ?? document?._id ?? "");
}

function getFolderReferenceId(folderReference) {
  if (!folderReference) return "";
  if (typeof folderReference === "string") return folderReference;
  return getDocumentId(folderReference);
}

function compareNames(a, b, locale) {
  const byName = String(a?.name ?? "").localeCompare(
    String(b?.name ?? ""),
    locale || undefined,
    { sensitivity: "base" }
  );
  if (byName !== 0) return byName;
  return getDocumentId(a).localeCompare(getDocumentId(b));
}

function getNumericSort(document) {
  const value = Number(document?.sort);
  return Number.isFinite(value) ? value : 0;
}

function compareManualOrder(a, b, locale) {
  const bySort = getNumericSort(a) - getNumericSort(b);
  return bySort || compareNames(a, b, locale);
}

/**
 * Build a comparator that mirrors the Actor Directory folder rules:
 * top-level folders use manual order; child folders and Actors use the
 * sorting mode of their containing Folder.
 */
export function createFoundryActorDirectoryComparator(folders, { locale } = {}) {
  const actorFolders = Array.from(folders ?? []).filter(folder =>
    !folder?.type || String(folder.type).toLowerCase() === "actor"
  );
  const foldersById = new Map(
    actorFolders
      .map(folder => [getDocumentId(folder), folder])
      .filter(([id]) => !!id)
  );
  const folderChains = new Map();

  function resolveFolder(folderReference) {
    const id = getFolderReferenceId(folderReference);
    if (!id) return null;
    return foldersById.get(id) || (typeof folderReference === "object" ? folderReference : null);
  }

  function getFolderChain(folderReference) {
    const folder = resolveFolder(folderReference);
    const folderId = getDocumentId(folder);
    if (!folder || !folderId) return [];
    if (folderChains.has(folderId)) return folderChains.get(folderId);

    const reversed = [];
    const visited = new Set();
    let current = folder;
    while (current) {
      const currentId = getDocumentId(current);
      if (!currentId || visited.has(currentId)) break;
      visited.add(currentId);
      reversed.push(current);
      current = resolveFolder(current.folder ?? current._source?.folder);
    }

    const chain = reversed.reverse();
    folderChains.set(folderId, chain);
    return chain;
  }

  function compareFolderSiblings(a, b, parentFolder) {
    // Foundry always keeps top-level folders in manual order.
    const sorting = parentFolder?.sorting === ALPHABETICAL_SORTING
      ? ALPHABETICAL_SORTING
      : MANUAL_SORTING;
    return sorting === ALPHABETICAL_SORTING
      ? compareNames(a, b, locale)
      : compareManualOrder(a, b, locale);
  }

  function compareFolders(a, b) {
    const aId = getDocumentId(a);
    const bId = getDocumentId(b);
    if (aId === bId) return 0;

    const aChain = getFolderChain(a);
    const bChain = getFolderChain(b);
    const sharedLength = Math.min(aChain.length, bChain.length);
    let index = 0;
    while (index < sharedLength && getDocumentId(aChain[index]) === getDocumentId(bChain[index])) {
      index += 1;
    }

    // Keep a parent folder's direct Actors before groups from nested folders.
    if (index === sharedLength) return aChain.length - bChain.length;

    const parentFolder = index > 0 ? aChain[index - 1] : null;
    return compareFolderSiblings(aChain[index], bChain[index], parentFolder);
  }

  return (a, b) => {
    const aFolder = resolveFolder(a?.folder ?? a?._source?.folder);
    const bFolder = resolveFolder(b?.folder ?? b?._source?.folder);
    const aFolderId = getDocumentId(aFolder);
    const bFolderId = getDocumentId(bFolder);

    if (aFolderId !== bFolderId) {
      // Preserve the existing dock convention: unfiled Actors come first.
      if (!aFolderId) return -1;
      if (!bFolderId) return 1;
      return compareFolders(aFolder, bFolder);
    }

    const sorting = aFolder?.sorting === MANUAL_SORTING
      ? MANUAL_SORTING
      : (aFolder ? ALPHABETICAL_SORTING : MANUAL_SORTING);
    return sorting === MANUAL_SORTING
      ? compareManualOrder(a, b, locale)
      : compareNames(a, b, locale);
  };
}
