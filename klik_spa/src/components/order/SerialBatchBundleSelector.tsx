"use client";

import { X, Plus, Minus, Trash2, Package, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { AutoComplete } from "../ui/AutoComplete";
import { useState, useEffect } from "react";
import type { BundleEntry } from "../../../types";


interface SerialBatchBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entries: BundleEntry[]) => void;
  item: {
    id: string;
    item_code?: string;
    name: string;
    has_serial_no?: boolean;
    has_batch_no?: boolean;
  };
  warehouse: string;
  qty: number;
  onQtyChange?: (qty: number) => void;
  availableBatches: BatchData[];
  availableSerials: SerialData[];
  entries: BundleEntry[];
  onEntriesChange: (entries: BundleEntry[]) => void;
  isLoading: boolean;
  onFetchData: (qty: number) => Promise<void>;
  autoFetchBatch?: boolean;
}

interface BatchData {
  batch_no: string;
  qty: number;
  expiry_date: string;
  manufacturing_date: string;
}

interface SerialData {
  serial_no: string;
}

export const SerialBatchBundleModal = ({
  isOpen,
  onClose,
  onSave,
  item,
  warehouse,
  qty,
  onQtyChange,
  availableBatches,
  availableSerials,
  entries,
  onEntriesChange,
  isLoading,
  onFetchData,
  autoFetchBatch = false,
}: SerialBatchBundleModalProps) => {
  const hasSerialNo = item.has_serial_no ?? false;
  const hasBatchNo = item.has_batch_no ?? false;
  const [localQty, setLocalQty] = useState(qty);

  useEffect(() => {
    if (isOpen) {
      setLocalQty(qty);
    }
  }, [isOpen, qty]);

  const updateEntry = (index: number, field: keyof BundleEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "batch_no" && value) {
      const batch = availableBatches.find(b => b.batch_no === value);
      if (batch && !updated[index].qty) {
        updated[index].qty = 1;
      }
    }
    
    if (field === "serial_no" && value) {
      if (!updated[index].qty) {
        updated[index].qty = 1;
      }
    }

    if (field === "qty") {
      const newTotalQty = updated.reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);
      setLocalQty(newTotalQty);
      if (onQtyChange) {
        onQtyChange(newTotalQty);
      }
    }
    
    onEntriesChange(updated);
  };

  const addManualRow = () => {
    onEntriesChange([...entries, { 
      qty: 1, 
      selected: false, 
      serial_no: hasSerialNo ? "" : undefined, 
      batch_no: hasBatchNo ? "" : undefined 
    }]);
  };

  const deleteSelected = () => {
    const remaining = entries.filter(e => !e.selected);
    const finalEntries = remaining.length === 0 ? [{ 
        qty: 1, 
        selected: false, 
        serial_no: hasSerialNo ? "" : undefined, 
        batch_no: hasBatchNo ? "" : undefined 
      }] : remaining;

    const newTotalQty = finalEntries.reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);
    setLocalQty(newTotalQty);
    if (onQtyChange) onQtyChange(newTotalQty);
    
    onEntriesChange(finalEntries);
  };

  const handleSave = () => {
    if (!Array.isArray(entries)) {
      toast.error("Invalid entries data");
      return;
    }

    const valid = entries.filter(e => {
      if (hasSerialNo && !e.serial_no) return false;
      if (hasBatchNo && !e.batch_no) return false;
      if (!hasSerialNo && hasBatchNo && (!e.qty || e.qty <= 0)) return false;
      if (hasSerialNo && hasBatchNo && (!e.serial_no || !e.batch_no)) return false;
      return true;
    });
    
    if (!valid.length) {
      toast.error("Please provide serial/batch details");
      return;
    }
    
    onSave(valid);
    onClose();
  };

  const handleQtyChange = async (newQty: number) => {
    setLocalQty(newQty);
    if (onQtyChange) {
      onQtyChange(newQty);
    }
    if (autoFetchBatch && newQty > 0) {
      await onFetchData(newQty);
    }
  };

  const handleFetchClick = async () => {
    if (localQty > 0) {
      await onFetchData(localQty);
    } else {
      toast.error("Please enter a valid quantity");
    }
  };

  if (!isOpen) return null;

  const serialOptions = availableSerials.map(s => ({
    label: s.serial_no,
    value: s.serial_no,
  }));

  const batchOptions = availableBatches.map(b => ({
    label: `${b.batch_no} (Qty: ${b.qty}${b.expiry_date ? `, Exp: ${b.expiry_date}` : ''})`,
    value: b.batch_no,
  }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden">
        
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{item.name}</h2>
              <p className="text-xs text-gray-500 font-medium">
                {hasSerialNo && hasBatchNo ? "Select Serial & Batch" : 
                 hasSerialNo ? "Select Serial No" : 
                 hasBatchNo ? "Select Batch No" : "Quantity"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-950/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Warehouse</label>
              <div className="h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex items-center text-sm text-gray-700 dark:text-gray-300">
                {warehouse || "No warehouse selected"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Qty</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 px-3">
                  <button 
                    onClick={() => handleQtyChange(Math.max(0, localQty - 1))}
                    className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded transition-all"
                    disabled={isLoading}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input 
                    type="number" 
                    value={localQty} 
                    onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)} 
                    className="flex-1 text-center bg-transparent border-none font-bold outline-none text-sm py-2" 
                    disabled={isLoading}
                  />
                  <button 
                    onClick={() => handleQtyChange(localQty + 1)}
                    className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded transition-all"
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {!autoFetchBatch && (
                  <button
                    onClick={handleFetchClick}
                    disabled={isLoading || localQty <= 0}
                    className="px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    Fetch
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-visible">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm table-fixed border-collapse overflow-visible min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="w-12 px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) => onEntriesChange(entries.map((ent) => ({ ...ent, selected: e.target.checked })))}
                      />
                    </th>
                    <th className="w-16 px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">#</th>
                    <th className={`px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase ${!hasSerialNo ? "hidden" : ""}`}>
                      Serial No
                    </th>
                    <th className={`px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase ${!hasBatchNo ? "hidden" : ""}`}>
                      Batch No
                    </th>
                    <th className={`w-32 px-4 py-4 text-center text-[10px] font-bold text-gray-500 uppercase ${hasSerialNo || !hasBatchNo ? "hidden" : ""}`}>
                      Qty
                    </th>
                    <th className="w-16 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 overflow-visible">
                  {Array.isArray(entries) && entries.map((entry, idx) => (
                    <tr key={idx} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 overflow-visible transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={entry.selected || false} 
                          onChange={() => updateEntry(idx, "selected", !entry.selected)} 
                          className="rounded-md border-gray-300 text-blue-600 focus:ring-blue-500" 
                        />
                       </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs font-medium">{idx + 1}</td>
                      <td className={`px-4 py-3 overflow-visible ${!hasSerialNo ? "hidden" : ""}`}>
                        <AutoComplete 
                          options={serialOptions}
                          value={entry.serial_no || ""}
                          onChange={(val) => updateEntry(idx, "serial_no", val)}
                          placeholder="Select Serial"
                          disabled={isLoading}
                        />
                      </td>
                      <td className={`px-4 py-3 overflow-visible ${!hasBatchNo ? "hidden" : ""}`}>
                        <AutoComplete 
                          options={batchOptions}
                          value={entry.batch_no || ""}
                          onChange={(val) => updateEntry(idx, "batch_no", val)}
                          placeholder="Select Batch"
                          disabled={isLoading}
                        />
                      </td>
                      <td className={`px-4 py-3 ${hasSerialNo || !hasBatchNo ? "hidden" : ""}`}>
                        <div className="flex items-center justify-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-1 border border-gray-100 dark:border-gray-700">
                          <button 
                            onClick={() => updateEntry(idx, "qty", Math.max(1, (entry.qty || 1) - 1))} 
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded shadow-sm transition-all"
                            disabled={isLoading}
                          >
                            <Minus className="w-3.5 h-3.5"/>
                          </button>
                          <input 
                            type="number" 
                            value={entry.qty || 1} 
                            onChange={(e) => updateEntry(idx, "qty", Math.max(1, parseFloat(e.target.value) || 1))} 
                            className="w-12 text-center bg-transparent border-none font-bold outline-none text-sm" 
                            disabled={isLoading}
                          />
                          <button 
                            onClick={() => updateEntry(idx, "qty", (entry.qty || 1) + 1)} 
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded shadow-sm transition-all"
                            disabled={isLoading}
                          >
                            <Plus className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => {
                            const filtered = entries.filter((_, i) => i !== idx);
                            const finalEntries = filtered.length ? filtered : [{ 
                              qty: 1, 
                              selected: false, 
                              serial_no: hasSerialNo ? "" : undefined, 
                              batch_no: hasBatchNo ? "" : undefined 
                            }];
                            
                            const newTotalQty = finalEntries.reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);
                            setLocalQty(newTotalQty);
                            if (onQtyChange) onQtyChange(newTotalQty);
                            
                            onEntriesChange(finalEntries);
                          }} 
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-3 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={addManualRow} 
                className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-lg flex items-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
              <button 
                onClick={deleteSelected} 
                disabled={!entries.some(e => e.selected) || isLoading}
                className="h-9 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-lg flex items-center gap-2 hover:border-red-500 hover:text-red-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={isLoading} 
            className="px-10 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            Save Bundle
          </button>
        </div>
      </div>
    </div>
  );
};