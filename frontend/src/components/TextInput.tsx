import { type TextareaHTMLAttributes, useId } from "react";

interface Props
  extends Pick<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "disabled"
  > {
  maxLength?: number;
}

export function TextInput({ maxLength = 5000, ...props }: Props) {
  const id = useId();
  const charCount = typeof props.value === "string" ? props.value.length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-sm font-semibold tracking-wide text-black dark:text-white"
      >
        Text
      </label>
      <div className="relative">
        <textarea
          id={id}
          rows={5}
          placeholder="Type or paste text here… Kamusta kaibigan?"
          maxLength={maxLength}
          className={`
            w-full resize-none border bg-gray-50 px-4 py-3.5
            font-sans text-base leading-relaxed text-black
            placeholder:text-black/30
            transition-colors duration-150
            focus:outline-none focus:ring-1 focus:ring-black/30
            disabled:cursor-not-allowed disabled:opacity-50
            dark:bg-neutral-900 dark:text-white
            dark:placeholder:text-white/30
            dark:focus:ring-white/30
            ${props.disabled
              ? "border-black/10 dark:border-white/10"
              : "border-black/20 hover:border-black/40 dark:border-white/20 dark:hover:border-white/40"
            }
          `}
          {...props}
        />
        <span
          className={`
            pointer-events-none absolute bottom-2.5 right-3
            text-xs tabular-nums
            ${charCount >= maxLength ? "text-red-500 font-semibold" : "text-black/40 dark:text-white/40"}
          `}
        >
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
