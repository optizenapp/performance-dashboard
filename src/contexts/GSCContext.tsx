'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NormalizedMetric } from '@/lib/types';
import { normalizeGSCData } from '@/lib/data-utils';

interface GSCState {
  isAuthenticated: boolean;
  isLoading: boolean;
  sites: string[];
  selectedSite: string | null;
  error: string | null;
}

interface GSCContextType extends GSCState {
  authenticate: () => Promise<boolean>;
  handleCallback: (code: string) => Promise<boolean>;
  checkAuthStatus: () => Promise<boolean>;
  loadSites: () => Promise<void>;
  fetchData: (
    startDate: string,
    endDate: string,
    dimensions?: string[],
    timeSeries?: boolean,
    signal?: AbortSignal
  ) => Promise<NormalizedMetric[]>;
  selectSite: (siteUrl: string) => void;
  disconnect: () => void;
}

const GSCContext = createContext<GSCContextType | null>(null);

export function GSCProvider({ children }: { children: ReactNode }) {
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
            
            // Sync tokens to server
            (async () => {
              try {
                const tokens = localStorage.getItem('gsc_tokens');
                if (tokens) {
                  await fetch('/api/gsc/auth/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tokens: JSON.parse(tokens) })
                  });
                  console.log('Tokens synced to server');
                }
              } catch (error) {
                console.error('Failed to sync tokens to server:', error);
              }
            })();
            
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
          try {
            if (popup?.closed) {
              cleanup();
              setError('Authentication cancelled');
              resolve(false);
            }
          } catch (error) {
            // Cross-Origin-Opener-Policy blocks access to popup.closed
            // This is expected in some browsers, so we'll ignore this error
            // and rely on the message listener and timeout instead
            console.debug('Cannot check popup.closed due to CORS policy (this is normal)');
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
  }, []);

  /**
   * Check current authentication status
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      console.log('🔐 [Global] Checking GSC authentication status...');
      
      // First, try to sync tokens if we have them in localStorage
      const tokens = localStorage.getItem('gsc_tokens');
      if (tokens) {
        try {
          await fetch('/api/gsc/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: JSON.parse(tokens) })
          });
          console.log('✅ [Global] Tokens synced to server during auth check');
        } catch (error) {
          console.error('❌ [Global] Failed to sync tokens during auth check:', error);
        }
      }
      
      const response = await fetch('/api/gsc/sites');
      const isAuth = response.ok;
      
      console.log('🔐 [Global] Auth status check result:', {
        isAuthenticated: isAuth,
        response: response.status,
        willLoadSites: isAuth
      });
      
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: isAuth,
        error: isAuth ? null : 'Not authenticated'
      }));
      
      if (isAuth) {
        console.log('🔄 [Global] Loading sites after auth check...');
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
  }, []);

  /**
   * Load available sites
   */
  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🔄 [Global] Loading GSC sites...');
      const response = await fetch('/api/gsc/sites');
      const data = await response.json();
      
      console.log('📡 [Global] Sites API response:', {
        status: response.status,
        ok: response.ok,
        data: data,
        sitesCount: data.sites?.length || 0
      });
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sites');
      }
      
      setState(prev => {
        const newSelectedSite = prev.selectedSite && data.sites.includes(prev.selectedSite) 
          ? prev.selectedSite  // Keep current selection if still available
          : data.sites.length > 0 ? data.sites[0] : null; // Otherwise default to first
        
        console.log('🏠 [Global] Sites loaded, selection logic:', {
          availableSites: data.sites.length,
          previousSelection: prev.selectedSite,
          newSelection: newSelectedSite,
          selectionKept: prev.selectedSite === newSelectedSite,
          timestamp: new Date().toISOString()
        });
        
        return { 
          ...prev, 
          sites: data.sites,
          selectedSite: newSelectedSite,
          isLoading: false,
          error: null
        };
      });
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
    timeSeries?: boolean,
    signal?: AbortSignal
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
        signal, // Pass the abort signal
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      // Don't set loading false here - let the finally block handle it
      
      // Normalize GSC data to the common format
      const normalizedData = normalizeGSCData(result.data);
      
      console.log('Normalized GSC Data:', {
        rawCount: result.data.length,
        normalizedCount: normalizedData.length,
        sampleNormalized: normalizedData.slice(0, 3)
      });
      
      return normalizedData;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      throw error;
    } finally {
      setLoading(false); // CRITICAL: Always set loading to false
    }
  }, [state.selectedSite]);

  /**
   * Select a site
   */
  const selectSite = useCallback((siteUrl: string) => {
    console.log('🌐 [Global] Site selection changed:', {
      previous: state.selectedSite,
      new: siteUrl,
      timestamp: new Date().toISOString()
    });
    setState(prev => ({ ...prev, selectedSite: siteUrl }));
  }, [state.selectedSite]);

  /**
   * Disconnect GSC
   */
  const disconnect = useCallback(() => {
    console.log('🔌 [Global] Disconnecting GSC...');
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

  const contextValue: GSCContextType = {
    ...state,
    authenticate,
    handleCallback,
    checkAuthStatus,
    loadSites,
    fetchData,
    selectSite,
    disconnect,
  };

  return (
    <GSCContext.Provider value={contextValue}>
      {children}
    </GSCContext.Provider>
  );
}

export function useGSC() {
  const context = useContext(GSCContext);
  if (!context) {
    throw new Error('useGSC must be used within a GSCProvider');
  }
  return context;
}

