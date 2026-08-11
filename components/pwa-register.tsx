"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
      void registration.update();
    }).catch(() => {
      // The app remains usable online when a browser blocks service workers.
    });
  }, []);

  return null;
}
