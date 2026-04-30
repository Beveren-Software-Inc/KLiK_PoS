import { Banknote, CreditCard, Smartphone, Gift, Check } from "lucide-react";
import React from "react";

export const getIconAndColor = (label: string): { icon: React.ReactNode; color: string } => {
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("cash")) {
    return { icon: React.createElement(Banknote, { size: 20 }), color: "bg-green-600" };
  }
  if (lowerLabel.includes("card") || lowerLabel.includes("credit") || lowerLabel.includes("debit") || lowerLabel.includes("bank")) {
    return { icon: React.createElement(CreditCard, { size: 20 }), color: "bg-blue-600" };
  }
  if (lowerLabel.includes("phone") || lowerLabel.includes("mpesa") || lowerLabel.includes("m-pesa")) {
    return { icon: React.createElement(Smartphone, { size: 20 }), color: "bg-purple-600" };
  }
  if (lowerLabel.includes("gift") || lowerLabel.includes("voucher")) {
    return { icon: React.createElement(Gift, { size: 20 }), color: "bg-pink-600" };
  }
  if (lowerLabel.includes("cheque") || lowerLabel.includes("check")) {
    return { icon: React.createElement(Check, { size: 20 }), color: "bg-orange-600" };
  }

  return { icon: React.createElement(CreditCard, { size: 20 }), color: "bg-gray-600" };
};