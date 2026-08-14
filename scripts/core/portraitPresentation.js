import {
  MODULE_ID,
  FLAG_CUSTOM_EMOTIONS,
  FLAG_DISPLAY_NAME,
  FLAG_PORTRAIT_CUSTOM_IMAGE,
  FLAG_PORTRAIT_EMOTION
} from "./constants.js";

const FALLBACK_IMAGE_PATHS = Object.freeze([
  "img",
  "prototypeToken.texture.src",
  "texture.src"
]);

let actorImagePathsCache = null;

function parseActorImagePaths(value) {
  return String(value ?? "")
    .split(",")
    .map(path => path.trim())
    .filter(Boolean);
}

export function getActorPortraitImagePaths() {
  if (actorImagePathsCache) return actorImagePathsCache;

  let configuredPaths = [];
  try {
    configuredPaths = parseActorImagePaths(game.settings.get(MODULE_ID, "actorImagePaths"));
  } catch (_) {}

  actorImagePathsCache = Object.freeze([...new Set([...configuredPaths, ...FALLBACK_IMAGE_PATHS])]);
  return actorImagePathsCache;
}

export function actorUpdateTouchesPortraitBaseImage(changes) {
  if (!changes || typeof changes !== "object") return false;

  return getActorPortraitImagePaths().some(path =>
    Object.prototype.hasOwnProperty.call(changes, path) ||
    foundry.utils.hasProperty(changes, path)
  );
}

export function getActorBasePortraitImage(actor) {
  if (!actor) return "";

  for (const path of getActorPortraitImagePaths()) {
    try {
      const value = foundry.utils.getProperty(actor, path);
      if (typeof value === "string" && value.trim()) return value.trim();
    } catch (_) {}
  }

  return "";
}

export function getActorPortraitImage(actor) {
  if (!actor) return "";

  const baseImage = getActorBasePortraitImage(actor);
  const customPortraitImage = foundry.utils.getProperty(actor, FLAG_PORTRAIT_CUSTOM_IMAGE);
  const normalizedCustomImage = typeof customPortraitImage === "string"
    ? customPortraitImage.trim()
    : "";

  try {
    const rawEmotionKey = foundry.utils.getProperty(actor, FLAG_PORTRAIT_EMOTION);
    const match = /^custom_(\d+)$/.exec(String(rawEmotionKey ?? "none"));
    if (match) {
      const index = Number(match[1]);
      const customEmotions = foundry.utils.getProperty(actor, FLAG_CUSTOM_EMOTIONS);
      const emotionImage = Array.isArray(customEmotions)
        ? customEmotions[index]?.imagePath
        : "";
      if (typeof emotionImage === "string" && emotionImage.trim()) {
        return emotionImage.trim();
      }
    }
  } catch (_) {}

  return normalizedCustomImage || baseImage;
}

export function getActorPortraitDisplayName(actor, fallback = "Portrait") {
  if (!actor) return fallback;

  try {
    const rawEmotionKey = foundry.utils.getProperty(actor, FLAG_PORTRAIT_EMOTION);
    const match = /^custom_(\d+)$/.exec(String(rawEmotionKey ?? "none"));
    if (match) {
      const index = Number(match[1]);
      const customEmotions = foundry.utils.getProperty(actor, FLAG_CUSTOM_EMOTIONS);
      const emotionName = Array.isArray(customEmotions)
        ? customEmotions[index]?.displayName
        : "";
      if (typeof emotionName === "string" && emotionName.trim()) {
        return emotionName.trim();
      }
    }
  } catch (_) {}

  const rawDisplayName = foundry.utils.getProperty(actor, FLAG_DISPLAY_NAME);
  const customName = typeof rawDisplayName === "string" ? rawDisplayName.trim() : "";
  return customName || actor.name || fallback;
}
