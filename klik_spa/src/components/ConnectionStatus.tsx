import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import backgroundSyncService from '../services/backgroundSyncService';
import { useI18n } from '../hooks/useI18n';
import { formatRelativeTime } from '../i18n/runtime';

interface ConnectionStatusProps {
  className?: string;
}

export default function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const { tl, isRTL } = useI18n();
  const [syncStatus, setSyncStatus] = useState(backgroundSyncService.getStatus());

  useEffect(() => {
    const handleSyncStatusChange = (status: { isOnline: boolean; isSyncing: boolean; lastSync: Date | null; pendingUpdates: number }) => {
      setSyncStatus(status);
    };

    backgroundSyncService.on('status_change', handleSyncStatusChange);

    return () => {
      backgroundSyncService.off('status_change', handleSyncStatusChange);
    };
  }, []);

  const handleForceSync = async () => {
    try {
      await backgroundSyncService.forceSync();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'text-red-500';
    if (syncStatus.isSyncing) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <WifiOff className="w-4 h-4" />;
    if (syncStatus.isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return tl('Offline');
    if (syncStatus.isSyncing) return tl('Syncing...');
    return tl('Polling');
  };

  const formatLastSync = () => {
    if (!syncStatus.lastSync) return tl('Never');
    return formatRelativeTime(syncStatus.lastSync);
  };

  return (
    <div className={`flex items-center text-sm ${isRTL ? "flex-row-reverse space-x-reverse space-x-2" : "space-x-2"} ${className}`}>
      <div className={`flex items-center ${isRTL ? "flex-row-reverse space-x-reverse space-x-1" : "space-x-1"} ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {syncStatus.isOnline && (
        <>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">
            {tl('Last sync: {{time}}', { time: formatLastSync() })}
          </span>

          {syncStatus.pendingUpdates > 0 && (
            <>
              <span className="text-gray-400">•</span>
              <span className="text-orange-500">
                {tl('{{count}} pending', { count: syncStatus.pendingUpdates })}
              </span>
            </>
          )}

          <button
            onClick={handleForceSync}
            disabled={syncStatus.isSyncing}
            className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            title={tl('Force sync')}
          >
            <RefreshCw className={`w-3 h-3 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </>
      )}
    </div>
  );
}
