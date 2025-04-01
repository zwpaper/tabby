import { useEffect, useState } from "react";

export function useStdoutDimensions(): [number, number] {
  const { columns, rows } = process.stdout;
  const [size, setSize] = useState({ columns, rows });
  useEffect(() => {
    function onResize() {
      const { columns, rows } = process.stdout;
      setSize({ columns, rows });
    }
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);
  return [size.columns, size.rows];
}
