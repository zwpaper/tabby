import { cn } from "@/lib/utils";

interface Props {
  contextWindow: number;
  totalTokens: number;
  className?: string;
}

export function TokenUsage({ totalTokens, contextWindow, className }: Props) {
  const percentage = Math.ceil((totalTokens / contextWindow) * 100);

  return (
    <div
      className={cn(
        "overflow-x-hidden text-muted-foreground text-xs",
        className,
      )}
    >
      <span className="select-none whitespace-nowrap font-medium">
        {percentage}% of {formatTokens(contextWindow)} tokens
      </span>
    </div>
  );
}

function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null || tokens === 0) {
    return "0";
  }
  const k = 1000;
  const m = k * 1000;
  const g = m * 1000;
  // Add T, P, E if needed

  let value: number;
  let unit: string;

  if (tokens >= g) {
    value = tokens / g;
    unit = "G";
  } else if (tokens >= m) {
    value = tokens / m;
    unit = "M";
  } else if (tokens >= k) {
    value = tokens / k;
    unit = "k";
  } else {
    return tokens.toString(); // Return the number as is if less than 1k
  }

  // Format to one decimal place
  let formattedValue = value.toFixed(1);

  // If it ends with .0, remove .0
  if (formattedValue.endsWith(".0")) {
    formattedValue = formattedValue.substring(0, formattedValue.length - 2);
  }

  return `${formattedValue}${unit}`;
}
