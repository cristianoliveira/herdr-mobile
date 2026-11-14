// Whether a mod block is on screen: a tab not shown keeps its copies running
// but they draw only when it shows again.
import { createContext, useContext } from "react";

export const VisibleContext = createContext(true);
export const useVisible = () => useContext(VisibleContext);
