interface SpecificationButtonProps {
  ram: string;
  cpu: string;
  bandwidth: string;
  id: string;
  isSelected: boolean;
  onClick: () => void;
}

export const SpecificationButton = ({
  ram,
  cpu,
  bandwidth,
  isSelected,
  onClick,
}: SpecificationButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`flex h-[116px] w-[178px] flex-col items-start rounded-sm border-2 p-4 transition-all duration-200 ${
        isSelected
          ? "border-primary"
          : "-border-blocks-primary-shades-300 bg-background hover:border-primary"
      }`}
    >
      <div className="mb-2 flex h-8 w-8"></div>
      <div className="mb-1 text-[18px] font-semibold">{ram}</div>
      <div className="mb-1 text-base">{cpu}</div>
      <div className="text-base">{bandwidth}</div>
    </button>
  );
};
