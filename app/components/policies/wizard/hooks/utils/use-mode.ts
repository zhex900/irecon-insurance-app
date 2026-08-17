import { useContext } from "react";

import { ModeContext } from "../../components/mode-context";

export function useMode() {
  return useContext(ModeContext);
}
