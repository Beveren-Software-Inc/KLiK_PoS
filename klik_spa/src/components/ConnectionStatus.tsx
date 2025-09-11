import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import websocketService from '../services/websocketService';
import backgroundSyncService from '../services/backgroundSyncService';

interface ConnectionStatusProps {
  className?: string;
}

export default function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [wsStatus, setWsStatus] = useState(websocketService.getConnectionStatus());
  const [syncStatus, setSyncStatus] = useState(backgroundSyncService.getStatus());

  useEffect(() => {
    const handleWsStatusChange = (data: { connected: boolean }) => {
      setWsStatus(websocketService.getConnectionStatus());
    };

    const handleSyncStatusChange = (status: any) => {
      setSyncStatus(status);
    };

    websocketService.on('connection_status', handleWsStatusChange);
    backgroundSyncService.on('status_change', handleSyncStatusChange);

    return () => {
      websocketService.off('connection_status', handleWsStatusChange);
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
    if (wsStatus.connected) return 'text-green-500';
    if (syncStatus.isSyncing) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <WifiOff className="w-4 h-4" />;
    if (wsStatus.connected) return <CheckCircle className="w-4 h-4" />;
    if (syncStatus.isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';
    if (wsStatus.connected) return 'Real-time';
    if (syncStatus.isSyncing) return 'Syncing...';
    return 'Polling';
  };

  const formatLastSync = () => {
    if (!syncStatus.lastSync) return 'Never';
    const now = new Date();
    const diff = now.getTime() - syncStatus.lastSync.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {syncStatus.isOnline && (
        <>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">
            Last sync: {formatLastSync()}
          </span>

          {syncStatus.pendingUpdates > 0 && (
            <>
              <span className="text-gray-400">•</span>
              <span className="text-orange-500">
                {syncStatus.pendingUpdates} pending
              </span>
            </>
          )}

          <button
            onClick={handleForceSync}
            disabled={syncStatus.isSyncing}
            className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            title="Force sync"
          >
            <RefreshCw className={`w-3 h-3 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </>
      )}
    </div>
  );
}
