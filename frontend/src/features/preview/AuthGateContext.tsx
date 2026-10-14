import React, { createContext, useContext, useState, useCallback } from 'react';
import { ActiveTab } from '../../components/Navbar.tsx';
import {
  AuthGateState,
  INITIAL_AUTH_GATE_STATE,
  RequestAuthOptions,
  requestAuthAction,
  closeAuthModalAction,
  consumeIntendedTabAction,
} from './authGate.ts';

export interface AuthGateContextType extends AuthGateState {
  requestAuth: (options?: RequestAuthOptions) => void;
  close: () => void;
  consumeIntendedTab: () => ActiveTab;
}

const AuthGateContext = createContext<AuthGateContextType | undefined>(undefined);

export const AuthGateProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [state, setState] = useState<AuthGateState>(INITIAL_AUTH_GATE_STATE);

  const requestAuth = useCallback((options?: RequestAuthOptions) => {
    setState((prev) => requestAuthAction(prev, options));
  }, []);

  const close = useCallback(() => {
    setState((prev) => closeAuthModalAction(prev));
  }, []);

  const consumeIntendedTab = useCallback((): ActiveTab => {
    let chosenTab: ActiveTab = 'dashboard';
    setState((prev) => {
      const { targetTab, nextState } = consumeIntendedTabAction(prev);
      chosenTab = targetTab;
      return nextState;
    });
    return chosenTab;
  }, []);

  return (
    <AuthGateContext.Provider
      value={{
        ...state,
        requestAuth,
        close,
        consumeIntendedTab,
      }}
    >
      {children}
    </AuthGateContext.Provider>
  );
};

export function useAuthGate(): AuthGateContextType {
  const context = useContext(AuthGateContext);
  if (!context) {
    throw new Error('useAuthGate must be used within an AuthGateProvider');
  }
  return context;
}
