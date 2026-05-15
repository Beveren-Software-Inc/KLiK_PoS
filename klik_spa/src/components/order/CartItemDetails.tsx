import { Copy } from "lucide-react";
import type { CartItem } from "../../../types";
import { QuantityInput } from "./QuantityInput";
import { BatchSelect, SerialSelect } from "./BatchSerialSelect";
import { formatCurrencyWithSymbol } from "../../utils/currency";
import { UOMSelectField } from "./UOMSelectField";

interface CartItemDetailsProps {
  item: CartItem;
  itemDiscount: any;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUOMChange: (id: string, uom: string, price: number) => void;
  onDiscountChange: (id: string, field: string, value: number | string) => void;
  onCustomRateChange: (item: CartItem, rate: number) => void;
  onDuplicateItem: (item: CartItem) => void;
  selectedCustomer?: { id: string } | null;
  posDetails: any;
  itemBatches: any[];
  itemSerials: string[];
  currency_symbol?: string;
  isMobile?: boolean;
}

export function CartItemDetails({
  item, itemDiscount, onUpdateQuantity, onUOMChange, onDiscountChange, onCustomRateChange, onDuplicateItem,
  selectedCustomer, posDetails, itemBatches, itemSerials, currency_symbol, isMobile
}: CartItemDetailsProps) {
  const discountedPrice = (() => {
    if (itemDiscount.customRate !== undefined && itemDiscount.customRate !== null) {
      return Math.max(0, itemDiscount.customRate);
    }
    let price = item.price;
    if (itemDiscount.discountPercentage > 0) price = price * (1 - itemDiscount.discountPercentage / 100);
    if (itemDiscount.discountAmount > 0) price = Math.max(0, price - itemDiscount.discountAmount);
    return Math.max(0, price);
  })();
  const originalTotal = item.price * item.quantity;
  const discountedTotal = discountedPrice * item.quantity;
  const amount = discountedTotal;

  return (
    <div className={`border-t border-gray-200 dark:border-gray-600 ${isMobile ? "px-3 pb-3" : "px-6 py-3 ml-7"} bg-gray-25 dark:bg-gray-750`}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm mb-2">Quantity</label>
          <QuantityInput item={item} onUpdateQuantity={onUpdateQuantity} isMobile={isMobile} />
        </div>
        <div>
          <label className="block text-sm mb-2">UOM</label>
          <UOMSelectField item={item} onUOMChange={onUOMChange} selectedCustomer={selectedCustomer} isMobile={isMobile} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm mb-2">Rate</label>
          <input type="number" step="0.01" value={itemDiscount.customRate ?? discountedPrice} onChange={e => onCustomRateChange(item, parseFloat(e.target.value) || 0)} readOnly={!posDetails?.allow_rate_change} className="w-full px-3 py-4 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label className="block text-sm mb-2">Amount</label>
          <input type="number" value={amount} readOnly className="w-full px-3 py-4 border rounded-md bg-gray-100 dark:bg-gray-700 cursor-not-allowed" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm mb-2">Discount Amount</label>
          <input type="number" min="0" step="0.01" value={itemDiscount.discountAmount || ""} onChange={e => onDiscountChange(item.id, "discountAmount", parseFloat(e.target.value) || 0)} readOnly={!posDetails?.allow_discount_change} className="w-full px-3 py-4 border rounded-md bg-white dark:bg-gray-800" />
        </div>
        <div>
          <label className="block text-sm mb-2">Discount (%)</label>
          <input type="number" min="0" max="100" step="0.1" value={itemDiscount.discountPercentage || ""} onChange={e => onDiscountChange(item.id, "discountPercentage", parseFloat(e.target.value) || 0)} readOnly={!posDetails?.allow_discount_change} className="w-full px-3 py-4 border rounded-md bg-white dark:bg-gray-800" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm mb-2">Batch</label>
          <BatchSelect options={itemBatches || []} value={itemDiscount.batchNumber || ""} onChange={(batch, qty) => { onDiscountChange(item.id, "batchNumber", batch); onDiscountChange(item.id, "availableQuantity", qty); }} isMobile={isMobile} />
        </div>
        <div>
          <label className="block text-sm mb-2">Serial No</label>
          <SerialSelect options={itemSerials || []} value={itemDiscount.serialNumber || ""} onChange={sn => onDiscountChange(item.id, "serialNumber", sn)} isMobile={isMobile} />
        </div>
      </div>

      <button onClick={() => onDuplicateItem(item)} className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded-md border border-dashed border-beveren-400 text-beveren-600 bg-beveren-50 hover:bg-beveren-100 text-sm">
        <Copy size={15} /> Duplicate Line
      </button>

      {(itemDiscount.discountPercentage > 0 || itemDiscount.discountAmount > 0) && (
        <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
          <div className="text-xs text-green-800 font-medium">Discount Applied:</div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-green-700">
              {itemDiscount.discountPercentage > 0 && `${itemDiscount.discountPercentage}% off`}
              {itemDiscount.discountPercentage > 0 && itemDiscount.discountAmount > 0 && " + "}
              {itemDiscount.discountAmount > 0 && formatCurrencyWithSymbol(itemDiscount.discountAmount, currency_symbol)}
            </span>
            <span className="text-xs font-semibold text-green-800">Save {formatCurrencyWithSymbol(originalTotal - discountedTotal, currency_symbol)}</span>
          </div>
        </div>
      )}
    </div>
  );
}