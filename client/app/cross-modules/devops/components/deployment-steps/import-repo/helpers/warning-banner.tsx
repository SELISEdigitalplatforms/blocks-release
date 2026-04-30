const WarningBanner = () => {
  return (
    <div className="flex w-[90%] items-start self-stretch rounded border border-yellow-400 bg-yellow-50 px-4 py-3">
      <div className="pr-10 text-base font-normal leading-6 text-yellow-800">
        Only React repositories built with <span className="font-medium">Blocks Construct</span> are
        currently supported for deployment. Make sure your project follows the{" "}
        <a
          href="https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct"
          className="font-medium text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Blocks Construct
        </a>{" "}
        structure to proceed.
      </div>
    </div>
  );
};

export default WarningBanner;
