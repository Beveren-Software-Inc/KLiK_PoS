import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Search, Unlock, UserRound, X } from "lucide-react";
import { toast } from "react-toastify";

import { useSalespersonStore } from "../../stores/salespersonStore";

interface SalespersonAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
  allowDismiss?: boolean;
  title?: string;
  description?: string;
}

export default function SalespersonAuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  allowDismiss = true,
  title = "Verify salesperson",
  description = "Select a salesperson and enter the 4-digit PIN before continuing.",
}: SalespersonAuthModalProps) {
  const {
    activeSalesperson,
    salespeople,
    rememberLocked,
    isRestoring,
    isLoadingSalespeople,
    isVerifying,
    error,
    ensureInitialized,
    loadSalespeople,
    verifySalespersonPin,
    setRememberLocked,
  } = useSalespersonStore();

  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    void ensureInitialized();
    void loadSalespeople();
  }, [isOpen, ensureInitialized, loadSalespeople]);

  useEffect(() => {
    if (!isOpen) return;

    if (activeSalesperson?.name) {
      setSelectedSalesperson(activeSalesperson.name);
      return;
    }

    const firstWithPin = salespeople.find((entry) => entry.has_pin);
    if (firstWithPin) {
      setSelectedSalesperson(firstWithPin.salesperson);
    }
  }, [isOpen, activeSalesperson, salespeople]);

  const selectedSalespersonDetails = useMemo(
    () => salespeople.find((entry) => entry.salesperson === selectedSalesperson) || null,
    [salespeople, selectedSalesperson]
  );

  const filteredSalespeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return salespeople;
    return salespeople.filter(
      (entry) =>
        entry.salesperson_name.toLowerCase().includes(q) ||
        entry.salesperson.toLowerCase().includes(q)
    );
  }, [salespeople, search]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    if (!selectedSalesperson) {
      setPinError("Choose a salesperson before entering the PIN.");
      return;
    }

    if (!/^\d{4}$/.test(pin.trim())) {
      setPinError("Please enter a valid 4-digit PIN.");
      return;
    }

    try {
      setPinError("");
      const salesperson = await verifySalespersonPin(pin.trim(), selectedSalesperson);
      setPin("");
      toast.success(`Salesperson verified: ${salesperson.salesperson_name}`);
      onAuthenticated?.();
      onClose();
    } catch (verifyError) {
      setPin("");
      setPinError(
        verifyError instanceof Error
          ? verifyError.message
          : "Failed to verify salesperson PIN"
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-950/45 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p>
          </div>
          {allowDismiss ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Close salesperson dialog"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="grid gap-6 px-6 py-5 md:grid-cols-[1.1fr,0.9fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Salespeople</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  void loadSalespeople(true)}
                }
                className="text-sm font-medium text-beveren-600 transition-colors hover:text-beveren-700"
              >
                Refresh
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search salespeople..."
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-beveren-500 focus:ring-2 focus:ring-beveren-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {isLoadingSalespeople || isRestoring ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading salespeople...</span>
                </div>
              ) : filteredSalespeople.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  {search.trim() ? "No salespeople match your search." : "No active salespeople found."}
                </div>
              ) : (
                filteredSalespeople.map((entry) => {
                  const isSelected = entry.salesperson === selectedSalesperson;
                  const isActive = activeSalesperson?.name === entry.salesperson;
                  const isSelectable = entry.has_pin;
                  return (
                    <button
                      key={entry.salesperson}
                      type="button"
                      onClick={() => {
                        if (!isSelectable) return;
                        setSelectedSalesperson(entry.salesperson);
                      }}
                      disabled={!isSelectable}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-beveren-500 bg-beveren-50 text-beveren-900 dark:bg-beveren-950/30"
                          : isSelectable
                            ? "border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                            : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                          isSelectable
                            ? "bg-beveren-600 text-white"
                            : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {entry.salesperson_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{entry.salesperson_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{entry.salesperson}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {entry.has_pin && isSelected ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSalesperson(entry.salesperson);
                              void setRememberLocked(!rememberLocked);
                            }}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              rememberLocked
                                ? "bg-beveren-600 text-white hover:bg-beveren-700"
                                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
                            }`}
                          >
                            {rememberLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            <span>{rememberLocked ? "Locked" : "Unlocked"}</span>
                          </button>
                        ) : entry.has_pin ? (
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            PIN set
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            PIN not set
                          </div>
                        )}
                        {isActive ? (
                          <div className="mt-1 text-xs font-semibold text-emerald-600">Active</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-950/40">
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Selected salesperson
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedSalespersonDetails?.salesperson_name || "Choose a salesperson"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedSalespersonDetails?.salesperson || "PIN verification is scoped to the selected salesperson."}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {selectedSalespersonDetails?.has_pin
                  ? rememberLocked
                    ? "This salesperson will auto-restore on this device."
                    : "Salesperson stays active only for this session."
                  : "This salesperson needs a PIN before device lock can be used."}
              </p>

              <div className="mt-5 space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Enter 4-digit PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSubmit();
                    }
                  }}
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-gray-900 outline-none transition-colors focus:border-beveren-500 focus:ring-2 focus:ring-beveren-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                {pinError || error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{pinError || error}</p>
                ) : null}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                {allowDismiss ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isVerifying || !selectedSalespersonDetails?.has_pin}
                  className="inline-flex items-center gap-2 rounded-xl bg-beveren-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-beveren-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  <span>Verify salesperson</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}