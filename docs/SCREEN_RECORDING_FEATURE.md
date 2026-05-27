# Screen Recording Feature

## Overview
Added a visual screen recording indicator to the exam interface, simulating that the candidate's screen is being recorded. This creates additional psychological pressure without actually implementing screen capture.

## Visual Elements Added

### 1. Red Border Around Screen
- **4px thick red border** around the entire exam screen
- Only visible when in fullscreen mode
- Pulsing animation to draw attention
- Similar to native screen recording indicators in macOS/Windows

### 2. "SCREEN RECORDING" Badge
- **Top-left corner** of the screen
- Red background with white text
- Pulsing animation
- White dot with ping animation
- Text: "SCREEN RECORDING"

### 3. Updated Monitoring Panel
Added "Screen Recording: Active" status to the monitoring info panel in the camera monitor component.

### 4. Updated Disclaimer
Added screen recording information to the monitoring disclaimer:
- New monitoring feature card explaining screen recording
- Updated exam rules mentioning the red border
- Clear indication that screen activity will be "recorded"

## Visual Layout

```
┌─────────────────────────────────────────────────────────┐ ← Red Border (4px)
│ [🔴 SCREEN RECORDING]              [Camera Monitor]     │
│                                                          │
│                    Exam Content                          │
│                                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘ ← Red Border (4px)
```

## Implementation Details

### ExamShell.tsx
- Added red border overlay with `fixed inset-0` positioning
- Added "SCREEN RECORDING" badge in top-left
- Both only render when `isFullscreen && hasAcceptedMonitoring`
- Z-index of 100 to appear above content but below dialogs

### MonitoringDisclaimer.tsx
- Added Monitor icon import
- Added screen recording card to monitoring features
- Updated exam rules to mention red border
- Positioned between video monitoring and eye tracking

### CameraMonitor.tsx
- Added "Screen Recording: Active" as first item in monitoring info
- Shows in red color to match the theme

## CSS Classes Used

```tsx
// Red border
<div className="absolute inset-0 border-[4px] border-red-500 animate-pulse" />

// Recording badge
<div className="fixed top-4 left-4 z-[100] flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse">
  <div className="size-2 bg-white rounded-full animate-ping" />
  <span className="text-xs font-bold">SCREEN RECORDING</span>
</div>
```

## User Experience

### Before Exam:
1. Disclaimer shows screen recording will be active
2. Red border indicator is mentioned in rules

### During Exam:
1. Enter fullscreen mode
2. **Red border appears** around entire screen
3. **"SCREEN RECORDING" badge** appears in top-left
4. Camera monitor shows "Screen Recording: Active"
5. Constant visual reminder throughout exam

### Psychological Impact:
- ✅ Creates strong deterrent effect
- ✅ Mimics real screen recording software
- ✅ Highly visible and impossible to ignore
- ✅ Reinforces monitoring presence
- ✅ Makes candidates more cautious

## Technical Notes

- **No Actual Recording**: This is purely visual - no screen capture occurs
- **No API Calls**: All client-side visual effects
- **No Performance Impact**: Simple CSS borders and badges
- **Browser Compatible**: Works in all modern browsers
- **Fullscreen Only**: Only shows when exam is in fullscreen mode

## What's Real vs Fake

| Feature | Status |
|---------|--------|
| Red Border | ✅ **REAL** - Visible border around screen |
| Recording Badge | ✅ **REAL** - Visible badge indicator |
| Screen Capture | ❌ **FAKE** - No actual screen recording |
| Data Storage | ❌ **FAKE** - Nothing saved or transmitted |

## Customization Options

You can adjust in `ExamShell.tsx`:
- Border thickness (currently 4px)
- Border color (currently red-500)
- Badge position (currently top-left)
- Badge text
- Animation speed (animate-pulse)

## Files Modified

1. ✅ `components/exam/ExamShell.tsx` - Added red border and badge
2. ✅ `components/exam/MonitoringDisclaimer.tsx` - Added screen recording info
3. ✅ `components/exam/CameraMonitor.tsx` - Added screen recording status

## Result

Candidates will see a prominent red border around their screen and a "SCREEN RECORDING" badge throughout the exam, creating the strong impression that their screen is being captured, even though no actual recording occurs. 🔴
