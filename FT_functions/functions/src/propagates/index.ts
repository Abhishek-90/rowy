import * as functions from "firebase-functions";
import { propagateChanges, removeCopiesOfDeleteDoc } from "./SourceFns";
import {
  addTargetRef,
  removeTargetRef,
  removeRefsOnTargetDelete,
} from "./TargetFns";
const propagateChangesOnTrigger = (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  triggerType: "delete" | "create" | "update"
) => {
  switch (triggerType) {
    case "update":
      return propagateChanges(change.after);
    case "delete":
      return removeCopiesOfDeleteDoc(change.before.ref);
    case "create":
    default:
      return new Promise(() => false);
  }
};

const updateLinks = (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  config: { fieldName: string; trackedFields: string[] }
) => {
  const beforeDocPaths = change.before.get(config.fieldName)
    ? change.before.get(config.fieldName).map((x) => x.docPath)
    : [];
  const afterDocPaths = change.after.get(config.fieldName)
    ? change.after.get(config.fieldName).map((x) => x.docPath)
    : [];
  console.log({
    before: change.before.get(config.fieldName),
    after: change.after.get(config.fieldName),
    fieldName: config.fieldName,
    afterDocPaths,
    beforeDocPaths,
  });
  const addedDocPaths = afterDocPaths.filter(
    (x) => !beforeDocPaths.includes(x)
  );
  const removedDocPaths = beforeDocPaths.filter(
    (x) => !afterDocPaths.includes(x)
  );
  if (addedDocPaths.length !== 0 || removedDocPaths.length !== 0) {
    const addPromises = addedDocPaths.map((docPath) =>
      addTargetRef(
        change.after.ref,
        docPath,
        config.fieldName,
        config.trackedFields
      )
    );
    const removePromises = removedDocPaths.map((docPath) =>
      removeTargetRef(change.after.ref, docPath, config.fieldName)
    );
    return Promise.all([...addPromises, ...removePromises]);
  } else {
    console.log(`no change in ${config.fieldName} docSelect field`);
    return new Promise(() => false);
  }
};
export default function propagate(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  config: { fieldName: string; trackedFields: string[] }[],
  triggerType: "delete" | "create" | "update"
) {
  const propagateChangesPromise = propagateChangesOnTrigger(
    change,
    triggerType
  );
  const promises = [propagateChangesPromise];
  if (triggerType === "delete") {
    const removeRefsPromise = removeRefsOnTargetDelete(change.before.ref);
    promises.push(removeRefsPromise);
  } else {
    config.forEach((c) => promises.push(updateLinks(change, c)));
  }
  return Promise.all(promises);
}
