# Real Camera Monitoring Feature

## Overview
A psychological deterrent feature that uses the candidate's real camera feed during exams. The camera is accessed and displayed in a monitoring interface, creating the impression of active surveillance without actually implementing AI analysis or recording.

## Components Added

### 1. CameraMonitor Component (`components/exam/CameraMonitor.tsx`)
A real camera monitoring interface that displays:
- **Recording Status**: Shows "Recording" with a pulsing red indicator
- **Connection Status**: Displays "AI Monitoring Active" with connection indicators
- **Live Camera Feed**: Real webcam feed from the candidate's camera
  - Uses `navigator.mediaDevices.getUserMedia()` API
  - 640x480 resolution, user-facing camera
  - Recording timestamp overlay
  - Crosshair overlay (targeting effect)
  - REC indicator with timestamp
- **Monitoring Info Panel**: Shows fake status for:
  - Face Detection: Active
  - Eye Tracking: Active
  - Audio Monitor: Active
- **Random Warnings**: Occasionally displays "Suspicious activity detected" messages
- **Error Handling**: Shows error message if camera access is denied

**Features:**
- Appears in the top-right corner during fullscreen exam mode
- Requests real camera permission from browser
- Displays actual live feed from candidate's webcam
- Automatically cleans up camera stream when exam ends
- Random "connection issues" warnings for authenticity
- No actual recording or AI analysis - just displays the feed

### 2. MonitoringDisclaimer Component (`components/exam/MonitoringDisclaimer.tsx`)
A mandatory disclaimer shown before the exam starts:
- **Warning Message**: Explains AI proctoring is active
- **Monitoring Features List**: Details what will be "monitored":
  - Video Monitoring (camera access required)
  - Eye Tracking & Face Detection
  - Audio Monitoring
- **Exam Rules**: Lists behavioral requirements including camera access
- **Consent Acknowledgment**: Requires acceptance to proceed
- **5-Second Countdown**: Forces candidates to read the disclaimer

**Purpose:**
- Creates psychological pressure
- Sets behavioral expectations
- Informs candidates about camera access
- Makes candidates more cautious about cheating

### 3. CSS Animations (`app/globals.css`)
Added scanning line animation (minimal effects as requested):
```css
@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(200vh); }
}
```

## Integration

The feature is integrated into `ExamShell.tsx`:
1. Disclaimer shows first (before exam timer starts)
2. After acceptance, fullscreen is required
3. Browser prompts for camera permission
4. Camera monitor appears once in fullscreen mode with real feed
5. Monitor remains visible throughout the exam
6. Camera stream is automatically cleaned up when exam ends

## User Experience Flow

1. **Exam Start** → Monitoring Disclaimer appears
2. **Read & Accept** → 5-second countdown, then accept button
3. **Fullscreen Required** → Standard fullscreen prompt
4. **Camera Permission** → Browser asks for camera access
5. **Exam Active** → Real camera feed visible in top-right corner
6. **Throughout Exam** → Occasional "suspicious activity" warnings
7. **Exam End** → Camera automatically released

## Technical Notes

- **Real Camera Access**: Uses `navigator.mediaDevices.getUserMedia()` API
- **No Recording**: Camera feed is displayed but NOT recorded or saved
- **No AI Analysis**: No actual face detection, eye tracking, or analysis
- **No Backend**: All effects are client-side
- **Privacy**: Feed is only shown locally, not transmitted anywhere
- **Automatic Cleanup**: Camera stream is properly released when exam ends or component unmounts

## Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires HTTPS in production (browsers block camera on HTTP)
- Handles camera permission denial gracefully with error message

## Customization Options

You can adjust the following in `CameraMonitor.tsx`:
- Warning frequency (currently 5% chance every 10 seconds)
- Camera resolution (currently 640x480)
- Camera preview size (currently 200px wide)
- Monitoring status labels
- Crosshair overlay visibility

## Privacy & Security

✅ **What happens:**
- Camera feed is accessed and displayed locally
- Feed is shown only to the candidate taking the exam
- No video recording or storage
- No transmission to servers
- Camera is released immediately when exam ends

❌ **What does NOT happen:**
- No video recording
- No AI analysis or face detection
- No data storage or transmission
- No actual monitoring by humans or AI

## Ethical Considerations

⚠️ **Important**: While no actual recording occurs, candidates believe they're being monitored:
- Clearly state in exam instructions that camera monitoring is in place
- Be transparent about the purpose (deterrent)
- Don't use fake "violations" for actual penalties
- Ensure candidates understand the exam environment
- Consider privacy laws in your jurisdiction regarding camera access

## Future Enhancements (Optional)

If you want to make it more convincing:
- Add random "analyzing..." status messages
- Simulate "confidence scores" for face detection
- Add fake "violation warnings" that don't actually record
- Include a "proctor review" indicator
- Add sound effects (camera shutter, beep on warnings)
- Implement actual recording if needed (requires backend)

## Files Modified

- ✅ `components/exam/CameraMonitor.tsx` (new)
- ✅ `components/exam/MonitoringDisclaimer.tsx` (new)
- ✅ `components/exam/ExamShell.tsx` (modified)
- ✅ `app/globals.css` (modified)
