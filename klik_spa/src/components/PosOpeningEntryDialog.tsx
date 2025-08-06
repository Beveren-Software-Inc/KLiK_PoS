import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import erpnextAPI from '../services/erpnext-api';
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry';
import { useCreatePOSOpeningEntry } from '../services/opeiningEntry';
import { usePaymentModes } from "../hooks/usePaymentModes"
import { usePOSProfiles } from '../hooks/usePOSProfile';

interface PaymentMethod {
  mode_of_payment: string;
  opening_amount: number;
  type: 'Cash' | 'Bank' | 'General';
  account?: string;
}

interface POSOpeningEntry {
  name?: string;
  pos_profile: string;
  period_start_date: string;
  period_end_date?: string;
  company: string;
  user: string;
  balance_details: PaymentMethod[];
  status: 'Open' | 'Closed';
}

interface POSOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (openingEntry?: POSOpeningEntry) => void;
  currentUser: string;
}

const POSOpeningModal: React.FC<POSOpeningModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser
}) => {
  const [step, setStep] = useState<'checking' | 'form' | 'creating' | 'success'>('checking');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string>('');
  
  // Use your existing hooks
  const { hasOpenEntry, isLoading: statusLoading, error: statusError, refetch } = usePOSOpeningStatus();
  const { createOpeningEntry, isCreating, error: createError, success } = useCreatePOSOpeningEntry();
  const { profiles: posProfiles, loading: profilesLoading, error: profilesError } = usePOSProfiles();
  
  // Use payment modes hook - will fetch when selectedProfile changes
  const { 
    modes: paymentModes, 
    isLoading: paymentModesLoading, 
    error: paymentModesError 
  } = usePaymentModes(selectedProfile);

  // Payment method icons
  const getPaymentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cash':
        return <Banknote className="w-5 h-5 text-green-600" />;
      case 'bank':
        return <CreditCard className="w-5 h-5 text-blue-600" />;
      default:
        return <Wallet className="w-5 h-5 text-gray-600" />;
    }
  };

  // Set default profile when profiles are loaded
  useEffect(() => {
    if (posProfiles && posProfiles.length > 0 && !selectedProfile) {
      // Set default profile - first one from the list
      setSelectedProfile(posProfiles[0]);
    }
  }, [posProfiles, selectedProfile]);

  // Handle profile selection change
  const handleProfileChange = (profileName: string) => {
    setSelectedProfile(profileName);
    // Reset payment methods when profile changes
    setPaymentMethods([]);
  };

  // Update payment methods when payment modes are loaded
  useEffect(() => {
    if (paymentModes && paymentModes.length > 0) {
      const methods = paymentModes.map((payment: any) => ({
        mode_of_payment: payment.mode_of_payment,
        opening_amount: 0,
        type: payment.type || 'General',
        account: payment.default_account || payment.account
      }));
      setPaymentMethods(methods);
    }
  }, [paymentModes]);

  // Handle payment modes error
  useEffect(() => {
    if (paymentModesError) {
      setError(paymentModesError);
    }
  }, [paymentModesError]);

  // Update payment method amount
  const updatePaymentAmount = (index: number, amount: number) => {
    const updated = [...paymentMethods];
    updated[index].opening_amount = amount;
    setPaymentMethods(updated);
  };

  // Handle create opening entry
  const handleCreateOpeningEntry = async () => {
    try {
      setStep('creating');
      setError('');
      
      // Prepare opening balance data for your API
      const openingBalance = paymentMethods.map(method => ({
        mode_of_payment: method.mode_of_payment,
        opening_amount: method.opening_amount || 0
      }));

      await createOpeningEntry(openingBalance);
      
    } catch (err: any) {
      console.error('Error creating opening entry:', err);
      setError(err.message || 'Failed to create opening entry');
      setStep('form');
    }
  };

  // Calculate total opening amount
  const totalAmount = paymentMethods.reduce((sum, method) => sum + (method.opening_amount || 0), 0);

  // Handle successful creation
  useEffect(() => {
    if (success && step === 'creating') {
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  }, [success, step, onSuccess]);

  // Handle creation error
  useEffect(() => {
    if (createError && step === 'creating') {
      setError(createError);
      setStep('form');
    }
  }, [createError, step]);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      setStep('checking');
      setError('');
      refetch(); // Check current status
    }
  }, [isOpen, currentUser, refetch]);

  // Handle status check results
  useEffect(() => {
    if (!statusLoading && !statusError) {
      if (hasOpenEntry === true) {
        // User already has an open entry
        onSuccess();
      } else if (hasOpenEntry === false) {
        // No open entry, show form
        setStep('form');
      }
    } else if (statusError) {
      setError(statusError);
      setStep('form');
    }
  }, [statusLoading, statusError, hasOpenEntry, onSuccess]);

  if (!isOpen) return null;

  // Determine if we're currently loading payment modes
  const isLoadingPaymentModes = selectedProfile && paymentModesLoading;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-beveren-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">POS Opening Entry</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
            disabled={isCreating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 relative">
          {step === 'checking' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Checking for existing opening entries...</p>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-6">
              {/* POS Profile Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  POS Profile
                </label>
                <select
                  value={selectedProfile}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={profilesLoading || isLoadingPaymentModes}
                >
                  {posProfiles.length === 0 && (
                    <option value="">Loading profiles...</option>
                  )}
                  {posProfiles.map((profile) => (
                    <option key={profile.name} value={profile.name}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Methods Loading State */}
              {isLoadingPaymentModes && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading payment methods...</p>
                </div>
              )}

              {/* Payment Methods */}
              {!isLoadingPaymentModes && paymentMethods.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Opening Balances
                  </label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {paymentMethods.map((method, index) => (
                      <div key={method.mode_of_payment} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        {getPaymentIcon(method.type)}
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">
                            {method.mode_of_payment}
                          </div>
                          <div className="text-xs text-gray-500">
                            {method.type}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={method.opening_amount || ''}
                          onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                          disabled={profilesLoading}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Opening Balance:</span>
                      <span className="text-green-600">
                        {posProfiles.find(p => p.name === selectedProfile)?.currency || 'USD'} {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={profilesLoading || isCreating || isLoadingPaymentModes}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOpeningEntry}
                  disabled={
                    profilesLoading || 
                    isCreating || 
                    isLoadingPaymentModes || 
                    !selectedProfile || 
                    paymentMethods.length === 0
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {profilesLoading ? 'Loading...' : 
                   isCreating ? 'Creating...' : 
                   isLoadingPaymentModes ? 'Loading...' : 
                   'Start POS Session'}
                </button>
              </div>
            </div>
          )}

          {step === 'creating' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Creating Opening Entry
              </h3>
              <p className="text-gray-600">
                Please wait while we set up your POS session...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                POS Session Started!
              </h3>
              <p className="text-gray-600 mb-4">
                Opening entry created successfully. Redirecting to POS...
              </p>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
            </div>
          )}

          {/* Loading overlay for profile loading */}
          {profilesLoading && step === 'form' && !isLoadingPaymentModes && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POSOpeningModal;