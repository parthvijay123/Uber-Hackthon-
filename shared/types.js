"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagSeverity = exports.FlagType = exports.AudioSeverity = exports.AudioClass = exports.MotionClass = void 0;
var MotionClass;
(function (MotionClass) {
    MotionClass["normal"] = "normal";
    MotionClass["moderate"] = "moderate";
    MotionClass["harsh"] = "harsh";
    MotionClass["collision"] = "collision";
})(MotionClass || (exports.MotionClass = MotionClass = {}));
var AudioClass;
(function (AudioClass) {
    AudioClass["quiet"] = "quiet";
    AudioClass["normal"] = "normal";
    AudioClass["conversation"] = "conversation";
    AudioClass["loud"] = "loud";
    AudioClass["very_loud"] = "very_loud";
    AudioClass["argument"] = "argument";
})(AudioClass || (exports.AudioClass = AudioClass = {}));
var AudioSeverity;
(function (AudioSeverity) {
    AudioSeverity["SHORT_LOW"] = "SHORT_LOW";
    AudioSeverity["SHORT_MODERATE"] = "SHORT_MODERATE";
    AudioSeverity["SHORT_HIGH"] = "SHORT_HIGH";
    AudioSeverity["SHORT_CRITICAL"] = "SHORT_CRITICAL";
    AudioSeverity["MODERATE_SPIKE"] = "MODERATE_SPIKE";
    AudioSeverity["HIGH_SPIKE"] = "HIGH_SPIKE";
    AudioSeverity["CRITICAL_SPIKE"] = "CRITICAL_SPIKE";
})(AudioSeverity || (exports.AudioSeverity = AudioSeverity = {}));
// ─── Fusion types ───────────────────────────────────────────────────────────
var FlagType;
(function (FlagType) {
    FlagType["conflict_moment"] = "conflict_moment";
    FlagType["audio_only"] = "audio_only";
    FlagType["motion_only"] = "motion_only";
})(FlagType || (exports.FlagType = FlagType = {}));
var FlagSeverity;
(function (FlagSeverity) {
    FlagSeverity["low"] = "low";
    FlagSeverity["medium"] = "medium";
    FlagSeverity["high"] = "high";
})(FlagSeverity || (exports.FlagSeverity = FlagSeverity = {}));
