import { getParkStatusDot } from "@/lib/badge";
import { cn } from "@/lib/utils";

interface TitleWithStatusProps {
  parkName: string;
  status: "open" | "closed" | "unknown";
  className?: string;
}

const TitleWithStatus = ({
  parkName,
  status,
  className,
}: TitleWithStatusProps) => {
  // On sépare les mots pour isoler le dernier
  const words = parkName.trim().split(" ");
  const lastWord = words.pop();
  const beginning = words.join(" ");

  return (
    <h3
      className={cn(
        "font-medium group-hover:text-primary transition-colors duration-300",
        className,
      )}
    >
      {beginning} {/* C'est ici que la magie opère */}
      <span className="inline-flex items-center whitespace-nowrap">
        {lastWord}
        {getParkStatusDot(status, "sm", "ml-2")}
      </span>
    </h3>
  );
};

export default TitleWithStatus;
