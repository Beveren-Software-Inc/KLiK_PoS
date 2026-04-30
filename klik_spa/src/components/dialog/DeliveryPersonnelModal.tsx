import { X } from "lucide-react";
import { useDeliveryPersonnel } from "../../hooks/useDeliveryPersonnel";

interface DeliveryPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export default function DeliveryPersonnelModal({ isOpen, onClose, onSelect }: DeliveryPersonnelModalProps) {
  const { personnel, loading, error } = useDeliveryPersonnel();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Delivery Personnel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Loading delivery personnel...</div>
          ) : error ? (
            <div className="px-4 py-2 text-sm text-red-500 dark:text-red-400">{error}</div>
          ) : personnel.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No delivery personnel found</div>
          ) : (
            personnel.map((person) => (
              <button
                key={person.name}
                onClick={() => {
                  onSelect(person.name);
                  onClose();
                }}
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
              >
                {person.delivery_personnel}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}