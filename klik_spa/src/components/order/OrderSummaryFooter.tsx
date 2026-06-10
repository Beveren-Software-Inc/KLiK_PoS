// "use client";

// import { formatCurrencyWithSymbol } from "../../utils/currency";
// import { useState, useEffect } from "react";

// interface SalesPerson {
//   name: string;
//   sales_person_name: string;
// }

// export interface SalesTeamEntry {
//   sales_person: string;
//   allocated_percentage: number;
// }

// interface OrderSummaryFooterProps {
//   subtotal: number;
//   total: number;
//   totalItemDiscount: number;
//   couponDiscount: number;
//   onCheckout: (salesTeam: SalesTeamEntry[]) => void;
//   onClearCart: () => void;
//   // onHoldOrder: () => void;
//   onHoldOrder: (salesTeam: SalesTeamEntry[]) => void;
//   isHoldingOrder?: boolean;
//   isValidating: boolean;
//   isMobile?: boolean;
//   currency_symbol?: string;
//   allow_holding_invoices?: boolean;
// }

// export const OrderSummaryFooter = ({
//   total,
//   onCheckout,
//   onClearCart,
//   onHoldOrder,
//   isHoldingOrder = false,
//   isValidating,
//   isMobile,
//   currency_symbol,
//   allow_holding_invoices,
// }: OrderSummaryFooterProps) => {
//   const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
//   const [isLoadingSP, setIsLoadingSP] = useState(false);
//   const [salesTeam, setSalesTeam] = useState<SalesTeamEntry[]>([
//     { sales_person: "", allocated_percentage: 100 },
//   ]);
//   const [showError, setShowError] = useState(false);
//   const [percentageError, setPercentageError] = useState("");

//   useEffect(() => {
//     const fetchSalesPersons = async () => {
//       setIsLoadingSP(true);
//       try {
//         const res = await fetch(
//           `/api/resource/Sales Person?fields=["name","sales_person_name"]&filters=[["enabled","=",1]]&limit=100`
//         );
//         const data = await res.json();
//         setSalesPersons(data?.data ?? []);
//       } catch (err) {
//         console.error("Failed to fetch sales persons", err);
//       } finally {
//         setIsLoadingSP(false);
//       }
//     };
//     fetchSalesPersons();
//   }, []);

//   const totalPercentage = salesTeam.reduce(
//     (sum, row) => sum + (Number(row.allocated_percentage) || 0),
//     0
//   );

//   const validate = () => {
//     const hasEmpty = salesTeam.some((row) => !row.sales_person);
//     if (hasEmpty) {
//       setShowError(true);
//       return false;
//     }
//     setShowError(false);
//     if (totalPercentage !== 100) {
//       setPercentageError("Total percentage must equal 100%");
//       return false;
//     }
//     setPercentageError("");
//     return true;
//   };

//   const handleCheckout = () => {
//     if (!validate()) return;
//     onCheckout(salesTeam);
//   };

//   const addRow = () => {
//     const remaining = 100 - totalPercentage;
//     setSalesTeam((prev) => [
//       ...prev,
//       { sales_person: "", allocated_percentage: Math.max(0, remaining) },
//     ]);
//   };

//   const removeRow = (index: number) => {
//     setSalesTeam((prev) => prev.filter((_, i) => i !== index));
//   };

//   const updateRow = (index: number, field: keyof SalesTeamEntry, value: string | number) => {
//     setSalesTeam((prev) =>
//       prev.map((row, i) =>
//         i === index ? { ...row, [field]: value } : row
//       )
//     );
//     if (field === "sales_person" && value) setShowError(false);
//     if (field === "allocated_percentage") setPercentageError("");
//   };

//   return (
//     <div
//       className={`${
//         isMobile
//           ? "flex-shrink-0 p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg"
//           : "p-4 border-t border-gray-100 dark:border-gray-700"
//       } space-y-3`}
//     >
//       {/* Service Person(s) */}
//       <div className="space-y-2">
//         <div className="flex items-center justify-between">
//           <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
//             Service Person <span className="text-red-500">*</span>
//           </label>
//           <button
//             type="button"
//             onClick={addRow}
//             className="text-xs text-beveren-600 dark:text-beveren-400 hover:underline"
//           >
//             + Add
//           </button>
//         </div>

//         {salesTeam.map((row, index) => (
//           <div key={index} className="flex gap-2 items-start">
//             {/* Sales Person Select */}
//             <div className="relative flex-1">
//               <select
//                 value={row.sales_person}
//                 onChange={(e) => updateRow(index, "sales_person", e.target.value)}
//                 disabled={isLoadingSP}
//                 className={`w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border rounded-lg text-gray-700 dark:text-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-beveren-500 disabled:opacity-60 ${
//                   showError && !row.sales_person
//                     ? "border-red-500 dark:border-red-400"
//                     : "border-gray-200 dark:border-gray-600"
//                 }`}
//               >
//                 <option value="">
//                   {isLoadingSP ? "Loading..." : "Select person"}
//                 </option>
//                 {salesPersons.map((sp) => (
//                   <option key={sp.name} value={sp.name}>
//                     {sp.sales_person_name}
//                   </option>
//                 ))}
//               </select>
//               <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
//                 <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//                 </svg>
//               </div>
//             </div>

//             {/* Percentage Input */}
//             <div className="w-20">
//               <input
//                 type="number"
//                 min={0}
//                 max={100}
//                 value={row.allocated_percentage}
//                 onChange={(e) =>
//                   updateRow(index, "allocated_percentage", Number(e.target.value))
//                 }
//                 className={`w-full px-2 py-2 text-sm border rounded-lg text-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-beveren-500 ${
//                   percentageError
//                     ? "border-red-500 dark:border-red-400"
//                     : "border-gray-200 dark:border-gray-600"
//                 }`}
//               />
//             </div>

//             {/* Remove button — only show if more than 1 row */}
//             {salesTeam.length > 1 && (
//               <button
//                 type="button"
//                 onClick={() => removeRow(index)}
//                 className="mt-2 text-red-400 hover:text-red-600"
//               >
//                 ✕
//               </button>
//             )}
//           </div>
//         ))}

//         {/* Percentage total indicator */}
//         <div className={`text-xs text-right ${totalPercentage === 100 ? "text-green-500" : "text-red-500"}`}>
//           Total: {totalPercentage}%
//         </div>

//         {showError && (
//           <p className="text-xs text-red-500">Please select all service persons.</p>
//         )}
//         {percentageError && (
//           <p className="text-xs text-red-500">{percentageError}</p>
//         )}
//       </div>

//       {/* Action Buttons */}
//       <div className={`grid ${allow_holding_invoices ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
//         {allow_holding_invoices && (
//           <button
//             // onClick={onHoldOrder}
//              onClick={() => {
//               if (!validate()) return;  // validate service person is selected
//               onHoldOrder(salesTeam);   // pass the current salesTeam
//             }}
//             disabled={isHoldingOrder}
//             className={`px-3 py-2 border border-beveren-600 text-beveren-600 dark:text-beveren-400 rounded-lg font-medium hover:bg-beveren-600 hover:text-white transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed`}
//           >
//             {isHoldingOrder ? "Holding..." : "Hold"}
//           </button>
//         )}
//         <button
//           onClick={onClearCart}
//           className="px-3 py-2 border border-red-500 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
//         >
//           Clear Cart
//         </button>
//       </div>

//       {/* Checkout Button */}
//       <button
//         onClick={handleCheckout}
//         disabled={isValidating}
//         className={`w-full bg-beveren-600 text-white rounded-xl font-semibold hover:bg-beveren-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
//           isMobile ? "py-3 text-base" : "py-2 text-sm"
//         }`}
//       >
//         {isValidating
//           ? "Checking cart..."
//           : `Checkout ${formatCurrencyWithSymbol(total, currency_symbol)}`}
//       </button>
//     </div>
//   );
// };



"use client";

import { formatCurrencyWithSymbol } from "../../utils/currency";
import { useState, useEffect } from "react";

interface SalesPerson {
  name: string;
  sales_person_name: string;
}

export interface SalesTeamEntry {
  sales_person: string;
  allocated_percentage: number;
}

interface OrderSummaryFooterProps {
  subtotal: number;
  total: number;
  totalItemDiscount: number;
  couponDiscount: number;
  onCheckout: (salesTeam: SalesTeamEntry[]) => void;
  onClearCart: () => void;
  onHoldOrder: (salesTeam: SalesTeamEntry[]) => void;
  isHoldingOrder?: boolean;
  isValidating: boolean;
  isMobile?: boolean;
  currency_symbol?: string;
  allow_holding_invoices?: boolean;
}

export const OrderSummaryFooter = ({
  total,
  onCheckout,
  onClearCart,
  onHoldOrder,
  isHoldingOrder = false,
  isValidating,
  isMobile,
  currency_symbol,
  allow_holding_invoices,
}: OrderSummaryFooterProps) => {
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [isLoadingSP, setIsLoadingSP] = useState(false);
  const [salesTeam, setSalesTeam] = useState<SalesTeamEntry[]>([
    { sales_person: "", allocated_percentage: 100 },
  ]);
  const [showError, setShowError] = useState(false);
  const [percentageError, setPercentageError] = useState("");

  useEffect(() => {
    const fetchSalesPersons = async () => {
      setIsLoadingSP(true);
      try {
        const res = await fetch(
          `/api/resource/Sales Person?fields=["name","sales_person_name"]&filters=[["enabled","=",1]]&limit=100`
        );
        const data = await res.json();
        setSalesPersons(data?.data ?? []);
      } catch (err) {
        console.error("Failed to fetch sales persons", err);
      } finally {
        setIsLoadingSP(false);
      }
    };
    fetchSalesPersons();
  }, []);

  const totalPercentage = salesTeam.reduce(
    (sum, row) => sum + (Number(row.allocated_percentage) || 0),
    0
  );

  // Auto-distribute percentages equally among all rows
  const redistributeEqually = (team: SalesTeamEntry[]): SalesTeamEntry[] => {
    const count = team.length;
    if (count === 0) return team;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;
    return team.map((row, i) => ({
      ...row,
      allocated_percentage: i === 0 ? base + remainder : base,
    }));
  };

  const validate = (): boolean => {
    const hasEmpty = salesTeam.some((row) => !row.sales_person);
    if (hasEmpty) {
      setShowError(true);
      return false;
    }
    setShowError(false);

    const hasDuplicate = salesTeam.some(
      (row, i) => salesTeam.findIndex((r) => r.sales_person === row.sales_person) !== i
    );
    if (hasDuplicate) {
      setPercentageError("Each service person can only be added once.");
      return false;
    }

    if (Math.round(totalPercentage) !== 100) {
      setPercentageError(`Percentages must total 100%. Current total: ${totalPercentage}%`);
      return false;
    }

    setPercentageError("");
    return true;
  };

  const handleCheckout = () => {
    if (!validate()) return;
    onCheckout(salesTeam);
  };

  const addRow = () => {
    const newTeam: SalesTeamEntry[] = [
      ...salesTeam,
      { sales_person: "", allocated_percentage: 0 },
    ];
    setSalesTeam(redistributeEqually(newTeam));
    setPercentageError("");
  };

  const removeRow = (index: number) => {
    if (salesTeam.length === 1) return;
    const newTeam = salesTeam.filter((_, i) => i !== index);
    setSalesTeam(redistributeEqually(newTeam));
    setPercentageError("");
  };

  const updateRow = (
    index: number,
    field: keyof SalesTeamEntry,
    value: string | number
  ) => {
    setSalesTeam((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    if (field === "sales_person" && value) setShowError(false);
    if (field === "allocated_percentage") setPercentageError("");
  };

  const handlePercentageBlur = (index: number, value: number) => {
    // Clamp value between 0 and 100
    const clamped = Math.min(100, Math.max(0, value));
    const otherCount = salesTeam.length - 1;

    if (otherCount === 0) {
      // Only one row — force 100
      setSalesTeam((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, allocated_percentage: 100 } : row
        )
      );
      setPercentageError("");
      return;
    }

    const remaining = 100 - clamped;
    const baseOther = Math.floor(remaining / otherCount);
    const remainderOther = remaining - baseOther * otherCount;

    let otherIndex = 0;
    setSalesTeam((prev) =>
      prev.map((row, i) => {
        if (i === index) return { ...row, allocated_percentage: clamped };
        const pct = otherIndex === 0 ? baseOther + remainderOther : baseOther;
        otherIndex++;
        return { ...row, allocated_percentage: pct };
      })
    );
    setPercentageError("");
  };

  const isPercentageValid = Math.round(totalPercentage) === 100;

  return (
    <div
      className={`${
        isMobile
          ? "flex-shrink-0 p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg"
          : "p-4 border-t border-gray-100 dark:border-gray-700"
      } space-y-3`}
    >
      {/* Service Person(s) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Service Person <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-beveren-600 dark:text-beveren-400 hover:underline"
          >
            + Add
          </button>
        </div>

        {salesTeam.map((row, index) => (
          <div key={index} className="flex gap-2 items-start">
            {/* Sales Person Select */}
            <div className="relative flex-1">
              <select
                value={row.sales_person}
                onChange={(e) => updateRow(index, "sales_person", e.target.value)}
                disabled={isLoadingSP}
                className={`w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border rounded-lg text-gray-700 dark:text-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-beveren-500 disabled:opacity-60 ${
                  showError && !row.sales_person
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-200 dark:border-gray-600"
                }`}
              >
                <option value="">
                  {isLoadingSP ? "Loading..." : "Select person"}
                </option>
                {salesPersons.map((sp) => (
                  <option
                    key={sp.name}
                    value={sp.name}
                    disabled={
                      salesTeam.some(
                        (r, i) => i !== index && r.sales_person === sp.name
                      )
                    }
                  >
                    {sp.sales_person_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Percentage Input */}
            <div className="w-20">
              <input
                type="number"
                min={0}
                max={100}
                value={row.allocated_percentage}
                onChange={(e) =>
                  updateRow(index, "allocated_percentage", Number(e.target.value))
                }
                onBlur={(e) =>
                  handlePercentageBlur(index, Number(e.target.value))
                }
                className={`w-full px-2 py-2 text-sm border rounded-lg text-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-beveren-500 ${
                  !isPercentageValid
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-200 dark:border-gray-600"
                }`}
              />
            </div>

            {/* Remove button */}
            {salesTeam.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mt-2 text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* Percentage total indicator */}
        <div
          className={`text-xs text-right font-medium ${
            isPercentageValid ? "text-green-500" : "text-red-500"
          }`}
        >
          Total: {totalPercentage}%{" "}
          {!isPercentageValid && `(${100 - totalPercentage > 0 ? "+" : ""}${100 - totalPercentage}% remaining)`}
        </div>

        {showError && (
          <p className="text-xs text-red-500">Please select all service persons.</p>
        )}
        {percentageError && (
          <p className="text-xs text-red-500">{percentageError}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div
        className={`grid ${allow_holding_invoices ? "grid-cols-2" : "grid-cols-1"} gap-3`}
      >
        {allow_holding_invoices && (
          <button
            onClick={() => {
              if (!validate()) return;
              onHoldOrder(salesTeam);
            }}
            disabled={isHoldingOrder}
            className="px-3 py-2 border border-beveren-600 text-beveren-600 dark:text-beveren-400 rounded-lg font-medium hover:bg-beveren-600 hover:text-white transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isHoldingOrder ? "Holding..." : "Hold"}
          </button>
        )}
        <button
          onClick={onClearCart}
          className="px-3 py-2 border border-red-500 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
        >
          Clear Cart
        </button>
      </div>

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={isValidating}
        className={`w-full bg-beveren-600 text-white rounded-xl font-semibold hover:bg-beveren-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isMobile ? "py-3 text-base" : "py-2 text-sm"
        }`}
      >
        {isValidating
          ? "Checking cart..."
          : `Checkout ${formatCurrencyWithSymbol(total, currency_symbol)}`}
      </button>
    </div>
  );
};