interface Props {
  active: boolean;
}

const BAR_COUNT = 8;

export function Waveform({ active }: Props) {
  return (
    <div aria-hidden className="flex items-end gap-[3px] h-8">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          className={`
            block w-[3px] rounded-full
            transition-all duration-300
            ${active
              ? "animate-wave bg-black dark:bg-white"
              : "scale-y-[0.25] bg-black/20 dark:bg-white/20"
            }
          `}
          style={{ height: "32px" }}
        />
      ))}
    </div>
  );
}
