export const probeReport = {
  "generatedAt": "2026-04-09T00:02:54.616Z",
  "source": {
    "mode": "sibling_repo",
    "bundleRoot": "/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples"
  },
  "bundle": {
    "ok": true,
    "bundleId": "b1_official_samples",
    "bundleVersion": "0.1.0",
    "schemaVersion": "spine_bundle_manifest_v1",
    "manifestPath": "/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples/bundle_manifest.json",
    "charactersCount": 2,
    "errors": []
  },
  "characters": [
    {
      "presentationId": "spineboy",
      "assetsOk": true,
      "errors": [],
      "fallback": {
        "decision": "use_bundle",
        "reason": "OK"
      },
      "manifest": {
        "presentationId": "spineboy",
        "skeletonFile": "spineboy.json",
        "atlasFile": "spineboy.atlas",
        "texturePages": [
          "spineboy.png"
        ],
        "defaultSkin": "default",
        "animations": [
          "aim",
          "death",
          "hoverboard",
          "idle",
          "idle-turn",
          "jump",
          "portal",
          "run",
          "run-to-idle",
          "shoot",
          "walk"
        ],
        "slots": [
          "portal-bg",
          "portal-shade",
          "portal-streaks2",
          "portal-streaks1",
          "portal-flare8",
          "portal-flare9",
          "portal-flare10",
          "clipping",
          "exhaust3",
          "hoverboard-thruster-rear",
          "hoverboard-thruster-front",
          "hoverboard-board",
          "side-glow1",
          "side-glow3",
          "side-glow2",
          "hoverglow-front",
          "hoverglow-rear",
          "exhaust1",
          "exhaust2",
          "rear-upper-arm",
          "rear-bracer",
          "gun",
          "rear-foot",
          "rear-thigh",
          "rear-shin",
          "neck",
          "torso",
          "front-upper-arm",
          "head",
          "eye",
          "front-thigh",
          "front-foot",
          "front-shin",
          "mouth",
          "goggles",
          "front-bracer",
          "front-fist",
          "muzzle",
          "head-bb",
          "portal-flare1",
          "portal-flare2",
          "portal-flare3",
          "portal-flare4",
          "portal-flare5",
          "portal-flare6",
          "portal-flare7",
          "crosshair",
          "muzzle-glow",
          "muzzle-ring",
          "muzzle-ring2",
          "muzzle-ring3",
          "muzzle-ring4"
        ],
        "anchorProfile": {
          "x": 0.5,
          "y": 1
        },
        "scaleProfile": {
          "baseScale": 1
        }
      }
    },
    {
      "presentationId": "raptor",
      "assetsOk": true,
      "errors": [],
      "fallback": {
        "decision": "use_bundle",
        "reason": "OK"
      },
      "manifest": {
        "presentationId": "raptor",
        "skeletonFile": "raptor.json",
        "atlasFile": "raptor.atlas",
        "texturePages": [
          "raptor.png"
        ],
        "defaultSkin": "default",
        "animations": [
          "gun-grab",
          "gun-holster",
          "jump",
          "roar",
          "walk"
        ],
        "slots": [
          "back-hand",
          "back-arm",
          "back-bracer",
          "back-knee",
          "raptor-jaw-inside",
          "raptor-mouth-inside",
          "raptow-jaw-tooth",
          "raptor-horn-back",
          "raptor-tongue",
          "raptor-hindleg-back",
          "raptor-back-arm",
          "back-thigh",
          "raptor-body",
          "raptor-saddle-strap-front",
          "raptor-saddle-strap-back",
          "raptor-saddle",
          "raptor-jaw",
          "raptor-front-arm",
          "raptor-front-leg",
          "neck",
          "spineboy-torso",
          "head",
          "eyes-open",
          "mouth-smile",
          "visor",
          "raptor-horn",
          "front-thigh",
          "stirrup-back",
          "lower-leg",
          "stirrup-strap",
          "stirrup-front",
          "gun",
          "front-arm",
          "front-bracer",
          "front-hand",
          "tail-shadow"
        ],
        "anchorProfile": {
          "x": 0.5,
          "y": 1
        },
        "scaleProfile": {
          "baseScale": 1
        }
      }
    }
  ],
  "fallback": {
    "decision": "use_bundle",
    "reason": "OK"
  },
  "runtimePreview": {
    "assetRoot": "spine_bundle_runtime_assets/characters",
    "characters": [
      {
        "presentationId": "spineboy",
        "runtimeReady": true,
        "characterRoot": "spine_bundle_runtime_assets/characters/spineboy",
        "skeletonUrl": "spine_bundle_runtime_assets/characters/spineboy/spineboy.json",
        "atlasUrl": "spine_bundle_runtime_assets/characters/spineboy/spineboy.atlas",
        "textureUrls": [
          "spine_bundle_runtime_assets/characters/spineboy/spineboy-pma.png"
        ],
        "defaultAnimation": "walk",
        "animations": [
          "aim",
          "death",
          "hoverboard",
          "idle",
          "idle-turn",
          "jump",
          "portal",
          "run",
          "run-to-idle",
          "shoot",
          "walk"
        ],
        "defaultSkin": "default",
        "scale": 1,
        "anchorProfile": {
          "x": 0.5,
          "y": 1
        }
      },
      {
        "presentationId": "raptor",
        "runtimeReady": true,
        "characterRoot": "spine_bundle_runtime_assets/characters/raptor",
        "skeletonUrl": "spine_bundle_runtime_assets/characters/raptor/raptor.json",
        "atlasUrl": "spine_bundle_runtime_assets/characters/raptor/raptor.atlas",
        "textureUrls": [
          "spine_bundle_runtime_assets/characters/raptor/raptor-pma.png"
        ],
        "defaultAnimation": "walk",
        "animations": [
          "gun-grab",
          "gun-holster",
          "jump",
          "roar",
          "walk"
        ],
        "defaultSkin": "default",
        "scale": 1,
        "anchorProfile": {
          "x": 0.5,
          "y": 1
        }
      }
    ]
  }
};
