import { useState, useCallback } from 'react';

interface CustomerPermissionResult {
  success: boolean;
  has_permission: boolean;
  customer_name: string;
  business_type: string;
  customer_groups: string[];
  user_permissions: number;
  error?: string;
}

export function useCustomerPermission() {
  const [isChecking, setIsChecking] = useState(false);

  const checkCustomerPermission = useCallback(async (customerName: string): Promise<CustomerPermissionResult> => {
    if (!customerName) {
      return {
        success: false,
        has_permission: false,
        customer_name: '',
        business_type: '',
        customer_groups: [],
        user_permissions: 0,
        error: 'Customer name is required'
      };
    }

    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/method/klik_pos.api.customer.check_customer_permission?customer_name=${encodeURIComponent(customerName)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();

      if (!resData.message || resData.message.success === false) {
        throw new Error(resData.message?.error || "Failed to check customer permission");
      }

      return resData.message;
    } catch (error: any) {
      console.error('Error checking customer permission:', error);
      return {
        success: false,
        has_permission: false,
        customer_name: customerName,
        business_type: '',
        customer_groups: [],
        user_permissions: 0,
        error: error.message || 'Failed to check customer permission'
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    checkCustomerPermission,
    isChecking
  };
}
