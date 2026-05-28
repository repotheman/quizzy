"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Video, Eye, Mic, AlertTriangle, Loader2, Monitor } from "lucide-react"

interface MonitoringDisclaimerProps {
  onAccept: () => void
}

export function MonitoringDisclaimer({ onAccept }: MonitoringDisclaimerProps) {
  const [countdown, setCountdown] = useState(5)
  const [canProceed, setCanProceed] = useState(false)
  const [isRequestingCamera, setIsRequestingCamera] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanProceed(true)
    }
  }, [countdown])

  const handleAccept = async () => {
    setIsRequestingCamera(true)
    setCameraError(null)

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false 
      })
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())
      
      // Permission granted, proceed
      onAccept()
    } catch (error) {
      console.error("Camera permission error:", error)
      setCameraError("Camera access is required to take this exam. Please allow camera access and try again.")
      setIsRequestingCamera(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 py-4">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-red-500/50 bg-card shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-red-500/10 p-3 text-red-500">
            <AlertTriangle className="size-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Proctoring Active</h2>
            <p className="text-sm text-muted-foreground">Please read carefully before proceeding</p>
          </div>
        </div>

        {/* Warning Box */}
        <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-500 mb-2">⚠️ IMPORTANT NOTICE</p>
          <p className="text-sm text-foreground/90">
            This examination is monitored by our AI-powered proctoring system. 
            Your behavior will be continuously analyzed throughout the exam.
          </p>
        </div>

        {/* Monitoring Features */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">The following will be monitored:</p>
          
          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
              <Video className="size-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Video Monitoring</p>
                <p className="text-xs text-muted-foreground">
                  Your camera will be accessed and your video feed will be displayed throughout the exam
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
              <Monitor className="size-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Screen Recording</p>
                <p className="text-xs text-muted-foreground">
                  Your screen activity will be recorded with a visible red border indicator
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
              <Eye className="size-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Eye Tracking & Face Detection</p>
                <p className="text-xs text-muted-foreground">
                  AI will track your eye movements and detect if multiple faces are present
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
              <Mic className="size-5 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Audio Monitoring</p>
                <p className="text-xs text-muted-foreground">
                  Background noise and conversations will be detected and flagged
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-semibold">Exam Rules:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>You must grant camera access when prompted by your browser</li>
            <li>You must remain in fullscreen mode throughout the exam</li>
            <li>A red border will appear around your screen indicating recording is active</li>
            <li>Keep your face visible and centered in the camera at all times</li>
            <li>No talking, looking away, or leaving your seat</li>
            <li>No additional people should be visible in the frame</li>
            <li>Violations will be recorded and may result in exam termination</li>
          </ul>
        </div>

        {/* Consent */}
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">
            By proceeding, you acknowledge that you understand and agree to be monitored 
            by our AI proctoring system during this examination.
          </p>
        </div>

        {/* Camera Error */}
        {cameraError && (
          <div className="rounded-lg border-2 border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-500 mb-1">Camera Access Required</p>
                <p className="text-xs text-red-400">{cameraError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <Button
            size="lg"
            onClick={handleAccept}
            disabled={!canProceed || isRequestingCamera}
            className="min-w-[200px]"
          >
            {isRequestingCamera ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Requesting Camera...
              </>
            ) : canProceed ? (
              "I Understand - Start Exam"
            ) : (
              `Please wait ${countdown}s...`
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {isRequestingCamera 
            ? "Please allow camera access in your browser"
            : "Your exam timer will start after you accept these terms"}
        </p>
      </div>
      </div>
    </div>
  )
}
