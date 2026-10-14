import React from 'react';
import { AuthCard } from './AuthCard.tsx';

interface AuthViewProps {
  onNavigateToDashboard?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onNavigateToDashboard }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950">
      <AuthCard onSuccess={onNavigateToDashboard} />
    </div>
  );
};
