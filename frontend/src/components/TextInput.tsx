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
        className="font-display text-sm font-semibold tracking-wide text-cocoa"
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
            w-full resize-none rounded-xl border-2 bg-white px-4 py-3.5
            font-body text-base leading-relaxed text-espresso
            placeholder:text-mocha/45
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-terracotta/30
            disabled:cursor-not-allowed disabled:opacity-60
            ${props.disabled
              ? "border-sand"
              : "border-sand hover:border-mocha/30 focus:border-terracotta"
            }
          `}
          {...props}
        />
        <span
          className={`
            pointer-events-none absolute bottom-2.5 right-3
            text-xs tabular-nums
            ${charCount >= maxLength ? "text-red-500 font-semibold" : "text-mocha/55"}
          `}
        >
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
