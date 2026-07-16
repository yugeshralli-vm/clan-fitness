import { RevealOnScroll } from "./RevealOnScroll";

export function EmotionalStatement() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-32 text-center">
      <RevealOnScroll className="flex flex-col gap-4">
        <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          Motivation fades.
          <br />
          Your clan doesn&apos;t.
        </h2>
        <p className="text-base text-foreground-secondary">
          Up to 15 people. No strangers, no noise — just the people who&apos;ll actually ask where
          you were.
        </p>
      </RevealOnScroll>
    </section>
  );
}
