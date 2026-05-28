import { useCallback } from 'react';
import { snoozeStockVerification, dismissNotification } from '../services/api';

interface UseStockVerificationProps {
  handleBotNavigate: (tab: any, params?: any) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  refreshData: (overrideState?: any) => Promise<void>;
  setIsNotificationOpen: (open: boolean) => void;
}

export const useStockVerification = ({
  handleBotNavigate,
  addToast,
  refreshData,
  setIsNotificationOpen
}: UseStockVerificationProps) => {

  const startStockVerification = useCallback(() => {
    handleBotNavigate('inventory', { filter: 'stock_verify' });
    setIsNotificationOpen(false);
  }, [handleBotNavigate, setIsNotificationOpen]);

  const snoozeVerification = useCallback(async () => {
    try {
      await snoozeStockVerification();
      addToast('Verification reminder snoozed for 24h.', 'success');
      await refreshData();
    } catch {
      addToast('Could not snooze reminder.', 'error');
    }
  }, [addToast, refreshData]);

  const dismissVerification = useCallback(async (id: string) => {
    try {
      await dismissNotification(id);
      await refreshData();
    } catch {
      addToast('Could not dismiss notification.', 'error');
    }
  }, [refreshData, addToast]);

  return {
    startStockVerification,
    snoozeVerification,
    dismissVerification
  };
};
