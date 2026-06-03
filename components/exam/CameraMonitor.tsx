"use client"

import { useEffect, useRef, useState } from "react"
import { Video, VideoOff, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraMonitorProps {
  isActive?: boolean
}

/**
 * Compact camera monitor designed to sit at the bottom of the sidebar.
 * No longer floats over the page content.
 */
export function CameraMonitor({ isActive = true }: CameraMonitorProps) {
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!isActive) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setStatus("connecting")
      return
    }

    let cancelled = false

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
          audio: true,  // request mic alongside camera for proctoring
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus("connected")
        setCameraError(null)
      } catch (err) {
        if (!cancelled) {
          // If audio is denied but video works, fall back to video-only
          try {
            const videoOnly = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
              audio: false,
            })
            if (cancelled) { videoOnly.getTracks().forEach(t => t.stop()); return }
            streamRef.current = videoOnly
            if (videoRef.current) videoRef.current.srcObject = videoOnly
            setStatus("connected")
            setCameraError(null)
          } catch {
            setStatus("error")
            setCameraError("Camera/microphone unavailable")
          }
        }
      }
    }

    init()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [isActive])

  if (!isActive) return null

  return (
    <div className="border-t bg-background">
      {/* Camera feed */}
      <div className="relative bg-black aspect-video w-full overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-1">
              <VideoOff className="size-5 text-muted-foreground mx-auto" />
              <p className="text-[10px] text-muted-foreground">{cameraError}</p>
            </div>
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

        {/* REC overlay on the feed itself */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-mono">
          <span className="size-1.5 bg-red-500 rounded-full animate-pulse" />
          REC
        </div>

        {/* Timestamp */}
        <LiveClock />
      </div>

      {/* Status row */}
      <div className="px-3 py-2 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {status === "connected" ? (
            <><Wifi className="size-3 text-green-500" /><span>Cam + Mic Active</span></>
          ) : status === "connecting" ? (
            <><Wifi className="size-3 text-yellow-500 animate-pulse" /><span>Requesting access…</span></>
          ) : (
            <><WifiOff className="size-3 text-red-500" /><span>{cameraError}</span></>
          )}
        </div>
        <div className="flex items-center gap-1">
          {status === "connected" ? (
            <Video className="size-3 text-red-500" />
          ) : (
            <VideoOff className="size-3 text-muted-foreground" />
          )}
          <span className={cn("font-medium", status === "connected" ? "text-red-500" : "text-muted-foreground")}>
            {status === "connected" ? "LIVE" : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

function LiveClock() {
  const [time, setTime] = useState("")
  useEffect(() => {
    const fmt = () => setTime(new Date().toLocaleTimeString())
    fmt()
    const id = setInterval(fmt, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="absolute bottom-1.5 left-1.5 text-[10px] text-white/70 font-mono bg-black/50 px-1.5 py-0.5 rounded">
      {time}
    </div>
  )
}
