/** English copy for the fixed-tempo detector and its new-chart prompt. */
export default {
  "editorPanels.timingDetection.newChart.title": "Detect BPM and offset for this chart?",
  "editorPanels.timingDetection.newChart.description":
    'Optional and skippable. Audio is analyzed locally; "Always detect" and "Never detect" are remembered, the other answers apply only to this chart.',
  "editorPanels.timingDetection.newChart.always": "Always detect",
  "editorPanels.timingDetection.newChart.never": "Never detect",
  "editorPanels.timingDetection.newChart.once": "Detect once",
  "editorPanels.timingDetection.newChart.skip": "Skip once",
  "editorPanels.timingDetection.pendingToast":
    "Timing detection is queued; it will run when this chart has audio.",
  "editorPanels.timingDetection.button": "Auto-detect BPM & offset",
  "editorPanels.timingDetection.title": "Detect BPM and offset",
  "editorPanels.timingDetection.analyzing": "Analyzing the beat…",
  "editorPanels.timingDetection.analyzingHint":
    "Sampling the track for its dominant pulse. Every track gets one BPM estimate and a confidence score.",
  "editorPanels.timingDetection.confidence": "Confidence {value}%",
  "editorPanels.timingDetection.confidenceLabel": "Detection confidence",
  "editorPanels.timingDetection.lowConfidenceTitle": "No clear pulse",
  "editorPanels.timingDetection.lowConfidenceBody":
    "The BPM is still the best guess. Check the beat and offset by hand before applying.",
  "editorPanels.timingDetection.noAudioTitle": "No audio yet",
  "editorPanels.timingDetection.noAudioBody":
    "Choose the chart's audio track first, then run the detector.",
  "editorPanels.timingDetection.pickAudio": "Choose audio",
  "editorPanels.timingDetection.errorTitle": "Detection failed",
  "editorPanels.timingDetection.errorBody":
    "The audio could not be analyzed. Check that it decodes and try again.",
  "editorPanels.timingDetection.retry": "Try again",
  "editorPanels.timingDetection.bpm": "BPM",
  "editorPanels.timingDetection.offset": "Offset",
  "editorPanels.timingDetection.bpmDown": "Decrease BPM by 0.1",
  "editorPanels.timingDetection.bpmUp": "Increase BPM by 0.1",
  "editorPanels.timingDetection.offsetDown": "Move offset 1 ms earlier",
  "editorPanels.timingDetection.offsetUp": "Move offset 1 ms later",
  "editorPanels.timingDetection.cancel": "Cancel",
  "editorPanels.timingDetection.apply": "Apply timing",
  "editorPanels.timingDetection.replaceAndApply": "Replace all timing and apply",
  "editorPanels.timingDetection.commit": "Apply detected timing",
  "editorPanels.timingDetection.invalidValues": "Enter a positive BPM and a finite offset.",
  "editorPanels.timingDetection.pendingHint":
    "Timing detection is waiting for audio. Choose the track and it will run automatically.",
  "editorPanels.timingDetection.pendingPick": "Choose audio",
} as const;
