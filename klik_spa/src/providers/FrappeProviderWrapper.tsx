import React from "react"
import {FrappeProvider} from "frappe-react-sdk"

interface Props {
    children: React.ReactNode
}

const FrappeProviderWrapper: React.FC<Props> = ({ children }) =>{
    return (
        <FrappeProvider
        url="https://"
        tokenParams ={() =>({
            useToken: true,
            token: "token "
        })}
        >
            {children}
        </FrappeProvider>
    );
};

export default FrappeProviderWrapper;