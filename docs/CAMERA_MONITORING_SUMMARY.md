# Camera Monitoring - Quick Summary

## What It Does
Shows the candidate's **real webcam feed** in a monitoring interface during the exam to create psychological pressure and deter cheating.

## Key Features

### ✅ Real Camera Feed
- Accesses candidate's actual webcam
- Displays live feed in top-right corner (200px preview)
- Shows their face in real-time
- Crosshair overlay for "targeting" effect
- REC indicator with timestamp

### ✅ Monitoring Interface
- Recording status indicator
- "AI Monitoring Active" label
- Fake monitoring stats (Face Detection, Eye Tracking, Audio)
- Random "suspicious activity" warnings

### ✅ Mandatory Disclaimer
- Shows before exam starts
- 5-second forced reading period
- Lists what will be "monitored"
- Requires acceptance to proceed
- Warns about camera access

## What's Real vs Fake

| Feature | Status |
|---------|--------|
| Camera Access | ✅ **REAL** - Actually accesses webcam |
| Video Display | ✅ **REAL** - Shows actual live feed |
| Recording | ❌ **FAKE** - Not actually recording |
| AI Analysis | ❌ **FAKE** - No face/eye detection |
| Violation Detection | ❌ **FAKE** - Random warnings only |
| Data Storage | ❌ **FAKE** - Nothing saved or transmitted |

## Privacy Notes

- ✅ Camera feed stays local (not transmitted)
- ✅ No recording or storage
- ✅ No AI processing
- ✅ Camera released when exam ends
- ⚠️ Requires HTTPS in production
- ⚠️ Browser will ask for camera permission

## Psychological Impact

**High** - Candidates see themselves being "watched" which:
- Creates self-awareness
- Increases nervousness
- Deters cheating attempts
- Makes them more careful
- Feels like real proctoring

## Technical Requirements

- Modern browser with camera support
- HTTPS (required for camera access in production)
- User must grant camera permission
- No backend/server needed

## Files Modified

1. `components/exam/CameraMonitor.tsx` - Main camera component
2. `components/exam/MonitoringDisclaimer.tsx` - Warning screen
3. `components/exam/ExamShell.tsx` - Integration
4. `app/globals.css` - Minimal animations

## Testing Checklist

- [ ] Disclaimer appears before exam
- [ ] Browser asks for camera permission
- [ ] Real camera feed shows in top-right
- [ ] REC indicator is visible
- [ ] Crosshair overlay appears
- [ ] Random warnings pop up occasionally
- [ ] Camera stops when exam ends
- [ ] Works in fullscreen mode
- [ ] Error message if camera denied

## Result

Candidates will see their own face being "monitored" throughout the exam, creating strong psychological deterrent without any actual surveillance or privacy violations. 🎥
