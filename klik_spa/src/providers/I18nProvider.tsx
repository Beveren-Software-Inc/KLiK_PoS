import React, { createContext, useState, ReactNode } from 'react';

interface I18nContextType {
  locale: string;
  changeLocale: (newLocale: string) => void;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState('en');

  const changeLocale = (newLocale: string) => {
    setLocale(newLocale);
  };

  return (
    <I18nContext.Provider value={{ locale, changeLocale }}>
      {children}
    </I18nContext.Provider>
  );
};
