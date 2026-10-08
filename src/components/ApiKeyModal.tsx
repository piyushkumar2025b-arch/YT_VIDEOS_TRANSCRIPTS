import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey: initialKey,
  onSaveKey,
  onClearKey,
}) => {
  const [keyInput, setKeyInput] = useState(initialKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setTestStatus('invalid');
      setStatusMessage('Please enter an API key to test.');
      return;
    }

    setIsTesting(true);
    setTestStatus('idle');
    setStatusMessage('');

    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${trimmed}`);
      if (res.ok) {
        setTestStatus('valid');
        setStatusMessage('YouTube Data API v3 key is verified and active!');
        onSaveKey(trimmed);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setTestStatus('invalid');
        setStatusMessage(
          errorData.error?.message ||
            `API responded with status ${res.status}. Check if YouTube Data API v3 is enabled in Google Cloud Console.`
        );
      }
    } catch (err: any) {
      setTestStatus('invalid');
      setStatusMessage(err.message || 'Network error verifying key.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    onSaveKey(trimmed);
    onClose();
  };

  const handleClear = () => {
    setKeyInput('');
    setTestStatus('idle');
    setStatusMessage('');
    onClearKey();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                YouTube Data API Key
              </h3>
              <p className="text-xs text-neutral-500">
                Configure your own Google Cloud YouTube Data API v3 key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input & Testing */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-neutral-700">
            API Key (AIza...)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setTestStatus('idle');
              }}
              placeholder="AIzaSy..."
              className="flex-1 rounded-md border border-neutral-200 px-3 py-2 text-xs font-mono text-neutral-900 placeholder-neutral-400 shadow-xs focus:border-neutral-900 focus:outline-none"
            />
            <button
              onClick={handleTestKey}
              disabled={isTesting || !keyInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>Verify</span>
            </button>
          </div>

          {/* Test Status feedback */}
          {testStatus === 'valid' && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {testStatus === 'invalid' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Setup guide */}
        <div className="rounded-lg bg-neutral-50 p-3.5 text-xs text-neutral-600 space-y-2">
          <div className="flex items-center justify-between font-semibold text-neutral-800">
            <span>How to get a free YouTube Data API key:</span>
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-red-600 hover:underline font-normal"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <ol className="list-decimal pl-4 space-y-1 text-neutral-500">
            <li>Open Google Cloud Console & create a free project.</li>
            <li>Enable <strong>YouTube Data API v3</strong> in the API Library.</li>
            <li>Go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>API Key</strong>.</li>
            <li>Copy your key and paste it above to unlock direct API search quota!</li>
          </ol>
          <p className="text-[11px] text-neutral-400 pt-1">
            Note: If left empty, the app runs on standard search with full transcript extraction still enabled.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
          {initialKey ? (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Stored Key</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-neutral-800"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
