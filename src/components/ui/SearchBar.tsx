type Props = {
  defaultValue?: string;
  /** GET target — default `/marketboard`. */
  action?: string;
  /** Query parameter name — default `q`. */
  name?: string;
  placeholder?: string;
};

/**
 * Server-rendered search form. No client JS required:
 * native <form method="get"> updates the URL search params,
 * the page re-renders on the server with the new query.
 */
export function SearchBar({
  defaultValue,
  action = "/marketboard",
  name = "q",
  placeholder = "Search by card or set name",
}: Props) {
  return (
    <form action={action} method="get" className="flex gap-2">
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="flex-1 border border-navy/10 bg-white px-4 py-2 text-sm text-navy placeholder:text-navy/40 focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        className="border border-navy bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-950"
      >
        Search
      </button>
    </form>
  );
}
