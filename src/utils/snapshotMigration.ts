import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import { parseMediaAssetReference } from "@/models/MediaAsset";

export function removeLegacyAttachmentValues(
  snapshot: FamilyTreeSnapshot,
): FamilyTreeSnapshot {
  let changed = false;
  const people = snapshot.people.map((person) => {
    const mediaReferences =
      person.attachments?.filter((value) =>
        Boolean(parseMediaAssetReference(value)),
      ) ?? [];
    const attachments =
      mediaReferences.length > 0 ? mediaReferences : null;

    if (
      (attachments === null && person.attachments === null) ||
      (attachments !== null &&
        person.attachments !== null &&
        attachments.length === person.attachments.length)
    ) {
      return person;
    }

    changed = true;
    return {
      ...person,
      attachments,
    };
  });

  return changed ? { ...snapshot, people } : snapshot;
}
