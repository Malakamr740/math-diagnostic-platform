import { useState } from 'react'

interface ShareAssessmentModalProps {
  assessmentId: string
  assessmentName: string
  isOpen: boolean
  onClose: () => void
}

export default function ShareAssessmentModal({
  assessmentId,
  assessmentName,
  isOpen,
  onClose,
}: ShareAssessmentModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const shareUrl = `${window.location.origin}/assessment/${assessmentId}`
  const whatsappMessage = encodeURIComponent(
    `Hello! Please complete the diagnostic assessment "${assessmentName}" by visiting this link: ${shareUrl}`
  )
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    shareUrl
  )}`

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-2">
            🔗
          </div>
          <h2 className="text-lg font-bold text-slate-900">Share with Students</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
            Send this link to students. They do not need to create an account to take the test.
          </p>
        </div>

        {/* Copy Link Input */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Assessment Public Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition ${
                  copied ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-lg transition"
            >
              <span>💬</span> Share via WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(
                `Assessment: ${assessmentName}`
              )}&body=${encodeURIComponent(
                `Please complete the assessment at: ${shareUrl}`
              )}`}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold py-2.5 rounded-lg transition"
            >
              <span>✉️</span> Share via Email
            </a>
          </div>

          {/* QR Code */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
            <p className="text-xs font-medium text-slate-500 mb-2">QR Code for In-Classroom Scan</p>
            <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs">
              <img src={qrCodeUrl} alt="QR Code" className="w-36 h-36" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}