import { useT } from "@seliseblocks/genesis-os";

const WarningBanner = () => {
  const { t } = useT("release.deployment.shared");
  return (
    <div className="flex w-[90%] items-start self-stretch rounded border border-yellow-400 bg-yellow-50 px-4 py-3">
      <div className="pr-10 text-base font-normal leading-6 text-yellow-800">
        {t("WARNING_BANNER.INTRO")}{" "}
        <span className="font-medium">Blocks Construct</span>{" "}
        {t("WARNING_BANNER.MIDDLE")}{" "}
        <a
          href="https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct"
          className="font-medium text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Blocks Construct
        </a>{" "}
        {t("WARNING_BANNER.END")}
      </div>
    </div>
  );
};

export default WarningBanner;
