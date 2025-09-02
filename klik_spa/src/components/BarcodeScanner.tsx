"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react'

interface BarcodeScannerModalProps {
  onBarcodeDetected: (barcode: string) => void
  onClose: () => void
  isOpen: boolean
}

export default function BarcodeScannerModal({ onBarcodeDetected, onClose, isOpen }: BarcodeScannerModalProps) {
  const [manualBarcode, setManualBarcode] = useState('')
  const [success, setSuccess] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [error, setError] = useState('')
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if BarcodeDetector is supported
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      setIsBarcodeDetectorSupported(true)
    } else {
      console.warn('BarcodeDetector not supported in this browser')
    }
  }, [])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && manualBarcode.trim()) {
      e.preventDefault()
      setScannedBarcode(manualBarcode.trim())
      setSuccess(true)
      setTimeout(() => {
        onBarcodeDetected(manualBarcode.trim())
        setManualBarcode('')
        setSuccess(false)
        setScannedBarcode('')
        onClose()
      }, 1000)
    }
  }

  // Camera and barcode detection
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      stopDetection()
    }

    return () => {
      stopCamera()
      stopDetection()
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream

        // Start barcode detection once video is playing
        videoRef.current.onloadedmetadata = () => {
          startBarcodeDetection()
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Camera access denied or not available. Please use manual input.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
  }

  const startBarcodeDetection = async () => {
    if (!isBarcodeDetectorSupported) {
      setError('Barcode detection not supported in this browser. Please use manual input.')
      return
    }

          try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code']
        } as any)

      // Start detection loop
      detectionIntervalRef.current = setInterval(async () => {
        if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')

          if (ctx) {
            canvas.width = videoRef.current.videoWidth
            canvas.height = videoRef.current.videoHeight

            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

            try {
              const barcodes = await barcodeDetector.detect(canvas)

              if (barcodes.length > 0) {
                const detectedBarcode = barcodes[0].rawValue
                console.log('Barcode detected:', detectedBarcode)

                // Stop detection and process barcode
                stopDetection()
                setScannedBarcode(detectedBarcode)
                setSuccess(true)

                setTimeout(() => {
                  onBarcodeDetected(detectedBarcode)
                  setSuccess(false)
                  setScannedBarcode('')
                  onClose()
                }, 1000)
              }
            } catch (detectionError) {
              console.error('Barcode detection error:', detectionError)
            }
          }
        }
      }, 200) 

    } catch (err) {
      console.error('BarcodeDetector error:', err)
      setError('Barcode detection failed. Please use manual input.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50">
      {/* Hidden canvas for barcode detection */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scan Barcode
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 dark:text-green-400 mr-2" size={20} />
              <span className="text-green-800 dark:text-green-200 font-medium">
                Barcode detected: {scannedBarcode}
              </span>
            </div>
            <p className="text-green-600 dark:text-green-400 text-sm mt-1">
              Adding item to cart...
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 dark:text-red-400 mr-2" size={20} />
              <span className="text-red-800 dark:text-red-200 font-medium">
                {error}
              </span>
            </div>
          </div>
        )}

        {/* Browser Support Info */}
        {!isBarcodeDetectorSupported && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>Limited Support:</strong> Camera barcode detection not fully supported in this browser. Manual input recommended.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-green-400 border-dashed rounded-lg w-64 h-32 flex items-center justify-center">
                <div className="text-green-400 text-center">
                  <Camera size={32} className="mx-auto mb-2 opacity-75" />
                  <p className="text-sm">Point at barcode</p>
                </div>
              </div>
            </div>

            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm">
              {isBarcodeDetectorSupported ? (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  Scanning...
                </span>
              ) : (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  Camera Active
                </span>
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isBarcodeDetectorSupported
                ? "Hold the barcode steady in the scanning area"
                : "Camera active - use manual input below for barcode entry"
              }
            </p>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Or type barcode manually..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          BarcodeDetector support: {isBarcodeDetectorSupported ? '✅ Enabled' : '❌ Not available'}
        </div>
      </div>
    </div>
  )
}
