"use client"

import { useEffect, useState, useRef } from "react"
import { Video, VideoOff, Wifi, WifiOff, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraMonitorProps {
  isActive?: boolean
}

export function CameraMonitor({ isActive = true }: CameraMonitorProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [showWarning, setShowWarning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!isActive) {
      // Clean up camera when not active
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      return
    }

    // Request camera access
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false 
        })
        
        streamRef.current = stream
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        
        setIsRecording(true)
        setConnectionStatus("connected")
        setCameraError(null)
      } catch (error) {
        console.error("Camera access error:", error)
        setConnectionStatus("disconnected")
        setCameraError("Camera access denied or unavailable")
      }
    }

    initCamera()

    // Randomly show "connection issues" to make it feel more real
    const warningInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setShowWarning(true)
        setTimeout(() => setShowWarning(false), 3000)
      }
    }, 10000)

    return () => {
      clearInterval(warningInterval)
      // Clean up camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [isActive])

  if (!isActive) return null

  return (
    <div className="fixed top-16 right-4 z-50 space-y-2">
      {/* Camera Status Card */}
      <div className="bg-card border rounded-lg shadow-lg p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "relative",
            isRecording && "animate-pulse"
          )}>
            {isRecording ? (
              <Video className="size-5 text-red-500" />
            ) : (
              <VideoOff className="size-5 text-muted-foreground" />
            )}
            {isRecording && (
              <span className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-sm font-medium">
            {connectionStatus === "connecting" && "Initializing..."}
            {connectionStatus === "connected" && "Recording"}
            {connectionStatus === "disconnected" && "Disconnected"}
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {connectionStatus === "connected" ? (
            <>
              <Wifi className="size-3 text-green-500" />
              <span>AI Monitoring Active</span>
            </>
          ) : connectionStatus === "connecting" ? (
            <>
              <Wifi className="size-3 text-yellow-500 animate-pulse" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="size-3 text-red-500" />
              <span>Connection Lost</span>
            </>
          )}
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-xs">
              <div className="size-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-500 font-medium">LIVE</span>
            </div>
          </div>
        )}
      </div>

      {/* Warning Message */}
      {showWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <Eye className="size-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Suspicious activity detected. Reviewing footage...
            </p>
          </div>
        </div>
      )}

      {/* Real Video Preview */}
      <div className="bg-black rounded-lg overflow-hidden border border-border shadow-lg">
        <div className="relative aspect-video w-[200px]">
          {/* Real camera feed */}
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-400 text-xs p-2 text-center">
              {cameraError}
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Overlay elements */}
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
            <div className="size-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-white font-mono">REC</span>
          </div>
          
          <div className="absolute bottom-2 left-2 text-[10px] text-white/70 font-mono bg-black/50 px-2 py-1 rounded">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Monitoring Info */}
      <div className="bg-card/50 backdrop-blur-sm border rounded-lg p-2 text-[10px] text-muted-foreground space-y-1">
        <div className="flex items-center justify-between">
          <span>Screen Recording:</span>
          <span className="text-red-500 font-medium">Active</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Face Detection:</span>
          <span className="text-green-500 font-medium">Active</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Eye Tracking:</span>
          <span className="text-green-500 font-medium">Active</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Audio Monitor:</span>
          <span className="text-green-500 font-medium">Active</span>
        </div>
      </div>
    </div>
  )
}
