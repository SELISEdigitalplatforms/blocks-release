export const SpecificationOption = ({
  ram,
  cpu,
  bandwidth,
  isSelected,
  onClick,
}: {
  ram: string;
  cpu: string;
  bandwidth: string;
  id: string;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg border p-4 text-left transition-colors ${
      isSelected ? "border-primary" : "border-default bg-background hover:bg-secondary"
    }`}
  >
    <div className="text-lg font-semibold">{cpu} CPU</div>
    <div className="text-sm">{ram} RAM</div>
    <div className="text-sm">{bandwidth} Bandwidth</div>
  </button>
);
