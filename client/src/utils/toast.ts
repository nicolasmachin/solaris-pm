import { toast } from "react-hot-toast";

// Toast ámbar para warnings. Dura más que los toasts normales
// porque suele contener información que el usuario debe leer.
export function toastWarning(message: string, durationMs = 5000) {
  return toast(message, {
    duration: durationMs,
    style: {
      background: "#78350f",
      color: "#fef3c7",
      border: "1px solid #b45309",
    },
  });
}
