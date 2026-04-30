import { AlertCircle, Banknote, CheckCircle2, CreditCard, Wallet, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePaymentModes } from "../hooks/usePaymentModes";
import { useCreatePOSOpeningEntry } from '../services/opeiningEntry';
import { clearAllCache } from '../utils/clearCache';
import { formatCurrencyWithSymbol } from '../utils/currency';
import { usePOSProfileStore } from '../stores/posProfileStore';

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
  currentUser,
}) => {
  const [step, setStep] = useState<'form' | 'creating' | 'success'>('form');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string>('');

  const { createOpeningEntry, isCreating, error: createError, success } = useCreatePOSOpeningEntry();
  const { 
    posProfiles, 
    posDetails, 
    profilesLoading, 
    profilesError,
    fetchPOSProfiles,
    isAuthenticated 
  } = usePOSProfileStore();

  useEffect(() => {
    if (isAuthenticated && isOpen && posProfiles.length === 0) {
      fetchPOSProfiles();
    }
  }, [isAuthenticated, isOpen, posProfiles.length, fetchPOSProfiles]);

  const activeProfileName = posDetails?.name as string | undefined;
  const profileForPaymentModes: string = selectedProfile || activeProfileName || "";
  
  const {
    modes: paymentModes,
    isLoading: paymentModesLoading,
    error: paymentModesError
  } = usePaymentModes(profileForPaymentModes);

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

  useEffect(() => {
    if (posProfiles && posProfiles.length > 0 && !selectedProfile) {
      let profileToUse: { name: string; is_default?: boolean } | null = null;

      if (activeProfileName) {
        profileToUse = posProfiles.find(p => p.name === activeProfileName) || null;
      }

      if (!profileToUse) {
        const defaultProfile = posProfiles.find(p => p.is_default);
        profileToUse = defaultProfile || posProfiles[0] || null;
      }

      if (profileToUse?.name) {
        setSelectedProfile(profileToUse.name);
      }
    }
  }, [posProfiles, selectedProfile, activeProfileName]);

  const handleProfileChange = (profileName: string) => {
    setSelectedProfile(profileName);
  };

  useEffect(() => {
    if (selectedProfile && paymentModesLoading) {
      setPaymentMethods([]);
    }

    if (paymentModes && paymentModes.length > 0 && !paymentModesLoading) {
      const sortedPaymentModes = [...paymentModes].sort((a, b) => {
        if (a.default === 1 && b.default !== 1) return -1;
        if (a.default !== 1 && b.default === 1) return 1;
        return 0;
      });

      const methods = sortedPaymentModes.map((payment: any) => ({
        mode_of_payment: payment.mode_of_payment,
        opening_amount: 0,
        type: payment.type || 'General',
        account: payment.default_account || payment.account
      }));
      setPaymentMethods(methods);
    }
  }, [paymentModes, paymentModesLoading, selectedProfile]);

  useEffect(() => {
    if (paymentModesError) {
      setError(paymentModesError);
    }
  }, [paymentModesError]);

  const updatePaymentAmount = (index: number, amount: number) => {
    if (index < 0 || index >= paymentMethods.length) return;
    setPaymentMethods(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], opening_amount: amount };
      }
      return next;
    });
  };

  const handleCreateOpeningEntry = async () => {
    try {
      setStep('creating');
      setError('');

      const openingBalance = paymentMethods.map(method => ({
        mode_of_payment: method.mode_of_payment,
        opening_amount: method.opening_amount || 0
      }));
      
      console.log("Opening balance data:", openingBalance, "Selected profile:", selectedProfile);
      await createOpeningEntry(openingBalance, selectedProfile || undefined);

      clearAllCache();
      console.log("🧹 Cache cleared after creating new opening entry");

      try {
        await fetch('/api/method/klik_pos.api.cache.clear_backend_cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include'
        });
        console.log("✅ Backend cache cleared after creating new opening entry");
      } catch (e) {
        console.warn('⚠️ Failed to clear backend cache after opening entry:', e);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error creating opening entry:', err);
      setError(err.message || 'Failed to create opening entry');
      setStep('form');
    }
  };

  const totalAmount = paymentMethods.reduce((sum, method) => sum + (method.opening_amount || 0), 0);

  useEffect(() => {
    if (success && step === 'creating') {
      setStep('success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }, [success, step]);

  useEffect(() => {
    if (createError && step === 'creating') {
      setError(createError);
      setStep('form');
    }
  }, [createError, step]);

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError('');
      setSelectedProfile('');
      setPaymentMethods([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoadingPaymentModes = selectedProfile && paymentModesLoading;

  return (
    <div className="fixed inset-0 bg-beveren-300 bg-opacity-10 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden">
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

        <div className="p-6 relative">
          {step === 'form' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  POS Profile
                </label>
                <select
                  value={selectedProfile}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-600"
                  disabled={profilesLoading || isLoadingPaymentModes}
                >
                  {(!posProfiles || posProfiles.length === 0) && (
                    <option value="">
                      {profilesLoading ? 'Loading profiles...' : 'No profiles available'}
                    </option>
                  )}
                  {posProfiles && Array.isArray(posProfiles) && posProfiles.map((profile, index) => {
                    const profileName = profile.name;
                    const profileDisplay = profile.is_default
                      ? `${profileName} (Default)`
                      : profileName;

                    return (
                      <option key={profileName || index} value={profileName}>
                        {profileDisplay}
                      </option>
                    );
                  })}
                </select>
                {profilesError && (
                  <p className="text-red-500 text-sm mt-1">{profilesError}</p>
                )}
              </div>

              {isLoadingPaymentModes && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading payment methods...</p>
                </div>
              )}

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
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600"
                          placeholder="0.00"
                          disabled={profilesLoading}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center font-semibold text-gray-700">
                      <span>Total Opening Balance:</span>
                      <span className="text-green-600">
                        {formatCurrencyWithSymbol(totalAmount, posDetails?.currency || 'USD')}
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
                  className="flex-1 px-4 py-2 bg-beveren-700 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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