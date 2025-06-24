"use client"

interface QRCodeDisplayProps {
  qrCodeURL: string
  caption: string
}

export default function QRCodeDisplay({ qrCodeURL, caption }: QRCodeDisplayProps) {
  return (
    <div className="text-center">
      <img
        src={qrCodeURL || "/placeholder.svg"}
        alt="ZATCA QR Code"
        className="w-32 h-32 mx-auto border border-gray-200 rounded"
      />
      <p className="text-sm text-gray-600 mt-2">{caption}</p>
    </div>
  )
}
