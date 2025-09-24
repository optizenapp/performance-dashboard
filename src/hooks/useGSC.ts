import { useState, useCallback } from 'react';
import { NormalizedMetric } from '@/lib/types';

interface GSCState {
  isAuthenticated: boolean;
  isLoading: boolean;
  sites: string[];
  selectedSite: string | null;
  error: string | null;
}

export function useGSC() {
  const [state, setState] = useState<GSCState>({
    isAuthenticated: false,
    isLoading: false,
    sites: [],
    selectedSite: null,
    error: null,
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }));
  };

  const setError = (error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  };

  /**
   * Start OAuth authentication flow
   */
  const authenticate = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/gsc/auth');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get authentication URL');
      }
      
      // Open authentication popup
      const popup = window.open(
        data.authUrl,
        'gsc-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      // Listen for popup completion
      return new Promise<boolean>((resolve, reject) => {
        // Listen for messages from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GSC_AUTH_SUCCESS') {
            cleanup();
            setState(prev => ({ 
              ...prev, 
              isAuthenticated: true, 
              isLoading: false,
              error: null 
            }));
            // Load sites after successful authentication
            loadSites().then(() => resolve(true)).catch(() => resolve(true));
          } else if (event.data.type === 'GSC_AUTH_ERROR') {
            cleanup();
            setError(event.data.error || 'Authentication failed');
            resolve(false);
          }
        };

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            cleanup();
            setError('Authentication cancelled');
            resolve(false);
          }
        }, 1000);
        
        // Cleanup function
        const cleanup = () => {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          popup?.close();
        };
        
        // Add message listener
        window.addEventListener('message', handleMessage);
        
        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Authentication timeout'));
        }, 300000);
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle OAuth callback (called from popup)
   */
  const handleCallback = useCallback(async (code: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/gsc/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }
      
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        isLoading: false,
        error: null 
      }));
      
      // Load sites after authentication
      await loadSites();
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Check current authentication status
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/gsc/sites');
      const isAuth = response.ok;
      
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: isAuth,
        error: isAuth ? null : 'Not authenticated'
      }));
      
      if (isAuth) {
        await loadSites();
      }
      
      return isAuth;
    } catch {
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false,
        error: 'Failed to check authentication status'
      }));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load available sites
   */
  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/gsc/sites');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sites');
      }
      
      setState(prev => ({ 
        ...prev, 
        sites: data.sites,
        selectedSite: data.sites.length > 0 ? data.sites[0] : null,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load sites');
    }
  }, []);

  /**
   * Fetch GSC data
   */
  const fetchData = useCallback(async (
    startDate: string,
    endDate: string,
    dimensions?: string[],
    timeSeries?: boolean
  ): Promise<NormalizedMetric[]> => {
    if (!state.selectedSite) {
      throw new Error('No site selected');
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/gsc/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: state.selectedSite,
          startDate,
          endDate,
          dimensions,
          timeSeries,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      setState(prev => ({ ...prev, isLoading: false, error: null }));
      return result.data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      throw error;
    }
  }, [state.selectedSite]);

  /**
   * Select a site
   */
  const selectSite = useCallback((siteUrl: string) => {
    setState(prev => ({ ...prev, selectedSite: siteUrl }));
  }, []);

  /**
   * Disconnect GSC
   */
  const disconnect = useCallback(() => {
    setState({
      isAuthenticated: false,
      isLoading: false,
      sites: [],
      selectedSite: null,
      error: null,
    });
    
    // Clear stored credentials
    localStorage.removeItem('gsc_tokens');
  }, []);

  return {
    ...state,
    authenticate,
    handleCallback,
    checkAuthStatus,
    loadSites,
    fetchData,
    selectSite,
    disconnect,
  };
}
