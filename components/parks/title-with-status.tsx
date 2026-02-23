import { getParkStatusDot } from "@/lib/badge";

interface TitleWithStatusProps {
  parkName: string;
  status: "open" | "closed" | "unknown";
}

const TitleWithStatus = ({ parkName, status }: TitleWithStatusProps) => {
  // On sépare les mots pour isoler le dernier
  const words = parkName.trim().split(" ");
  const lastWord = words.pop();
  const beginning = words.join(" ");

  return (
    <h3 className="font-medium group-hover:text-primary transition-colors duration-300">
      {beginning} {/* C'est ici que la magie opère */}
      <span className="inline-flex items-center whitespace-nowrap">
        {lastWord}
        {getParkStatusDot(status, "sm", "ml-2")}
      </span>
    </h3>
  );
};

export default TitleWithStatus;
