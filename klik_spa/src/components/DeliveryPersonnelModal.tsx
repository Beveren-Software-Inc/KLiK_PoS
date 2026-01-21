"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader2, Search, ChevronDown } from "lucide-react";
import { useDeliveryPersonnel } from "../hooks/useDeliveryPersonnel";
import { useDeliveryChannels } from "../hooks/useDeliveryChannels";

interface DeliveryPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: { personnelName: string; deliveryVia: string | null }) => void;
}

export default function DeliveryPersonnelModal({
  isOpen,
  onClose,
  onSelect,
}: DeliveryPersonnelModalProps) {
  const { channels, loading: channelsLoading, error: channelsError } = useDeliveryChannels();
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSearchQuery, setChannelSearchQuery] = useState<string>("");
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState<boolean>(false);

  const { personnel, loading, error } = useDeliveryPersonnel(selectedChannel || null);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("");
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState<string>("");
  const [isPersonnelDropdownOpen, setIsPersonnelDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedChannel("");
      setChannelSearchQuery("");
      setIsChannelDropdownOpen(false);
      setSelectedPersonnel("");
      setPersonnelSearchQuery("");
      setIsPersonnelDropdownOpen(false);
    }
  }, [isOpen]);

  const filteredChannels = useMemo(() => {
    if (!channelSearchQuery.trim()) return channels;
    const q = channelSearchQuery.toLowerCase();
    return channels.filter((c) => (c.delivery_via || c.name || "").toLowerCase().includes(q));
  }, [channels, channelSearchQuery]);

  const visiblePersonnel = useMemo(() => {
    // If no channel is chosen, only show personnel that are NOT linked to any channel.
    if (!selectedChannel) {
      return personnel.filter((p) => !p.delivery_via);
    }
    return personnel;
  }, [personnel, selectedChannel]);

  // Filter personnel based on search query
  const filteredPersonnel = useMemo(() => {
    if (!personnelSearchQuery.trim()) return visiblePersonnel;
    const query = personnelSearchQuery.toLowerCase();
    return visiblePersonnel.filter(
      (person) =>
        person.delivery_personnel.toLowerCase().includes(query) ||
        person.name.toLowerCase().includes(query)
    );
  }, [visiblePersonnel, personnelSearchQuery]);

  if (!isOpen) return null;

  const handleSelectChannel = (channelName: string, channelDisplayName: string) => {
    setSelectedChannel(channelName);
    setChannelSearchQuery(channelDisplayName);
    setIsChannelDropdownOpen(false);
    // Reset personnel selection when channel changes
    setSelectedPersonnel("");
    setPersonnelSearchQuery("");
    setIsPersonnelDropdownOpen(false);
  };

  const handleSelectPersonnel = (personnelName: string, personnelDisplayName: string) => {
    setSelectedPersonnel(personnelName);
    setPersonnelSearchQuery(personnelDisplayName);
    setIsPersonnelDropdownOpen(false);
  };

  const handleConfirm = () => {
    if (selectedPersonnel) {
      onSelect({ personnelName: selectedPersonnel, deliveryVia: selectedChannel || null });
      onClose();
    }
  };

  const handleChannelInputChange = (value: string) => {
    setChannelSearchQuery(value);
    setIsChannelDropdownOpen(true);
    const currentSelected = channels.find((c) => c.name === selectedChannel)?.delivery_via || selectedChannel;
    if (value !== currentSelected) {
      setSelectedChannel("");
      setSelectedPersonnel("");
      setPersonnelSearchQuery("");
    }
  };

  const handlePersonnelInputChange = (value: string) => {
    setPersonnelSearchQuery(value);
    setIsPersonnelDropdownOpen(true);
    // Clear selection if user is typing and it doesn't match the selected name
    const currentSelectedName = personnel.find((p) => p.name === selectedPersonnel)?.delivery_personnel || "";
    if (value !== currentSelectedName) {
      setSelectedPersonnel("");
    }
  };

  const handleChannelInputFocus = () => setIsChannelDropdownOpen(true);
  const handlePersonnelInputFocus = () => setIsPersonnelDropdownOpen(true);

  const handleChannelInputBlur = () => {
    setTimeout(() => {
      setIsChannelDropdownOpen(false);
    }, 200);
  };

  const handlePersonnelInputBlur = () => {
    setTimeout(() => {
      setIsPersonnelDropdownOpen(false);
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 delivery-personnel-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Delivery Personnel
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-beveren-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          ) : channelsError ? (
            <div className="text-red-600 dark:text-red-400 text-center py-8">
              {channelsError}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Delivery Channel */}
              <div className="relative">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Delivery Channel (optional)
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search delivery channel..."
                    value={channelSearchQuery}
                    onChange={(e) => handleChannelInputChange(e.target.value)}
                    onFocus={handleChannelInputFocus}
                    onBlur={handleChannelInputBlur}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    autoFocus
                  />
                  <ChevronDown
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-transform ${
                      isChannelDropdownOpen ? "rotate-180" : ""
                    }`}
                    size={18}
                  />
                </div>

                {isChannelDropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <button
                        key="__no_channel__"
                        type="button"
                        onClick={() => handleSelectChannel("", "")}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          !selectedChannel
                            ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        <div className="font-medium">No Delivery Channel</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Show unassigned delivery personnel only
                        </div>
                      </button>

                      {filteredChannels.length > 0 ? (
                        filteredChannels.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => handleSelectChannel(c.name, c.delivery_via || c.name)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                              selectedChannel === c.name
                                ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            <div className="font-medium">{c.delivery_via || c.name}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                          No matches found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Personnel (filtered by channel) */}
              <div className="relative">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Delivery Personnel
                </div>

                {!selectedChannel && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Showing personnel not linked to any delivery channel.
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-beveren-600" />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading personnel...</span>
                  </div>
                ) : error ? (
                  <div className="text-red-600 dark:text-red-400 text-center py-6">
                    {error}
                  </div>
                ) : visiblePersonnel.length === 0 ? (
                  <div className="text-gray-600 dark:text-gray-400 text-center py-6">
                    {selectedChannel
                      ? "No delivery personnel available for this channel"
                      : "No unassigned delivery personnel available"}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="text"
                        placeholder="Search delivery personnel..."
                        value={personnelSearchQuery}
                        onChange={(e) => handlePersonnelInputChange(e.target.value)}
                        onFocus={handlePersonnelInputFocus}
                        onBlur={handlePersonnelInputBlur}
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      <ChevronDown
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-transform ${
                          isPersonnelDropdownOpen ? "rotate-180" : ""
                        }`}
                        size={18}
                      />
                    </div>

                    {isPersonnelDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          {filteredPersonnel.length > 0 ? (
                            filteredPersonnel.map((person) => (
                              <button
                                key={person.name}
                                type="button"
                                onClick={() => handleSelectPersonnel(person.name, person.delivery_personnel)}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                  selectedPersonnel === person.name
                                    ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                <div className="font-medium">{person.delivery_personnel}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                              No matches found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPersonnel || loading || channelsLoading}
            className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
