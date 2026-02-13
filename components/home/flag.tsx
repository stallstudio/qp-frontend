import * as Flags from "country-flag-icons/react/3x2";

type FlagCode = keyof typeof Flags;

interface FlagProps {
  code: string;
}

export default function Flag({ code }: FlagProps) {
  const upperCode = code.toUpperCase() as FlagCode;
  const FlagComponent = Flags[upperCode];

  if (!FlagComponent) return null;

  return <FlagComponent className="w-6 h-auto rounded-sm border" />;
}
