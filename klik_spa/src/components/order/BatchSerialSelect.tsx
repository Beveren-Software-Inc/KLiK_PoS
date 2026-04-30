import { useState } from "react";

interface BatchSelectProps {
  options: { batch_id: string; qty: number }[];
  value: string;
  onChange: (value: string, qty: number) => void;
  isMobile?: boolean;
}

export function BatchSelect({ options, value, onChange, isMobile }: BatchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter(o => o.batch_id.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-left flex justify-between items-center text-xs`}>
        <span className="truncate">{value || "Select Batch"}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg">
          <div className="p-1 border-b"><input type="text" placeholder="Filter..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div>
          <div className="max-h-36 overflow-auto">
            {filtered.map(b => (
              <button key={b.batch_id} onClick={() => { onChange(b.batch_id, b.qty); setIsOpen(false); }} className={`w-full px-2 py-1 text-left text-xs hover:bg-gray-100 ${value === b.batch_id ? "bg-beveren-50 text-beveren-600" : ""}`}>
                {b.batch_id} - {b.qty}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SerialSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  isMobile?: boolean;
}

export function SerialSelect({ options, value, onChange, isMobile }: SerialSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter(s => s.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-left flex justify-between items-center text-xs`}>
        <span className="truncate">{value || "Select Serial"}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg">
          <div className="p-1 border-b"><input type="text" placeholder="Filter..." value={query} onChange={e => setQuery(e.target.value)} className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div>
          <div className="max-h-36 overflow-auto">
            {filtered.map(s => (
              <button key={s} onClick={() => { onChange(s); setIsOpen(false); }} className={`w-full px-2 py-1 text-left text-xs hover:bg-gray-100 ${value === s ? "bg-beveren-50 text-beveren-600" : ""}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}