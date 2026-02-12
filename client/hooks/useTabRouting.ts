import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { TabId } from '../types';

type SetTab = Dispatch<SetStateAction<TabId>>;
type SetVisited = Dispatch<SetStateAction<Set<TabId>>>;
type SetDeepLink = Dispatch<SetStateAction<any>>;

interface UseTabRoutingOptions {
  setActiveTab: SetTab;
  setVisitedTabs: SetVisited;
  setDeepLinkParams: SetDeepLink;
  tabLabels: Record<string, string>;
}

const FALLBACK_TABS: TabId[] = ['sales', 'inventory', 'history', 'dashboard', 'expenditure', 'settings', 'admin-portal'];

export default function useTabRouting({
  setActiveTab,
  setVisitedTabs,
  setDeepLinkParams,
  tabLabels
}: UseTabRoutingOptions) {
  const syncURL = useCallback(() => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length === 0) return;

    const tab = parts[0] as TabId;
    const isValidTab = Boolean(tabLabels[tab]) || FALLBACK_TABS.includes(tab);

    if (!isValidTab) return;

    setActiveTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab));
    setDeepLinkParams(parts.length > 1 ? { id: parts[1] } : {});
  }, [setActiveTab, setVisitedTabs, setDeepLinkParams, tabLabels]);

  useEffect(() => {
    syncURL();
    window.addEventListener('popstate', syncURL);
    return () => window.removeEventListener('popstate', syncURL);
  }, [syncURL]);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab));
    setDeepLinkParams({});
    window.history.pushState(null, '', `/${tab}`);
  }, [setActiveTab, setVisitedTabs, setDeepLinkParams]);

  const handleBotNavigate = useCallback((tab: TabId, params?: any) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab));
    setDeepLinkParams(params || {});
  }, [setActiveTab, setVisitedTabs, setDeepLinkParams]);

  return { handleTabChange, handleBotNavigate };
}
