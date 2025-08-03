import React from "react";
import { FrappeProvider } from "frappe-react-sdk";

interface Props {
  children: React.ReactNode;
}

const FrappeProviderWrapper: React.FC<Props> = ({ children }) => {
  return (
    <FrappeProvider
      url="http://localhost:8000"
      enableSocket={false}
    >
      {children}
    </FrappeProvider>
  );
};

export default FrappeProviderWrapper;
