"use client";

import { useEffect, useState } from "react";

interface CountdownBarProps {
  duration?: number;
}

export default function CountdownBar({ duration = 3000 }: CountdownBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    // Paint the 0% state first, then flip to 100% so the CSS transition
    // animates the fill smoothly across the whole duration.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setProgress(100));
    });
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  return (
    <div className="w-full max-w-2xl">
      <div className="h-[8px] w-full overflow-hidden rounded-full bg-[#d9f3f8]">
        <div
          className="h-full rounded-full bg-[#f28c28]"
          style={{
            width: `${progress}%`,
            transition: `width ${duration}ms linear`,
          }}
        />
      </div>
    </div>
  );
}
