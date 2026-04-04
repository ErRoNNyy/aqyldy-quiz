"use client";

import { useEffect, useState } from "react";

interface CountdownBarProps {
  duration?: number;
}

export default function CountdownBar({ duration = 3000 }: CountdownBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const next = Math.min((elapsed / duration) * 100, 100);
      setProgress(next);

      if (elapsed < duration) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  return (
    <div className="w-full max-w-[360px]">
      <div className="h-[8px] w-full overflow-hidden rounded-full bg-[#d9f3f8]">
        <div
          className="h-full rounded-full bg-[#f28c28] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
